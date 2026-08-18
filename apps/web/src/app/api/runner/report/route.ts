/** POST /api/runner/report —— runner 上报任务最终结果。 */
import { NextResponse } from "next/server";
import { JobReport } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { applyReport } from "@/lib/queue.ts";

export async function POST(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const parsed = JobReport.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "报告格式非法", detail: parsed.error.issues }, { status: 400 });
  }
  applyReport(parsed.data);
  return NextResponse.json({ ok: true });
}
