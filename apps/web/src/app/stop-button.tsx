/**
 * 「终止排队」按钮。
 *
 * 「跑一轮」一次能入队上百个 draw，入队之后原先**没有任何办法叫停**（用户提过）。
 * 这是破坏性操作（会取消一批任务），故按设计规范做二次确认：首点变红、再点执行。
 *
 * 只取消排队中的；正在执行的那一个从控制面停不了浏览器，会自己跑完。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

export function StopButton({ queued }: { queued: number }) {
  const t = useT();
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (queued === 0 && !msg) return null;

  async function go() {
    if (!armed) {
      setArmed(true);
      // 5 秒内没再点就复位，避免误触后一直挂着待确认
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/runs/stop", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        cancelled?: number;
        stillRunning?: number;
        error?: string;
      };
      setMsg(res.ok ? t.runner.stopped(body.cancelled ?? 0, body.stillRunning ?? 0) : (body.error ?? t.resolve.failed));
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  if (msg) return <span className="tiny muted">{msg}</span>;

  return (
    <button
      type="button"
      className={armed ? "btn-ghost danger btn-small" : "btn-ghost btn-small"}
      onClick={go}
      disabled={busy}
      title={t.runner.stopHint}
    >
      {busy ? t.runner.stopping : armed ? t.runner.stopConfirm : `${t.runner.stop}（${queued}）`}
    </button>
  );
}
