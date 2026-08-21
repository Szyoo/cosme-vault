/**
 * 问卷采集器（研究用）：把站上现有奖品的问卷结构全部抓下来，**只进到问卷页、不提交**。
 *
 * 目的是给「自动作答」攒一份真实数据集，用来评估关键词库的覆盖率与误命中，
 * 而不是靠猜。产物是 `docs/research/surveys.json`。
 *
 * 用法：npm run harvest                  采集所有奖品
 *      npm run harvest -- --limit 3      只采前 3 个（试跑）
 *      npm run harvest -- --id <奖品ID>   只走某一个奖品
 *      npm run harvest -- --drawn        只走**已投递过**的奖品
 *                                        → 重复应募检测实验，见 ONLY_DRAWN 的注释
 *
 * ⚠️ 会产生的副作用（**不包含投递**）：
 * - 要到达问卷页必须 POST 一次确认页。实测确认过：POST 确认页**不等于投递**，
 *   真正的投递是问卷页上的送信/应募按钮，本脚本绝不点它。
 * - brandcollection 流程的确认页带 `addbrand`（默认勾选且为投递必需），
 *   所以那条路会**关注对应品牌**；brandFanClub 流程没有这个复选框，无此副作用。
 * - 全程按 `PACING` 的人类速度节奏，奖品之间随机停顿。
 *
 * 采集后奖品仍处于「未投递」状态，之后正常跑批次即可完成投递。
 */
import { mkdir, writeFile } from "node:fs/promises";
import Database from "better-sqlite3";
import { chromium, type Page } from "playwright";
import { PACING, randomDelay, selectors } from "@cosme/core";

const args = process.argv.slice(2);
const limitArg = args.indexOf("--limit");
const LIMIT = limitArg >= 0 ? Number(args[limitArg + 1]) : Infinity;
const idArg = args.indexOf("--id");
/** 只走指定奖品（做单点实验用） */
const ONLY_ID = idArg >= 0 ? args[idArg + 1] : null;
/**
 * 只走**已投递过**的奖品。
 *
 * 用途是回答一个悬而未决的问题：**已经应募过的奖品，再走一遍流程会不会被站点拦住？**
 * 已实测确认的是「详情页照样显示応募する、重走入口照样进确认页」——也就是**入口层面
 * 完全看不出来**。但更靠里的问卷页会不会出现「既に応募済み」之类的提示，从来没验过
 * （送信是不可逆动作，不能拿来做实验）。
 *
 * 本脚本只进到问卷页、绝不点送信，所以拿已投递的奖品来跑是安全的：
 * 如果问卷页上真有「已应募」的痕迹，就能据此做自动去重，人工确认那一步就可以取消。
 */
const ONLY_DRAWN = args.includes("--drawn");
const OUT = "../../docs/research";

/** 可能表示「已经应募过」的字样。命中不代表就是——只用来把证据挑出来给人看。 */
const DUPLICATE_HINTS = [
  "既に応募",
  "すでに応募",
  "応募済み",
  "重複",
  "お一人様1回",
  "1回限り",
  "受付できません",
  // ⚠️ 下面这批是补的：已应募时站点跳到的其实是**抽選相关**的页面，
  // 原来那半张单子里一个「抽選」都没有，就算跑了也可能对不上（用户实际看到的是
  // 「已抽选」的界面）。文案匹配只作旁证——**主判据是结构性的**：
  // 问卷页既无题目也无送信控件（见 patterns/is-enq-survey.ts）。
  "抽選",
  "当選",
  "発表",
  "締め切",
  "終了しました",
];

const pause = () => new Promise<void>((r) => setTimeout(r, randomDelay(PACING.betweenPresentsMs)));
const step = () => new Promise<void>((r) => setTimeout(r, randomDelay(PACING.stepDelayMs)));

/** 一道题 */
interface Question {
  /** 表单字段名（is-enq 是 q001_…_r，present-blog 是 id[13116]） */
  field: string;
  type: string;
  /** 题干（取自最近的区块文本） */
  prompt: string;
  required: boolean;
  options: { value: string; label: string }[];
}

interface SurveyRecord {
  presentId: string;
  source: string;
  brand: string | null;
  name: string;
  /** 走的是哪套流程 */
  flow: "is-enq" | "present-blog" | "unknown";
  surveyUrl: string;
  /** 题目 */
  questions: Question[];
  /** 文本输入与下拉（个人资料类字段） */
  textInputs: { name: string; required: boolean }[];
  selects: { name: string; options: string[] }[];
  submitLabel: string | null;
  /**
   * 页面正文里命中的「可能已应募」字样（`DUPLICATE_HINTS`）。
   * 拿已投递的奖品跑 `--drawn` 时看这一项：**非空就说明站点其实是有痕迹的**，
   * 那么自动去重可行，人工确认那一步就能取消。
   */
  duplicateHints: string[];
  /** 命中时前后的正文片段，供人工判断那句话到底在说什么 */
  duplicateContext: string[];
  error?: string;
}

