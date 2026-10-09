/**
 * 设计包的运行时装置：点阵背景 + 右上角工具位，一个 `mountChrome()`（@szyyw/design v0.13）挂齐：
 * 应用切换器 + 账户菜单（只在门户 SSO 下）、明暗 🌗、语言、外观（配色 / 明暗 / 背景参数）。
 *
 * - 工具位全部文案（含语言按钮）由包内置三语，按 `locale` 取——字典里不再抄一份。
 * - 外观三项存 cookie `cosme_theme / cosme_palette / cosme_scheme`（cookiePrefix "cosme_"）；
 *   `cosme_scheme` 就是旧版明暗 cookie 的名字，用户已存的偏好照常生效。layout 服务端用同一前缀读。
 * - 语言按钮选了新语言：包先自己 `setLocale` 换好工具位文案，再回调这里写 `cosme_locale`
 *   并 `router.refresh()` 让服务端组件用新语言重渲染（SSR 首屏必须由服务端决定语言）。
 * - `portal` 由 layout（服务端）按 `ssoEnabled()` 传：非 SSO 为 null，不挂切换器与账户菜单
 *   （客户端读不到 `SZYYW_SSO`）。
 */
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/context.tsx";
import { LOCALES } from "@/i18n/dict.ts";
import type { ChromeHandle } from "@szyyw/design/chrome";

export function DesignChrome({ portal }: { portal: string | null }) {
  const locale = useLocale();
  const router = useRouter();
  const chrome = useRef<ChromeHandle | null>(null);
  // 挂载时用当时的语言；之后的语言变化走下面的 setLocale，不整个重挂
  const localeRef = useRef(locale);
  localeRef.current = locale;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { mountChrome } = await import("@szyyw/design/chrome");
      if (cancelled) return;
      chrome.current = mountChrome({
        background: document.querySelector<HTMLElement>(".bg-layer"),
        cookiePrefix: "cosme_",
        locale: localeRef.current,
        portal,
        localeToggle: {
          locales: [...LOCALES],
          onChange: (next) => {
            document.cookie = `cosme_locale=${next}; path=/; max-age=31536000; samesite=lax`;
            router.refresh();
          },
        },
      });
    })();
    return () => {
      cancelled = true;
      chrome.current?.destroy();
      chrome.current = null;
    };
  }, [portal, router]);

  // 语言变了（服务端重渲染后 context 更新）：只同步工具位文案，画布不重建
  useEffect(() => {
    const c = chrome.current;
    if (c && c.locale !== locale) c.setLocale(locale);
  }, [locale]);

  return null;
}
