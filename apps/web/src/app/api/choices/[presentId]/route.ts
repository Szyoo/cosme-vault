/**
 * GET  /api/choices/:presentId?account= —— 取该奖品待决的选择项
 * POST /api/choices/:presentId          —— 提交选择，重新派发 draw 任务
 *
 * ⚠️ Next 16：动态段 params 必须 await。
 */
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { PendingChoice } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";
import { dispatchResolvedDraw } from "@/lib/dispatch.ts";
import { getT } from "@/i18n/server.ts";
import { publish } from "@/lib/events.ts";

export const dynamic = "force-dynamic";

function loadRow(accountId: string, presentId: string) {
  return db
    .select()
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.accountId, accountId),
        eq(schema.accountPresents.presentId, presentId),
      ),
    )
    .get();
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const t = await getT();
  const { presentId } = await params;
  const accountId = new URL(req.url).searchParams.get("account");
  if (!accountId) return NextResponse.json({ error: t.api.missingAccountParam }, { status: 400 });

  const row = loadRow(accountId, presentId);
  if (!row) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });

  const present = db.select().from(schema.presents).where(eq(schema.presents.id, presentId)).get();
  const choices = row.pendingChoices
    ? PendingChoice.array().safeParse(JSON.parse(row.pendingChoices))
    : null;

  // 有几个账号正挂在这个奖品上等选择——界面据此说明「选一次覆盖 N 个账号」
  const waiting = db
    .select({ id: schema.accountPresents.id })
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.presentId, presentId),
        eq(schema.accountPresents.status, "needsChoice"),
      ),
    )
    .all().length;

  return NextResponse.json({
    status: row.status,
    present: present ? { id: present.id, name: present.name, brand: present.brand, link: present.link } : null,
    choices: choices?.success ? choices.data : [],
    waitingAccounts: waiting,
  });
}

const Body = z.object({
  accountId: z.string(),
  /** questionId → optionId */
  selections: z.record(z.string(), z.string()),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ presentId: string }> },
): Promise<NextResponse> {
  const t = await getT();
  const { presentId } = await params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });

  const { accountId, selections } = parsed.data;
  const row = loadRow(accountId, presentId);
  if (!row) return NextResponse.json({ error: t.api.recordNotFound }, { status: 404 });
  if (row.status !== "needsChoice") {
    return NextResponse.json({ error: t.choice.noNeedHint(row.status) }, { status: 409 });
  }

  // ⚠️ **一次选择解析全部挂起的账号**（用户要求，2026-09-09）：
  // 同一奖品的问卷对所有账号是同一份，定时任务里两个账号会各自挂起同一个奖品，
  // 于是同一件商品弹两条、要选两遍。选择结果与账号无关，故凡是**这个奖品**上
  // 处于 needsChoice 的账号一律套用同一份答案。
  //
  // 这与 `dispatch.ts` 的 `inheritedChoices` 是同一条原则的两半：那边管「派单时
  // 借用别人选过的」，这边管「选完立刻推平已经挂起的」。少了这一半，B 账号会
  // 一直卡在 needsChoice——没有任何东西会把它放回 pending 去触发那次借用。
  const pending = db
    .select()
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.presentId, presentId),
        eq(schema.accountPresents.status, "needsChoice"),
      ),
    )
    .all();

  // 记下选择并回到 pending，随后派发带 resolvedChoices 的 draw。
  // ⚠️ pendingChoices **刻意保留**：它是题目与选项文本的唯一快照——
  // resolvedChoices 里只有选项 ID，清掉快照后「历史里看自己选了什么」
  // 就只剩一串 ID 没法翻译成人话（用户要求能回看）。
  const now = new Date().toISOString();
  for (const r of pending) {
    db.update(schema.accountPresents)
      .set({ resolvedChoices: JSON.stringify(selections), status: "pending", updatedAt: now })
      .where(eq(schema.accountPresents.id, r.id))
      .run();
  }

  // 一次选择派出的几个 draw 共享一个批次，队列上是一条「单独重跑 · <奖品名>」
  // 而不是每个账号一条
  const batchId = randomUUID();
  const jobIds = pending
    .map((r) => dispatchResolvedDraw(r.accountId, presentId, selections, batchId))
    .filter((id): id is string => id !== null);
  if (jobIds.length === 0) return NextResponse.json({ error: t.api.presentNotFound }, { status: 404 });
  publish("queue");
  return NextResponse.json({ ok: true, jobId: jobIds[0], accounts: jobIds.length });
}
