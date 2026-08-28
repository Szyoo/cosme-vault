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
 *
 * 状态 chip 与色条段都**可点下钻**（用户要求）：modal 列出该账号该状态的奖品
 * 一览与进一步操作。是客户端组件（点击态 + modal state），因此不收 `t`
 * （字典有函数、不能跨 RSC 边界），用 useT() 自取；输入全是可序列化纯值。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";
import type { Dict } from "@/i18n/dict.ts";
import { statusOf } from "./labels.ts";
import { AccountActions } from "./account-actions.tsx";
import type { PresentItem } from "./present-item.ts";
import { GoneFix } from "./gone-fix.tsx";

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

/** 允许从下钻 modal 重置回待投递的状态（与 reset API 的白名单一致） */
const RESETTABLE = new Set(["failed", "unknownPattern", "expired", "gone"]);

export interface AccountRow {
  accountId: string;
  label: string;
  enabled: boolean;
  /** 状态 → 条数 */
  counts: Record<string, number>;
}

/** 下钻目标：某账号 × 某状态；status 为 "missing" 时列未建记录的奖品 */
interface Drill {
  accountId: string;
  accountLabel: string;
  status: string;
}

export function AccountMatrix({
  rows,
  totalPresents,
  items,
}: {
  rows: AccountRow[];
  totalPresents: number;
  items: PresentItem[];
}) {
  const t = useT();
  const [drill, setDrill] = useState<Drill | null>(null);

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
          const open = (status: string) => setDrill({ accountId: r.accountId, accountLabel: r.label, status });
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

              {/* 堆叠条：一眼看出这个账号的构成，缺口就是「未建记录」；段可点下钻 */}
              <div className="acct-bar" role="img" aria-label={`${tracked}/${totalPresents}`}>
                {ORDER.map((k) => {
                  const n = r.counts[k] ?? 0;
                  if (n === 0) return null;
                  return (
                    <button
                      key={k}
                      type="button"
                      className="acct-seg"
                      style={{ width: `${(n / totalPresents) * 100}%`, background: SEG[k] }}
                      title={`${statusOf(k, t).label} ${n}`}
                      onClick={() => open(k)}
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
                    <button key={k} type="button" className={`pill pill-btn ${st.pill}`} onClick={() => open(k)}>
                      {st.label} <span className="num">{n}</span>
                    </button>
                  );
                })}
                {missing > 0 && (
                  <button type="button" className="pill pill-btn" title={t.matrix.missingHint} onClick={() => open("missing")}>
                    {t.matrix.missing} <span className="num">{missing}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {drill && <DrillModal drill={drill} items={items} t={t} onClose={() => setDrill(null)} />}
    </section>
  );
}

/**
 * 下钻 modal：某账号某状态的奖品一览 + 进一步操作。
 *
 * 与奖品详情的拦截路由 modal 是两套机制（这里是纯客户端临时视图，URL 不需要真实），
 * 但**外观用同一套 class**（modal-backdrop / modal-panel，用户要求所有 modal 同款）。
 * 列表数据不另拉接口：首页的 `PresentItem[]` 已带每账号状态，client 过滤即可，
 * 重置成功后 `router.refresh()`，SSE/props 更新会让列表与计数自己变。
 */
function DrillModal({
  drill,
  items,
  t,
  onClose,
}: {
  drill: Drill;
  items: PresentItem[];
  t: Dict;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  // 与 ModalShell 同款行为：Esc 关闭 + 打开期间锁背景滚动（手机上尤其重要）
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const list = useMemo(() => {
    if (drill.status === "missing") {
      // 未建记录 = 这个账号在该奖品上没有任何 AccountState
      return items.filter((i) => !i.accounts.some((a) => a.accountId === drill.accountId));
    }
    return items.filter((i) =>
      i.accounts.some((a) => a.accountId === drill.accountId && a.status === drill.status),
    );
  }, [items, drill]);

  const statusLabel = drill.status === "missing" ? t.matrix.missing : statusOf(drill.status, t).label;
  const resettable = RESETTABLE.has(drill.status);

  async function reset(presentId?: string) {
    setBusy(true);
    try {
      await fetch("/api/account-presents/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          presentId
            ? { accountId: drill.accountId, presentId }
            : { accountId: drill.accountId, fromStatus: drill.status },
        ),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-panel" role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={onClose} aria-label="close">
          ✕
        </button>
        <div className="modal-body">
          <div className="section-name">{drill.accountLabel}</div>
          <h2 className="mm-title">{t.matrix.drill(statusLabel, list.length)}</h2>
          {drill.status === "missing" && <p className="tiny muted">{t.matrix.missingDrillHint}</p>}
          {resettable && list.length > 0 && (
            <div className="row spread mm-toolbar">
              <span className="tiny muted">{t.matrix.drillHintReset}</span>
              <button type="button" className="btn-ghost btn-small" disabled={busy} onClick={() => void reset()}>
                {t.matrix.resetAll(list.length)}
              </button>
            </div>
          )}

          {list.length === 0 ? (
            <p className="small muted">{t.matrix.drillEmpty}</p>
          ) : (
            <ul className="mm-list">
              {list.map((i) => {
                const st = i.accounts.find((a) => a.accountId === drill.accountId);
                return (
                  <li key={i.presentId} className="mm-row">
                    {i.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图
                      <img className="mm-img" src={i.imageUrl} alt="" loading="lazy" width={44} height={44} />
                    ) : (
                      <span className="mm-img mm-img-none" aria-hidden />
                    )}
                    <div className="mm-main">
                      {/* 点名字进奖品详情（拦截路由 modal 会盖在上面；先关本 modal 避免叠两层遮罩） */}
                      <Link className="mm-name" href={`/presents/${i.presentId}`} onClick={onClose} title={i.title}>
                        {i.title}
                      </Link>
                      <div className="mm-meta tiny muted">
                        {i.brand && <span>{i.brand}</span>}
                        {i.period && <span className="num">{i.period}</span>}
                        {st?.at && <span className="num">{st.at}</span>}
                      </div>
                      {/* 该账号在这条上的结论依据（reason 落在 error 里） */}
                      {st?.error && <div className="mm-err tiny" title={st.error}>{st.error}</div>}
                    </div>
                    <div className="mm-acts">
                      {drill.status === "needsChoice" && (
                        <Link
                          className="btn btn-small"
                          href={`/choices/${i.presentId}?account=${drill.accountId}`}
                          onClick={onClose}
                        >
                          {t.matrix.goChoose}
                        </Link>
                      )}
                      {/* 404 给完整改判（含回待投递）；其余可重置态给一键回待投递 */}
                      {drill.status === "gone" ? (
                        <GoneFix accountId={drill.accountId} presentId={i.presentId} />
                      ) : (
                        resettable && (
                          <button
                            type="button"
                            className="btn-ghost btn-small"
                            disabled={busy}
                            onClick={() => void reset(i.presentId)}
                          >
                            {t.matrix.resetOne}
                          </button>
                        )
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
