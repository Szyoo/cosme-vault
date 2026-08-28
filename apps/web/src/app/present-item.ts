/**
 * 列表项的「已本地化」形状 —— **一个奖品一项**，账号状态收在项内。
 *
 * ⚠️ 2026-08-25 改：此前按「奖品 × 账号」出项，两个账号就是 376 行同名奖品
 * （用户指出）。奖品是全局的，账号状态是它的属性，不该把行数乘以账号数。
 *
 * 为什么要这一层：筛选在**客户端**做（一两百条数据已在页面里），所以数据必须能
 * 跨 RSC 边界序列化。字典 `t` 里有函数、不能传，故在服务端就把类型名 / 状态名 /
 * 配色算好，客户端只拿纯字符串。
 */
import type { Dict } from "@/i18n/dict.ts";
import { fmtDateTime } from "@/lib/when.ts";
import { isPeriodExpired } from "@cosme/core";
import { mergeStatus, sourceOf, statusOf } from "./labels.ts";

/** 来自库的原始行（一行 = 一个奖品 × 一个账号） */
export interface RawRow {
  presentId: string;
  accountId: string;
  status: string;
  name: string | null;
  brand: string | null;
  imageUrl: string | null;
  period: string | null;
  quantity: string | null;
  source: string | null;
  pattern?: string | null;
  error?: string | null;
  at?: string | null;
}

/** 奖品在某个账号下的状态 */
export interface AccountState {
  accountId: string;
  /** 账号短名（邮箱 @ 前的部分，列表里够辨认又不占地方） */
  short: string;
  label: string;
  status: string;
  statusLabel: string;
  statusPill: string;
  at: string | null;
  error: string | null;
}

/** 交给客户端组件的形状：**全是可序列化的纯值** */
export interface PresentItem {
  presentId: string;
  title: string;
  brand: string | null;
  imageUrl: string | null;
  period: string | null;
  quantity: string | null;
  /** 筛选用的原始枚举值 */
  source: string;
  /** 展示用的已本地化文案与配色 */
  sourceShort: string;
  sourceFull: string;
  sourcePill: string;
  /** 各账号在这个奖品上的状态（按账号顺序） */
  accounts: AccountState[];
  /**
   * 奖品**自己**的状态，与账号无关（用户指出：投没投是账号的事，
   * 「还在不在募集」是奖品的事，两个维度不能混）。
   * active=募集中 / expired=已下架 / gone=页面 404
   */
  life: "active" | "expired" | "gone";
  /** 最近一次变动时间（各账号取最新），用于记录页排序展示 */
  at: string | null;
}

const shortOf = (label: string): string => label.split("@")[0] ?? label;

/**
 * 把「奖品 × 账号」的行聚合成「一个奖品一项」。
 * `accountOrder` 决定账号在项内的排列顺序（与账号矩阵一致，便于对照）。
 */
export function toItems(
  rows: RawRow[],
  accounts: { id: string; label: string }[],
  t: Dict,
): PresentItem[] {
  const byPresent = new Map<string, PresentItem>();
  const order = new Map(accounts.map((a, i) => [a.id, i]));

  for (const r of rows) {
    let item = byPresent.get(r.presentId);
    if (!item) {
      const src = sourceOf(r.source ?? "", t);
      item = {
        presentId: r.presentId,
        title: r.name ?? r.presentId,
        brand: r.brand,
        imageUrl: r.imageUrl,
        period: r.period,
        quantity: r.quantity,
        source: r.source ?? "",
        sourceShort: src.short,
        sourceFull: src.full,
        sourcePill: src.pill,
        accounts: [],
        at: null,
        life: "active",
      };
      byPresent.set(r.presentId, item);
    }
    // 归并后再本地化：库里 alreadyEntered 与 drawn 分开存（重跑安全的依据），
    // 但界面上是同一档，否则筛选栏会出现两个都叫「已投递」的按钮
    const merged = mergeStatus(r.status);
    const st = statusOf(merged, t);
    const label = accounts.find((a) => a.id === r.accountId)?.label ?? r.accountId;
    const at = fmtDateTime(r.at);
    item.accounts.push({
      accountId: r.accountId,
      short: shortOf(label),
      label,
      status: merged,
      statusLabel: st.label,
      statusPill: st.pill,
      at,
      error: r.error ?? null,
    });
    if (at && (!item.at || at > item.at)) item.at = at;
  }

  for (const item of byPresent.values()) {
    item.accounts.sort((a, b) => (order.get(a.accountId) ?? 99) - (order.get(b.accountId) ?? 99));
    item.life = lifeOf(item);
  }
  return [...byPresent.values()];
}

/**
 * 判定奖品**自己**还在不在募集，与账号无关。
 *
 * 两路证据，任一成立即判为不在募集：
 * 1. **任一账号**跑到过 gone/expired —— 那是 runner 在站点上亲眼看到的结论
 *    （页面 404、或写着「受付は終了」且已无应募入口）。奖品下架对所有账号都成立，
 *    所以哪个账号撞见的不重要。gone 优先于 expired：404 更值得人看一眼。
 * 2. **期间已过** —— 兜住「还没有任何账号跑过它」的那些，光看账号状态会漏掉，
 *    它们会一直以「募集中」的面目留在概览里。
 */
function lifeOf(item: PresentItem): "active" | "expired" | "gone" {
  if (item.accounts.some((a) => a.status === "gone")) return "gone";
  if (item.accounts.some((a) => a.status === "expired")) return "expired";
  if (isPeriodExpired(item.period)) return "expired";
  return "active";
}


/**
 * 按类型统计（供概览与列表筛选共用）。
 *
 * ⚠️ 按**已本地化的短名**分组而不是按 source 枚举值：`brandFanClub` 与
 * `brandFanClubViaBrand` 是同一类奖品（只是入口路径不同，一个 article 直链、
 * 一个经品牌主页），短名都叫「粉丝俱乐部」。按枚举值分组会出现两个同名按钮
 * （42 和 10），用户根本分不出该点哪个。
 */
export function tallySource(items: PresentItem[]): { value: string; label: string; count: number }[] {
  const map = new Map<string, { value: string; label: string; count: number }>();
  for (const i of items) {
    const hit = map.get(i.sourceShort);
    if (hit) hit.count++;
    else map.set(i.sourceShort, { value: i.sourceShort, label: i.sourceShort, count: 1 });
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

/**
 * 按状态统计：口径是「**任一账号**处于该状态」。
 * 一个奖品可能在 A 账号已投、在 B 账号待投，两边都该被数到，否则筛选会漏。
 * 因此各状态之和**可以大于**奖品总数——这是有意的，不是算错。
 */
export function tallyStatus(items: PresentItem[]): { value: string; label: string; pill: string; count: number }[] {
  const map = new Map<string, { value: string; label: string; pill: string; count: number }>();
  for (const i of items) {
    for (const st of new Map(i.accounts.map((a) => [a.status, a])).values()) {
      const hit = map.get(st.status);
      if (hit) hit.count++;
      else map.set(st.status, { value: st.status, label: st.statusLabel, pill: st.statusPill, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}


/** 按奖品自身状态统计（与账号无关）。各项之和 **等于** 奖品总数——它是互斥的三档。 */
export function tallyLife(items: PresentItem[]): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.life, (map.get(i.life) ?? 0) + 1);
  return (["active", "expired", "gone"] as const)
    .map((k) => ({ value: k, count: map.get(k) ?? 0 }))
    .filter((x) => x.count > 0);
}
