/**
 * GET /api/rules/:id/hits —— 这条词在已采集题库里具体命中了什么（下钻用的「流水」）。
 *
 * 语料是 `survey_captures`：做题时顺手采下的真实题库，因此看命中不需要额外埋点、
 * 也不用再上站点。answer 类会标出**被反转标记压掉**的那些。
 */
import { NextResponse } from "next/server";
import { ruleHits } from "@/lib/rules.ts";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const { id } = await params;
  return NextResponse.json(ruleHits(id));
}
