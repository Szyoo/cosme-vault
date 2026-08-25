/**
 * 批次编排。
 *
 * 设计取向：**事件驱动，不做状态机**。
 * 「跑一轮」＝ 给每个启用账号入队一个 scan；scan 上报成功后自动为其 pending 奖品派发 draw
 * （见 queue.ts 的 applyReport）。这样控制面不必维护「批次进行到第几步」的状态，
 * 崩溃重启也不会有半吊子批次。
 *
 * 合规：单账号低频。任务之间的人类速度停顿由 runner 侧保证
 * （它领完一个 draw 会等 betweenPresentsMs）。单批数量上限已按用户决定取消——
 * 合规靠节奏，不靠批次大小。
 */
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { nextStamp } from "@/lib/stamp.ts";

/**
 * 可执行查询的句柄：既接受顶层 db，也接受事务对象。
 * （Drizzle 的事务类型与 db 类型不互相赋值，故取二者的交集能力做参数类型。）
 */
type DbLike = Pick<typeof db, "select" | "insert" | "update" | "delete">;

/**
 * 给所有启用账号入队扫描任务，返回入队的 jobId 列表。
 *
 * `scanOnly=true` 时批次标成 'scan'：applyReport 看到这个标记就**不会**在
 * 扫描完成后自动派发投递——这就是「仅检测」与「跑一轮」的全部区别，
 * runner 侧完全无感（跨进程契约不动）。
 */
export function startRun(
  trigger: "cron" | "manual",
  scanOnly = false,
  /** 只跑指定账号（账号矩阵的单账号按钮）；不传则全部启用账号 */
  onlyAccountId?: string,
): { accountId: string; jobId: string }[] {
  const accounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.enabled, true))
    .all()
    .filter((a) => !onlyAccountId || a.id === onlyAccountId);
  const created: { accountId: string; jobId: string }[] = [];
  // 一次「跑一轮」= 一个批次。scan 与它稍后派发出的 draw 共享这个 id，
  // 界面上才能显示成「一轮（3/130）」而不是 130 个独立任务。
  const batchId = randomUUID();

  for (const a of accounts) {
    // 凭证未配置的账号跳过——runner 取不到凭证只会白跑一趟
    if (!a.credentialsEnc) continue;
    const jobId = randomUUID();
    db.insert(schema.jobs)
      .values({
        id: jobId,
        kind: "scan",
        status: "queued",
        payload: JSON.stringify({ accountId: a.id, sources: ["normal", "brandFanClub", "brandFanClubViaBrand", "produceMember", "tieupCampaign"] }),
        trigger,
        createdAt: nextStamp(),
        batchId,
        batchKind: scanOnly ? "scan" : "run",
      })
      .run();
    created.push({ accountId: a.id, jobId });
  }
  return created;
}

/**
 * 「仅抽取」：不扫描，直接给每个启用账号派发现有的待投递奖品。
 * 一次派发全部待投递（单批上限已取消）；合规节奏由 runner 的随机停顿保证。
 */
export function startDrawOnly(
  trigger: "cron" | "manual",
  /** 只跑指定账号（账号矩阵的单账号按钮）；不传则全部启用账号 */
  onlyAccountId?: string,
): { accountId: string; dispatched: number }[] {
  const accounts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.enabled, true))
    .all()
    .filter((a) => !onlyAccountId || a.id === onlyAccountId);
  const out: { accountId: string; dispatched: number }[] = [];
  for (const a of accounts) {
    if (!a.credentialsEnc) continue;
    const n = dispatchPendingDraws(a.id, trigger, db, { id: randomUUID(), kind: "draw" }).length;
    out.push({ accountId: a.id, dispatched: n });
  }
  return out;
}

/**
 * 为某账号派发待抽奖品的 draw 任务。
 *
 * 幂等要点：
 * - 只取 status='pending' 的记录（drawn/needsChoice/expired/gone 一律不动）
 * - 已有 queued/running 的 draw 任务的奖品要跳过，避免同一奖品被派两次
 */
