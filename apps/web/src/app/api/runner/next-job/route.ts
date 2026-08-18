/** GET /api/runner/next-job —— runner 长轮询领取下一个任务。 */
import { NextResponse } from "next/server";
import type { NextJobResponse } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { claimNextJob } from "@/lib/queue.ts";

export const dynamic = "force-dynamic";

// 简单长轮询：窗口内轮询队列，有任务立即返回，否则到点返回 null 让 runner 再来。
const POLL_WINDOW_MS = 25_000;
const POLL_INTERVAL_MS = 1_000;

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const deadline = Date.now() + POLL_WINDOW_MS;
  while (Date.now() < deadline) {
    const job = claimNextJob();
    if (job) {
      return NextResponse.json({ job } satisfies NextJobResponse);
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  return NextResponse.json({ job: null } satisfies NextJobResponse);
}
