/**
 * GET /api/runner/credentials?accountId=xxx —— runner 执行任务时按需取解密凭证。
 *
 * 为什么单开这个端点而不把凭证塞进任务载荷：后者会把明文写进 jobs 表并留在历史里。
 * 这里解密后只经 HTTPS/内网返回给持有 RUNNER_TOKEN 的执行器，不落盘。
 */
import { NextResponse } from "next/server";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { credentialsFor } from "@/lib/accounts.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const accountId = new URL(req.url).searchParams.get("accountId");
  if (!accountId) {
    return NextResponse.json({ error: "缺少 accountId" }, { status: 400 });
  }
  const credentials = credentialsFor(accountId);
  if (!credentials) {
    return NextResponse.json({ error: "该账号尚未配置凭证" }, { status: 404 });
  }
  return NextResponse.json({ credentials });
}
