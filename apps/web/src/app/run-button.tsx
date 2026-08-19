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
    <div className="row">
      {msg && <span className="tiny muted">{msg}</span>}
      <button type="button" className="btn" onClick={run} disabled={busy}>
        {busy ? "触发中…" : "跑一轮"}
      </button>
    </div>
  );
}
