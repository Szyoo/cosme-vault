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

interface UnknownPattern {
  presentId: string;
  accountId: string;
  name: string | null;
  brand: string | null;
  link: string | null;
  updatedAt: string;
  diagnostics: PatternDiagnostics | null;
}

interface UnrecognizedSource {
  source: string;
  note: string;
  at: string | null;
  diagnostics: PatternDiagnostics | null;
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<{
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
        <p>读取中…</p>
      </main>
    );
  }

  const total = data.unknownPatterns.length + data.unrecognizedSources.length;

  return (
    <main className="page">
      <h1 className="page-title">诊断</h1>
      <p className="page-sub">
        runner 遇到没见过的页面版式时会安全中止并回传现场（不会瞎点）。这里列出待处理的现场，
        据此在 <code>apps/runner/src/cosme/patterns/</code> 加一个新模式即可。
      </p>

      {total === 0 && (
        <div className="empty">
          <div>✅</div>
          <p>目前没有未识别的页面 —— 所有遇到的版式都有对应实现。</p>
        </div>
      )}

      {data.unrecognizedSources.length > 0 && (
        <section className="section">
          <div className="section-name">列表来源未识别（{data.unrecognizedSources.length}）</div>
          {data.unrecognizedSources.map((s) => (
            <Card key={s.source} title={`来源：${s.source}`} subtitle={s.note} at={s.at} diagnostics={s.diagnostics} />
          ))}
        </section>
      )}

      {data.unknownPatterns.length > 0 && (
        <section className="section">
          <div className="section-name">投递流程未识别（{data.unknownPatterns.length}）</div>
          {data.unknownPatterns.map((u) => (
            <Card
              key={`${u.accountId}-${u.presentId}`}
              title={`${u.brand ? `${u.brand} · ` : ""}${u.name ?? u.presentId}`}
              subtitle={u.link ?? ""}
              at={u.updatedAt}
              diagnostics={u.diagnostics}
            />
          ))}
        </section>
      )}

      <Nav current="/diagnostics" />
    </main>
  );
}

function Card({
  title,
  subtitle,
  at,
  diagnostics,
}: {
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
          （没有现场包 —— 可能是旧记录，或 runner 采集失败）
        </p>
      )}

      {diagnostics && (
        <>
          <dl className="kv">
            <dt>卡在</dt>
            <dd>
              <code className="mono tiny">{diagnostics.url}</code>
            </dd>
            <dt>标题</dt>
            <dd>{diagnostics.title || "—"}</dd>
            {diagnostics.triedPatterns.length > 0 && (
              <>
                <dt>已试模式</dt>
                <dd>
                  {diagnostics.triedPatterns.map((t) => (
                    <div key={t.name} className="tiny">
                      <code>{t.name}</code> — {t.reason}
                    </div>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <div className="actions">
            <button type="button" className="btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
              {open ? "收起" : `展开元素清单（${diagnostics.elements.length}）`}
            </button>
            <button type="button" className="btn-ghost btn-small" onClick={copyElements}>
              {copied ? "已复制 ✓" : "复制元素清单"}
            </button>
          </div>

          {open && <ElementTable elements={diagnostics.elements} />}

          {diagnostics.bodyExcerpt && (
            <details className="section">
              <summary className="small">正文摘要</summary>
              <p className="tiny muted" style={{ whiteSpace: "pre-wrap" }}>{diagnostics.bodyExcerpt}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ElementTable({ elements }: { elements: InspectedElement[] }) {
  return (
    <div className="table-wrap">
      <table className="tbl">
        <thead>
          <tr>
            <th>标签</th>
            <th>类型</th>
            <th>建议选择器</th>
            <th>文本</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((e, i) => (
            <tr key={`${e.selector}-${i}`}>
              <td>{e.tag}</td>
              <td>{e.type ?? "—"}</td>
              <td className="mono tiny">{e.selector}</td>
              <td>{e.text.slice(0, 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

