/**
 * 设计包的运行时装置：点阵背景 + 右上角工具位（应用切换器、明暗切换、背景参数）。
 *
 * 单独拆成客户端组件，让 layout 保持服务端组件（它要 await cookies() 读明暗设置）。
 */
"use client";

import { useEffect } from "react";
import { useT } from "@/i18n/context.tsx";
import type { DotFieldHandle } from "@szyyw/design/dotfield";
import type { SchemeToggleHandle } from "@szyyw/design/scheme";
import type { AppSwitcherHandle } from "@szyyw/design/switcher";

export function DesignChrome() {
  const t = useT();

  useEffect(() => {
    let field: DotFieldHandle | null = null;
    let toggle: SchemeToggleHandle | null = null;
    let switcher: AppSwitcherHandle | null = null;
    let cancelled = false;

    void (async () => {
      const [{ mountDotField, attachSpot }, { configureScheme, mountSchemeToggle }, settings, { mountAppSwitcher }] =
        await Promise.all([
          import("@szyyw/design/dotfield"),
          import("@szyyw/design/scheme"),
          import("@szyyw/design/settings"),
          import("@szyyw/design/switcher"),
        ]);
      if (cancelled) return;

      // 明暗持久化用 cookie —— layout 服务端要读它，首屏才不闪白
      configureScheme({ persist: "cookie", storageKey: "cosme_scheme" });
      toggle = mountSchemeToggle({
        labels: { auto: t.chrome.auto, light: t.chrome.light, dark: t.chrome.dark },
      });
      // 九宫格应用切换器（列表来自门户 /api/apps，按门户权限矩阵过滤）
      switcher = mountAppSwitcher({ portal: "https://szyyw.xyz" });

      const layer = document.querySelector<HTMLElement>(".bg-layer");
      if (layer) {
        // restore 把用户上次调过的参数带回来（只恢复真正动过的键）
        field = mountDotField(layer, settings.restoreDotFieldSettings());
        settings.mountDotFieldSettings({ field, note: t.chrome.localOnly });
      }
      // 卡片 hover 光斑：事件委托一次挂载，动态元素自动覆盖
      attachSpot();
    })();

    return () => {
      cancelled = true;
      field?.destroy();
      toggle?.destroy();
      switcher?.destroy();
    };
    // 依赖 t：切语言后重挂一次，工具位上的文案才会跟着换
  }, [t]);

  return null;
}
