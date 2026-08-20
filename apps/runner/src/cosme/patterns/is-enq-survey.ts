/**
 * 模式：is-enq 问卷（2026-08-19 实测确认，已完整跑通一次真实投递）。
 *
 * 覆盖流程：
 *   /enquete/confirm（会员信息确认）→ POST → is-enq.cosme.net/app/usr/ans/ans_pc.php（问卷）
 *   → 勾选/填写 → input[name=send] 送信 → page=end 完成
 *
 * 已确认的关键事实：
 * - 问卷跑在**独立主机** `is-enq.cosme.net` 的 PHP 引擎上，与 www 站不同
 * - 字段命名有规律：`q<序号>_<问卷ID>_<组号>_<类型后缀>`（`_r`=radio），
 *   个人资料字段统一 `prof_*`（`prof_001_name` 姓名、`prof_010_job1` 职业下拉）
 *   —— 初版 Java 2023 年用的 `select[name=prof_010_job1]` **至今有效**
 * - 职业下拉的选项是「自営業・自由業」（中点），而初版硬编码「自営業/自由業」（斜杠），
 *   故保留斜杠/中点互换的兜底
 * - 全程**无 reCAPTCHA**
 */
import type { Page } from "playwright";
import { matchesAnswerKeyword, needsManualChoice } from "@cosme/core";
import type { PendingChoice } from "@cosme/contract";
import type { FlowPattern, PatternContext, PatternOutcome, Recognition } from "./types.ts";

/** 问卷引擎主机名 */
const ENQ_HOST = "is-enq.cosme.net";
/** 确认页表单 */
const CONFIRM_FORM = 'form[action*="/enquete/confirm"]';
/** brandcollection 详情页上的应募入口（跳转地址藏在 onclick 里） */
const APPLY_ANCHOR = 'a[onclick*="isauth/addinfo"]';

export const isEnqSurveyPattern: FlowPattern = {
  name: "is-enq-survey",
  describes: "标准问卷型：会员信息确认 → is-enq PHP 问卷 → 送信",

  async recognize(page: Page): Promise<Recognition> {
    const url = page.url();
    if (url.includes(ENQ_HOST)) return { matched: true };
    if ((await page.locator(CONFIRM_FORM).count()) > 0) return { matched: true };
    // 还停在 brandcollection 详情页、但页面上有 addinfo 入口，也归本模式
    // （入口跳转由本模式的 execute 负责，编排层不该有模式专属逻辑）
    if ((await page.locator(APPLY_ANCHOR).count()) > 0) return { matched: true };
    return {
      matched: false,
      reason: `URL 不含 ${ENQ_HOST}，且页面无 ${CONFIRM_FORM} 或 ${APPLY_ANCHOR}（当前 ${url}）`,
    };
  },

  async execute(page: Page, ctx: PatternContext): Promise<PatternOutcome> {
    // ── 0. 若还在详情页，先经 onclick 里的 addinfo 地址跳到确认页 ──
    // ⚠️ onclick 里的问卷地址是 URL 编码的（%2Fenquete%2F），所以认未编码的
    // /isauth/addinfo/ 段；写 a[onclick*="/enquete/"] 永远匹配不到（已踩过）。
    if ((await page.locator(APPLY_ANCHOR).count()) > 0 && (await page.locator(CONFIRM_FORM).count()) === 0) {
      const target = await page.evaluate((sel: string) => {
        const a = document.querySelector<HTMLAnchorElement>(sel);
        const m = (a?.getAttribute("onclick") ?? "").match(/location\.href='([^']+)'/);
        return m ? m[1] : null;
      }, APPLY_ANCHOR);
      if (!target) return { status: "unknownPattern" };
      await ctx.log("进入应募流程");
      await ctx.pace();
      await page.goto(target, { waitUntil: "domcontentloaded", timeout: 40_000 });
    }

    // ── 1. 若停在会员信息确认页，先提交它 ──
    if ((await page.locator(CONFIRM_FORM).count()) > 0) {
      await ctx.log("提交会员信息确认页（应募需关注品牌，addbrand 保持勾选）");
      await ctx.pace();
      await Promise.all([
        page.waitForLoadState("domcontentloaded"),
        page.locator(`${CONFIRM_FORM} input[type="submit"]`).first().click(),
      ]);
    }

    // ⚠️ 确认页 POST 后有**客户端跳转**：点击后那一刻 URL 仍是 /enquete/confirm，
    // 之后才跳到 is-enq。必须等 URL 真正落到问卷主机，否则会误判为失败（已踩过）。
    if (!page.url().includes(ENQ_HOST)) {
      await page.waitForURL((u) => u.href.includes(ENQ_HOST), { timeout: 20_000 }).catch(() => undefined);
    }
    if (!page.url().includes(ENQ_HOST)) {
      // 等不到问卷页：可能是这类奖品走了别的版式，交给未知模式流程去收集现场
      return { status: "unknownPattern" };
    }

    // 问卷本体（扫描题目 → 作答 → 送信 → 判定）抽成独立函数，
    // 供 present-blog 模式在「确认后被导到问卷」时复用。
    return fillAndSubmitSurvey(page, ctx);
  },
};

/**
 * 填写并送出 is-enq 问卷。
 *
 * 独立导出的原因：brandFanClub 的 present-blog 流程在提交确认页后
 * **有可能**也被导到同一个问卷引擎，那时应当复用这里的逻辑而不是抄一遍。
 */
