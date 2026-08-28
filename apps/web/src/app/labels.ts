/**
 * 展示用的文案与配色，各页面共用（原先各写一份，容易漂移）。
 *
 * 文案本身来自 i18n 字典，这里只负责「枚举值 → 字典键 + 配色」的映射。
 * ⚠️ 注意区分：**类型名（コレクション / タイアップ 等）是站点自己的分类名词**，
 * 三语字典里日文一律保留原词，中英文给可读的对应说法。
 */
import type { Dict } from "@/i18n/dict.ts";

export interface Badge {
  short: string;
  full: string;
  pill: string;
}

/** 奖品类型（来源）。列表用 short，详情页用 full。 */
export function sourceOf(source: string, t: Dict): Badge {
  const s = t.source;
  switch (source) {
    case "normal":
      return { short: s.normalShort, full: s.normalFull, pill: "cyan" };
    case "brandFanClub":
      return { short: s.fanClubShort, full: s.fanClubFull, pill: "violet" };
    case "brandFanClubViaBrand":
      return { short: s.fanClubShort, full: s.fanClubViaBrandFull, pill: "violet" };
    case "produceMember":
      return { short: s.produceShort, full: s.produceFull, pill: "amber" };
    case "tieupCampaign":
      return { short: s.tieupShort, full: s.tieupFull, pill: "green" };
    default:
      return { short: source, full: source, pill: "" };
  }
}

/**
 * 展示用的状态归并：`alreadyEntered` 并入 `drawn`（用户要求：不分那么细）。
 *
 * **库里仍然分开存**——`alreadyEntered` 是「这次什么都没提交、站点显示早已应募」，
 * 是任务中断后能安全自动重跑的依据（见 contract 里 DrawStatus 的说明）。
 * 只是界面上没必要让人分辨：两者对用户的意义都是「已经参加了，不用再管」。
 * 所有按状态分组/筛选/计数的地方都要先过这一层，否则会出现两个都叫「已投递」的分组。
 */
export function mergeStatus(status: string): string {
  return status === "alreadyEntered" ? "drawn" : status;
}

/** 投递状态 */
export function statusOf(status: string, t: Dict): { label: string; pill: string } {
  const s = t.status;
  switch (status) {
    case "pending":
      return { label: s.pending, pill: "" };
    case "drawn":
      return { label: s.drawn, pill: "green" };
    case "needsChoice":
      return { label: s.needsChoice, pill: "violet" };
    // 「已跳过」曾把「奖品过期」与「站点 404」混成一个，界面上说不清为什么跳过。
    // 配色与账号进度条同语义：已下架黄、404 红（红=值得人看一眼：
    // 要么站点异常撤了页面，要么我们存的链接就是错的）
    case "expired":
      return { label: s.expired, pill: "amber" };
    case "gone":
      return { label: s.gone, pill: "red" };
    case "alreadyEntered":
      // 归并到「已投递」（mergeStatus）；这一支只作兜底，正常不会走到
      return { label: s.drawn, pill: "green" };
    case "failed":
      return { label: s.failed, pill: "red" };
    case "unknownPattern":
      // 明黄，与「已下架」的酱黄（amber）区分——进度条上同色会分不出来
      return { label: s.unknownPattern, pill: "yellow" };
    default:
      return { label: status, pill: "" };
  }
}
