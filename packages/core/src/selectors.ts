/**
 * @cosme 页面 URL 与选择器的集中配置。
 *
 * URL 部分已于 2026-08-18 从 VPS 实测确认（HTTP 200、Shift_JIS 服务端渲染、无风控拦截）。
 * 选择器部分仍需登录后用 runner 的 inspect 任务逐个校验——匿名 curl 只能看到未登录视图。
 */

/** 奖品列表页。实测：2023 年记录的 `/present/` 只是导航页，真正的列表在下面两个来源。 */
export const LIST_URLS = {
  /** 品牌 collection 奖品列表（未登录即可见奖品 detail 链接） */
  normal: "https://www.cosme.net/brandcollection/present/",
  /** 品牌粉丝俱乐部奖品列表（未登录时不渲染奖品，必须先登录） */
  brandFanClub: "https://www.cosme.net/brandfanclub/present",
} as const;

/**
 * 奖品详情页 URL 形态（实测）：
 *   https://www.cosme.net/brandcollection/present/detail/present_id/<数字ID>
 * 用此正则从列表页 HTML/DOM 提取奖品 ID，比依赖 CSS class 稳定得多。
 */
export const PRESENT_DETAIL_PATTERN = /present\/detail\/present_id\/(\d+)/g;

export function presentDetailUrl(presentId: string): string {
  return `https://www.cosme.net/brandcollection/present/detail/present_id/${presentId}`;
}

/**
 * 登录。实测 @cosme 用集中式 isauth 网关，形态为：
 *   /isauth/login/<模板名>/<URL编码的回跳地址>/<flag>/<flag>
 * 因此登录不该自己拼表单页，而应：访问目标页 → 若被导向 isauth → 在该页填表。
 */
export const LOGIN = {
  /** 命中此路径即说明当前处于登录网关 */
  gatewayPathMarker: "/isauth/login/",
  /** 生成指定回跳地址的登录入口 */
  entryUrl: (returnTo: string) =>
    `https://www.cosme.net/isauth/login/AtCosmeDefaultTwoColumnPc/${encodeURIComponent(returnTo)}/0/1`,
  // 以下表单选择器需登录页实测校验（inspect 任务）
  mailInput: "", // TODO(inspect)
  passwordInput: "", // TODO(inspect)
  submitButton: "", // TODO(inspect)
} as const;

/**
 * 募集流程（详情页 → 个人信息确认 → 问卷填表 → 送信）。
 * 初版 Java 的按钮状态机逻辑可复用，但选择器全部需要登录后实测。
 */
export const PRESENT = {
  applyButton: "", // 「募集する」按钮 TODO(inspect)
  personalInfoConfirmButton: "", // 个人信息确认 TODO(inspect)
  drewMarker: "", // 「已募集」判定 TODO(inspect)
  sendButton: "", // 填表页「送信」 TODO(inspect)
} as const;

/** 问卷区块。初版为 form>table 深层嵌套（2023），需确认 2026 是否仍是表格布局。 */
export const SURVEY = {
  questionSection: "", // TODO(inspect)
  questionText: "td.Q_Text01", // 初版值，待校验
  optionLabel: "tr label", // 初版值，待校验
  optionInput: "input:first-child",
} as const;

/**
 * 页面编码：实测列表页为 **Shift_JIS**（`charset=Shift_JIS`）。
 * Playwright 会自行按 meta 解码，但若改用 HTTP 直抓则必须显式转码，否则日文全乱。
 */
export const PAGE_CHARSET = "Shift_JIS";
