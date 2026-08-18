/**
 * 选择器侦察 CLI —— 校验 `@cosme/core/selectors` 的主力工具。
 *
 * 用法：
 *   npm run recon -- <url>              只读巡检该页面的可交互元素
 *   npm run recon -- <url> --form       只列表单类元素（噪音更少）
 *   npm run recon -- <url> --headed     显示浏览器窗口
 *
 * **不登录、不提交任何表单**，纯只读，对账号零风险。
 * 需要登录态的页面请先用 `npm run login` 建立会话（profile 会持久化）。
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import { formElementsOnly, inspectPage } from "./cosme/inspect.ts";

const args = process.argv.slice(2);
const url = args.find((a) => a.startsWith("http"));
const formOnly = args.includes("--form");
const headed = args.includes("--headed") || process.env.RUNNER_HEADLESS === "false";

if (!url) {
  console.error("用法：npm run recon -- <url> [--form] [--headed]");
  process.exit(1);
}

const OUT = "./artifacts/recon";

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  // 复用持久化 profile：若此前已登录，这里就能看到登录后的页面
  const ctx = await chromium.launchPersistentContext(process.env.RUNNER_PROFILE_DIR ?? "./profile", {
    headless: !headed,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });

  const page = await ctx.newPage();
  console.log(`[recon] 打开 ${url}`);
  const resp = await page.goto(url!, { waitUntil: "domcontentloaded", timeout: 30_000 });
  console.log(`[recon] HTTP ${resp?.status()}  最终地址 ${page.url()}`);
  console.log(`[recon] 标题 ${await page.title()}`);

  const all = await inspectPage(page);
  const list = formOnly ? formElementsOnly(all) : all;

  console.log(`\n[recon] 可交互元素 ${all.length} 个${formOnly ? `（表单类 ${list.length} 个）` : ""}：\n`);
  for (const e of list) {
    const text = e.text ? `  「${e.text}」` : "";
    console.log(`  ${e.tag.padEnd(8)} ${(e.type ?? "").padEnd(14)} ${e.selector}${text}`);
  }

  const slug = new URL(url!).pathname.replace(/\W+/g, "_") || "root";
  await writeFile(`${OUT}/${slug}.json`, JSON.stringify({ url, finalUrl: page.url(), elements: all }, null, 2));
  await page.screenshot({ path: `${OUT}/${slug}.png`, fullPage: true }).catch(() => undefined);
  console.log(`\n[recon] 明细已存 ${OUT}/${slug}.json，截图 ${OUT}/${slug}.png`);

  await ctx.close();
}

void main();
