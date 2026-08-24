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
import { classifyPage, type PageVerdict } from "./page-kind.ts";

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
/**
 * 撞过登录墙的账号（进程内记忆）。
 *
 * 实测事故（2026-08-24）：第二个账号未登录就跑了一整批——127 个 draw 逐个
 * 打开入口、逐个被弹到 auth.cosme.net、逐个安全中止。零误操作，但 127 次
 * 无意义访问本身就是噪音与风险。撞墙一次就把账号拉黑到进程重启
 * （或 login 任务成功）为止，后续任务秒失败、不碰站点。
 */
const authWalled = new Set<string>();

export function markLoggedIn(accountId: string): void {
  authWalled.delete(accountId);
}

export function markAuthWalled(accountId: string): void {
  authWalled.add(accountId);
}

export function isAuthWalled(accountId: string): boolean {
  return authWalled.has(accountId);
}

/**
 * 已知非流程页的统一结论。返回 null 表示「这页没什么可结论的，继续走流程」。
 *
 * - 登录墙 → `failed` + 明确指引（外层据此拉黑该账号，见 index.ts 的护栏）
 * - 已结束 → `skipped`（奖品过期是正常边界，尤其第二个账号晚跑时常遇到）
 * - 404    → `skipped`（站点下架了）
 */
async function concludeKnownPage(v: PageVerdict, deps: DrawDeps): Promise<DrawResult | null> {
  const base = { kind: "draw" as const, pattern: null, pendingChoices: [], diagnostics: null, surveyCapture: null };
  switch (v.kind) {
    case "loginWall":
      await deps.log(`账号未登录（${v.evidence}）——去设置页点「激活登录」后重跑`, "error");
      return { ...base, status: "failed" };
    case "ended":
      await deps.log(`该奖品已结束募集，跳过（${v.evidence}）`);
      return { ...base, status: "skipped" };
    case "notFound":
      await deps.log(`奖品页面已不存在，跳过（${v.evidence}）`, "warn");
      return { ...base, status: "skipped" };
    default:
      return null;
  }
}

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

  // ── 2. 先分类页面：已知的非流程页各有各的结论，别一律推给「未知模式」 ──
  const entry = await classifyPage(page);
  if (entry.kind !== "other") {
    const done = await concludeKnownPage(entry, deps);
    if (done) return done;
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

  // ── 5. 未知落点的兜底阶梯（用户要求：先重试、再全量重认、最后才报未知）──
  //
  // 顺序有讲究：
  //   a. 先看是不是**已知的非流程页**（登录墙 / 已结束 / 404）——这类有确定结论，
  //      报成「未知模式」纯属误导（127 个诊断包全是登录页的教训）。
  //   b. 再给瞬时问题几次机会：慢加载、跳转没落地的，等一下重新分类往往就好了。
  //   c. 最后全量重认模式：落点换了地盘就交棒继续跑（跨模式接力）。
  //   d. 都不行才是真的没见过 → 安全中止 + 现场包。
  for (let attempt = 1; outcome.status === "unknownPattern" && attempt <= 3; attempt++) {
    const verdict = await classifyPage(page);
    if (verdict.kind !== "other") {
      const done = await concludeKnownPage(verdict, deps);
      if (done) return done;
    }

    const again = await selectPattern(page);
    if (again.pattern && again.pattern.name !== usedPattern.name) {
      await deps.log(`交棒给模式：${again.pattern.name}（落点已换）`);
      usedPattern = again.pattern;
      outcome = await again.pattern.execute(page, ctx);
      continue;
    }

    if (attempt < 3) {
      // 瞬时问题（慢跳转/慢加载）：等一拍再看，别急着判死
      await deps.log(`落点暂时无人认领，第 ${attempt} 次重试确认…`, "warn");
      await pace();
      await page.waitForLoadState("domcontentloaded", { timeout: 8_000 }).catch(() => undefined);
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
