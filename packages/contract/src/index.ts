/**
 * @cosme/contract —— 三方（web 控制面 / runner 执行器 / 前端页面）共享的协议单一来源。
 *
 * 一切跨进程的数据形状都在这里用 zod 定义，各端 import 同一份 schema：
 * 协议漂移在编译期即报错，这是前五代「前端对着空气写协议」问题的根治手段。
 */
import { z } from "zod";

/* ────────────────────────────────────────────────────────────
 * 领域实体
 * ──────────────────────────────────────────────────────────── */

/** 奖品来源：@cosme 有两个奖品列表页（普通 / 品牌粉丝俱乐部），沿用二代 draw4cosme 的分类 */
export const PresentSource = z.enum(["normal", "brandFanClub"]);
export type PresentSource = z.infer<typeof PresentSource>;

/** 单个奖品（全局唯一，与账号无关） */
export const Present = z.object({
  id: z.string(),
  source: PresentSource,
  link: z.string().url(),
  name: z.string(),
  brand: z.string().nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
  description: z.string().nullable().default(null),
  scannedAt: z.string().datetime(),
});
export type Present = z.infer<typeof Present>;

/** 某账号 × 某奖品的抽取状态 */
export const DrawStatus = z.enum([
  "pending", // 待抽
  "drawn", // 已抽成功
  "needsChoice", // 需要用户选择（多奖品可选或必填项缺失），已挂起等人工
  "skipped", // 主动跳过（已抽过/无法确认）
  "failed", // 失败（附 error）
]);
export type DrawStatus = z.infer<typeof DrawStatus>;

/* ────────────────────────────────────────────────────────────
 * 任务（web → runner）
 * runner 用 pull 模型主动拉取；这里定义任务的形状。
 * ──────────────────────────────────────────────────────────── */

/** 扫描任务：抓两个列表页，回传发现的奖品 */
export const ScanJob = z.object({
  kind: z.literal("scan"),
  id: z.string(),
  accountId: z.string(),
  sources: z.array(PresentSource).default(["normal", "brandFanClub"]),
});

/** 抽取任务：对某账号的某个奖品走完整抽奖流程 */
export const DrawJob = z.object({
  kind: z.literal("draw"),
  id: z.string(),
  accountId: z.string(),
  presentId: z.string(),
  presentLink: z.string().url(),
  /** 用户已经做出的选择（从「needsChoice」恢复时带回），键为问题标识，值为选项标识 */
  resolvedChoices: z.record(z.string(), z.string()).default({}),
});

/** 巡检任务：登录到指定页面后回传全部可交互元素清单，用于选择器调试（借鉴 ledger-helper 的 inspect 模式） */
export const InspectJob = z.object({
  kind: z.literal("inspect"),
  id: z.string(),
  accountId: z.string(),
  url: z.string().url(),
});

export const Job = z.discriminatedUnion("kind", [ScanJob, DrawJob, InspectJob]);
export type Job = z.infer<typeof Job>;
export type ScanJob = z.infer<typeof ScanJob>;
export type DrawJob = z.infer<typeof DrawJob>;
export type InspectJob = z.infer<typeof InspectJob>;

/* ────────────────────────────────────────────────────────────
 * 人工介入：选择项
 * runner 遇到「需要选择」时回传的待决内容；用户在网页上选完再恢复任务。
 * ──────────────────────────────────────────────────────────── */

export const ChoiceOption = z.object({
  id: z.string(), // 选项标识（通常是 input 的 value 或序号）
  text: z.string(), // 选项展示文本
});
export type ChoiceOption = z.infer<typeof ChoiceOption>;

export const PendingChoice = z.object({
  questionId: z.string(), // 问题标识
  prompt: z.string(), // 问题文本（如「ご希望の商品をお選びください」）
  options: z.array(ChoiceOption),
});
export type PendingChoice = z.infer<typeof PendingChoice>;

/* ────────────────────────────────────────────────────────────
 * 任务结果（runner → web）
 * ──────────────────────────────────────────────────────────── */

/** 失败/调试时回传的现场快照，弥补无头环境「看不见画面」 */
export const Artifacts = z.object({
  screenshotPath: z.string().nullable().default(null),
  htmlSnapshotPath: z.string().nullable().default(null),
  tracePath: z.string().nullable().default(null),
});
export type Artifacts = z.infer<typeof Artifacts>;

export const ScanResult = z.object({
  kind: z.literal("scan"),
  presents: z.array(Present),
});

export const DrawResult = z.object({
  kind: z.literal("draw"),
  status: DrawStatus,
  /** status 为 needsChoice 时必填：待用户选择的内容 */
  pendingChoices: z.array(PendingChoice).default([]),
});

/** inspect 回传的单个可交互元素 */
export const InspectedElement = z.object({
  tag: z.string(),
  type: z.string().nullable().default(null),
  text: z.string(),
  selector: z.string(), // 建议选择器
});

export const InspectResult = z.object({
  kind: z.literal("inspect"),
  elements: z.array(InspectedElement),
});

export const JobOutcome = z.discriminatedUnion("kind", [ScanResult, DrawResult, InspectResult]);
export type JobOutcome = z.infer<typeof JobOutcome>;

export const JobReport = z.object({
  jobId: z.string(),
  ok: z.boolean(),
  outcome: JobOutcome.nullable().default(null),
  error: z.string().nullable().default(null),
  artifacts: Artifacts.nullable().default(null),
  finishedAt: z.string().datetime(),
});
export type JobReport = z.infer<typeof JobReport>;

/* ────────────────────────────────────────────────────────────
 * runner ↔ web 传输层（pull 模型）
 * runner 主动出站，不开入站端口、不依赖 tailnet。
 * ──────────────────────────────────────────────────────────── */

/** runner 长轮询领取下一个任务；无任务时 job 为 null */
export const NextJobResponse = z.object({
  job: Job.nullable(),
});
export type NextJobResponse = z.infer<typeof NextJobResponse>;

/** runner 上报进行中的一条日志（实时展示到网页） */
export const RunnerLog = z.object({
  jobId: z.string().nullable().default(null),
  at: z.string().datetime(),
  level: z.enum(["info", "warn", "error"]).default("info"),
  text: z.string(),
});
export type RunnerLog = z.infer<typeof RunnerLog>;

/** runner 心跳，用于网页展示 runner 在线状态与位置 */
export const RunnerHeartbeat = z.object({
  location: z.enum(["vps", "mac-mini", "unknown"]).default("unknown"),
  at: z.string().datetime(),
  busyJobId: z.string().nullable().default(null),
});
export type RunnerHeartbeat = z.infer<typeof RunnerHeartbeat>;
