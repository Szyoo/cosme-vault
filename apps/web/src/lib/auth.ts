/**
 * 管理员鉴权。
 *
 * 单用户模型：库里还没有账号时，用 ADMIN_USERNAME / ADMIN_PASSWORD 首次登录自动建号
 * （与 finance-ledger 一致），之后在设置页改。
 *
 * ⚠️ Next 16：`cookies()` 必须 await，同步访问已被移除。
 */
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { SESSION_COOKIE, hashPassword, signSession, verifyPassword, verifySession } from "@/lib/crypto.ts";

/** 校验用户名密码；首次登录（库空）时按环境变量自动建号。成功返回用户名 */
export function authenticate(username: string, password: string): string | null {
  const existing = db.select().from(schema.adminUsers).limit(1).all();

  if (existing.length === 0) {
    // 库里还没有账号：只接受与环境变量一致的凭据，并落库
    const envUser = process.env.ADMIN_USERNAME;
    const envPass = process.env.ADMIN_PASSWORD;
    if (!envUser || !envPass) return null;
    if (username !== envUser || password !== envPass) return null;
    db.insert(schema.adminUsers)
      .values({ id: randomUUID(), username: envUser, passwordHash: hashPassword(envPass) })
      .run();
    return envUser;
  }

  const user = db.select().from(schema.adminUsers).where(eq(schema.adminUsers.username, username)).get();
  if (!user) return null;
  return verifyPassword(password, user.passwordHash) ? user.username : null;
}

/** 写入会话 cookie */
export async function createSession(username: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, signSession(username), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
}

/** 清除会话 cookie */
export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

/** 读取当前登录用户名；未登录返回 null */
export async function currentUser(): Promise<string | null> {
  const jar = await cookies();
  return verifySession(jar.get(SESSION_COOKIE)?.value);
}

/** 管理接口用：未登录则抛，供 route handler 捕获后返回 401 */
export async function requireUser(): Promise<string> {
  const u = await currentUser();
  if (!u) throw new UnauthorizedError();
  return u;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("未登录");
    this.name = "UnauthorizedError";
  }
}
