/**
 * 触发按钮组：仅检测 / 仅抽取 / 跑一轮。
 *
 * 三者的边界：
 *   仅检测  只扫描奖品列表，不投递——想先看看今天有什么新的
 *   仅抽取  不扫描，直接派发现有「待投递」——检测过之后挑时间再投
 *   跑一轮  两者连着（也是 cron 定时打的模式）
 *
 * 含投递的两个操作要防误触（一下就是最多 30 个真实抽奖机会），但**不用
 * 「再点一次」那种隐式二次确认**——按钮文字突然变化、还有 5 秒隐形时限，
 * 用户点了第一下摸不着头脑，超时复位后第二下又变成第一下，永远点不完
 * （实测把用户卡住了）。改成明示的确认条：说清后果 + 确认/取消两个按钮，
 * 不设时限。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

type Mode = "scan" | "draw" | "full";

export function RunButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<Mode | null>(null);
  /** 等待确认的投递类操作（scan 无副作用，不经过这里） */
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

  // 确认态：整组按钮换成一条说明 + 确认/取消，杜绝“哪个按钮变了”的猜谜
  if (confirming) {
    return (
      <div className="confirm-strip">
        <span className="small">
          {confirming === "draw" ? t.runner.confirmDraw : t.runner.confirmRun}
        </span>
        <span className="row" style={{ gap: 6, flex: "none" }}>
          <button type="button" className="btn danger btn-small" onClick={() => void fire(confirming)}>
            {t.runner.confirmGo}
          </button>
          <button type="button" className="btn-ghost btn-small" onClick={() => setConfirming(null)}>
            {t.runner.confirmNo}
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="row" style={{ gap: 6 }}>
      {msg && <span className="tiny muted">{msg}</span>}
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
      <button type="button" className="btn" onClick={() => setConfirming("full")} disabled={busy !== null}>
        {busy === "full" ? t.runner.running : t.runner.run}
      </button>
    </div>
  );
}
