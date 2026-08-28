/**
 * 奖品概览：站上现有奖品按**类型**与**状态**的分布，放在首页靠上的位置。
 *
 * 为什么单独做：这些数字本来只在奖品列表的筛选栏里有，而列表在页面最底下
 * （一百多条奖品之后），等于要滚到底才看得见（用户要求搬上来）。
 *
 * chip 是**可点的**，点了就筛下面的列表并把视线带过去——与账号进度条的下钻
 * 同一套交互。做成死数字的话，上面一排点不动、下面一排一模一样的能点，更迷惑。
 */
"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context.tsx";
import { tallySource, tallyStatus, type PresentItem } from "./present-item.ts";
import { usePresentFilter, scrollToList } from "./present-filter.tsx";

export function PresentOverview({ items }: { items: PresentItem[] }) {
  const t = useT();
  const { source, status, setSource, setStatus } = usePresentFilter();

  const sources = useMemo(() => tallySource(items), [items]);
  const statuses = useMemo(() => tallyStatus(items), [items]);

  function pickSource(v: string) {
    setSource(source === v ? null : v);
    scrollToList();
  }
  function pickStatus(v: string) {
    setStatus(status === v ? null : v);
    scrollToList();
  }

  return (
    <section className="glass section">
      <div className="row spread">
        <div className="section-name">{t.overview.title}</div>
        <span className="tiny muted num">{t.matrix.totalPresents(items.length)}</span>
      </div>
      <p className="tiny muted">{t.overview.hint}</p>

      <div className="ov-row">
        <span className="ov-label">{t.filter.byType}</span>
        <div className="ov-chips">
          {sources.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`pill pill-btn${source === s.value ? " active" : ""}`}
              onClick={() => pickSource(s.value)}
            >
              {s.label} <span className="num">{s.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ov-row">
        <span className="ov-label">{t.filter.byStatus}</span>
        <div className="ov-chips">
          {statuses.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`pill pill-btn ${s.pill}${status === s.value ? " active" : ""}`}
              onClick={() => pickStatus(s.value)}
            >
              {s.label} <span className="num">{s.count}</span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
