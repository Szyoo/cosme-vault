/**
 * 规则页主体。
 *
 * 版面为什么是「类型 → 分类 → 词条 chip」三层：
 * 九十多条词平铺出来根本没法看，也无从判断某一类是不是缺词。分类只影响展示、
 * 不影响匹配（匹配一律是子串命中），所以合并显示是纯粹的可读性收益。
 * 词条用 chip 换行排布——一类十几条也就占两三行，一屏能装下全部三种类型。
 *
 * 「查」= 点开一条词看它在**已采集的真实题库**里命中了什么（survey_captures，
 * 114 份问卷 3000+ 选项）。沿用诊断页那套「聚合成一条 + 计数 pill + 展开看现场」，
 * 因为解决的是同一类问题：不必再上站点复现，就能判断这条规则是不是还有效。
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/i18n/context.tsx";
import type { Dict } from "@/i18n/dict.ts";

export interface RuleView {
  id: string;
  kind: "answer" | "manual" | "negation";
  category: string;
  keyword: string;
  enabled: boolean;
  note: string | null;
  builtin: boolean;
  hitCount: number;
}

interface Hit {
  presentId: string;
  prompt: string;
  label: string;
  suppressedBy: string | null;
}

const KINDS = ["answer", "manual", "negation"] as const;

/** 内置分类有三语标签，用户自建的分类（字典里没有）原样显示 */
function catLabel(t: Dict, slug: string): string {
  const map = t.rules.cat as Record<string, string | undefined>;
  return map[slug] ?? slug;
}

export function RulesView({ initial }: { initial: RuleView[] }) {
  const t = useT();
  const [rules, setRules] = useState(initial);
  const [q, setQ] = useState("");
  const [onlyDisabled, setOnlyDisabled] = useState(false);
  const [onlyNoHits, setOnlyNoHits] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  /** 改完一条就地更新，不整页刷新——否则展开的那条会合上、筛选也会丢 */
  function patchLocal(id: string, patch: Partial<RuleView>) {
    setRules((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }
  function removeLocal(id: string) {
    setRules((rs) => rs.filter((r) => r.id !== id));
    setOpenId((cur) => (cur === id ? null : cur));
  }

  // 反转标记集合：用于提示「这条词同时也是反转标记，永远不会生效」
  const negationSet = useMemo(
    () => new Set(rules.filter((r) => r.kind === "negation" && r.enabled).map((r) => r.keyword)),
    [rules],
  );

  const shown = useMemo(() => {
    const needle = q.normalize("NFKC").toLowerCase().trim();
    return rules.filter((r) => {
      if (onlyDisabled && r.enabled) return false;
      if (onlyNoHits && r.hitCount > 0) return false;
      if (!needle) return true;
      return `${r.keyword} ${r.category} ${catLabel(t, r.category)} ${r.note ?? ""}`
        .normalize("NFKC")
        .toLowerCase()
        .includes(needle);
    });
  }, [rules, q, onlyDisabled, onlyNoHits, t]);

  const filtering = q.trim() !== "" || onlyDisabled || onlyNoHits;

  return (
    <>
      <div className="filters">
        <input className="field filter-search" placeholder={t.rules.search} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="filter-row">
          <FilterChip active={onlyDisabled} onClick={() => setOnlyDisabled((v) => !v)} label={t.rules.onlyDisabled} count={rules.filter((r) => !r.enabled).length} />
          <FilterChip active={onlyNoHits} onClick={() => setOnlyNoHits((v) => !v)} label={t.rules.onlyNoHits} count={rules.filter((r) => r.hitCount === 0).length} />
          {filtering && (
            <button type="button" className="btn-ghost btn-small" onClick={() => { setQ(""); setOnlyDisabled(false); setOnlyNoHits(false); }}>
              {t.rules.reset}
            </button>
          )}
        </div>
      </div>

      {KINDS.map((kind) => {
        const inKind = shown.filter((r) => r.kind === kind);
        const allInKind = rules.filter((r) => r.kind === kind);
        // 按分类合并；分类内按「有无命中」再按词长排，形同虚设的词自然浮到末尾
        const byCat = new Map<string, RuleView[]>();
        for (const r of inKind) {
          const list = byCat.get(r.category);
          if (list) list.push(r);
          else byCat.set(r.category, [r]);
        }
        const cats = [...byCat.entries()].sort((a, b) => b[1].length - a[1].length);

        return (
          <section key={kind} className="section">
            <div className="section-name row spread">
              <span>
                {kind === "answer" ? t.rules.kindAnswer : kind === "manual" ? t.rules.kindManual : t.rules.kindNegation}
                <span className="tiny muted num" style={{ marginInlineStart: 8 }}>
                  {t.rules.countOf(allInKind.filter((r) => r.enabled).length, allInKind.length)}
                </span>
              </span>
            </div>
            <p className="tiny muted rule-hint">
              {kind === "answer" ? t.rules.kindAnswerHint : kind === "manual" ? t.rules.kindManualHint : t.rules.kindNegationHint}
            </p>

            {cats.length === 0 ? (
              <p className="tiny muted">{t.rules.empty}</p>
            ) : (
              cats.map(([cat, list]) => (
                <div key={cat} className="rule-cat">
                  <div className="rule-cat-name">
                    {catLabel(t, cat)}
                    <span className="tiny muted num"> {list.length}</span>
                  </div>
                  <div className="rule-chips">
                    {list
                      .slice()
                      .sort((a, b) => (b.hitCount > 0 ? 1 : 0) - (a.hitCount > 0 ? 1 : 0) || a.keyword.length - b.keyword.length)
                      .map((r) => (
                        <RuleChip
                          key={r.id}
                          r={r}
                          t={t}
                          open={openId === r.id}
                          conflict={r.kind === "answer" && negationSet.has(r.keyword)}
                          onToggleOpen={() => setOpenId((cur) => (cur === r.id ? null : r.id))}
                        />
                      ))}
                  </div>
                  {/* 详情就地展开在分类下方：chip 本身不变形，行不会跳来跳去 */}
                  {list.some((r) => r.id === openId) && (
                    <RuleDetail
                      r={rules.find((x) => x.id === openId)!}
                      t={t}
                      onPatch={patchLocal}
                      onRemove={removeLocal}
                      onClose={() => setOpenId(null)}
                    />
                  )}
                </div>
              ))
            )}
          </section>
        );
      })}

      <AddRule t={t} onAdded={(r) => setRules((rs) => [...rs, r])} />
    </>
  );
}

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button type="button" className={`chip filter-chip${active ? " active" : ""}`} onClick={onClick}>
      {label}
      <span className="filter-count num">{count}</span>
    </button>
  );
}

