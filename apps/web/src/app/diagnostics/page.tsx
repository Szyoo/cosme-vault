/**
 * 诊断页：把「runner 没认出来的东西」摊开给人看，用于补写新 pattern / 解析器。
 *
 * @COSME 奖品分多类别、每类多模式、DOM 各不相同。runner 遇到没见过的版式时
 * 不会瞎点，而是安全中止并回传现场；这一页就是那些现场的落地展示。
 *
 * 元素清单支持一键复制 —— 拿去直接对着写选择器，通常不必再上站点复现。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { InspectedElement, PatternDiagnostics } from "@cosme/contract";
import { Nav } from "../nav.tsx";
import { useT } from "@/i18n/context.tsx";
import type { Dict } from "@/i18n/dict.ts";

interface UnknownPattern {
  presentId: string;
  accountId: string;
  name: string | null;
  brand: string | null;
  link: string | null;
  updatedAt: string;
  diagnostics: PatternDiagnostics | null;
}

interface Anomaly {
  fingerprint: string;
  url: string;
  title: string;
  triedPatterns: { name: string; reason: string }[];
  elements: InspectedElement[];
  bodyExcerpt: string;
  screenshot: string | null;
  htmlSnapshot: string | null;
  seenCount: number;
  firstSeenAt: string;
  lastSeenAt: string;
  affected: { presentId: string; accountId: string; name: string | null; brand: string | null }[];
}

interface UnrecognizedSource {
  source: string;
  note: string;
  at: string | null;
  diagnostics: PatternDiagnostics | null;
}

export default function DiagnosticsPage() {
  const t = useT();
  const [data, setData] = useState<{
    anomalies: Anomaly[];
    unknownPatterns: UnknownPattern[];
    unrecognizedSources: UnrecognizedSource[];
  } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/diagnostics");
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) {
    return (
      <main className="page">
        <Nav current="/diagnostics" t={t} />
        <p>{t.common.loading}</p>
      </main>
    );
  }

  const total = data.anomalies.length + data.unrecognizedSources.length;

  return (
    <main className="page">
      <Nav current="/diagnostics" t={t} />

      <h1 className="page-title">{t.diag.title}</h1>
      <p className="page-sub">
        {t.diag.sub} <code>apps/runner/src/cosme/patterns/</code>
      </p>

      {total === 0 && (
        <div className="empty">
          <div>✅</div>
          <p>{t.diag.none}</p>
        </div>
      )}

      {/* 异常聚合（主视图）：一种异常一张卡，带可视证据与出现次数 */}
      {data.anomalies.length > 0 && (
        <section className="section">
          <div className="section-name">
            {t.diag.anomalies}（{data.anomalies.length}）
          </div>
          {data.anomalies.map((a) => (
            <AnomalyCard key={a.fingerprint} a={a} t={t} onResolved={() => void load()} />
          ))}
        </section>
      )}

      {data.unrecognizedSources.length > 0 && (
        <section className="section">
          <div className="section-name">
            {t.diag.unrecognizedSources}（{data.unrecognizedSources.length}）
          </div>
          {data.unrecognizedSources.map((s) => (
            <Card key={s.source} t={t} title={s.source} subtitle={s.note} at={s.at} diagnostics={s.diagnostics} />
          ))}
        </section>
      )}

      {data.unknownPatterns.length > 0 && (
        <section className="section">
          <div className="section-name">{t.diag.unknownFlows}（{data.unknownPatterns.length}）</div>
          {data.unknownPatterns.map((u) => (
            <Card
              key={`${u.accountId}-${u.presentId}`}
              t={t}
              title={`${u.brand ? `${u.brand} · ` : ""}${u.name ?? u.presentId}`}
              subtitle={u.link ?? ""}
              at={u.updatedAt}
              diagnostics={u.diagnostics}
            />
          ))}
        </section>
      )}

    </main>
  );
}

/**
 * 一种异常的现场卡。
 *
 * 「可视证据」是硬要求（用户）：优先显示截图；截图缺失时用 **sandbox iframe**
 * 还原 HTML 快照——留给人看的是页面，不是 DOM 文本。元素清单收在折叠里，
 * 需要写选择器时再展开。
 */
