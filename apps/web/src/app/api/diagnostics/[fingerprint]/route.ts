/**
 * PATCH /api/diagnostics/:fingerprint —— 把一种异常标记为已处理。
 *
 * 用途：补完 pattern 或确认是环境问题之后，从待处理列表里划掉。
 * 同时把受这条异常影响、仍卡在 unknownPattern 的奖品放回 pending，
 * 下一轮自动重试（新逻辑生效后往往就通了）。
 *
 * ⚠️ 只改状态，不派发任何投递（触发投递需用户明确点按钮）。
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { requireUser } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

export async function PATCH(
  _req: Request,
  { params }: { params: Promise<{ fingerprint: string }> },
): Promise<NextResponse> {
  const t = await getT();
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }
  const { fingerprint } = await params;
  const now = new Date().toISOString();

  const row = db.select().from(schema.anomalies).where(eq(schema.anomalies.fingerprint, fingerprint)).get();
  if (!row) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });

  db.update(schema.anomalies).set({ resolvedAt: now }).where(eq(schema.anomalies.fingerprint, fingerprint)).run();

  // 受影响的奖品放回 pending（不派发，等用户点「仅抽取」）
  let requeued = 0;
  for (const ap of db
    .select()
    .from(schema.accountPresents)
    .where(eq(schema.accountPresents.status, "unknownPattern"))
    .all()) {
    try {
      if ((JSON.parse(ap.diagnostics ?? "{}") as { fingerprint?: string }).fingerprint !== fingerprint) continue;
    } catch {
      continue;
    }
    db.update(schema.accountPresents)
      .set({ status: "pending", diagnostics: null, error: null, updatedAt: now })
      .where(eq(schema.accountPresents.id, ap.id))
      .run();
    requeued++;
  }
  publish("queue");
  return NextResponse.json({ ok: true, requeued });
}
