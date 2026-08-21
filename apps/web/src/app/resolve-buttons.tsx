/**
 * 「结果未知」的人工裁决按钮。控制台的提醒卡与奖品详情页共用。
 *
 * 为什么必须有：`reclaimStaleJobs` 只能把中断的投递标成「结果未知」，
 * 真相只有人去原页面看才知道。在此之前界面只提示、不接受回话——
 * 用户看完了也没地方告诉它，提醒就永远挂着（用户为此提过）。
 *
 * 「已投过了」会写成 drawn，从此进入去重防线，不会再被派发。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";

export function ResolveButtons({
  accountId,
  presentId,
  link,
}: {
  accountId: string;
  presentId: string;
  /** @COSME 原页面：不看一眼没法判断，所以按钮旁边直接给入口 */
  link?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState<null | "drawn" | "retry">(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function send(outcome: "drawn" | "retry") {
    setBusy(outcome);
    try {
      const res = await fetch(`/api/presents/${presentId}/resolve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, outcome }),
      });
      if (res.ok) {
        setMsg(outcome === "drawn" ? t.resolve.markedDrawn : t.resolve.requeued);
        router.refresh();
      } else {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setMsg(body.error ?? t.resolve.failed);
      }
    } finally {
      setBusy(null);
    }
  }

  if (msg) return <span className="tiny muted">{msg}</span>;

  return (
    <span className="row" style={{ gap: 6 }}>
      {link && (
        <a className="btn-ghost btn-small" href={link} target="_blank" rel="noreferrer">
          {t.resolve.openSite} ↗
        </a>
      )}
      {/* 重投是首选：runner 现在能在问卷页识别出已应募并跳过，不会重复提交 */}
      <button
        type="button"
        className="btn btn-small"
        onClick={() => void send("retry")}
        disabled={busy !== null}
      >
        {busy === "retry" ? "…" : t.resolve.retry}
      </button>
      <button
        type="button"
        className="btn-ghost btn-small"
        onClick={() => void send("drawn")}
        disabled={busy !== null}
      >
        {busy === "drawn" ? "…" : t.resolve.wasDrawn}
      </button>
    </span>
  );
}
