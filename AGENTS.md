# AGENTS.md

面向 AI 编码智能体的项目说明。人类读者请先看 [README.md](README.md)。

## 硬性指令

- 对话、思考过程和代码注释全部使用中文。
- 不要自动执行任何安装 / 构建 / 迁移命令（`npm install`、`npm run build`、`next build`、`drizzle-kit`、`playwright install`、`docker` 等一律写清楚交给用户执行）。
- 禁止在 PR 中包含依赖或运行产物（`node_modules/`、`.next/`、`data/`、`*.db`、`apps/runner/artifacts|profile/` 已在 `.gitignore`）。
- 提交代码前逐行核对语法与导入路径——本仓库当前没有可跑的测试。
- 变更需同步更新 README / 注释，尤其改动跨进程协议时必须同步 `packages/contract` 与本文件的「三方契约」小节。
- 提交信息含简洁标题 + 概括性描述。
- 凭证 / 密钥绝不写进代码或提交；只经 `.env`（本地）或 Docker secret（生产）注入。

## 项目是什么

Cosme Vault 是 @COSME™ 抽奖辅助工具，历经 6 次重写（前 5 代考古见项目记忆）。当前形态是 **Web 控制面 + Playwright 执行器** 的前后端分离架构，放弃了早期的桌面应用路线，与作者的其他自部署项目（finance-ledger 等）同构。

核心业务：由 runner 驱动 Playwright 自动参与 @COSME 抽奖（扫描奖品 → 逐个募集 → 自动填问卷 → 遇需选择的奖品挂起等人工），控制面负责任务编排、多账号管理、记录留存、Bark 推送，前端展示与手动介入。

## 架构总览

```
iPhone/浏览器 ── cosme.szyyw.xyz (VPS: Caddy → web 容器)
                    │  控制面：任务队列 / 账号·奖品·记录 DB / Bark 推送 / 选择页
                    │
                    └── runner 主动出站长轮询（pull 模型）
                          apps/runner：Playwright + 持久 profile
                          VPS 部署已获初步验证（见下「IP 探测结论」），风控则切 Mac mini
                          └──> @COSME
```

**pull 模型是关键决策**：runner 主动出站连控制面拉任务、回传结果，不开入站端口、不依赖 tailnet。因此 runner 无论跑在 VPS（同 compose 内网）还是 Mac mini（NAT 后出站 HTTPS）都无需改代码——部署位是配置，不是代码。

## Monorepo 结构（npm workspaces）

```
packages/
├── contract/   三方共享协议：zod schema + TS 类型（跨进程数据形状的唯一来源）
└── core/        与运行环境解耦的领域逻辑
    ├── keywords.ts   问卷自动作答关键词库（移植自初版 Java Fill.java，核心资产）
    └── selectors.ts  @COSME 页面选择器集中配置（⚠️ 全部待 2026 实际页面校验）

apps/
├── web/         Next.js 16 控制面（前端 + runner 拉取 API + DB）
│   ├── src/db/          Drizzle schema（accounts / presents / account_presents / jobs / runner_logs）
│   ├── src/lib/         queue（队列服务）、bark、runner-auth、runner-state
│   └── src/app/api/runner/{next-job,report,log,heartbeat}  pull 模型端点
│       src/app/api/jobs  手动/定时触发入队
└── runner/      Playwright 执行器（Node 26 原生跑 TS，无构建步骤）
    ├── src/index.ts    主循环：心跳 → 长轮询领任务 → 分发 → 上报
    ├── src/probe.ts    IP 探针实验（决定部署位用）
    └── src/control-plane.ts  pull 客户端
```

## 技术栈（对齐 finance-ledger 版本线，一律用最新）

| 层 | 选择 |
| --- | --- |
| 运行时 | Node **26**（原生 type-stripping，runner 直接 `node src/x.ts`） |
| Web | Next.js **16** App Router + React **19** + TypeScript **7** |
| DB | SQLite + Drizzle ORM + `better-sqlite3` **13**（13 起有 Node 26 预编译包，无需 node-gyp；11.x 编译不过）。Drizzle 0.45 **尚未提供** `node:sqlite` 驱动，故内置 sqlite 暂不可用 |
| 执行器 | Playwright 最新版，`channel: 'chrome'`，持久化 context 保登录态 |
| 协议 | zod v4，置于 `packages/contract` |
| 设计 | `@szyyw/design`（github 依赖，纯 CSS/JS） |
| 推送 | Bark（官方 API 文档存 `docs/vendor/bark/bark-server-api-v2.md`） |
| 部署 | Docker + Caddy ingress（compose 照抄 ledger）；runner 亦可 launchd 跑 Mac mini |

## 三方契约（`packages/contract` 是唯一来源）

改任何跨进程数据形状，只改 `packages/contract/src/index.ts`，三端 import 同一份 zod schema，漂移在编译期报错。

- **任务（web → runner）**：`Job` = `ScanJob | DrawJob | InspectJob`（discriminated union，判别键 `kind`）
- **结果（runner → web）**：`JobReport { ok, outcome, error, artifacts }`，`outcome` = `ScanResult | DrawResult | InspectResult`。
  `DrawResult.surveyCapture` 是做题时顺手采下的问卷结构（题号在 field 里/题干/选项），
  applyReport 落进 `survey_captures` 表（每奖品最新一份），`GET /api/survey-captures` 全量导出——
  为**重建关键词匹配库**积累真实题库，零额外页面访问
