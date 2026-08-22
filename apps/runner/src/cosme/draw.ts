/**
 * 抽奖流程编排：详情页 → 识别模式 → 交给对应 pattern 执行。
 *
 * 编排层只做「导航到入口 + 选模式 + 兜底」，具体页面操作全在 pattern 里，
 * 这样新增奖品类别时不必碰这个文件。
 */
import type { Page } from "playwright";
import type { AccountCredentials, DrawResult } from "@cosme/contract";
import { stepDelay } from "../pacing.ts";
import { selectPattern, collectDiagnostics , type PatternContext } from "./patterns/index.ts";

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
  // 步进停顿用动态节奏（设置页可改）
  const pace = () => new Promise<void>((r) => setTimeout(r, stepDelay()));

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
    return { kind: "draw", status: "skipped", pattern: null, pendingChoices: [], diagnostics: null, surveyCapture: null };
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
      surveyCapture: null,
    };
  }

  await deps.log(`命中模式：${picked.pattern.name}（${picked.pattern.describes}）`);

  // ── 4. 执行（支持一次「接力」） ──
  //
  // 为什么要接力：入口页与后续页面可能属于不同模式。实测案例——
  // `/brands/<id>/present/<id>/` 详情页的入口是 isauth/addinfo（归 is-enq 模式），
  // 但跳过去落在 `/present/<id>/confirm/`，那是 present-blog 模式的地盘。
  // 让第一个模式跑完后，如果它「没认出落点」而**别的模式认得**，就交棒继续，
  // 而不是直接判未知——否则这类跨模式流程永远走不通。
  // 显式标注 PatternContext：可选槽位（optionImageUrls / surveyCapture）
  // 由各模式沿途写入，字面量推断会丢掉这些属性
  const ctx: PatternContext = {
    profile: params.credentials.profile,
    resolvedChoices: params.resolvedChoices,
    log: deps.log,
    pace,
  };
  let usedPattern = picked.pattern;
  let outcome = await picked.pattern.execute(page, ctx);

  if (outcome.status === "unknownPattern") {
    const second = await selectPattern(page);
    if (second.pattern && second.pattern.name !== picked.pattern.name) {
      await deps.log(`交棒给模式：${second.pattern.name}（落点已换）`);
      usedPattern = second.pattern;
      outcome = await second.pattern.execute(page, ctx);
    }
  }

  // ⚠️ 模式在执行中途也可能返回 unknownPattern（比如 POST 后落到没见过的页面）。
  // 那种情况同样要采集现场——否则反馈机制在这条路径上等于失效（已踩过：
  // present-blog 首次实测落到 /survey/ 页，但诊断包是空的，无从下手）。
  const diagnostics =
    outcome.status === "unknownPattern"
      ? await collectDiagnostics(page, [
          { name: usedPattern.name, reason: "模式执行中途遇到未预期的页面（含接力后）" },
        ])
      : null;

  return {
    kind: "draw",
    status: outcome.status,
    pattern: usedPattern.name,
    pendingChoices: outcome.pendingChoices ?? [],
    diagnostics,
    surveyCapture: ctx.surveyCapture ?? null,
  };
}
