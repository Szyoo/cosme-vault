/**
 * 404（gone）的人工改判控件：下拉选目标状态 → 应用。
 *
 * 挂在**所有展示 404 的地方**（用户要求）：奖品详情页的账号状态行、
 * 账号进度下钻 modal、奖品列表（筛选 404 时）。
 *
 * 为什么只有 404 有这个：404 天然是「可能判错了」的状态（站点瞬时故障 /
 * 链接存错 / 其实早投过），真相要人工看原页面。其他状态各有自己的闭环。
 */
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/i18n/context.tsx";
import { statusOf } from "./labels.ts";

/** 可改判的目标（除 gone 自身外的全部已有状态） */
const TARGETS = ["pending", "drawn", "alreadyEntered", "needsChoice", "failed", "expired", "unknownPattern"] as const;

export function GoneFix({ accountId, presentId }: { accountId: string; presentId: string }) {
  const t = useT();
  const router = useRouter();
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function apply() {
    if (!to) return;
    setBusy(true);
    try {
      const res = await fetch("/api/account-presents/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, presentId, toStatus: to }),
      });
      if (res.ok) {
        setDone(true);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
  }

  if (done) return <span className="tiny muted">{t.matrix.fixDone}</span>;

  return (
    <span className="gone-fix" title={t.matrix.fixHint}>
      <select
        className="field gone-fix-select"
        value={to}
        onChange={(e) => setTo(e.target.value)}
        disabled={busy}
      >
        <option value="">{t.matrix.fixPick}</option>
        {TARGETS.map((k) => (
          <option key={k} value={k}>
            {statusOf(k, t).label}
          </option>
        ))}
      </select>
      <button type="button" className="btn-ghost btn-small" disabled={busy || !to} onClick={() => void apply()}>
        {t.matrix.fixApply}
      </button>
    </span>
  );
}