/**
 * 抓「可能已应募」的字样。⚠️ 纯只读的正文匹配，不做任何判定——
 * 命中只是把证据挑出来给人看，绝不据此自动跳过（选择器/文案没实测过就不能当依据）。
 */
async function findDuplicateHints(page: Page, hints: string[]): Promise<{ hits: string[]; context: string[] }> {
  return page.evaluate((hs: string[]) => {
    const text = (document.body?.innerText ?? "").replace(/\s+/g, " ");
    const hits: string[] = [];
    const context: string[] = [];
    for (const h of hs) {
      const at = text.indexOf(h);
      if (at < 0) continue;
      hits.push(h);
      context.push(text.slice(Math.max(0, at - 60), at + 90));
    }
    return { hits, context };
  }, hints);
}

/** 从当前页面提取问卷结构。⚠️ 只读，不填不点。 */
async function extractSurvey(
  page: Page,
): Promise<
  Omit<
    SurveyRecord,
    "presentId" | "source" | "brand" | "name" | "flow" | "duplicateHints" | "duplicateContext"
  >
> {
  return page.evaluate(() => {
    const groups: Record<string, { type: string; value: string; label: string; required: boolean }[]> = {};
    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=radio],input[type=checkbox]"),
    )) {
      // 只认问卷题目字段，跳过站内搜索、页头等杂项
      const isSurveyField = /^q\d+_/.test(el.name) || /^id\[\d+\]/.test(el.name);
      if (!isSurveyField) continue;
      const label = (el.closest("label")?.innerText ?? el.parentElement?.innerText ?? "")
        .trim()
        .replace(/\s+/g, " ");
      (groups[el.name] ||= []).push({ type: el.type, value: el.value, label, required: el.required });
    }

    const questions = Object.entries(groups).map(([field, opts]) => {
      const el = document.querySelector<HTMLInputElement>(`[name="${CSS.escape(field)}"]`);
      const block = el?.closest("table, fieldset, dl, li, div");
      // 题干里会混进选项文本，去掉选项部分只留前缀
      let prompt = (block?.textContent ?? "").trim().replace(/\s+/g, " ");
      for (const o of opts) if (o.label) prompt = prompt.replace(o.label, "");
      return {
        field,
        type: opts[0]?.type ?? "radio",
        prompt: prompt.replace(/\s+/g, " ").trim().slice(0, 220),
        // 站点多用「＊」标必填而非 HTML required
        required: opts.some((o) => o.required) || /[＊*]/.test(prompt),
        options: opts.map((o) => ({ value: o.value, label: o.label })),
      };
    });

    return {
      surveyUrl: location.href,
      questions,
      // ⚠️ 只记字段名与是否必填，**不记录任何已填的值**（个人信息不入数据集）
      textInputs: Array.from(document.querySelectorAll<HTMLInputElement>("input[type=text]"))
        .filter((i) => /^prof_|^q\d+_|^id\[/.test(i.name))
        .map((i) => ({ name: i.name, required: i.required })),
      selects: Array.from(document.querySelectorAll<HTMLSelectElement>("select"))
        .filter((s) => s.name)
        .map((s) => ({ name: s.name, options: Array.from(s.options).map((o) => o.text.trim()) })),
      submitLabel:
        document.querySelector<HTMLInputElement>('input[name="send"]')?.value ??
        Array.from(document.querySelectorAll<HTMLInputElement>('input[type="submit"]'))
          .map((b) => b.value)
          .filter((v) => v && !/検索/.test(v))
          .pop() ??
        null,
    };
  });
}

