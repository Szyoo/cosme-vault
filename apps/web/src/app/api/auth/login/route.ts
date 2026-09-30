/** POST /api/auth/login —— 管理员登录。 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, createSession } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";
import { clientIp, recordFailure, recordSuccess, waitSeconds } from "@/lib/login-guard.ts";

const Body = z.object({ username: z.string().min(1), password: z.string().min(1) });

export async function POST(req: Request): Promise<NextResponse> {
  // 报错也按当前语言返回（前端直接把 error 显示出来）
  const t = await getT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: t.api.badRequest }, { status: 400 });
  }
  // 防暴力：越错越慢、永不锁死（见 lib/login-guard.ts）。
  // ⚠️ 没到放行时刻**连密码都不校验**——否则等待形同虚设。
  const ip = clientIp(req);
  const wait = waitSeconds(ip);
  if (wait) return NextResponse.json({ error: t.api.tooManyAttempts(wait) }, { status: 429 });

  const { username, password } = parsed.data;
  const user = authenticate(username, password);
  if (!user) {
    recordFailure(ip);
    // 不区分「用户不存在」与「密码错误」，避免账号枚举
    return NextResponse.json({ error: t.api.badCredentials }, { status: 401 });
  }
  recordSuccess(ip);
  await createSession(user);
  return NextResponse.json({ ok: true, username: user });
}
