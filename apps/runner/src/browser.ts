/**
 * Playwright 浏览器会话封装。
 * 使用持久化上下文（persistent context）：登录态与设备信任长期保留，
 * 避免反复登录——这是反风控里最关键的一点。
 */
import { chromium, type BrowserContext, type Page } from "playwright";
import { mkdir } from "node:fs/promises";
import { config } from "./config.ts";

let context: BrowserContext | null = null;

/** 获取（或惰性创建）持久化浏览器上下文 */
export async function getContext(): Promise<BrowserContext> {
  if (context) return context;
  await mkdir(config.profileDir, { recursive: true });
  context = await chromium.launchPersistentContext(config.profileDir, {
    headless: config.headless,
    channel: config.channel,
    viewport: { width: 1280, height: 900 },
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
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
