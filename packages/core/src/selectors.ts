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
  /** 品牌粉丝俱乐部奖品列表（未登录时不渲染奖品，必须先登录）。桌面页只露出 10 个 */
  brandFanClub: "https://www.cosme.net/brandfanclub/present",
  /**
   * ⭐ 全量列表（**奖品的大头**）。
   *
   * 实测 2026-08-20：站点共「現在募集中のプレゼント 57件」，而桌面版
   * `/present/` + `/brandcollection/present/` + `/brandfanclub/present`
   * 合计只暴露 13 个；另外 45 个只出现在这个**手机版**列表里。
   * 桌面版没有等价页面（`/brandfanclub/present/list`、`/present/list/` 均 404）。
   *
   * ⚠️ 抓它必须用**手机 UA**，否则站点给的是桌面版内容。
   */
  mobileAll: "https://s.cosme.net/present/",
} as const;

/** 抓 mobileAll 时要用的手机 UA（桌面 UA 拿不到全量列表） */
export const MOBILE_USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

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
 * 列表卡片结构（两个来源差别很大，各有一套）。
 */
export const LIST_CARD = {
  /**
   * brandcollection：无语义 class，靠结构定位。
   *   <li><p class="img"><a href="…present_id/<ID>"><img></a></p>
   *       <dl><dt><a>品牌</a></dt><dd><a>标题<br>（期间）</a></dd></dl></li>
   */
  normal: {
    anchor: 'a[href*="present_id"]',
    card: "li",
    /** ⚠️ 图片必须限定在这个容器里取，不能用 card.querySelector("img") */
    image: "p.img img",
    brand: "dt a",
    title: "dd a",
  },
  /**
   * brandFanClub：有语义 class（第三代 Python 代码里的 `.psnt-ttl` 就是给它写的）。
   *   <li><a href="/beautist/article/<ID>">
   *       <p class="psnt-pic"><img alt="商品名 / 品牌" onerror="…noimg…"></p>
   *       <dl><dt><span class="psnt-ttl">商品名</span> / 品牌</dt>
   *           <dd class="psnt-num">計N名様 現品</dd>
   *           <dd class="psnt-copy">一句话文案</dd>
   *           <dd class="psnt-btn">応募する</dd></dl></a></li>
   *
   * ⚠️ 注意它**没有 present_id**，奖品入口是 `/beautist/article/<ID>`。
   */
  brandFanClub: {
    anchor: 'a[href*="/beautist/article/"]',
    card: "li",
    image: "p.psnt-pic img",
    title: ".psnt-ttl",
    /** 品牌名在 dt 里、位于 .psnt-ttl 之后的「 / 品牌」部分 */
    brandInDt: "dt",
    quantity: ".psnt-num",
    copy: ".psnt-copy",
    applyMarker: ".psnt-btn",
  },
} as const;

/**
 * 手机版全量列表里的奖品链接形态：`s.cosme.net/brand/brand_id/<品牌ID>/present/<奖品ID>`。
 * 其规范地址是 `www.cosme.net/brands/<品牌ID>/present/<奖品ID>/`（桌面 UA 可正常访问）。
 *
 * ⚠️ 这类详情页的投递入口是 **`input[onclick]`**（不是 `a[onclick]`），
 * 跳转地址同样是 `isauth/addinfo`，与 brandcollection 同族。
 */
export const BRAND_PRESENT_PATTERN = /\/brand(?:s)?(?:\/brand_id)?\/(\d+)\/present\/(\d+)/;

export function brandPresentUrl(brandId: string, presentId: string): string {
  return `https://www.cosme.net/brands/${brandId}/present/${presentId}/`;
}

/** brandFanClub 奖品入口：/beautist/article/<数字ID> */
export const ARTICLE_PATTERN = /\/beautist\/article\/(\d+)/;

/**
 * brandFanClub 的投递流程（2026-08-20 实测，与 is-enq 问卷流程完全不同）：
 *   /beautist/article/<ID> 上的「応募する」→
 *   /brands/<品牌ID>/present-blog/<PB码>/confirm/ → POST → 完成
 *
 * 特点：**无 isauth/addinfo、无 enquete、无 reCAPTCHA、也没有 addbrand 复选框**
 * （已经是粉丝俱乐部成员，不需要再关注）。确认页表单只有 token + act=submit。
 */
export const PRESENT_BLOG = {
  /** article 页上的应募入口（href 直接指向 confirm 页，不是 onclick 跳转） */
  applyAnchor: 'a[href*="/present-blog/"]',
  /** 确认页 URL 形态 */
  confirmPattern: /\/brands\/(\d+)\/present-blog\/([A-Za-z0-9]+)\/confirm\//,
  confirmForm: 'form[action*="/present-blog/"][action*="/confirm/"]',
  tokenField: 'input[name="token"]',
  submitButton: 'input[type="submit"]',
  /** 标题含此串即说明停在确认页 */
  titleMarker: "登録情報確認",

  /**
   * 确认页 POST 之后是**自家的问卷页** `/present-blog/<PB码>/survey/`
   * （2026-08-20 实测，不是 is-enq 引擎）。
   *
   * 与 is-enq 问卷的差异：
   * - 字段命名是 `id[13116]`（radio）/ `id[13117][]`（checkbox），不是 `q001_*`
   * - 没有 `prof_*` 个人资料字段（确认页已核对过登记信息）
   * - 提交按钮 value 为「アンケートに回答して応募する」
   * - 隐藏域同样是 act + token
   * - 无 reCAPTCHA
   *
   * 好消息：题目选项文案与 is-enq 问卷同源（「使ったことはないが、よく知っている」
   * 「商品について理解した」等），**关键词库可直接复用**。
   */
  surveyPathMarker: "/survey/",
  /**
   * 问卷题目的 DOM 结构（2026-08-20 实测）：
   *   <div class="qa">  Q1 题干…*  <div class="answer"><label><input>选项</label>…</div>  </div>
   * 题干 = `.qa` 的文本减去 `.answer` 的文本；题干里带 `*` 表示必填。
   * 与初版 Java 的 `//div[@class='qa']/div/label` 正好对应——那套 XPath 至今有效。
   */
  questionBlock: "div.qa",
  answerBlock: "div.answer",
  surveyForm: 'form[action*="/present-blog/"][action*="/survey/"]',
  /** 问卷题目的字段名形态 */
  surveyFieldPattern: /^id\[\d+\](\[\])?$/,
  surveySubmit: 'input[type="submit"]',
} as const;

/**
 * 页面编码：实测列表页为 **Shift_JIS**（`charset=Shift_JIS`）。
 * Playwright 会自行按 meta 解码，但若改用 HTTP 直抓则必须显式转码，否则日文全乱。
 */
export const PAGE_CHARSET = "Shift_JIS";
