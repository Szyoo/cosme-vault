/**
 * 单账号的三种触发（用户要求：除了全账号，还要能只跑某一个账号）。
 *
 * 与顶部的全局按钮同一套语义与确认规则：
 *   仅检测 无副作用，单击直达
 *   仅抽取 / 跑一轮 会真实消耗抽奖机会 → 明示确认条（不用「再点一次」那种隐式确认）
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

type Mode = "scan" | "draw" | "full";

export function AccountActions({ accountId, label }: { accountId: string; label: string }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [confirming, setConfirming] = useState<Exclude<Mode, "scan"> | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function fire(mode: Mode) {
    setConfirming(null);
    setBusy(mode);
    setMsg(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: mode === "full" ? undefined : mode, accountId }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        started?: unknown[];
        dispatched?: number;
        error?: string;
      };
      if (!res.ok) setMsg(body.error ?? t.runner.runFailed);
      else if (mode === "draw") setMsg(t.runner.dispatched(body.dispatched ?? 0));
      else setMsg(t.runner.queued(body.started?.length ?? 0));
      if (res.ok) router.refresh();
    } finally {
      setBusy(null);
    }
  }

  if (msg) return <span className="tiny muted">{msg}</span>;

  if (confirming) {
    return (
      <span className="row" style={{ gap: 6, flexWrap: "wrap" }}>
        <span className="tiny warn-text" style={{ margin: 0 }}>
          {t.matrix.confirmOne(label)}
        </span>
        <button type="button" className="btn danger btn-small" onClick={() => void fire(confirming)}>
          {t.runner.confirmGo}
        </button>
        <button type="button" className="btn-ghost btn-small" onClick={() => setConfirming(null)}>
          {t.runner.confirmNo}
        </button>
      </span>
    );
  }

  return (
    <span className="row acct-actions" style={{ gap: 6 }}>
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => void fire("scan")}
        disabled={busy !== null}
      >
        {busy === "scan" ? t.runner.running : t.runner.scanOnly}
      </button>
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => setConfirming("draw")}
        disabled={busy !== null}
      >
        {busy === "draw" ? t.runner.running : t.runner.drawOnly}
      </button>
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => setConfirming("full")}
        disabled={busy !== null}
      >
        {busy === "full" ? t.runner.running : t.runner.run}
      </button>
    </span>
  );
}
