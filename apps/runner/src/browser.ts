/**
 * Playwright 浏览器会话封装。
 * 使用持久化上下文（persistent context）：登录态与设备信任长期保留，
 * 避免反复登录——这是反风控里最关键的一点。
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { config } from "./config.ts";

let context: BrowserContext | null = null;

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
 * 清理残留的 Chrome 单例锁。
 *
 * runner 被强杀（如 SIGKILL）时 Chrome 来不及清理 `SingletonLock/Socket/Cookie`，
 * 下次启动会卡在这些锁上。本项目设计上**同一 profile 只有一个 runner**，
 * 故启动失败后清掉锁重试一次是安全的。
 */
async function clearStaleLocks(): Promise<void> {
  for (const f of ["SingletonLock", "SingletonSocket", "SingletonCookie"]) {
    await rm(join(config.profileDir, f), { force: true }).catch(() => undefined);
  }
}

/** 获取（或惰性创建）持久化浏览器上下文 */
export async function getContext(): Promise<BrowserContext> {
  if (context) return context;
  await mkdir(config.profileDir, { recursive: true });
  try {
    context = await chromium.launchPersistentContext(config.profileDir, launchOptions());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[runner] 浏览器启动失败（${message.slice(0, 80)}），清理残留锁后重试一次`);
    await clearStaleLocks();
    context = await chromium.launchPersistentContext(config.profileDir, launchOptions());
  }
  return context;
}

export async function newPage(): Promise<Page> {
  const ctx = await getContext();
  return ctx.newPage();
}

export async function closeBrowser(): Promise<void> {
  await context?.close();
  context = null;
}

/**
 * 硬重启浏览器：给看门狗用。
 *
 * ⚠️ 不能只 `context.close()`——僵死场景里 close 本身也可能永不返回，
 * 所以 close 也套 5 秒超时，超了就直接 SIGKILL 底层 Chrome 进程，
 * 再清残留的 Singleton 锁。下一次 getContext() 会惰性拉起新实例。
 */
export async function restartBrowser(): Promise<void> {
  const ctx = context;
  context = null;
  if (ctx) {
    const closed = await Promise.race([
      ctx.close().then(() => true).catch(() => true),
      new Promise<boolean>((r) => setTimeout(() => r(false), 5_000)),
    ]);
    if (!closed) {
      // close 也僵住了：按 profile 目录精确杀掉这个 Chrome 实例
      // （--user-data-dir 参数里带着 profileDir，pkill -f 能唯一匹配）
      const { execFile } = await import("node:child_process");
      await new Promise<void>((r) => execFile("pkill", ["-9", "-f", config.profileDir], () => r()));
    }
  }
  await clearStaleLocks();
}
