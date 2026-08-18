/**
 * 设置页：cosme 账号管理与凭证录入。
 *
 * 安全约定：凭证输入框永远是空的——服务端不回显已存的值，只显示「已配置」状态。
 * 留空提交 = 不改动该字段。
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountSummary } from "@cosme/contract";

export default function SettingsPage() {
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
    if (!confirm(`删除账号「${label}」及其全部抽取记录？此操作不可撤销。`)) return;
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
    <main style={{ maxWidth: 720, margin: "3rem auto", padding: "0 1.5rem" }}>
      <h1>设置</h1>

      <section style={{ marginTop: "2rem" }}>
        <h2>cosme 账号</h2>
        <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
          抽奖批次会按顺序轮抽这里启用的账号。凭证经 AES-256-GCM 加密存储，页面不会回显已保存的值。
        </p>

        <form onSubmit={addAccount} style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
          <input
            placeholder="账号备注名（如：主号）"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" disabled={busy || !newLabel.trim()}>
            添加账号
          </button>
        </form>

        {accounts.length === 0 && <p style={{ opacity: 0.6 }}>还没有账号，先添加一个。</p>}

        {accounts.map((a) => (
          <AccountCard
            key={a.id}
            account={a}
            onSaved={async (msg) => {
              setMessage(msg);
              await reload();
            }}
            onToggle={() => void toggleEnabled(a)}
            onDelete={() => void removeAccount(a.id, a.label)}
          />
        ))}

        {message && <p style={{ marginTop: "1rem", opacity: 0.8 }}>{message}</p>}
      </section>
    </main>
  );
}

function AccountCard({
  account,
  onSaved,
  onToggle,
  onDelete,
}: {
  account: AccountSummary;
  onSaved: (msg: string) => Promise<void>;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", age: "", job: "" });
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
      // 提交后立刻清空表单，避免明文停留在页面上
      setForm({ email: "", password: "", name: "", age: "", job: "" });
      setOpen(false);
      await onSaved(res.ok ? `「${account.label}」的凭证已保存` : `保存失败`);
    } finally {
      setSaving(false);
    }
  }

  const c = account.credentials;
  return (
    <div style={{ border: "1px solid var(--border, #8884)", borderRadius: 12, padding: "1rem", marginBottom: "0.75rem" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
        <strong style={{ flex: 1 }}>{account.label}</strong>
        <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>
          {c.configured ? "🔑 凭证已配置" : "⚠️ 凭证未配置"}
          {c.filledFields.length > 0 && `（${c.filledFields.join(", ")}）`}
        </span>
        <button type="button" onClick={onToggle}>
          {account.enabled ? "停用" : "启用"}
        </button>
        <button type="button" onClick={() => setOpen((v) => !v)}>
          {open ? "收起" : "填写凭证"}
        </button>
        <button type="button" onClick={onDelete}>
          删除
        </button>
      </div>

      {open && (
        <form onSubmit={save} style={{ display: "grid", gap: "0.5rem", marginTop: "1rem" }}>
          <p style={{ fontSize: "0.85rem", opacity: 0.7, margin: 0 }}>
            留空的字段保持原值不变。姓名 / 年龄 / 职业会被填进抽奖表单（对应日文栏位「名前」「年齢」「職業」）。
          </p>
          <input
            placeholder="cosme 登录邮箱"
            autoComplete="off"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
          <input
            type="password"
            placeholder="cosme 登录密码"
            autoComplete="new-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <input
            placeholder="姓名（名前）"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <input
            placeholder="年龄（年齢）"
            value={form.age}
            onChange={(e) => setForm({ ...form, age: e.target.value })}
          />
          <input
            placeholder="职业（職業，如 自営業/自由業）"
            value={form.job}
            onChange={(e) => setForm({ ...form, job: e.target.value })}
          />
          <button type="submit" disabled={saving}>
            {saving ? "保存中…" : "保存凭证"}
          </button>
        </form>
      )}
    </div>
  );
}
