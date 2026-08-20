/**
 * 抽奖流程编排：详情页 → 识别模式 → 交给对应 pattern 执行。
 *
 * 编排层只做「导航到入口 + 选模式 + 兜底」，具体页面操作全在 pattern 里，
 * 这样新增奖品类别时不必碰这个文件。
 */
import type { Page } from "playwright";
import type { AccountCredentials, DrawResult } from "@cosme/contract";
import { PACING, randomDelay } from "@cosme/core";
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

  // ── 1. 打开奖品入口页（详情页或 article 页） ──
  await deps.log(`打开奖品详情页 ${params.presentLink}`);
  await page.goto(params.presentLink, { waitUntil: "domcontentloaded", timeout: 40_000 });
  await pace();

  // 注意：**编排层不做任何入口跳转**。各来源的入口形态不同
  // （brandcollection 藏在 onclick、brandFanClub 是普通 href），
  // 由各模式在自己的 execute 里处理，这样加新来源不必改这个文件。

  // ── 2. 先判断是否明确已结束（省掉无谓的模式识别） ──
  const bodyNow = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 2000));
  if (/募集(は)?終了|受付(は)?終了|終了しました|受付を終了/.test(bodyNow)) {
    await deps.log("该奖品已结束募集，跳过");
    return { kind: "draw", status: "skipped", pattern: null, pendingChoices: [], diagnostics: null };
  }

  // ── 3. 识别模式（入口形态各异，交给各模式自己认） ──
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
