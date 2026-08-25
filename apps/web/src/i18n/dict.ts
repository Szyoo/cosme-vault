/**
 * 界面文案字典（中 / 日 / 英，与作者其他项目一致的三语）。
 *
 * 范围约定：**只放界面自己的文案**。从 @COSME 抓来的内容（奖品名、品牌名、
 * 文案、数量的原文如「計20名様現品」）一律原样展示，不翻译也不改写——
 * 那些是数据不是 UI。
 */
export const LOCALES = ["zh", "ja", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "zh";

export const LOCALE_NAMES: Record<Locale, string> = {
  zh: "中文",
  ja: "日本語",
  en: "English",
};

/** 字典结构以中文为准，其余语言必须提供同样的键（类型会强制） */
const zh = {
  appName: "Cosme Vault",
  appSub: "@COSME 抽奖辅助控制面",

  nav: {
    console: "控制台",
    records: "记录",
    diagnostics: "诊断",
    settings: "设置",
    back: "返回",
  },

  runner: {
    title: "Runner",
    online: "在线",
    offline: "离线",
    noHeartbeat: "尚未收到心跳",
    busy: "执行中",
    idle: "空闲",
    lastSeen: (ago: string) => `最后心跳 ${ago}`,
    offlineQueued: (n: number) => `${n} 个任务在排队（跑一轮算一个），等 runner 上线才会开始。`,
    diedMidJob:
      "掉线时手上还有任务——那次投递有没有真的提交出去无从查证（@COSME 不标注「已应募」），" +
      "已按超时回收并标成失败，请人工到原页面确认。",
    startHint: "在 Mac mini 上跑 `npm run runner` 让它上线。",
    stop: "终止排队",
    stopping: "终止中…",
    stopConfirm: "再点一次确认终止",
    stopped: (n: number, running: number) =>
      `已取消 ${n} 个排队任务` + (running ? `；另有 ${running} 个正在执行，会自己跑完` : ""),
    stopHint: "终止只取消「排队中」的任务；正在执行的那一个会自己跑完（从控制面停不了浏览器）。奖品仍是待投递，下一轮继续。",
    queuedNow: (n: number) => `排队中 ${n}`,
    queueTitle: "任务队列",
    queueHint:
      "以你的操作为单位：「跑一轮」算一个，「单独重跑」算一个。取消只影响这一批还在排队的部分；" +
      "正在执行的那一个会自己跑完（从控制面停不了浏览器）。",
    batchRun: "跑一轮",
    batchScan: "仅检测",
    batchDraw: "仅抽取",
    batchSingle: "单独重跑",
    batchLogin: "激活登录（等人工）",
    batchProgress: (done: number, total: number) => `${done} / ${total} 个奖品`,
    batchFailed: (n: number) => `${n} 个失败`,
    queueEmpty: "队列是空的。",
    nowRunning: "正在执行",
    cancelJob: "取消",
    toTop: "置顶",
    queueMore: (n: number) => `还有 ${n} 个未列出`,
    run: "跑一轮",
    scanOnly: "仅检测",
    drawOnly: "仅抽取",
    running: "触发中…",
    runHint:
      "跑一轮 = 检测 + 抽取连着做；仅检测 = 只扫奖品不投递；仅抽取 = 不扫描，直接投递现有的待投递。" +
      "投递一律按人类速度随机间隔。",
    queued: (n: number) => `已入队 ${n} 个扫描任务`,
    dispatched: (n: number) => `已派发 ${n} 个投递`,
    confirmDraw: "将真实投递现有的全部「待投递」奖品，抽奖机会用掉就没了。",
    confirmRun: "将扫描全部来源，然后自动投递全部待投递，抽奖机会用掉就没了。",
    confirmGo: "确认，开始",
    confirmNo: "算了",
    runFailed: "触发失败",
    autoRefresh: "此页每 4 秒自动更新一次（切到后台时暂停）。",
  },

  stat: {
    presents: "奖品",
    scanned: "已扫描",
    drawn: "已投递",
    thisAccount: "全部账号",
    pending: "待投递",
    nextRound: "下一轮处理",
    needsChoice: "待选择",
    needsYou: "需要你",
    total: "总计",
    rows: "条记录",
    failed: "失败",
    needsReview: "需人工确认",
    accounts: "账号",
    configured: "已配置",
  },

  matrix: {
    title: "各账号进度",
    hint: "每个账号：各状态之和 + 未建记录 = 奖品总数。缺口就是这个账号还没扫到的奖品。",
    totalPresents: (n: number) => `奖品共 ${n} 个`,
    missing: "未建记录",
    missingHint: "扫描还没覆盖到这个账号的奖品（新账号或扫描中断）。点「仅检测」为它建立记录。",
    disabled: "已停用",
    confirmOne: (label: string) => `只为「${label}」投递现有待投递，抽奖机会用掉就没了。`,
  },

  present: {
    listTitle: "奖品",
    name: "奖品",
    type: "类型",
    brand: "品牌",
    quantity: "数量",
    period: "期间",
    status: "状态",
    pattern: "模式",
    applyPeriod: "应募期间",
    quantityForm: "数量 / 形式",
    tagline: "文案",
    id: "奖品 ID",
    lastScan: "最近扫描",
    openOriginal: "打开 @COSME 原页面",
    perAccountStatus: "各账号的投递状态",
    noAccountRecord: "还没有任何账号的记录。",
    relatedJobs: "相关任务",
    emptyHint: "还没有奖品数据，点上面的「跑一轮」开始扫描。",
    detail: "详情",
  },

  status: {
    pending: "待投递",
    drawn: "已投递",
    needsChoice: "待选择",
    skipped: "已跳过",
    alreadyEntered: "站点已应募",
    failed: "失败",
    unknownPattern: "未知模式",
  },

  // 类型名在中文界面下给可读的中文说法，full 里保留站点原词（タイアップ 等），
  // 这样既看得懂、又对得上 @COSME 页面上的字。日文界面则一律用原词。
  source: {
    normalShort: "新品合集",
    normalFull: "ブランドコレクション · 品牌新品合集（每周三更新）",
    fanClubShort: "粉丝俱乐部",
    fanClubFull: "ブランドファンクラブ · 粉丝俱乐部限定（article 直链）",
    fanClubViaBrandFull: "ブランドファンクラブ · 粉丝俱乐部限定（经品牌主页两跳）",
    produceShort: "策划成员",
    produceFull: "プロデュースメンバー · 策划成员限定（部分需消耗ビューティコイン）",
    tieupShort: "PR 合作",
    tieupFull: "タイアップ · 品牌付费 PR 企划（名额通常很大，500〜800名様）",
  },

  choice: {
    title: "选择奖品",
    submitted: "已提交",
    submittedHint: "选择已保存，稍后会自动继续投递这个奖品。",
    noNeed: "无需选择",
    noNeedHint: (s: string) => `该奖品当前状态是 ${s}，可能已经处理过了。`,
    pick: "请选择",
    submit: "提交并继续投递",
    submitting: "提交中…",
    unanswered: (n: number) => `还有 ${n} 道题没选`,
    missingAccount: "链接缺少 account 参数",
    loadFailed: "读取失败",
    submitFailed: "提交失败",
    goChoose: "去选择",
    refImagesHint: "奖品参考图（选项与图的对应关系见图内说明）",
    fixImages: "图片不对？从候选里选",
    fixImagesClose: "收起候选",
    fixImagesHint: "以下是该奖品页面上的全部内容图。点选正确的（可多张），保存后即替换参考图。",
    fixImagesSaving: "保存中…",
    fixImagesSave: (n: number) => `用这 ${n} 张作为参考图`,
    yourChoice: "你的选择",
    needsChoiceTitle: "需要你选择",
  },

  diag: {
    title: "诊断",
    sub: "runner 遇到没见过的页面版式时会安全中止并回传现场（不会瞎点）。这里列出待处理的现场。",
    none: "目前没有未识别的页面 —— 所有遇到的版式都有对应实现。",
    anomalies: "异常现场（按种类去重）",
    seenTimes: (n: number) => `出现 ${n} 次`,
    affected: (n: number) => `影响 ${n} 个奖品`,
    noVisual: "（这次没留下截图或页面快照）",
    markResolved: "标记已处理并重排",
    unrecognizedSources: "列表来源未识别",
    unknownFlows: "投递流程未识别",
    stuckAt: "卡在",
    pageTitle: "标题",
    triedPatterns: "已试模式",
    expandElements: (n: number) => `展开元素清单（${n}）`,
    collapse: "收起",
    copyElements: "复制元素清单",
    copied: "已复制 ✓",
    bodyExcerpt: "正文摘要",
    noBundle: "（没有现场包 —— 可能是旧记录，或 runner 采集失败）",
    tag: "标签",
    kind: "类型",
    selector: "建议选择器",
    text: "文本",
    banner: (n: number) => `有 ${n} 处未识别的页面版式`,
    bannerHint: "runner 已安全中止并留下现场（没有瞎点）。到诊断页查看元素清单，据此补一个流程模式。",
  },

  records: {
    title: "记录",
    sub: "投递历史。@COSME 不标注「已应募」，这张表是唯一权威来源。",
    detailTable: "明细",
    account: "账号",
    time: "时间",
    empty: "还没有记录。回控制台点「跑一轮」。",
  },

  settings: {
    title: "设置",
    accounts: "cosme 账号",
    accountsHint: "抽奖批次会按顺序轮抽这里启用的账号。凭证经 AES-256-GCM 加密存储，页面不会回显已保存的值。",
    newLabel: "账号备注名（如：主号）",
    add: "添加账号",
    empty: "还没有账号，先添加一个。",
    credConfigured: "凭证已配置",
    credMissing: "凭证未配置",
    enable: "启用",
    disable: "停用",
    fillCred: "填写凭证",
    collapse: "收起",
    delete: "删除",
    credHint: "留空的字段保持原值不变。姓名 / 年龄 / 职业会被填进抽奖表单（对应日文栏位「名前」「年齢」「職業」）。",
    email: "cosme 登录邮箱",
    password: "cosme 登录密码",
    passwordSet: "密码已设置（留空则不改）",
    realName: "姓名（名前）",
    age: "年龄（年齢）",
    job: "选择职业（対応：職業）",
    jobLegacy: "旧值，建议重选",
    save: "保存凭证",
    saving: "保存中…",
    saved: (label: string) => `「${label}」的凭证已保存`,
    saveFailed: "保存失败",
    confirmDelete: (label: string) => `删除账号「${label}」及其全部抽取记录？此操作不可撤销。`,
    activate: "激活登录",
    sessionOk: "已登录 ✓",
    sessionOkHint: "最近 72 小时内有成功任务，会话有效；失效后此处会重新出现「激活登录」",
    activating: "已通知电脑…",
    activateHint:
      "点击后 Mac mini 上会弹出该账号的登录窗口（可能要等几秒到几十秒，runner 领到任务才弹）。" +
      "到电脑前手动完成登录——密码不会被代填（reCAPTCHA 风控红线）。最长等 12 分钟。",
    activateQueued: "已入队：去 Mac mini 屏幕前完成登录（最长等 12 分钟）",
  },

  login: {
    username: "用户名",
    password: "密码",
    submit: "登录",
    submitting: "登录中…",
    failed: "登录失败",
  },

  draw: {
    one: "投递这个",
    confirm: "再点一次确认投递",
    queueing: "入队中…",
    queued: "已入队，runner 会尽快执行",
    failed: "入队失败",
    seeScene: "看现场",
  },

  log: { title: "运行日志", empty: "（暂无日志）", copy: "复制", copied: "已复制 ✓", toBottom: "回到最新" },
  common: { loading: "读取中…", none: "—", jobs: "最近任务", noneYet: "暂无" },

  /** 设计包的右上角工具（明暗切换、背景参数）也要跟着语言走 */
  chrome: { auto: "跟随系统", light: "浅色", dark: "深色", localOnly: "仅本地保存" },

  ago: {
    justNow: "刚刚",
    minutes: (n: number) => `${n} 分钟前`,
    hours: (n: number) => `${n} 小时前`,
    days: (n: number) => `${n} 天前`,
  },

  attention: {
    needsConfirm: "需要你人工确认",
    needsConfirmHint:
      "runner 在投递过程中断了。重投是安全的——若其实已经应募过，runner 会在问卷页" +
      "识别出来（那一页没有题目也没有送信按钮）并直接跳过，不会重复提交。" +
      "只有连续中断多次才需要你亲自去原页面看。",
    check: "去确认",
  },

  resolve: {
    openSite: "看原页面",
    wasDrawn: "直接记为已投递",
    retry: "重投一次（推荐）",
    markedDrawn: "已记为「已投递」，不会再派发",
    requeued: "已重新入队，runner 上线后执行",
    failed: "提交失败",
  },

  barkSettings: {
    title: "Bark 推送",
    hint: "奖品需要人工选择时推送到手机。改完保存即生效，无需重启；留空则回落到服务器环境变量。",
    server: "Bark 服务器（如 https://bark.szyyw.xyz）",
    deviceKey: "设备 Key（Bark App 首页可复制）",
    save: "保存",
    saving: "保存中…",
    saved: "已保存",
    test: "发测试推送",
    testing: "发送中…",
    testSent: "已发送，看手机 ✓",
    testBody: "推送配置正常 ✅",
    testFailed: "推送失败——检查服务器地址与设备 Key",
    fromEnv: "当前值来自服务器环境变量（保存后改用此处的值）",
    notConfigured: "未配置：需要选择的奖品只能在网页上看到，手机不会收到通知。",
  },

  pacing: {
    title: "投递节奏",
    hint:
      "runner 的人类速度模拟参数，保存后 ≤15 秒生效（runner 每次心跳顺路拉取，无需重启）。" +
      "这是合规的核心：间隔越短越像机器，风险自负。",
    step: "单步停顿（毫秒，页面内每一步操作之间）",
    between: "奖品间隔（毫秒，投完一个到开下一个）",
    min: "最小",
    max: "最大",
    save: "保存",
    saving: "保存中…",
    saved: "已保存，runner 将在下一次心跳后用新值",
  },

  filter: {
    search: "搜奖品名 / 品牌 / ID",
    all: "全部",
    byType: "类型",
    byStatus: "状态",
    shown: (n: number, total: number) => `显示 ${n} / ${total}`,
    noMatch: "没有符合条件的奖品",
    reset: "清空筛选",
  },

  /**
   * 会被前端直接显示出来的 API 报错。
   * 只收「用户看得见」的那几条——runner 端点的报错是给日志看的，不进这里。
   */
  api: {
    badRequest: "请求格式非法",
    badCredentials: "用户名或密码错误",
    notLoggedIn: "未登录",
    noRunnableAccount: "没有可跑的账号（需已启用且已配置凭证）",
    missingAccountParam: "缺少 account 参数",
    recordNotFound: "记录不存在",
    badParams: "参数非法",
    presentNotFound: "奖品不存在，无法派发",
    alreadyResolved: "该奖品的选择已提交过",
    jobNotQueued: "该任务不在排队中，无法操作",
    nothingToDraw: "没有可抽取的奖品（待投递的都已在队列里，或已全部投完）",
  },
};

/**
 * 其余语言的类型必须与中文完全一致。
 *
 * ⚠️ **中文字典刻意不加 `as const`**：加了每个值都会变成字面量类型
 * （`"控制台"` 而不是 `string`），日/英字典的每一条都会报「不能赋给该字面量」。
 * 不加就自然收窄成 `string` / `(n: number) => string`，键的完整性仍由
 * `const ja: Dict` 的标注强制（少一个键就编译报错）。
 */
type Dict = typeof zh;

const ja: Dict = {
  appName: "Cosme Vault",
  appSub: "@COSME プレゼント応募コンソール",

  nav: { console: "コンソール", records: "履歴", diagnostics: "診断", settings: "設定", back: "戻る" },

  runner: {
    title: "Runner",
    online: "オンライン",
    offline: "オフライン",
    noHeartbeat: "ハートビート未受信",
    busy: "実行中",
    idle: "待機中",
    lastSeen: (ago: string) => `最終ハートビート ${ago}`,
    offlineQueued: (n: number) => `${n} 件のタスクが待機中（一周まわす＝1 件）。runner が起動するまで進みません。`,
    diedMidJob:
      "切断時にタスクを保持していました——その応募が実際に送信されたかは確認できません" +
      "（@COSME は「応募済み」を表示しない）。タイムアウトとして回収し失敗扱いにしました。元ページで確認してください。",
    startHint: "Mac mini で `npm run runner` を実行してください。",
    stop: "キューを停止",
    stopping: "停止中…",
    stopConfirm: "もう一度押して停止",
    stopped: (n: number, running: number) =>
      `${n} 件のタスクをキャンセルしました` + (running ? `。実行中の ${running} 件はそのまま完了します` : ""),
    stopHint:
      "停止するのは「待機中」のタスクのみ。実行中の 1 件はそのまま完了します（コンソールからブラウザは止められません）。プレゼントは未応募のまま、次の周で続行します。",
    queuedNow: (n: number) => `待機 ${n}`,
    queueTitle: "タスクキュー",
    queueHint:
      "操作の単位で表示します：「一周まわす」で 1 件、「個別に再実行」で 1 件。キャンセルは待機中の分だけに効きます。" +
      "実行中の 1 件はそのまま完了します（コンソールからブラウザは止められません）。",
    batchRun: "一周まわす",
    batchScan: "検出のみ",
    batchDraw: "応募のみ",
    batchSingle: "個別に再実行",
    batchLogin: "ログイン起動（手動待ち）",
    batchProgress: (done: number, total: number) => `${done} / ${total} 件`,
    batchFailed: (n: number) => `失敗 ${n}`,
    queueEmpty: "キューは空です。",
    nowRunning: "実行中",
    cancelJob: "キャンセル",
    toTop: "先頭へ",
    queueMore: (n: number) => `他 ${n} 件`,
    run: "一周まわす",
    scanOnly: "検出のみ",
    drawOnly: "応募のみ",
    running: "起動中…",
    runHint:
      "一周まわす＝検出と応募を続けて実行。検出のみ＝走査だけで応募しない。応募のみ＝走査せず未応募分だけ応募。" +
      "応募間隔は常に人間相当のランダム待機。",
    queued: (n: number) => `走査タスクを ${n} 件登録しました`,
    dispatched: (n: number) => `${n} 件の応募を割り当てました`,
    confirmDraw: "未応募のプレゼントすべてに実際に応募します。応募機会は取り消せません。",
    confirmRun: "全ソースを走査後、未応募分すべてに自動で応募します。応募機会は取り消せません。",
    confirmGo: "実行する",
    confirmNo: "やめる",
    runFailed: "起動に失敗しました",
    autoRefresh: "このページは 4 秒ごとに自動更新されます（バックグラウンドでは停止）。",
  },

  stat: {
    presents: "プレゼント",
    scanned: "走査済み",
    drawn: "応募済み",
    thisAccount: "全アカウント",
    pending: "未応募",
    nextRound: "次の周で処理",
    needsChoice: "選択待ち",
    needsYou: "あなたの操作待ち",
    total: "合計",
    rows: "件",
    failed: "失敗",
    needsReview: "要確認",
    accounts: "アカウント",
    configured: "設定済み",
  },

  matrix: {
    title: "アカウント別の進捗",
    hint: "各アカウント：状態ごとの合計 + 未登録 = プレゼント総数。差分はまだ走査していない分です。",
    totalPresents: (n: number) => `プレゼント計 ${n} 件`,
    missing: "未登録",
    missingHint: "このアカウント向けのレコードが未作成（新規または走査中断）。「検出のみ」で作成されます。",
    disabled: "無効",
    confirmOne: (label: string) => `「${label}」の未応募分だけに応募します。応募機会は取り消せません。`,
  },

  present: {
    listTitle: "プレゼント",
    name: "プレゼント",
    type: "種別",
    brand: "ブランド",
    quantity: "当選数",
    period: "期間",
    status: "状態",
    pattern: "フロー",
    applyPeriod: "応募期間",
    quantityForm: "当選数 / 形式",
    tagline: "コピー",
    id: "プレゼント ID",
    lastScan: "最終走査",
    openOriginal: "@COSME のページを開く",
    perAccountStatus: "アカウントごとの応募状態",
    noAccountRecord: "まだ記録がありません。",
    relatedJobs: "関連タスク",
    emptyHint: "データがありません。上の「一周まわす」で走査を開始してください。",
    detail: "詳細",
  },

  status: {
    pending: "未応募",
    drawn: "応募済み",
    needsChoice: "選択待ち",
    skipped: "スキップ",
    alreadyEntered: "応募済み（サイト判定）",
    failed: "失敗",
    unknownPattern: "未知のフロー",
  },

  source: {
    normalShort: "コレクション",
    normalFull: "ブランドコレクション（毎週水曜更新の新着）",
    fanClubShort: "ファンクラブ",
    fanClubFull: "ブランドファンクラブ限定（記事リンク直行）",
    fanClubViaBrandFull: "ブランドファンクラブ限定（ブランドページ経由）",
    produceShort: "プロデュース",
    produceFull: "プロデュースメンバー限定（一部はビューティコインが必要）",
    tieupShort: "タイアップ",
    tieupFull: "タイアップ（ブランドとのPR企画。当選数が多い）",
  },

  choice: {
    title: "プレゼントを選ぶ",
    submitted: "送信しました",
    submittedHint: "選択を保存しました。まもなく応募を続行します。",
    noNeed: "選択は不要です",
    noNeedHint: (s: string) => `現在の状態は ${s} です。すでに処理済みの可能性があります。`,
    pick: "選択してください",
    submit: "送信して応募を続ける",
    submitting: "送信中…",
    unanswered: (n: number) => `未回答が ${n} 件あります`,
    missingAccount: "リンクに account パラメータがありません",
    loadFailed: "読み込みに失敗しました",
    submitFailed: "送信に失敗しました",
    goChoose: "選択する",
    refImagesHint: "プレゼント参考画像（選択肢との対応は画像内の説明を参照）",
    fixImages: "画像が違う？候補から選ぶ",
    fixImagesClose: "候補を閉じる",
    fixImagesHint: "ページ上の全コンテンツ画像です。正しいものをタップ（複数可）して保存すると差し替わります。",
    fixImagesSaving: "保存中…",
    fixImagesSave: (n: number) => `この ${n} 枚を参考画像にする`,
    yourChoice: "あなたの選択",
    needsChoiceTitle: "選択が必要です",
  },

  diag: {
    title: "診断",
    sub: "未知のページ版式に遭遇すると runner は安全に中止し、現場を回収します（推測でクリックしません）。",
    none: "未識別のページはありません — 遭遇した版式はすべて対応済みです。",
    anomalies: "異常の現場（種類ごとに集約）",
    seenTimes: (n: number) => `${n} 回発生`,
    affected: (n: number) => `${n} 件に影響`,
    noVisual: "（今回はスクリーンショットもスナップショットも取れませんでした）",
    markResolved: "対応済みにして再キュー",
    unrecognizedSources: "一覧ソース未識別",
    unknownFlows: "応募フロー未識別",
    stuckAt: "停止位置",
    pageTitle: "タイトル",
    triedPatterns: "試したフロー",
    expandElements: (n: number) => `要素一覧を開く（${n}）`,
    collapse: "閉じる",
    copyElements: "要素一覧をコピー",
    copied: "コピーしました ✓",
    bodyExcerpt: "本文抜粋",
    noBundle: "（現場データなし — 旧レコードか、回収に失敗）",
    tag: "タグ",
    kind: "型",
    selector: "推奨セレクタ",
    text: "テキスト",
    banner: (n: number) => `未識別のページ版式が ${n} 件`,
    bannerHint: "runner は安全に中止し現場を残しました。診断ページで要素一覧を確認し、フローを追加してください。",
  },

  records: {
    title: "履歴",
    sub: "応募履歴。@COSME は「応募済み」を表示しないため、この表が唯一の正です。",
    detailTable: "明細",
    account: "アカウント",
    time: "時刻",
    empty: "記録がありません。コンソールで「一周まわす」を実行してください。",
  },

  settings: {
    title: "設定",
    accounts: "cosme アカウント",
    accountsHint:
      "有効なアカウントを順に処理します。認証情報は AES-256-GCM で暗号化保存し、保存済みの値は画面に戻しません。",
    newLabel: "アカウント表示名（例：メイン）",
    add: "アカウントを追加",
    empty: "アカウントがありません。まず追加してください。",
    credConfigured: "認証情報あり",
    credMissing: "認証情報なし",
    enable: "有効化",
    disable: "無効化",
    fillCred: "認証情報を入力",
    collapse: "閉じる",
    delete: "削除",
    credHint: "空欄の項目は変更しません。名前 / 年齢 / 職業は応募フォームに入力されます。",
    email: "cosme ログインメール",
    password: "cosme ログインパスワード",
    passwordSet: "パスワード設定済み（空欄なら変更なし）",
    realName: "名前",
    age: "年齢",
    job: "職業を選択",
    jobLegacy: "旧データ、選び直し推奨",
    save: "認証情報を保存",
    saving: "保存中…",
    saved: (label: string) => `「${label}」の認証情報を保存しました`,
    saveFailed: "保存に失敗しました",
    confirmDelete: (label: string) => `アカウント「${label}」と全ての応募記録を削除しますか？元に戻せません。`,
    activate: "ログインを起動",
    sessionOk: "ログイン済み ✓",
    sessionOkHint: "直近 72 時間以内に成功タスクあり。セッション切れになるとここに「ログインを起動」が再表示されます",
    activating: "PC に通知しました…",
    activateHint:
      "クリックすると Mac mini にこのアカウントのログインウィンドウが開きます（runner が受け取るまで数秒〜数十秒）。" +
      "PC の前でログインしてください——パスワードの自動入力はしません（reCAPTCHA 対策のレッドライン）。最長 12 分待機。",
    activateQueued: "登録しました：Mac mini の画面でログインを完了してください（最長 12 分）",
  },

  login: { username: "ユーザー名", password: "パスワード", submit: "ログイン", submitting: "ログイン中…", failed: "ログインに失敗しました" },

  draw: {
    one: "これに応募",
    confirm: "もう一度押して確定",
    queueing: "登録中…",
    queued: "登録しました。runner が順次実行します",
    failed: "登録に失敗しました",
    seeScene: "現場を見る",
  },

  log: { title: "実行ログ", empty: "（ログなし）", copy: "コピー", copied: "コピーしました ✓", toBottom: "最新へ" },
  common: { loading: "読み込み中…", none: "—", jobs: "最近のタスク", noneYet: "なし" },

  chrome: { auto: "システムに従う", light: "ライト", dark: "ダーク", localOnly: "この端末にのみ保存" },

  ago: {
    justNow: "たった今",
    minutes: (n: number) => `${n} 分前`,
    hours: (n: number) => `${n} 時間前`,
    days: (n: number) => `${n} 日前`,
  },

  attention: {
    needsConfirm: "手動での確認が必要",
    needsConfirmHint:
      "応募の途中で runner が中断しました。再応募は安全です——既に応募済みなら" +
      "アンケートページ（設問も送信ボタンも無い状態）で runner が判定してスキップします。" +
      "連続で中断した場合のみ、元ページの確認が必要です。",
    check: "確認する",
  },

  resolve: {
    openSite: "元ページを見る",
    wasDrawn: "応募済みとして記録",
    retry: "再応募する（推奨）",
    markedDrawn: "「応募済み」として記録しました。今後は割り当てません",
    requeued: "再登録しました。runner 起動後に実行します",
    failed: "送信に失敗しました",
  },

  barkSettings: {
    title: "Bark 通知",
    hint: "選択が必要なプレゼントをスマホに通知します。保存すると即時反映（再起動不要）。空欄ならサーバーの環境変数を使用。",
    server: "Bark サーバー（例 https://bark.szyyw.xyz）",
    deviceKey: "デバイスキー（Bark アプリのトップでコピー可）",
    save: "保存",
    saving: "保存中…",
    saved: "保存しました",
    test: "テスト通知を送る",
    testing: "送信中…",
    testSent: "送信しました。スマホを確認 ✓",
    testBody: "通知設定は正常です ✅",
    testFailed: "送信失敗——サーバーアドレスとデバイスキーを確認してください",
    fromEnv: "現在の値はサーバー環境変数由来（保存するとこちらが優先）",
    notConfigured: "未設定：選択待ちはウェブでしか確認できず、スマホに通知されません。",
  },

  pacing: {
    title: "応募ペース",
    hint:
      "人間らしい速度を再現するパラメータ。保存後 15 秒以内に反映（runner がハートビートごとに取得、再起動不要）。" +
      "間隔が短いほど機械的に見えます。",
    step: "ステップ間隔（ミリ秒、ページ内の操作間）",
    between: "プレゼント間隔（ミリ秒、応募と応募の間）",
    min: "最小",
    max: "最大",
    save: "保存",
    saving: "保存中…",
    saved: "保存しました。次のハートビートから新しい値になります",
  },

  filter: {
    search: "プレゼント名 / ブランド / ID で検索",
    all: "すべて",
    byType: "種別",
    byStatus: "状態",
    shown: (n: number, total: number) => `${n} / ${total} 件を表示`,
    noMatch: "条件に一致するプレゼントがありません",
    reset: "絞り込みを解除",
  },

  api: {
    badRequest: "リクエストの形式が不正です",
    badCredentials: "ユーザー名またはパスワードが違います",
    notLoggedIn: "ログインしていません",
    noRunnableAccount: "実行できるアカウントがありません（有効かつ認証情報の設定が必要）",
    missingAccountParam: "account パラメータがありません",
    recordNotFound: "レコードが存在しません",
    badParams: "パラメータが不正です",
    presentNotFound: "プレゼントが存在せず、割り当てできません",
    alreadyResolved: "このプレゼントの選択は既に送信済みです",
    jobNotQueued: "待機中のタスクではないため操作できません",
    nothingToDraw: "応募できるプレゼントがありません（未応募分はすべてキュー済みか、応募完了）",
  },
};

const en: Dict = {
  appName: "Cosme Vault",
  appSub: "@COSME giveaway console",

  nav: { console: "Console", records: "Records", diagnostics: "Diagnostics", settings: "Settings", back: "Back" },

  runner: {
    title: "Runner",
    online: "Online",
    offline: "Offline",
    noHeartbeat: "no heartbeat yet",
    busy: "busy",
    idle: "idle",
    lastSeen: (ago: string) => `last heartbeat ${ago}`,
    offlineQueued: (n: number) => `${n} task(s) queued (a round counts as one) — nothing runs until the runner is back.`,
    diedMidJob:
      "It still held a job when it dropped off — whether that entry actually got submitted cannot be verified " +
      "(@COSME never marks “already entered”). It was reclaimed as timed out and marked failed; please check the original page.",
    startHint: "Run `npm run runner` on the Mac mini to bring it back.",
    stop: "Stop queue",
    stopping: "Stopping…",
    stopConfirm: "Click again to stop",
    stopped: (n: number, running: number) =>
      `Cancelled ${n} queued job(s)` + (running ? `; ${running} still running will finish on its own` : ""),
    stopHint:
      "Stopping cancels queued jobs only; the one already running finishes on its own (the console cannot stop the browser). Presents stay pending and continue next round.",
    queuedNow: (n: number) => `${n} queued`,
    queueTitle: "Job queue",
    queueHint:
      "Grouped by what you did: one entry per “run a round”, one per single retry. Cancelling affects only the queued part; " +
      "the one already running finishes on its own (the console cannot stop the browser).",
    batchRun: "Round",
    batchScan: "Scan only",
    batchDraw: "Draw only",
    batchSingle: "Single retry",
    batchLogin: "Login activation (manual)",
    batchProgress: (done: number, total: number) => `${done} / ${total} presents`,
    batchFailed: (n: number) => `${n} failed`,
    queueEmpty: "The queue is empty.",
    nowRunning: "Running",
    cancelJob: "Cancel",
    toTop: "To top",
    queueMore: (n: number) => `${n} more not listed`,
    run: "Run a round",
    scanOnly: "Scan only",
    drawOnly: "Draw only",
    running: "Starting…",
    runHint:
      "A round = scan then draw. Scan only finds presents without entering; draw only enters what is already pending, no scanning. " +
      "Entries always keep human-paced random gaps.",
    queued: (n: number) => `Queued ${n} scan job(s)`,
    dispatched: (n: number) => `Dispatched ${n} draw(s)`,
    confirmDraw: "This really enters ALL pending presents. Entries cannot be undone.",
    confirmRun: "Scans all sources, then enters everything pending automatically. Entries cannot be undone.",
    confirmGo: "Confirm & start",
    confirmNo: "Cancel",
    runFailed: "Failed to start",
    autoRefresh: "This page refreshes itself every 4 seconds (paused while in the background).",
  },

  stat: {
    presents: "Presents",
    scanned: "scanned",
    drawn: "Entered",
    thisAccount: "all accounts",
    pending: "Pending",
    nextRound: "next round",
    needsChoice: "Needs choice",
    needsYou: "needs you",
    total: "Total",
    rows: "records",
    failed: "Failed",
    needsReview: "needs review",
    accounts: "Accounts",
    configured: "configured",
  },

  matrix: {
    title: "Progress per account",
    hint: "For each account: all statuses + not-yet-tracked = total presents. The gap is what this account hasn't scanned.",
    totalPresents: (n: number) => `${n} presents total`,
    missing: "Not tracked",
    missingHint: "No record for this account yet (new account or interrupted scan). Run “Scan only” to create them.",
    disabled: "Disabled",
    confirmOne: (label: string) => `Enters pending presents for “${label}” only. Entries cannot be undone.`,
  },

  present: {
    listTitle: "Presents",
    name: "Present",
    type: "Type",
    brand: "Brand",
    quantity: "Winners",
    period: "Period",
    status: "Status",
    pattern: "Flow",
    applyPeriod: "Entry period",
    quantityForm: "Winners / form",
    tagline: "Tagline",
    id: "Present ID",
    lastScan: "Last scan",
    openOriginal: "Open on @COSME",
    perAccountStatus: "Status per account",
    noAccountRecord: "No records yet.",
    relatedJobs: "Related jobs",
    emptyHint: "No presents yet — hit “Run a round” above to scan.",
    detail: "Details",
  },

  status: {
    pending: "Pending",
    drawn: "Entered",
    needsChoice: "Needs choice",
    skipped: "Skipped",
    alreadyEntered: "Already entered",
    failed: "Failed",
    unknownPattern: "Unknown flow",
  },

  source: {
    normalShort: "Collection",
    normalFull: "Brand Collection — new arrivals, updated Wednesdays",
    fanClubShort: "Fan Club",
    fanClubFull: "Brand Fan Club exclusive (direct article link)",
    fanClubViaBrandFull: "Brand Fan Club exclusive (two hops via the brand page)",
    produceShort: "Produce",
    produceFull: "Produce Member exclusive (some cost Beauty Coins)",
    tieupShort: "PR",
    tieupFull: "Tie-up — paid brand PR campaign (usually large quotas, 500–800 winners)",
  },

  choice: {
    title: "Choose a present",
    submitted: "Submitted",
    submittedHint: "Your choice is saved; the entry will continue shortly.",
    noNeed: "No choice needed",
    noNeedHint: (s: string) => `Current status is ${s} — it may already be handled.`,
    pick: "Please choose",
    submit: "Submit and continue",
    submitting: "Submitting…",
    unanswered: (n: number) => `${n} question(s) still unanswered`,
    missingAccount: "Link is missing the account parameter",
    loadFailed: "Failed to load",
    submitFailed: "Failed to submit",
    goChoose: "Choose",
    refImagesHint: "Prize reference images (see labels inside the images for which option is which)",
    fixImages: "Wrong image? Pick from candidates",
    fixImagesClose: "Hide candidates",
    fixImagesHint: "All content images from the prize page. Tap the right ones (multiple OK) and save to replace.",
    fixImagesSaving: "Saving…",
    fixImagesSave: (n: number) => `Use these ${n} as reference`,
    yourChoice: "Your choice",
    needsChoiceTitle: "Needs your choice",
  },

  diag: {
    title: "Diagnostics",
    sub: "When the runner meets an unknown page layout it stops safely and reports the scene — it never guesses clicks.",
    none: "No unrecognised pages — every layout encountered is handled.",
    anomalies: "Anomalies (deduped by kind)",
    seenTimes: (n: number) => `seen ${n}×`,
    affected: (n: number) => `${n} presents affected`,
    noVisual: "(no screenshot or snapshot captured this time)",
    markResolved: "Mark resolved & requeue",
    unrecognizedSources: "Unrecognised list sources",
    unknownFlows: "Unrecognised entry flows",
    stuckAt: "Stuck at",
    pageTitle: "Title",
    triedPatterns: "Patterns tried",
    expandElements: (n: number) => `Show elements (${n})`,
    collapse: "Collapse",
    copyElements: "Copy elements",
    copied: "Copied ✓",
    bodyExcerpt: "Body excerpt",
    noBundle: "(No scene bundle — old record, or capture failed)",
    tag: "Tag",
    kind: "Type",
    selector: "Suggested selector",
    text: "Text",
    banner: (n: number) => `${n} unrecognised page layout(s)`,
    bannerHint: "The runner stopped safely and left the scene. Open Diagnostics for the element list and add a flow.",
  },

  records: {
    title: "Records",
    sub: "Entry history. @COSME never marks “already entered”, so this table is the only source of truth.",
    detailTable: "Details",
    account: "Account",
    time: "Time",
    empty: "No records yet. Go to the console and hit “Run a round”.",
  },

  settings: {
    title: "Settings",
    accounts: "cosme accounts",
    accountsHint:
      "Enabled accounts are processed in order. Credentials are stored AES-256-GCM encrypted and never echoed back.",
    newLabel: "Account label (e.g. Main)",
    add: "Add account",
    empty: "No accounts yet — add one first.",
    credConfigured: "credentials set",
    credMissing: "credentials missing",
    enable: "Enable",
    disable: "Disable",
    fillCred: "Enter credentials",
    collapse: "Collapse",
    delete: "Delete",
    credHint: "Blank fields keep their current value. Name / age / job are filled into the entry form.",
    email: "cosme login email",
    password: "cosme login password",
    passwordSet: "Password set (leave blank to keep)",
    realName: "Name",
    age: "Age",
    job: "Select occupation",
    jobLegacy: "legacy value, please re-pick",
    save: "Save credentials",
    saving: "Saving…",
    saved: (label: string) => `Credentials saved for “${label}”`,
    saveFailed: "Failed to save",
    confirmDelete: (label: string) => `Delete account “${label}” and all its entry records? This cannot be undone.`,
    activate: "Activate login",
    sessionOk: "Logged in ✓",
    sessionOkHint: "A task succeeded within 72h, session is live; the activate button reappears if it expires",
    activating: "Notified the Mac…",
    activateHint:
      "Opens a login window for this account on the Mac mini (takes a few seconds until the runner picks it up). " +
      "Complete the login there yourself — passwords are never auto-filled (reCAPTCHA red line). Waits up to 12 minutes.",
    activateQueued: "Queued — finish the login on the Mac mini screen (up to 12 min)",
  },

  login: { username: "Username", password: "Password", submit: "Sign in", submitting: "Signing in…", failed: "Sign-in failed" },

  draw: {
    one: "Enter this one",
    confirm: "Click again to confirm",
    queueing: "Queueing…",
    queued: "Queued — the runner will pick it up",
    failed: "Failed to queue",
    seeScene: "View scene",
  },

  log: { title: "Runner log", empty: "(no logs yet)", copy: "Copy", copied: "Copied ✓", toBottom: "Jump to latest" },
  common: { loading: "Loading…", none: "—", jobs: "Recent jobs", noneYet: "None" },

  chrome: { auto: "Follow system", light: "Light", dark: "Dark", localOnly: "saved locally only" },

  ago: {
    justNow: "just now",
    minutes: (n: number) => `${n} min ago`,
    hours: (n: number) => `${n} h ago`,
    days: (n: number) => `${n} d ago`,
  },

  attention: {
    needsConfirm: "Needs your confirmation",
    needsConfirmHint:
      "The runner was interrupted mid-entry. Retrying is safe: if it was already entered, the runner " +
      "detects it on the survey page (no questions, no submit button) and skips without submitting. " +
      "Only repeated interruptions need you to check the original page yourself.",
    check: "Check",
  },

  resolve: {
    openSite: "Open site",
    wasDrawn: "Just mark as entered",
    retry: "Retry (recommended)",
    markedDrawn: "Recorded as entered; it will not be dispatched again",
    requeued: "Re-queued; runs once the runner is back",
    failed: "Failed to submit",
  },

  barkSettings: {
    title: "Bark push",
    hint: "Pushes to your phone when a present needs a manual choice. Takes effect on save, no restart; blank falls back to server env vars.",
    server: "Bark server (e.g. https://bark.szyyw.xyz)",
    deviceKey: "Device key (copy from the Bark app home)",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    test: "Send test push",
    testing: "Sending…",
    testSent: "Sent — check your phone ✓",
    testBody: "Push config works ✅",
    testFailed: "Push failed — check server URL and device key",
    fromEnv: "Current values come from server env vars (saving switches to these)",
    notConfigured: "Not configured: choice-needed presents only show on the web, no phone notification.",
  },

  pacing: {
    title: "Entry pacing",
    hint:
      "Human-speed simulation parameters. Take effect within 15s of saving (fetched on each runner heartbeat, no restart). " +
      "Shorter gaps look more robotic — your call.",
    step: "Step delay (ms, between in-page actions)",
    between: "Gap between presents (ms)",
    min: "Min",
    max: "Max",
    save: "Save",
    saving: "Saving…",
    saved: "Saved — the runner picks it up on its next heartbeat",
  },

  filter: {
    search: "Search name / brand / ID",
    all: "All",
    byType: "Type",
    byStatus: "Status",
    shown: (n: number, total: number) => `Showing ${n} of ${total}`,
    noMatch: "No presents match the filter",
    reset: "Clear filters",
  },

  api: {
    badRequest: "Malformed request",
    badCredentials: "Wrong username or password",
    notLoggedIn: "Not signed in",
    noRunnableAccount: "No runnable account (must be enabled and have credentials)",
    missingAccountParam: "Missing account parameter",
    recordNotFound: "Record not found",
    badParams: "Invalid parameters",
    presentNotFound: "Present not found — cannot dispatch",
    alreadyResolved: "This present's choice was already submitted",
    jobNotQueued: "That job is not queued, so it cannot be changed",
    nothingToDraw: "Nothing to draw — pending presents are already queued, or everything is entered",
  },
};

export const DICTS: Record<Locale, Dict> = { zh, ja, en };
export type { Dict };
