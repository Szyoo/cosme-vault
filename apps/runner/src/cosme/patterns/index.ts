/**
 * 模式注册表 + 未知模式的反馈机制。
 *
 * 加新模式只需两步：写一个实现 `FlowPattern` 的文件，然后加进下面的 PATTERNS 数组。
 * 顺序即优先级（越具体的模式放越前）。
 */
import { createHash } from "node:crypto";
import type { Page } from "playwright";
import type { PatternDiagnostics } from "@cosme/contract";
import { inspectPage } from "../inspect.ts";
import { isEnqSurveyPattern } from "./is-enq-survey.ts";
import { presentBlogPattern } from "./present-blog.ts";
import { tieupCampaignPattern } from "./tieup-campaign.ts";
import type { FlowPattern } from "./types.ts";

/**
 * 已知模式，按优先级排列（越具体的放越前）。
 *
 * present-blog 放在前面：它的识别条件更窄（URL 形态 + present-blog 表单），
 * 而 is-enq-survey 的识别条件里包含「页面有 /enquete/confirm 表单」这种较宽的判断。
 */
// tieup 放最前：它按 URL 精确匹配 /brands/<id>/tieup/…，绝不会误认别人的页面
export const PATTERNS: readonly FlowPattern[] = [tieupCampaignPattern, presentBlogPattern, isEnqSurveyPattern];

export interface PatternMatch {
  pattern: FlowPattern;
}

/**
 * 逐个询问已注册模式，返回第一个认领当前页面的。
 * 全都不认领时返回 null，并把每个模式的拒绝原因收进 diagnostics。
 */
export async function selectPattern(
  page: Page,
): Promise<{ pattern: FlowPattern } | { pattern: null; diagnostics: PatternDiagnostics }> {
  const tried: { name: string; reason: string }[] = [];

  for (const pattern of PATTERNS) {
    const r = await pattern.recognize(page);
    if (r.matched) return { pattern };
    tried.push({ name: pattern.name, reason: r.reason });
  }

  // 没有模式认领 → 采集完整现场，交给人补一个新 pattern
  return { pattern: null, diagnostics: await collectDiagnostics(page, tried) };
}

/** 采集未知页面的诊断包：URL / 标题 / 全部可交互元素 / 正文摘要 / 各模式拒绝原因 */
export async function collectDiagnostics(
  page: Page,
  tried: { name: string; reason: string }[] = [],
): Promise<PatternDiagnostics> {
  const [title, bodyExcerpt, elements] = await Promise.all([
    page.title().catch(() => ""),
    page
      .evaluate(() => document.body.innerText.replace(/\s+/g, " ").slice(0, 1200))
      .catch(() => ""),
    inspectPage(page).catch(() => []),
  ]);
  const url = page.url();

  // 截图内嵌回传（视口尺寸 + JPEG 压缩）：控制面在 VPS 上，读不到 Mac mini 的
  // 本地文件——不内嵌就等于没有截图（用户指出「要能看到页面截图」）。
  // fullPage 的 PNG 动辄数 MB，视口 JPEG q55 通常在 100~250KB。
  const screenshot = await page
    .screenshot({ type: "jpeg", quality: 55 })
    .then((buf) => (buf.byteLength <= 900_000 ? `data:image/jpeg;base64,${buf.toString("base64")}` : null))
    .catch(() => null);

  // 截图拿不到（页面已关闭 / 体积超限）时降级存 HTML 快照：诊断页会用
  // sandbox iframe 把它还原成看得见的页面——留可视证据，不是让人读 DOM。
  // 注入 <base> 让相对路径的 CSS/图片仍能从站点加载。
  const htmlSnapshot = screenshot
    ? null
    : await page
        .content()
        .then((html) =>
          html.length <= 1_500_000
            ? html.replace(/<head(\s[^>]*)?>/i, (m) => `${m}<base href="${url}">`)
            : null,
        )
        .catch(() => null);

  return {
    url,
    title,
    triedPatterns: tried,
    elements,
    bodyExcerpt,
    fingerprint: fingerprintOf(url, elements),
    screenshot,
    htmlSnapshot,
  };
}

/**
 * 异常指纹：同一种异常应当只在诊断页出现一次。
 *
 * URL 先规范化——把每次都不同的参数（a_key/token/redirect_uri/present_id…）
 * 抹掉，否则 127 个奖品会产出 127 个「不同」的指纹，去重就白做了。
 * 再拼上页面可交互元素的选择器集合（页面结构的稳定特征）。
 */
export function fingerprintOf(url: string, elements: { selector: string }[]): string {
  let normalized = url;
  try {
    const u = new URL(url);
    normalized = `${u.hostname}${u.pathname.replace(/\/\d+/g, "/<n>")}`;
  } catch {
    // 非法 URL 就原样用
  }
  const shape = [...new Set(elements.map((e) => e.selector))].sort().join("|");
  return createHash("sha256").update(`${normalized}\n${shape}`).digest("hex").slice(0, 16);
}

export type { FlowPattern, PatternContext } from "./types.ts";
