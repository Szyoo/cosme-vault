/**
 * modal 外壳：遮罩 + 关闭行为。
 *
 * 为什么奖品详情要做成 modal 而不是跳页：奖品列表的**筛选是客户端 state**
 * （138 条数据已在页面里，筛选不值得走服务端）。跳页会卸载列表组件，
 * 回来筛选就没了——筛到「PR 合作 81」点一个奖品，返回又是全部 138 条。
 * 用 Next 的拦截路由（`@modal/(.)presents/[presentId]`）让 URL 真实、
 * 后退键正常、还能分享，同时 children slot 不动，筛选自然保住。
 *
 * 关闭一律走 `router.back()`：这样 URL 回到列表，前进/后退历史不会错乱。
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** 子组件用它判断自己是否被嵌在 modal 里（提交成功后是关弹层还是跳页，行为不同） */
const InModalCtx = createContext(false);
export function useInModal(): boolean {
  return useContext(InModalCtx);
}

export function ModalShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement | null>(null);

  const close = useCallback(() => router.back(), [router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    // 打开期间锁掉背景滚动，否则手机上滑动会带着底下的长列表一起动
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [close]);

  return (
    <div
      className="modal-backdrop"
      onClick={(e) => {
        // 只有点在遮罩本身（而不是面板内部）才关闭
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="modal-panel" ref={panel} role="dialog" aria-modal="true">
        <button type="button" className="modal-close" onClick={close} aria-label="close">
          ✕
        </button>
        <div className="modal-body">
          <InModalCtx.Provider value={true}>{children}</InModalCtx.Provider>
        </div>
      </div>
    </div>
  );
}
