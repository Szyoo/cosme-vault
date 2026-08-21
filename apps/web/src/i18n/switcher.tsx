/**
 * 语言切换：挂进 @szyyw/design 的右上角工具位（与明暗切换同一条 rail）。
 *
 * 用设计包的 `mountCornerTool` 而不是自己 position:fixed——rail 的定位、层级、
 * 安全区留白与 `--corner-rail-h` 发布都在包里做好了，自己写一套必然和明暗按钮打架。
 * 包容器是 flex，故用 `display: contents` 的壳把真正的按钮暴露成 flex item。
 *
 * 写 cookie 后 `router.refresh()` 让服务端组件用新语言重渲染（语言存 cookie 的
 * 理由与明暗模式相同：SSR 首屏必须由服务端决定，否则会闪一下旧语言）。
 */
"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { LOCALES, LOCALE_NAMES, type Locale } from "./dict.ts";
import { useLocale } from "./context.tsx";

const GLYPH: Record<Locale, string> = { zh: "中", ja: "日", en: "EN" };

export function LocaleSwitcher() {
  const current = useLocale();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const shell = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let unmount: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const { mountCornerTool } = await import("@szyyw/design/corner");
      if (cancelled) return;
      const el = document.createElement("div");
      el.style.display = "contents";
      shell.current = el;
      // order：明暗 10、背景参数 20，语言插在中间
      unmount = mountCornerTool(el, { order: 15 });
      setHost(el);
    })();
    return () => {
      cancelled = true;
      unmount?.();
      shell.current?.remove();
    };
  }, []);

  if (!host) return null;

  const next = LOCALES[(LOCALES.indexOf(current) + 1) % LOCALES.length]!;
  const cycle = () => {
    document.cookie = `cosme_locale=${next}; path=/; max-age=31536000; samesite=lax`;
    startTransition(() => router.refresh());
  };

  return createPortal(
    <button
      type="button"
      className="corner-tool lang-tool"
      onClick={cycle}
      title={`${LOCALE_NAMES[current]} → ${LOCALE_NAMES[next]}`}
      aria-label={LOCALE_NAMES[next]}
    >
      {GLYPH[current]}
    </button>,
    host,
  );
}
