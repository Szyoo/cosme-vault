/**
 * 设置页：cosme 账号管理与凭证录入。
 *
 * 安全约定：凭证输入框永远是空的——服务端不回显已存的值，只显示「已配置」状态。
 * 留空提交 = 不改动该字段。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountSummary } from "@cosme/contract";
import { Nav } from "../nav.tsx";
import { BarkSection } from "./bark-section.tsx";
import { useT } from "@/i18n/context.tsx";
import type { Dict } from "@/i18n/dict.ts";

export default function SettingsPage() {
  const t = useT();
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const res = await fetch("/api/accounts");
    if (res.ok) {
      const data = (await res.json()) as { accounts: AccountSummary[] };
      setAccounts(data.accounts);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function addAccount(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/accounts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ label: newLabel.trim() }),
      });
      setNewLabel("");
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function removeAccount(id: string, label: string) {
    if (!confirm(t.settings.confirmDelete(label))) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    await reload();
  }

  async function toggleEnabled(a: AccountSummary) {
    await fetch(`/api/accounts/${a.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !a.enabled }),
    });
    await reload();
  }

  return (
    <main className="page">
      <Nav current="/settings" t={t} />

      <h1 className="page-title">{t.settings.title}</h1>

      <section className="section">
        <div className="section-name">{t.settings.accounts}</div>
        <p className="page-sub">{t.settings.accountsHint}</p>

        <form className="row section" onSubmit={addAccount}>
          <input
            className="field"
            placeholder={t.settings.newLabel}
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn" disabled={busy || !newLabel.trim()}>
            {t.settings.add}
          </button>
        </form>

        {accounts.length === 0 && (
          <div className="empty">
            <div>👤</div>
            <p>{t.settings.empty}</p>
          </div>
        )}

        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            t={t}
            account={a}
            onSaved={async (msg) => {
              setMessage(msg);
              await reload();
            }}
            onToggle={() => void toggleEnabled(a)}
            onDelete={() => void removeAccount(a.id, a.label)}
          />
        ))}

        {message && <p className="ok-text">{message}</p>}
      </section>

      <BarkSection />

    </main>
  );
}

function AccountCard({
  t,
  account,
  onSaved,
  onToggle,
  onDelete,
}: {
  t: Dict;
  account: AccountSummary;
  onSaved: (msg: string) => Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  // 预填已存的值（用户要求：配置完点开要能看见，否则没法核对）。
  // 密码刻意不回显也不预填：placeholder 提示「已设置，留空不改」。
  const c0 = account.credentials;
  const [form, setForm] = useState({
    email: c0.email,
    password: "",
    name: c0.profile.name,
    age: c0.profile.age,
    job: c0.profile.job,
  });
  const [saving, setSaving] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${account.id}/credentials`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          profile: { name: form.name, age: form.age, job: form.job },
        }),
      });
      // 只清密码输入（避免明文停留在页面上）；其余字段就是当前配置，保留显示
      setForm((f) => ({ ...f, password: "" }));
      setOpen(false);
      await onSaved(res.ok ? t.settings.saved(account.label) : t.settings.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  const c = account.credentials;
  return (
    <div className="glass spot diag-card">
      <div className="row spread">
        <strong>{account.label}</strong>
        <span className="small">
          {c.configured ? `🔑 ${t.settings.credConfigured}` : `⚠️ ${t.settings.credMissing}`}
          {c.filledFields.length > 0 && `（${c.filledFields.join(", ")}）`}
        </span>
        <button type="button" className="btn-ghost btn-small" onClick={onToggle}>
          {account.enabled ? t.settings.disable : t.settings.enable}
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
          {open ? t.settings.collapse : t.settings.fillCred}
        </button>
        <button type="button" className="btn-ghost danger btn-small" onClick={onDelete}>
          {t.settings.delete}
        </button>
      </div>

      {open && (
        <form className="stack section" onSubmit={save}>
          <p className="tiny muted">{t.settings.credHint}</p>
          <input
            className="field"
            placeholder={t.settings.email}
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="field"
            type="password"
            placeholder={c.hasPassword ? t.settings.passwordSet : t.settings.password}
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            className="field"
            placeholder={t.settings.realName}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            className="field"
            placeholder={t.settings.age}
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
          <input
            className="field"
            placeholder={t.settings.job}
            value={form.job}
            onChange={(e) => setForm({ ...form, job: e.target.value })}
          />
          <button type="submit" className="btn" disabled={saving}>
            {saving ? t.settings.saving : t.settings.save}
          </button>
        </form>
      )}
    </div>
  );
}
