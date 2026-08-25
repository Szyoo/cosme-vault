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
    // 「已跳过」曾把「奖品过期」与「站点下架」混成一个，界面上说不清为什么跳过
    case "expired":
      return { label: s.expired, pill: "" };
    case "gone":
      return { label: s.gone, pill: "amber" };
    case "alreadyEntered":
      // 结果上等于「已投递」，但来源不同（站点摊牌，不是我们提交的），故单列一档
      return { label: s.alreadyEntered, pill: "green" };
    case "failed":
      return { label: s.failed, pill: "red" };
    case "unknownPattern":
      return { label: s.unknownPattern, pill: "amber" };
    default:
      return { label: status, pill: "" };
  }
}
