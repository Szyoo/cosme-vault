/**
 * POST /api/runner/report —— runner 上报任务最终结果。
 *
 * 落库后按副作用发推送：需要人工选择的奖品 → Bark 深链接到选择页；
 * 未知页面模式 → Bark 提醒去补 pattern。推送在事务外做（事务内不能 await）。
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { JobReport } from "@cosme/contract";
import { checkRunnerAuth } from "@/lib/runner-auth.ts";
import { applyReport } from "@/lib/queue.ts";
import { notifyNeedsChoice, sendBark } from "@/lib/bark.ts";
import { db, schema } from "@/db/index.ts";
import { publish } from "@/lib/events.ts";

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
  //
  // ⚠️ **同一奖品只推一次**（用户要求，2026-09-09）：定时任务里两个账号会各自
  // 挂起同一个奖品，每个 draw 各上报一次 → 手机上收到两条同商品的通知、点进去
  // 要选两遍。选一次会推平所有挂起的账号（见 /api/choices 的 POST），
  // 所以第二条通知纯属噪音。
  //
  // 去重不能只在本次 report 内做——一次 report 只含一个 draw 的结果，
  // 两条通知来自**两次不同的 report**。判据是「除我之外，这个奖品上还有没有
  // 别的账号已经挂在 needsChoice」：A 先落地时没有别人 → 推；B 后落地时
  // A 还挂着 → 不推。若 A 已经选完（回 pending/drawn），B 就是唯一挂起的 → 照推。
  for (const item of effects.needsChoice) {
    const others = db
      .select({ accountId: schema.accountPresents.accountId })
      .from(schema.accountPresents)
      .where(
        and(
          eq(schema.accountPresents.presentId, item.presentId),
          eq(schema.accountPresents.status, "needsChoice"),
        ),
      )
      .all()
      .filter((r) => r.accountId !== item.accountId);
    if (others.length > 0) continue;

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
      // ⚠️ 落点必须是真实存在的路由：这里曾写 `/presents`（根本没有这个页面），
      // 推送点开一律 404（用户从 Bark 点进来撞上了）。现场在诊断页。
      url: `${base}/diagnostics`,
      group: info.accountLabel,
      level: "timeSensitive",
    });
  }

  publish("report");
    return NextResponse.json({ ok: true, dispatchedDraws: effects.dispatchedDraws });
}

/** 取账号名与奖品名用于通知文案 */
function describe(accountId: string, presentId: string): { accountLabel: string; presentName: string } {
  const account = db.select().from(schema.accounts).where(eq(schema.accounts.id, accountId)).get();
  const present = db.select().from(schema.presents).where(eq(schema.presents.id, presentId)).get();
  return { accountLabel: account?.label ?? accountId, presentName: present?.name ?? presentId };
}
