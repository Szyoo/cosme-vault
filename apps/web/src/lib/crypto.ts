/**
 * 加密工具：cosme 账号凭证的对称加密 + 管理员密码哈希 + 会话签名。
 *
 * 全部使用 Node 内置 `node:crypto`，不引入 bcrypt 之类原生依赖
 * （原生模块正是本项目在 Node 26 上踩过的坑）。
 */
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

/* ────────── cosme 账号凭证：AES-256-GCM ────────── */

/** 从环境变量取 32 字节主密钥（hex）；缺失或格式错时直接抛，避免静默降级为不加密 */
function credentialKey(): Buffer {
  const hex = process.env.CREDENTIAL_KEY;
  if (!hex) throw new Error("缺少 CREDENTIAL_KEY（生成：openssl rand -hex 32）");
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) throw new Error("CREDENTIAL_KEY 必须是 32 字节（64 位 hex）");
  return key;
}

/**
 * 加密任意对象 → `iv:authTag:ciphertext`（均为 hex）。
 * 用于 accounts.credentials_enc：存 cosme 账号密码与个人资料。
 */
export function encryptJson(data: unknown): string {
  const iv = randomBytes(12); // GCM 推荐 96 bit
  const cipher = createCipheriv("aes-256-gcm", credentialKey(), iv);
  const plain = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plain), cipher.final()]);
  return [iv.toString("hex"), cipher.getAuthTag().toString("hex"), enc.toString("hex")].join(":");
}

/** 解密 encryptJson 的产物；密文被篡改时 GCM 校验会抛错 */
export function decryptJson<T>(payload: string): T {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) throw new Error("凭证密文格式非法");
  const decipher = createDecipheriv("aes-256-gcm", credentialKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]);
  return JSON.parse(dec.toString("utf8")) as T;
}

/* ────────── 管理员密码：scrypt ────────── */

const SCRYPT_KEYLEN = 64;
const SCRYPT_COST = { N: 16384, r: 8, p: 1 } as const;

/** 生成 `scrypt:salt:hash`（hex） */
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, SCRYPT_KEYLEN, { ...SCRYPT_COST });
  return `scrypt:${salt.toString("hex")}:${hash.toString("hex")}`;
}

/** 恒定时间比较校验密码 */
export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split(":");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length, { ...SCRYPT_COST });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/* ────────── 会话 cookie：HMAC 签名 ────────── */

function sessionSecret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("缺少 SESSION_SECRET（生成：openssl rand -hex 32）");
  return s;
}

/**
 * 会话纪元：混进签名密钥，**改密码时换一个新纪元 → 之前签发的所有会话立刻作废**。
 *
 * 为什么需要：会话是无状态 HMAC 签名，门禁（proxy.ts）只验签名不查库，所以单改
 * 密码哈希**不会**让已有 cookie 失效——弱密码期间若有人登进来过，他的会话还能
 * 再用 30 天。
 *
 * 为什么放文件而不是数据库：门禁每个请求都要验会话，把 better-sqlite3（原生模块）
 * 拉进 proxy 的打包产物风险太大；读一个小文件只用 `node:fs`。文件与数据库同目录
 * （生产是命名卷 `/data`，重启与重新部署都不会丢）。
 *
 * 文件不存在 = 纪元为空 = 密钥就是原来的 SESSION_SECRET——**向后兼容**，
 * 没改过密码之前签发的会话照常有效。
 */
const EPOCH_FILE = join(dirname(process.env.DATABASE_PATH ?? "./data/cosme.db"), "session-epoch");

function sessionEpoch(): string {
  try {
    return readFileSync(EPOCH_FILE, "utf8").trim();
  } catch {
    return "";
  }
}

/** 换一个新纪元：调用后所有旧会话签名全部对不上 */
export function rotateSessionEpoch(): void {
  writeFileSync(EPOCH_FILE, randomBytes(16).toString("hex"), { mode: 0o600 });
}

function sessionKey(): string {
  const epoch = sessionEpoch();
  return epoch ? createHmac("sha256", sessionSecret()).update(`epoch:${epoch}`).digest("hex") : sessionSecret();
}

/** 签发会话令牌：`payloadB64.signature`，payload 含用户名与过期时间 */
export function signSession(username: string, ttlMs = 30 * 24 * 60 * 60 * 1000): string {
  const payload = Buffer.from(JSON.stringify({ u: username, exp: Date.now() + ttlMs })).toString("base64url");
  const sig = createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

/** 校验会话令牌，返回用户名；签名不符或已过期返回 null */
export function verifySession(token: string | undefined): string | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;

  const expected = createHmac("sha256", sessionKey()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const { u, exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      u: string;
      exp: number;
    };
    return Date.now() < exp ? u : null;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "cosme_session";
