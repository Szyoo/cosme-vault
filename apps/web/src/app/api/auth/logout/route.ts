/**
 * POST /api/auth/logout —— 退出登录。
 *
 * 门户 SSO 打开时：本地 cookie 照清（无害），并告诉前端去门户——真正的登录态在门户，
 * 退出要在那边做。前端目前没有调用方；返回 JSON 而非 302，fetch 调用方按 `redirect` 跳。
 */
import { NextResponse } from "next/server";
import { ssoEnabled } from "@szyyw/auth";
import { destroySession } from "@/lib/auth.ts";
import { PORTAL_ORIGIN } from "@/lib/sso.ts";

export async function POST(): Promise<NextResponse> {
  await destroySession();
  if (ssoEnabled()) return NextResponse.json({ ok: true, redirect: PORTAL_ORIGIN });
  return NextResponse.json({ ok: true });
}
