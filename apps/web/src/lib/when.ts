/**
 * 时间显示。
 *
 * ⚠️ 修的是一个「时间全错」的显示 bug：库里存的全是 **UTC**
 * （runner 用 `new Date().toISOString()`，sqlite 默认值用 `datetime('now')`），
 * 而页面直接 `at.replace("T"," ").slice(...)` 把原字符串印出来，
 * 于是界面上显示 `07:55`，实际是当地 `16:55`——差 9 小时，看着像「时间不对」。
 *
 * 为什么不在客户端用 `toLocaleString()`：这些页面是服务端组件，客户端格式化会
 * 造成水合不一致（服务端与浏览器时区不同）。所以**服务端按固定时区格式化**，
 * 时区由 `DISPLAY_TZ` 指定（默认 Asia/Tokyo，@COSME 是日本站，作者也在日本）。
 *
 * 两种入库格式都要认：
 *   `2026-08-21T07:55:21.400Z`（ISO，带 Z）
 *   `2026-08-21 04:29:44`（sqlite datetime('now')，**没有 Z 但同样是 UTC**）
 */
const TZ = process.env.DISPLAY_TZ ?? "Asia/Tokyo";

/** 把库里的时间串解析成 Date；裸的 `YYYY-MM-DD HH:MM:SS` 按 UTC 处理 */
function parse(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  // 没有时区标记的裸时间串补上 Z——sqlite 的 datetime('now') 就是 UTC
  const iso = /[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? s : `${s.replace(" ", "T")}Z`;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const dateTime = new Intl.DateTimeFormat("sv-SE", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});
// 日志时间用 formatToParts 自己拼：只给 month/day 时各 locale 的顺序不一致
// （sv-SE 会给成 `21/08`，要的是 `08-21`），拼零件最稳。
const parts = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** `2026-08-21 16:55`（当地时区） */
export function fmtDateTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = parse(raw);
  // sv-SE 的格式本来就是 `YYYY-MM-DD HH:mm`，不用再拼
  return d ? dateTime.format(d).replace(",", "") : raw;
}

/** `08-21 16:55:21`（当地时区，日志用，省掉年份省地方） */
export function fmtLogTime(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const d = parse(raw);
  if (!d) return raw;
  const g: Record<string, string> = {};
  for (const p of parts.formatToParts(d)) g[p.type] = p.value;
  return `${g.month}-${g.day} ${g.hour}:${g.minute}:${g.second}`;
}
