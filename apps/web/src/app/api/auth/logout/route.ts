/** POST /api/auth/logout —— 退出登录。 */
import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth.ts";

export async function POST(): Promise<NextResponse> {
  await destroySession();
  return NextResponse.json({ ok: true });
}
