/**
 * cosme 账号服务。
 *
 * 凭证安全边界：
 * - 写入：明文只存在于用户录入那一次请求，立刻加密落库
 * - 读出：只有 `credentialsFor()`（供 runner 执行任务时调用）会解密
 * - 展示：一律走 `listAccounts()`，只返回「哪些字段已填」，**绝不回显值**
 */
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { AccountCredentials, type AccountSummary, type CredentialStatus } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";
import { decryptJson, encryptJson } from "@/lib/crypto.ts";

/** 从密文推导「哪些字段已填」，解不开时降级为未配置而不是抛错（避免换密钥后整页打不开） */
function statusOf(enc: string | null): CredentialStatus {
  if (!enc) return { configured: false, filledFields: [] };
  try {
    const c = decryptJson<AccountCredentials>(enc);
    const filled: string[] = [];
    if (c.email) filled.push("email");
    if (c.password) filled.push("password");
    if (c.profile?.name) filled.push("profile.name");
    if (c.profile?.age) filled.push("profile.age");
    if (c.profile?.job) filled.push("profile.job");
    return { configured: filled.includes("email") && filled.includes("password"), filledFields: filled };
  } catch {
    return { configured: false, filledFields: [] };
  }
}

export function listAccounts(): AccountSummary[] {
  return db
    .select()
    .from(schema.accounts)
    .all()
    .map((a) => ({
      id: a.id,
      label: a.label,
      enabled: a.enabled,
      credentials: statusOf(a.credentialsEnc),
    }));
}

export function createAccount(label: string): AccountSummary {
  const id = randomUUID();
  db.insert(schema.accounts).values({ id, label }).run();
  return { id, label, enabled: true, credentials: { configured: false, filledFields: [] } };
}

export function updateAccount(id: string, patch: { label?: string; enabled?: boolean }): boolean {
  const res = db
    .update(schema.accounts)
    .set({ ...patch, updatedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, id))
    .run();
  return res.changes > 0;
}

export function deleteAccount(id: string): boolean {
  const res = db.delete(schema.accounts).where(eq(schema.accounts.id, id)).run();
  return res.changes > 0;
}

/**
 * 凭证补丁：每个字段都可省略（含 profile 内部字段），
 * 因此不能用 `Partial<AccountCredentials>`——那只让顶层可选。
 */
export interface CredentialsPatch {
  email?: string | undefined;
  password?: string | undefined;
  profile?:
    | {
        name?: string | undefined;
        age?: string | undefined;
        job?: string | undefined;
      }
    | undefined;
}

/**
 * 写入凭证。空字符串字段视为「不改动」（沿用 ledger-helper 的语义），
 * 这样用户可以只改密码而不必重填其余字段。
 */
export function setCredentials(id: string, patch: CredentialsPatch): boolean {
  const row = db.select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
  if (!row) return false;

  let current: AccountCredentials = {
    email: "",
    password: "",
    profile: { name: "", age: "", job: "" },
  };
  if (row.credentialsEnc) {
    try {
      current = decryptJson<AccountCredentials>(row.credentialsEnc);
    } catch {
      // 解不开就以空白为基底重建，避免旧密文卡住用户
    }
  }

  const merged: AccountCredentials = {
    email: patch.email?.trim() || current.email,
    password: patch.password || current.password,
    profile: {
      name: patch.profile?.name?.trim() || current.profile.name,
      age: patch.profile?.age?.trim() || current.profile.age,
      job: patch.profile?.job?.trim() || current.profile.job,
    },
  };

  db.update(schema.accounts)
    .set({ credentialsEnc: encryptJson(merged), updatedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, id))
    .run();
  return true;
}

/** 清除某账号的全部凭证 */
export function clearCredentials(id: string): boolean {
  const res = db
    .update(schema.accounts)
    .set({ credentialsEnc: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.accounts.id, id))
    .run();
  return res.changes > 0;
}

/**
 * 解密取出凭证——**仅供 runner 执行任务时调用**。
 * 刻意不放进任务载荷：那会把明文写进 jobs 表。
 */
export function credentialsFor(id: string): AccountCredentials | null {
  const row = db.select().from(schema.accounts).where(eq(schema.accounts.id, id)).get();
  if (!row?.credentialsEnc) return null;
  try {
    return AccountCredentials.parse(decryptJson<unknown>(row.credentialsEnc));
  } catch {
    return null;
  }
}
