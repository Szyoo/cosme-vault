/**
 * 「终止排队」按钮。
 *
 * 「跑一轮」一次能入队上百个 draw，入队之后原先**没有任何办法叫停**。
 * 这是破坏性操作（会取消一批任务），故用设计包的按钮版二次确认（armConfirm）：首点变红、再点执行。
 *
 * 只取消排队中的；正在执行的那一个从控制面停不了浏览器，会自己跑完。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";
import { useArmConfirm } from "./use-arm-confirm.ts";

export function StopButton({ queued }: { queued: number }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // 5 秒内没再点就复位，避免误触后一直挂着待确认
  const armRef = useArmConfirm(() => void go(), { label: t.runner.stopConfirm });

  if (queued === 0 && !msg) return null;

  async function go() {
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
    }
  }

  if (msg) return <span className="tiny muted">{msg}</span>;

  return (
    <button
      type="button"
      ref={armRef}
      className="btn-ghost btn-small"
      disabled={busy}
      title={t.runner.stopHint}
    >
      {busy ? t.runner.stopping : `${t.runner.stop}（${queued}）`}
    </button>
  );
}