- **人工介入**：`DrawResult.status = 'needsChoice'` 时带 `PendingChoice[]`，用户在网页选完 → 以 `resolvedChoices` 恢复 `DrawJob` 重跑
- **运行配置（web → runner）**：`RunnerConfig`（节奏参数），runner GET `/api/runner/config`
  每次心跳后拉取——**节奏在设置页可改，保存 ≤15 秒生效**（用户要求这类数值可看可改，
  不许埋在代码里）。`@cosme/core` 的 `PACING` 只是默认值兜底。
- **传输层**：runner GET `/api/runner/next-job`（长轮询）、POST `/api/runner/{report,log,heartbeat}`、GET `/api/runner/config`，全部 Bearer `RUNNER_TOKEN`

## 已知现状与待办

- **scan / draw / inspect 三种任务均已实现，端到端跑通**（2026-08-19：真实投递奖品 12057；扫描解析出 3 个奖品并建立待抽记录；重扫幂等性已验证）。
- **扫描的来源级反馈**：`ScanSourceReport` 区分「确实没有奖品」与「版式没认出来」，后者带诊断包——避免某来源悄悄失效被误当成「今天没新奖品」。实测 `brandFanClub` 即被正确标记为未识别（附 158 个元素的现场）。
- **幂等性是硬要求**：重扫**绝不能**把已投递记录重置为 pending（`queue.ts` 里只对不存在的 account_presents 插入）。因为 @COSME 不标注「已应募」，这张表是防重复投递的唯一防线。
- **流程模式注册表（重要架构）**：`apps/runner/src/cosme/patterns/`。@COSME 奖品分多类别、每类多模式、DOM 各不相同，故每个模式是一个实现 `FlowPattern` 的模块，自己回答「这一页是不是我认识的」。加新模式只需写一个文件 + 加进 `patterns/index.ts` 的 `PATTERNS` 数组（顺序即优先级）。
- **未知模式反馈机制**：所有模式都不认领时，**以及模式在执行中途遇到未预期页面时**（两条路径都要采集——后者曾漏采，导致首次实测 present-blog 落到 `/survey/` 页时诊断包是空的），**安全中止、绝不瞎点**，返回 `status: 'unknownPattern'` 并附 `PatternDiagnostics`（URL / 标题 / 全部可交互元素与建议选择器 / 正文摘要 / 各模式的拒绝原因），同时存截图与 HTML 快照，落库到 `account_presents.diagnostics`。据此补 pattern 基本不用再上站点复现。
- **已实现三个模式**（`tieup-campaign` 2026-08-23 依据 81 个真实诊断包补写，
  首轮全量投递时整类落进未知模式——教训：**「追踪链最终汇入 is-enq」不等于「有模式认识
  追踪链的落点页」**，入口跳转本身就是模式职责的一部分）：
  - `tieup-campaign`：`/brands/<id>/tieup/<code>/page.html` PR 页 →「今すぐ応募」→ 接力 is-enq。
    ⚠️ PR 页上有十几条 `c.w1.to` 追踪链（购物/口碑/详情…全是广告位），**只有文本含
    「応募」的那条是应募入口**，按 href 一把抓会点去购物页；「今すぐ応募」是真文本可过滤。
  - is-enq 的确认页有**第三种版式** `/present/confirm/<ID>`（produceMember 实测走到）：
    结构与 present-blog 确认页同款（act=submit + 応募する 钮），点了即完成、后面没有问卷。

  - `is-enq-survey`（brandcollection）：详情页 onclick 入口 → `/enquete/confirm` → `is-enq.cosme.net` PHP 问卷 → `input[name=send]` 送信。
  - `present-blog`（brandFanClub 限定，**已完整实测跑通**）：`/beautist/article/<ID>` 的普通 href 入口 → `/brands/<品牌ID>/present-blog/<PB码>/confirm/`（POST，表单只有 token + act=submit）→ **自家问卷页 `/present-blog/<PB码>/survey/`**（不是 is-enq 引擎）→ 「アンケートに回答して応募する」。
    - 问卷字段命名是 `id[13116]`（radio）/ `id[13117][]`（checkbox），与 is-enq 的 `q001_*` 完全不同；**没有 `prof_*` 个人资料字段**（确认页已核对过登记信息）。
    - 好消息：选项文案与 is-enq 问卷同源（「使ったことはないが、よく知っている」等），**关键词库直接复用**。
    - **无 addbrand 复选框**（本就是粉丝俱乐部成员）、无 enquete、全程无 reCAPTCHA。
