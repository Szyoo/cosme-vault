/**
 * 任务队列服务：控制面侧的 pull 模型实现。
 * runner 领取时把 queued → running 并组装成 contract 的 Job；上报时落库并回写业务状态。
 */
import { randomUUID } from "node:crypto";
import { and, eq, lt } from "drizzle-orm";
import { type Job, type JobReport } from "@cosme/contract";
import { db, schema } from "@/db/index.ts";
import { dispatchPendingDraws } from "@/lib/dispatch.ts";
import { nextStamp } from "@/lib/stamp.ts";

/** 卡死判定阈值：超过这么久还是 running 的任务视为 runner 已崩溃 */
const STALE_RUNNING_MS = 15 * 60 * 1000;

/**
 * 同一个奖品最多自动重排几次。
 * 防的是「这个奖品每次都把 runner 打挂」的循环——那样会反复走确认页 POST。
 */
const MAX_RECLAIM_RETRIES = 2;

/** 数一下这个奖品已经有多少个 draw 任务是被回收掉的（用于止损） */
function countReclaimedDraws(
  tx: Pick<typeof db, "select">,
  accountId: string,
  presentId: string,
): number {
  return tx
    .select({ payload: schema.jobs.payload, error: schema.jobs.error })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, "draw"), eq(schema.jobs.status, "failed")))
    .all()
    .filter((j) => {
      if (!j.error?.includes("超时未上报")) return false;
      try {
        const p = JSON.parse(j.payload) as { accountId?: string; presentId?: string };
        return p.accountId === accountId && p.presentId === presentId;
      } catch {
        return false;
      }
    }).length;
}

/**
 * 回收僵死任务：runner 崩溃/被强杀时任务会永远停在 running。
 *
 * ⚠️ 刻意**不自动重排 draw 任务**：崩溃时我们无法知道那次投递到底有没有提交成功
 * （@COSME 不标注「已应募」，无从查证）。自动重试等于可能重复投递，
 * 故一律标记为 failed 交人工判断——宁可漏一次，不可重复投。
 *
 * ⚠️ 调用点不止 `next-job`：那条路径要等 runner 来领任务才触发，而 runner 崩掉时
 * 恰恰没人来领，任务就永远挂在 running。控制台每次渲染也会调一次（见 app/page.tsx）。
 */
export function reclaimStaleJobs(): number {
  const cutoff = new Date(Date.now() - STALE_RUNNING_MS).toISOString();
  return db.transaction((tx) => {
    const stale = tx
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.status, "running"), lt(schema.jobs.startedAt, cutoff)))
      .all();

    for (const job of stale) {
      tx.update(schema.jobs)
        .set({
          status: "failed",
          error: "任务超时未上报（runner 可能已崩溃），已回收",
          finishedAt: new Date().toISOString(),
        })
        .where(eq(schema.jobs.id, job.id))
        .run();

      // draw 任务要同步回写业务状态，否则记录停在 pending / running 语义不清
      if (job.kind === "draw") {
        const p = JSON.parse(job.payload) as { accountId?: string; presentId?: string };
        if (p.accountId && p.presentId) {
          // ⚠️ 这里的策略在 2026-08-21 改过一次，理由要记住：
          //
          // 原先一律标 failed 交人工确认，前提是「站点不给任何已应募的痕迹，
          // 重跑可能重复投递」。**那个前提只在入口与确认页成立**——问卷页其实会摊牌
          // （题目与送信控件都消失），runner 现在会把它判成 alreadyEntered 并且
          // **什么都不提交**（见 patterns/is-enq-survey.ts 的注释与实测证据）。
          //
          // 所以重跑是安全的：崩在送信之前 → 这次补完；崩在送信之后 → 落到空问卷页
          // 判成已应募。两种情况都最多提交一次。于是默认回 pending 自动重试，
          // 不再让人去原页面肉眼确认。
          //
          // 唯一要防的是**崩溃循环**：同一个奖品反复把 runner 打挂会反复走确认页 POST。
          // 因此累计被回收 MAX_RECLAIM_RETRIES 次之后就停手，标 failed 交人工。
          const reclaimed = countReclaimedDraws(tx, p.accountId, p.presentId);
          const giveUp = reclaimed >= MAX_RECLAIM_RETRIES;
          tx.update(schema.accountPresents)
            .set({
              status: giveUp ? "failed" : "pending",
              error: giveUp
                ? `投递已连续中断 ${reclaimed} 次，不再自动重试，请人工确认是否已应募`
                : "上一次投递中断，已自动重排；若其实已应募，runner 会在问卷页识别出来并跳过",
              updatedAt: new Date().toISOString(),
            })
            .where(
              and(
                eq(schema.accountPresents.accountId, p.accountId),
                eq(schema.accountPresents.presentId, p.presentId),
              ),
            )
            .run();
        }
      }
    }
    return stale.length;
  });
}

