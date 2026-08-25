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
import type { PendingChoice } from "@cosme/contract";
import type { FlowPattern, PatternContext, PatternOutcome, Recognition } from "./types.ts";

/** 问卷引擎主机名 */
const ENQ_HOST = "is-enq.cosme.net";
/** 确认页表单 */
const CONFIRM_FORM = 'form[action*="/enquete/confirm"]';
/**
 * 确认页的第三种版式（2026-08-23 依据 produceMember 的诊断包补）：
 * `/present/confirm/<ID>`——addinfo 之后不去 /enquete/confirm，而是落在这里。
 * 表单结构与 present-blog 的确认页同款：hidden act=submit + 「応募する」提交钮，
 * 页面显示登记住址。点「応募する」即完成应募（后面没有问卷）。
 */
const PRESENT_CONFIRM_URL = /\/present\/confirm\/\d+/;
const PRESENT_CONFIRM_SUBMIT = 'input[type="submit"][value*="応募"]';
/**
 * 详情页上的应募入口（跳转地址藏在 onclick 里）。
 * ⚠️ 两种标签都出现过：brandcollection 是 `a[onclick]`，
 * 手机版全量列表里的 `/brands/<id>/present/<id>/` 页是 **`input[onclick]`**（实测）。
 */
const APPLY_ANCHOR = '[onclick*="isauth/addinfo"]';

/**
 * 从（被退回的）问卷表单上摘出真正卡住送信的题，转成 PendingChoice。
 *
 * ⚠️ 第一版按 name 分组把页面所有未勾选控件都算成「题」，结果 27 个未勾的
 * checkbox **选项**被当成 27 道单选项题（is-enq 的 checkbox 是**每个选项一个
 * 独立 name**：`q001_185985_002_c` = 第 1 题第 2 个选项），选择页还会逼用户
 * 全部作答——等于强迫乱勾（2026-08-23 实测，tu-10695）。
 *
 * 修正后的规则：
 * - **radio**（共享 name 的正规组）整组未选 → 这才是「選択してください」的元凶
 *   （实测案例即 Q6「ご希望のセットを1つお選びください」）。
 * - checkbox 家族（`q<题号>_<问卷ID>_<选项号>_c`）整族未勾的**只在没有任何
 *   未选 radio 时**才作为兜底纳入（多数是可选题，纳入只会逼用户乱勾）。
 * - 题干沿 DOM 往前找带「ください / 希望 / 選び / 必須 / *」的说明行，
 *   找不到就用选项文本自明（Q6 的两个套装描述本身就说明了在选什么）。
 */
