/**
 * 严格递增的时间戳，用作**队列排序键**。
 *
 * ⚠️ 为什么不能直接用 sqlite 的 `datetime('now')` 默认值：它只到**秒**，
 * 而「跑一轮」是在一个循环里连续插入上百条 draw——实测 25 条任务的 `created_at`
 * 一模一样（`2026-08-21 04:29:44`）。于是 `order by created_at` 排不出确定顺序，
 * 「置顶」轮转时间戳也等于什么都没做（踩过，界面上点了没反应）。
 *
 * 这里保证毫秒精度 + 同毫秒内自增 1ms，因此每个任务都有唯一且单调的键。
 */
let last = 0;

export function nextStamp(): string {
  const now = Date.now();
  last = now > last ? now : last + 1;
  return new Date(last).toISOString();
}

/** 从某个基准开始生成 n 个严格递增的戳（重排队列时用） */
export function stampSeries(baseIso: string, n: number): string[] {
  const base = new Date(baseIso).getTime();
  const start = Number.isNaN(base) ? Date.now() : base;
  return Array.from({ length: n }, (_, i) => new Date(start + i).toISOString());
}
