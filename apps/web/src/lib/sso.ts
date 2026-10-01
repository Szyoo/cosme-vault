/**
 * 门户 SSO（szyyw.xyz）接入的公共小工具。
 *
 * 开关：`SZYYW_SSO=1`（@szyyw/auth 的 `ssoEnabled()`）。打开后，身份**只认** Caddy 门禁
 * 注入的 `X-User` / `X-Role` / `X-Portal-Sub`，本地会话 cookie 不再参与判定。
 *
 * ⚠️ 这些头可信的前提：容器没有任何 `ports:`，只能经 Caddy 进来，而 Caddy 的 `(sso)`
 * 片段会先剥掉客户端自带的同名头。Caddy 侧对 cosme 的门禁没生效前**不要**打开开关。
 *
 * 关闭时（默认）本文件的函数都不会被走到，行为与接入前完全一致。
 */
export const PORTAL_ORIGIN = (process.env.PORTAL_ORIGIN ?? "https://szyyw.xyz").replace(/\/$/, "");

/**
 * 还原浏览器看到的绝对地址（登录后要回到这里）。
 * Caddy 反代时带 `x-forwarded-proto` / `x-forwarded-host`；没有就退回 Next 自己解析的 URL
 * （容器内直连时会是 0.0.0.0:3000 之类，仅用于调试）。
 */
export function externalUrl(headers: Headers, fallback: URL, pathAndQuery: string): string {
  const proto = headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (proto && host) return `${proto}://${host}${pathAndQuery}`;
  return new URL(pathAndQuery, fallback).toString();
}

/** 本站登录页被访问时的回跳地址：优先 PUBLIC_BASE_URL（compose 里固定为公网域名），否则按请求头还原 */
export function siteUrl(headers: Headers, fallback: URL, pathAndQuery: string): string {
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
  return base ? base + pathAndQuery : externalUrl(headers, fallback, pathAndQuery);
}
