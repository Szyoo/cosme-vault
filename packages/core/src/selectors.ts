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
 * 募集流程（2026-08-19 登录态实测确认）。
 *
 * 实际链路：
 *   1. 详情页的「応募する」**不是表单提交**，而是 `<a href="javascript:;" onclick="location.href='…'">`，
 *      onclick 里直接带着问卷地址。因此**不必点它**——用 APPLY_LINK_PATTERN 从 onclick 提取 URL
 *      再直接导航，比模拟点击稳得多。
 *   2. 该地址形如 `/isauth/addinfo/<模板>/<URL编码的问卷地址>`，会转到 `/enquete/confirm`。
 *   3. `/enquete/confirm`＝会员登记信息确认页，POST 后才进入真正的问卷题目页。
 *   4. 问卷填完 → 送信 → 完成。
 *
 * ⚠️ 关键发现：确认页会**直接显示账号里已登记的姓名 / 住址 / 电话**，
 * 不需要脚本填写。初版 Java `Fill.fillName` 那套「填名前/年齢」在此流程用不上，
 * 除非个别问卷自己又问一遍。
 */
export const PRESENT = {
  /**
   * 详情页上的「応募する」锚点。
   *
   * ⚠️ 踩过的坑：onclick 形如
   *   `location.href='https://www.cosme.net/isauth/addinfo/<模板>/https%3A%2F%2F…%2Fenquete%2F…'`
   * 内层问卷地址是**URL 编码**的（`%2Fenquete%2F`），所以**不能**用 `a[onclick*="/enquete/"]`
   * 去匹配——那永远匹配不到。要认未编码的 `/isauth/addinfo/` 段。
   */
  applyAnchor: 'a[onclick*="isauth/addinfo"]',
  /** 从 onclick 提取跳转地址：捕获组 1 即 addinfo 地址（其尾部内嵌 URL 编码的问卷地址） */
  applyOnclickPattern: /location\.href='([^']+)'/,
  /** 问卷地址形态（对 addinfo 地址 decodeURIComponent 后匹配） */
  enquetePattern: /\/enquete\/enq_id\/(\d+)\/a_key\/([^/?]+)\/brand_id\/(\d+)/,
} as const;

/**
 * 个人信息确认页 `/enquete/confirm`（实测）。
 * 表单：POST /enquete/confirm，字段 token(hidden) + addbrand(checkbox) + act=submit。
 */
export const CONFIRM = {
  url: "https://www.cosme.net/enquete/confirm",
  form: 'form[action*="/enquete/confirm"]',
  tokenField: 'input[name="token"]',
  /** 「<品牌>をフォローする」——**默认已勾选，且页面明示「応募にはブランドフォローが必要です」**，
   *  即关注品牌是投递的前置条件，不可取消 */
  addBrandCheckbox: 'input[name="addbrand"]',
  submitButton: 'input[type="submit"]', // value 为「同意して次へ進む」
  /** 标题含此串即说明停在确认页 */
  titleMarker: "メンバー登録情報確認",
} as const;

/**
 * 问卷题目页。
 * TODO(recon)：需要 POST 过确认页才能看到，尚未侦察——那一步会真实关注品牌并推进投递，
 * 需用户明确同意后再做。初版（2023）结构为 form>table 深层嵌套 + label>input，仅作参考。
 */
export const SURVEY = {
  questionSection: "", // TODO(recon)
  questionText: "td.Q_Text01", // 2023 初版值，待校验
  optionLabel: "tr label", // 2023 初版值，待校验
  optionInput: "input:first-child",
  sendButton: "", // 「送信」TODO(recon)
} as const;

/** 已投递判定 TODO(recon)：需完成一次投递后才能确认其页面特征 */
export const DREW_MARKER = "" as const;

/**
 * 页面编码：实测列表页为 **Shift_JIS**（`charset=Shift_JIS`）。
 * Playwright 会自行按 meta 解码，但若改用 HTTP 直抓则必须显式转码，否则日文全乱。
 */
export const PAGE_CHARSET = "Shift_JIS";
