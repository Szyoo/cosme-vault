/** POST /api/auth/login —— 管理员登录。 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth.ts";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "请求格式非法" }, { status: 400 });
  }
  const { username, password } = parsed.data;
  const user = authenticate(username, password);
  if (!user) {
    // 不区分「用户不存在」与「密码错误」，避免账号枚举
    return NextResponse.json({ error: "用户名或密码错误" }, { status: 401 });
  }
  await createSession(user);
  return NextResponse.json({ ok: true, username: user });
}
