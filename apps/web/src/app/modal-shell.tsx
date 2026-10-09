/**
 * modal 外壳：遮罩 + 关闭行为。
 *
 * 为什么奖品详情要做成 modal 而不是跳页：奖品列表的**筛选是客户端 state**
 * （138 条数据已在页面里，筛选不值得走服务端）。跳页会卸载列表组件，
 * 回来筛选就没了——筛到「PR 合作 81」点一个奖品，返回又是全部 138 条。
 * 用 Next 的拦截路由（`@modal/(.)presents/[presentId]`）让 URL 真实、
 * 后退键正常、还能分享，同时 children slot 不动，筛选自然保住。
 *
 * 关闭一律走 `useCloseModal()`：优先 `router.back()`（URL 回到列表、前进/后退历史
 * 不错乱），**退不回去时兜底回首页**——见该函数的说明。
 */
"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

/** 子组件用它判断自己是否被嵌在 modal 里（提交成功后是关弹层还是跳页，行为不同） */
const InModalCtx = createContext(false);
export function useInModal(): boolean {
  return useContext(InModalCtx);
}

/**
 * 关闭 modal。
 *
 * ⚠️ 不能只调 `router.back()`（2026-09-30 事故，叉点了关不掉）：从 Bark 推送打开的
 * 是新页面，服务端重定向与 `replace` 都不产生历史记录，`back()` 无处可退就**什么都
 * 不发生**。所以：没有历史直接回首页；有历史先 back，一小会儿后若 URL 纹丝未动
 * （退不回去），同样改走首页——保证关闭按钮任何时候都有效。
 */
export function useCloseModal(): () => void {
  const router = useRouter();
  return useCallback(() => {
    if (window.history.length <= 1) {
      router.push("/");
      return;
    }
    const here = window.location.href;
    router.back();
    window.setTimeout(() => {
      if (window.location.href === here) router.push("/");
    }, 350);
  }, [router]);
}

export function ModalShell({ children }: { children: ReactNode }) {
  const panel = useRef<HTMLDivElement | null>(null);
  const close = useCloseModal();

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
    // 外观用设计包的 .overlay + .sheet（手机底部抽屉、桌面居中卡片，.sheet-body 内部滚动）+ .close-x；
    // .wide / .cv-modal 是本应用的修饰类（详情要更宽、内嵌整页组件要去掉整页留白），见 globals.css
    <div
      className="overlay"
      onClick={(e) => {
        // 只有点在遮罩本身（而不是面板内部）才关闭
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="sheet wide cv-modal" ref={panel} role="dialog" aria-modal="true">
        <div className="sheet-head">
          <button type="button" className="close-x" onClick={close} aria-label="close">
            ✕
          </button>
        </div>
        <div className="sheet-body">
          <InModalCtx.Provider value={true}>{children}</InModalCtx.Provider>
        </div>
      </div>
    </div>
  );
}
