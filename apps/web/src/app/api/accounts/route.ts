/**
 * GET  /api/accounts —— 列出 cosme 账号（只含「凭证是否已填」，不含值）
 * POST /api/accounts —— 新建账号
 * 鉴权由 src/proxy.ts 的全站门禁负责。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { createAccount, listAccounts } from "@/lib/accounts.ts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ accounts: listAccounts() });
}

const CreateBody = z.object({ label: z.string().min(1).max(64) });

export async function POST(req: Request): Promise<NextResponse> {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法：需要 label" }, { status: 400 });
  }
  return NextResponse.json({ account: createAccount(parsed.data.label) }, { status: 201 });
}
