/**
 * 奖品筛选状态的共享 context。
 *
 * 为什么要提出来：首页顶部的「奖品概览」与底部的奖品列表要用**同一份**筛选。
 * 概览放在上面（用户要求：不滚到底也能看到统计），列表在下面，两者是页面上
 * 隔得很远的两个位置，没法塞进同一个组件——但点概览的 chip 必须能筛列表，
 * 否则上面一排数字点不动、下面一排一模一样的数字能点，反而更让人迷惑。
 *
 * 仍然是**客户端**状态（不走 URL）：一两百条数据已经在页面里，筛选不值得走服务端；
 * 而且首页会自动刷新，用 URL 参数还得额外处理「刷新时保留筛选」。
 */
"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

interface FilterState {
  source: string | null;
  status: string | null;
  q: string;
  setSource: (v: string | null) => void;
  setStatus: (v: string | null) => void;
  setQ: (v: string) => void;
  reset: () => void;
}

const Ctx = createContext<FilterState | null>(null);

export function usePresentFilter(): FilterState {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePresentFilter 必须在 PresentFilterProvider 内使用");
  return v;
}

export function PresentFilterProvider({ children }: { children: ReactNode }) {
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const value = useMemo<FilterState>(
    () => ({
      source,
      status,
      q,
      setSource,
      setStatus,
      setQ,
      reset: () => {
        setSource(null);
        setStatus(null);
        setQ("");
      },
    }),
    [source, status, q],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/** 概览里点了 chip 之后把视线带到列表——否则筛完什么都没发生的样子 */
export function scrollToList(): void {
  document.getElementById("presents")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
