/**
 * 运行时节奏（动态）。
 *
 * 参数在网页设置页可改（用户要求：这类数值必须可看可改，不能埋在代码里）。
 * runner 每次心跳后经 /api/runner/config 拉一次，改完 ≤15 秒生效、无需重启；
 * 拉不到时沿用上一次的值，初值是 @cosme/core 的 PACING 默认。
 */
import { PACING, applyRuleOverrides, randomDelay } from "@cosme/core";
import type { PacingConfig, RunnerConfig } from "@cosme/contract";

let current: PacingConfig = {
  stepDelayMs: { ...PACING.stepDelayMs },
  betweenPresentsMs: { ...PACING.betweenPresentsMs },
};

/**
 * 同一个端点同时带回节奏与作答规则，故一并更新。
 *
 * 规则注入进 `@cosme/core` 的模块状态（`applyRuleOverrides`）而不是层层传参：
 * 作答判据在 core 内部使用，调用链上每一层都传一遍规则纯属噪音。
 * 空列表在 core 侧会回落到出厂词表，控制面故障不会导致「一题都不作答」。
 */
export function updatePacing(cfg: RunnerConfig | null): void {
  if (!cfg) return;
  current = { stepDelayMs: cfg.stepDelayMs, betweenPresentsMs: cfg.betweenPresentsMs };
  applyRuleOverrides(cfg.rules);
}

export function pacing(): PacingConfig {
  return current;
}

export function stepDelay(): number {
  return randomDelay(current.stepDelayMs);
}

export function betweenPresentsDelay(): number {
  return randomDelay(current.betweenPresentsMs);
}
