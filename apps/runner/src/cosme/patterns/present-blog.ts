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
 * ⚠️ 尚未实测的部分：POST 之后的页面。因为那一步是真实投递，
 * 需用户明确同意才能跑。故此处**不猜**：POST 后若落到 is-enq 问卷就交给
 * 问卷模式的填写逻辑，若出现完成特征就算成功，否则回传 unknownPattern 现场。
 */
import type { Page } from "playwright";
import { selectors } from "@cosme/core";
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
    // 3a. 被导到问卷引擎 → 复用问卷模式的填写与送信逻辑
    if (page.url().includes(ENQ_HOST)) {
      await ctx.log("确认后进入问卷，交给问卷流程处理");
      return fillAndSubmitSurvey(page, ctx);
    }

    // 3b. 出现完成特征 → 成功
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    if (/応募(が)?完了|受付(が)?完了|ありがとうございました|応募ありがとう/.test(body)) {
      await ctx.log("投递完成");
      return { status: "drawn" };
    }

    // 3c. 明确的失败/已结束
    if (/募集(は)?終了|受付(は)?終了|終了しました/.test(body)) {
      await ctx.log("该奖品已结束募集", "warn");
      return { status: "skipped" };
    }
    if (/エラー|error/i.test(body)) {
      await ctx.log("确认页提交被拒", "error");
      return { status: "failed" };
    }

    // 3d. 没见过的落点 → 不猜，回传现场
    await ctx.log(`确认后落到未知页面（${page.url()}），已安全中止`, "warn");
    return { status: "unknownPattern" };
  },
};
