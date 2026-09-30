/** 登录页。样式先走 @szyyw/design 的玻璃组件层，正式视觉与其他页面一起做。 */
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

/**
 * ⚠️ Next 16：`useSearchParams()` 在预渲染阶段必须包在 Suspense 边界内，
 * 否则 `next build` 直接失败（missing-suspense-with-csr-bailout）。
 * 故把用到它的部分拆成子组件，页面组件只负责包 Suspense。
 */
export default function LoginPage() {
  return (
    <Suspense fallback={<main className="page">…</main>}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useT();
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
        setError(data.error ?? t.login.failed);
        return;
      }
      // ⚠️ 必须**整页跳转**，不能 router.replace（2026-09-30 事故）：
      // 客户端跳转会被 `@modal/(.)choices` 拦截路由接住，选择页被弹成
      // **盖在登录表单上的 modal**；而 replace 又不留历史，modal 的关闭按钮
      // （router.back）无处可退，叉点了没反应。登录后本来就该整页重载，
      // 新会话 cookie 下的服务端组件也需要重新渲染。
      window.location.replace(safeNext(params.get("next")));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page narrow">
      <h1 className="page-title grad-text">{t.appName}</h1>
      <form className="glass stack section" method="post" action="/api/auth/login" onSubmit={submit}>
        <input
          className="field"
          name="username"
          placeholder={t.login.username}
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          className="field"
          name="password"
          type="password"
          placeholder={t.login.password}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="err-text">{error}</p>}
        <button type="submit" className="btn" disabled={busy}>
          {busy ? t.login.submitting : t.login.submit}
        </button>
      </form>
    </main>
  );
}

/**
 * 登录后的跳转目标只接受**站内相对路径**：以 `/` 开头、且不是 `//`（协议相对地址，
 * 会跳去别的域名）或 `/\`（部分浏览器同样当成协议相对）。否则一律回首页——
 * `next` 来自 URL，谁都能构造，不校验就是开放重定向。
 */
function safeNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