/**
 * 跨账号复用选择结果（用户要求）：同一个奖品的问卷对所有账号都是同一份，
 * A 账号选过的色号/套装，给 B 账号派单时直接带上——不用每个账号都再选一遍。
 * 自己账号已有的选择优先；否则借用任意其他账号的。
 */
function inheritedChoices(tx: DbLike, presentId: string, accountId: string): Record<string, string> {
  const rows = tx
    .select({
      accountId: schema.accountPresents.accountId,
      resolvedChoices: schema.accountPresents.resolvedChoices,
    })
    .from(schema.accountPresents)
    .where(eq(schema.accountPresents.presentId, presentId))
    .all()
    .filter((r) => r.resolvedChoices);
  const own = rows.find((r) => r.accountId === accountId);
  const donor = own ?? rows[0];
  if (!donor?.resolvedChoices) return {};
  try {
    return JSON.parse(donor.resolvedChoices) as Record<string, string>;
  } catch {
    return {};
  }
}

export function dispatchPendingDraws(
  accountId: string,
  trigger: "cron" | "manual",
  tx: DbLike = db,
  /** 继承触发它的 scan 的批次，这样一轮里的 draw 会归到同一条队列项下 */
  batch?: { id: string; kind: "run" | "scan" | "draw" | "single" },
): string[] {
  const pending = tx
    .select({ presentId: schema.accountPresents.presentId })
    .from(schema.accountPresents)
    .where(
      and(
        eq(schema.accountPresents.accountId, accountId),
        eq(schema.accountPresents.status, "pending"),
      ),
    )
    .all();
  if (pending.length === 0) return [];

  // 已在队列里/正在跑的 draw 任务覆盖了哪些奖品
  const activeJobs = tx
    .select({ payload: schema.jobs.payload })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, "draw"), inArray(schema.jobs.status, ["queued", "running"])))
    .all();
  const busy = new Set(
    activeJobs
      .map((j) => JSON.parse(j.payload) as { accountId?: string; presentId?: string })
      .filter((p) => p.accountId === accountId)
      .map((p) => p.presentId),
  );

  const created: string[] = [];
  for (const row of pending) {
    if (busy.has(row.presentId)) continue;

    const present = tx
      .select({ link: schema.presents.link })
      .from(schema.presents)
      .where(eq(schema.presents.id, row.presentId))
      .get();
    if (!present) continue;

    const jobId = randomUUID();
    tx.insert(schema.jobs)
      .values({
        id: jobId,
        kind: "draw",
        status: "queued",
        payload: JSON.stringify({
          accountId,
          presentId: row.presentId,
          presentLink: present.link,
          // 跨账号复用：别的账号选过的直接带上，B 账号不会再被挂起等选择
          resolvedChoices: inheritedChoices(tx, row.presentId, accountId),
        }),
        // createdAt 是队列排序键，必须毫秒唯一（见 lib/stamp.ts）
        createdAt: nextStamp(),
        batchId: batch?.id ?? null,
        batchKind: batch?.kind ?? null,
        trigger,
      })
      .run();
    created.push(jobId);
  }
  return created;
}

/**
 * 用户在选择页选完后，以 resolvedChoices 重新派发该奖品的 draw。
 * 状态回到 pending 由调用方负责（见 /api/choices 路由）。
 */
export function dispatchResolvedDraw(
  accountId: string,
  presentId: string,
  resolvedChoices: Record<string, string>,
): string | null {
  // 手动针对单个奖品的操作自成一批（batchKind='single'），
  // 队列上显示成「单独重跑 · <奖品名>」，与「一轮」区分开
  const present = db
    .select({ link: schema.presents.link })
    .from(schema.presents)
    .where(eq(schema.presents.id, presentId))
    .get();
  if (!present) return null;

  const jobId = randomUUID();
  db.insert(schema.jobs)
    .values({
      id: jobId,
      kind: "draw",
      status: "queued",
      payload: JSON.stringify({ accountId, presentId, presentLink: present.link, resolvedChoices }),
      trigger: "manual",
      createdAt: nextStamp(),
      batchId: randomUUID(),
      batchKind: "single",
    })
    .run();
  return jobId;
}