async function main(): Promise<void> {
  await mkdir(OUT, { recursive: true });

  const db = new Database("../web/data/cosme.db", { readonly: true });
  const where = ONLY_ID
    ? "where p.id = ?"
    : ONLY_DRAWN
      ? "where exists (select 1 from account_presents ap where ap.present_id = p.id and ap.status = 'drawn')"
      : "";
  const presents = db
    .prepare(`select p.id, p.source, p.brand, p.name, p.link from presents p ${where} order by p.source, p.id`)
    .all(...(ONLY_ID ? [ONLY_ID] : [])) as {
    id: string;
    source: string;
    brand: string | null;
    name: string;
    link: string;
  }[];
  db.close();

  const targets = presents.slice(0, LIMIT === Infinity ? undefined : LIMIT);
  const scope = ONLY_ID ? `奖品 ${ONLY_ID}` : ONLY_DRAWN ? "**已投递**的奖品（重复应募检测实验）" : "全部奖品";
  console.log(`[harvest] 准备采集 ${targets.length} 个（${scope}）的问卷（只进页面，绝不提交）\n`);
  if (targets.length === 0) {
    console.log("[harvest] 没有符合条件的奖品，退出。");
    return;
  }

  const ctx = await chromium.launchPersistentContext(process.env.RUNNER_PROFILE_DIR ?? "./profile", {
    headless: process.env.RUNNER_HEADLESS !== "false",
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
    viewport: { width: 1280, height: 900 },
  });
  const page = await ctx.newPage();
  const records: SurveyRecord[] = [];

  for (const [i, p] of targets.entries()) {
    const head = `[${i + 1}/${targets.length}] ${p.brand ?? "—"} · ${p.name.slice(0, 26)}`;
    try {
      await page.goto(p.link, { waitUntil: "domcontentloaded", timeout: 40_000 });
      await step();

      let flow: SurveyRecord["flow"] = "unknown";

      // ── brandcollection：onclick 里藏 addinfo 地址 → /enquete/confirm ──
      const addinfo = await page.evaluate(() => {
        const a = document.querySelector<HTMLAnchorElement>('a[onclick*="isauth/addinfo"]');
        const m = (a?.getAttribute("onclick") ?? "").match(/location\.href='([^']+)'/);
        return m ? m[1] : null;
      });
      if (addinfo) {
        flow = "is-enq";
        await page.goto(addinfo, { waitUntil: "domcontentloaded", timeout: 40_000 });
        await step();
        const cf = page.locator('form[action*="/enquete/confirm"]');
        if ((await cf.count()) > 0) {
          await Promise.all([
            page.waitForLoadState("domcontentloaded"),
            cf.locator('input[type="submit"]').first().click(),
          ]);
          await page.waitForURL((u) => u.href.includes("is-enq.cosme.net"), { timeout: 20_000 }).catch(() => undefined);
        }
      } else {
        // ── brandFanClub：普通 href → /present-blog/<code>/confirm/ ──
        const href = await page
          .locator(selectors.PRESENT_BLOG.applyAnchor)
          .first()
          .getAttribute("href")
          .catch(() => null);
        if (href) {
          flow = "present-blog";
          await page.goto(new URL(href, page.url()).href, { waitUntil: "domcontentloaded", timeout: 40_000 });
          await step();
          const cf = page.locator(selectors.PRESENT_BLOG.confirmForm);
          if ((await cf.count()) > 0) {
            await Promise.all([
              page.waitForLoadState("domcontentloaded"),
              cf.locator('input[type="submit"]').first().click(),
            ]);
            await page.waitForTimeout(2500);
          }
        }
      }

      const survey = await extractSurvey(page);
      const dup = await findDuplicateHints(page, DUPLICATE_HINTS);
      records.push({
        presentId: p.id,
        source: p.source,
        brand: p.brand,
        name: p.name,
        flow,
        ...survey,
        duplicateHints: dup.hits,
        duplicateContext: dup.context,
      });
      console.log(
        `${head}\n    流程=${flow}  题数=${survey.questions.length}  下拉=${survey.selects.length}  提交按钮=${survey.submitLabel ?? "—"}`,
      );
      if (dup.hits.length > 0) {
        console.log(`    🔎 命中「已应募」候选字样：${dup.hits.join("、")}`);
        for (const c of dup.context) console.log(`       …${c}…`);
      }
      if (survey.questions.length === 0) console.log(`    ⚠️ 未取到题目（可能已应募或已结束）URL=${survey.surveyUrl}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(`${head}\n    ❌ ${message.slice(0, 90)}`);
      records.push({
        presentId: p.id,
        source: p.source,
        brand: p.brand,
        name: p.name,
        flow: "unknown",
        surveyUrl: page.url(),
        questions: [],
        textInputs: [],
        selects: [],
        submitLabel: null,
        duplicateHints: [],
        duplicateContext: [],
        error: message.slice(0, 200),
      });
    }
    await pause(); // 合规：奖品之间人类速度
  }

  // ⚠️ 窄范围运行（--id / --drawn / --limit）**不许写主数据集**：
  // 实测踩过——会话失效时一次 --drawn 只走通 1 条，把 138 个奖品的完整
  // surveys.json 覆盖成了 953 字节。范围不全就换文件名。
  const scoped = ONLY_ID ? `surveys-${ONLY_ID}` : ONLY_DRAWN ? "surveys-drawn" : LIMIT !== Infinity ? "surveys-partial" : "surveys";
  const file = `${OUT}/${scoped}.json`;
  await writeFile(file, JSON.stringify({ harvestedAt: new Date().toISOString(), records }, null, 2));
  const totalQ = records.reduce((n, r) => n + r.questions.length, 0);
  console.log(`\n[harvest] 完成：${records.length} 个奖品，共 ${totalQ} 道题 → ${file}`);
  console.log("[harvest] 全程未提交任何问卷，奖品仍处未投递状态。");
  await ctx.close();
}

void main();
