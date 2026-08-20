/**
 * 模式：present-blog（brandFanClub 限定奖品，2026-08-20 实测结构）。
 *
 * 与 is-enq 问卷流程**完全不同**：
 *   /beautist/article/<ID> 上的「応募する」（普通 href，不是 onclick）
 *   → /brands/<品牌ID>/present-blog/<PB码>/confirm/  「登録情報確認」
 *   → POST（表单只有 token + act=submit）
 *   → 完成
 *
 * 已确认：
 * - **无 isauth/addinfo、无 enquete、无 reCAPTCHA**
 * - **没有 addbrand 复选框**——这些奖品本就限定粉丝俱乐部成员，无需再关注品牌
 * - 确认页会显示账号已登记的姓名/住址/电话（同 is-enq 流程）
 *
 * POST 之后是**自家的问卷页** `/present-blog/<PB码>/survey/`（2026-08-20 实测，
 * 不是 is-enq 引擎）。字段命名 `id[13116]` / `id[13117][]`，没有 `prof_*`
 * 个人资料字段（确认页已核对过登记信息），提交按钮是「アンケートに回答して応募する」。
 * 选项文案与 is-enq 问卷同源，**关键词库可直接复用**。
 */
import type { Page } from "playwright";
import { matchesAnswerKeyword, needsManualChoice, selectors } from "@cosme/core";
import type { PendingChoice } from "@cosme/contract";
import type { FlowPattern, PatternContext, PatternOutcome, Recognition } from "./types.ts";
import { fillAndSubmitSurvey } from "./is-enq-survey.ts";

const { PRESENT_BLOG } = selectors;
/** 问卷引擎主机名——POST 后有可能被导到那边 */
const ENQ_HOST = "is-enq.cosme.net";

export const presentBlogPattern: FlowPattern = {
  name: "present-blog",
  describes: "品牌粉丝俱乐部限定：article → present-blog 确认页 → POST 完成",

  async recognize(page: Page): Promise<Recognition> {
    const url = page.url();
    if (PRESENT_BLOG.confirmPattern.test(url)) return { matched: true };
    if ((await page.locator(PRESENT_BLOG.confirmForm).count()) > 0) return { matched: true };
    // 还停在 article 页但页面上有 present-blog 入口，也归本模式
    if ((await page.locator(PRESENT_BLOG.applyAnchor).count()) > 0) return { matched: true };
    return {
      matched: false,
      reason: `URL 不匹配 /brands/<id>/present-blog/<code>/confirm/，且页面无 ${PRESENT_BLOG.applyAnchor}（当前 ${url}）`,
    };
  },

  async execute(page: Page, ctx: PatternContext): Promise<PatternOutcome> {
    // ── 1. 若还在 article 页，先走到确认页 ──
    if (!PRESENT_BLOG.confirmPattern.test(page.url())) {
      const apply = page.locator(PRESENT_BLOG.applyAnchor).first();
      if ((await apply.count()) === 0) return { status: "unknownPattern" };
      const href = await apply.getAttribute("href");
      if (!href) return { status: "unknownPattern" };
      await ctx.log(`进入确认页 ${href}`);
      await ctx.pace();
      await page.goto(new URL(href, page.url()).href, { waitUntil: "domcontentloaded", timeout: 40_000 });
    }

    // ── 2. 提交确认页 ──
    const form = page.locator(PRESENT_BLOG.confirmForm);
    if ((await form.count()) === 0) {
      // 到不了确认表单：可能已结束或已应募，交给上层收现场判断
      return { status: "unknownPattern" };
    }
    await ctx.log("提交登録情報確認（本流程无需勾选关注，已是粉丝俱乐部成员）");
    await ctx.pace();
    await Promise.all([
      page.waitForLoadState("domcontentloaded"),
      form.locator(PRESENT_BLOG.submitButton).first().click(),
    ]);
    // 与 is-enq 流程一样，POST 后可能有客户端跳转，给它一点时间落定
    await page.waitForTimeout(2500);

    // ── 3. 判定 POST 之后到了哪 ──
    // 3a. 落到自家问卷页 → 作答并提交
    if (page.url().includes(PRESENT_BLOG.surveyPathMarker)) {
      return answerBlogSurvey(page, ctx);
    }

    // 3b. 少数情况可能被导到 is-enq 引擎 → 复用那边的问卷逻辑
    if (page.url().includes(ENQ_HOST)) {
      await ctx.log("确认后进入 is-enq 问卷，交给问卷流程处理");
      return fillAndSubmitSurvey(page, ctx);
    }

    // 3c. 出现完成特征 → 成功
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (/応募(が)?完了|受付(が)?完了|ありがとうございました|応募ありがとう/.test(body)) {
      await ctx.log("投递完成");
      return { status: "drawn" };
    }

    // 3d. 明确的失败/已结束
    if (/募集(は)?終了|受付(は)?終了|終了しました/.test(body)) {
      await ctx.log("该奖品已结束募集", "warn");
      return { status: "skipped" };
    }
    if (/エラー|error/i.test(body)) {
      await ctx.log("确认页提交被拒", "error");
      return { status: "failed" };
    }

    // 3e. 没见过的落点 → 不猜，回传现场
    await ctx.log(`确认后落到未知页面（${page.url()}），已安全中止`, "warn");
    return { status: "unknownPattern" };
  },
};

