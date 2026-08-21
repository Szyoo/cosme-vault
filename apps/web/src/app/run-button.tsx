/** 「跑一轮」按钮：调 /api/runs 入队扫描任务。首页是服务端组件，故单独拆出客户端组件。 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

export function RunButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/runs", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { started?: unknown[]; error?: string };
      setMsg(res.ok ? t.runner.queued(body.started?.length ?? 0) : (body.error ?? t.runner.runFailed));
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      {msg && <span className="tiny muted">{msg}</span>}
      <button type="button" className="btn" onClick={run} disabled={busy}>
        {busy ? t.runner.running : t.runner.run}
      </button>
    </div>
  );
}
