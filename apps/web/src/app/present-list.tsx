/**
 * 奖品列表 + 顶部筛选。控制台与记录页共用。
 *
 * 筛选**在客户端做**：138 条数据已经在页面里，按类型/状态/关键词过滤不值得走一趟
 * 服务端（而且首页 4 秒自动刷新一次，用 URL 参数还得处理刷新时保留筛选）。
 * 代价是数据要能跨 RSC 边界序列化——所以拿的是 `PresentItem`（纯字符串），
 * 类型名与状态名在服务端就本地化好了，见 present-item.ts。
 *
 * 行的排版刻意不用表格：8 列信息在手机上必然横向溢出，表格只能横滚、一屏看不全。
 * 改成**两行一条**——图片跨两行、第一行标题（单行省略）、第二行参数（可换行）。
 */
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/i18n/context.tsx";
import type { PresentItem } from "./present-item.ts";
import { GoneFix } from "./gone-fix.tsx";

/**
 * 统计某个字段的取值与条数，用于生成筛选按钮（只列真实存在的取值）。
 *
 * ⚠️ 类型筛选按**已本地化的短名**分组而不是按 source 枚举值：
 * `brandFanClub` 与 `brandFanClubViaBrand` 是同一类奖品（只是入口路径不同，
 * 一个 article 直链、一个经品牌主页），短名都叫「粉丝俱乐部」。按枚举值分组会
 * 出现两个同名按钮（42 和 10），用户根本分不出该点哪个。
 */
function tallySource(items: PresentItem[]) {
  const map = new Map<string, { value: string; label: string; count: number }>();
  for (const i of items) {
    const hit = map.get(i.sourceShort);
    if (hit) hit.count++;
    else map.set(i.sourceShort, { value: i.sourceShort, label: i.sourceShort, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * 状态维度按「**任一账号**处于该状态」统计——一个奖品可能在 A 账号已投、
 * 在 B 账号待投，两边都该被数到，否则筛选会漏。
 */
function tallyStatus(items: PresentItem[]) {
  const map = new Map<string, { value: string; label: string; count: number }>();
  for (const i of items) {
    for (const st of new Map(i.accounts.map((a) => [a.status, a])).values()) {
      const hit = map.get(st.status);
      if (hit) hit.count++;
      else map.set(st.status, { value: st.status, label: st.statusLabel, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function PresentList({ items }: { items: PresentItem[] }) {
  const t = useT();
  const [source, setSource] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const sources = useMemo(() => tallySource(items), [items]);
  const statuses = useMemo(() => tallyStatus(items), [items]);

  const shown = useMemo(() => {
    // 关键词大小写与全半角不敏感（站点里 @cosme 与 ＠ｃｏｓｍｅ 混用）
    const needle = q.normalize("NFKC").toLowerCase().trim();
    return items.filter((i) => {
      if (source && i.sourceShort !== source) return false;
      // 任一账号命中即算（同一奖品在不同账号可能状态不同）
      if (status && !i.accounts.some((a) => a.status === status)) return false;
      if (!needle) return true;
      // 也匹配奖品 ID：日志、诊断页、详情页里出现的都是 ID（`bfc-2710647`），
      // 拿到一个 ID 却只能按名字搜，等于搜不到（踩过）
      return `${i.title} ${i.brand ?? ""} ${i.presentId}`
        .normalize("NFKC")
        .toLowerCase()
        .includes(needle);
    });
  }, [items, source, status, q]);

  const filtering = source !== null || status !== null || q.trim() !== "";

  return (
    <>
      <div className="filters">
        <input
          className="field filter-search"
          placeholder={t.filter.search}
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />

        <div className="filter-row">
          <span className="filter-label">{t.filter.byType}</span>
          <FilterChip active={source === null} onClick={() => setSource(null)} label={t.filter.all} count={items.length} />
          {sources.map((s) => (
            <FilterChip
              key={s.value}
              active={source === s.value}
              onClick={() => setSource(source === s.value ? null : s.value)}
              label={s.label}
              count={s.count}
            />
          ))}
        </div>

        <div className="filter-row">
          <span className="filter-label">{t.filter.byStatus}</span>
          <FilterChip active={status === null} onClick={() => setStatus(null)} label={t.filter.all} count={items.length} />
          {statuses.map((s) => (
            <FilterChip
              key={s.value}
              active={status === s.value}
              onClick={() => setStatus(status === s.value ? null : s.value)}
              label={s.label}
              count={s.count}
            />
          ))}
        </div>

        <div className="filter-foot">
          <span className="tiny muted">{t.filter.shown(shown.length, items.length)}</span>
          {filtering && (
            <button
              type="button"
              className="btn-ghost btn-small"
              onClick={() => {
                setSource(null);
                setStatus(null);
                setQ("");
              }}
            >
              {t.filter.reset}
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="small muted">{t.filter.noMatch}</p>
      ) : (
        <ul className="plist">
          {shown.map((i) => (
            <Row key={i.presentId} item={i} statusFilter={status} />
          ))}
        </ul>
      )}
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button type="button" className={`chip filter-chip${active ? " active" : ""}`} onClick={onClick}>
      {label}
      <span className="filter-count num">{count}</span>
    </button>
  );
}

function Row({ item, statusFilter }: { item: PresentItem; statusFilter: string | null }) {
  // 筛选到 404 时给行内改判入口（用户要求：所有展示 404 的界面都要有操作）。
  // 控件放在 Link 外面——放里面点下拉会触发整行导航。
  const goneStates = statusFilter === "gone" ? item.accounts.filter((a) => a.status === "gone") : [];
  return (
    <li>
      {/* ⚠️ 必须是 next/link：拦截路由只在**客户端导航**时接管。
          用普通 <a> 会整页加载，直接绕过 modal，筛选状态照样丢。 */}
      <Link className="prow" href={`/presents/${item.presentId}`} title={item.title}>
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图，不走 next/image
          <img className="prow-img" src={item.imageUrl} alt="" loading="lazy" width={52} height={52} />
        ) : (
          <span className="prow-img prow-img-none" aria-hidden />
        )}

        <span className="prow-name">{item.title}</span>

        <span className="prow-meta">
          <span className={`pill ${item.sourcePill}`} title={item.sourceFull}>
            {item.sourceShort}
          </span>
          {/* 各账号在这个奖品上的状态：多账号时带账号短名，单账号时只显示状态 */}
          {item.accounts.map((a) => (
            <span key={a.accountId} className={`pill ${a.statusPill}`} title={`${a.label}${a.error ? ` — ${a.error}` : ""}`}>
              {item.accounts.length > 1 && <span className="pill-who">{a.short} </span>}
              {a.statusLabel}
            </span>
          ))}
          {item.brand && <span className="prow-brand">{item.brand}</span>}
          {item.quantity && <span className="prow-tag num">{item.quantity}</span>}
          {item.period && <span className="prow-tag num">{item.period}</span>}
          {item.at && <span className="prow-tag muted num">{item.at}</span>}
        </span>
      </Link>
      {goneStates.length > 0 && (
        <div className="prow-fix">
          {goneStates.map((a) => (
            <span key={a.accountId} className="row" style={{ gap: 6 }}>
              {item.accounts.length > 1 && <span className="tiny muted">{a.short}</span>}
              <GoneFix accountId={a.accountId} presentId={item.presentId} />
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
