/**
 * PATCH  /api/rules/:id —— 改分类 / 改词 / 停用启用 / 备注
 * DELETE /api/rules/:id —— 删除（出厂词拒绝，只能停用）
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteRule, updateRule } from "@/lib/rules.ts";
import { getT } from "@/i18n/server.ts";

const Patch = z.object({
  category: z.string().optional(),
  keyword: z.string().optional(),
  enabled: z.boolean().optional(),
  note: z.string().nullable().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const t = await getT();
  const { id } = await params;
  const parsed = Patch.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  const r = updateRule(id, parsed.data);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 409 });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  const r = deleteRule(id);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: 409 });
}
