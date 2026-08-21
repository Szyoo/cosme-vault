/**
 * 展示用的文案与配色，三个页面共用（原先各写一份，容易漂移）。
 */

/** 奖品类型（来源）。表格里用 short，详情页用 full。 */
export const SOURCE: Record<string, { short: string; full: string; pill: string }> = {
  normal: {
    short: "コレクション",
    full: "ブランドコレクション（每周三更新的品牌新品）",
    pill: "cyan",
  },
  brandFanClub: {
    short: "ファンクラブ",
    full: "ブランドファンクラブ限定（article 直链）",
    pill: "violet",
  },
  brandFanClubViaBrand: {
    short: "ファンクラブ",
    full: "ブランドファンクラブ限定（经品牌主页）",
    pill: "violet",
  },
};

export function sourceOf(source: string): { short: string; full: string; pill: string } {
  return SOURCE[source] ?? { short: source, full: source, pill: "" };
}

/** 投递状态 */
export const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待投递", pill: "" },
  drawn: { label: "已投递", pill: "green" },
  needsChoice: { label: "待选择", pill: "violet" },
  skipped: { label: "已跳过", pill: "" },
  failed: { label: "失败", pill: "red" },
  unknownPattern: { label: "未知模式", pill: "amber" },
};

export function statusOf(status: string): { label: string; pill: string } {
  return STATUS[status] ?? { label: status, pill: "" };
}
