/**
 * 登录后的跳转目标只接受**站内相对路径**：以 `/` 开头、且不是 `//`（协议相对地址，
 * 会跳去别的域名）或 `/\`（部分浏览器同样当成协议相对）。否则一律回首页——
 * `next` 来自 URL，谁都能构造，不校验就是开放重定向。
 */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
