/**
 * 设计包的运行时装置：点阵背景 + 右上角工具位（明暗切换、背景参数）。
 *
 * 单独拆成客户端组件，让 layout 保持服务端组件（它要 await cookies() 读明暗设置）。
 */
"use client";

import { useEffect } from "react";
import type { DotFieldHandle } from "@szyyw/design/dotfield";
import type { SchemeToggleHandle } from "@szyyw/design/scheme";

export function DesignChrome() {
  useEffect(() => {
    let field: DotFieldHandle | null = null;
    let toggle: SchemeToggleHandle | null = null;
    let cancelled = false;

    void (async () => {
      const [{ mountDotField, attachSpot }, { configureScheme, mountSchemeToggle }, settings] = await Promise.all([
        import("@szyyw/design/dotfield"),
        import("@szyyw/design/scheme"),
        import("@szyyw/design/settings"),
      ]);
      if (cancelled) return;

      // 明暗持久化用 cookie —— layout 服务端要读它，首屏才不闪白
      configureScheme({ persist: "cookie", storageKey: "cosme_scheme" });
      toggle = mountSchemeToggle({
        labels: { auto: "跟随系统", light: "浅色", dark: "深色" },
      });

      const layer = document.querySelector<HTMLElement>(".bg-layer");
      if (layer) {
        // restore 把用户上次调过的参数带回来（只恢复真正动过的键）
        field = mountDotField(layer, settings.restoreDotFieldSettings());
        settings.mountDotFieldSettings({ field, note: "仅本地保存" });
      }
      // 卡片 hover 光斑：事件委托一次挂载，动态元素自动覆盖
      attachSpot();
    })();

    return () => {
      cancelled = true;
      field?.destroy();
      toggle?.destroy();
    };
  }, []);

  return null;
}