export async function fillAndSubmitSurvey(page: Page, ctx: PatternContext): Promise<PatternOutcome> {
  // ── 扫描问卷题目，判断是否有需要人工选择的题 ──
  await ctx.pace();
  const scan = await page.evaluate(() => {
    const groups: Record<string, { type: string; value: string; label: string }[]> = {};
    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=radio],input[type=checkbox]"),
    )) {
      const label = (el.closest("label")?.innerText ?? el.parentElement?.innerText ?? "")
        .trim()
        .replace(/\s+/g, " ");
      (groups[el.name] ||= []).push({ type: el.type, value: el.value, label });
    }
    // 题干文本：取该组第一个 input 所在区块的上方文字
    const prompts: Record<string, string> = {};
    for (const name of Object.keys(groups)) {
      const el = document.querySelector<HTMLInputElement>(`[name="${name}"]`);
      const block = el?.closest("table, div, li, dl");
      prompts[name] = (block?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    }
    return { groups, prompts };
  });

  // ── 3. 需人工选择的题（如「ご希望の…お選びください」）→ 挂起等用户 ──
  const pending: PendingChoice[] = [];
  for (const [name, opts] of Object.entries(scan.groups)) {
    const prompt = scan.prompts[name] ?? "";
    if (needsManualChoice(prompt) && !ctx.resolvedChoices[name]) {
      pending.push({
        questionId: name,
        prompt,
        options: opts.map((o) => ({ id: o.value, text: o.label })),
      });
    }
  }
  if (pending.length > 0) {
    await ctx.log(`有 ${pending.length} 道题需要人工选择，挂起等待`, "warn");
    return { status: "needsChoice", pendingChoices: pending };
  }

  // ── 4. 自动作答 + 填个人资料 ──
  const keywords = await page.evaluate(
    ({ profile, resolved }) => {
      const acted: string[] = [];

      // 4a. 用户已决定的选择优先应用
      for (const [name, value] of Object.entries(resolved)) {
        const el = document.querySelector<HTMLInputElement>(`[name="${name}"][value="${value}"]`);
        if (el) {
          el.click();
          acted.push(`已选:${name}=${value}`);
        }
      }

      // 4b. 「応募する」这类同意项必选（不选就等于不参加）
      for (const el of Array.from(
        document.querySelectorAll<HTMLInputElement>("input[type=radio],input[type=checkbox]"),
      )) {
        const label = (el.closest("label")?.innerText ?? el.parentElement?.innerText ?? "").trim();
        if (label.includes("応募する") && !label.includes("しない")) {
          el.click();
          acted.push("同意项:応募する");
        }
      }

      // 4c. 个人资料字段（prof_* 命名，初版 Java 的发现，2026 仍有效）
      const nameInput = document.querySelector<HTMLInputElement>('input[name="prof_001_name"]');
      if (nameInput && profile.name) {
        nameInput.value = profile.name;
        acted.push("prof_001_name");
      }
      const ageInput = document.querySelector<HTMLInputElement>('input[name*="age"][name^="prof_"]');
      if (ageInput && profile.age) {
        ageInput.value = profile.age;
        acted.push("age");
      }
      // 职业下拉：精确匹配 → 斜杠/中点互换兜底（站点两种写法都出现过）
      const job = document.querySelector<HTMLSelectElement>('select[name="prof_010_job1"]');
      if (job && profile.job) {
        for (const v of [profile.job, profile.job.replace("/", "・"), profile.job.replace("・", "/")]) {
          const opt = Array.from(job.options).find((o) => o.text.trim() === v);
          if (opt) {
            job.value = opt.value;
            acted.push("prof_010_job1");
            break;
          }
        }
      }
      return acted;
    },
    { profile: ctx.profile, resolved: ctx.resolvedChoices },
  );
  await ctx.log(`问卷已填：${keywords.join(", ") || "无可填项"}`);

  // 4d. 其余选项按关键词库勾选（在 Node 侧判断，词库不必进浏览器上下文）
  for (const [name, opts] of Object.entries(scan.groups)) {
    for (const o of opts) {
      if (o.label && matchesAnswerKeyword(o.label)) {
        await page
          .locator(`[name="${name}"][value="${o.value}"]`)
          .first()
          .check({ timeout: 3000 })
          .catch(() => undefined);
      }
    }
  }

  // ── 5. 送信 ──
  await ctx.pace();
  // 送信按钮实测有两种：input[type=submit] 与 input[type=image]（图片按钮），
  // 都带 name="send"，故按 name 定位而非按 type。
  const send = page.locator('[name="send"]');
  if ((await send.count()) === 0) return { status: "unknownPattern" };
  await ctx.log("送信");
  await Promise.all([page.waitForLoadState("domcontentloaded"), send.first().click()]);
  await page.waitForTimeout(2000);

  // ── 6. 判定结果 ──
  // ⚠️ 实测：@COSME **不在任何页面标注「已应募」**（详情页投递后仍显示「応募する」），
  // 所以只能靠「有没有离开问卷表单」判断，去重必须靠我们自己的 DB。
  //
  // ⚠️ 不能用「正文是否含『必須』」判断失败——问卷正文本身就印着
  // 「（ * は必須回答です。）」这句说明，那样会把成功也判成失败（已踩过）。
  const stillOnForm = (await page.locator('[name="send"]').count()) > 0;
  if (stillOnForm) {
    // 仍停在问卷上，说明被退回；此时正文里的错误提示才有意义
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const reason = /エラー|入力してください|選択してください/.exec(body)?.[0] ?? "未知原因";
    await ctx.log(`送信被退回（${reason}）`, "error");
    return { status: "failed" };
  }
  await ctx.log("送信完成");
  return { status: "drawn" };}
