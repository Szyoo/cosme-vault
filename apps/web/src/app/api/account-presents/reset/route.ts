/**
 * POST /api/account-presents/reset —— 把某账号的记录重置回待投递。
 *
 * 用途：账号进度条下钻 modal 里的「重置回待投递」。
 * **只改状态，绝不派发投递**（操作授权规则：凡触发真实投递必须用户明示；
 * 重置后由用户自己点「仅抽取」）。
 *
 * 两种粒度：
 * - { accountId, presentId }   单条
 * - { accountId, fromStatus }  该账号该状态的全部
 *
 * 只允许从「问题态」重置（failed / unknownPattern / expired / gone）：
 * - drawn / alreadyEntered 是去重防线，重置等于打开重复投递的口子，拒绝；
 * - needsChoice 有自己的闭环（选择页），从这里重置会丢掉挂起的题；
 * - pending 重置没有意义。
 */
import { NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/index.ts";
import * as schema from "@/db/schema.ts";
import { publish } from "@/lib/events.ts";
import { getT } from "@/i18n/server.ts";

const RESETTABLE = ["failed", "unknownPattern", "expired", "gone"] as const;

const Body = z.union([
  z.object({ accountId: z.string(), presentId: z.string() }),
  z.object({ accountId: z.string(), fromStatus: z.enum(RESETTABLE) }),
]);

export async function POST(req: Request): Promise<NextResponse> {
  const t = await getT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  const b = parsed.data;

  const where =
    "presentId" in b
      ? and(
          eq(schema.accountPresents.accountId, b.accountId),
          eq(schema.accountPresents.presentId, b.presentId),
          inArray(schema.accountPresents.status, [...RESETTABLE]),
        )
      : and(
          eq(schema.accountPresents.accountId, b.accountId),
          eq(schema.accountPresents.status, b.fromStatus),
        );

  const r = db
    .update(schema.accountPresents)
    .set({ status: "pending", error: null, updatedAt: new Date().toISOString() })
    .where(where)
    .run();

  publish("queue");
  return NextResponse.json({ ok: true, reset: r.changes });
}
