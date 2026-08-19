/**
 * GET  /api/choices/:presentId?account= —— 取该奖品待决的选择项
 * POST /api/choices/:presentId          —— 提交选择，重新派发 draw 任务
 *
 * ⚠️ Next 16：动态段 params 必须 await。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { PendingChoice } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";
import { dispatchResolvedDraw } from "@/lib/dispatch.ts";

export const dynamic = "force-dynamic";

function loadRow(accountId: string, presentId: string) {
  return db
    .select()
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.accountId, accountId),
        eq(schema.accountPresents.presentId, presentId),
      ),
    )
    .get();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const { presentId } = await params;
  const accountId = new URL(req.url).searchParams.get("account");
  if (!accountId) return NextResponse.json({ error: "缺少 account 参数" }, { status: 400 });

  const row = loadRow(accountId, presentId);
  if (!row) return NextResponse.json({ error: "记录不存在" }, { status: 404 });

  const present = db.select().from(schema.presents).where(eq(schema.presents.id, presentId)).get();
  const choices = row.pendingChoices
    ? PendingChoice.array().safeParse(JSON.parse(row.pendingChoices))
    : null;

  return NextResponse.json({
    status: row.status,
    present: present ? { id: present.id, name: present.name, brand: present.brand, link: present.link } : null,
    choices: choices?.success ? choices.data : [],
  });
}

const Body = z.object({
  accountId: z.string(),
  /** questionId → optionId */
  selections: z.record(z.string(), z.string()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const { presentId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "参数非法" }, { status: 400 });

  const { accountId, selections } = parsed.data;
  const row = loadRow(accountId, presentId);
  if (!row) return NextResponse.json({ error: "记录不存在" }, { status: 404 });
  if (row.status !== "needsChoice") {
    return NextResponse.json({ error: `该奖品当前状态为 ${row.status}，无需选择` }, { status: 409 });
  }

  // 记下选择并回到 pending，随后派发带 resolvedChoices 的 draw
  db.update(schema.accountPresents)
    .set({
      resolvedChoices: JSON.stringify(selections),
      status: "pending",
      pendingChoices: null,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.accountPresents.id, row.id))
    .run();

  const jobId = dispatchResolvedDraw(accountId, presentId, selections);
  if (!jobId) return NextResponse.json({ error: "奖品不存在，无法派发" }, { status: 404 });
  return NextResponse.json({ ok: true, jobId });
}
