/**
 * IP 探针实验。
 *
 * 目的：在正式决定 runner 部署位（VPS 无头 vs Mac mini 住宅 IP）之前，
 * 用数据回答「@cosme 是否会因数据中心 IP + 无头指纹拦截我们」。
 *
 * 在候选机器上运行：
 *   npm run probe                 # 无头（模拟 VPS 生产形态）
 *   RUNNER_HEADLESS=false npm run probe   # 有头对照
 *
 * 它只做只读访问（不登录、不抽奖），逐个打开关键页面，记录：
 *   HTTP 状态、最终 URL（是否被重定向到验证/拦截页）、标题、
 *   页面是否含验证码/风控挑战特征词，并对每页存一张截图到 artifacts/probe/。
 *
 * ⚠️ 这是探测，务必低频手动运行，不要循环刷。
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";

const HEADLESS = process.env.RUNNER_HEADLESS !== "false";
const CHANNEL = process.env.PLAYWRIGHT_CHANNEL || undefined;
const OUT_DIR = "./artifacts/probe";

/** 要探测的只读页面 */
const TARGETS = [
  { name: "top", url: "https://www.cosme.net/" },
  { name: "present-list", url: "https://www.cosme.net/present/" },
  { name: "login", url: "https://www.cosme.net/login/" },
];

/** 拦截/风控页面的特征词（命中即高度可疑） */
const BLOCK_MARKERS = [
  "captcha",
  "recaptcha",
  "hcaptcha",
  "are you a robot",
  "アクセスが集中",
  "アクセスできません",
  "ただいま大変混み合っております",
  "不正なアクセス",
  "Access Denied",
  "Forbidden",
  "cloudflare",
  "Just a moment",
];

interface ProbeRow {
  name: string;
  url: string;
  status: number | null;
  finalUrl: string;
  redirected: boolean;
  title: string;
  blockHits: string[];
  error: string | null;
}

async function probeOne(
  context: Awaited<ReturnType<typeof chromium.launchPersistentContext>>,
  target: (typeof TARGETS)[number],
): Promise<ProbeRow> {
  const page = await context.newPage();
  const row: ProbeRow = {
    name: target.name,
    url: target.url,
    status: null,
    finalUrl: "",
    redirected: false,
    title: "",
    blockHits: [],
    error: null,
  };
  try {
    const resp = await page.goto(target.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
    row.status = resp?.status() ?? null;
    row.finalUrl = page.url();
    row.redirected = new URL(row.finalUrl).pathname !== new URL(target.url).pathname;
    row.title = await page.title();
    const bodyText = (await page.content()).toLowerCase();
    row.blockHits = BLOCK_MARKERS.filter((m) => bodyText.includes(m.toLowerCase()));
    await page.screenshot({ path: `${OUT_DIR}/${target.name}.png`, fullPage: false });
  } catch (err) {
    row.error = err instanceof Error ? err.message : String(err);
  } finally {
    await page.close();
  }
  return row;
}

async function main(): Promise<void> {
  await mkdir(OUT_DIR, { recursive: true });
  console.log(`[probe] 无头=${HEADLESS} 通道=${CHANNEL ?? "chromium(内置)"}`);

  const context = await chromium.launchPersistentContext(`${OUT_DIR}/profile`, {
    headless: HEADLESS,
    channel: CHANNEL,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });

  const rows: ProbeRow[] = [];
  for (const target of TARGETS) {
    const row = await probeOne(context, target);
    rows.push(row);
    const verdict = row.error
      ? `❌ ${row.error}`
      : row.blockHits.length
        ? `⚠️ 疑似拦截：${row.blockHits.join(", ")}`
        : row.status && row.status < 400
          ? "✅ 正常"
          : `⚠️ HTTP ${row.status}`;
    console.log(`[probe] ${row.name.padEnd(14)} ${verdict}  (status=${row.status}, 重定向=${row.redirected})`);
    // 页面间随机停顿，避免规律访问
    await new Promise((r) => setTimeout(r, 3000 + Math.random() * 4000));
  }

  await context.close();
  const reportPath = `${OUT_DIR}/report.json`;
  await writeFile(reportPath, JSON.stringify({ at: new Date().toISOString(), headless: HEADLESS, rows }, null, 2));

  const suspicious = rows.filter((r) => r.error || r.blockHits.length || (r.status ?? 500) >= 400);
  console.log(`\n[probe] 完成。报告：${reportPath}  截图：${OUT_DIR}/*.png`);
  console.log(
    suspicious.length === 0
      ? "[probe] 结论：本机 IP 访问 @cosme 无明显拦截，可考虑 VPS 无头部署。"
      : `[probe] 结论：${suspicious.length} 个页面异常，VPS 部署有风控风险，建议切 Mac mini。详见截图。`,
  );
}

void main();
