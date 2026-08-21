/**
 * 实时刷新控制台。
 *
 * 主通道是 **SSE**（`/api/events`）：runner 的端点落库后 publish，这里收到就
 * `router.refresh()`，日志与状态几乎瞬时可见。runner 侧本来就是即时的
 * （`pushLog` 每条日志立刻 POST），此前慢在前端的 4 秒轮询上。
 *
 * 轮询保留为**兜底**，但 SSE 连上后拉长到 20 秒：SSE 可能被中间代理掐断、
 * 或者进程重启（事件总线是进程内的），兜底能保证界面不会彻底停更。
 *
 * ⚠️ 一次扫描会连着打几十条日志，逐条刷新等于自我 DDoS——所以做**合并**：
 * 收到消息后最多每 600ms 刷一次。
 *
 * ⚠️ 刻意不渲染任何 UI。这块先后长过两次没用的皮（累计刷新次数、上次刷新时刻），
 * 自动刷新是这一页的固有行为、不是可配置项；说明写在 Runner 卡片的提示文字里。
 */
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/** 合并窗口：收到事件后至少隔这么久才再刷一次 */
const COALESCE_MS = 600;

export function LiveRefresh({ fallbackMs = 20_000 }: { fallbackMs?: number }) {
  const router = useRouter();
  const lastRefresh = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;

    /** 合并式刷新：密集事件只换来一次刷新 */
    const bump = () => {
      if (stopped || document.visibilityState !== "visible") return;
      const since = Date.now() - lastRefresh.current;
      if (since >= COALESCE_MS) {
        lastRefresh.current = Date.now();
        router.refresh();
        return;
      }
      if (pending.current) return;
      pending.current = setTimeout(() => {
        pending.current = null;
        lastRefresh.current = Date.now();
        if (!stopped && document.visibilityState === "visible") router.refresh();
      }, COALESCE_MS - since);
    };

    // ── 主通道：SSE ──
    let es: EventSource | null = null;
    const openStream = () => {
      if (stopped || es) return;
      es = new EventSource("/api/events");
      // 三类事件都只是「有变化」的信号，不带载荷；刷新一次即可
      for (const kind of ["log", "report", "heartbeat", "queue"]) {
        es.addEventListener(kind, bump);
      }
      es.onerror = () => {
        // EventSource 自己会重连；这里只在真的关掉时清引用，避免泄漏
        if (es && es.readyState === EventSource.CLOSED) {
          es = null;
          if (!stopped) setTimeout(openStream, 3000);
        }
      };
    };

    // ── 兜底：低频轮询 ──
    const timer = setInterval(() => {
      // 页面在后台时不刷：省电，也不给服务端制造无人看的请求
      if (document.visibilityState === "visible") bump();
    }, fallbackMs);

    const onVisible = () => {
      if (document.visibilityState === "visible") {
        openStream();
        bump();
      } else {
        es?.close();
        es = null;
      }
    };

    openStream();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      if (pending.current) clearTimeout(pending.current);
      document.removeEventListener("visibilitychange", onVisible);
      es?.close();
    };
  }, [fallbackMs, router]);

  return null;
}