function AnomalyCard({ a, t, onResolved }: { a: Anomaly; t: Dict; onResolved: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  async function resolve() {
    setBusy(true);
    try {
      const res = await fetch(`/api/diagnostics/${a.fingerprint}`, { method: "PATCH" });
      if (res.ok) onResolved();
    } finally {
      setBusy(false);
    }
  }

  async function copyElements() {
    await navigator.clipboard
      .writeText(a.elements.map((e) => `${e.tag}\t${e.type ?? ""}\t${e.selector}\t${e.text}`).join("\n"))
      .catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="glass spot diag-card">
      <div className="row spread">
        <strong>{a.title || a.url}</strong>
        <span className="row" style={{ gap: 8 }}>
          <span className="pill amber">{t.diag.seenTimes(a.seenCount)}</span>
          {a.affected.length > 0 && <span className="pill">{t.diag.affected(a.affected.length)}</span>}
        </span>
      </div>
      <p className="tiny muted" style={{ wordBreak: "break-all" }}>
        <code>{a.url}</code>
      </p>

      {/* 可视证据 */}
      {a.screenshot ? (
        // eslint-disable-next-line @next/next/no-img-element -- data URI 截图
        <img className="diag-shot" src={a.screenshot} alt="" />
      ) : a.htmlSnapshot ? (
        <iframe
          className="diag-shot"
          sandbox=""
          title={a.title || a.url}
          srcDoc={a.htmlSnapshot}
        />
      ) : (
        <p className="tiny muted">{t.diag.noVisual}</p>
      )}

      {a.triedPatterns.length > 0 && (
        <dl className="kv">
          <dt>{t.diag.triedPatterns}</dt>
          <dd>
            {a.triedPatterns.map((x) => (
              <div key={x.name} className="tiny">
                <code>{x.name}</code> — {x.reason}
              </div>
            ))}
          </dd>
        </dl>
      )}

      <div className="actions">
        <button type="button" className="btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
          {open ? t.diag.collapse : t.diag.expandElements(a.elements.length)}
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => void copyElements()}>
          {copied ? t.diag.copied : t.diag.copyElements}
        </button>
        <button type="button" className="btn btn-small" onClick={() => void resolve()} disabled={busy}>
          {busy ? "…" : t.diag.markResolved}
        </button>
      </div>

      {open && <ElementTable elements={a.elements} t={t} />}

      {a.bodyExcerpt && (
        <details className="section">
          <summary className="small">{t.diag.bodyExcerpt}</summary>
          <p className="tiny muted" style={{ whiteSpace: "pre-wrap" }}>{a.bodyExcerpt}</p>
        </details>
      )}
    </div>
  );
}

function Card({
  t,
  title,
  subtitle,
  at,
  diagnostics,
}: {
  t: Dict;
  title: string;
  subtitle: string;
  at: string | null;
  diagnostics: PatternDiagnostics | null;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  async function copyElements() {
    if (!diagnostics) return;
    const text = diagnostics.elements
      .map((e) => `${e.tag}\t${e.type ?? ""}\t${e.selector}\t${e.text}`)
      .join("\n");
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="glass spot diag-card">
      <div className="row spread">
        <strong>{title}</strong>
        {at && <span className="tiny muted num">{at}</span>}
      </div>
      {subtitle && <p className="small muted">{subtitle}</p>}

      {!diagnostics && (
        <p className="small muted">
          {t.diag.noBundle}
        </p>
      )}

      {diagnostics && (
        <>
          <dl className="kv">
            <dt>{t.diag.stuckAt}</dt>
            <dd>
              <code className="mono tiny">{diagnostics.url}</code>
            </dd>
            <dt>{t.diag.pageTitle}</dt>
            <dd>{diagnostics.title || t.common.none}</dd>
            {diagnostics.triedPatterns.length > 0 && (
              <>
                <dt>{t.diag.triedPatterns}</dt>
                <dd>
                  {diagnostics.triedPatterns.map((tried) => (
                    <div key={tried.name} className="tiny">
                      <code>{tried.name}</code> — {tried.reason}
                    </div>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <div className="actions">
            <button type="button" className="btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
              {open ? t.diag.collapse : t.diag.expandElements(diagnostics.elements.length)}
            </button>
            <button type="button" className="btn-ghost btn-small" onClick={copyElements}>
              {copied ? t.diag.copied : t.diag.copyElements}
            </button>
          </div>

          {open && <ElementTable elements={diagnostics.elements} t={t} />}

          {diagnostics.bodyExcerpt && (
            <details className="section">
              <summary className="small">{t.diag.bodyExcerpt}</summary>
              <p className="tiny muted" style={{ whiteSpace: "pre-wrap" }}>{diagnostics.bodyExcerpt}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ElementTable({ elements, t }: { elements: InspectedElement[]; t: Dict }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>{t.diag.tag}</th>
            <th>{t.diag.kind}</th>
            <th>{t.diag.selector}</th>
            <th>{t.diag.text}</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((e, i) => (
            <tr key={`${e.selector}-${i}`}>
              <td>{e.tag}</td>
              <td>{e.type ?? t.common.none}</td>
              <td className="mono tiny">{e.selector}</td>
              <td>{e.text.slice(0, 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

