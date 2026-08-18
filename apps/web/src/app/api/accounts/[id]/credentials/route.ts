/**
 * PUT    /api/accounts/:id/credentials —— 录入/更新凭证（空字段=不改动）
 * DELETE /api/accounts/:id/credentials —— 清除凭证
 *
 * 明文只存在于本请求的处理过程中，随即加密落库；任何 GET 都不会回显值。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { clearCredentials, setCredentials } from "@/lib/accounts.ts";

const Body = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
  profile: z
    .object({
      name: z.string().optional(),
      age: z.string().optional(),
      job: z.string().optional(),
    })
    .optional(),
});

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "参数非法" }, { status: 400 });
  }
  return setCredentials(id, parsed.data)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "账号不存在" }, { status: 404 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;
  return clearCredentials(id)
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: "账号不存在" }, { status: 404 });
}
