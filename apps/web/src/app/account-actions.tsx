/**
 * 单账号的三种触发：除了全账号，还要能只跑某一个账号。
 *
 * 与顶部的全局按钮同一套语义与确认规则：
 *   仅检测 无副作用，单击直达
 *   仅抽取 / 跑一轮 会真实消耗抽奖机会 → 设计包的确认对话框明示确认（不用「再点一次」那种隐式确认）
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirm } from "@szyyw/design/confirm";
import { useLocale, useT } from "@/i18n/context.tsx";

type Mode = "scan" | "draw" | "full";

export function AccountActions({ accountId, label }: { accountId: string; label: string }) {
  const t = useT();
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function ask(mode: Exclude<Mode, "scan">) {
    const ok = await confirm({
      title: `${label} · ${mode === "draw" ? t.runner.drawOnly : t.runner.run}`,
      message: t.matrix.confirmOne(label),
      confirmLabel: t.runner.confirmGo,
      cancelLabel: t.runner.confirmNo,
      danger: true,
      locale,
    });
    if (ok) void fire(mode);
  }

  async function fire(mode: Mode) {
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

  return (
    <span className="row wrap acct-actions" style={{ gap: 6 }}>
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
        onClick={() => void ask("draw")}
        disabled={busy !== null}
      >
        {busy === "draw" ? t.runner.running : t.runner.drawOnly}
      </button>
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => void ask("full")}
        disabled={busy !== null}
      >
        {busy === "full" ? t.runner.running : t.runner.run}
      </button>
    </span>
  );
}
