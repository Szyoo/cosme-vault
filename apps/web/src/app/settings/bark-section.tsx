/**
 * 设置页的 Bark 推送区块。
 *
 * server 与 deviceKey **原样回显**（用户要求可见）：它是推送地址不是登录凭证，
 * 泄露的后果只是可能收到垃圾通知，在 Bark App 里重置一下 key 即可。
 * 「发测试推送」是配置对错的最直观校验——手机响一下比任何提示都可信。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/i18n/context.tsx";

interface BarkCfg {
  server: string;
  deviceKey: string;
  source: "db" | "env" | "none";
}

export function BarkSection() {
  const t = useT();
  const [cfg, setCfg] = useState<BarkCfg | null>(null);
  const [server, setServer] = useState("");
  const [deviceKey, setDeviceKey] = useState("");
  const [busy, setBusy] = useState<null | "save" | "test">(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/bark");
    if (!res.ok) return;
    const data = (await res.json()) as BarkCfg;
    setCfg(data);
    setServer(data.server);
    setDeviceKey(data.deviceKey);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setBusy("save");
    setMsg(null);
    try {
      const res = await fetch("/api/settings/bark", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ server: server.trim(), deviceKey: deviceKey.trim() }),
      });
      const body = (await res.json().catch(() => ({}))) as BarkCfg & { error?: string };
      setMsg(res.ok ? t.barkSettings.saved : (body.error ?? t.settings.saveFailed));
      if (res.ok) setCfg(body);
    } finally {
      setBusy(null);
    }
  }

  async function test() {
    setBusy("test");
    setMsg(null);
    try {
      const res = await fetch("/api/settings/bark", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setMsg(res.ok ? t.barkSettings.testSent : (body.error ?? t.barkSettings.testFailed));
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="glass section">
      <div className="section-name">{t.barkSettings.title}</div>
      <p className="tiny muted">{t.barkSettings.hint}</p>
      {cfg?.source === "env" && <p className="tiny muted">{t.barkSettings.fromEnv}</p>}
      {cfg?.source === "none" && <p className="small warn-text">{t.barkSettings.notConfigured}</p>}

      <div className="stack" style={{ marginTop: 10 }}>
        <input
          className="field"
          placeholder={t.barkSettings.server}
          value={server}
          onChange={(e) => setServer(e.target.value)}
          inputMode="url"
        />
        <input
          className="field"
          placeholder={t.barkSettings.deviceKey}
          value={deviceKey}
          onChange={(e) => setDeviceKey(e.target.value)}
        />
      </div>

      <div className="actions">
        <button type="button" className="btn" onClick={() => void save()} disabled={busy !== null}>
          {busy === "save" ? t.barkSettings.saving : t.barkSettings.save}
        </button>
        <button type="button" className="btn-ghost" onClick={() => void test()} disabled={busy !== null}>
          {busy === "test" ? t.barkSettings.testing : t.barkSettings.test}
        </button>
        {msg && <span className="small muted">{msg}</span>}
      </div>
    </section>
  );
}
