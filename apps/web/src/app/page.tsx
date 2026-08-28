/**
 * 控制面首页：runner 状态 + 手动跑一轮 + 奖品与待处理项概览。
 * 样式一律用 @szyyw/design 的类（.glass / .stat-grid / .pill / .term …），
 * 不硬编码颜色——规范要求新颜色先进 tokens.css。
 *
 * 版面顺序（用户定的）：**导航在最上**，然后状态与统计，接着运行日志，
 * 最后才是奖品列表。理由是奖品有 138 条、很长，放在最后才不会把日志和
 * 操作按钮顶到看不见的地方；导航放底部则等于要滚完整页才能换页。
 */
import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { reclaimStaleJobs } from "@/lib/queue.ts";
import { db, schema } from "@/db/index.ts";
import { getRunnerStatus } from "@/lib/runner-status.ts";
import { loadQueue } from "@/lib/queue-view.ts";
import { formatAgo } from "@/lib/ago.ts";
import { fmtLogTime } from "@/lib/when.ts";
import { getT } from "@/i18n/server.ts";
import { RunButton } from "./run-button.tsx";
import { StopButton } from "./stop-button.tsx";
import { QueuePanel } from "./queue-panel.tsx";
import { Nav } from "./nav.tsx";
import { LiveRefresh } from "./live-refresh.tsx";
import { PresentList } from "./present-list.tsx";
import { TermLog } from "./term-log.tsx";
import { AccountMatrix, type AccountRow } from "./account-matrix.tsx";
import { ResolveButtons } from "./resolve-buttons.tsx";
import { toItems } from "./present-item.ts";
import { mergeStatus } from "./labels.ts";

export const dynamic = "force-dynamic";

