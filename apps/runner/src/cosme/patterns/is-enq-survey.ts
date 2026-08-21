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
import { scanQuestions, applyDecisions } from "./survey-common.ts";
import { clickAndSettle } from "../click.ts";
import type { FlowPattern, PatternContext, PatternOutcome, Recognition } from "./types.ts";

/** 问卷引擎主机名 */
const ENQ_HOST = "is-enq.cosme.net";
/** 确认页表单 */
const CONFIRM_FORM = 'form[action*="/enquete/confirm"]';
/**
 * 详情页上的应募入口（跳转地址藏在 onclick 里）。
 * ⚠️ 两种标签都出现过：brandcollection 是 `a[onclick]`，
 * 手机版全量列表里的 `/brands/<id>/present/<id>/` 页是 **`input[onclick]`**（实测）。
 */
const APPLY_ANCHOR = '[onclick*="isauth/addinfo"]';

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
  await ctx.pace();

  const questions = await scanQuestions(page);

  // ⚠️ **已应募的判定放在最前面**，而且是结构性的、不看文案。
  //
  // 实测（12057：08-19 投递成功，08-21 重走同一条流程）：入口与确认页**完全看不出**
  // 已经应募过，照样能走到 `is-enq.cosme.net/.../ans_pc.php`——但那一页**题数 0、
  // 没有 `[name=send]`**，站点在这里才把「已抽选」摊出来。
  //
  // 这一段原先没有，于是走到最后 `send.count() === 0` 时被当成 `unknownPattern`
  // 报成「没见过的版式」（诊断页上还会催人去补 pattern）。证据其实早就躺在
  // `docs/research/surveys.json` 里，我自己的日志也打过「未取到题目（可能已应募）」，
  // 只是当时把它读成了采集失败。
  if (questions.length === 0 && (await page.locator('[name="send"]').count()) === 0) {
    await ctx.log("问卷页没有任何题目与送信控件——站点表明已应募过，本次不提交任何内容", "warn");
    return { status: "alreadyEntered" };
  }

  const { pending, applied } = await applyDecisions(page, questions, ctx);
  if (pending.length > 0) {
    await ctx.log(`${questions.length} 题中有 ${pending.length} 题需要人工决定，挂起等待`, "warn");
    return { status: "needsChoice", pendingChoices: pending };
  }

  // 个人资料字段（prof_*）—— 只有 is-enq 问卷有，present-blog 的确认页已核对过
  const profileFilled = await page.evaluate(
    (profile: { name: string; age: string; job: string }) => {
      const done: string[] = [];
      const nameInput = document.querySelector<HTMLInputElement>('input[name="prof_001_name"]');
      if (nameInput && profile.name) {
        nameInput.value = profile.name;
        done.push("prof_001_name");
      }
      const ageInput = document.querySelector<HTMLInputElement>('input[name^="prof_"][name*="age"]');
      if (ageInput && profile.age) {
        ageInput.value = profile.age;
        done.push("age");
      }
      // 职业下拉：精确匹配 → 斜杠/中点互换兜底（站点两种写法都出现过）
      const job = document.querySelector<HTMLSelectElement>('select[name="prof_010_job1"]');
      if (job && profile.job) {
        for (const v of [profile.job, profile.job.replace("/", "・"), profile.job.replace("・", "/")]) {
          const opt = Array.from(job.options).find((o) => o.text.trim() === v);
          if (opt) {
            job.value = opt.value;
            done.push("prof_010_job1");
            break;
          }
        }
      }
      return done;
    },
    ctx.profile,
  );
  await ctx.log(`问卷 ${questions.length} 题，已作答 ${applied} 项${profileFilled.length ? `，个人资料 ${profileFilled.join("/")}` : ""}`);

  // ── 送信 ──
  await ctx.pace();
  // 送信按钮实测有两种：input[type=submit] 与 input[type=image]（图片按钮），都带 name="send"
  const send = page.locator('[name="send"]');
  // 走到这里说明**有题目却没有送信控件**——那才是真的版式不认识（已应募的情况
  // 在函数开头就返回 alreadyEntered 了）
  if ((await send.count()) === 0) return { status: "unknownPattern" };
  await ctx.log("送信");
  // 与 present-blog 同一个坑：click() 自带的导航等待会在站点慢跳转时抛超时，
  // 把已经提交成功的投递记成失败。见 cosme/click.ts。
  await clickAndSettle(page, send.first());
  await page.waitForTimeout(2000);

  // ⚠️ 不能用「正文含『必須』」判断失败——问卷正文本身就印着
  // 「（ * は必須回答です。）」这句说明，那样会把成功也判成失败（已踩过）。
  // 判据是「有没有离开问卷表单」。
  let stillOnForm = (await page.locator('[name="send"]').count()) > 0;
  if (stillOnForm) {
    // 慢跳转再宽限一轮，别把「还在跳」当成「被退回」
    await page.waitForTimeout(4000);
    stillOnForm = (await page.locator('[name="send"]').count()) > 0;
  }
  if (stillOnForm) {
    const body = await page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));
    const reason = /エラー|入力してください|選択してください/.exec(body)?.[0] ?? "未知原因";
    await ctx.log(`送信被退回（${reason}）`, "error");
    return { status: "failed" };
  }
  await ctx.log("送信完成");
  return { status: "drawn" };
}
