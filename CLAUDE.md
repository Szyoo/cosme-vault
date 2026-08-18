# CLAUDE.md

本文件供 Claude Code 使用。项目说明、代码约定、契约与合规底线的**唯一来源**是 AGENTS.md，此处直接引入，不要复制内容。

@AGENTS.md

## Claude Code 专项提醒

- 本仓库没有测试和 lint 命令可跑。改完代码自己核对语法、导入路径、类型；不要声称验证过实际没验证的东西。
- 不要主动执行 `npm install` / `next build` / `drizzle-kit` / `docker` / `playwright install`。需要时把命令写清楚交用户。
- Node 26 原生跑 TS：runner 直接 `node src/x.ts`，无构建步骤。跨包 import 走 workspace（`@cosme/contract`、`@cosme/core`）。
- **改跨进程数据形状**：只改 `packages/contract`，三端共用；同时更新 AGENTS.md 的「三方契约」小节。web 的 route 与 runner 的 handler 必须成对改。
- 选择器改动集中在 `packages/core/selectors.ts`，逐条标 TODO(2026) 直到 inspect 校验通过再去标记。
- **合规底线不可逾越**：单账号、低频、人类速度、随机延迟。任何提速需求以此为上限。
- 凭证 / 密钥绝不落代码或提交，只经 `.env` / Docker secret。
