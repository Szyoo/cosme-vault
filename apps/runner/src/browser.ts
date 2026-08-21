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