- **入口跳转属于各模式自己的职责**，编排层 `draw.ts` 不含任何模式专属逻辑——两个来源的入口形态不同（onclick 藏地址 vs 普通 href），加新来源不必改编排层。
- **brandFanClub 的奖品 id 用 `bfc-<articleId>` 前缀**（它没有 present_id），避免与 brandcollection 的数字 id 撞号。
- **图片抓取有专门防护**：`@cosme/core` 的 `validateImageUrl`，四类实测陷阱——站点头部图标（`common_headers/`）、`onerror` 换上的占位图（`psnt_noimg`）、按 ID 构造 URL 想当然（**12053 是 .jpg 不是 .png**）、协议相对地址过不了 `z.string().url()`。策略是白名单（`/media/monitor/`、`/media/product/`、`/media/sku`）+ 占位与装饰黑名单，**宁可留空也不存错的**。
- **选择器校验工具已就绪**：`npm run recon -- <url> [--form]` 列出页面全部可交互元素与建议选择器（只读、不提交表单，对账号零风险）；需登录态的页面先跑 `npm run login`。登录相关选择器已实测填入，`PRESENT` 与 `SURVEY` 仍是 TODO(recon)，待建立会话后继续。
- **奖品来源共五个**（2026-08-21 实测，站上共约 138 个在募集）：

  | 来源 | 位置 | 数量 | 入口形态 | 走的模式 |
  | --- | --- | --- | --- | --- |
  | `tieupCampaign` | `/present/` 的 `ul.presentList` | **81** | **外部追踪链 `c.w1.to/c?id=<N>`** | is-enq-survey |
  | `brandFanClubViaBrand` | `/brandfanclub/present` | 42 | 两跳：卡片→品牌主页→奖品 | is-enq → 接力 present-blog |
  | `brandFanClub` | 同上 | 10 | `/beautist/article/<ID>` 直链 | present-blog |
  | `normal` | `/brandcollection/present/` | 3 | 详情页 `a[onclick]` | is-enq-survey |
  | `produceMember` | `/present/` | 2 | `/present/detail/present_id/<ID>` | is-enq-survey |

  ⚠️ **`tieupCampaign` 是奖品的大头，也是最容易漏的**：它的链接是**外部追踪跳转**
  `https://c.w1.to/c?id=<N>`，不是 cosme.net 路径——**按域名过滤链接会把这 81 个全漏掉**
  （踩过两轮）。而页面上的「キャンペーン中」「詳しくはこちら」都是**图片**（`alt` 属性），
  用 innerText 查也查不到。追踪链最终汇入已支持的 `/enquete/confirm`，故投递侧无需新模式。
  这批名额通常很大（現品500〜800名様），比粉丝俱乐部那批（20名様）中奖率高一两个数量级。

  ⚠️ **`produceMember` 必须按 pathname 前缀严格判断**：`a[href*="/present/detail/present_id/"]`
  会同时匹配 `/brandcollection/present/detail/present_id/`，把别的来源串进来、字段全错位（踩过）。
  这批部分**需要消耗ビューティコイン**，页面有明示。

- **跨模式接力**：入口页与后续页可能属于不同模式——`/brands/<id>/present/<id>/` 详情页的入口是
  `isauth/addinfo`（归 is-enq），但跳过去落在 `/present/<id>/confirm/`（present-blog 的地盘）。
  `draw.ts` 因此支持**一次接力**：第一个模式返回 unknownPattern 且别的模式认得当前页，就交棒继续。
- ⚠️ **同族页面的选择器别写死路径变体**（都踩过）：确认页有 `/present-blog/<PB>/confirm/`
  与 `/present/<ID>/confirm/` 两种；问卷页同理有两种 `/survey/`；关注品牌复选框有
  `addbrand`（present-blog，其实没有此框）与 **`addBrand`（驼峰，经品牌主页那批，默认勾选）**。
  一律用宽口径选择器 + 大小写不敏感属性匹配。
- **`packages/core/selectors.ts` 的 URL 已实测确认（2026-08-18，从 VPS）**：奖品列表真正的两个来源是 `/brandcollection/present/`（未登录可见）与 `/brandfanclub/present`（必须登录），2023 年记的 `/present/` 只是导航页；奖品详情形如 `/brandcollection/present/detail/present_id/<ID>`（用正则提 ID 比认 class 稳）；登录走集中式 `isauth` 网关而非独立表单页；页面编码是 **Shift_JIS**。**表单与按钮类选择器仍全是 TODO(inspect)**——匿名 curl 只能看到未登录视图，需登录后用 inspect 任务校验。
- **鉴权与凭证加密已完成并实测通过**：`src/proxy.ts` 全站门禁（放行 `/api/runner/*`、`/api/auth/*`、`/login`，以及带正确 `CRON_TOKEN` 的请求——cron 无会话，必须在门禁层放行，否则路由的双通道校验根本执行不到）；`src/lib/crypto.ts` 用 Node 内置 crypto 实现 AES-256-GCM 凭证加密 + scrypt 密码哈希 + HMAC 会话签名（**刻意不用 bcrypt，避免原生依赖**——原生模块正是本项目在 Node 26 踩过的坑）；`src/lib/auth.ts` 首次登录按 `ADMIN_USERNAME/ADMIN_PASSWORD` 自动建号。
- **账号管理与凭证录入已完成并实测通过**：设置页 `src/app/settings/page.tsx` + `/api/accounts` CRUD + `/api/accounts/:id/credentials`。语义：**留空字段=不改动**（可只改密码），列表接口只返回「哪些字段已填」绝不回显值，明文只存在于录入那一次请求。
- **runner 取凭证走独立端点** `/api/runner/credentials?accountId=`（Bearer RUNNER_TOKEN）。**刻意不把凭证塞进任务载荷**——那会把明文写进 jobs 表并留在历史里。
- **页面已齐**：`/`（控制台）、`/presents/[presentId]`（**奖品详情**：全部字段 + @COSME 原页面链接 + 单个投递按钮，控制台与记录页的奖品名都链到这里）、`/records`（投递历史与统计）、`/diagnostics`（未识别版式的现场，含元素清单与一键复制）、`/choices/[presentId]`（Bark 深链接落点）、`/settings`、`/login`。
  **视觉尚未统一到 @szyyw/design**（目前只引了 tokens/components 的 CSS，未真正用其组件与 DotField 背景），是下一步。