export default async function Home() {
  const t = await getT();

  // ⚠️ 僵死任务的回收**不能只挂在 next-job 上**：那条路径要等 runner 来领任务才触发，
  // 而 runner 崩掉时恰恰没人来领——任务就永远挂在 running，界面上永远显示「执行中」。
  // 所以控制台每次渲染顺手回收一次（一条 UPDATE，绝大多数时候什么都不匹配）。
  // 回收只把任务与奖品标成 failed + 「请人工确认」，**不会自动重投**（会重复应募）。
  reclaimStaleJobs();

  const runner = getRunnerStatus();
  const queue = loadQueue();
  // 「任务」一律按用户的操作单位数（跑一轮=1、单独重跑=1），别再数内部 job——
  // 曾在这里显示「25 个任务在排队」，其实那是一轮里的 25 个奖品（用户指出误导）
  const queuedBatches = queue.batches.filter((b) => b.queued > 0).length;

  const rows = db
    .select({
      presentId: schema.accountPresents.presentId,
      accountId: schema.accountPresents.accountId,
      status: schema.accountPresents.status,
      pattern: schema.accountPresents.pattern,
      error: schema.accountPresents.error,
      name: schema.presents.name,
      brand: schema.presents.brand,
      imageUrl: schema.presents.imageUrl,
      link: schema.presents.link,
      period: schema.presents.period,
      quantity: schema.presents.quantity,
      source: schema.presents.source,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .all();

  const logs = db.select().from(schema.runnerLogs).orderBy(desc(schema.runnerLogs.id)).limit(20).all();

  // 矩阵数据：奖品总数（全局唯一，多账号共享）+ 每账号各状态计数
  const totalPresents = db.select({ id: schema.presents.id }).from(schema.presents).all().length;
  const accountList = db.select().from(schema.accounts).all();
  const accountRows: AccountRow[] = accountList.map((a) => {
    const counts: Record<string, number> = {};
    for (const r of rows) {
      if (r.accountId !== a.id) continue;
      // 归并后再计数，否则「已投递」与「站点已应募」会出两个同名 chip
      const k = mergeStatus(r.status);
      counts[k] = (counts[k] ?? 0) + 1;
    }
    return { accountId: a.id, label: a.label, enabled: a.enabled, counts };
  });
  // 矩阵下钻 modal 与奖品列表共用同一份已本地化数据（纯字符串，可跨 RSC 边界）
  const items = toItems(rows, accountList, t);

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const needsChoice = rows.filter((r) => r.status === "needsChoice");
  const unknown = rows.filter((r) => r.status === "unknownPattern");
  // failed 多半是「投递中断、结果未知」——必须人工去原页面确认，不能埋在 138 条列表里
  const needsConfirm = rows.filter((r) => r.status === "failed");

  // 最近一次扫描里有没有「来源版式没认出来」
  const lastScan = db
    .select({ result: schema.jobs.result })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, "scan"), eq(schema.jobs.status, "done")))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1)
    .get();
  const unrecognizedSources = (() => {
    if (!lastScan?.result) return 0;
    const outcome = (JSON.parse(lastScan.result) as { outcome?: { sourceReports?: { recognized?: boolean }[] } })
      .outcome;
    return (outcome?.sourceReports ?? []).filter((r) => r.recognized === false).length;
  })();
  const diagnosticsCount = unknown.length + unrecognizedSources;

  return (
    <main className="page">
      <Nav current="/" diagnosticsCount={diagnosticsCount} t={t} />

      <h1 className="page-title grad-text">{t.appName}</h1>
      <p className="page-sub">{t.appSub}</p>

      <section className="glass spot section">
        <div className="row spread">
          <div>
            <div className="section-name">{t.runner.title}</div>
            {/* ⚠️ 「执行中」只在**在线**时才成立。心跳行里的 busyJobId 是上次心跳那一刻的
                快照，离线时照抄它就会渲染出「离线 · 执行中」这种自相矛盾的一行（踩过）。 */}
            <p className="small">
              {runner.kind === "online" ? (
                <>
                  {`🟢 ${t.runner.online}${where(runner.location)} · `}
                  {runner.busy ? t.runner.busy : t.runner.idle}
                </>
              ) : runner.kind === "offline" ? (
                `⚪️ ${t.runner.offline}${where(runner.location)} · ${t.runner.lastSeen(
                  formatAgo(runner.agoMs, t),
                )}`
              ) : (
                `⚪️ ${t.runner.offline} · ${t.runner.noHeartbeat}`
              )}
            </p>
          </div>
          <div className="row">
            <StopButton queued={queuedBatches} />
            <RunButton />
          </div>
        </div>

        {/* runner 不在的时候，光看「待投递 131」会以为在跑，实际什么都不会发生 */}
        {runner.kind !== "online" && (
          <p className="small warn-text">
            {queuedBatches > 0 ? `${t.runner.offlineQueued(queuedBatches)} ` : ""}
            {t.runner.startHint}
          </p>
        )}
        {runner.kind === "offline" && runner.wasBusy && (
          <p className="small warn-text">{t.runner.diedMidJob}</p>
        )}

        <p className="tiny muted">{t.runner.runHint}</p>
        {/* 自动刷新是这一页的固有行为，用一句话说明，不给开关（见 live-refresh.tsx） */}
        <p className="tiny muted">{t.runner.autoRefresh}</p>
        <LiveRefresh />
      </section>

      {/* 账号 × 状态矩阵（取代原来的四张加总卡：那些卡不含未知模式/失败，
          数字不闭合也看不出各账号进度——见 account-matrix.tsx 的说明） */}
      <AccountMatrix rows={accountRows} totalPresents={totalPresents} items={items} />

      {needsChoice.length > 0 && (
        <section className="glass section">
          <div className="section-name">{t.choice.needsChoiceTitle}</div>
          <div className="stack">
            {needsChoice.map((r) => (
              <Link
                key={`${r.accountId}-${r.presentId}`}
                className="inner row spread"
                href={`/choices/${r.presentId}?account=${r.accountId}`}
              >
                <span>
                  {r.brand && <strong>{r.brand} · </strong>}
                  {r.name ?? r.presentId}
                </span>
                <span className="pill violet">{t.choice.goChoose}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {needsConfirm.length > 0 && (
        <section className="glass section">
          <div className="section-name">{t.attention.needsConfirm}</div>
          <p className="tiny muted">{t.attention.needsConfirmHint}</p>
          <div className="stack" style={{ marginTop: 10 }}>
            {needsConfirm.map((r) => (
              // 整块不能是 <a>：里面有按钮，嵌套交互元素点不准（奖品名单独给链接）
              <div key={`${r.accountId}-${r.presentId}`} className="inner row spread">
                <span style={{ minWidth: 0 }}>
                  <Link href={`/presents/${r.presentId}`}>
                    {r.brand && <strong>{r.brand} · </strong>}
                    {r.name ?? r.presentId}
                  </Link>
                  {r.error && <span className="tiny muted"> — {r.error}</span>}
                </span>
                <ResolveButtons accountId={r.accountId} presentId={r.presentId} link={r.link} />
              </div>
            ))}
          </div>
        </section>
      )}

      {diagnosticsCount > 0 && (
        <section className="glass section">
          <div className="section-name">{t.diag.banner(diagnosticsCount)}</div>
          <p className="small">
            {t.diag.bannerHint} <a href="/diagnostics">{t.diag.title} →</a>
          </p>
        </section>
      )}

      <QueuePanel batches={queue.batches} hidden={queue.hidden} t={t} />

      {/* 终端窗：设计规范第 9 节，日志刻意保持深色。放在奖品列表**之前**——
          奖品有一百多条，日志排在后面就等于永远看不见。
          复制/贴底跟随在客户端组件里（行已在服务端格式化好，字典函数不跨界）。 */}
      <TermLog
        live={runner.kind === "online"}
        lines={logs
          .slice()
          .reverse()
          .map((l) => ({ key: l.id, time: fmtLogTime(l.at) ?? "", level: l.level, text: l.text, jobId: l.jobId }))}
      />

      <section className="glass section">
        <div className="section-name">{t.present.listTitle}</div>
        {rows.length === 0 ? (
          <div className="empty">
            <div>🎁</div>
            <p>{t.present.emptyHint}</p>
          </div>
        ) : (
          <PresentList items={items} />
        )}
      </section>
    </main>
  );
}

/**
 * runner 所在位置。
 * ⚠️ `unknown` 是 contract 里 `RUNNER_LOCATION` 未设时的**枚举默认值**，
 * 原先被原样印成「🟢 在线 · unknown · 执行中」——内部枚举值不该给人看，
 * 取不到位置就干脆不显示这一段（用户为此问过）。
 */
function where(location: string): string {
  return location && location !== "unknown" ? ` · ${location}` : "";
}

