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
      <main style={wrap}>
        <p>读取中…</p>
      </main>
    );
  }

  const total = data.unknownPatterns.length + data.unrecognizedSources.length;

  return (
    <main style={wrap}>
      <h1>诊断</h1>
      <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
        runner 遇到没见过的页面版式时会安全中止并回传现场（不会瞎点）。这里列出待处理的现场，
        据此在 <code>apps/runner/src/cosme/patterns/</code> 加一个新模式即可。
      </p>

      {total === 0 && (
        <p style={{ marginTop: "2rem", opacity: 0.7 }}>
          ✅ 目前没有未识别的页面 —— 所有遇到的版式都有对应实现。
        </p>
      )}

      {data.unrecognizedSources.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={h2}>列表来源未识别（{data.unrecognizedSources.length}）</h2>
          {data.unrecognizedSources.map((s) => (
            <Card key={s.source} title={`来源：${s.source}`} subtitle={s.note} at={s.at} diagnostics={s.diagnostics} />
          ))}
        </section>
      )}

      {data.unknownPatterns.length > 0 && (
        <section style={{ marginTop: "2rem" }}>
          <h2 style={h2}>投递流程未识别（{data.unknownPatterns.length}）</h2>
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

      <nav style={{ marginTop: "2.5rem", display: "flex", gap: "1rem" }}>
        <a href="/">← 首页</a>
        <a href="/records">记录</a>
      </nav>
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
    <div style={card}>
      <div style={{ display: "flex", gap: "0.75rem", alignItems: "baseline", flexWrap: "wrap" }}>
        <strong style={{ flex: 1 }}>{title}</strong>
        {at && <span style={{ fontSize: "0.8rem", opacity: 0.6 }}>{at}</span>}
      </div>
      {subtitle && <p style={{ fontSize: "0.85rem", opacity: 0.75, margin: "0.35rem 0 0" }}>{subtitle}</p>}

      {!diagnostics && (
        <p style={{ fontSize: "0.85rem", opacity: 0.6, marginTop: "0.5rem" }}>
          （没有现场包 —— 可能是旧记录，或 runner 采集失败）
        </p>
      )}

      {diagnostics && (
        <>
          <dl style={dl}>
            <dt style={dt}>卡在</dt>
            <dd style={dd}>
              <code style={{ wordBreak: "break-all" }}>{diagnostics.url}</code>
            </dd>
            <dt style={dt}>标题</dt>
            <dd style={dd}>{diagnostics.title || "—"}</dd>
            {diagnostics.triedPatterns.length > 0 && (
              <>
                <dt style={dt}>已试模式</dt>
                <dd style={dd}>
                  {diagnostics.triedPatterns.map((t) => (
                    <div key={t.name} style={{ fontSize: "0.85rem" }}>
                      <code>{t.name}</code> — {t.reason}
                    </div>
                  ))}
                </dd>
              </>
            )}
          </dl>

          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            <button type="button" onClick={() => setOpen((v) => !v)}>
              {open ? "收起" : `展开元素清单（${diagnostics.elements.length}）`}
            </button>
            <button type="button" onClick={copyElements}>
              {copied ? "已复制 ✓" : "复制元素清单"}
            </button>
          </div>

          {open && <ElementTable elements={diagnostics.elements} />}

          {diagnostics.bodyExcerpt && (
            <details style={{ marginTop: "0.75rem" }}>
              <summary style={{ cursor: "pointer", fontSize: "0.9rem" }}>正文摘要</summary>
              <p style={{ fontSize: "0.8rem", opacity: 0.8, whiteSpace: "pre-wrap" }}>{diagnostics.bodyExcerpt}</p>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function ElementTable({ elements }: { elements: InspectedElement[] }) {
  return (
    <div style={{ overflowX: "auto", marginTop: "0.75rem" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem" }}>
        <thead>
          <tr>
            <th style={th}>标签</th>
            <th style={th}>类型</th>
            <th style={th}>建议选择器</th>
            <th style={th}>文本</th>
          </tr>
        </thead>
        <tbody>
          {elements.map((e, i) => (
            <tr key={`${e.selector}-${i}`}>
              <td style={td}>{e.tag}</td>
              <td style={td}>{e.type ?? "—"}</td>
              <td style={{ ...td, fontFamily: "monospace" }}>{e.selector}</td>
              <td style={td}>{e.text.slice(0, 60)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const wrap: React.CSSProperties = { maxWidth: 900, margin: "2.5rem auto", padding: "0 1.5rem" };
const h2: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.75rem" };
const card: React.CSSProperties = {
  padding: "1rem 1.15rem",
  border: "1px solid var(--border, #8884)",
  borderRadius: 14,
  marginBottom: "0.85rem",
};
const dl: React.CSSProperties = { display: "grid", gridTemplateColumns: "auto 1fr", gap: "0.3rem 0.9rem", marginTop: "0.6rem" };
const dt: React.CSSProperties = { fontSize: "0.85rem", opacity: 0.6 };
const dd: React.CSSProperties = { fontSize: "0.85rem", margin: 0 };
const th: React.CSSProperties = { textAlign: "left", padding: "0.35rem 0.5rem", opacity: 0.65, fontWeight: 500 };
const td: React.CSSProperties = { padding: "0.35rem 0.5rem", borderTop: "1px solid var(--border, #8883)", verticalAlign: "top" };
