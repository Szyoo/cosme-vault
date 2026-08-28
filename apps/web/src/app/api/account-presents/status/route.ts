/**
 * POST /api/account-presents/status —— 404（gone）记录的人工改判。
 *
 * 只有 **gone** 能从这里自由改成任何状态（用户要求）：404 天然是「可能判错了」
 * 的状态——站点瞬时故障、我们链接存错、或奖品其实早投过了，真相只有人工看
 * 原页面才知道，所以开放人工裁决。其他状态各有闭环（failed 走 resolve、
 * needsChoice 走选择页），不从这里改，防止绕过防线。
 */
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/index.ts";
import * as schema from "@/db/schema.ts";
import { publish } from "@/lib/events.ts";
import { getT } from "@/i18n/server.ts";

const Body = z.object({
  accountId: z.string(),
  presentId: z.string(),
  toStatus: z.enum(["pending", "drawn", "alreadyEntered", "needsChoice", "failed", "expired", "unknownPattern"]),
});

export async function POST(req: Request): Promise<NextResponse> {
  const t = await getT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  const { accountId, presentId, toStatus } = parsed.data;

  const where = and(
    eq(schema.accountPresents.accountId, accountId),
    eq(schema.accountPresents.presentId, presentId),
    // 硬条件：当前必须是 gone——这个端点只服务 404 的人工改判
    eq(schema.accountPresents.status, "gone"),
  );
  const prev = db.select().from(schema.accountPresents).where(where).get();
  if (!prev) return NextResponse.json({ error: t.api.badParams }, { status: 404 });

  db.update(schema.accountPresents)
    .set({
      status: toStatus,
      // 改判为 pending 清掉理由（回到干净的待投递）；其余留一句可追溯的话
      error: toStatus === "pending" ? null : `人工改判：404 → ${toStatus}`,
      // 改判为已投递时补投递时间（原本就有则保留）
      drawnAt: toStatus === "drawn" ? (prev.drawnAt ?? new Date().toISOString()) : prev.drawnAt,
      updatedAt: new Date().toISOString(),
    })
    .where(where)
    .run();

  publish("queue");
  return NextResponse.json({ ok: true });
}
