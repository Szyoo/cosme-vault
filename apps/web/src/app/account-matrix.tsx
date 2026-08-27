/**
 * 账号 × 状态矩阵：首页的核心概览。
 *
 * 为什么取代原来的四张统计卡（用户明确不满）：那四张卡是**全账号加总**，
 * 且只算了 已投递/待投递/待选择——`unknownPattern`、`failed`、`expired`/`gone`
 * 一个都不在里面，于是数字既不闭合、也看不出「哪个账号跑到哪」。
 *
 * 这里保证一条**恒等式**并显式呈现：
 *   每个账号：各状态之和 + 未建记录 = 奖品总数
 * 「未建记录」是扫描还没覆盖到该账号的奖品（新账号或半途中断），
 * 以前完全隐形——正是「一个账号扫完了、另一个没扫」看不出来的原因。
 */
import type { Dict } from "@/i18n/dict.ts";
import { statusOf } from "./labels.ts";
import { AccountActions } from "./account-actions.tsx";

/** 状态展示顺序：先「好结果」，再「等你」，最后「有问题」 */
const ORDER = ["drawn", "alreadyEntered", "needsChoice", "pending", "unknownPattern", "failed", "expired", "gone"] as const;

/** 各状态在堆叠条里的配色（与 pill 同一套语义） */
const SEG: Record<string, string> = {
  drawn: "var(--ok)",
  alreadyEntered: "var(--ok)",
  needsChoice: "var(--accent2)",
  pending: "color-mix(in srgb, var(--text) 22%, transparent)",
  unknownPattern: "var(--warn)",
  failed: "var(--err)",
  // 已下架给黄——之前用淡灰，进度条上和「待投递」的灰分不出区别（用户指出）；
  // 404 给红——它要么是站点异常撤了页面，要么是我们的链接有错，都值得人瞟一眼
  expired: "var(--warn)",
  gone: "var(--err)",
};

export interface AccountRow {
  accountId: string;
  label: string;
  enabled: boolean;
  /** 状态 → 条数 */
  counts: Record<string, number>;
}

export function AccountMatrix({
  rows,
  totalPresents,
  t,
}: {
  rows: AccountRow[];
  totalPresents: number;
  t: Dict;
}) {
  return (
    <section className="glass section">
      <div className="row spread">
        <div className="section-name">{t.matrix.title}</div>
        <span className="tiny muted">{t.matrix.totalPresents(totalPresents)}</span>
      </div>
      <p className="tiny muted">{t.matrix.hint}</p>

      <div className="stack" style={{ marginTop: 10 }}>
        {rows.map((r) => {
          const tracked = ORDER.reduce((n, k) => n + (r.counts[k] ?? 0), 0);
          const missing = Math.max(0, totalPresents - tracked);
          // 恒等式核对：任何时候都该成立；不成立就把差额显示出来而不是掩盖
          const balanced = tracked + missing === totalPresents;
          return (
            <div key={r.accountId} className="acct">
              <div className="acct-head">
                <strong className="acct-name">{r.label}</strong>
                {!r.enabled && <span className="pill">{t.matrix.disabled}</span>}
                <span className="acct-total num">
                  {tracked} / {totalPresents}
                  {balanced ? "" : " ⚠"}
                </span>
              </div>

              {/* 堆叠条：一眼看出这个账号的构成，缺口就是「未建记录」 */}
              <div className="acct-bar" role="img" aria-label={`${tracked}/${totalPresents}`}>
                {ORDER.map((k) => {
                  const n = r.counts[k] ?? 0;
                  if (n === 0) return null;
                  return (
                    <span
                      key={k}
                      className="acct-seg"
                      style={{ width: `${(n / totalPresents) * 100}%`, background: SEG[k] }}
                      title={`${statusOf(k, t).label} ${n}`}
                    />
                  );
                })}
              </div>

              {/* 单账号触发：只跑这一个账号（全局按钮在 Runner 卡里） */}
              <AccountActions accountId={r.accountId} label={r.label} />

              <div className="acct-chips">
                {ORDER.map((k) => {
                  const n = r.counts[k] ?? 0;
                  if (n === 0) return null;
                  const st = statusOf(k, t);
                  return (
                    <span key={k} className={`pill ${st.pill}`}>
                      {st.label} <span className="num">{n}</span>
                    </span>
                  );
                })}
                {missing > 0 && (
                  <span className="pill" title={t.matrix.missingHint}>
                    {t.matrix.missing} <span className="num">{missing}</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
