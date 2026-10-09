/**
 * 奖品库的服务端视图块：概览、筛选栏、分页条。全部是**链接与 GET 表单**，不靠客户端状态——
 * 筛选与分页都在 URL 里（见 library.ts），匿名与登录同一套，没有 JS 也能用。
 */
import Link from "next/link";
import type { Dict } from "@/i18n/dict.ts";
import { sourceOf } from "../labels.ts";
import { tallyLife, tallyStatus, type PresentItem } from "../present-item.ts";
import { hrefFor, pageWindow, tallyTypes, type LibraryQuery } from "./library.ts";

const LIFE_PILL: Record<string, string> = { active: "green", expired: "amber", gone: "red" };
/** 筛选/翻页后把视线带回列表 */
const toList = (href: string) => `${href}#presents`;

function lifeLabel(k: string, t: Dict): string {
  return k === "active" ? t.overview.active : k === "expired" ? t.status.expired : t.status.gone;
}

/** 奖品概览（与控制台的 PresentOverview 同一套排版与口径，chip 改成链接） */
export function LibraryOverview({ items, query, t }: { items: PresentItem[]; query: LibraryQuery; t: Dict }) {
  const lives = tallyLife(items);
  const active = items.filter((i) => i.life === "active");
  const types = tallyTypes(active);
  const typeLabel = query.type ? sourceOf(query.type, t).short : null;
  return (
    <section className="glass panel section">
      <div className="row wrap spread">
        <div className="section-name">{t.overview.title}</div>
        <span className="tiny muted num">{t.overview.activeOf(active.length, items.length)}</span>
      </div>
      <div className="ov-row">
        <span className="ov-label">{t.overview.lifeLabel}</span>
        <div className="ov-chips">
          {lives.map((l) => {
            const on = query.life === l.value;
            return (
              <Link
                key={l.value}
                className={`pill pill-btn ${LIFE_PILL[l.value] ?? ""}${on ? " active" : ""}`}
                href={toList(hrefFor(query, { life: on ? null : l.value as LibraryQuery["life"], page: 1 }))}
              >
                {lifeLabel(l.value, t)} <span className="num">{l.count}</span>
              </Link>
            );
          })}
        </div>
      </div>
      <div className="ov-row">
        <span className="ov-label">{t.overview.typeLabel}</span>
        <div className="ov-chips">
          {types.length === 0 ? (
            <span className="tiny muted">{t.overview.noneActive}</span>
          ) : (
            types.map((s) => {
              const on = typeLabel === s.label && query.life === "active";
              return (
                <Link
                  key={s.key}
                  className={`pill pill-btn${on ? " active" : ""}`}
                  href={toList(hrefFor(query, on ? { type: null, page: 1 } : { type: s.key, life: "active", page: 1 }))}
                >
                  {s.label} <span className="num">{s.count}</span>
                </Link>
              );
            })
          )}
        </div>
      </div>
      <p className="tiny muted ov-foot">{t.overview.hint}</p>
    </section>
  );
}

function Chip({ href, active, label, count }: { href: string; active: boolean; label: string; count: number }) {
  return (
    <Link className={`chip filter-chip${active ? " active" : ""}`} href={toList(href)}>
      {label}
      <span className="filter-count num">{count}</span>
    </Link>
  );
}

/** 筛选栏：关键词是 GET 表单（提交即回到第 1 页），类型/状态是链接。计数按全集算，与以前一致。 */
export function LibraryFilters({
  items,
  query,
  matched,
  showStatus,
  t,
}: {
  items: PresentItem[];
  query: LibraryQuery;
  matched: number;
  showStatus: boolean;
  t: Dict;
}) {
  const types = tallyTypes(items);
  const statuses = showStatus ? tallyStatus(items) : [];
  const typeLabel = query.type ? sourceOf(query.type, t).short : null;
  const filtering = query.type !== null || query.status !== null || query.life !== null || query.q !== "";
  return (
    <div className="filters">
      <form className="row wrap" style={{ gap: 8 }} method="get" action="/prizes">
        <input className="field filter-search" style={{ flex: 1 }} name="q" defaultValue={query.q} placeholder={t.filter.search} />
        {query.type && <input type="hidden" name="type" value={query.type} />}
        {query.life && <input type="hidden" name="life" value={query.life} />}
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <button type="submit" className="btn-ghost btn-small">{t.prizes.searchGo}</button>
      </form>

      <div className="filter-row">
        <span className="filter-label">{t.filter.byType}</span>
        <Chip href={hrefFor(query, { type: null, page: 1 })} active={query.type === null} label={t.filter.all} count={items.length} />
        {types.map((s) => (
          <Chip
            key={s.key}
            href={hrefFor(query, { type: typeLabel === s.label ? null : s.key, page: 1 })}
            active={typeLabel === s.label}
            label={s.label}
            count={s.count}
          />
        ))}
      </div>

      {showStatus && (
        <div className="filter-row">
          <span className="filter-label">{t.filter.byStatus}</span>
          <Chip href={hrefFor(query, { status: null, page: 1 })} active={query.status === null} label={t.filter.all} count={items.length} />
          {statuses.map((s) => (
            <Chip
              key={s.value}
              href={hrefFor(query, { status: query.status === s.value ? null : s.value, page: 1 })}
              active={query.status === s.value}
              label={s.label}
              count={s.count}
            />
          ))}
        </div>
      )}

      <div className="filter-foot">
        <span className="tiny muted">{t.prizes.total(matched, items.length)}</span>
        {filtering && (
          <Link className="btn-ghost btn-small" href="/prizes#presents">
            {t.filter.reset}
          </Link>
        )}
      </div>
    </div>
  );
}

/** 分页条（列表上下各一份）：上一页 / 页码（当前页高亮）/ 下一页 + 总数 */
export function Pager({
  query,
  page,
  pages,
  matched,
  total,
  t,
}: {
  query: LibraryQuery;
  page: number;
  pages: number;
  matched: number;
  total: number;
  t: Dict;
}) {
  return (
    <nav className="pager" aria-label={t.prizes.pager} data-pager>
      <span className="tiny muted num">
        {t.prizes.total(matched, total)} · {t.prizes.pageOf(page, pages)}
      </span>
      <span className="pager-links">
        {page > 1 ? (
          <Link className="chip" href={toList(hrefFor(query, { page: page - 1 }))} rel="prev">
            {t.prizes.prev}
          </Link>
        ) : (
          <span className="chip pager-off" aria-disabled>{t.prizes.prev}</span>
        )}
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap${i}`} className="tiny muted">…</span>
          ) : p === page ? (
            <span key={p} className="chip active num" aria-current="page">{p}</span>
          ) : (
            <Link key={p} className="chip num" href={toList(hrefFor(query, { page: p }))}>
              {p}
            </Link>
          ),
        )}
        {page < pages ? (
          <Link className="chip" href={toList(hrefFor(query, { page: page + 1 }))} rel="next">
            {t.prizes.next}
          </Link>
        ) : (
          <span className="chip pager-off" aria-disabled>{t.prizes.next}</span>
        )}
      </span>
    </nav>
  );
}
