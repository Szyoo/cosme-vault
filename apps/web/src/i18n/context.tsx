/**
 * 客户端语言上下文。
 *
 * **只在 context 里放 locale 字符串，不放字典对象**——字典里有函数（如
 * `queued: (n) => ...`），函数没法跨 RSC 边界序列化，硬传会直接报错。
 * 客户端组件自己 import 字典模块，用 locale 索引即可。
 */
"use client";

import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_LOCALE, DICTS, type Dict, type Locale } from "./dict.ts";

const Ctx = createContext<Locale>(DEFAULT_LOCALE);

export function I18nProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <Ctx.Provider value={locale}>{children}</Ctx.Provider>;
}

/** 客户端组件取字典 */
export function useT(): Dict {
  return DICTS[useContext(Ctx)];
}

/** 需要知道当前语言本身（如语言切换器高亮）时用 */
export function useLocale(): Locale {
  return useContext(Ctx);
}
