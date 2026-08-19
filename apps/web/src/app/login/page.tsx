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
    <Suspense fallback={<main style={{ maxWidth: 360, margin: "6rem auto", padding: "0 1.5rem" }}>载入中…</main>}>
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
    <main style={{ maxWidth: 360, margin: "6rem auto", padding: "0 1.5rem" }}>
      <h1>Cosme Vault</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "1.5rem" }}>
        <input
          name="username"
          placeholder="用户名"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          name="password"
          type="password"
          placeholder="密码"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p style={{ color: "var(--danger, crimson)" }}>{error}</p>}
        <button type="submit" disabled={busy}>
          {busy ? "登录中…" : "登录"}
        </button>
      </form>
    </main>
  );
}
