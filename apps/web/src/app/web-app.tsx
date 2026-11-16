/**
 * 主屏 Web App 的运行时（@szyyw/design/webapp v0.32.0）：新版本上线后自动重载。
 *
 * 主屏 App 没有地址栏、不能刷新，还常年开着——`autoUpdate` 在回到前台或定时检查时
 * 拿 `<html data-version>` 和 `/api/version` 比，不同且用户没在忙就 `location.reload()`。
 *
 * 「忙」除了包的缺省判断（焦点在有内容的输入框上、弹层开着），还包括**有草稿**：
 * 标了 `data-draft` 的区域（设置页各表单、应募选择页）里改过东西、还没离开这一页。
 * 这些表单回显已保存的值，看输入框有没有内容分不出是不是草稿，所以记「改过」这件事；
 * 换页即清（客户端换路由时那页的草稿本来就丢了）。
 */
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let dirty = false;

function markDirty(e: Event) {
  if (e.target instanceof Element && e.target.closest("[data-draft]")) dirty = true;
}

export function WebApp() {
  const pathname = usePathname();

  useEffect(() => {
    dirty = false;
  }, [pathname]);

  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    document.addEventListener("input", markDirty, true);
    document.addEventListener("change", markDirty, true);
    void (async () => {
      const { autoUpdate, defaultIsBusy } = await import("@szyyw/design/webapp");
      if (cancelled) return;
      stop = autoUpdate({
        current: document.documentElement.dataset.version,
        check: () =>
          fetch("/api/version", { cache: "no-store" })
            .then((r) => (r.ok ? (r.json() as Promise<{ version?: string }>) : null))
            .then((d) => d?.version),
        isBusy: () => defaultIsBusy() || dirty,
      });
    })();
    return () => {
      cancelled = true;
      stop?.();
      document.removeEventListener("input", markDirty, true);
      document.removeEventListener("change", markDirty, true);
    };
  }, []);

  return null;
}
