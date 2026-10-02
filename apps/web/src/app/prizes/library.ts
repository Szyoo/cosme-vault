/**
 * 奖品库的**服务端**筛选与分页（纯函数，页面与验证脚本共用）。
 *
 * 为什么不沿用控制台那套客户端筛选：奖品库一次把 ~600 条全量下发（匿名 ~830 KB），
 * 要分页就必须先筛再分页——筛选留在客户端只能筛当前这一页，结果是错的。所以
 * 筛选条件全部进 URL（`?type=&q=&life=&status=&page=`），服务端筛完再切页，
 * 链接可分享、可回退，匿名与登录一套逻辑。
 *
 * - `type`：**稳定的 source 枚举值**（不是本地化短名，切语言后 URL 仍然有效）。
 *   同短名的类型（`brandFanClub` / `brandFanClubViaBrand`）按短名归为一组，见 tallySource。
 * - `status`：账号维度，**只对登录用户生效**；匿名时调用方传 `allowStatus: false` 直接忽略。
 * - `page`：越界钳到 [1, 最后一页]；非数字当 1。
 */
import type { Dict } from "@/i18n/dict.ts";
import { sourceOf } from "../labels.ts";
import type { PresentItem } from "../present-item.ts";

/** 每页条数 */
export const PRIZES_PAGE_SIZE = 50;

export interface LibraryQuery {
  /** source 枚举值；null = 全部 */
  type: string | null;
  q: string;
  life: "active" | "expired" | "gone" | null;
  status: string | null;
  page: number;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined): string => (Array.isArray(v) ? (v[0] ?? "") : (v ?? "")).trim();

export function parseQuery(sp: Params, { allowStatus }: { allowStatus: boolean }): LibraryQuery {
  const life = one(sp.life);
  const page = Number.parseInt(one(sp.page), 10);
  return {
    type: one(sp.type) || null,
    q: one(sp.q).slice(0, 200),
    life: life === "active" || life === "expired" || life === "gone" ? life : null,
    status: allowStatus ? one(sp.status) || null : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** 先筛后分页。`page` 钳到合法范围后回传，页面按它渲染与生成链接。 */
export function filterAndPage(
  items: PresentItem[],
  query: LibraryQuery,
  t: Dict,
  pageSize = PRIZES_PAGE_SIZE,
): { rows: PresentItem[]; matched: number; page: number; pages: number } {
  const typeShort = query.type ? sourceOf(query.type, t).short : null;
  // 关键词大小写与全半角不敏感（站点里 @cosme 与 ＠ｃｏｓｍｅ 混用），也匹配奖品 ID
  const needle = query.q.normalize("NFKC").toLowerCase();
  const matched = items.filter((i) => {
    if (typeShort && i.sourceShort !== typeShort) return false;
    if (query.life && i.life !== query.life) return false;
    if (query.status && !i.accounts.some((a) => a.status === query.status)) return false;
    if (!needle) return true;
    return `${i.title} ${i.brand ?? ""} ${i.presentId}`.normalize("NFKC").toLowerCase().includes(needle);
  });
  const pages = Math.max(1, Math.ceil(matched.length / pageSize));
  const page = Math.min(query.page, pages);
  return { rows: matched.slice((page - 1) * pageSize, page * pageSize), matched: matched.length, page, pages };
}

/**
 * 类型分组（按本地化短名合并，键是组内第一个 source 枚举值——URL 用它）。
 * `items` 传哪个集合就数哪个集合。
 */
export function tallyTypes(items: PresentItem[]): { key: string; label: string; count: number }[] {
  const map = new Map<string, { key: string; label: string; count: number }>();
  for (const i of items) {
    const hit = map.get(i.sourceShort);
    if (hit) {
      hit.count++;
      // 键取组内字典序最小的枚举值：不管哪个集合、哪种顺序，同一组生成的 URL 都一样
      if (i.source < hit.key) hit.key = i.source;
    } else map.set(i.sourceShort, { key: i.source, label: i.sourceShort, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/** 生成 `/prizes?…`：在当前查询上覆盖若干项；空值与 page=1 省略。改筛选时调用方传 `page: 1`。 */
export function hrefFor(query: LibraryQuery, patch: Partial<LibraryQuery>): string {
  const q = { ...query, ...patch };
  const sp = new URLSearchParams();
  if (q.type) sp.set("type", q.type);
  if (q.q) sp.set("q", q.q);
  if (q.life) sp.set("life", q.life);
  if (q.status) sp.set("status", q.status);
  if (q.page > 1) sp.set("page", String(q.page));
  const s = sp.toString();
  return s ? `/prizes?${s}` : "/prizes";
}

/** 页码窗口：首页、末页、当前页前后各 2；中间断开处用 null 表示省略号 */
export function pageWindow(page: number, pages: number): (number | null)[] {
  const want = new Set([1, pages]);
  for (let p = page - 2; p <= page + 2; p++) if (p >= 1 && p <= pages) want.add(p);
  const sorted = [...want].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  for (const p of sorted) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && p - prev > 1) out.push(null);
    out.push(p);
  }
  return out;
}
