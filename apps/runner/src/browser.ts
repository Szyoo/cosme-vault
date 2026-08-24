/**
 * Playwright 浏览器会话封装 —— **每个 cosme 账号一个独立持久化 profile**。
 *
 * 为什么必须分开：登录受 reCAPTCHA Enterprise 保护，只能人工登录一次、
 * 靠持久化 profile 长期保留会话（红线：绝不脚本化登录）。一个 profile 只能
 * 装一份登录态，多账号自然要一账号一 profile：`<profileDir>/accounts/<accountId>`。
 * 旧的单账号会话已迁移至主账号的子目录（2026-08-24 手工迁移）。
 *
 * 新账号接入流程（缺一不可）：
 *   1. 设置页添加账号并录凭证（姓名/年龄/职业要进问卷）
 *   2. Mac mini 上 `npm run login -- --account <备注名>` 人工登录一次
 *   3. 之后该账号的任务自动用它自己的 profile
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";

const contexts = new Map<string, BrowserContext>();

/** 某账号的 profile 目录（login.ts 与主循环共用同一条规则） */
export function profileDirFor(accountId: string): string {
  return join(config.profileDir, "accounts", accountId);
}

function launchOptions() {
  return {
    headless: config.headless,
    channel: config.channel,
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP" as const,
    timezoneId: "Asia/Tokyo",
    // 显式超时：否则残留锁会让启动无限等待、任务永远卡在 running（已踩过）
    timeout: 30_000,
  };
}

/**
 * 清理某 profile 残留的 Chrome 单例锁。
 * runner 被强杀时 Chrome 来不及清 SingletonLock/Socket/Cookie，下次启动会无限等；
 * 同一 profile 只有一个 runner 在用，清锁重试是安全的。
 */
async function clearStaleLocks(dir: string): Promise<void> {
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    await rm(join(dir, f), { force: true }).catch(() => undefined);
  }
}

/** 获取（或惰性创建）某账号的持久化浏览器上下文 */
export async function getContext(accountId: string): Promise<BrowserContext> {
  const existing = contexts.get(accountId);
  if (existing) return existing;
  const dir = profileDirFor(accountId);
  await mkdir(dir, { recursive: true });
  let ctx: BrowserContext;
  try {
    ctx = await chromium.launchPersistentContext(dir, launchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[runner] 浏览器启动失败（${message.slice(0, 80)}），清理残留锁后重试一次`);
    await clearStaleLocks(dir);
    ctx = await chromium.launchPersistentContext(dir, launchOptions());
  }
  contexts.set(accountId, ctx);
  return ctx;
}

export async function newPage(accountId: string): Promise<Page> {
  const ctx = await getContext(accountId);
  return ctx.newPage();
}

/** 关掉某账号的无头上下文并清锁（login 任务要用同一 profile 弹有头窗，必须先释放） */
export async function closeAccountContext(accountId: string): Promise<void> {
  const ctx = contexts.get(accountId);
  contexts.delete(accountId);
  if (ctx) {
    await Promise.race([
      ctx.close().catch(() => undefined),
      new Promise<void>((r) => setTimeout(r, 5_000)),
    ]);
  }
  await clearStaleLocks(profileDirFor(accountId));
}

export async function closeBrowser(): Promise<void> {
  for (const ctx of contexts.values()) await ctx.close().catch(() => undefined);
  contexts.clear();
}

/**
 * 硬重启浏览器（看门狗用）：close 本身也可能僵死，5 秒不退就按 profile 根目录
 * SIGKILL 全部 Chrome，再清各账号的残留锁。下次 getContext 惰性拉起新实例。
 */
export async function restartBrowser(): Promise<void> {
  const dirs = [...contexts.keys()].map(profileDirFor);
  const list = [...contexts.values()];
  contexts.clear();
  const closed = await Promise.race([
    Promise.all(list.map((c) => c.close().catch(() => undefined))).then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 5_000)),
  ]);
  if (!closed) {
    const { execFile } = await import("node:child_process");
    await new Promise<void>((r) => execFile("pkill", ["-9", "-f", config.profileDir], () => r()));
  }
  for (const d of dirs) await clearStaleLocks(d);
}