- **界面三语（中 / 日 / 英）**，字典在 `apps/web/src/i18n/dict.ts`：
  - 范围界线：**只译界面自己的文案**。从 @COSME 抓来的内容（奖品名、品牌、文案、
    数量原文如 `計20名様現品`、期间 `8/19～9/15`）一律原样展示——那是数据不是 UI。
  - 语言存 cookie `cosme_locale`，服务端 `getT()` 读它（与明暗模式同理：SSR 首屏
    必须由服务端决定，否则会闪一下旧语言）；没选过时按 `Accept-Language` 猜。
  - ⚠️ **中文字典刻意不加 `as const`**：加了每个值都变成字面量类型，日/英字典每一条
    都会报「不能赋给该字面量」（踩过）。不加就自然收窄成 `string`，键的完整性仍由
    `const ja: Dict` 的标注强制。
  - ⚠️ **字典里有函数**（`queued: (n) => …`），函数**不能跨 RSC 边界序列化**。
    因此 context 里只放 `locale` 字符串，客户端组件自己 import 字典模块用 locale 索引；
    服务端组件之间可以直接把 `t` 当 prop 传。
  - 会被前端直接显示的 API 报错也走字典（`t.api.*`，route handler 里 `await getT()`）；
    runner 端点的报错是给日志看的，不进字典。
  - 语言切换按钮进 @szyyw/design 的 `mountCornerTool`（order 15，明暗 10、背景参数 20），
    别自己写 position:fixed——那必然和明暗按钮打架。
- **奖品列表刻意不用表格**（`present-list.tsx` + `.plist`，控制台与记录页共用）：
  8 列信息在手机上必然横向溢出，表格只能横滚、一屏看不全。改成**两行一条**——
  图片跨两行、第一行标题（单行省略）、第二行参数（flex-wrap，窄屏往下堆而不是往右溢出）。
  实测 375px 宽下 `scrollWidth == innerWidth`，零横向溢出。
  - **筛选在客户端做**（类型 / 状态 / 关键词）：138 条数据已经在页面里，不值得走服务端；
    而且首页 4 秒自动刷新一次，用 URL 参数还得额外处理「刷新时保留筛选」。
    代价是数据要能跨 RSC 边界序列化 → `present-item.ts` 的 `PresentItem` 是**纯字符串**，
    类型名/状态名/配色在服务端就算好（字典里有函数，不能传）。
  - ⚠️ **类型筛选按「本地化短名」分组，不按 source 枚举值**：`brandFanClub` 与
    `brandFanClubViaBrand` 是同一类奖品（只是入口路径不同），短名都叫「粉丝俱乐部」。
    按枚举值分组会出现两个同名按钮（42 和 10），用户分不出该点哪个（踩过）。
  - 关键词匹配前两边都做 NFKC + 小写（站点 `@cosme` 与 `＠ｃｏｓｍｅ` 混用）。
- **版面顺序（用户定的）**：导航 tab 在**页面最上**，然后状态与统计，接着**运行日志**，
  最后才是奖品列表。奖品有一百多条，日志和导航排在它后面就等于永远看不见。
  详情类页面（奖品详情）也用顶部 `Nav` 作为出口，不再单独放返回条。
- **实时回传走 SSE**（`/api/events` + `lib/events.ts` + `live-refresh.tsx`）：
  runner 侧本来就是即时的（`pushLog` 每条日志立刻 POST），慢的是前端——原先靠
  4 秒轮询 `router.refresh()`。现在各端点落库后 `publish()`，SSE 推给浏览器立刻刷新。
  - 轮询保留为**兜底**但拉长到 20 秒（SSE 可能被代理掐断、或进程重启丢事件）。
  - 一次扫描连打几十条日志，逐条刷新等于自我 DDoS → 客户端**合并**，最多 600ms 一次。
  - ⚠️ 事件总线是**进程内**的。当前 compose 里 web 只有一个进程，够用；
    上多 worker / 多副本必须换成 Redis pub/sub 之类的外部通道，否则「写心跳的进程」
    和「持有 SSE 连接的进程」可能不是同一个——和 runner-state 当初从进程内存改成落库
    是同一类问题。
- **奖品详情从列表点进去是 modal**（拦截路由 `app/@modal/(.)presents/[presentId]`）：
  列表的筛选是**客户端 state**，跳页会卸载列表、筛选就丢了（筛到「PR 合作 81」点一个
  奖品，返回又是全部 138 条）。拦截路由让 URL 真实、后退键正常、还能分享，
  同时 children slot 不动，筛选自然保住。主体 `PresentDetailBody` 由整页与 modal 共用。
  - ⚠️ **跳转必须用 `next/link`**：拦截只在客户端导航时生效，普通 `<a href>` 是整页加载，
    直接绕过 modal。
  - ⚠️ `app/@modal/default.tsx` 不是可选文件：平行路由的每个 slot 都要有，
    否则硬刷新未匹配的 URL 会 404。
- **任务队列可见可操作**（`queue-panel.tsx` + `PATCH /api/jobs/:id`）：原先只写
  「26 个任务在排队」，里面是什么看不见、也不能单独取消或调顺序。现在按执行顺序摊开，
  每条给「置顶 / 取消」；正在执行的那条单列且**不给操作**（控制面停不了浏览器）。
  超出显示上限的条数照实写出来，不静默截断。
- ⚠️ **`jobs.createdAt` 是队列排序键，必须毫秒唯一**（`lib/stamp.ts` 的 `nextStamp`）：
  sqlite 的 `datetime('now')` 只到**秒**，而「跑一轮」在循环里连插上百条——实测 25 条
  任务的 `created_at` 一模一样，于是 `order by createdAt` 排不出确定顺序，
  「置顶」交换时间戳等于什么都没做（踩过，界面上点了没反应）。
  入队一律显式写 `nextStamp()`；重排时用 `stampSeries()` 按目标顺序重发一串递增戳。
