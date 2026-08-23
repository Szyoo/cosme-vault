/**
 * 模式：タイアップ（PR 合作）—— 2026-08-23 依据 81 个真实诊断包补写。
 *
 * 覆盖流程：
 *   c.w1.to 追踪链 →（302）→ /brands/<id>/tieup/<code>/page.html（品牌 PR 页）
 *   → 页内「今すぐ応募 >」（又是一条 c.w1.to 追踪链）→ isauth/addinfo →
 *   /enquete/confirm → is-enq 问卷 —— 后半段与 is-enq 模式完全相同，直接接力。
 *
 * 现场事实（诊断包 tieup 00003202608-01）：
 * - PR 页上有**十几条** c.w1.to 链接（クチコミをみる / SHOPPINGでみる / 詳しくみる…），
 *   全都是广告追踪链——**只有文本含「応募」的那条才是应募入口**（「今すぐ応募 >」）。
 *   按 href 一把抓会点去购物页。
 * - 「今すぐ応募」是真文本（innerText），不是图片 alt，可以按文本过滤。
 */
import type { Page } from "playwright";
import { clickAndSettle } from "../click.ts";
import { isEnqSurveyPattern } from "./is-enq-survey.ts";
import type { FlowPattern, PatternContext, PatternOutcome, Recognition } from "./types.ts";

/** PR 页的 URL 形状 */
const TIEUP_URL = /\/brands\/\d+\/tieup\/[^/]+\/page\.html/;
/** 应募入口：c.w1.to 追踪链里**文本含「応募」**的那条（其余全是广告位） */
const ENTRY = 'a[href*="c.w1.to"]';

export const tieupCampaignPattern: FlowPattern = {
  name: "tieup-campaign",
  describes: "タイアップ PR 页：今すぐ応募（c.w1.to 追踪链）→ 接力 is-enq 流程",

  async recognize(page: Page): Promise<Recognition> {
    const url = page.url();
    if (TIEUP_URL.test(url)) return { matched: true };
    return { matched: false, reason: `URL 不匹配 /brands/<id>/tieup/<code>/page.html（当前 ${url}）` };
  },

  async execute(page: Page, ctx: PatternContext): Promise<PatternOutcome> {
    const entry = page.locator(ENTRY, { hasText: "応募" }).first();
    if ((await entry.count()) === 0) {
      await ctx.log("PR 页上没有含「応募」的追踪链入口（可能已截止）", "warn");
      return { status: "unknownPattern" };
    }

    // 顺路采「奖品参考图」，两级启发式（2026-08-23 抽 15 个 PR 页人工核出的规律）：
    // 1. `present_img_<NN>` 模板（按 NN 排序）——部分多选一页面才有；
    // 2. 退而求其次：文件名含 present / product 的图（`present.jpg`、`product01_pc.png`、
    //    `product-img_pc.png` 是最常见的奖品本体图命名），剔除 tit/obi/ttl 等装饰件，
    //    最多 4 张、保持页面顺序。
    // 这些图作为**参考图**整组展示、不与选项对应（合成图教训），放漏比放错好，
    // 但参考图语义下宽一点没关系——选色号没有图基本没法选（用户反馈）。
    ctx.optionImageUrls = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll<HTMLImageElement>('img[src*="tieup_images"]'));

      const templ = all
        .map((i) => {
          const m = (i.getAttribute("src") ?? "").match(/present_img_(\d+)/);
          return m ? { n: Number(m[1]), src: i.src } : null;
        })
        .filter((x): x is { n: number; src: string } => !!x)
        .sort((a, b) => a.n - b.n);
      if (templ.length > 0) return templ.map((x) => x.src);

      // ⚠️ present 命名**优先于** product（アルビオン页实测教训）：
      // 奖品栏（box-present）的图叫 pc--14_present-1，正文产品介绍图组叫
      // pc--08_product-0..3——按 DOM 顺序先到先得会把介绍图当奖品图（用户报「图不对」）。
      // 「奖品是什么」永远比「产品长什么样」更贴选择场景，present 有就不要 product。
      const pick = (re: RegExp): string[] => {
        const seen = new Set<string>();
        const out: string[] = [];
        for (const i of all) {
          const file = (i.getAttribute("src") ?? "").split("/").pop() ?? "";
          if (!re.test(file)) continue;
          if (/tit|obi|ttl|icon|logo|banner|btn|dummy|space|bg/i.test(file)) continue;
          // 同一素材的 pc/sp 变体共享资产号前缀（013_884_original / 013_884_large），去重
          const asset = file.match(/^(\d+_\d+)_/)?.[1] ?? file;
          if (seen.has(asset)) continue;
          seen.add(asset);
          out.push(i.src);
          if (out.length >= 4) break;
        }
        return out;
      };
      const presents = pick(/present/i);
      if (presents.length > 0) return presents;
      return pick(/product/i);
    });
    if (ctx.optionImageUrls.length > 0) await ctx.log(`PR 页采到 ${ctx.optionImageUrls.length} 张奖品参考图`);

    await ctx.log("点击「今すぐ応募」追踪链，进入应募流程");
    await ctx.pace();
    // 追踪链是多重 302，最终落到 cosme 的 addinfo/确认页；等它落地
    await clickAndSettle(page, entry, { settleMs: 30_000 });
    await page
      .waitForURL((u) => u.hostname.endsWith("cosme.net"), { timeout: 25_000 })
      .catch(() => undefined);

    // 落地后应当是 is-enq 模式认识的页面（addinfo 入口 / 确认页 / 问卷主机），
    // 直接接力；不认识则安全中止——诊断包会带上落点现场
    const rec = await isEnqSurveyPattern.recognize(page);
    if (!rec.matched) {
      await ctx.log(`追踪链落点不是 is-enq 流程（${page.url()}），安全中止`, "warn");
      return { status: "unknownPattern" };
    }
    return isEnqSurveyPattern.execute(page, ctx);
  },
};