/** 领取最早的一个 queued 任务，标记 running，并还原成 contract 的 Job 形状 */
export function claimNextJob(): Job | null {
  reclaimStaleJobs();
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.status, "queued"))
      .orderBy(schema.jobs.createdAt)
      .limit(1)
      .get();
    if (!row) return null;

    tx.update(schema.jobs)
      .set({ status: "running", startedAt: new Date().toISOString() })
      .where(eq(schema.jobs.id, row.id))
      .run();

    const payload = JSON.parse(row.payload) as Record<string, unknown>;
    return { kind: row.kind, id: row.id, ...payload } as Job;
  });
}

/** 入队一个任务，返回 jobId */
export function enqueueJob(
  kind: "scan" | "draw" | "inspect" | "login",
  payload: Record<string, unknown>,
  trigger: "cron" | "manual" = "manual",
): string {
  const id = randomUUID();
  // draw 且调用方没带选择时，继承任意账号已有的选择（跨账号复用，见 dispatch.ts）
  if (kind === "draw" && payload.presentId && payload.accountId && !payload.resolvedChoices) {
    const rows = db
      .select({
        accountId: schema.accountPresents.accountId,
        resolvedChoices: schema.accountPresents.resolvedChoices,
      })
      .from(schema.accountPresents)
      .where(eq(schema.accountPresents.presentId, String(payload.presentId)))
      .all()
      .filter((r) => r.resolvedChoices);
    const donor = rows.find((r) => r.accountId === payload.accountId) ?? rows[0];
    if (donor?.resolvedChoices) {
      try {
        payload = { ...payload, resolvedChoices: JSON.parse(donor.resolvedChoices) as unknown };
      } catch {
        // 坏 JSON 就不带，runner 侧会照常走 needsChoice
      }
    }
  }
  // 手动单点的任务自成一批：队列上显示成「单独重跑 · <奖品名>」，
  // 与「一轮」区分开——用户的操作单位是这两个，不是「一个奖品一个 job」
  db.insert(schema.jobs)
    .values({
      id,
      kind,
      status: "queued",
      payload: JSON.stringify(payload),
      trigger,
      // ⚠️ 显式写毫秒戳：createdAt 就是队列排序键，sqlite 默认值只到秒，
      // 同一批入队的上百条会撞成同一个值，顺序就不可判定了（见 lib/stamp.ts）
      createdAt: nextStamp(),
      batchId: randomUUID(),
      batchKind: "single",
    })
    .run();
  return id;
}

/** applyReport 的副作用：事务内不能 await，故把待推送的通知带出来由调用方发送 */
export interface ReportEffects {
  /** 需要用户在网页上做选择的奖品 */
  needsChoice: { accountId: string; presentId: string }[];
  /** 遇到未知页面模式（需要补 pattern） */
  unknownPattern: { accountId: string; presentId: string }[];
  /** 自动派发出去的 draw 任务数 */
  dispatchedDraws: number;
}

