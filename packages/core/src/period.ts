/**
 * 应募期间的解析与归一化。
 *
 * 站点上同一个期间有多种记法（实测）：
 * - 列表页：`8/19～9/15`
 * - タイアップ页：`8月19日（水）～9月15日`
 * - 详情页：`応募受付：8/17～8/23`
 *
 * 不归一化的后果：跨来源没法比较（audit 会把同一期间报成「不一致」），
 * 展示也乱。统一成 `M/D～M/D`。
 */

/** 从任意记法里抽出 `M/D～M/D`；抽不出返回 null（**不要用别的内容凑**） */
export function normalizePeriod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.replace(/\s+/g, "");

  // 先剥掉「応募受付：」「応募期間：」这类前缀与括号里的星期
  const body = s.replace(/^.*?(?:応募(?:受付|期間))[：:]/, "").replace(/[（(][^）)]{0,3}[）)]/g, "");

  // 8月19日～9月15日 / 8/19～9/15 / 8月19日~9/15 都能吃
  const m = body.match(/(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?\s*[～~\-–]\s*(\d{1,2})\s*[\/月]\s*(\d{1,2})\s*日?/);
  if (!m) return null;
  const [, m1, d1, m2, d2] = m;
  return `${Number(m1)}/${Number(d1)}～${Number(m2)}/${Number(d2)}`;
}

/**
 * 期间是否已过（用于跳过过期奖品）。
 * 只有月/日没有年份，故跨年时按「结束月比当前月小很多」推断为次年。
 */
export function isPeriodExpired(period: string | null | undefined, now = new Date()): boolean {
  const norm = normalizePeriod(period);
  if (!norm) return false; // 判断不了就不当过期，交给页面自己说
  const m = norm.match(/～(\d{1,2})\/(\d{1,2})$/);
  if (!m) return false;
  const endMonth = Number(m[1]);
  const endDay = Number(m[2]);
  let year = now.getFullYear();
  if (endMonth < now.getMonth() + 1 - 6) year += 1; // 12月→1月 这类跨年
  const end = new Date(year, endMonth - 1, endDay, 23, 59, 59);
  return end < now;
}