- **时间一律经 `lib/when.ts` 格式化**：库里存的全是 UTC（runner 用 `toISOString()`，
  sqlite 默认值用 `datetime('now')`），页面原先直接印原字符串，界面上差 9 小时
  （显示 `07:55`、实际当地 `16:55`，用户报「时间不对」）。
  - 服务端按固定时区格式化（`DISPLAY_TZ`，默认 Asia/Tokyo）。**不在客户端
    `toLocaleString()`**——服务端组件那样做会水合不一致。
  - 两种入库格式都要认：带 Z 的 ISO，和 `datetime('now')` 那种**没有 Z 但同样是 UTC**
    的裸串（裸串必须补 Z 再解析，否则会被当成本地时间又差 9 小时）。
- ⚠️ **`locator.click()` 自带「等已排定的导航」，不能用它来判断成败**（`cosme/click.ts`）：
  站点问卷送信后的跳转实测超过 30 秒 → `click()` 自己抛超时 → 任务标记失败，
  **而表单其实已经提交了**（2026-08-21 真实踩到，PB3653）。库里记 failed、界面催人确认，
  站点那边却已经应募成功。一律用 `clickAndSettle()`：`noWaitAfter` 点完就返回，
  落地自己判断、超时不抛；成败只看「有没有离开表单」，慢跳转再宽限一轮。
- **runner 位置未设时按平台推断**（darwin → mac-mini，linux → vps）：原先界面会显示
  「🟢 在线 · unknown · 执行中」，把 contract 的枚举默认值印给了人看（用户问过）。
  界面侧也做了兜底：取不到位置就不显示这一段。
- **自动刷新没有任何 UI**（`live-refresh.tsx` 返回 null）。这块先后长过两次没用的皮：
  先是累计刷新次数（数字一直加，看着像业务计数、其实零信息量），改成上次刷新时刻
  （同样没人需要，而且旁边挂个可点按钮反而让人以为「实时」是要开关的功能）。
  **自动刷新是这一页的固有行为，不是可配置项**：只在 Runner 卡片写一句
  `t.runner.autoRefresh` 说明，控件一个都不给。切到后台时用 `visibilityState` 暂停。
- **诊断页是反馈闭环的最后一环**：`/api/diagnostics` 汇总两类未识别项——`account_presents.diagnostics`（draw 的未知模式）与最近 scan 结果里 `recognized=false` 的来源报告。元素清单可一键复制，拿去直接写选择器，通常不必再上站点复现。
- **DB 迁移**用 `drizzle-kit generate/migrate`，迁移文件进 `apps/web/drizzle/`（首版 `0000_sticky_kate_bishop.sql` 已生成并跑通）。drizzle-kit 直连 DB 不经 `src/db/index.ts`，故 `db:migrate` 脚本里带 `mkdir -p data`。
- **已实际部署（2026-08-22）**：web 在 VPS `/opt/cosme-vault`（compose 构建，容器 `cosme-vault` +
  `cosme-vault-cron` 每 12h 打一轮），Caddy 已加 `cosme.szyyw.xyz` 块，portal 首页已挂卡片；
  runner 在 Mac mini 以 launchd 常驻（`xyz.szyyw.cosme-runner`，指向 https://cosme.szyyw.xyz）。
  本地 dev 与终端 runner 已停用。数据库已用 sqlite backup API 快照迁移（141 个奖品 + 凭证 + 设置）。
  ⚠️ Dockerfile 别拷 `apps/web/node_modules`——workspaces 提升后容器里没有这个目录（VPS 实测）。
  Bark 配置进了 `app_settings`（网页可改、.env 兜底），服务器复用 jppost 的自建 bark（bark.szyyw.xyz）。
- **部署蓝图**（见 [docs/deploy.md](docs/deploy.md)）：`apps/web/Dockerfile`（Next standalone，容器启动跑迁移）+ `deploy/vps/compose.yml`（不 publish 端口、只挂 Caddy `ingress`，含 cron sidecar 每 12 小时打 `/api/runs`）+ `apps/runner/install.sh`（Mac mini 的 launchd 常驻）。
  - ⚠️ **monorepo 下 Next standalone 产物在 `apps/web/.next/standalone`**（不是仓库根的 `.next/`），入口是其内部的 `apps/web/server.js`。已实测确认，Dockerfile 的 COPY 路径按此写。
  - ⚠️ **`useSearchParams()` 必须包在 `Suspense` 里**，否则 `next build` 直接失败（dev 模式不报）。登录页与选择页都已按此拆分。

## Next 16 硬性约束（实测确认，勿按旧记忆写）

`next dev` 会自动生成 `apps/web/AGENTS.md` / `CLAUDE.md`，警告「这不是你认识的 Next.js」。写 web 代码前先读 `apps/web/node_modules/next/dist/docs/`（注意 monorepo 下从仓库根看不到 `next` 包）。已核对的要点：

- **环境变量的加载位置是个坑**：`next dev` 只读**自身目录**（`apps/web/`）下的 `.env`，读不到仓库根的。本仓库把 `.env` 放在根（runner 用 `--env-file-if-exists=../../.env` 读它），因此 `apps/web/.env` 是一个指向 `../../.env` 的**软链接**，两端共用同一份、不抄两遍密钥。软链接被 gitignore 忽略，**新克隆仓库后必须手动重建**：`ln -sfn ../../.env apps/web/.env`。生产 Docker 里环境变量由 compose 注入，不涉及此问题。
- **`middleware.ts` 已改名 `proxy.ts`**，导出的函数名也从 `middleware` 改为 `proxy`；`proxy` 只支持 nodejs 运行时。**做管理员登录鉴权时必须用 `proxy.ts`。**
- **`cookies()` / `headers()` / `params` / `searchParams` 必须 `await`**，同步访问在 16 里已彻底移除。
- `next lint` 已移除，`next build` 不再跑 lint；要 lint 用 Biome 或直接调 ESLint。
- `serverRuntimeConfig` / `publicRuntimeConfig` 已移除，用环境变量。
- 仍然有效（已实测）：`export const dynamic = 'force-dynamic'`、Route Handler 的 `GET/POST(req: Request)` 签名、`next.config.mjs` 的 `transpilePackages` 与 `serverExternalPackages`。

