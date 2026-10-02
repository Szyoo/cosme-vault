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
 *
 * 奖品库 `/prizes` 不用这个组件：那里数据量大、要分页，筛选与分页都在服务端按 URL 做
 * （见 prizes/library.ts）；行组件两边共用（present-row.tsx）。
 */
"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context.tsx";
import { tallySource, tallyStatus, type PresentItem } from "./present-item.ts";
import { usePresentFilter } from "./present-filter.tsx";
import { Row } from "./present-row.tsx";

export function PresentList({ items }: { items: PresentItem[] }) {
  const t = useT();
  // 筛选状态与顶部的「奖品概览」共享（见 present-filter.tsx）：
  // 上面点一个类型/状态，下面这份列表跟着筛
  const { source, status, life, q, setSource, setStatus, setQ, reset } = usePresentFilter();

  const sources = useMemo(() => tallySource(items), [items]);
  const statuses = useMemo(() => tallyStatus(items), [items]);

  const shown = useMemo(() => {
    // 关键词大小写与全半角不敏感（站点里 @cosme 与 ＠ｃｏｓｍｅ 混用）
    const needle = q.normalize("NFKC").toLowerCase().trim();
    return items.filter((i) => {
      if (source && i.sourceShort !== source) return false;
      // 奖品自身状态（募集中/已下架/404），由顶部概览设置
      if (life && i.life !== life) return false;
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
  }, [items, source, status, life, q]);

  const filtering = source !== null || status !== null || life !== null || q.trim() !== "";

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
              onClick={reset}
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
