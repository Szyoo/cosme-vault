/**
 * runner 的**当前**状态判定。
 *
 * ⚠️ 这里存在的唯一理由：心跳行里的 `busyJobId` 是**上一次心跳那一刻**的快照，
 * 不是现在的事实。直接照抄会渲染出自相矛盾的一行：
 *
 *     ⚪️ 离线 · mac-mini · 执行中
 *
 * ——runner 两小时前带着任务崩了，快照里 busyJobId 还在，界面就把它当成「正在执行」。
 * 所以 `busy` 只在**在线**时才有意义；离线时要回答的是另一个问题：多久没心跳了、
 * 掉线那会儿手上是不是还捏着任务。
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getHeartbeat } from "./runner-state.ts";

/** 超过这个时长没心跳就算离线。runner 心跳间隔远小于它，留足抖动余量。 */
const OFFLINE_AFTER_MS = 60_000;

export type RunnerStatus =
  /** 从来没有过心跳（还没起过 runner） */
  | { kind: "never" }
  | { kind: "online"; location: string; busy: boolean }
  /** 掉线。`wasBusy` = 最后一次心跳时手上还有任务，意味着那次投递结果未知 */
  | { kind: "offline"; location: string; agoMs: number; wasBusy: boolean };

export function getRunnerStatus(): RunnerStatus {
  const hb = getHeartbeat();
  if (!hb) return { kind: "never" };

  const agoMs = Date.now() - new Date(hb.at).getTime();
  if (agoMs < OFFLINE_AFTER_MS) {
    return { kind: "online", location: hb.location, busy: !!hb.busyJobId };
  }

  // `wasBusy` 不能只看 busyJobId 存不存在：那个任务可能已经被 reclaimStaleJobs
  // 回收成 failed 了，此时提示「掉线时手上还有任务」就是在重复报一件已经处理完的事。
  // 改成看**那个任务现在是不是还挂在 running**——回收之后这里自动归零，
  // 不需要谁回头去改写心跳行（runner_state 是 runner 自己报的，控制面不该改它）。
  return { kind: "offline", location: hb.location, agoMs, wasBusy: isJobStillRunning(hb.busyJobId) };
}

function isJobStillRunning(jobId: string | null): boolean {
  if (!jobId) return false;
  const job = db.select({ status: schema.jobs.status }).from(schema.jobs).where(eq(schema.jobs.id, jobId)).get();
  return job?.status === "running";
}

