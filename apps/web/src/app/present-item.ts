/**
 * 列表项的「已本地化」形状。
 *
 * 为什么要这一层：奖品列表要在**客户端**做筛选（138 条，走服务端往返太慢），
 * 所以数据必须能跨 RSC 边界序列化。字典 `t` 里有函数、不能传，故在服务端就把
 * 类型名 / 状态名 / 配色算好，客户端只拿纯字符串。
 */
import type { Dict } from "@/i18n/dict.ts";
import { fmtDateTime } from "@/lib/when.ts";
import { sourceOf, statusOf } from "./labels.ts";

/** 来自库的原始行（控制台与记录页的 select 形状的交集） */
export interface RawRow {
  presentId: string;
  status: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  period: string | null;
  quantity: string | null;
  source: string | null;
  pattern?: string | null;
  error?: string | null;
  accountLabel?: string | null;
  at?: string | null;
}

/** 交给客户端组件的形状：**全是可序列化的纯值** */
export interface PresentItem {
  presentId: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  period: string | null;
  quantity: string | null;
  pattern: string | null;
  error: string | null;
  accountLabel: string | null;
  at: string | null;
  /** 筛选用的原始枚举值 */
  source: string;
  status: string;
  /** 展示用的已本地化文案与配色 */
  sourceShort: string;
  sourceFull: string;
  sourcePill: string;
  statusLabel: string;
  statusPill: string;
}

export function toItem(r: RawRow, t: Dict): PresentItem {
  const src = sourceOf(r.source ?? "", t);
  const st = statusOf(r.status, t);
  return {
    presentId: r.presentId,
    title: r.name ?? r.presentId,
    brand: r.brand,
    imageUrl: r.imageUrl,
    period: r.period,
    quantity: r.quantity,
    pattern: r.pattern ?? null,
    error: r.error ?? null,
    accountLabel: r.accountLabel ?? null,
    // 库里是 UTC，这里就转成当地时区——原先直接印字符串，界面上差 9 小时
    at: fmtDateTime(r.at),
    source: r.source ?? "",
    status: r.status,
    sourceShort: src.short,
    sourceFull: src.full,
    sourcePill: src.pill,
    statusLabel: st.label,
    statusPill: st.pill,
  };
}