function RuleChip({ r, t, open, conflict, onToggleOpen }: { r: RuleView; t: Dict; open: boolean; conflict: boolean; onToggleOpen: () => void }) {
  return (
    <button
      type="button"
      className={`chip rule-chip${open ? " active" : ""}${r.enabled ? "" : " off"}`}
      onClick={onToggleOpen}
      title={conflict ? t.rules.conflictHint : r.note || undefined}
    >
      <span className="rule-kw">{r.keyword}</span>
      <span className={`rule-hit num${r.hitCount === 0 ? " zero" : ""}`}>{r.hitCount}</span>
      {conflict && <span className="rule-warn" aria-hidden>⚠</span>}
    </button>
  );
}

function RuleDetail({
  r,
  t,
  onPatch,
  onRemove,
  onClose,
}: {
  r: RuleView;
  t: Dict;
  onPatch: (id: string, patch: Partial<RuleView>) => void;
  onRemove: (id: string) => void;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [kw, setKw] = useState(r.keyword);
  const [cat, setCat] = useState(r.category);
  const [note, setNote] = useState(r.note ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [hits, setHits] = useState<{ total: number; hits: Hit[] } | null>(null);

  // 展开即拉命中流水（一条规则一次请求，不预先算全部——101 条全查太重）。
  // 换一条词时 r.id 变化会重新拉；`alive` 防止上一条的响应盖掉当前这条。
  useEffect(() => {
    let alive = true;
    setHits(null);
    void fetch(`/api/rules/${r.id}/hits`)
      .then((res) => res.json())
      .then((d: { total: number; hits: Hit[] }) => alive && setHits(d))
      .catch(() => alive && setHits({ total: 0, hits: [] }));
    return () => {
      alive = false;
    };
  }, [r.id]);

  async function send(patch: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/rules/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const d = (await res.json()) as { error?: string };
      if (!res.ok) {
        setErr(d.error ?? "");
        return false;
      }
      onPatch(r.id, patch as Partial<RuleView>);
      return true;
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/rules/${r.id}`, { method: "DELETE" });
    const d = (await res.json()) as { error?: string };
    setBusy(false);
    if (!res.ok) {
      setErr(d.error ?? "");
      return;
    }
    onRemove(r.id);
  }

  return (
    <div className="glass spot rule-detail">
      <div className="row spread">
        <strong className="rule-detail-kw">{r.keyword}</strong>
        <span className="row" style={{ gap: 6 }}>
          <span className={`pill ${r.enabled ? "" : "amber"}`}>{r.enabled ? t.rules.hits(r.hitCount) : t.rules.disabled}</span>
          <button type="button" className="btn-ghost btn-small" onClick={onClose}>
            {t.rules.cancel}
          </button>
        </span>
      </div>

      {editing ? (
        <div className="stack rule-edit">
          <input className="field" value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t.rules.addKeyword} />
          <input className="field" value={cat} onChange={(e) => setCat(e.target.value)} placeholder={t.rules.addCategory} />
          <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.rules.addNote} />
          <div className="actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={() => void send({ keyword: kw.trim(), category: cat.trim(), note }).then((ok) => ok && setEditing(false))}
            >
              {t.rules.save}
            </button>
            <button type="button" className="btn-ghost btn-small" onClick={() => { setEditing(false); setKw(r.keyword); setCat(r.category); setNote(r.note ?? ""); }}>
              {t.rules.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="actions">
          <button type="button" className="btn-ghost btn-small" disabled={busy} onClick={() => void send({ enabled: !r.enabled })}>
            {r.enabled ? t.rules.disable : t.rules.enable}
          </button>
          <button type="button" className="btn-ghost btn-small" onClick={() => setEditing(true)}>
            {t.rules.edit}
          </button>
          {/* 出厂词不给删除按钮：删了就没有复原依据，停用同样能达到不生效的目的 */}
          <button
            type="button"
            className="btn-ghost btn-small"
            disabled={busy || r.builtin}
            title={r.builtin ? t.rules.builtinNoDelete : undefined}
            onClick={() => void remove()}
          >
            {t.rules.remove}
          </button>
        </div>
      )}

      {err && <p className="tiny" style={{ color: "var(--danger, #e66)" }}>{err}</p>}
      {r.note && !editing && <p className="tiny muted">{r.note}</p>}

      <div className="section-name rule-hits-head">
        {t.rules.hitsTitle}
        {hits && <span className="tiny muted"> — {t.rules.hitsSub(hits.total)}</span>}
      </div>
      {!hits ? (
        <p className="tiny muted">…</p>
      ) : hits.hits.length === 0 ? (
        <p className="tiny muted">{t.rules.hitsEmpty}</p>
      ) : (
        <>
          <ul className="rule-hits">
            {hits.hits.map((h, i) => (
              <li key={`${h.presentId}-${i}`} className={h.suppressedBy ? "suppressed" : undefined}>
                <span className="rule-hit-label">{h.label}</span>
                <span className="tiny muted rule-hit-meta">
                  {h.prompt ? `${h.prompt.slice(0, 60)} · ` : ""}
                  {h.presentId}
                </span>
                {h.suppressedBy && <span className="tiny rule-hit-warn">{t.rules.suppressedBy(h.suppressedBy)}</span>}
              </li>
            ))}
          </ul>
          {hits.total > hits.hits.length && <p className="tiny muted">{t.rules.hitsMore(hits.total - hits.hits.length)}</p>}
        </>
      )}
    </div>
  );
}

function AddRule({ t, onAdded }: { t: Dict; onAdded: (r: RuleView) => void }) {
  const [kind, setKind] = useState<"answer" | "manual" | "negation">("answer");
  const [cat, setCat] = useState("custom");
  const [kw, setKw] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, category: cat.trim() || "custom", keyword: kw.trim(), note }),
      });
      const d = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !d.id) {
        setErr(d.error ?? "");
        return;
      }
      onAdded({
        id: d.id,
        kind,
        category: cat.trim() || "custom",
        keyword: kw.trim(),
        enabled: true,
        note: note.trim() || null,
        builtin: false,
        // 新词的命中数要重算，这里先按 0 显示；刷新页面即是准确值
        hitCount: 0,
      });
      setKw("");
      setNote("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section">
      <div className="section-name">{t.rules.add}</div>
      <form className="stack rule-add" onSubmit={(e) => void submit(e)}>
        <div className="row rule-add-row">
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
            <option value="answer">{t.rules.kindAnswer}</option>
            <option value="manual">{t.rules.kindManual}</option>
            <option value="negation">{t.rules.kindNegation}</option>
          </select>
          <input className="field" value={cat} onChange={(e) => setCat(e.target.value)} placeholder={t.rules.addCategory} />
        </div>
        <input className="field" value={kw} onChange={(e) => setKw(e.target.value)} placeholder={t.rules.addKeyword} required />
        <input className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.rules.addNote} />
        <div className="actions">
          <button type="submit" className="btn btn-small" disabled={busy || !kw.trim()}>
            {t.rules.submit}
          </button>
        </div>
        {err && <p className="tiny" style={{ color: "var(--danger, #e66)" }}>{err}</p>}
      </form>
    </section>
  );
}
