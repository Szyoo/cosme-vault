/**
 * GET /api/survey-captures —— 导出全部采集到的问卷题库（重建匹配库的原料）。
 * 返回 [{presentId, url, capturedAt, questions:[{field,type,prompt,required,options}]}]。
 * 需管理员会话。数据量不大（每奖品一份），一次全量返回。
 */
import { NextResponse } from "next/server";
import { db, schema } from "@/db/index.ts";
import { requireUser } from "@/lib/auth.ts";
import { getT } from "@/i18n/server.ts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    await requireUser();
  } catch {
    const t = await getT();
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }
  const rows = db.select().from(schema.surveyCaptures).all();
  return NextResponse.json({
    count: rows.length,
    captures: rows.map((r) => ({
      presentId: r.presentId,
      url: r.url,
      capturedAt: r.capturedAt,
      questions: JSON.parse(r.questions) as unknown,
    })),
  });
}