/** 处理 runner 上报的结果：落 job 结果 + 回写业务表 + 事件驱动地派发后续任务 */
export function applyReport(report: JobReport): ReportEffects {
  const effects: ReportEffects = { needsChoice: [], unknownPattern: [], dispatchedDraws: 0 };
  db.transaction((tx) => {
    tx.update(schema.jobs)
      .set({
        status: report.ok ? "done" : "failed",
        result: JSON.stringify(report),
        error: report.error,
        finishedAt: report.finishedAt,
      })
      .where(eq(schema.jobs.id, report.jobId))
      .run();

    // ⚠️ 不能因 ok=false 就跳过回写：失败的 draw 也必须把状态写进 account_presents，
    // 否则失败在界面上完全看不见、记录永远停在 pending（已踩过）。
    if (!report.outcome) return;

    const outcome = report.outcome;
    // 任何成功任务都是「该账号会话有效」的证明——网页据此决定要不要催「激活登录」
    {
      const jobRow = tx.select().from(schema.jobs).where(eq(schema.jobs.id, report.jobId)).get();
      if (jobRow && report.ok) {
        try {
          const pl = JSON.parse(jobRow.payload) as { accountId?: string };
          // ⚠️ scan **不算**登录证明：奖品列表页未登录也能扫（实测踩过——
          // 第二个账号从没登录，扫描照样 ok，绿标就撒谎了）。
          // 只认必须登录才可能出现的结果：投出去 / 站点判已应募 / 走进问卷等选择，
          // 以及 login 任务亲测的登录态。
          const proven =
            (outcome.kind === "draw" &&
              ["drawn", "alreadyEntered", "needsChoice"].includes(outcome.status)) ||
            (outcome.kind === "login" && outcome.loggedIn);
          if (pl.accountId && proven) {
            tx.update(schema.accounts)
              .set({ sessionOkAt: new Date().toISOString() })
              .where(eq(schema.accounts.id, pl.accountId))
              .run();
          }
        } catch {
          // payload 坏了就不记，无伤大雅
        }
      }
    }

    if (outcome.kind === "scan") {
      // 扫描任务的 accountId 从载荷取，用于建立「该账号 × 该奖品」的待抽记录
      const scanJob = tx.select().from(schema.jobs).where(eq(schema.jobs.id, report.jobId)).get();
      const accountId = scanJob
        ? (JSON.parse(scanJob.payload) as { accountId?: string }).accountId
        : undefined;

      // 有凭证且启用的账号才建记录（没凭证的账号建了也跑不了）
      const enabledAccounts = tx
        .select({
          id: schema.accounts.id,
          enabled: schema.accounts.enabled,
          credentialsEnc: schema.accounts.credentialsEnc,
        })
        .from(schema.accounts)
        .all()
        .filter((a) => a.enabled && a.credentialsEnc);

      for (const p of outcome.presents) {
        // 显式 upsert：奖品 id 取自站点的 present_id，是天然主键。
        // 不用 onConflictDoUpdate(target: link)——那样主键冲突不在处理范围内，重扫会直接报错。
        const existing = tx.select().from(schema.presents).where(eq(schema.presents.id, p.id)).get();
        if (existing) {
          // ⚠️ 空值不覆盖：扫描来自**列表页**，粉丝俱乐部系的列表页没有期间/数量，
          // 这些字段是 audit 之后从**详情页**补的。无条件覆盖会把补好的数据冲成 null
          // （踩过：一次重扫抹掉 57 个期间）。列表页给了新值才更新，否则保留旧值。
          tx.update(schema.presents)
            .set({
              name: p.name,
              brand: p.brand ?? existing.brand,
              imageUrl: p.imageUrl ?? existing.imageUrl,
              period: p.period ?? existing.period,
              quantity: p.quantity ?? existing.quantity,
              tagline: p.tagline ?? existing.tagline,
            })
            .where(eq(schema.presents.id, p.id))
            .run();
        } else {
          tx.insert(schema.presents)
            .values({
              id: p.id,
              source: p.source,
              link: p.link,
              name: p.name,
              brand: p.brand,
              imageUrl: p.imageUrl,
              period: p.period,
              quantity: p.quantity,
              tagline: p.tagline,
              scannedAt: p.scannedAt,
            })
            .run();
        }

        // 为该账号建立待抽记录；已存在则保持原状态不动
        // （关键：绝不能把已投递的记录重置为 pending，否则会重复投递——
        //  @COSME 不标注「已应募」，去重全靠这张表）
        // ⚠️ 扫描结果**与账号无关**（同一个站点的同一批奖品，用户指出）：
        // 为**所有启用账号**建立待投递记录，而不是只给执行扫描的那个账号。
        // 否则新账号必须自己再扫一遍才有记录——白跑一趟且毫无意义
        //（实测后果：第二个账号 59 个奖品「未建记录」，界面上凭空缺一块）。
        // 投递仍严格按账号独立（account_presents 是各账号的去重防线）。
        for (const acc of enabledAccounts) {
          const link = tx
            .select()
            .from(schema.accountPresents)
            .where(
              and(
                eq(schema.accountPresents.accountId, acc.id),
                eq(schema.accountPresents.presentId, p.id),
              ),
            )
            .get();
          if (!link) {
            tx.insert(schema.accountPresents)
              .values({ id: randomUUID(), accountId: acc.id, presentId: p.id, status: "pending" })
              .run();
          }
        }
      }

      // 事件驱动：扫描完成即派发该账号的待抽任务，无需外层状态机。
      // 「仅检测」（batchKind='scan'）刻意不派发——那正是它和「跑一轮」的区别。
      if (accountId && scanJob?.batchKind !== "scan") {
        const trigger = (scanJob?.trigger ?? "manual") as "cron" | "manual";
        // 一轮里派发出的 draw 继承 scan 的批次，界面上才是一条队列项
        effects.dispatchedDraws = dispatchPendingDraws(
          accountId,
          trigger,
          tx,
          scanJob?.batchId
            ? { id: scanJob.batchId, kind: (scanJob.batchKind ?? "run") as "run" | "scan" | "draw" | "single" }
            : undefined,
        ).length;
      }
    } else if (outcome.kind === "draw") {
      // draw 任务的 accountId/presentId 需从 job payload 取
      const job = tx.select().from(schema.jobs).where(eq(schema.jobs.id, report.jobId)).get();
      if (!job) return;
      const p = JSON.parse(job.payload) as { accountId?: string; presentId?: string };
      if (!p.accountId || !p.presentId) return;
      // 顺手采下的问卷题库落库（每奖品保留最新一份），供重建匹配库
      if (outcome.surveyCapture && outcome.surveyCapture.questions.length > 0) {
        tx.insert(schema.surveyCaptures)
          .values({
            presentId: p.presentId,
            url: outcome.surveyCapture.url,
            questions: JSON.stringify(outcome.surveyCapture.questions),
            capturedAt: new Date().toISOString(),
          })
          .onConflictDoUpdate({
            target: schema.surveyCaptures.presentId,
            set: {
              url: outcome.surveyCapture.url,
              questions: JSON.stringify(outcome.surveyCapture.questions),
              capturedAt: new Date().toISOString(),
            },
          })
          .run();
      }

      const row = tx
        .select({ id: schema.accountPresents.id })
        .from(schema.accountPresents)
        .where(
          and(
            eq(schema.accountPresents.accountId, p.accountId),
            eq(schema.accountPresents.presentId, p.presentId),
          ),
        )
        .get();

      const prev = tx
        .select({ drawnAt: schema.accountPresents.drawnAt })
        .from(schema.accountPresents)
        .where(
          and(
            eq(schema.accountPresents.accountId, p.accountId),
            eq(schema.accountPresents.presentId, p.presentId),
          ),
        )
        .get();

      tx.update(schema.accountPresents)
        .set({
          status: outcome.status,
          pattern: outcome.pattern,
          pendingChoices: outcome.pendingChoices.length ? JSON.stringify(outcome.pendingChoices) : null,
          // 未知模式的现场诊断包：供人工据此补写新 pattern
          diagnostics: outcome.diagnostics ? JSON.stringify(outcome.diagnostics) : null,
          // ⚠️ 只在真的投出去时写时间；其余状态**保留原值**。
          // 原先是 `: null`，等于「后续任何一次上报都会抹掉投递时间」——
          // 例如已投递的奖品重跑一次被判 alreadyEntered，投递时间就没了。
          drawnAt: outcome.status === "drawn" ? new Date().toISOString() : (prev?.drawnAt ?? null),
          // ⚠️ 成功/已应募时要**清掉上一次的报错**，否则界面上一直挂着过期的失败原因
          error:
            outcome.status === "drawn" || outcome.status === "alreadyEntered"
              ? null
              : (report.error ?? null),
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(
            eq(schema.accountPresents.accountId, p.accountId),
            eq(schema.accountPresents.presentId, p.presentId),
          ),
        )
        .run();

      if (outcome.status === "needsChoice") {
        effects.needsChoice.push({ accountId: p.accountId, presentId: p.presentId });
      } else if (outcome.status === "unknownPattern" && outcome.diagnostics) {
        // ── 异常聚合 + 可复现性判定（用户设计）──
        //
        // 同一种异常（指纹相同）只留一份现场并累计次数：127 个奖品撞同一个
        // 登录墙 → 1 行 seen_count=127，而不是 127 份重复现场包。
        //
        // 次数即「可复现性」：
        //   首次出现  → 大概率是瞬时问题，**自动排回 pending 下轮重试**，不烦人
        //   再次出现  → 同样的页面又来了，说明可复现、不是偶发 → 交人工
        const d = outcome.diagnostics;
        const fp = d.fingerprint || d.url;
        const existing = tx.select().from(schema.anomalies).where(eq(schema.anomalies.fingerprint, fp)).get();
        const now = new Date().toISOString();
        if (existing) {
          tx.update(schema.anomalies)
            .set({
              seenCount: existing.seenCount + 1,
              lastSeenAt: now,
              // 现场只在首次存（省空间）；截图缺失时后续补上
              screenshot: existing.screenshot ?? d.screenshot ?? null,
              htmlSnapshot: existing.htmlSnapshot ?? d.htmlSnapshot ?? null,
            })
            .where(eq(schema.anomalies.fingerprint, fp))
            .run();
        } else {
          tx.insert(schema.anomalies)
            .values({
              fingerprint: fp,
              url: d.url,
              title: d.title,
              triedPatterns: JSON.stringify(d.triedPatterns),
              elements: JSON.stringify(d.elements),
              bodyExcerpt: d.bodyExcerpt,
              screenshot: d.screenshot ?? null,
              htmlSnapshot: d.htmlSnapshot ?? null,
              seenCount: 1,
              firstSeenAt: now,
              lastSeenAt: now,
            })
            .run();
        }

        // 这个「奖品 × 账号」组合此前撞过同一指纹吗？撞过就是可复现
        const seenBefore = !!existing;
        if (seenBefore) {
          effects.unknownPattern.push({ accountId: p.accountId, presentId: p.presentId });
        } else {
          // 首次：自动重试一次，别惊动人
          tx.update(schema.accountPresents)
            .set({
              status: "pending",
              error: "首次遇到异常，已自动排入下一轮重试（重现才会交人工）",
              updatedAt: now,
            })
            .where(eq(schema.accountPresents.id, row?.id ?? ""))
            .run();
        }
      }
    }
  });
  return effects;
}
