/**
 * 奖品数据核查：逐个访问奖品页面，把库里的字段与页面真值逐项比对。
 *
 * 为什么需要它：扫描是从**列表页**解析的，列表页信息不全且各来源版式不同，
 * 容易出现「字段语义放错」（曾把「計5名様現品 · 文案」写进展示为期间的字段）
 * 或「期间根本没抓到」。这个工具以**详情页**为真值来源做一次对账。
 *
 * 用法：
 *   npm run audit                 只核查、只报告（默认，不改库）
 *   npm run audit -- --fix        把页面真值写回数据库
 *   npm run audit -- --limit 5    只查前 5 个（试跑）
 *
 * 全程只读页面，**不点任何投递按钮**。按 PACING 节奏逐个访问。
 */
import { writeFile, mkdir } from "node:fs/promises";
import Database from "better-sqlite3";
import { chromium, type Page } from "playwright";
import { PACING, isPeriodExpired, normalizePeriod, randomDelay, validateImageUrl } from "@cosme/core";

const args = process.argv.slice(2);
const FIX = args.includes("--fix");
const li = args.indexOf("--limit");
const LIMIT = li >= 0 ? Number(args[li + 1]) : Infinity;
const DB_PATH = process.env.AUDIT_DB ?? "../web/data/cosme.db";
const OUT = "../../docs/research";

const pause = () => new Promise<void>((r) => setTimeout(r, randomDelay(PACING.stepDelayMs)));

interface Row {
  id: string;
  source: string;
  link: string;
  name: string;
  brand: string | null;
  image_url: string | null;
  period: string | null;
  quantity: string | null;
  tagline: string | null;
}

/** 从详情页提取真值。三种来源的表述都不同，故各种写法都试一遍。 */
async function truthFromPage(page: Page): Promise<{
  title: string;
  brand: string | null;
  period: string | null;
  quantity: string | null;
  tagline: string | null;
  imageUrl: string | null;
  /** 页面上是否还有可用的应募入口 */
  entryOpen: boolean;
  /** 是否明确写着已结束 */
  ended: boolean;
}> {
  return page.evaluate(() => {
    const text = document.body.innerText.replace(/\s+/g, " ");
    const grab = (re: RegExp): string | null => text.match(re)?.[0]?.trim() ?? null;

    // 期间：只取日期区间部分，别把「応募受付：」这类前缀和后面的杂物带进来
    const rawPeriod =
      grab(/応募(?:受付|期間)\s*[：:]\s*\d{1,2}\s*[\/月]\s*\d{1,2}\s*日?\s*[～~\-]\s*\d{1,2}\s*[\/月]\s*\d{1,2}\s*日?/) ??
      grab(/\d{1,2}月\d{1,2}日\s*[（(][^）)]{0,3}[）)]\s*[～~\-]\s*\d{1,2}月\d{1,2}日/) ??
      grab(/\d{1,2}\/\d{1,2}\s*[～~\-]\s*\d{1,2}\/\d{1,2}/);
    // 只回传原文，归一化在 Node 侧用 normalizePeriod 做（记法有四五种）
    const period = rawPeriod;

    const quantity = grab(/(?:計)?\s*\d+\s*名様?\s*(?:現品|サンプル|モニター)?/)?.replace(/\s+/g, "") ?? null;
    // 一句话文案：列表页的 .psnt-copy 在详情页通常没有，退回取标题里「/」后的商品名做兜底
    const tagline =
      document.querySelector(".psnt-copy")?.textContent?.replace(/\s+/g, " ").trim() ||
      document.title.match(/\/\s*([^｜|]{4,60}?)(?:をプレゼント|｜|$)/)?.[1]?.trim() ||
      null;

    // 商品图：限定在内容区，避开站点头部图标
    const imgs = Array.from(document.querySelectorAll<HTMLImageElement>("img"))
      .map((i) => i.getAttribute("src") ?? "")
      .filter((s) => /\/media\/(monitor|product|sku)/.test(s));

    // ⚠️ 入口文案不止「応募する」：タイアップ页是「今すぐ応募」，
    // 且其入口是外部追踪链 c.w1.to（曾因此把 81 个 tieup 全误报成「无应募入口」）
    const entryOpen =
      !!document.querySelector('[onclick*="isauth/addinfo"]') ||
      !!document.querySelector('a[href*="/present-blog/"]') ||
      !!document.querySelector('a[href*="/confirm/"]') ||
      !!document.querySelector('a[href*="c.w1.to"]') ||
      /応募する|今すぐ応募|エントリー(する)?|応募はこちら/.test(text);
    const ended = /募集(は)?終了|受付(は)?終了|終了しました|受付を終了/.test(text);

    // 品牌名：详情页标题多为「品牌 / 商品名をプレゼント！」
    const brand = document.title.match(/^([^\/｜|]{1,30})\s*\//)?.[1]?.trim() ?? null;

    return { title: document.title.slice(0, 120), brand, period, quantity, tagline, imageUrl: imgs[0] ?? null, entryOpen, ended };
  });
}

