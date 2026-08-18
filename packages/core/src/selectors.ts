/**
 * @cosme 页面 URL 与选择器的集中配置。
 *
 * 2026-08-19 用 `npm run recon` 实测更新。仍带 TODO(recon) 的项需要登录态才能看到，
 * 待建立会话后继续校验。
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
 * 登录（2026 实测结论，与 2023 初版完全不同）。
 *
 * @cosme 已改用独立 OAuth/OIDC 授权服务器：访问 www.cosme.net 的 `/isauth/login/...`
 * 会 302 到 `auth.cosme.net/auth_requests/received?...client_id=&response_type=code&scope=openid...`。
 *
 * ⚠️ **登录表单受 reCAPTCHA Enterprise 保护**（隐藏域 `recaptchaEnterpriseToken`，
 * 无可见挑战，属分数制的隐形风控）。因此本项目**不做自动填密码登录**：
 * 那等于试图绕过机器人检测，既违反站点条款，也极易导致账号被标记。
 *
 * 采用的方案：**人工登录一次 + 持久化 profile 复用会话**（与作者 ledger-helper 处理网银
 * 二次验证的做法一致）。登录页默认勾选「次回から自動でログイン」，会话可长期保持。
 * 会话失效时由 runner 检测并经 Bark 通知，人工重新登录。
 */
export const LOGIN = {
  /** 授权服务器域名；当前页面落在此域即说明需要登录 */
  authHost: "auth.cosme.net",
  /** 命中此路径也说明处于登录跳转链路 */
  gatewayPathMarker: "/isauth/login/",
  /** 生成指定回跳地址的登录入口（人工登录时打开这个） */
  entryUrl: (returnTo: string) =>
    `https://www.cosme.net/isauth/login/AtCosmeDefaultTwoColumnPc/${encodeURIComponent(returnTo)}/0/1`,

  /**
   * 表单元素（已实测确认）。**仅用于人工登录时的辅助定位与状态判断，
   * 不用于自动提交凭证** —— 见上文 reCAPTCHA 说明。
   */
  loginIdInput: "#loginId",
  passwordInput: "#password",
  submitButton: 'input[type="submit"]',
  /** 「次回から自動でログイン」复选框，保持勾选以延长会话 */
  rememberMeCheckbox: 'input[type="checkbox"]',
  /** 存在此隐藏域即表示该表单挂了 reCAPTCHA Enterprise */
  recaptchaTokenField: 'input[name="recaptchaEnterpriseToken"]',
  csrfField: 'input[name="_csrf"]',
} as const;

/**
 * 募集流程（详情页 → 个人信息确认 → 问卷填表 → 送信）。
 * 初版 Java 的按钮状态机逻辑可复用，但选择器需登录后实测。
 */
export const PRESENT = {
  applyButton: "", // 「募集する」按钮 TODO(recon)
  personalInfoConfirmButton: "", // 个人信息确认 TODO(recon)
  drewMarker: "", // 「已募集」判定 TODO(recon)
  sendButton: "", // 填表页「送信」 TODO(recon)
} as const;

/** 问卷区块。初版为 form>table 深层嵌套（2023），需确认 2026 是否仍是表格布局。 */
export const SURVEY = {
  questionSection: "", // TODO(recon)
  questionText: "td.Q_Text01", // 初版值，待校验
  optionLabel: "tr label", // 初版值，待校验
  optionInput: "input:first-child",
} as const;

/**
 * 页面编码：实测列表页为 **Shift_JIS**（`charset=Shift_JIS`）。
 * Playwright 会自行按 meta 解码，但若改用 HTTP 直抓则必须显式转码，否则日文全乱。
 */
export const PAGE_CHARSET = "Shift_JIS";
