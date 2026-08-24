/**
 * 人工登录助手：打开可见浏览器窗口，由**你本人**完成 @cosme 登录，
 * 会话随持久化 profile 保留，之后自动化复用它。
 *
 * 为什么不自动填密码：登录表单挂了 reCAPTCHA Enterprise（隐形分数制风控）。
 * 脚本化提交等于试图绕过机器人检测——违反站点条款且极易导致账号被标记。
 * 人工过一次风控、机器复用会话，是既合规又稳定的做法
 * （同作者 ledger-helper 处理网银二次验证的思路）。
 *
 * 用法（多账号：一账号一 profile，见 browser.ts 的说明）：
 *   npm run login -- --account <备注名或ID>            给该账号人工登录
 *   npm run login -- --account <备注名或ID> --check    只检查该账号会话
 *   只有一个账号时可省略 --account
 */
import { chromium, type BrowserContext } from "playwright";
import { createInterface } from "node:readline/promises";
import { join } from "node:path";
import { selectors } from "@cosme/core";
import { GATED_URL, isSessionValid } from "./session.ts";

const ROOT_DIR = process.env.RUNNER_PROFILE_DIR ?? "./profile";
const CHECK_ONLY = process.argv.includes("--check");
const accArg = process.argv.indexOf("--account");
const ACCOUNT_WANTED = accArg >= 0 ? process.argv[accArg + 1] : null;

/** 从控制面取账号清单，把 --account 的备注名解析成 accountId */
async function resolveAccountDir(): Promise<{ dir: string; label: string }> {
  const base = (process.env.CONTROL_PLANE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const token = process.env.RUNNER_TOKEN;
  if (!token) throw new Error("缺少 RUNNER_TOKEN（.env）");
  const res = await fetch(`${base}/api/runner/accounts`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`取账号清单失败：HTTP ${res.status}`);
  const { accounts } = (await res.json()) as { accounts: { id: string; label: string; enabled: boolean }[] };
  if (accounts.length === 0) throw new Error("控制面里还没有账号，先去设置页添加");

  let picked = accounts.length === 1 ? accounts[0]! : null;
  if (ACCOUNT_WANTED) {
    picked =
      accounts.find((a) => a.label === ACCOUNT_WANTED) ??
      accounts.find((a) => a.id === ACCOUNT_WANTED || a.id.startsWith(ACCOUNT_WANTED)) ??
      null;
    if (!picked) {
      console.error(`找不到账号「${ACCOUNT_WANTED}」。现有账号：`);
      for (const a of accounts) console.error(`  - ${a.label}（${a.id.slice(0, 8)}…${a.enabled ? "" : "，已停用"}）`);
      process.exit(1);
    }
  }
  if (!picked) {
    console.error("有多个账号，必须用 --account 指定给谁登录。现有账号：");
    for (const a of accounts) console.error(`  - ${a.label}（${a.id.slice(0, 8)}…${a.enabled ? "" : "，已停用"}）`);
    process.exit(1);
  }
  return { dir: join(ROOT_DIR, "accounts", picked.id), label: picked.label };
}

/** 登录后才能看到内容的页面，用它判断会话是否有效 */


async function openContext(dir: string, headless: boolean): Promise<BrowserContext> {
  return chromium.launchPersistentContext(dir, {
    headless,
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });
}

async function main(): Promise<void> {
  const { dir, label } = await resolveAccountDir();
  console.log(`账号「${label}」的 profile：${dir}`);

  if (CHECK_ONLY) {
    const ctx = await openContext(dir, true);
    const ok = await isSessionValid(ctx);
    console.log(ok ? `✅ 「${label}」会话有效，无需重新登录` : `⚠️ 「${label}」会话已失效，请运行 npm run login -- --account ${label}`);
    await ctx.close();
    process.exit(ok ? 0 : 1);
  }

  const ctx = await openContext(dir, false); // 人工登录必须有头
  const page = await ctx.newPage();

  if (await isSessionValid(ctx)) {
    console.log(`✅ 「${label}」当前已是登录态，无需重复登录。`);
    await ctx.close();
    return;
  }

  const entry = selectors.LOGIN.entryUrl(GATED_URL);
  console.log("\n请在弹出的浏览器窗口里完成登录：");
  console.log(`  1. 输入「${label}」账号的 @cosme 邮箱与密码（本程序不会代填——登录表单有 reCAPTCHA 风控）`);
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