## ⚠️ 登录受 reCAPTCHA Enterprise 保护（2026-08-19 实测，重大约束）

`npm run recon` 实测登录页得到的结论，与 2023 初版完全不同：

- 登录已迁到**独立 OAuth/OIDC 授权服务器** `auth.cosme.net`（`response_type=code&scope=openid...`），不再是 www 站内的简单表单。
- 表单含隐藏域 **`input[name="recaptchaEnterpriseToken"]`** ——即 reCAPTCHA Enterprise，无可见挑战，属**分数制隐形风控**；另有 `_csrf` 令牌。
- 实测到的真实选择器：`#loginId`、`#password`、`input[type="submit"]`；并有默认勾选的「次回から自動でログイン」。

**因此本项目不做自动填密码登录。** 脚本化提交等于试图绕过机器人检测，违反站点条款且极易导致账号被标记——这条不是技术选择，是红线。

**采用方案**：`npm run login` 打开可见窗口由**人工**登录一次，会话随持久化 profile 保留，自动化复用之；`npm run login -- --check` 检查会话有效性，失效时经 Bark 通知人工重新登录。这与作者 ledger-helper 处理网银二次验证的做法一致。

会话有效性判断有个坑：**不能只看是否被重定向到授权服务器**——实测 brandfanclub 页未登录时照样返回 200、只渲染未登录版本，那样判断会一律误报为已登录。可靠依据是页面上还有没有 `a[href*="/isauth/login/"]` 登录入口。

### 对部署位的影响（推翻此前结论）

前一日的 curl 探测只验证了**未登录页面**的 IP 信誉，得出「VPS 可行」的初步结论。现在看，**真正的关口是登录**：reCAPTCHA Enterprise 会给无头浏览器 + 数据中心 IP 打低分，且「人工登录一次」这个前提在无头 VPS 上很别扭（要 VNC 或远程调试才能操作窗口）。**因此天平明显偏向 Mac mini 部署**（住宅 IP + 可见窗口人工登录 + 会话长期保留）。pull 模型让这个切换只是改配置，不动代码。

## IP 探测结论（2026-08-18，仅限未登录页面）

从 VPS（Vultr 东京，数据中心 IP）对 @cosme 做只读 curl 探测：首页与两个奖品列表页**全部 HTTP 200**，返回完整真实内容，**无验证码 / Cloudflare 挑战 / 拦截页特征**。初步结论：**@cosme 未对该数据中心 IP 做黑名单拦截，VPS 无头部署可行**。

⚠️ 此结论的边界：curl 只验证了 **IP 信誉**，未验证 **浏览器指纹 / TLS 指纹 / JS 挑战**，也未验证**登录**这一最敏感动作。正式定案仍需在 VPS 上跑一次 `npm run probe`（真 Playwright 无头）并完成一次登录。若登录环节被拦，再切 Mac mini（runner 是 pull 模型，切换只改部署不改代码）。

## 抽奖流程实测结论（2026-08-19，已完整跑通一次投递）

```
详情页 ──a[onclick]──> /isauth/addinfo/… ──> /enquete/confirm ──POST──> is-enq.cosme.net 问卷 ──send──> page=end
```

- **「応募する」不是按钮而是 `a[onclick="location.href='…'"]`**，直接提 URL 导航比模拟点击稳。⚠️ 内层问卷地址是 **URL 编码**的（`%2Fenquete%2F`），所以要认未编码的 `/isauth/addinfo/` 段——写 `a[onclick*="/enquete/"]` 会永远匹配不到（已踩过）。
- **问卷跑在独立主机** `is-enq.cosme.net/app/usr/ans/ans_pc.php`（PHP 引擎），与 www 站不同。
- **字段命名有规律**：题目 `q<序号>_<问卷ID>_<组号>_<类型后缀>`（`_r`=radio）；个人资料统一 `prof_*`。**初版 Java 2023 年写的 `select[name=prof_010_job1]` 至今有效**，且职业选项是「自営業・自由業」（中点）而初版硬编码斜杠——当年那个 try/catch 兜底现在正好用上。
- **确认页会显示账号已登记的姓名/住址/电话，但问卷里又会问一遍** `prof_001_name`，故设置页录的个人资料确实要用。
- **投递全程无 reCAPTCHA**，风控只在登录环节。
- ⚠️ **@COSME 任何页面都不标注「已应募」**：投递成功后详情页照样显示「応募する」，重走入口也照样进确认页。**因此去重完全是我们的责任**（`account_presents.status`），控制面派任务前必须先查库，且任务重试必须幂等。
- 列表卡片结构：`<li>` 内 `p.img > a > img`（图）、`dl > dt > a`（品牌）、`dl > dd > a`（标题+期间）；图片 URL 可由 ID 构造 `cache-cdn.cosme.net/media/monitor/<ID>/<ID>.png`。
- ⚠️ **`brandfanclub/present` 登录后仍无任何 `present_id` 链接**——它是另一种结构（可能需加入具体品牌粉丝俱乐部）。这正是「多类别多模式」的活例子，待其单独实现或走未知模式反馈。

## 批次编排与人工介入（已实现并实测）

