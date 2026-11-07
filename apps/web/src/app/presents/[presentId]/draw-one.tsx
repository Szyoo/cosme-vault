/**
 * 「只投这一个」按钮。
 *
 * 点一下会**真实参加这个抽奖**，所以要二次确认（设计包的 armConfirm：首点变红、再点执行）。
 * 这里的不可逆性在于抽奖机会用掉就没了。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";
import { useArmConfirm } from "../../use-arm-confirm.ts";

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
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // 5 秒内没再点就复位，避免误触后一直处于待确认状态
  const armRef = useArmConfirm(() => void go(), { label: t.draw.confirm });

  async function go() {
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
    }
  }

  if (msg) return <span className="tiny muted">{msg}</span>;

  return (
    <button
      type="button"
      ref={armRef}
      className="btn-ghost btn-small"
      disabled={busy}
    >
      {busy ? t.draw.queueing : t.draw.one}
    </button>
  );
}
