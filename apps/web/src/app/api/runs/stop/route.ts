/**
 * POST /api/runs/stop —— 终止本轮：把还在排队的任务全部取消。
 *
 * 为什么需要：「跑一轮」一次能入队上百个 draw，入队之后**原先没有任何办法叫停**
 * （用户提过）。跑错了、想改配置、或者只是不想今天就投完，都只能等它跑光。
 *
 * 语义边界（重要）：
 * - 只取消 `queued`。**正在 running 的那一个不动**——它此刻可能正停在
 *   问卷送信那一步，从控制面「取消」它既停不下浏览器，又会让库里的状态
 *   和站点上的事实脱节。让它自己跑完是唯一诚实的做法。
 * - 被取消的 draw 对应的 `account_presents` **保持 pending**：它们根本没被尝试过，
 *   下一轮该继续投。所以「终止」= 停掉这一批，不是把奖品标成放弃。
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { requireUser } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

export async function POST(): Promise<NextResponse> {
  const t = await getT();
  try {
    await requireUser();
  } catch {
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }

  const now = new Date().toISOString();
  const queued = db.select({ id: schema.jobs.id }).from(schema.jobs).where(eq(schema.jobs.status, "queued")).all();

  db.update(schema.jobs)
    .set({ status: "failed", error: "已被手动终止", finishedAt: now })
    .where(eq(schema.jobs.status, "queued"))
    .run();

  const running = db
    .select({ id: schema.jobs.id })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.status, "running")))
    .all();

  db.insert(schema.runnerLogs)
    .values({
      jobId: null,
      at: now,
      level: "warn",
      text: `手动终止：取消了 ${queued.length} 个排队任务${running.length ? `（另有 ${running.length} 个正在执行，会自己跑完）` : ""}`,
    })
    .run();

  publish("queue");
  return NextResponse.json({ cancelled: queued.length, stillRunning: running.length });
}
