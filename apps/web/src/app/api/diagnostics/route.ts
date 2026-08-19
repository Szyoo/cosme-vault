/**
 * GET /api/diagnostics —— 汇总「没认出来的东西」，供补写 pattern / 解析器。
 *
 * 两个来源：
 * 1. account_presents.diagnostics —— draw 遇到未知页面模式时的现场包
 * 2. 最近 scan 任务结果里 recognized=false 的来源报告 —— 列表页版式没认出来
 *
 * 这是「遇到没见过的就反馈」机制的最后一环：不看得到，落库也没用。
 */
import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { PatternDiagnostics, ScanSourceReport } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  // ── 1. draw 的未知模式 ──
  const rows = db
    .select({
      presentId: schema.accountPresents.presentId,
      accountId: schema.accountPresents.accountId,
      updatedAt: schema.accountPresents.updatedAt,
      diagnostics: schema.accountPresents.diagnostics,
      name: schema.presents.name,
      brand: schema.presents.brand,
      link: schema.presents.link,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .where(eq(schema.accountPresents.status, "unknownPattern"))
    .all();

  const unknownPatterns = rows.map((r) => {
    const parsed = r.diagnostics ? PatternDiagnostics.safeParse(JSON.parse(r.diagnostics)) : null;
    return {
      presentId: r.presentId,
      accountId: r.accountId,
      name: r.name,
      brand: r.brand,
      link: r.link,
      updatedAt: r.updatedAt,
      diagnostics: parsed?.success ? parsed.data : null,
    };
  });

  // ── 2. scan 里没认出来的来源 ──
  const scanJobs = db
    .select({ id: schema.jobs.id, result: schema.jobs.result, finishedAt: schema.jobs.finishedAt })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, "scan"), eq(schema.jobs.status, "done")))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(20)
    .all();

  /** 同一个来源可能连续多轮都没认出来，只保留最近一次 */
  const bySource = new Map<string, { source: string; note: string; at: string | null; diagnostics: unknown }>();
  for (const job of scanJobs) {
    if (!job.result) continue;
    const outcome = (JSON.parse(job.result) as { outcome?: { kind?: string; sourceReports?: unknown[] } }).outcome;
    if (outcome?.kind !== "scan" || !outcome.sourceReports) continue;
    for (const raw of outcome.sourceReports) {
      const parsed = ScanSourceReport.safeParse(raw);
      if (!parsed.success || parsed.data.recognized) continue;
      if (bySource.has(parsed.data.source)) continue; // 已有更近的一次
      bySource.set(parsed.data.source, {
        source: parsed.data.source,
        note: parsed.data.note,
        at: job.finishedAt,
        diagnostics: parsed.data.diagnostics,
      });
    }
  }

  return NextResponse.json({
    unknownPatterns,
    unrecognizedSources: Array.from(bySource.values()),
  });
}
