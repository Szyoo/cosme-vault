/** POST /api/runner/heartbeat —— runner 心跳，用于展示在线状态与位置。 */
import { NextResponse } from "next/server";
import { RunnerHeartbeat } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { setHeartbeat } from "@/lib/runner-state.ts";
import { publish } from "@/lib/events.ts";

export async function POST(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const parsed = RunnerHeartbeat.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "心跳格式非法" }, { status: 400 });
  }
  setHeartbeat(parsed.data);
  publish("heartbeat");
    return NextResponse.json({ ok: true });
}
