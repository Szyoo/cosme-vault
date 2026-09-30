/**
 * POST /api/auth/password —— 修改管理员密码。
 *
 * ⚠️ `/api/auth/*` 在门禁（proxy.ts）里是**公开放行**的（登录接口必须公开），
 * 所以这里必须自己校验会话，不能指望门禁。
 *
 * 为什么需要这个入口（2026-09-30）：管理员账号只在**首次登录**时按 `.env` 的
 * ADMIN_PASSWORD 建号，之后校验一律看数据库里的哈希——**改 `.env` 没用**，
 * 旧密码照样能登。而当时的密码是字面上的 `password`，必须有地方能真正改掉。
 *
 * 成功后三件事：写新哈希 → 换会话纪元（**所有旧会话立刻作废**，弱密码期间若有人
 * 登进来过也被踢出）→ 给当前这台设备重新签发会话，免得改完自己也被踢。
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema } from "@/db/index.ts";
import { authenticate, createSession, currentUser } from "@/lib/auth.ts";
import { hashPassword, rotateSessionEpoch } from "@/lib/crypto.ts";
import { clientIp, recordFailure, recordSuccess, waitSeconds } from "@/lib/login-guard.ts";
import { getT } from "@/i18n/server.ts";

/** 新密码最短长度：`password` 这种 8 位常见词正是事故起点 */
const MIN_LEN = 10;

const Body = z.object({ current: z.string().min(1), next: z.string() });

export async function POST(req: Request): Promise<NextResponse> {
  const t = await getT();
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  const { current, next } = parsed.data;

  // 与登录共用防暴力：会话被盗时，不能拿这个口子高速试当前密码
  const ip = clientIp(req);
  const wait = waitSeconds(ip);
  if (wait) return NextResponse.json({ error: t.api.tooManyAttempts(wait) }, { status: 429 });

  if (!authenticate(user, current)) {
    recordFailure(ip);
    return NextResponse.json({ error: t.settings.pwWrongCurrent }, { status: 403 });
  }
  recordSuccess(ip);

  if (next.length < MIN_LEN) {
    return NextResponse.json({ error: t.settings.pwTooShort(MIN_LEN) }, { status: 400 });
  }
  if (next === current) {
    return NextResponse.json({ error: t.settings.pwSame }, { status: 400 });
  }

  db.update(schema.adminUsers)
    .set({ passwordHash: hashPassword(next) })
    .where(eq(schema.adminUsers.username, user))
    .run();
  rotateSessionEpoch();
  // 纪元已换，当前 cookie 也失效了——立刻用新纪元重签一张给这台设备
  await createSession(user);

  return NextResponse.json({ ok: true });
}
