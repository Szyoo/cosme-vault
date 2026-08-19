/**
 * 流程模式（pattern）框架。
 *
 * 为什么要这层：@COSME 的奖品分若干大类，每类又有多种流程模式，
 * 页面结构与按钮 DOM 各不相同（实测已见两种差异：brandcollection 列表有 present_id 卡片，
 * brandfanclub 列表登录后仍无 present_id 链接）。硬编码单一流程必然在遇到新模式时误操作。
 *
 * 约定：每个 pattern 自己回答「这一页是不是我认识的」，不认识就交给下一个；
 * 全都不认识则**安全中止**并回传诊断包（见 `PatternDiagnostics`），绝不瞎点。
 */
import type { Page } from "playwright";
import type { AccountProfile, DrawResult, PendingChoice } from "@cosme/contract";

/** pattern 执行时可用的上下文 */
export interface PatternContext {
  /** 账号的个人资料（问卷里的 prof_* 字段要用） */
  profile: AccountProfile;
  /** 用户已做的选择（从 needsChoice 恢复时带回）：questionId → optionId */
  resolvedChoices: Record<string, string>;
  /** 推送一条实时日志到控制面 */
  log: (text: string, level?: "info" | "warn" | "error") => Promise<void>;
  /** 人类速度的随机停顿 */
  pace: () => Promise<void>;
}

/** pattern 的识别结果 */
export type Recognition = { matched: true } | { matched: false; reason: string };

/** pattern 的执行结果（不含 jobId 等外层字段） */
export type PatternOutcome = {
  status: DrawResult["status"];
  pendingChoices?: PendingChoice[];
};

export interface FlowPattern {
  /** 模式名，会记进 DrawResult.pattern 便于统计 */
  readonly name: string;
  /** 一句话说明这个模式覆盖什么 */
  readonly describes: string;
  /** 当前页面是否属于本模式；不匹配要给出可读的原因（会进诊断包） */
  recognize(page: Page): Promise<Recognition>;
  /** 执行本模式的流程 */
  execute(page: Page, ctx: PatternContext): Promise<PatternOutcome>;
}
