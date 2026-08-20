/**
 * Playwright 浏览器会话封装。
 * 使用持久化上下文（persistent context）：登录态与设备信任长期保留，
 * 避免反复登录——这是反风控里最关键的一点。
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { selectors } from "@cosme/core";
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
  await mobileContext?.close();
  mobileContext = null;
  await context?.close();
  context = null;
}

/**
 * 手机 UA 的独立上下文。
 *
 * 为什么需要：全量奖品列表只在 `s.cosme.net/present/` 上，且**必须手机 UA**
 * 才拿到 57 件的完整清单（桌面 UA 给的是桌面版内容，只有 13 个）。
 * 与主上下文共用同一份持久化 profile 目录不可行（Chrome 单实例锁），
 * 故用主浏览器新开一个 context，只覆盖 UA 与视口——会话 cookie 需要另行携带。
 */
let mobileContext: BrowserContext | null = null;

export async function getMobileContext(): Promise<BrowserContext> {
  if (mobileContext) return mobileContext;
  const main = await getContext();
  mobileContext = await main.browser()!.newContext({
    userAgent: selectors.MOBILE_USER_AGENT,
    viewport: { width: 390, height: 844 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  // 把登录态带过去：奖品列表需要登录才完整
  await mobileContext.addCookies(await main.cookies());
  return mobileContext;
}

export async function newMobilePage(): Promise<Page> {
  return (await getMobileContext()).newPage();
}
