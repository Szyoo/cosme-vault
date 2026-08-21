/**
 * PATCH /api/jobs/batch/:batchId  { action: "cancel" | "top" }
 *
 * 以**批次**为单位操作队列——「一轮」或「单独重跑」才是用户的操作单位，
 * 逐个奖品的 job 是内部实现（见 lib/queue-view.ts 的说明）。
 *
 * - cancel：把这一批还在排队的任务全部取消。**正在执行的那一个不动**——
 *   从控制面停不了浏览器，强行标记只会让库里的状态与站点上的事实脱节。
 *   被取消的 draw 对应的 `account_presents` 保持 pending：它们没被尝试过，下一轮该继续。
 * - top：把这一批整体挪到队首（组内相对顺序保持）。
 *
 * ⚠️ Next 16：动态段 params 必须 await。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { requireUser } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";
import { stampSeries } from "@/lib/stamp.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

const Body = z.object({ action: z.enum(["cancel", "top"]) });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ batchId: string }> },
): Promise<NextResponse> {
  const t = await getT();
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }

  const { batchId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });

  // 迁移前的老任务没有 batch_id，queue-view 用 `legacy:<jobId>` 给它们编了组
  const legacyJobId = batchId.startsWith("legacy:") ? batchId.slice("legacy:".length) : null;
  const belongsToBatch = legacyJobId
    ? eq(schema.jobs.id, legacyJobId)
    : eq(schema.jobs.batchId, batchId);

  if (parsed.data.action === "cancel") {
    const targets = db
      .select({ id: schema.jobs.id })
      .from(schema.jobs)
      .where(and(belongsToBatch, eq(schema.jobs.status, "queued")))
      .all();
    if (targets.length === 0) {
      return NextResponse.json({ error: t.api.jobNotQueued }, { status: 409 });
    }
    const now = new Date().toISOString();
    db.update(schema.jobs)
      .set({ status: "failed", error: "已手动取消", finishedAt: now })
      .where(and(belongsToBatch, eq(schema.jobs.status, "queued")))
      .run();
    db.insert(schema.runnerLogs)
      .values({ jobId: null, at: now, level: "warn", text: `手动取消了一批任务（${targets.length} 个）` })
      .run();
    publish("queue");
    return NextResponse.json({ ok: true, cancelled: targets.length });
  }

  // ── 整批置顶 ──
  //
  // 队列顺序就是 createdAt（claimNextJob: order by createdAt）。把本批的排队任务
  // 挪到最前、其余顺次后移，用 stampSeries 重发一串严格递增的戳。
  // ⚠️ 不能靠交换时间戳：同批入队的 createdAt 曾经完全相同（sqlite 默认值只到秒），
  // 交换等于什么都没做（踩过）。现在入队写毫秒戳，重排也一律重发。
  const queued = db
    .select({ id: schema.jobs.id, createdAt: schema.jobs.createdAt, batchId: schema.jobs.batchId })
    .from(schema.jobs)
    .where(eq(schema.jobs.status, "queued"))
    .orderBy(schema.jobs.createdAt)
    .all();
  if (queued.length === 0) return NextResponse.json({ error: t.api.jobNotQueued }, { status: 409 });

  const isMine = (j: (typeof queued)[number]) =>
    legacyJobId ? j.id === legacyJobId : j.batchId === batchId;
  const mine = queued.filter(isMine);
  if (mine.length === 0) return NextResponse.json({ error: t.api.jobNotQueued }, { status: 409 });

  const desired = [...mine, ...queued.filter((j) => !isMine(j))];
  const stamps = stampSeries(queued[0]!.createdAt, desired.length);
  db.transaction((tx) => {
    desired.forEach((j, i) => {
      tx.update(schema.jobs).set({ createdAt: stamps[i]! }).where(eq(schema.jobs.id, j.id)).run();
    });
  });
  publish("queue");
  return NextResponse.json({ ok: true, moved: mine.length });
}
