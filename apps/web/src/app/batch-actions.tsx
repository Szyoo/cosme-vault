/**
 * 队列里一个批次的操作：置顶 / 取消。
 *
 * 取消只影响这一批**排队中**的任务；正在执行的那一个从控制面停不了浏览器，
 * 会自己跑完（按钮上的 title 写清楚了）。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

export function BatchActions({
  batchId,
  canMoveUp,
  queued,
}: {
  batchId: string;
  canMoveUp: boolean;
  /** 这一批还有多少个排队中——为 0 时只剩正在执行的，无可取消 */
  queued: number;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);

  async function act(action: "cancel" | "top") {
    if (action === "cancel" && !armed) {
      setArmed(true);
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/jobs/batch/${encodeURIComponent(batchId)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) router.refresh();
    } finally {
      setBusy(false);
      setArmed(false);
    }
  }

  return (
    <span className="qactions">
      {canMoveUp && queued > 0 && (
        <button type="button" className="btn-ghost btn-small" onClick={() => void act("top")} disabled={busy}>
          ↑ {t.runner.toTop}
        </button>
      )}
      {queued > 0 && (
        <button
          type="button"
          className={armed ? "btn-ghost danger btn-small" : "btn-ghost btn-small"}
          onClick={() => void act("cancel")}
          disabled={busy}
          title={t.runner.queueHint}
        >
          {armed ? t.runner.stopConfirm : t.runner.cancelJob}
        </button>
      )}
    </span>
  );
}
