/**
 * PATCH  /api/accounts/:id —— 改名 / 启停
 * DELETE /api/accounts/:id —— 删除账号（连带其抽取记录，见 schema 的 cascade）
 *
 * ⚠️ Next 16：动态段 `params` 必须 await。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteAccount, updateAccount } from "@/lib/accounts.ts";

const PatchBody = z.object({
  label: z.string().min(1).max(64).optional(),
  enabled: z.boolean().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  return updateAccount(id, parsed.data)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "账号不存在" }, { status: 404 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return deleteAccount(id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "账号不存在" }, { status: 404 });
}
