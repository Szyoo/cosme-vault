/**
 * 任务队列面板 —— **按批次**显示。
 *
 * 用户的操作单位是「跑一轮」和「单独重跑」，不是「一个奖品一个 job」。
 * 原先逐条列 job，一轮就变成上百条「任务」，看着像队列爆了，容易让人误会
 * 且没必要。现在一轮 = 一条，带进度条；单独重跑 = 一条，标着奖品名。
 *
 * 内部的逐个奖品仍然存在（幂等与去重都依赖它），只是收进可展开的明细里，不再是默认视图。
 *
 * 行用设计包的 `.list > .list-row`：首段序号（执行中换成呼吸的 `.dot.warn`）、中段标题 + 进度条 + 参数、尾段操作。
 */
import type { Dict } from "@/i18n/dict.ts";
import { fmtDateTime } from "@/lib/when.ts";
import type { QueueBatch } from "@/lib/queue-view.ts";
import { BatchActions } from "./batch-actions.tsx";

export function QueuePanel({
  batches,
  hidden,
  t,
}: {
  batches: QueueBatch[];
  hidden: number;
  t: Dict;
}) {
  return (
    <section className="glass panel section">
      <div className="section-name">
        {t.runner.queueTitle}
        {batches.length > 0 && (
          <span className="badge neutral qcount">{batches.length}</span>
        )}
      </div>

      {batches.length === 0 ? (
        <p className="small muted">{t.runner.queueEmpty}</p>
      ) : (
        <>
          <p className="tiny muted">{t.runner.queueHint}</p>
          <ol className="list u-mt-3">
            {batches.map((b, i) => {
              const finished = b.done + b.failed;
              const pct = b.total > 0 ? Math.round((finished / b.total) * 100) : 0;
              return (
                <li key={b.batchId} className={`list-row${b.running > 0 ? " qrow-running" : ""}`}>
                  <span className="row-lead num">
                    {b.running > 0 ? <span className="dot warn pulse" aria-label={t.runner.nowRunning} /> : i + 1}
                  </span>
                  <span className="row-main">
                    <span className="row-title">
                      {b.kind === "run"
                        ? t.runner.batchRun
                        : b.kind === "scan"
                          ? t.runner.batchScan
                          : b.kind === "draw"
                            ? t.runner.batchDraw
                            : b.kindDetail === "login"
                              ? t.runner.batchLogin
                              : t.runner.batchSingle}
                      {b.label && <span className="qsub"> · {b.label}</span>}
                    </span>

                    {/* 多任务的批次才有进度可言；单个任务显示进度条没有信息量 */}
                    {b.total > 1 && (
                      <span className="bar" aria-label={`${finished}/${b.total}`}>
                        <span className="bar-fill" style={{ width: `${pct}%` }} />
                      </span>
                    )}

                    <span className="item-meta">
                      {b.running > 0 && <span className="pill warn">{t.runner.nowRunning}</span>}
                      {b.total > 1 && (
                        <span className="item-tag num">{t.runner.batchProgress(finished, b.total)}</span>
                      )}
                      {b.failed > 0 && <span className="item-tag err">{t.runner.batchFailed(b.failed)}</span>}
                      <span className="item-tag muted">{b.trigger}</span>
                      <span className="item-tag muted num">{fmtDateTime(b.firstAt)}</span>
                      {b.currentLabel && b.kind !== "single" && (
                        <span className="item-tag">{b.currentLabel}</span>
                      )}
                    </span>
                  </span>
                  <span className="row-end">
                    <BatchActions batchId={b.batchId} canMoveUp={i > 0} queued={b.queued} />
                  </span>
                </li>
              );
            })}
          </ol>
          {hidden > 0 && <p className="tiny muted">{t.runner.queueMore(hidden)}</p>}
        </>
      )}
    </section>
  );
}
