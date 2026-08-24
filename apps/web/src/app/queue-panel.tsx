/**
 * 任务队列面板 —— **按批次**显示。
 *
 * 用户的操作单位是「跑一轮」和「单独重跑」，不是「一个奖品一个 job」。
 * 原先逐条列 job，一轮就变成上百条「任务」，看着像队列爆了（用户指出这会让人误会
 * 且没必要）。现在一轮 = 一条，带进度条；单独重跑 = 一条，标着奖品名。
 *
 * 内部的逐个奖品仍然存在（幂等与去重都依赖它），只是收进可展开的明细里，不再是默认视图。
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
    <section className="glass section">
      <div className="section-name">
        {t.runner.queueTitle}
        {batches.length > 0 && (
          <span className="filter-count num" style={{ marginLeft: 8 }}>
            {batches.length}
          </span>
        )}
      </div>

      {batches.length === 0 ? (
        <p className="small muted">{t.runner.queueEmpty}</p>
      ) : (
        <>
          <p className="tiny muted">{t.runner.queueHint}</p>
          <ol className="qlist">
            {batches.map((b, i) => {
              const finished = b.done + b.failed;
              const pct = b.total > 0 ? Math.round((finished / b.total) * 100) : 0;
              return (
                <li key={b.batchId} className={`qrow${b.running > 0 ? " qrow-running" : ""}`}>
                  <span className="qpos num">{b.running > 0 ? "▶" : i + 1}</span>
                  <span className="qmain">
                    <span className="qlabel">
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
                      <span className="qbar" aria-label={`${finished}/${b.total}`}>
                        <span className="qbar-fill" style={{ width: `${pct}%` }} />
                      </span>
                    )}

                    <span className="qmeta">
                      {b.running > 0 && <span className="pill amber">{t.runner.nowRunning}</span>}
                      {b.total > 1 && (
                        <span className="prow-tag num">{t.runner.batchProgress(finished, b.total)}</span>
                      )}
                      {b.failed > 0 && <span className="prow-tag err">{t.runner.batchFailed(b.failed)}</span>}
                      <span className="prow-tag muted">{b.trigger}</span>
                      <span className="prow-tag muted num">{fmtDateTime(b.firstAt)}</span>
                      {b.currentLabel && b.kind !== "single" && (
                        <span className="prow-tag">{b.currentLabel}</span>
                      )}
                    </span>
                  </span>
                  <BatchActions batchId={b.batchId} canMoveUp={i > 0} queued={b.queued} />
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