async function collectUnanswered(page: Page): Promise<PendingChoice[]> {
  return page.evaluate(() => {
    type Opt = { label: string; value: string; checked: boolean; name: string };
    const radios = new Map<string, Opt[]>();
    const checkFamilies = new Map<string, Opt[]>();

    for (const el of Array.from(
      document.querySelectorAll<HTMLInputElement>('input[type="radio"], input[type="checkbox"]'),
    )) {
      if (!/^q\d+_/.test(el.name) && !/^id\[\d+\]/.test(el.name)) continue;
      const label =
        (el.closest("label")?.textContent ?? el.parentElement?.textContent ?? "").replace(/\s+/g, " ").trim();
      const opt: Opt = { label, value: el.value, checked: el.checked, name: el.name };
      if (el.type === "radio") {
        const list = radios.get(el.name) ?? [];
        list.push(opt);
        radios.set(el.name, list);
      } else {
        // checkbox 家族键：去掉末段选项号（q001_185985_002_c → q001_185985）
        const fam = el.name.replace(/_\d+_c$/, "");
        const list = checkFamilies.get(fam) ?? [];
        list.push(opt);
        checkFamilies.set(fam, list);
      }
    }

    /** 沿祖先链往前找题干说明行 */
    const findPrompt = (name: string): string => {
      const first = document.querySelector<HTMLInputElement>(`input[name="${CSS.escape(name)}"]`);
      let node: Element | null = first?.parentElement ?? null;
      for (let depth = 0; node && depth < 6; depth++) {
        let sib: Element | null = node.previousElementSibling;
        for (let hops = 0; sib && hops < 8; hops++) {
          const t = (sib.textContent ?? "").replace(/\s+/g, " ").trim();
          if (t && t.length < 300 && /ください|希望|選び|必須|＊|\*/.test(t) && !sib.querySelector("input")) {
            return t;
          }
          sib = sib.previousElementSibling;
        }
        node = node.parentElement;
      }
      return "";
    };

    const toChoice = (name: string, opts: Opt[]) => ({
      questionId: name,
      prompt: findPrompt(opts[0]!.name) || "以下の選択肢から選んでください",
      options: opts.map((o) => ({ id: o.value, text: o.label || o.value, imageUrl: null as string | null })),
      referenceImages: [] as string[],
      candidateImages: [] as string[],
    });

    // 1. 整组未选的 radio —— 真正会卡「選択してください」的
    const out: { questionId: string; prompt: string; options: { id: string; text: string; imageUrl: string | null }[]; referenceImages: string[]; candidateImages: string[] }[] = [];
    for (const [name, opts] of radios) {
      if (!opts.some((o) => o.checked)) out.push(toChoice(name, opts));
    }

    // 1b. **未选中的下拉**同样会卡送信（实测：设置页的职业值与站点选项对不上时，
    // prof_010_job1 留空 → 必填 → 弹回）。此前只看 radio/checkbox，
    // 于是「送信被退回，且找不到未作答的题」，用户连补救入口都没有。
    for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
      if (!sel.name) continue;
      const chosen = sel.selectedOptions[0];
      if (chosen && chosen.value) continue; // 已选
      const opts = Array.from(sel.options)
        .filter((o) => o.value && o.text.trim())
        .map((o) => ({ id: o.value, text: o.text.trim(), imageUrl: null as string | null }));
      if (opts.length === 0) continue;
      out.push({
        questionId: sel.name,
        prompt: findPrompt(sel.name) || sel.name,
        options: opts,
        referenceImages: [] as string[],
        candidateImages: [] as string[],
      });
    }

    if (out.length > 0) return out;

    // 2. 兜底：整族未勾的 checkbox 家族（把一族合并成一道多选题）。
    // ⚠️ 选项 id 用**各自的完整 name**（is-enq 的 checkbox 每个选项独立 name），
    // 回填时 answering.ts 按「resolvedChoices 的 value 命中我的 field」反查勾选。
    for (const opts of checkFamilies.values()) {
      if (!opts.some((o) => o.checked)) {
        out.push({
          questionId: `family:${opts[0]!.name}`,
          prompt: findPrompt(opts[0]!.name) || "以下の選択肢から選んでください",
          options: opts.map((o) => ({ id: o.name, text: o.label || o.name, imageUrl: null as string | null })),
          referenceImages: [] as string[],
          candidateImages: [] as string[],
        });
      }
    }
    return out;
  });
}

/**
 * 把 PR 页采到的奖品参考图挂到 pendingChoices 上（整组挂在第一道题，原样展示）。
 *
 * ⚠️ 第一版按「一图对一选项」挂，被实测打脸（tu-10695）：present_img_01/02
 * 是合成图，每张里左右各摆一个系列（图内画着「or」），选项 1 = 两图的左半。
 * 按序号对应会**精确地误导**用户。各奖品版式又都不同——所以不猜对应关系，
 * 整组图当参考资料给人看，对应关系由图内自带的说明传达。
 */
function attachReferenceImages(pending: PendingChoice[], ctx: PatternContext): PendingChoice[] {
  const imgs = ctx.optionImageUrls ?? [];
  const cands = ctx.candidateImageUrls ?? [];
  if ((imgs.length === 0 && cands.length === 0) || pending.length === 0) return pending;
  return pending.map((q, i) =>
    i === 0 ? { ...q, referenceImages: imgs, candidateImages: cands } : q,
  );
}

