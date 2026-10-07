# 部署

两端分开部署,这是 pull 模型带来的自由度:

```
控制面 → VPS (Docker + Caddy ingress)     runner → Mac mini (launchd)
```

runner 主动出站长轮询控制面,**不开入站端口、不依赖 tailscale**。

## 为什么 runner 不在 VPS

@COSME 登录受 reCAPTCHA Enterprise 保护,本项目不做自动填密码登录(见 AGENTS.md),
改为人工登录一次 + 持久化 profile 复用会话。这需要住宅 IP 与可见浏览器窗口,
故放 Mac mini。投递流程本身无 reCAPTCHA。

> `apps/runner/Dockerfile` 保留着 VPS 无头形态,代码完全相同;
> 但要先解决「怎么在无头机器上人工登录一次」。

## 一、控制面(VPS)

VPS(`ssh vultr-jp`)上的 `/opt/cosme-vault` 是本仓库的 **git clone**,由平台仓库 szyyw-platform 的
`/opt/ingress/deploy/deploy-app.sh` 统一部署(部署名 `cosme`):拉取部署分支 → `docker compose build`
→ `up -d --no-deps` → 健康检查,**失败自动回滚**到上一个镜像。

**部署分支是 `feat/monorepo-v6`(不是默认分支 `main`)。推送到它 = 上线**:VPS 上的
`szyyw-autodeploy.timer` 每 10 分钟检查一次,有新提交就跑上面的流程(Next 构建约 4 分钟)。
只改 `docs/`、`*.md`、`.github/` 的提交不会触发重建。

```bash
# 立即部署(不等 timer)
ssh vultr-jp /opt/ingress/deploy/deploy-app.sh cosme
# 回滚:部署指定标签/提交并固定在那里,固定期间自动部署跳过它;
# 修好后再跑一次不带 --ref 的命令即恢复跟随 feat/monorepo-v6
ssh vultr-jp /opt/ingress/deploy/deploy-app.sh cosme --ref <标签或提交>
# 查看各应用部署状态
ssh vultr-jp /opt/ingress/deploy/deploy-app.sh --status
```

**不要**再手动在 VPS 上 `git pull` + `docker compose build/up`:应用 compose 的项目名都是 `vps`,
手动操作容易误伤别的应用,也绕过了健康检查与自动回滚。

运行时密钥只在 VPS 的 `deploy/vps/.env`(`ADMIN_PASSWORD / SESSION_SECRET / CREDENTIAL_KEY /
RUNNER_TOKEN / CRON_TOKEN / BARK_* / PUBLIC_BASE_URL / SZYYW_SSO`,密钥用 `openssl rand -hex 32` 生成,
模板见 `.env.example`),不进仓库。

容器启动时自动跑数据库迁移(见 `apps/web/entrypoint.sh`)。数据落在命名卷 `cosme_data` 的 `/data/cosme.db`。

Caddy 站点块在 **szyyw-platform 仓库的 `caddy/Caddyfile`**(`cosme.szyyw.xyz` 块 + `import sso …`),
改那里、提交推送即生效;不要在 VPS 上直接改 `/opt/ingress/Caddyfile`。

### 共享包自动升级

`.github/workflows/upgrade-shared.yml`(main 与 `feat/monorepo-v6` 各放一份,schedule 只认默认分支上的)
每 6 小时 checkout `feat/monorepo-v6` 跑 `scripts/upgrade-shared.sh`:`@szyyw/design` / `@szyyw/auth`
上游有更新的正式 tag(`vX.Y.Z`)就改 `apps/web/package.json` + 刷新 `package-lock.json`,
再 `npm ci` → `npm run typecheck` → `next build`,全部通过才以 github-actions[bot] 推回 `feat/monorepo-v6`
(随后由 autodeploy 上线);任一步失败不推送。手动触发:
`gh workflow run upgrade-shared.yml --repo Szyoo/cosme-vault --ref main`。

**刻意不 publish 端口** —— Docker 的 iptables 会绕过 ufw,publish 就等于直接暴露公网。

### 定时触发

`cosme-cron` sidecar 每 `CRON_INTERVAL` 秒(默认 12 小时)打一次内网的 `/api/runs`。
⚠️ 合规底线要求低频,别为了多抢把间隔调小。

### 备份

SQLite 直接拷文件即可:

```bash
docker compose exec cosme sh -c 'cp /data/cosme.db /data/backup-$(date +%F).db'
```

## 二、runner(Mac mini)

见 [apps/runner/README.md](../apps/runner/README.md)。要点:

```bash
npm install
npx playwright install chromium
vi .env                  # CONTROL_PLANE_URL=https://cosme.szyyw.xyz, RUNNER_TOKEN 与 VPS 一致
npm run login            # 人工登录一次(弹出可见窗口)
cd apps/runner && ./install.sh
```

## 三、验收

1. 打开 `https://cosme.szyyw.xyz`,用 ADMIN_USERNAME/ADMIN_PASSWORD 登录
2. 设置页添加 cosme 账号并录入凭证与个人资料
3. 首页应显示 runner 🟢 在线
4. 点「跑一轮」,几分钟后奖品表应出现数据

## 环境变量对照

| 变量 | 控制面 | runner | 说明 |
| --- | --- | --- | --- |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | ✅ | — | 网页登录;库空时首次登录自动建号 |
| `SESSION_SECRET` | ✅ | — | 会话 cookie 签名 |
| `CREDENTIAL_KEY` | ✅ | — | 凭证加密主密钥,**换掉需重录凭证** |
| `RUNNER_TOKEN` | ✅ | ✅ | 两端必须一致 |
| `CRON_TOKEN` | ✅ | — | 未配则 cron 通道一律拒绝 |
| `BARK_SERVER` / `BARK_DEVICE_KEY` | ✅ | — | 留空则跳过推送 |
| `PUBLIC_BASE_URL` | ✅ | — | Bark 深链接的基址,必须公网可达 |
| `CONTROL_PLANE_URL` | — | ✅ | runner 指向控制面 |
| `PLAYWRIGHT_CHANNEL` | — | ✅ | `chrome-beta` 用正版 Chrome Beta（不与本机日常 Chrome 冲突）；`chrome` 会占住日常 Chrome |
| `RUNNER_HEADLESS` | — | ✅ | 调选择器时设 `false` 看画面 |