- **事件驱动，不做状态机**：「跑一轮」＝`POST /api/runs` 给每个启用账号入队 scan；scan 上报成功后 `applyReport` 自动派发该账号 pending 奖品的 draw（`lib/dispatch.ts`）。控制面不维护「批次进行到第几步」，崩溃重启不会留半吊子批次。
- **合规节奏放在 runner 侧**：领完一个 draw 会等「奖品间隔」再取下一个，这样无论任务怎么入队都不会连珠炮式投递。
  **节奏参数在设置页「投递节奏」可改**（存 app_settings，runner 心跳后拉取 ≤15 秒生效）；
  `PACING` 只是默认值（奖品间隔 1~4 秒，2026-08-22 按用户决定从 4~12 秒调低）。
  **单批数量上限（原 30）已按用户决定取消（2026-08-22）**——合规靠节奏不靠批次大小；
  一次「仅抽取/跑一轮」会派发全部待投递，cron 每 12h 的自动轮同理。
- **人工选择闭环**：runner 返回 `needsChoice` → `/api/runner/report` 发 Bark（`url` 深链接到 `/choices/<presentId>?account=<id>`）→ 用户在手机上选 → `POST /api/choices/:presentId` 记录选择、状态回 pending、派发带 `resolvedChoices` 的新 draw → runner 重跑完成。重复提交返回 409。
- **僵死任务回收**（`reclaimStaleJobs`）：running 超过 15 分钟视为 runner 崩溃，标记 failed
  并把 `account_presents` 一并标成 failed + 「结果未知，请人工确认」。
  **刻意不自动重排 draw**——崩溃时无从查证那次投递是否已提交（@COSME 不标注「已应募」），
  自动重试等于可能重复投递，故交人工判断。宁可漏一次，不可重复投。
  - ⚠️ **调用点不能只挂在 `next-job` 上**（原先就是，踩过）：那条路径要等 runner 来领任务
    才触发，而 runner 崩掉时恰恰没人来领，任务就永远挂在 running。控制台每次渲染也调一次。
- **「结果未知」必须有回话的地方**（`/api/presents/:id/resolve` + `resolve-buttons.tsx`）：
  投递中断后控制面只能标「结果未知，请人工确认」，真相只有人去原页面看才知道。
  原先界面只提示、不接受回话——用户看完了也没处告诉它，提醒就永远挂着（用户为此提过）。
  现在给三个动作：**看原页面 / 已投过了（写成 drawn，进去重防线）/ 没投出去（回 pending 并立刻派单）**。
  重投沿用上次已解析的人工选择，免得又要在手机上选一遍。
- **已应募是可以自动识别的**（`DrawStatus.alreadyEntered`，2026-08-21 结论，推翻此前判断）：
  - **入口与确认页确实看不出来**——投递成功后详情页照样显示「応募する」，重走入口照样
    进确认页。这一点没错，`account_presents` 仍然是防重复投递的第一道防线。
  - **但问卷页会摊牌**：落到 `is-enq.cosme.net/.../ans_pc.php` 之后**题目为 0、
    没有 `[name=send]`**，站点在这里显示抽選/已应募的界面。
    实测证据：`12057` 于 08-19 08:54 投递成功，08-21 07:41 重走同一条流程，
    证据存 `docs/research/redraw-12057.json`：「flow=is-enq、surveyUrl 是 ans_pc.php、
    题数 0、提交按钮 null」。⚠️ 它当时把 harvest 的完整数据集 `surveys.json` 覆盖掉了
    （--drawn/--id 的窄范围运行**共用同一个输出文件**），完整集已从 git 恢复——
    窄范围实验以后应另存文件，别动主数据集。
  - ⚠️ **这条证据当时就在库里，日志也打过「未取到题目（可能已应募）」，我读成了采集失败**，
    然后基于「站点不给任何痕迹」的错误前提去做人工确认流程。**先翻自己的数据集再下结论。**
  - 判据**只用结构、不用文案**：题目为 0 且无送信控件 → `alreadyEntered`，什么都不提交。
    文案（`DUPLICATE_HINTS`，含「抽選」「当選」等）只作旁证记进研究数据，不参与判定。
    原来那半张单子里一个「抽選」都没有，光靠文案本来就会漏。
  - **present-blog 路线：问卷再次出现 = 上一次确实没投出去**（用户确认的领域事实，
    2026-08-22）。PB3653 于 08-21 点击超时后我曾推断「表单其实已提交」——**错了**：
    08-22 重投时确认页、问卷原样可走并提交成功，按上述事实即 08-21 那次是真失败。
    推论：present-blog 重跑不存在重复应募风险（已应募的不会再给问卷）；
    判定维持「题目与提交控件都缺 → alreadyEntered」，有提交控件就照常投。
- **因此「投递中断」默认自动重排，不再必须人工确认**（`reclaimStaleJobs`，策略 08-21 改过）：
  重跑最多提交一次——崩在送信前则补完，崩在送信后则落到空问卷页判成 `alreadyEntered`。
  - 唯一要防的是**崩溃循环**（同一奖品反复把 runner 打挂 → 反复走确认页 POST）：
    累计被回收 `MAX_RECLAIM_RETRIES`(2) 次后停手、标 failed 交人工。
  - 人工裁决入口保留作逃生门（见上一条）。
- `applyReport` 的两个坑（08-21 修）：`drawnAt` 原先写成 `status==='drawn' ? now : null`，
  等于**后续任何一次上报都会抹掉投递时间**；`error` 原先不清理，成功之后界面上还挂着
  上一次的失败原因。现在 drawnAt 非 drawn 时保留原值，drawn/alreadyEntered 时清 error。
