/**
 * 抽奖流程编排：详情页 → 识别模式 → 交给对应 pattern 执行。
 *
 * 编排层只做「导航到入口 + 选模式 + 兜底」，具体页面操作全在 pattern 里，
 * 这样新增奖品类别时不必碰这个文件。
 */
import type { Page } from "playwright";
import type { AccountCredentials, DrawResult } from "@cosme/contract";
import { PACING, randomDelay, selectors } from "@cosme/core";
import { selectPattern, collectDiagnostics } from "./patterns/index.ts";

export interface DrawDeps {
  log: (text: string, level?: "info" | "warn" | "error") => Promise<void>;
}

/**
 * 对单个奖品执行一次投递。
 *
 * ⚠️ 去重责任在调用方（控制面 DB）：实测 @COSME **任何页面都不标注「已应募」**——
 * 投递成功后详情页照样显示「応募する」，重走入口也照样能进确认页。
 * 因此本函数**不做**「是否已投过」的判断，控制面必须先查 account_presents 再派任务。
 */
export async function drawOnce(
  page: Page,
  params: {
    presentLink: string;
    credentials: AccountCredentials;
    resolvedChoices: Record<string, string>;
  },
  deps: DrawDeps,
): Promise<DrawResult> {
  const pace = () => new Promise<void>((r) => setTimeout(r, randomDelay(PACING.stepDelayMs)));

  // ── 1. 打开详情页，取出「応募する」的跳转地址 ──
  await deps.log(`打开奖品详情页 ${params.presentLink}`);
  await page.goto(params.presentLink, { waitUntil: "domcontentloaded", timeout: 40_000 });
  await pace();

  const entryUrl = await page.evaluate((sel: string) => {
    const a = document.querySelector<HTMLAnchorElement>(sel);
    if (!a) return null;
    const m = (a.getAttribute("onclick") ?? "").match(/location\.href='([^']+)'/);
    return m ? m[1] : null;
  }, selectors.PRESENT.applyAnchor);

  if (!entryUrl) {
    // 没有应募入口：可能已结束、需要额外会员资格，或是没见过的详情页版式
    const diagnostics = await collectDiagnostics(page, [
      { name: "(entry)", reason: `详情页未找到 ${selectors.PRESENT.applyAnchor}` },
    ]);
    const ended = /募集終了|受付終了|終了しました/.test(diagnostics.bodyExcerpt);
    await deps.log(ended ? "该奖品已结束募集，跳过" : "详情页无应募入口且非明确结束，回传现场", ended ? "info" : "warn");
    return ended
      ? { kind: "draw", status: "skipped", pattern: null, pendingChoices: [], diagnostics: null }
      : { kind: "draw", status: "unknownPattern", pattern: null, pendingChoices: [], diagnostics };
  }

  // ── 2. 进入应募流程 ──
  await deps.log("进入应募流程");
  await page.goto(entryUrl, { waitUntil: "domcontentloaded", timeout: 40_000 });
  await pace();

  // ── 3. 识别模式 ──
  const picked = await selectPattern(page);
  if (picked.pattern === null) {
    await deps.log(`遇到未知页面模式，已安全中止并回传现场（${picked.diagnostics.url}）`, "warn");
    return {
      kind: "draw",
      status: "unknownPattern",
      pattern: null,
      pendingChoices: [],
      diagnostics: picked.diagnostics,
    };
  }

  await deps.log(`命中模式：${picked.pattern.name}（${picked.pattern.describes}）`);

  // ── 4. 执行 ──
  const outcome = await picked.pattern.execute(page, {
    profile: params.credentials.profile,
    resolvedChoices: params.resolvedChoices,
    log: deps.log,
    pace,
  });

  return {
    kind: "draw",
    status: outcome.status,
    pattern: picked.pattern.name,
    pendingChoices: outcome.pendingChoices ?? [],
    diagnostics: null,
  };
}
