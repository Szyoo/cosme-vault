/**
 * POST /api/runs —— 「跑一轮」：给所有启用账号入队扫描任务。
 *
 * 扫描完成后 draw 任务会被自动派发（事件驱动，见 lib/queue.ts），
 * 因此定时任务只需周期性打这一个端点。
 *
 * 鉴权双通道：管理员会话，或 cron 容器的 `Authorization: Bearer <CRON_TOKEN>`。
 */
import { NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import { startRun } from "@/lib/dispatch.ts";
import { requireUser } from "@/lib/auth.ts";
import { db, schema } from "@/db/index.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

function hasCronToken(req: Request): boolean {
  const token = process.env.CRON_TOKEN;
  return !!token && req.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(req: Request): Promise<NextResponse> {
  const t = await getT();
  const cron = hasCronToken(req);
  if (!cron) {
    try {
      await requireUser();
    } catch {
      return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
    }
  }

  const started = startRun(cron ? "cron" : "manual");
  if (started.length === 0) {
    return NextResponse.json(
      { error: t.api.noRunnableAccount, started: [] },
      { status: 409 },
    );
  }
  publish("queue");
  return NextResponse.json({ started });
}

/** GET /api/runs —— 最近任务概览，供首页展示 */
export async function GET(): Promise<NextResponse> {
  const jobs = db
    .select()
    .from(schema.jobs)
    .orderBy(desc(schema.jobs.createdAt))
    .limit(20)
    .all();
  return NextResponse.json({ jobs });
}
