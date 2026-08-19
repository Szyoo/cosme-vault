# cosme-runner（常驻 Mac mini 的抽奖执行器）

控制面跑在 VPS，浏览器自动化跑在这里。

```
iPhone/浏览器 → cosme.szyyw.xyz (VPS) ←──出站长轮询──  Mac mini: runner → Playwright → @COSME
```

**pull 模型**：runner 主动出站连控制面拉任务、回传结果，**不开任何入站端口、不依赖 tailscale**。
所以放在家里 NAT 后面也能跑，只要能出站 HTTPS。

## 为什么在 Mac mini 而不是 VPS

@COSME 的登录受 **reCAPTCHA Enterprise**（分数制隐形风控）保护。本项目**不做自动填密码登录**——
那等于试图绕过机器人检测。改为**人工登录一次 + 持久化 profile 复用会话**，因此需要：

- 住宅 IP（数据中心 IP 在风控打分上吃亏）
- 能弹出可见浏览器窗口让人操作
- 长期保留的 profile 目录

投递流程本身（问卷、送信）实测**无 reCAPTCHA**，所以只有登录这一步需要人。

> 仍想在 VPS 无头跑？`Dockerfile` 已备（代码完全一样，pull 模型让部署位只是配置）。
> 但要先解决「怎么在无头机器上人工登录一次」。

## 安装

前提：Node 26+、已装 Google Chrome、仓库根已 `npm install`。

```bash
# 1. 配置（仓库根）
cp .env.example .env      # 填 CONTROL_PLANE_URL 与 RUNNER_TOKEN（与 VPS 上一致）
ln -sfn ../../.env apps/web/.env   # 只有同机跑控制面时才需要

# 2. 装浏览器
npx playwright install chromium

# 3. 人工登录一次（会弹出可见窗口，你自己输账号密码）
npm run login

# 4. 装成开机自启的 LaunchAgent
cd apps/runner && ./install.sh
```

## 日常

```bash
tail -f apps/runner/logs/runner.log      # 看日志
npm run login -- --check                 # 查会话是否还有效
npm run login                            # 会话失效时重新登录
launchctl bootout gui/$(id -u)/xyz.szyyw.cosme-runner   # 停止
```

会话失效时控制面会经 Bark 通知你。平时不用管。

## 调试工具

```bash
npm run recon -- <url> [--form] [--headed]   # 列出页面全部可交互元素与建议选择器
npm run probe                                 # IP 探针（只读访问几个页面，看是否被拦）
```

`recon` 只读、不提交任何表单，对账号零风险；需登录态的页面会自动复用 profile 里的会话。

## 目录

```
src/index.ts          主循环：心跳 → 长轮询领任务 → 分发 → 上报
src/cosme/draw.ts     投递编排（选模式 + 兜底）
src/cosme/patterns/   流程模式注册表 ← 加新奖品类别就在这里加文件
src/cosme/scan.ts     奖品扫描
src/login.ts          人工登录助手
profile/              持久化浏览器 profile（含会话，勿提交、勿删）
artifacts/            失败与未知模式的现场（截图 / HTML / 元素清单）
```

遇到没见过的页面版式时，runner **不会瞎点**——它会安全中止并把现场回传控制面
（截图 + HTML + 全部可交互元素与建议选择器），据此在 `patterns/` 加一个新模式即可。
