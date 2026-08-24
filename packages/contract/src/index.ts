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
  /**
   * `/present/` 上「現在募集中のプロデュースメンバー限定プレゼント！」那批。
   * 路径是 `/present/detail/present_id/<ID>`（注意**不带** `/brandcollection` 前缀，
   * ID 段也不同：19614 vs 12057）。
   * ⚠️ 部分需要**ビューティコイン**（页面明示「スペシャルプレゼントのご応募には
   * ビューティコインが必要です」）——会消耗账号积分，投递前要留意。
   */
  "produceMember",
  /**
   * `/present/` 上「ブランドからの新着プレゼント！」那批（タイアップ／PR 合作）。
   *
   * 与其他来源差别很大：卡片在 `ul.presentList` 里，链接是**外部追踪跳转**
   * `https://c.w1.to/c?id=<N>`（不是 cosme.net 路径，按域名过滤会全漏掉），
   * 落到 `/brands/<品牌ID>/tieup/<码>/page.html`（标着【PR】），
   * 页上「今すぐ応募」再经一次追踪跳转，**最终汇入已支持的 `/enquete/confirm` 流程**。
   *
   * 名额通常很大（現品500〜800名様），比粉丝俱乐部那批（20名様）中奖率高得多。
   */
  "tieupCampaign",
]);
export type PresentSource = z.infer<typeof PresentSource>;

/**
 * 单个奖品（全局唯一，与账号无关）。
 *
 * ⚠️ 字段语义要分清，别把「数量」「文案」塞进「期间」——
 * 曾经把 `計5名様現品 · うるおいケアしながら…` 写进了展示为「期间」的字段（已修）。
 */
export const Present = z.object({
  id: z.string(),
  source: PresentSource,
  link: z.string().url(),
  /** 奖品标题 */
  name: z.string(),
  brand: z.string().nullable().default(null),
  imageUrl: z.string().url().nullable().default(null),
  /** 应募期间，**只放日期区间**（如 `8/19～8/25`）。取不到就 null，不要用别的内容凑 */
  period: z.string().nullable().default(null),
  /** 数量与形式（如 `計20名様現品`） */
  quantity: z.string().nullable().default(null),
  /** 一句话文案 */
  tagline: z.string().nullable().default(null),
  scannedAt: z.string().datetime(),
});
export type Present = z.infer<typeof Present>;

/** 某账号 × 某奖品的抽取状态 */
export const DrawStatus = z.enum([
  "pending", // 待抽
  "drawn", // 已抽成功
  "needsChoice", // 需要用户选择（多奖品可选或必填项缺失），已挂起等人工
  "skipped", // 主动跳过（无法确认）
  /**
   * 站点表明这个奖品**已经应募过了**，本次什么都没提交。
   *
   * 判据是结构性的、不依赖文案：走完入口与确认页之后落在问卷页，但页面上
   * **既没有任何题目、也没有送信控件**。实测证据（12057，08-19 投递成功，
   * 08-21 重走流程）：落点仍是 `is-enq.cosme.net/.../ans_pc.php`，题数 0、无 `[name=send]`。
   *
   * ⚠️ 这个状态存在的意义是**让重试变安全**：已应募的奖品重走一遍不会误提交
   * （没有送信按钮可点），所以「投递中断、结果未知」不再必须人工确认——
   * 直接重派一次，由 runner 自己判定。
   */
  "alreadyEntered",
  "failed", // 失败（附 error）
  /**
   * 遇到没见过的页面模式，已安全中止并回传现场。
   * @COSME 有多种奖品类别、每类又有多种流程模式，DOM 各不相同；
   * 与其瞎猜导致误操作，不如停下来把现场交给人补一个新 pattern。
   */
  "unknownPattern",
]);
export type DrawStatus = z.infer<typeof DrawStatus>;

/** 毫秒随机区间 */
export const MsRange = z.object({ min: z.number().int().min(0), max: z.number().int().min(0) });
export type MsRange = z.infer<typeof MsRange>;

/**
 * runner 的运行配置（GET /api/runner/config，Bearer RUNNER_TOKEN）。
 *
 * 节奏参数原先硬编码在 @cosme/core 的 PACING 里，用户要求**在设置页可看可改**
 * （而不是要从对话里察觉再追问）。runner 每次心跳后拉取一次，改完即生效、无需重启。
 */
export const RunnerConfig = z.object({
  /** 单步操作后的随机停顿 */
  stepDelayMs: MsRange,
  /** 两个奖品之间的随机停顿 */
  betweenPresentsMs: MsRange,
});
export type RunnerConfig = z.infer<typeof RunnerConfig>;

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

/**
 * 凭证配置状态。
 *
 * 2026-08-21 语义放宽（用户要求）：**除密码外的字段回显明文**——配置好之后
 * 点开看不见存的是什么，没法核对也没法发现填错（此前只报「哪些字段已填」）。
 * 密码仍然绝不回显：`hasPassword` 只说有没有。
 */
export const CredentialStatus = z.object({
  configured: z.boolean(),
  filledFields: z.array(z.string()),
  /** 已存的邮箱（明文回显；未配置为空串） */
  email: z.string().default(""),
  /** 是否已存密码（值永不回显） */
  hasPassword: z.boolean().default(false),
  /** 个人资料（明文回显） */
  profile: z.object({ name: z.string(), age: z.string(), job: z.string() }).default({ name: "", age: "", job: "" }),
});
export type CredentialStatus = z.infer<typeof CredentialStatus>;

