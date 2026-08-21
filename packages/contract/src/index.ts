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
export const PresentSource = z.enum([
  /** `/brandcollection/present/` —— 每周三更新的品牌新品，入口是详情页的 `a[onclick]` */
  "normal",
  /**
   * 粉丝俱乐部限定，**带 `/beautist/article/<ID>` 直链**的那批（桌面列表页上有 10 个）。
   * 走 present-blog 流程。
   */
  "brandFanClub",
  /**
   * 同样是**粉丝俱乐部限定**奖品（详情页也写「ブランドファンクラブ限定プレゼント」），
   * 但列表卡片只链到品牌主页，要多跳一次才拿到奖品地址：
   *   `/brandfanclub/present` 卡片 → `/brand/brand_id/<品牌ID>/top` → `/brands/<品牌ID>/present/<奖品ID>/`
   *
   * 这是奖品的**大头**（实测 55 件里的 45 件）。走 is-enq 流程，
   * 入口是详情页的 `input[onclick]`。
   */
  "brandFanClubViaBrand",
]);
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
  /**
   * 遇到没见过的页面模式，已安全中止并回传现场。
   * @COSME 有多种奖品类别、每类又有多种流程模式，DOM 各不相同；
   * 与其瞎猜导致误操作，不如停下来把现场交给人补一个新 pattern。
   */
  "unknownPattern",
]);
export type DrawStatus = z.infer<typeof DrawStatus>;

/* ────────────────────────────────────────────────────────────
 * cosme 账号凭证与个人资料
 * 加密后存 accounts.credentials_enc；明文只在两处出现：
 * 用户录入的那一次请求，以及 runner 执行任务时按需拉取的内存中。
 * ──────────────────────────────────────────────────────────── */

/**
 * 抽奖表单需要填的个人资料。
 * 字段取自初版 Java Fill.fillName（姓名/年龄/职业）——那里是硬编码的真实信息，
 * 这次改为按账号配置。
 */
export const AccountProfile = z.object({
  /** 表单「名前」栏 */
  name: z.string(),
  /** 表单「年齢」栏 */
  age: z.string(),
  /** 表单职业下拉（初版值如 "自営業/自由業"，注意站点存在全角斜杠与中点两种写法） */
  job: z.string(),
});
export type AccountProfile = z.infer<typeof AccountProfile>;

/** 完整凭证（登录信息 + 个人资料） */
export const AccountCredentials = z.object({
  email: z.string(),
  password: z.string(),
  profile: AccountProfile,
});
export type AccountCredentials = z.infer<typeof AccountCredentials>;

/** 凭证配置状态：只告诉前端「哪些字段已填」，绝不回显值 */
export const CredentialStatus = z.object({
  configured: z.boolean(),
  filledFields: z.array(z.string()),
});
export type CredentialStatus = z.infer<typeof CredentialStatus>;

/** 账号列表项（不含任何机密） */
export const AccountSummary = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  credentials: CredentialStatus,
});
export type AccountSummary = z.infer<typeof AccountSummary>;

/* ────────────────────────────────────────────────────────────
 * 任务（web → runner）
 * runner 用 pull 模型主动拉取；这里定义任务的形状。
 * ──────────────────────────────────────────────────────────── */

/** 扫描任务：抓两个列表页，回传发现的奖品 */
export const ScanJob = z.object({
  kind: z.literal("scan"),
  id: z.string(),
  accountId: z.string(),
  sources: z.array(PresentSource).default(["normal", "brandFanClub", "brandFanClubViaBrand"]),
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

/** 单个可交互元素（inspect 与未知模式诊断共用） */
export const InspectedElement = z.object({
  tag: z.string(),
  type: z.string().nullable().default(null),
  text: z.string(),
  selector: z.string(), // 建议选择器
});
export type InspectedElement = z.infer<typeof InspectedElement>;

/** 失败/调试时回传的现场快照，弥补无头环境「看不见画面」 */
export const Artifacts = z.object({
  screenshotPath: z.string().nullable().default(null),
  htmlSnapshotPath: z.string().nullable().default(null),
  tracePath: z.string().nullable().default(null),
});
export type Artifacts = z.infer<typeof Artifacts>;

/**
 * 未知模式诊断包：`status = 'unknownPattern'` 时回传，供人工据此补写新 pattern。
 * 配合 artifacts 里的截图与 HTML 快照，基本不用再上站点复现。
 */
export const PatternDiagnostics = z.object({
  /** 卡在哪个 URL */
  url: z.string(),
  title: z.string(),
  /** 已尝试过哪些 pattern、各自为何不匹配 */
  triedPatterns: z.array(z.object({ name: z.string(), reason: z.string() })).default([]),
  /** 该页全部可交互元素与建议选择器 */
  elements: z.array(InspectedElement).default([]),
  /** 正文摘要，便于快速辨认页面种类 */
  bodyExcerpt: z.string().default(""),
});
export type PatternDiagnostics = z.infer<typeof PatternDiagnostics>;

/**
 * 单个奖品来源的扫描报告。
 *
 * 为什么需要它：两个来源结构不同（实测 brandcollection 有 present_id 卡片，
 * brandfanclub 登录后仍无），若某来源解析出 0 个就静默返回空，会被误当成
 * 「今天没有新奖品」。这里显式区分「确实没有」与「没认出来」，后者带诊断包。
 */
export const ScanSourceReport = z.object({
  source: PresentSource,
  /** 该来源解析出的奖品数 */
  presentCount: z.number(),
  /** 是否认得这个来源的版式（false = 解析器没认出来，需补实现） */
  recognized: z.boolean(),
  note: z.string().default(""),
  /** recognized 为 false 时附现场，供人工补解析器 */
  diagnostics: PatternDiagnostics.nullable().default(null),
});
export type ScanSourceReport = z.infer<typeof ScanSourceReport>;

export const ScanResult = z.object({
  kind: z.literal("scan"),
  presents: z.array(Present),
  /** 每个来源各自的结果，便于发现「某来源悄悄失效」 */
  sourceReports: z.array(ScanSourceReport).default([]),
});
export type ScanResult = z.infer<typeof ScanResult>;

export const DrawResult = z.object({
  kind: z.literal("draw"),
  status: DrawStatus,
  /** 命中的流程模式名（便于统计各类别占比） */
  pattern: z.string().nullable().default(null),
  /** status 为 needsChoice 时必填：待用户选择的内容 */
  pendingChoices: z.array(PendingChoice).default([]),
  /** status 为 unknownPattern 时必填：现场诊断包 */
  diagnostics: PatternDiagnostics.nullable().default(null),
});
export type DrawResult = z.infer<typeof DrawResult>;

export const InspectResult = z.object({
  kind: z.literal("inspect"),
  elements: z.array(InspectedElement),
});
export type InspectResult = z.infer<typeof InspectResult>;

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
