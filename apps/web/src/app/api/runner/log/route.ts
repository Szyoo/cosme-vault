/** POST /api/runner/log —— runner 推送一条实时日志。 */
import { NextResponse } from "next/server";
import { RunnerLog } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { db, schema } from "@/db/index.ts";

export async function POST(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const parsed = RunnerLog.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "日志格式非法" }, { status: 400 });
  }
  const log = parsed.data;
  db.insert(schema.runnerLogs)
    .values({ jobId: log.jobId, at: log.at, level: log.level, text: log.text })
    .run();
  return NextResponse.json({ ok: true });
}