/** 账号列表项（不含任何机密） */
export const AccountSummary = z.object({
  id: z.string(),
  label: z.string(),
  enabled: z.boolean(),
  credentials: CredentialStatus,
  /** 最近一次会话有效的证明时刻（成功任务回传）；null = 从未证明过（该激活登录） */
  sessionOkAt: z.string().nullable().default(null),
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
  sources: z.array(PresentSource).default(["normal", "brandFanClub", "brandFanClubViaBrand", "produceMember", "tieupCampaign"]),
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

/**
 * 登录任务：网页点「激活登录」→ 入队 → Mac mini 的 runner 领到后**弹出有头
 * 浏览器窗口**（该账号自己的 profile），由人完成登录（reCAPTCHA 红线，绝不代填），
 * runner 轮询检测到登录态后自动收尾。pull 模型的天然用法——控制面不需要
 * 任何入站通道就能「让电脑弹窗」。
 */
export const LoginJob = z.object({
  kind: z.literal("login"),
  id: z.string(),
  accountId: z.string(),
});

export const Job = z.discriminatedUnion("kind", [ScanJob, DrawJob, InspectJob, LoginJob]);
export type Job = z.infer<typeof Job>;
export type ScanJob = z.infer<typeof ScanJob>;
export type DrawJob = z.infer<typeof DrawJob>;
export type InspectJob = z.infer<typeof InspectJob>;
export type LoginJob = z.infer<typeof LoginJob>;

/* ────────────────────────────────────────────────────────────
 * 人工介入：选择项
 * runner 遇到「需要选择」时回传的待决内容；用户在网页上选完再恢复任务。
 * ──────────────────────────────────────────────────────────── */

export const ChoiceOption = z.object({
  id: z.string(), // 选项标识（通常是 input 的 value 或序号）
  text: z.string(), // 选项展示文本
  /** 选项自己的配图（当前无可靠来源，保留字段；奖品参考图见 PendingChoice.referenceImages） */
  imageUrl: z.string().url().nullable().default(null),
});
export type ChoiceOption = z.infer<typeof ChoiceOption>;

export const PendingChoice = z.object({
  questionId: z.string(), // 问题标识
  prompt: z.string(), // 问题文本（如「ご希望の商品をお選びください」）
  options: z.array(ChoiceOption),
  /**
   * 奖品参考图（整组原样展示，**不与选项一一对应**）。
   * 实测教训（tu-10695）：PR 页的 `present_img_01/02` 是两张**合成图**——
   * 每张里左右各摆一个系列（图内还画着「or」），选项 1 = 两图的左半、
   * 选项 2 = 两图的右半。按「一图对一选项」挂会精确地误导用户选错。
   * 各奖品版式还都不一样，所以不猜对应关系：整组图放在题目上方当参考资料，
   * 对应关系让用户自己从图里看（图内通常自带说明）。
   */
  referenceImages: z.array(z.string().url()).default([]),
  /**
   * 候选图池：PR 页上全部像样的内容图（排除标题/图标/背景等装饰，按资产号去重，
   * 上限 24）。启发式选出的 referenceImages 有时不对或缺失（实测反馈）——
   * 用户可在选择页从候选里手动挑对的图替换，改动写回快照、历史同步生效。
   */
  candidateImages: z.array(z.string().url()).default([]),
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

/**
 * 做题现场采集的一道题（题号藏在 field 里：is-enq 是 `q<序号>_<问卷ID>_…`，
 * present-blog 是 `id[<数字>]`）。用途：为后续**重新开发匹配库**积累真实题库——
 * 顺手采集，零额外页面访问（就是作答前扫描到的那份结构）。
 */
export const CapturedQuestion = z.object({
  field: z.string(),
  type: z.string(),
  prompt: z.string(),
  required: z.boolean(),
  options: z.array(z.object({ value: z.string(), label: z.string() })),
});
export type CapturedQuestion = z.infer<typeof CapturedQuestion>;

export const SurveyCapture = z.object({
  /** 问卷页 URL（含 enq_id 等） */
  url: z.string(),
  questions: z.array(CapturedQuestion),
});
export type SurveyCapture = z.infer<typeof SurveyCapture>;

export const DrawResult = z.object({
  kind: z.literal("draw"),
  status: DrawStatus,
  /** 命中的流程模式名（便于统计各类别占比） */
  pattern: z.string().nullable().default(null),
  /** status 为 needsChoice 时必填：待用户选择的内容 */
  pendingChoices: z.array(PendingChoice).default([]),
  /** status 为 unknownPattern 时必填：现场诊断包 */
  diagnostics: PatternDiagnostics.nullable().default(null),
  /** 做题时顺手采下的问卷结构（题号/题干/选项），供重建匹配库；没走到问卷则 null */
  surveyCapture: SurveyCapture.nullable().default(null),
});
export type DrawResult = z.infer<typeof DrawResult>;

export const InspectResult = z.object({
  kind: z.literal("inspect"),
  elements: z.array(InspectedElement),
});
export type InspectResult = z.infer<typeof InspectResult>;

export const LoginResult = z.object({
  kind: z.literal("login"),
  loggedIn: z.boolean(),
});
export type LoginResult = z.infer<typeof LoginResult>;

export const JobOutcome = z.discriminatedUnion("kind", [ScanResult, DrawResult, InspectResult, LoginResult]);
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
