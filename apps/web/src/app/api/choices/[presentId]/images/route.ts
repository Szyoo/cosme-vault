/**
 * PATCH /api/choices/:presentId/images —— 用户手动纠正奖品参考图。
 *
 * 背景：参考图靠命名启发式从 PR 页猜，有时不对、有时缺（实测反馈）。
 * runner 采集时把整页内容图存成候选池（PendingChoice.candidateImages），
 * 这里接受用户从候选里挑出的最终参考图，写回快照第一题——历史回看同步生效。
 *
 * 安全边界：只接受**候选池里已有的 URL**（不接受任意外部地址），纯数据修正，
 * 不触发任何投递流程。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { PendingChoice } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";
import { requireUser } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

const Body = z.object({
  accountId: z.string().min(1),
  images: z.array(z.string().url()).max(8),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const t = await getT();
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }
  const { presentId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });

  const row = db
    .select()
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.accountId, parsed.data.accountId),
        eq(schema.accountPresents.presentId, presentId),
      ),
    )
    .get();
  if (!row?.pendingChoices) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });

  const qs = PendingChoice.array().parse(JSON.parse(row.pendingChoices));
  if (qs.length === 0) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });

  const allowed = new Set([...qs[0]!.candidateImages, ...qs[0]!.referenceImages]);
  const images = parsed.data.images.filter((u) => allowed.has(u));
  qs[0] = { ...qs[0]!, referenceImages: images };

  db.update(schema.accountPresents)
    .set({ pendingChoices: JSON.stringify(qs), updatedAt: new Date().toISOString() })
    .where(eq(schema.accountPresents.id, row.id))
    .run();
  publish("queue");
  return NextResponse.json({ ok: true, referenceImages: images });
}
