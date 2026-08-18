/**
 * 数据模型（Drizzle / SQLite）。
 *
 * 三表核心沿用二代 draw4cosme 的设计：账号、奖品、账号×奖品状态，
 * 支持「多 cosme 账号串行轮抽」。另加 jobs / runner_logs 支撑 pull 模型与实时日志。
 */
import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/** cosme 账号：凭证与个人资料加密后存 credentialsEnc（AES-256-GCM，主密钥在 env/secret） */
export const accounts = sqliteTable("accounts", {
  id: text("id").primaryKey(),
  label: text("label").notNull(), // 展示名（非机密）
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  /** 加密后的凭证 + 个人资料（邮箱/密码/姓名/年龄/职业等）；null 表示未配置 */
  credentialsEnc: text("credentials_enc"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

/** 奖品：全局唯一，多账号共享一份扫描结果 */
export const presents = sqliteTable(
  "presents",
  {
    id: text("id").primaryKey(),
    source: text("source", { enum: ["normal", "brandFanClub"] }).notNull(),
    link: text("link").notNull(),
    name: text("name").notNull(),
    brand: text("brand"),
    imageUrl: text("image_url"),
    description: text("description"),
    scannedAt: text("scanned_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("presents_link_uq").on(t.link)],
);

/** 账号 × 奖品的抽取状态 */
export const accountPresents = sqliteTable(
  "account_presents",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    presentId: text("present_id")
      .notNull()
      .references(() => presents.id, { onDelete: "cascade" }),
    status: text("status", {
      enum: ["pending", "drawn", "needsChoice", "skipped", "failed"],
    })
      .notNull()
      .default("pending"),
    /** needsChoice 时暂存待用户选择的内容（PendingChoice[] 的 JSON） */
    pendingChoices: text("pending_choices"),
    /** 用户已做的选择（Record<questionId, optionId> 的 JSON），恢复任务时回传给 runner */
    resolvedChoices: text("resolved_choices"),
    error: text("error"),
    drawnAt: text("drawn_at"),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => [uniqueIndex("account_present_uq").on(t.accountId, t.presentId)],
);

/** 任务队列：runner 用 pull 模型领取（status 从 queued → running → done/failed） */
export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  kind: text("kind", { enum: ["scan", "draw", "inspect"] }).notNull(),
  status: text("status", { enum: ["queued", "running", "done", "failed"] })
    .notNull()
    .default("queued"),
  /** 任务载荷（Job 去掉 id/kind 后的 JSON） */
  payload: text("payload").notNull(),
  /** 触发来源：cron 定时 或 manual 手动 */
  trigger: text("trigger", { enum: ["cron", "manual"] }).notNull().default("manual"),
  result: text("result"), // JobReport 的 JSON
  error: text("error"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  startedAt: text("started_at"),
  finishedAt: text("finished_at"),
});

/** runner 实时日志（网页展示运行状态） */
export const runnerLogs = sqliteTable("runner_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  jobId: text("job_id"),
  at: text("at").notNull(),
  level: text("level", { enum: ["info", "warn", "error"] }).notNull().default("info"),
  text: text("text").notNull(),
});

/** 管理员账号（单用户；库里无账号时首次登录用 ADMIN_USERNAME/ADMIN_PASSWORD 自动建号） */
export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  /** scrypt:salt:hash */
  passwordHash: text("password_hash").notNull(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});
