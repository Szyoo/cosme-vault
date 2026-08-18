# Cosme Vault

@COSME™ 抽奖辅助工具（v6）。**Web 控制面 + Playwright 执行器**的前后端分离架构：
控制面架设在 VPS，执行器（runner）主动出站拉任务、跑浏览器自动化，需要用户选择奖品时经 Bark 推送到手机。

> AI 编码智能体请读 [AGENTS.md](AGENTS.md)（架构、三方契约、代码约定、合规底线的唯一来源）。`CLAUDE.md` 引自 AGENTS.md。

## 架构

```
iPhone/浏览器 ── cosme.szyyw.xyz (VPS: Caddy → web) ──拉取──> runner (Playwright) ──> @COSME
```

runner 用 pull 模型（主动出站长轮询），因此跑在 VPS 无头还是家里 Mac mini 都无需改代码——先在 VPS 试跑，被风控再切 Mac mini。

## 目录

```
packages/contract   三方共享协议（zod）        packages/core   领域逻辑（关键词库 / 选择器）
apps/web            Next.js 16 控制面           apps/runner     Playwright 执行器（Node 26）
docs/vendor/bark    Bark 官方 API 文档
```

## 开发

```bash
npm install          # 仓库根，workspaces 一次装全

# 先跑 IP 探针，决定 runner 部署位
npm run probe

npm run web          # 控制面 next dev
npm run runner       # 执行器
```

数据库迁移（Drizzle）：

```bash
npm run db:generate --workspace @cosme/web
npm run db:migrate  --workspace @cosme/web
```

环境变量见 [.env.example](.env.example)（凭证 / 密钥只在本地 `.env` 或生产 secret，绝不进 git）。

## 现状

前后端骨架与三方契约已就位，可跑通「入队任务 → runner 领取 → 上报」链路。
待办（详见 AGENTS.md）：runner 的抽奖业务逻辑移植、选择器 2026 校验、管理员登录、各功能页面、部署 compose。
