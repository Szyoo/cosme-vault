/**
 * GET /api/runner/accounts —— 账号清单（id + 备注名 + 是否启用）。
 * 给 Mac mini 上的 `npm run login -- --account <备注名>` 解析 profile 目录用；
 * 不含任何凭证。鉴权同其他 runner 端点（Bearer RUNNER_TOKEN）。
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/db/index.ts";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;
  const rows = db
    .select({ id: schema.accounts.id, label: schema.accounts.label, enabled: schema.accounts.enabled })
    .from(schema.accounts)
    .all();
  return NextResponse.json({ accounts: rows });
}
