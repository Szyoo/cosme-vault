# Cosme Vault

@cosme 奖品活动的抽奖辅助工具。由两部分组成：**Web 控制面**（Next.js，负责任务编排、账号与记录、推送和界面）和 **runner 执行器**（Playwright，主动向控制面拉取任务并驱动浏览器）。

```
浏览器 / 手机 ──> 控制面 apps/web (Next.js + SQLite) <──出站长轮询── runner apps/runner (Playwright) ──> @cosme
```

runner 使用 pull 模型：只需能出站访问控制面，不开任何入站端口，可以跑在家用 NAT 后面。

## 功能概览

- **奖品扫描**：汇总 @cosme 各奖品频道的活动并入库，重复扫描保持幂等，已应募的记录不会被重置。
- **多账号自动应募**：按账号逐个投递，问卷用关键词库自动作答；节奏低频、带随机延迟，参数可在设置页修改。
- **人工选择**：需要选款式或色号时任务挂起，通过 [Bark](https://github.com/Finb/Bark) 推送深链接到手机，选完后自动重投；同一奖品的选择对所有账号生效。
- **异常诊断**：遇到没识别出来的页面时安全中止，回传截图、HTML 快照和元素清单；同类异常按指纹聚合。
- **控制台**：账号 × 状态矩阵、实时运行日志（SSE）、队列与终止、应募记录、奖品库（可匿名只读访问）。
- **账号与安全**：@cosme 凭证用 AES-256-GCM 加密存储，管理员密码用 scrypt 哈希，登录失败逐次退避。
- **界面三语**：中文、日文、英文。
- **可选 SSO**：可以接入在反向代理层注入身份头的门户登录（`SZYYW_SSO=1`）。

> @cosme 登录受 reCAPTCHA 保护，本工具不做自动登录：每个账号由人在 runner 弹出的浏览器窗口里登录一次，之后复用持久化的浏览器 profile。

### 代码结构

| 路径 | 说明 |
| --- | --- |
| `apps/web` | 控制面：Next.js 16 App Router、Drizzle ORM + SQLite（better-sqlite3） |
| `apps/runner` | 执行器：Playwright，Node 26 直接运行 TypeScript，无构建步骤 |
| `packages/contract` | 控制面与 runner 共用的协议（zod schema） |
| `packages/core` | 领域逻辑：问卷关键词库、页面选择器、节奏默认值 |
| `deploy/vps/compose.yml` | 控制面与定时触发的 Docker Compose 示例 |

## 安装

需要 Node.js 26 或更高版本（`.nvmrc`）和 npm。runner 所在机器还需要 Google Chrome Beta（默认通道），或者用 Playwright 自带的 Chromium。

```bash
npm install                        # 在仓库根执行，一次安装全部 workspace
npx playwright install chromium    # 仅在使用 Playwright 自带浏览器时需要

# 在仓库根创建 .env（变量见下文「环境变量」），并让 Next 读到同一份
ln -sfn ../../.env apps/web/.env

npm run db:migrate --workspace @cosme/web   # 初始化 / 升级 SQLite 数据库
```

## 运行

### 开发

```bash
npm run web                          # 控制面 next dev，默认 http://localhost:3000
npm run login -- --account <备注名>  # 为某个账号人工登录一次（弹出可见浏览器）
npm run runner                       # 启动 runner（监听源码变化自动重启）
npm run typecheck                    # 全部 workspace 类型检查
```

先在网页的设置页添加 @cosme 账号、录入凭证和个人资料，再点「跑一轮」。数据库首次为空时，用 `ADMIN_USERNAME` / `ADMIN_PASSWORD` 登录会自动创建管理员，之后在设置页改密码。

辅助命令（都在 runner 侧运行，只读，不提交表单）：

| 命令 | 用途 |
| --- | --- |
| `npm run probe` | 检查当前 IP 访问 @cosme 是否被拦 |
| `npm run recon -- <url> [--form] [--headed]` | 列出页面全部可交互元素与建议选择器 |
| `npm run login -- --account <备注名> --check` | 检查某个账号的登录态是否有效 |
| `npm run harvest` / `npm run audit` | 采集问卷结构 / 用详情页核对库中的奖品数据 |

修改数据库 schema 后执行 `npm run db:generate --workspace @cosme/web` 生成迁移文件。

### 生产

**控制面（Docker）**：镜像以仓库根作为构建上下文，容器启动时会先自动执行数据库迁移。

```bash
docker build -f apps/web/Dockerfile -t cosme-web .
docker run -d --name cosme -p 3000:3000 -v cosme_data:/data --env-file .env cosme-web
```

`deploy/vps/compose.yml` 是一份带定时触发 sidecar 的 Compose 示例：每 `CRON_INTERVAL` 秒（默认 12 小时）用 `CRON_TOKEN` 调一次 `POST /api/runs`。示例不发布端口，假设前面有一个接入外部网络 `ingress_ingress` 的反向代理，使用时按自己的环境调整。备份时直接复制数据卷里的 `cosme.db` 即可。

**runner**：

- macOS：先 `npm run login` 完成人工登录，再执行 `apps/runner/install.sh`，把 runner 装成开机自启的 LaunchAgent，日志写在 `apps/runner/logs/`。
- 无头 Docker：`docker build -f apps/runner/Dockerfile .`。注意人工登录需要可见窗口，profile 要在有图形界面的环境里先准备好。

## 接口说明

### 鉴权

| 调用方 | 方式 |
| --- | --- |
| 浏览器 | 管理员会话 cookie（`/login`）；`SZYYW_SSO=1` 时改为反向代理注入的 `X-User` / `X-Role` / `X-Portal-Sub` |
| runner | `Authorization: Bearer <RUNNER_TOKEN>`，仅限 `/api/runner/*` |
| 定时任务 | `Authorization: Bearer <CRON_TOKEN>`，仅限 `/api/runs` 与 `/api/jobs` |

### 主要端点

| 端点 | 说明 |
| --- | --- |
| `POST /api/runs` | 跑一轮。body `{ mode?: "full" \| "scan" \| "draw", accountId? }`：`full` 先扫描再自动派发投递，`scan` 只扫描，`draw` 只投递待投递记录；`GET` 返回最近的任务 |
| `POST /api/runs/stop` | 取消所有还在排队的任务（正在执行的不受影响） |
| `POST /api/jobs` · `GET /api/jobs` | 手动入队单个任务（`kind`：`scan` / `draw` / `inspect` / `login`）· 列出最近任务 |
| `PATCH /api/jobs/batch/:batchId` | 按批次操作队列：`{ action: "cancel" \| "top" }` |
| `GET /api/events` | SSE 实时事件，控制台据此刷新 |
| `GET` · `POST /api/choices/:presentId` | 读取待选项 · 提交选择并重新派发投递（Bark 深链接落在 `/choices/:presentId`） |
| `POST /api/presents/:presentId/resolve` | 人工裁决一条「结果未知」的投递 |
| `POST /api/account-presents/status` · `/reset` | 人工改判 404 记录 · 把记录重置为待投递（不会触发投递） |
| `GET /api/diagnostics` · `PATCH /api/diagnostics/:fingerprint` | 聚合后的异常现场 · 标记为已处理（受影响的奖品放回待投递） |
| `GET` · `POST /api/accounts`，`PATCH` · `DELETE /api/accounts/:id`，`PUT` · `DELETE /api/accounts/:id/credentials` | @cosme 账号与加密凭证管理 |
| `GET` · `PUT /api/settings/pacing` | 投递节奏，runner 在下一次心跳后（15 秒内）生效 |
| `GET` · `PUT` · `POST /api/settings/bark` | Bark 配置 · 保存 · 发测试推送 |
| `GET /api/survey-captures` | 导出投递时顺带采集的问卷结构 |
| `POST /api/auth/login` · `logout` · `password` | 本地登录、登出、修改管理员密码 |

runner 端点：`GET /api/runner/next-job`（长轮询领任务）、`POST /api/runner/report`（上报结果）、`POST /api/runner/log`、`POST /api/runner/heartbeat`、`GET /api/runner/config`（节奏参数）、`GET /api/runner/accounts`、`GET /api/runner/credentials?accountId=`（按需取凭证，凭证不写进任务载荷）。数据形状以 `packages/contract/src/index.ts` 为准。

### 环境变量

两端共用仓库根的 `.env`。

| 变量 | 使用方 | 说明 |
| --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | web | 数据库里还没有管理员时用来建号，之后以设置页修改的密码为准 |
| `SESSION_SECRET` | web | 会话签名密钥（`openssl rand -hex 32`） |
| `CREDENTIAL_KEY` | web | 凭证加密主密钥（32 字节 hex），更换后需要重新录入凭证 |
| `RUNNER_TOKEN` | web + runner | runner 鉴权令牌，两端必须一致 |
| `CRON_TOKEN` | web | 定时任务令牌；不配置时 Bearer 通道一律拒绝 |
| `DATABASE_PATH` | web | SQLite 路径，默认 `./data/cosme.db`，镜像内为 `/data/cosme.db` |
| `BARK_SERVER` / `BARK_DEVICE_KEY` | web | Bark 推送；也可以在设置页配置（优先于环境变量），留空则不推送 |
| `PUBLIC_BASE_URL` | web | 推送深链接的基址，必须能从手机访问 |
| `DISPLAY_TZ` | web | 界面显示时区，默认 `Asia/Tokyo` |
| `SZYYW_SSO` / `PORTAL_ORIGIN` | web | 门户 SSO 开关与门户地址；只有反向代理会先剥掉客户端自带的身份头时才能打开 |
| `CONTROL_PLANE_URL` | runner | 控制面地址，如 `http://localhost:3000` |
| `PLAYWRIGHT_CHANNEL` | runner | `chrome-beta`（推荐）/ `chrome` / 留空使用 Playwright 自带的 Chromium |
| `RUNNER_HEADLESS` | runner | 是否无头运行；调试选择器时设为 `false` |
| `RUNNER_LOCATION` | runner | 部署位置标签，只用于在控制台显示 |
| `RUNNER_PROFILE_DIR` / `RUNNER_ARTIFACTS_DIR` | runner | 浏览器 profile 与诊断产物目录，默认 `./profile`、`./artifacts` |
