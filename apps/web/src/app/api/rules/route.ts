/**
 * GET  /api/rules —— 全部规则 + 每条在已采集题库里的命中数
 * POST /api/rules —— 新增一条
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { addRule, hitCounts, listRules } from "@/lib/rules.ts";
import { getT } from "@/i18n/server.ts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const rules = listRules();
  const counts = hitCounts();
  return NextResponse.json({
    rules: rules.map((r) => ({ ...r, hitCount: counts[r.id] ?? 0 })),
  });
}

const Body = z.object({
  kind: z.enum(["answer", "manual", "negation"]),
  category: z.string().default("custom"),
  keyword: z.string(),
  note: z.string().nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  const t = await getT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  const r = addRule(parsed.data);
  return r.ok ? NextResponse.json({ ok: true, id: r.id }) : NextResponse.json({ error: r.error }, { status: 409 });
}
