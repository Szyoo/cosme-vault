/**
 * 设计包按钮版二次确认（`armConfirm`，@szyyw/design/confirm）的 React 挂法。
 *
 * 返回一个 callback ref：按钮挂载时 `armConfirm`，卸载时 `destroy()`。第一次点由包拦下并上膛
 * （`.armed` 变红、文字换成 `label`），再点才调 `onConfirm`；失焦 / 点别处 / Esc / 超时都复原。
 * 按钮上**不要**再写 React 的 onClick——第二次点击由这里的 onConfirm 接。
 */
"use client";

import { useCallback, useRef } from "react";
import { armConfirm } from "@szyyw/design/confirm";

export function useArmConfirm(
  onConfirm: () => void,
  { label, timeout = 5000 }: { label: string; timeout?: number },
): (el: HTMLButtonElement | null) => (() => void) | undefined {
  const latest = useRef(onConfirm);
  latest.current = onConfirm;
  return useCallback(
    (el: HTMLButtonElement | null) => {
      if (!el) return undefined;
      const handle = armConfirm(el, { label, timeout, onConfirm: () => latest.current() });
      return () => handle.destroy();
    },
    [label, timeout],
  );
}
