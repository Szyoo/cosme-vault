/**
 * 人工登录助手：打开可见浏览器窗口，由**你本人**完成 @cosme 登录，
 * 会话随持久化 profile 保留，之后自动化复用它。
 *
 * 为什么不自动填密码：登录表单挂了 reCAPTCHA Enterprise（隐形分数制风控）。
 * 脚本化提交等于试图绕过机器人检测——违反站点条款且极易导致账号被标记。
 * 人工过一次风控、机器复用会话，是既合规又稳定的做法
 * （同作者 ledger-helper 处理网银二次验证的思路）。
 *
 * 用法：
 *   npm run login            打开登录页，登录完成后回车退出
 *   npm run login -- --check 只检查当前会话是否有效，不打开登录页
 */
import { chromium, type BrowserContext } from "playwright";
import { createInterface } from "node:readline/promises";
import { selectors } from "@cosme/core";

const PROFILE_DIR = process.env.RUNNER_PROFILE_DIR ?? "./profile";
const CHECK_ONLY = process.argv.includes("--check");

/** 登录后才能看到内容的页面，用它判断会话是否有效 */
const GATED_URL = selectors.LIST_URLS.brandFanClub;

async function openContext(headless: boolean): Promise<BrowserContext> {
  return chromium.launchPersistentContext(PROFILE_DIR, {
    headless,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });
}

/**
 * 检查会话有效性。
 *
 * ⚠️ 不能只看「是否被重定向到授权服务器」——实测 brandfanclub 页未登录时
 * 照样返回 200，只是渲染成未登录版本，那样判断会一律误报为已登录。
 * 可靠依据是页面上还有没有登录入口：未登录版本会渲染 `/isauth/login/` 链接。
 */
export async function isSessionValid(ctx: BrowserContext): Promise<boolean> {
  const page = await ctx.newPage();
  try {
    await page.goto(GATED_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });

    // 被直接弹到授权服务器：肯定未登录
    if (page.url().includes(selectors.LOGIN.authHost)) return false;

    // 页面上仍有登录入口：未登录
    const loginLinks = await page.locator('a[href*="/isauth/login/"]').count();
    return loginLinks === 0;
  } catch {
    return false;
  } finally {
    await page.close();
  }
}

async function main(): Promise<void> {
  if (CHECK_ONLY) {
    const ctx = await openContext(true);
    const ok = await isSessionValid(ctx);
    console.log(ok ? "✅ 会话有效，无需重新登录" : "⚠️ 会话已失效，请运行 npm run login 重新登录");
    await ctx.close();
    process.exit(ok ? 0 : 1);
  }

  const ctx = await openContext(false); // 人工登录必须有头
  const page = await ctx.newPage();

  if (await isSessionValid(ctx)) {
    console.log("✅ 当前会话已是登录态，无需重复登录。");
    console.log("   如需换账号，先删除 profile 目录再运行本命令。");
    await ctx.close();
    return;
  }

  const entry = selectors.LOGIN.entryUrl(GATED_URL);
  console.log("\n请在弹出的浏览器窗口里完成登录：");
  console.log("  1. 输入 @cosme 邮箱与密码（本程序不会代填——登录表单有 reCAPTCHA 风控）");
  console.log("  2. 保持勾选「次回から自動でログイン」以延长会话");
  console.log("  3. 登录成功后回到本终端按回车\n");
  await page.goto(entry, { waitUntil: "domcontentloaded" });

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  await rl.question("登录完成后按回车继续…");
  rl.close();

  const ok = await isSessionValid(ctx);
  console.log(ok ? "✅ 会话已建立并保存到 profile，自动化可以复用了。" : "❌ 仍未检测到登录态，请重试。");
  await ctx.close();
  process.exit(ok ? 0 : 1);
}

void main();
