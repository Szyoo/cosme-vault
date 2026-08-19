/** 「跑一轮」按钮：调 /api/runs 入队扫描任务。首页是服务端组件，故单独拆出客户端组件。 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RunButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/runs", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { started?: unknown[]; error?: string };
      setMsg(res.ok ? `已入队 ${body.started?.length ?? 0} 个扫描任务` : (body.error ?? "触发失败"));
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: "0.75rem", display: "flex", gap: "0.75rem", alignItems: "center" }}>
      <button type="button" onClick={run} disabled={busy} style={{ padding: "0.6rem 1.2rem", borderRadius: 10 }}>
        {busy ? "触发中…" : "跑一轮"}
      </button>
      {msg && <span style={{ fontSize: "0.85rem", opacity: 0.8 }}>{msg}</span>}
    </div>
  );
}