interface Issue {
  id: string;
  field: string;
  db: string | null;
  page: string | null;
  note: string;
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });
  const db = new Database(DB_PATH);
  const rows = db.prepare("select * from presents order by source, id").all() as Row[];
  const targets = rows.slice(0, LIMIT === Infinity ? undefined : LIMIT);
  console.log(`[audit] 核查 ${targets.length} / ${rows.length} 个奖品${FIX ? "（--fix：会写回数据库）" : "（只报告，不改库）"}\n`);

  const ctx = await chromium.launchPersistentContext(process.env.RUNNER_PROFILE_DIR ?? "./profile", {
    headless: process.env.RUNNER_HEADLESS !== "false",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();

  const issues: Issue[] = [];
  const report: Record<string, unknown>[] = [];
  let ok = 0;
  let fixed = 0;

  for (const [i, r] of targets.entries()) {
    const head = `[${i + 1}/${targets.length}] ${r.id.padEnd(13)} ${(r.brand ?? "—").slice(0, 14).padEnd(15)}`;
    try {
      // 站点个别品牌页很慢，用 commit 而非 domcontentloaded，失败再宽限重试一次
      let resp = await page.goto(r.link, { waitUntil: "commit", timeout: 25_000 }).catch(() => null);
      if (!resp) {
        await pause();
        resp = await page.goto(r.link, { waitUntil: "commit", timeout: 45_000 }).catch(() => null);
      }
      if (!resp) {
        issues.push({ id: r.id, field: "link", db: r.link, page: null, note: "页面两次都加载超时" });
        console.log(`${head} ⚠️ 加载超时（已重试）`);
        await pause();
        continue;
      }
      await page.waitForLoadState("domcontentloaded", { timeout: 15_000 }).catch(() => undefined);
      const status = resp?.status() ?? 0;
      if (status >= 400) {
        issues.push({ id: r.id, field: "link", db: r.link, page: `HTTP ${status}`, note: "页面不可达" });
        console.log(`${head} ⚠️ HTTP ${status}`);
        await pause();
        continue;
      }
      const t = await truthFromPage(page);
      const problems: string[] = [];

      // 逐项比对
      // 期间比较前先归一化：站点同一期间有 `8/19～9/15` 与 `8月19日（水）～9月15日`
      // 等多种记法，不归一化会把同一期间报成「不一致」（踩过：79 个误报）
      const pageP = normalizePeriod(t.period);
      const dbP = normalizePeriod(r.period);
      if (!dbP && pageP) problems.push("期间缺失");
      else if (dbP && pageP && dbP !== pageP) problems.push("期间不一致");
      if (dbP && isPeriodExpired(dbP)) problems.push("期间已过");
      if (/名様|・/.test(r.period ?? "")) problems.push("期间字段装了非日期内容");
      if (!r.quantity && t.quantity) problems.push("数量缺失");
      if (!r.image_url) problems.push("无图");
      else if (!validateImageUrl(r.image_url)) problems.push("图片地址未通过校验");
      if (t.ended) problems.push("站点已结束募集");
      else if (!t.entryOpen) problems.push("页面无应募入口");

      for (const p of problems) {
        issues.push({
          id: r.id,
          field: p.startsWith("期间") ? "period" : p.includes("数量") ? "quantity" : p.includes("图") ? "imageUrl" : "state",
          db: r.period ?? r.quantity ?? r.image_url ?? null,
          page: t.period ?? t.quantity ?? t.imageUrl ?? null,
          note: p,
        });
      }

      if (FIX) {
        const nextPeriod = pageP ?? dbP;
        // 数量归一：旧数据里混着「数量 · 文案」，拆开；页面值优先（格式更规整）
        let qty = t.quantity ?? r.quantity;
        let tagline = r.tagline ?? t.tagline;
        if (qty?.includes(" · ")) {
          const [q, ...rest] = qty.split(" · ");
          qty = (t.quantity ?? q) ?? null;
          tagline ??= rest.join(" · ") || null;
        }
        db.prepare("update presents set period = ?, quantity = ?, tagline = ?, image_url = ? where id = ?").run(
          nextPeriod,
          qty,
          tagline,
          validateImageUrl(r.image_url) ?? validateImageUrl(t.imageUrl),
          r.id,
        );
        fixed++;
      }

      if (problems.length === 0) ok++;
      console.log(`${head} ${problems.length === 0 ? "✅" : "⚠️ " + problems.join("、")}`);
      report.push({ id: r.id, source: r.source, db: { period: r.period, quantity: r.quantity, image: !!r.image_url }, page: t, problems });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      issues.push({ id: r.id, field: "error", db: null, page: null, note: m.slice(0, 80) });
      console.log(`${head} ❌ ${m.slice(0, 60)}`);
    }
    await pause();
  }

  await writeFile(`${OUT}/audit.json`, JSON.stringify({ auditedAt: new Date().toISOString(), issues, report }, null, 2));
  console.log(`\n[audit] 完成：${ok} 个无问题，${targets.length - ok} 个有问题${FIX ? `，已写回 ${fixed} 条` : ""}`);
  console.log(`[audit] 明细 → ${OUT}/audit.json`);

  // 问题归类汇总
  const byNote = new Map<string, number>();
  for (const it of issues) byNote.set(it.note, (byNote.get(it.note) ?? 0) + 1);
  if (byNote.size) {
    console.log("\n[audit] 问题归类：");
    for (const [note, n] of [...byNote.entries()].sort((a, b) => b[1] - a[1])) console.log(`   ${String(n).padStart(3)}× ${note}`);
  }
  db.close();
  await ctx.close();
}

void main();
