/**
 * 奖品库的服务端视图块：概览、筛选栏、分页条。全部是**链接与 GET 表单**，不靠客户端状态——
 * 筛选与分页都在 URL 里（见 library.ts），匿名与登录同一套，没有 JS 也能用。
 */
import Link from "next/link";
import type { Dict } from "@/i18n/dict.ts";
import { sourceOf } from "../labels.ts";
import { tallyLife, tallyStatus, type PresentItem } from "../present-item.ts";
import { hrefFor, pageWindow, tallyTypes, type LibraryQuery } from "./library.ts";
import { Icon } from "../lucide-icon.tsx";

const LIFE_PILL: Record<string, string> = { active: "ok", expired: "warn", gone: "err" };
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
                className={`pill ${LIFE_PILL[l.value] ?? ""}`}
                aria-pressed={on}
                href={toList(hrefFor(query, { life: on ? null : l.value as LibraryQuery["life"], page: 1 }))}
              >
                {lifeLabel(l.value, t)}
                <span className="count">{l.count}</span>
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
                  className="pill"
                  aria-pressed={on}
                  href={toList(hrefFor(query, on ? { type: null, page: 1 } : { type: s.key, life: "active", page: 1 }))}
                >
                  {s.label}
                  <span className="count">{s.count}</span>
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
    <Link className={`chip${active ? " active" : ""}`} href={toList(href)} aria-current={active ? "true" : undefined}>
      {label}
      <span className="count">{count}</span>
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
      <form className="row" method="get" action="/prizes">
        <div className="field-wrap search u-flex-1">
          <input type="search" className="field" name="q" defaultValue={query.q} placeholder={t.filter.search} />
        </div>
        {query.type && <input type="hidden" name="type" value={query.type} />}
        {query.life && <input type="hidden" name="life" value={query.life} />}
        {query.status && <input type="hidden" name="status" value={query.status} />}
        <button type="submit" className="btn-ghost btn-small">{t.prizes.searchGo}</button>
      </form>

      <div className="chip-group">
        <span className="chip-group-label">{t.filter.byType}</span>
        <div className="chip-row">
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
      </div>

      {showStatus && (
        <div className="chip-group">
          <span className="chip-group-label">{t.filter.byStatus}</span>
          <div className="chip-row">
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
        </div>
      )}

      <div className="row spread">
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

/**
 * 分页条（列表上下各一份）。外观用设计包的 `.pager` 公开类（与 pager.js 生成的结构同名同层级），
 * 但不挂 pager.js：筛选与分页都在 URL 里，页码就是普通链接，没有 JS 也能用。
 * 链接版的页码键补一个本应用的 `.pager-link`（`<a>` 需要居中与去下划线）；到头的上/下一页是禁用的 button。
 * ≤520px 包会藏起页码、显示 `.pager-cur`（3 / 20）。
 */
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
      <span className="pager-info">
        {t.prizes.total(matched, total)} · {t.prizes.pageOf(page, pages)}
      </span>
      <span className="pager-nav">
        {page > 1 ? (
          <Link
            className="pager-btn pager-step pager-link"
            href={toList(hrefFor(query, { page: page - 1 }))}
            rel="prev"
            aria-label={t.prizes.prev}
          >
            <Icon name="chevron-left" />
          </Link>
        ) : (
          <button type="button" className="pager-btn pager-step" disabled aria-label={t.prizes.prev}>
            <Icon name="chevron-left" />
          </button>
        )}
        {pageWindow(page, pages).map((p, i) =>
          p === null ? (
            <span key={`gap${i}`} className="pager-gap">
              …
            </span>
          ) : p === page ? (
            <span key={p} className="pager-btn pager-num pager-link active" aria-current="page">
              {p}
            </span>
          ) : (
            <Link key={p} className="pager-btn pager-num pager-link" href={toList(hrefFor(query, { page: p }))}>
              {p}
            </Link>
          ),
        )}
        <span className="pager-cur">
          {page} / {pages}
        </span>
        {page < pages ? (
          <Link
            className="pager-btn pager-step pager-link"
            href={toList(hrefFor(query, { page: page + 1 }))}
            rel="next"
            aria-label={t.prizes.next}
          >
            <Icon name="chevron-right" />
          </Link>
        ) : (
          <button type="button" className="pager-btn pager-step" disabled aria-label={t.prizes.next}>
            <Icon name="chevron-right" />
          </button>
        )}
      </span>
    </nav>
  );
}
