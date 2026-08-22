/**
 * 从控制台点「去选择」时的 modal 呈现（拦截路由，与奖品详情同一套机制）。
 * Bark 深链接是整页加载，不经拦截，落到 choices/[presentId] 的完整页面——正好适合手机。
 * ⚠️ ChoiceInner 用 useSearchParams，必须包 Suspense（Next 16 构建期强制）。
 */
"use client";

import { Suspense } from "react";
import { ModalShell } from "../../../modal-shell.tsx";
import { ChoiceInner } from "../../../choices/[presentId]/page.tsx";

export default function ChoiceModal() {
  return (
    <ModalShell>
      <Suspense fallback={<p>…</p>}>
        <ChoiceInner />
      </Suspense>
    </ModalShell>
  );
}