/**
 * 作答并提交 present-blog 自家的问卷页。
 *
 * 与 is-enq 问卷的处理方式一致（关键词库命中即选、需人工决定的题挂起），
 * 但字段命名不同（`id[<数字>]` / `id[<数字>][]`），且没有 prof_* 个人资料字段。
 */
async function answerBlogSurvey(page: Page, ctx: PatternContext): Promise<PatternOutcome> {
  await ctx.pace();

  // ── 扫描题目 ──
  const scan = await page.evaluate(() => {
    const groups: Record<string, { type: string; value: string; label: string }[]> = {};
    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement>("input[type=radio],input[type=checkbox]"),
    )) {
      if (!/^id\[\d+\]/.test(el.name)) continue; // 只认问卷题目，跳过站内搜索等杂项
      const label = (el.closest("label")?.innerText ?? el.parentElement?.innerText ?? "")
        .trim()
        .replace(/\s+/g, " ");
      (groups[el.name] ||= []).push({ type: el.type, value: el.value, label });
    }
    const prompts: Record<string, string> = {};
    for (const name of Object.keys(groups)) {
      const el = document.querySelector<HTMLInputElement>(`[name="${CSS.escape(name)}"]`);
      const block = el?.closest("table, div, li, dl, fieldset");
      prompts[name] = (block?.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 200);
    }
    return { groups, prompts };
  });

  const questionCount = Object.keys(scan.groups).length;
  if (questionCount === 0) {
    await ctx.log("问卷页未解析到任何题目", "warn");
    return { status: "unknownPattern" };
  }

  // ── 需人工选择的题 → 挂起 ──
  const pending: PendingChoice[] = [];
  for (const [name, opts] of Object.entries(scan.groups)) {
    const prompt = scan.prompts[name] ?? "";
    if (needsManualChoice(prompt) && !ctx.resolvedChoices[name]) {
      pending.push({ questionId: name, prompt, options: opts.map((o) => ({ id: o.value, text: o.label })) });
    }
  }
  if (pending.length > 0) {
    await ctx.log(`有 ${pending.length} 道题需要人工选择，挂起等待`, "warn");
    return { status: "needsChoice", pendingChoices: pending };
  }

  // ── 作答：用户已决定的优先，其余按关键词库 ──
  let answered = 0;
  for (const [name, value] of Object.entries(ctx.resolvedChoices)) {
    const el = page.locator(`[name="${name}"][value="${value}"]`).first();
    if ((await el.count()) > 0) {
      await el.check({ timeout: 3000 }).catch(() => undefined);
      answered++;
    }
  }
  for (const [name, opts] of Object.entries(scan.groups)) {
    for (const o of opts) {
      if (o.label && matchesAnswerKeyword(o.label)) {
        const el = page.locator(`[name="${name}"][value="${o.value}"]`).first();
        await el.check({ timeout: 3000 }).catch(() => undefined);
        answered++;
        // radio 组选中一个就够，避免后面的选项把前面的顶掉
        if (opts[0]?.type === "radio") break;
      }
    }
  }
  await ctx.log(`问卷 ${questionCount} 题，已作答 ${answered} 项`);

  // ── 提交 ──
  await ctx.pace();
  const submit = page.locator(`${PRESENT_BLOG.surveyForm} ${PRESENT_BLOG.surveySubmit}`).last();
  if ((await submit.count()) === 0) {
    await ctx.log("未找到问卷提交按钮", "warn");
    return { status: "unknownPattern" };
  }
  await ctx.log("提交问卷并应募");
  await Promise.all([page.waitForLoadState("domcontentloaded"), submit.click()]);
  await page.waitForTimeout(2500);

  // ── 判定 ──
  // 仍停在问卷表单上说明被退回（多为必填项没答）
  if ((await page.locator(PRESENT_BLOG.surveyForm).count()) > 0) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const reason = /エラー|入力してください|選択してください|必須項目/.exec(body)?.[0] ?? "未知原因";
    await ctx.log(`问卷被退回（${reason}）`, "error");
    return { status: "failed" };
  }
  await ctx.log("投递完成");
  return { status: "drawn" };
}
