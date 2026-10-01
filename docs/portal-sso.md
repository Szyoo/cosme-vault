# 门户 SSO 与匿名访客

> 部署步骤仍以 `docs/deploy.md` 为准；本文只记录 web 侧的 SSO / 匿名契约。

## 开关

`SZYYW_SSO=1` 打开门户 SSO（`@szyyw/auth` 的 `ssoEnabled()`）。关闭时（默认）一切按本地
会话 cookie 走，本文其余内容都不生效。

## 三类请求（SSO 打开时）

| 请求 | 判定 | 结果 |
| --- | --- | --- |
| 已登录 | `X-User` **且** `X-Portal-Sub` 非空（`@szyyw/auth` v0.2.0 起只有 `X-User` 视为未登录） | 与以前一样，全站可用 |
| 匿名访客 | `X-Portal-Anon: 1`、无身份头（cosme 在门户的公开站点列表里时由门卫注入） | 只放行 `/` 与静态资源 |
| runner / cron | `Authorization: Bearer …`（Caddy 不对其做 forward_auth） | `/api/runner/*` 路由自行校验；cron 走 `CRON_TOKEN` |

两类头同时出现时身份优先（`@szyyw/auth` 的规则）。

## proxy.ts 规则（SSO 下）

1. `/login` → 302 门户登录页（回跳 `PUBLIC_BASE_URL` + `next`）。
2. 放行前缀：`/api/runner/`、`/_next/`、`/favicon.ico`。**`/api/auth/*` 在 SSO 下不再公开**：
   匿名请求现在能穿过 Caddy，本地登录/改密接口在 SSO 下没有用途，公开它等于给本地管理员
   密码开一个爆破口。已登录用户仍可调用（例如 `/api/auth/logout`）。
3. 有身份 → 放行。
4. `Bearer $CRON_TOKEN` → 放行。
5. 匿名且路径在 `ANON_PAGES`（目前只有 `/`）→ 放行。
6. 其余：`/api/*` → 401；页面 → 307 门户登录（回跳当前绝对 URL，带查询串）。

## 公开外壳

`/` 在 `optionalIdentity(headers())` 为 null 时渲染 `app/landing.tsx`：标题、站点介绍
（@COSME 抽奖辅助：扫描奖品活动、按账号自动应募、Bark 推送人工选择）和「登录」按钮
（`/login` → 门户）。**落地页不查库、不显示任何个人数据**；判定在 page.tsx 里早于所有查询。
哪些真实板块对匿名公开以后再定——届时把路径加进 `proxy.ts` 的 `ANON_PAGES`，并在页面里按
`optionalIdentity()` 裁剪内容。

## 右上角工具位

`design-chrome.tsx`：应用切换器（一直挂）+ SSO 下的账户菜单 `mountAccountMenu({ portal })`
（`@szyyw/design` v0.8.0，order 6）——未登录显示「登录」弹门户小窗，登录后头像 + 用户名 / 角色 /
登出（登出走门户 `/api/logout`）。`sso` 由 layout 服务端按 `ssoEnabled()` 传入。
本地的 `POST /api/auth/logout` 仍保留（SSO 下返回 `redirect: PORTAL_ORIGIN`），前端没有调用方。

## 本地验证

```bash
npm run build --workspace @cosme/web
cd apps/web && npm run db:migrate && SZYYW_SSO=1 npx next start -p 3917
curl -si -H 'X-Portal-Anon: 1' localhost:3917/            # 200 落地页
curl -si -H 'X-Portal-Anon: 1' localhost:3917/settings    # 307 门户
curl -si -H 'X-Portal-Anon: 1' localhost:3917/api/jobs    # 401
curl -si -H 'X-User: a' -H 'X-Portal-Sub: 1' localhost:3917/  # 200 控制台
curl -si -H 'X-User: a' localhost:3917/                   # 307（缺 sub）
```
