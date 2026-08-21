/** 登录页。样式先走 @szyyw/design 的玻璃组件层，正式视觉与其他页面一起做。 */
"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * ⚠️ Next 16：`useSearchParams()` 在预渲染阶段必须包在 Suspense 边界内，
 * 否则 `next build` 直接失败（missing-suspense-with-csr-bailout）。
 * 故把用到它的部分拆成子组件，页面组件只负责包 Suspense。
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page">载入中…</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "登录失败");
        return;
      }
      router.replace(params.get("next") ?? "/");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1 className="page-title grad-text">Cosme Vault</h1>
      <form className="glass stack section" method="post" action="/api/auth/login" onSubmit={submit}>
        <input
          className="field"
          name="username"
          placeholder="用户名"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="field"
          name="password"
          type="password"
          placeholder="密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="err-text">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
