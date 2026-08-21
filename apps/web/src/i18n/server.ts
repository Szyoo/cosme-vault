/**
 * 服务端取语言与字典。
 *
 * 语言存 cookie（`cosme_locale`），与明暗模式同一套思路：**服务端必须读得到**，
 * 否则 SSR 首屏会先渲染默认语言再被客户端换掉，出现闪烁。
 *
 * ⚠️ Next 16：`cookies()` 必须 await。
 */
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, DICTS, LOCALES, type Dict, type Locale } from "./dict.ts";

export const LOCALE_COOKIE = "cosme_locale";

function parse(value: string | undefined | null): Locale | null {
  return LOCALES.includes(value as Locale) ? (value as Locale) : null;
}

/** 从 Accept-Language 猜一个（只在用户没选过时用） */
function fromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  for (const part of header.split(",")) {
    const tag = part.split(";")[0]!.trim().toLowerCase();
    if (tag.startsWith("zh")) return "zh";
    if (tag.startsWith("ja")) return "ja";
    if (tag.startsWith("en")) return "en";
  }
  return null;
}

/** 当前语言：cookie 优先，其次浏览器偏好，最后默认 */
export async function getLocale(): Promise<Locale> {
  const jar = await cookies();
  const picked = parse(jar.get(LOCALE_COOKIE)?.value);
  if (picked) return picked;
  const h = await headers();
  return fromAcceptLanguage(h.get("accept-language")) ?? DEFAULT_LOCALE;
}

/** 当前语言的字典。服务端组件里 `const t = await getT()`，然后 `t.nav.console`。 */
export async function getT(): Promise<Dict> {
  return DICTS[await getLocale()];
}

/** 同时要 locale 与字典时用这个，省一次 cookie 读取 */
export async function getI18n(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: DICTS[locale] };
}
