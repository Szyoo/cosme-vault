/**
 * POST /api/jobs —— 手动触发一个任务（网页按钮 / cron 定时）。
 * GET  /api/jobs —— 列出最近任务及其状态。
 *
 * 鉴权双通道：管理员会话（proxy.ts 已挡在前面）或 `Authorization: Bearer <CRON_TOKEN>`
 * ——后者供 cron 容器在内网调用（它没有浏览器会话）。
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { desc } from "drizzle-orm";
import { enqueueJob } from "@/lib/queue.ts";
import { requireUser } from "@/lib/auth.ts";
import { db, schema } from "@/db/index.ts";

/** cron 容器无会话，用 CRON_TOKEN 调用；未配置该变量则一律拒绝，避免忘配变成公开端点 */
function hasCronToken(req: Request): boolean {
  const token = process.env.CRON_TOKEN;
  if (!token) return false;
  return req.headers.get("authorization") === `Bearer ${token}`;
}

const CreateJob = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("scan"), accountId: z.string(), sources: z.array(z.enum(["normal", "brandFanClub"])).optional() }),
  z.object({ kind: z.literal("draw"), accountId: z.string(), presentId: z.string(), presentLink: z.string().url() }),
  z.object({ kind: z.literal("inspect"), accountId: z.string(), url: z.string().url() }),
]);

export async function POST(req: Request): Promise<NextResponse> {
  const cron = hasCronToken(req);
  if (!cron) {
    // 非 cron 调用必须已登录（proxy.ts 通常已拦下，此处为纵深防御）
    try {
      await requireUser();
    } catch {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
  }
  const parsed = CreateJob.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "任务参数非法", detail: parsed.error.issues }, { status: 400 });
  }
  const { kind, ...payload } = parsed.data;
  const id = enqueueJob(kind, payload, cron ? "cron" : "manual");
  return NextResponse.json({ id, status: "queued" });
}

export async function GET(): Promise<NextResponse> {
  const rows = db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt)).limit(50).all();
  return NextResponse.json({ jobs: rows });
}
