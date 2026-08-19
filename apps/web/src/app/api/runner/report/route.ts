/**
 * POST /api/runner/report —— runner 上报任务最终结果。
 *
 * 落库后按副作用发推送：需要人工选择的奖品 → Bark 深链接到选择页；
 * 未知页面模式 → Bark 提醒去补 pattern。推送在事务外做（事务内不能 await）。
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { JobReport } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { applyReport } from "@/lib/queue.ts";
import { notifyNeedsChoice, sendBark } from "@/lib/bark.ts";
import { db, schema } from "@/db/index.ts";

export async function POST(req: Request): Promise<NextResponse> {
  const denied = checkRunnerAuth(req);
  if (denied) return denied;

  const parsed = JobReport.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "报告格式非法", detail: parsed.error.issues }, { status: 400 });
  }

  const effects = applyReport(parsed.data);
  const base = (process.env.PUBLIC_BASE_URL ?? "").replace(/\/$/, "");

  // 需要用户选择 → 推送深链接，手机点开即可选
  for (const item of effects.needsChoice) {
    const info = describe(item.accountId, item.presentId);
    await notifyNeedsChoice({
      accountLabel: info.accountLabel,
      presentName: info.presentName,
      choiceUrl: `${base}/choices/${item.presentId}?account=${item.accountId}`,
    });
  }

  // 未知页面模式 → 提醒补 pattern（诊断包已落库）
  for (const item of effects.unknownPattern) {
    const info = describe(item.accountId, item.presentId);
    await sendBark({
      title: "遇到未知页面模式",
      subtitle: info.accountLabel,
      body: `「${info.presentName}」已安全中止，现场已存，需补一个 pattern`,
      url: `${base}/presents`,
      group: info.accountLabel,
      level: "timeSensitive",
    });
  }

  return NextResponse.json({ ok: true, dispatchedDraws: effects.dispatchedDraws });
}

/** 取账号名与奖品名用于通知文案 */
function describe(accountId: string, presentId: string): { accountLabel: string; presentName: string } {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
  const present = db.select().from(schema.presents).where(eq(schema.presents.id, presentId)).get();
  return { accountLabel: account?.label ?? accountId, presentName: present?.name ?? presentId };
}
