/**
 * 模式注册表 + 未知模式的反馈机制。
 *
 * 加新模式只需两步：写一个实现 `FlowPattern` 的文件，然后加进下面的 PATTERNS 数组。
 * 顺序即优先级（越具体的模式放越前）。
 */
import type { Page } from "playwright";
import type { PatternDiagnostics } from "@cosme/contract";
import { inspectPage } from "../inspect.ts";
import { isEnqSurveyPattern } from "./is-enq-survey.ts";
import type { FlowPattern } from "./types.ts";

/** 已知模式，按优先级排列 */
export const PATTERNS: readonly FlowPattern[] = [isEnqSurveyPattern];

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
  return { url: page.url(), title, triedPatterns: tried, elements, bodyExcerpt };
}

export type { FlowPattern, PatternContext } from "./types.ts";
