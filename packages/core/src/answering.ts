/**
 * 问卷作答的共用规则。
 *
 * 抽出来的原因：两套流程（is-enq / present-blog）的问卷都要作答，
 * 此前各写一遍，导致 radio 处理不一致（一个命中即停、一个不停 = 最后命中者胜出）。
 * 判据集中在这里，两边只管取 DOM。
 */
import { ANSWER_KEYWORDS, MANUAL_CHOICE_MARKERS, NEGATION_MARKERS } from "./keywords.ts";

/**
 * 匹配前的字符正规化。
 *
 * NFKC 会把全角 ASCII 折成半角（`＠ｃｏｓｍｅ` → `@cosme`）、半角片假名折成全角。
 * 站点两种写法混用——实测词库里存的是全角 `＠ｃｏｓｍｅ`，而问卷选项是半角 `@cosme`，
 * 不正规化就永远不命中。
 */
export function normalizeText(s: string): string {
  return s.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

/**
 * 生效中的规则。默认是 keywords.ts 里的出厂词表；
 * runner 每次心跳后从 `RunnerConfig.rules` 拿到控制面的版本并调 `applyRuleOverrides`。
 *
 * 之所以做成可覆盖而不是直接读 DB：`@cosme/core` 与运行环境解耦（这是它存在的理由），
 * 不能在里面开数据库连接。控制面拉不到时保持出厂词表，作答能力不会因此归零。
 */
let active = {
  answer: ANSWER_KEYWORDS as readonly string[],
  manual: MANUAL_CHOICE_MARKERS as readonly string[],
  negation: NEGATION_MARKERS as readonly string[],
};

/**
 * 正规化后的词库（惰性构建，规则变更时失效重建）。
 *
 * ⚠️ **两边都要正规化**。只折选项文本是没用的：词库里存的是全角 `＠ｃｏｓｍｅ`，
 * 选项是半角 `@cosme`，不把词库也折成同一形式就永远不命中（已踩过这个错）。
 */
let normalizedKeywords: string[] | null = null;
let normalizedNegations: string[] | null = null;
function getNormalizedKeywords(): string[] {
  normalizedKeywords ??= active.answer.map(normalizeText).filter(Boolean);
  return normalizedKeywords;
}
function getNormalizedNegations(): string[] {
  normalizedNegations ??= active.negation.map(normalizeText).filter(Boolean);
  return normalizedNegations;
}

/**
 * 用控制面下发的规则替换出厂词表。
 *
 * ⚠️ **空列表一律忽略**（回落到出厂值）。控制面出故障返回空数组时若照单全收，
 * `answer` 空 = 一题都不作答、`negation` 空 = 反转语义的选项照勾——
 * 两种都是静默的错误作答，比不更新糟得多。
 */
export function applyRuleOverrides(rules: {
  answer?: readonly string[];
  manual?: readonly string[];
  negation?: readonly string[];
}): void {
  active = {
    answer: rules.answer?.length ? rules.answer : ANSWER_KEYWORDS,
    manual: rules.manual?.length ? rules.manual : MANUAL_CHOICE_MARKERS,
    negation: rules.negation?.length ? rules.negation : NEGATION_MARKERS,
  };
  normalizedKeywords = null;
  normalizedNegations = null;
}

/**
 * 正规化之后再做关键词判断（全角半角、大小写、空白均不敏感），
 * 并排除语义被反转的选项。
 */
export function matchesAnswerKeywordNormalized(label: string): boolean {
  const n = normalizeText(label);
  if (!n) return false;
  // 含反转标记的选项一律不选（实测案例：「@cosme以外のWEBサイト」）
  if (getNormalizedNegations().some((m) => n.includes(m))) return false;
  return getNormalizedKeywords().some((k) => n.includes(k));
}

/** 判断题干是否属于「必须人工决定」（正规化后比较） */
export function needsManualChoiceNormalized(prompt: string): boolean {
  const n = normalizeText(prompt);
  return active.manual.every((m) => n.includes(normalizeText(m)));
}

/** 一道题的输入 */
export interface SurveyQuestion {
  field: string;
  type: "radio" | "checkbox" | string;
  /** 题干（不含选项文本）。**必须真的是题干**——needsManualChoice 依赖它。 */
  prompt: string;
  required: boolean;
  options: { value: string; label: string }[];
}

/** 对一道题的决策 */
export type QuestionDecision =
  | { action: "select"; values: string[]; reason: string }
  | { action: "manual"; reason: string }
  | { action: "skip"; reason: string };

/**
 * 决定一道题怎么答。
 *
 * 规则（顺序即优先级）：
 * 1. 用户已在网页上做过选择 → 用它
 * 2. 题干属于「必须人工决定」（如「ご希望の…お選びください」多奖品选择）→ 挂起
 * 3. 同意类选项（「応募する」而非「応募しない」）→ 必选，否则等于不参加
 * 4. 关键词库命中 → 选中；**radio 只取第一个命中**（多选会互相顶掉，谁胜出取决于点击顺序）
 * 5. 一个都没命中且该题必填 → 挂起交人工，**不瞎选**
 * 6. 没命中且非必填 → 跳过
 */
export function decideQuestion(
  q: SurveyQuestion,
  resolvedChoices: Record<string, string>,
): QuestionDecision {
  // 1. 用户已决定
  const resolved = resolvedChoices[q.field];
  if (resolved) {
    return { action: "select", values: [resolved], reason: "用户已选" };
  }
  // 1b. checkbox 家族的反查：is-enq 的 checkbox 每个选项是独立 name（各自成一个 q），
  // 选择页上一族合并成一道题、用户选中的**选项 name** 存进了 resolvedChoices 的 value。
  // 因此「某个选择的 value 等于本题 field」＝ 用户点的就是这个选项 → 勾上。
  if (Object.values(resolvedChoices).includes(q.field)) {
    const v = q.options[0]?.value ?? "1";
    return { action: "select", values: [v], reason: "用户已选（checkbox 家族反查）" };
  }

  // 2. 需要人工决定的题（题干也要正规化后再判断）
  if (needsManualChoiceNormalized(q.prompt)) {
    return { action: "manual", reason: "题干属于需人工选择的类型" };
  }

  // 3. 同意类：不选就等于不参加
  const consent = q.options.filter(
    (o) => o.label.includes("応募する") && !o.label.includes("しない"),
  );
  if (consent.length > 0) {
    return { action: "select", values: [consent[0]!.value], reason: "同意项（応募する）" };
  }

  // 4. 关键词命中
  const hits = q.options.filter((o) => o.label && matchesAnswerKeywordNormalized(o.label));
  if (hits.length > 0) {
    // radio 只能有一个答案；选多个的结果取决于点击顺序，等于随机
    const values = q.type === "radio" ? [hits[0]!.value] : hits.map((h) => h.value);
    return {
      action: "select",
      values,
      reason: `关键词命中 ${hits.length} 项${q.type === "radio" && hits.length > 1 ? "，radio 取第一个" : ""}`,
    };
  }

  // 5/6. 没命中
  return q.required
    ? { action: "manual", reason: "必填但词库无命中——交人工而不是瞎选" }
    : { action: "skip", reason: "非必填且词库无命中" };
}
