/**
 * 设置页的「投递节奏」区块。
 *
 * 存在的理由（用户原话大意）：这类数值必须能在设置里看到、能改，
 * 不能埋在代码里等人从对话中察觉再追问。runner 每次心跳后拉取，
 * 保存 ≤15 秒生效，无需重启。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/context.tsx";

interface Range {
  min: number;
  max: number;
}
interface Cfg {
  stepDelayMs: Range;
  betweenPresentsMs: Range;
}

export function PacingSection() {
  const t = useT();
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/pacing");
    if (res.ok) setCfg((await res.json()) as Cfg);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!cfg) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/settings/pacing", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(cfg),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? t.pacing.saved : (body.error ?? t.settings.saveFailed));
    } finally {
      setBusy(false);
    }
  }

  if (!cfg) return null;

  const rangeRow = (label: string, key: keyof Cfg) => (
    <div className="pace-row">
      <span className="small" style={{ flex: 1, minWidth: 200 }}>{label}</span>
      <label className="pace-field">
        <span className="tiny muted">{t.pacing.min}</span>
        <input
          className="field"
          type="number"
          min={0}
          step={100}
          value={cfg[key].min}
          onChange={(e) => setCfg({ ...cfg, [key]: { ...cfg[key], min: Number(e.target.value) } })}
        />
      </label>
      <label className="pace-field">
        <span className="tiny muted">{t.pacing.max}</span>
        <input
          className="field"
          type="number"
          min={0}
          step={100}
          value={cfg[key].max}
          onChange={(e) => setCfg({ ...cfg, [key]: { ...cfg[key], max: Number(e.target.value) } })}
        />
      </label>
    </div>
  );

  return (
    <section className="glass section">
      <div className="section-name">{t.pacing.title}</div>
      <p className="tiny muted">{t.pacing.hint}</p>
      <div className="stack" style={{ marginTop: 10 }}>
        {rangeRow(t.pacing.between, "betweenPresentsMs")}
        {rangeRow(t.pacing.step, "stepDelayMs")}
      </div>
      <div className="actions">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy}>
          {busy ? t.pacing.saving : t.pacing.save}
        </button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </section>
  );
}
