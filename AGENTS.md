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

- **runner 的 scan/draw/inspect 是带类型的骨架**（`apps/runner/src/index.ts` 里 `throw 未实现`）。真实页面操作待把初版 Java 业务逻辑（`Draw.java` 状态机、`Fill.java` 填表、登录检测）移植进来，配合 `@cosme/core` 的关键词库。
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

## IP 探测结论（2026-08-18）

从 VPS（Vultr 东京，数据中心 IP）对 @cosme 做只读 curl 探测：首页与两个奖品列表页**全部 HTTP 200**，返回完整真实内容，**无验证码 / Cloudflare 挑战 / 拦截页特征**。初步结论：**@cosme 未对该数据中心 IP 做黑名单拦截，VPS 无头部署可行**。

⚠️ 此结论的边界：curl 只验证了 **IP 信誉**，未验证 **浏览器指纹 / TLS 指纹 / JS 挑战**，也未验证**登录**这一最敏感动作。正式定案仍需在 VPS 上跑一次 `npm run probe`（真 Playwright 无头）并完成一次登录。若登录环节被拦，再切 Mac mini（runner 是 pull 模型，切换只改部署不改代码）。

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