- **runner 状态显示：`busyJobId` 是快照，不是现状**。心跳行里的 `busyJobId` 是上次心跳
  那一刻的情况，直接照抄会渲染出自相矛盾的一行 `⚪️ 离线 · mac-mini · 执行中`（踩过）。
  判定集中在 `lib/runner-status.ts`：
  - 「执行中 / 空闲」**只在在线时才成立**；离线时该回答的是「多久没心跳了」。
  - 离线且掉线时还捏着任务 → 额外提示「那次投递结果未知」。这个判断看的是
    **那个任务现在是否还挂在 running**，不是 busyJobId 存不存在——否则回收之后
    提示会永远挂着不消。控制面**不回头改写 `runner_state`**（那是 runner 自己报的，
    解释发生在读取侧）。
  - 离线且有排队任务 → 明说「N 个任务在排队，等 runner 上线才会开始」。
    否则界面上只有「待投递 130」，看着像在跑，实际什么都不会发生。

### 实测踩过的坑（勿重蹈）

- **确认页 POST 后有客户端跳转**：点击送出那一刻 `page.url()` 仍是 `/enquete/confirm`，之后才跳到 `is-enq`。立刻判断 URL 会误判为失败，必须 `waitForURL`。
- **不能用「正文含『必須』」判断送信失败**：问卷正文本身就印着「（ * は必須回答です。）」这句说明。改为看「是否还停在问卷表单上」（`[name=send]` 是否仍存在）。
- **送信按钮有两种**：`input[type=submit]` 与 `input[type=image]`（图片按钮），都带 `name="send"`，故按 name 定位而非 type。
- **失败的 draw 也必须回写 `account_presents`**：原先 `applyReport` 见 `ok=false` 就提前 return，导致失败在界面上完全看不见、记录永远停在 pending。
- **Chrome 单例锁**：runner 被强杀后 `profile/Singleton*` 残留，下次启动会**无限等待**（任务永远卡 running）。`browser.ts` 已加 30 秒启动超时 + 失败后清锁重试一次。

## 期间必须归一化（`@cosme/core` 的 `normalizePeriod`）

站点同一个期间有**四五种记法**（都实测遇到过）：

| 位置 | 写法 |
| --- | --- |
| 列表页 | `8/19～9/15` |
| タイアップ页 | `8月19日（水）～9月15日` |
| 详情页 | `応募受付：8/17～8/23` |
| 部分页面 | `＜応募期間＞8月12日(火)～8月25日` |

一律用 `normalizePeriod()` 折成 `M/D～M/D` 再存与比较。不归一化的后果实测过：
audit 把同一期间报成「不一致」**79 次**。`isPeriodExpired()` 用于跳过过期奖品
（只有月/日没有年份，跨年按「结束月比当前月小很多」推断为次年）。

## 奖品字段语义（别再混用）

`presents` 表的展示字段拆成三列，各有明确语义——曾把「数量 · 文案」塞进展示为期间的
`description`，界面上就出现了「期间：計5名様現品 · うるおいケアしながら…」：

- `period` —— **只放日期区间**（`8/17～8/23`）。取不到就留 null，**不要用别的内容凑**。
- `quantity` —— 数量与形式，**必须经 `normalizeQuantity()` 归一**成 `計N名様[・形式]`
  （`計500名様`、`計20名様・現品`）。站点原始写法实测 **28 种**（`20名` / `10名様` /
  `計20名様現品` / `現品200名様` …），并排显示时看着像三套不同字段。
  形式（現品 / サンプル / モニター）**刻意保留**：現品是正装、サンプル是试用装，
  价值差很远，是内容不是格式噪音。`各N名様`的「各」也保留（与「計」语义不同）。
  一次性整理脚本：`npm run fix:quantity [-- --write]`（干跑默认不改库）。
- `tagline` —— 一句话文案

三种来源的期间表述各不相同（normal 在列表页括号里、详情页反而没有；另两种在详情页
「応募受付：」）。列表页取不到的由 `npm run audit` 从详情页补。

**`npm run audit [--fix]`** 是数据核查工具：逐个访问奖品详情页，以页面为真值与库里
逐项比对（期间/数量/图片/是否仍开放应募），只读、**绝不点投递按钮**。
库里字段改了形状之后应当跑一次。

## 操作授权（用户明令，2026-08-23）

**任何会触发真实投递的动作——派发、重跑、重置状态后再派——一律先征得用户同意，
不得以「延续既有意图」为由自行执行。** 只读调查、代码修改、数据修正（不触发流程）不在此限。

## 合规底线（不可逾越）

自动化参与 @COSME 抽奖大概率违反其利用規約。红线：**单账号自用、低频、操作至少人类速度、随机延迟**（`@cosme/core` 的 `PACING`）。任何「提速」需求都以此为上限；不上激进指纹伪装（单账号低频，行为自然即最好伪装）。

## 启动方式（写清楚交用户执行，不要代跑）

```bash
# 安装（仓库根，workspaces 一次装全）
npm install

# 配置环境变量（照 .env.example 建根 .env），并建软链接让 Next 也能读到
cp .env.example .env    # 然后填 ADMIN_PASSWORD，用 openssl rand -hex 32 生成各密钥
ln -sfn ../../.env apps/web/.env

# IP 探针：决定 runner 部署位（先跑这个）
RUNNER_HEADLESS=false npm run probe   # 有头对照
npm run probe                          # 无头，模拟 VPS 形态

# 开发
npm run web        # 控制面 next dev（5173/3000）
npm run runner     # 执行器主循环

# DB 迁移
npm run db:generate --workspace @cosme/web
npm run db:migrate  --workspace @cosme/web
```
