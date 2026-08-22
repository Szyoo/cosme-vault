/**
 * @cosme/core —— 与运行环境解耦的领域逻辑。
 * 关键词库、选择器配置从这里统一导出；runner 依赖本包，但本包不依赖 Playwright。
 */
export * from "./keywords.ts";
export * from "./images.ts";
export * from "./answering.ts";
export * from "./period.ts";
export * from "./quantity.ts";
export * as selectors from "./selectors.ts";

/**
 * 抽奖节奏的**默认值**。运行时的实际值在网页设置页可改（存 app_settings，
 * runner 经 /api/runner/config 动态拉取）；这里只作两处兜底：
 * 设置页没改过时的初值，以及 runner 拉不到配置时的降级值。
 *
 * 单批数量上限（原 maxPresentsPerRun=30）已按用户决定取消：合规靠节奏不靠批次大小。
 * 区间数值也按用户决定调整过（原 4~12 秒 → 1~4 秒，2026-08-22）。
 */
export const PACING = {
  /** 单步操作后的随机停顿区间（毫秒） */
  stepDelayMs: { min: 800, max: 2500 },
  /** 两个奖品之间的随机停顿区间（毫秒） */
  betweenPresentsMs: { min: 1000, max: 4000 },
} as const;

/** 在区间内取一个随机整数延迟（供 runner 用 setTimeout 消费） */
export function randomDelay(range: { min: number; max: number }): number {
  return Math.floor(range.min + Math.random() * (range.max - range.min));
}
