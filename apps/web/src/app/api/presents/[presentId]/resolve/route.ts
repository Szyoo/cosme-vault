/**
 * POST /api/presents/:presentId/resolve —— 人工裁决一条「结果未知」的投递。
 *
 * 场景：runner 在投递中途崩了（`reclaimStaleJobs` 把它标成 failed + 「结果未知」）。
 * @COSME 不标注「已応募」，控制面无从查证，只能由人去原页面看一眼再回来告诉它。
 * 在此之前这个闭环是断的——界面只会一直提示「请人工确认」，却没有地方回话。
 *
 * ⚠️ Next 16：动态段 params 必须 await。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { dispatchResolvedDraw } from "@/lib/dispatch.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

const Body = z.object({
  accountId: z.string().min(1),
  /** drawn = 我确认已经投过了；retry = 没投出去，重投一次 */
  outcome: z.enum(["drawn", "retry"]),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const t = await getT();
  const { presentId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });

  const { accountId, outcome } = parsed.data;
  const row = db
    .select()
    .from(schema.accountPresents)
    .where(
      and(eq(schema.accountPresents.accountId, accountId), eq(schema.accountPresents.presentId, presentId)),
    )
    .get();
  if (!row) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });

  const now = new Date().toISOString();

  if (outcome === "drawn") {
    // 人工确认已应募：写成 drawn，去重防线（account_presents）从此认它，不会再派发
    db.update(schema.accountPresents)
      .set({ status: "drawn", error: null, drawnAt: row.drawnAt ?? now, updatedAt: now })
      .where(eq(schema.accountPresents.id, row.id))
      .run();
    publish("queue");
    return NextResponse.json({ ok: true, status: "drawn" });
  }

  // 人工确认没投出去：回到 pending 并立刻派一个 draw。
  // 沿用上次已解析的人工选择（若有），免得又要在手机上选一遍。
  db.update(schema.accountPresents)
    .set({ status: "pending", error: null, updatedAt: now })
    .where(eq(schema.accountPresents.id, row.id))
    .run();

  const choices = row.resolvedChoices
    ? (JSON.parse(row.resolvedChoices) as Record<string, string>)
    : {};
  const jobId = dispatchResolvedDraw(accountId, presentId, choices);
  if (!jobId) return NextResponse.json({ error: t.api.presentNotFound }, { status: 404 });
  publish("queue");
    return NextResponse.json({ ok: true, status: "pending", jobId });
}
