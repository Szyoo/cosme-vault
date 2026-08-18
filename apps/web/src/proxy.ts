/**
 * 全站访问门禁。
 *
 * ⚠️ Next 16：本文件旧名 `middleware.ts`，导出函数旧名 `middleware`，均已改名；
 * `proxy` 只支持 nodejs 运行时（不可配置为 edge）。
 *
 * 放行清单：
 * - `/api/runner/*`  runner 用 Bearer token 自行鉴权（不走会话 cookie）
 * - `/api/auth/*`    登录接口自身必须公开，否则「登录需要先登录」死锁
 * - `/login`         登录页
 * 其余一律要求已登录，未登录重定向到 /login。
 */
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySession } from "@/lib/crypto.ts";

const PUBLIC_PREFIXES = ["/api/runner/", "/api/auth/", "/login", "/_next/", "/favicon.ico"];

export function proxy(req: NextRequest): NextResponse {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const user = verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (user) return NextResponse.next();

  // cron 容器没有浏览器会话，只能带 CRON_TOKEN；必须在此放行，
  // 否则门禁会在路由的双通道校验之前就把它拦掉。
  const cronToken = process.env.CRON_TOKEN;
  if (cronToken && req.headers.get("authorization") === `Bearer ${cronToken}`) {
    return NextResponse.next();
  }

  // API 请求返回 401，页面请求重定向到登录页
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
