/**
 * 页面分类器：先回答「这是什么页」，再谈「哪个流程认领它」。
 *
 * ⚠️ 存在的理由：此前 draw 只有「模式认领 / 未知模式」两档，于是
 * **登录墙**、**已结束的奖品页**这些**明明认得出来**的页面统统被报成
 * 「未知模式」——127 个诊断包全是登录页就是这么来的。未知模式应当只用于
 * 「真的没见过的版式」，其余已知情形各有各的正确结论。
 *
 * 只用结构与站点固有文案判定，不猜。
 */
import type { Page } from "playwright";

export type PageKind =
  /** 被弹到登录墙（auth.cosme.net 或站内「ご利用にはログインが必要です」） */
  | "loginWall"
  /** 奖品已结束募集 */
  | "ended"
  /** 页面本身不存在／出错 */
  | "notFound"
  /** 不属于上述已知情形（可能是流程页，交给模式去认领） */
  | "other";

export interface PageVerdict {
  kind: PageKind;
  /** 判定依据，写进日志与诊断包，便于事后核对 */
  evidence: string;
}

/** 站点固有文案（结构优先，文案只作补充判据） */
const LOGIN_TEXT = /ご利用にはログインが必要です|ログイン／メンバー登録|新規メンバー登録する/;
const ENDED_TEXT = /募集(は)?終了|受付(は)?終了|終了しました|受付を終了|応募(は)?締め切/;
/**
 * 404 只认站点固有的两句文案（真 404 页必带，2026-09-30 复核 12053 确认）。
 *
 * ⚠️ **不能有裸的 `404` / `Not Found`**（2026-09-30 事故）：正则里原有裸 `404`，
 * 任何含这三个数字的页面都会中招——tu-14651 的品牌 ID 是 **123404**、口碑数是
 * 「クチコミ (1404)」，于是 3 个**还在募集中**的 PR 奖品（9/23 开始、10/6~10/20 结束）
 * 被判成 404，两个账号各漏投一次。「重新加载复核」也救不了——数字是稳定存在的。
 * 真 404 页的标题里虽也有「404 Not Found」，但总是与「ページが見つかりません」同在，
 * 删掉裸匹配不会漏判。
 */
const NOTFOUND_TEXT = /ページが見つかりません|お探しのページは/;

export async function classifyPage(page: Page): Promise<PageVerdict> {
  const url = page.url();

  // 1. 登录墙：URL 最硬（授权服务器域名），文案兜底（站内也有登录墙版本）
  if (/(^|\/\/)auth\.cosme\.net/.test(url) || /\/isauth\/login/.test(url)) {
    return { kind: "loginWall", evidence: `URL 落在授权服务器：${url}` };
  }
  const { body, hasApplyEntry } = await page
    .evaluate(() => {
      const text = document.body?.innerText?.replace(/\s+/g, " ").slice(0, 3000) ?? "";
      // 可点击的应募入口是否还在：只看 a / button / input（含图片按钮的 alt），
      // 不看正文——正文里「応募するには…」这类说明句不算入口
      const APPLY = /今すぐ応募|応募する/;
      const clickable = [
        ...document.querySelectorAll<HTMLElement>("a, button, input[type=submit], input[type=image], input[type=button]"),
      ];
      const entry = clickable.some((el) => {
        const label =
          el instanceof HTMLInputElement ? `${el.value ?? ""} ${el.alt ?? ""}` : (el.innerText ?? "");
        return APPLY.test(label);
      });
      return { body: text, hasApplyEntry: entry };
    })
    .catch(() => ({ body: "", hasApplyEntry: false }));
  if (LOGIN_TEXT.test(body)) {
    return { kind: "loginWall", evidence: `正文含登录墙文案：${LOGIN_TEXT.exec(body)?.[0]}` };
  }

  // 2. 已结束：奖品过期是正常边界，不该报成未知模式。
  //
  // ⚠️ 双条件：结束文案 **且** 应募入口已消失。单看文案会误伤——tieup 的 PR 页
  // 常并列多个活动，别的活动的「受付は終了」也在 innerText 里。
  // 实证（2026-08-26 复核 55 条 expired）：真结束的详情页应募入口一定没了
  // （bp-31867/31876/31898 均验证），而 PR 页误扫场景本活动的「今すぐ応募」还在。
  // 入口还在就不定案，交给模式照常走流程——真结束了后续自然走不通，会回到兜底阶梯。
  if (ENDED_TEXT.test(body) && !hasApplyEntry) {
    return { kind: "ended", evidence: `正文含结束文案：${ENDED_TEXT.exec(body)?.[0]}，且页面已无应募入口` };
  }

  // 3. 页面不存在：同样要求**应募入口已消失**（与 ended 同一道保险）——
  // 页面上还有「今すぐ応募」就一定不是 404，文案碰巧撞上也不定案
  if (NOTFOUND_TEXT.test(body) && !hasApplyEntry) {
    return { kind: "notFound", evidence: `正文含 404 文案：${NOTFOUND_TEXT.exec(body)?.[0]}，且页面无应募入口` };
  }

  return { kind: "other", evidence: "" };
}
