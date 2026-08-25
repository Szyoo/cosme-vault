/**
 * GET /api/runner/config —— runner 拉运行配置（节奏参数）。
 *
 * runner 每次心跳后拉一次：设置页改完 ≤15 秒生效，无需重启 runner。
 * 鉴权与其他 runner 端点一致（Bearer RUNNER_TOKEN）。
 */
import { NextResponse } from "next/server";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { getPacingConfig } from "@/lib/settings.ts";
import { activeRules } from "@/lib/rules.ts";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;
  // 节奏与规则同路下发：runner 每次心跳后拉一次，两者都是「改完 ≤15 秒生效」
  return NextResponse.json({ ...getPacingConfig(), rules: activeRules() });
}
