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

前提:VPS 上已有 Caddy 反代与外部网络 `ingress_ingress`(与 finance-ledger 共用)。

```bash
git clone <repo> && cd cosme-vault

# 配置。密钥用 openssl rand -hex 32 生成
cp .env.example deploy/vps/.env
vi deploy/vps/.env      # 填 ADMIN_PASSWORD / SESSION_SECRET / CREDENTIAL_KEY
                        #   / RUNNER_TOKEN / CRON_TOKEN / BARK_* / PUBLIC_BASE_URL

cd deploy/vps
docker compose up -d --build
docker compose logs -f cosme
```

容器启动时自动跑数据库迁移(见 `apps/web/entrypoint.sh`)。数据落在命名卷 `cosme_data` 的 `/data/cosme.db`。

Caddy 侧加一段(照其他项目的写法):

```
cosme.szyyw.xyz {
    reverse_proxy cosme-vault:3000
}
```

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
| `PLAYWRIGHT_CHANNEL` | — | ✅ | `chrome` 用真 Chrome |
| `RUNNER_HEADLESS` | — | ✅ | 调选择器时设 `false` 看画面 |
