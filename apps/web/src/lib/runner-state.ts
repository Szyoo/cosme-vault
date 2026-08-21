/**
 * runner 在线状态（落库）。
 *
 * ⚠️ 刻意不放进程内存：Next 多 worker 时写心跳的路由与渲染页面的进程可能不同，
 * 内存态会让首页误报「离线」（已踩过）。
 */
import { eq } from "drizzle-orm";
import type { RunnerHeartbeat } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";

const ROW_ID = "runner";

export function setHeartbeat(hb: RunnerHeartbeat): void {
  const existing = db.select().from(schema.runnerState).where(eq(schema.runnerState.id, ROW_ID)).get();
  const values = { location: hb.location, at: hb.at, busyJobId: hb.busyJobId };
  if (existing) {
    db.update(schema.runnerState).set(values).where(eq(schema.runnerState.id, ROW_ID)).run();
  } else {
    db.insert(schema.runnerState).values({ id: ROW_ID, ...values }).run();
  }
}

export function getHeartbeat(): RunnerHeartbeat | null {
  const row = db.select().from(schema.runnerState).where(eq(schema.runnerState.id, ROW_ID)).get();
  if (!row) return null;
  return {
    location: row.location as RunnerHeartbeat["location"],
    at: row.at,
    busyJobId: row.busyJobId,
  };
}

/** runner 是否在线：最近 60 秒内有心跳 */
export function isRunnerOnline(): boolean {
  const hb = getHeartbeat();
  return hb ? Date.now() - new Date(hb.at).getTime() < 60_000 : false;
}
