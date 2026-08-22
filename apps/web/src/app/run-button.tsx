/**
 * 触发按钮组：仅检测 / 仅抽取 / 跑一轮。
 *
 * 三者的边界（用户要求拆开，原先只有「跑一轮」一把梭）：
 *   仅检测  只扫描奖品列表，不投递——想先看看今天有什么新的
 *   仅抽取  不扫描，直接派发现有「待投递」——检测过之后挑时间再投
 *   跑一轮  两者连着（也是 cron 定时打的模式）
 *
 * 「仅抽取」会真实消耗抽奖机会，按破坏性操作处理：首点变红，再点执行。
 * 「跑一轮」同理（它包含抽取）。仅检测无副作用，点了就跑。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

type Mode = "scan" | "draw" | "full";

/** 会真实投递的模式需要二次确认 */
const NEEDS_CONFIRM: Record<Mode, boolean> = { scan: false, draw: true, full: true };

export function RunButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  const [armed, setArmed] = useState<Mode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function run(mode: Mode) {
    if (NEEDS_CONFIRM[mode] && armed !== mode) {
      setArmed(mode);
      setTimeout(() => setArmed((a) => (a === mode ? null : a)), 5000);
      return;
    }
    setBusy(mode);
    setArmed(null);
    setMsg(null);
    try {
      const res = await fetch("/api/runs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: mode === "full" ? undefined : mode }),
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

  return (
    <div className="row" style={{ gap: 6 }}>
      {msg && <span className="tiny muted">{msg}</span>}
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => void run("scan")}
        disabled={busy !== null}
        title={t.runner.runHint}
      >
        {busy === "scan" ? t.runner.running : t.runner.scanOnly}
      </button>
      <button
        type="button"
        className={armed === "draw" ? "btn-ghost danger btn-small" : "btn-ghost btn-small"}
        onClick={() => void run("draw")}
        disabled={busy !== null}
        title={t.runner.runHint}
      >
        {busy === "draw" ? t.runner.running : armed === "draw" ? t.draw.confirm : t.runner.drawOnly}
      </button>
      <button
        type="button"
        className={armed === "full" ? "btn danger" : "btn"}
        onClick={() => void run("full")}
        disabled={busy !== null}
      >
        {busy === "full" ? t.runner.running : armed === "full" ? t.draw.confirm : t.runner.run}
      </button>
    </div>
  );
}
