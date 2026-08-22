/**
 * 运行时节奏（动态）。
 *
 * 参数在网页设置页可改（用户要求：这类数值必须可看可改，不能埋在代码里）。
 * runner 每次心跳后经 /api/runner/config 拉一次，改完 ≤15 秒生效、无需重启；
 * 拉不到时沿用上一次的值，初值是 @cosme/core 的 PACING 默认。
 */
import { PACING, randomDelay } from "@cosme/core";
import type { RunnerConfig } from "@cosme/contract";

let current: RunnerConfig = {
  stepDelayMs: { ...PACING.stepDelayMs },
  betweenPresentsMs: { ...PACING.betweenPresentsMs },
};

export function updatePacing(cfg: RunnerConfig | null): void {
  if (cfg) current = cfg;
}

export function pacing(): RunnerConfig {
  return current;
}

export function stepDelay(): number {
  return randomDelay(current.stepDelayMs);
}

export function betweenPresentsDelay(): number {
  return randomDelay(current.betweenPresentsMs);
}
