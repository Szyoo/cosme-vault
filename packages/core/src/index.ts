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

/** 抽奖节奏参数：合规底线要求「至少人类速度」，一切延迟随机化避免规律性 */
export const PACING = {
  /** 单步操作后的随机停顿区间（毫秒） */
  stepDelayMs: { min: 800, max: 2500 },
  /** 两个奖品之间的随机停顿区间（毫秒） */
  betweenPresentsMs: { min: 4000, max: 12000 },
  /** 单账号单批次最多处理的奖品数（防止一次跑太多显得非人类） */
  maxPresentsPerRun: 30,
} as const;

/** 在区间内取一个随机整数延迟（供 runner 用 setTimeout 消费） */
export function randomDelay(range: { min: number; max: number }): number {
  return Math.floor(range.min + Math.random() * (range.max - range.min));
}
