/**
 * 奖品概览：**奖品自己**的状态与类型分布，放在首页靠上的位置。
 *
 * ⚠️ 这里的「状态」与账号无关（用户明确指出）：投没投是**账号**的事，
 * 「还在不在募集」是**奖品**的事，两个维度不能混。账号维度在上面的
 * 「各账号进度」里已经有了，这里回答的是另一个问题——**现在还有多少能抽**。
 *
 * 默认只展示**募集中**的那些（用户要的是「现在有效的」，不是全部），
 * 已下架 / 404 折在旁边一行小字里，需要时点开。
 *
 * chip 可点，筛的就是下面那份列表并把视线带过去——与账号进度条的下钻同一套交互。
 */
"use client";

import { useMemo } from "react";
import { useT } from "@/i18n/context.tsx";
import { tallyLife, tallySource, type PresentItem } from "./present-item.ts";
import { usePresentFilter, scrollToList } from "./present-filter.tsx";

/** 奖品自身状态的文案与配色（与投递状态那套 pill 配色保持一致） */
const LIFE_PILL: Record<string, string> = { active: "green", expired: "amber", gone: "red" };

export function PresentOverview({ items }: { items: PresentItem[] }) {
  const t = useT();
  const { source, life, setSource, setLife } = usePresentFilter();

  const lives = useMemo(() => tallyLife(items), [items]);
  // 类型分布只算**募集中**的：概览要回答「现在还有多少能抽」，
  // 把已下架的算进类型里会让「PR 合作 110」看着还有 110 个能投，其实早没了
  const active = useMemo(() => items.filter((i) => i.life === "active"), [items]);
  const sources = useMemo(() => tallySource(active), [active]);

  function pickLife(v: string) {
    setLife(life === v ? null : v);
    scrollToList();
  }
  /** 点类型 = 「募集中的这一类」，与上面看到的数字一致，所见即所得 */
  function pickSource(v: string) {
    setSource(source === v ? null : v);
    setLife("active");
    scrollToList();
  }

  const lifeLabel = (k: string) =>
    k === "active" ? t.overview.active : k === "expired" ? t.status.expired : t.status.gone;

  return (
    <section className="glass section">
      <div className="row spread">
        <div className="section-name">{t.overview.title}</div>
        <span className="tiny muted num">{t.overview.activeOf(active.length, items.length)}</span>
      </div>

      <div className="ov-row">
        <span className="ov-label">{t.overview.lifeLabel}</span>
        <div className="ov-chips">
          {lives.map((l) => (
            <button
              key={l.value}
              type="button"
              className={`pill pill-btn ${LIFE_PILL[l.value] ?? ""}${life === l.value ? " active" : ""}`}
              onClick={() => pickLife(l.value)}
            >
              {lifeLabel(l.value)} <span className="num">{l.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="ov-row">
        <span className="ov-label">{t.overview.typeLabel}</span>
        <div className="ov-chips">
          {sources.length === 0 ? (
            <span className="tiny muted">{t.overview.noneActive}</span>
          ) : (
            sources.map((s) => (
              <button
                key={s.value}
                type="button"
                className={`pill pill-btn${source === s.value ? " active" : ""}`}
                onClick={() => pickSource(s.value)}
              >
                {s.label} <span className="num">{s.count}</span>
              </button>
            ))
          )}
        </div>
      </div>

      <p className="tiny muted ov-foot">{t.overview.hint}</p>
    </section>
  );
}
