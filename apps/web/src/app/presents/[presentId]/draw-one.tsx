/**
 * 「只投这一个」按钮。
 *
 * 点一下会**真实参加这个抽奖**，所以要二次确认（设计规范第 8 节：破坏性/不可逆操作
 * 首点变红要求再点一次）。这里的不可逆性在于抽奖机会用掉就没了。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

export function DrawOneButton({
  accountId,
  presentId,
  presentLink,
}: {
  accountId: string;
  presentId: string;
  presentLink: string;
}) {
  const t = useT();
  const router = useRouter();
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function go() {
    if (!armed) {
      setArmed(true);
      // 5 秒内没再点就复位，避免误触后一直处于待确认状态
      setTimeout(() => setArmed(false), 5000);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ kind: "draw", accountId, presentId, presentLink }),
      });
      setMsg(res.ok ? t.draw.queued : t.draw.failed);
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
    >
      {busy ? t.draw.queueing : armed ? t.draw.confirm : t.draw.one}
    </button>
  );
}
