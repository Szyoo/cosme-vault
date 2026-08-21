/**
 * 自动刷新：让手机上能实时看到进度，不必手动下拉。
 *
 * 首页是服务端组件（直接查库），所以用 router.refresh() 重新拉一次服务端渲染，
 * 比自己写一套轮询 API + 客户端状态简单得多。
 * 页面切到后台时暂停，省电也省无谓请求。
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function LiveRefresh({ intervalMs = 4000 }: { intervalMs?: number }) {
  const router = useRouter();
  const [on, setOn] = useState(true);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!on) return;

    const stop = () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    const start = () => {
      if (timer.current) return;
      timer.current = setInterval(() => {
        if (document.visibilityState === "visible") {
          router.refresh();
          setTick((t) => t + 1);
        }
      }, intervalMs);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") start();
      else stop();
    };

    start();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [on, intervalMs, router]);

  return (
    <button
      type="button"
      className="btn-ghost btn-small"
      onClick={() => setOn((v) => !v)}
      title={on ? "点击暂停自动刷新" : "点击恢复自动刷新"}
    >
      {on ? `● 实时${tick > 0 ? ` ${tick}` : ""}` : "○ 已暂停"}
    </button>
  );
}
