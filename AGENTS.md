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
- **结果（runner → web）**：`JobReport { ok, outcome, error, artifacts }`，`outcome` = `ScanResult | DrawResult | InspectResult`
- **人工介入**：`DrawResult.status = 'needsChoice'` 时带 `PendingChoice[]`，用户在网页选完 → 以 `resolvedChoices` 恢复 `DrawJob` 重跑
- **传输层**：runner GET `/api/runner/next-job`（长轮询）、POST `/api/runner/{report,log,heartbeat}`，全部 Bearer `RUNNER_TOKEN`

## 已知现状与待办

- **draw 与 inspect 已实现并跑通一次真实投递（2026-08-19，奖品 12057）；scan 待实现。**
- **流程模式注册表（重要架构）**：`apps/runner/src/cosme/patterns/`。@COSME 奖品分多类别、每类多模式、DOM 各不相同，故每个模式是一个实现 `FlowPattern` 的模块，自己回答「这一页是不是我认识的」。加新模式只需写一个文件 + 加进 `patterns/index.ts` 的 `PATTERNS` 数组（顺序即优先级）。
- **未知模式反馈机制**：所有模式都不认领时**安全中止、绝不瞎点**，返回 `status: 'unknownPattern'` 并附 `PatternDiagnostics`（URL / 标题 / 全部可交互元素与建议选择器 / 正文摘要 / 各模式的拒绝原因），同时存截图与 HTML 快照，落库到 `account_presents.diagnostics`。据此补 pattern 基本不用再上站点复现。
- **已实现的唯一模式 `is-enq-survey`**：确认页 → `is-enq.cosme.net` 的 PHP 问卷 → `input[name=send]` 送信。
- **选择器校验工具已就绪**：`npm run recon -- <url> [--form]` 列出页面全部可交互元素与建议选择器（只读、不提交表单，对账号零风险）；需登录态的页面先跑 `npm run login`。登录相关选择器已实测填入，`PRESENT` 与 `SURVEY` 仍是 TODO(recon)，待建立会话后继续。
- **`packages/core/selectors.ts` 的 URL 已实测确认（2026-08-18，从 VPS）**：奖品列表真正的两个来源是 `/brandcollection/present/`（未登录可见）与 `/brandfanclub/present`（必须登录），2023 年记的 `/present/` 只是导航页；奖品详情形如 `/brandcollection/present/detail/present_id/<ID>`（用正则提 ID 比认 class 稳）；登录走集中式 `isauth` 网关而非独立表单页；页面编码是 **Shift_JIS**。**表单与按钮类选择器仍全是 TODO(inspect)**——匿名 curl 只能看到未登录视图，需登录后用 inspect 任务校验。
- **鉴权与凭证加密已完成并实测通过**：`src/proxy.ts` 全站门禁（放行 `/api/runner/*`、`/api/auth/*`、`/login`，以及带正确 `CRON_TOKEN` 的请求——cron 无会话，必须在门禁层放行，否则路由的双通道校验根本执行不到）；`src/lib/crypto.ts` 用 Node 内置 crypto 实现 AES-256-GCM 凭证加密 + scrypt 密码哈希 + HMAC 会话签名（**刻意不用 bcrypt，避免原生依赖**——原生模块正是本项目在 Node 26 踩过的坑）；`src/lib/auth.ts` 首次登录按 `ADMIN_USERNAME/ADMIN_PASSWORD` 自动建号。
- **账号管理与凭证录入已完成并实测通过**：设置页 `src/app/settings/page.tsx` + `/api/accounts` CRUD + `/api/accounts/:id/credentials`。语义：**留空字段=不改动**（可只改密码），列表接口只返回「哪些字段已填」绝不回显值，明文只存在于录入那一次请求。
- **runner 取凭证走独立端点** `/api/runner/credentials?accountId=`（Bearer RUNNER_TOKEN）。**刻意不把凭证塞进任务载荷**——那会把明文写进 jobs 表并留在历史里。
- **奖品页 / 记录页 / 奖品选择页（Bark 深链接目标）仍待建**；登录页与设置页为最简版，视觉待统一到 @szyyw/design。
- **DB 迁移**用 `drizzle-kit generate/migrate`，迁移文件进 `apps/web/drizzle/`（首版 `0000_sticky_kate_bishop.sql` 已生成并跑通）。drizzle-kit 直连 DB 不经 `src/db/index.ts`，故 `db:migrate` 脚本里带 `mkdir -p data`。
- **部署 compose / Dockerfile**：runner 的 Dockerfile 已备；web 的 Dockerfile 与 vps compose 待补（照抄 ledger 模式，容器不 publish 端口、只挂 Caddy ingress 网络）。

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