export const isEnqSurveyPattern: FlowPattern = {
  name: "is-enq-survey",
  describes: "标准问卷型：会员信息确认 → is-enq PHP 问卷 → 送信",

  async recognize(page: Page): Promise<Recognition> {
    const url = page.url();
    if (url.includes(ENQ_HOST)) return { matched: true };
    if (PRESENT_CONFIRM_URL.test(url)) return { matched: true };
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

    // ── 1.5 第三种确认页 /present/confirm/<ID>：点「応募する」即完成，没有问卷 ──
    if (PRESENT_CONFIRM_URL.test(page.url())) {
      const submit = page.locator(PRESENT_CONFIRM_SUBMIT).first();
      if ((await submit.count()) === 0) {
        await ctx.log("确认页（/present/confirm/）上没有応募按钮", "warn");
        return { status: "unknownPattern" };
      }
      await ctx.log("提交应募确认（/present/confirm/ 版式，无问卷）");
      await ctx.pace();
      await clickAndSettle(page, submit);
      // 成败只看「有没有离开确认页」（全站统一判据；慢跳转再宽限一轮）
      let still = PRESENT_CONFIRM_URL.test(page.url()) && (await page.locator(PRESENT_CONFIRM_SUBMIT).count()) > 0;
      if (still) {
        await page.waitForTimeout(4000);
        still = PRESENT_CONFIRM_URL.test(page.url()) && (await page.locator(PRESENT_CONFIRM_SUBMIT).count()) > 0;
      }
      if (still) {
        await ctx.log("提交后仍停在确认页", "error");
        return { status: "failed" };
      }
      await ctx.log("投递完成");
      return { status: "drawn" };
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
  // 顺手采题（题号在 field 里）：给后续重建匹配库攒真实题库，零额外访问
  ctx.surveyCapture = { url: page.url(), questions };

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
    return { status: "needsChoice", pendingChoices: attachReferenceImages(pending, ctx) };
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
      // 职业下拉：精确匹配 → 斜杠/中点互换 → **包含匹配**兜底。
      //
      // ⚠️ 包含匹配是必需的（2026-08-25 实测）：站点选项是「自営業・自由業」，
      // 而用户在设置页填的是「自営業」——精确匹配永远不中，下拉留空，
      // 而它是**必填**，于是送信被弹回、整个账号 81 个奖品全失败。
      const job = document.querySelector<HTMLSelectElement>('select[name="prof_010_job1"]');
      if (job && profile.job) {
        const want = profile.job.trim();
        const variants = [want, want.replace("/", "・"), want.replace("・", "/")];
        const opts = Array.from(job.options).filter((o) => o.value && o.text.trim());
        const exact = opts.find((o) => variants.includes(o.text.trim()));
        // 包含匹配取**最短**的候选：「自営業」同时被「自営業・自由業」与
        // 「その他（自営業を除く）」包含时，短的那个更可能是本意
        const loose =
          exact ??
          opts
            .filter((o) => variants.some((v) => o.text.trim().includes(v) || v.includes(o.text.trim())))
            .sort((a, b) => a.text.trim().length - b.text.trim().length)[0];
        if (loose) {
          job.value = loose.value;
          done.push("prof_010_job1");
        } else {
          done.push("!prof_010_job1_未匹配");
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

    // ⚠️ 被退回 ≠ 死路（2026-08-23 实测 3 例）：站点在送信后校验出**我们没识别到的必选题**
    //（关键词没命中、也没被判成需人工——多为纯偏好题）。此前直接记 failed，
    // 用户无从补救。正确动作：把仍未作答的题摘出来转 needsChoice，
    // 手机上选完带着 resolvedChoices 重跑即可，和「ご希望の…」那条路完全一致。
    const unanswered = await collectUnanswered(page);
    if (unanswered.length > 0) {
      await ctx.log(`送信被退回（${reason}），${unanswered.length} 道题需人工选择，挂起等待`, "warn");
      return { status: "needsChoice", pendingChoices: attachReferenceImages(unanswered, ctx) };
    }
    await ctx.log(`送信被退回（${reason}），且找不到未作答的题`, "error");
    return { status: "failed" };
  }
  await ctx.log("送信完成");
  return { status: "drawn" };
}
