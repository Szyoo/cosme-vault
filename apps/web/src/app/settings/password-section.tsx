/**
 * 设置页的「管理员密码」区块。
 *
 * 存在的理由（2026-09-30）：管理员账号只在首次登录时按 `.env` 建号，之后以数据库
 * 哈希为准——改 `.env` 没用，而当时的密码是字面上的 `password`，公网上撞库字典
 * 第一条就能进来。此前没有任何地方能真正改掉它。
 *
 * 新密码由用户自己在这里输入：明文只存在于这一次请求里，落库即哈希。
 */
"use client";

import { useState } from "react";
import { useT } from "@/i18n/context.tsx";

export function PasswordSection() {
  const t = useT();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    // 两次不一致在本地就拦下，省一次请求，也不消耗限流次数
    if (next !== confirm) {
      setMsg({ ok: false, text: t.settings.pwMismatch });
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ current, next }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setCurrent("");
        setNext("");
        setConfirm("");
        setMsg({ ok: true, text: t.settings.pwDone });
      } else {
        setMsg({ ok: false, text: body.error ?? t.settings.saveFailed });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="glass section">
      <div className="section-name">{t.settings.pwTitle}</div>
      <p className="tiny muted">{t.settings.pwHint}</p>
      {/* autoComplete 让浏览器 / 密码管理器认出这是「改密码」表单并提示保存新密码 */}
      <form className="stack" style={{ marginTop: 10 }} onSubmit={(e) => void submit(e)}>
        <input
          className="field"
          type="password"
          autoComplete="current-password"
          placeholder={t.settings.pwCurrent}
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          required
        />
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder={t.settings.pwNew}
          value={next}
          onChange={(e) => setNext(e.target.value)}
          minLength={10}
          required
        />
        <input
          className="field"
          type="password"
          autoComplete="new-password"
          placeholder={t.settings.pwConfirm}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={10}
          required
        />
        <div className="actions">
          <button type="submit" className="btn" disabled={busy}>
            {busy ? t.settings.pwSaving : t.settings.pwSubmit}
          </button>
          {msg && (
            <span className="small" style={{ color: msg.ok ? "var(--ok)" : "var(--err)" }}>
              {msg.text}
            </span>
          )}
        </div>
      </form>
    </section>
  );
}
