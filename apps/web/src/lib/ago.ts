/**
 * 「多久之前」的粗粒度格式化。
 *
 * 只在服务端组件里用：首页每 4 秒自动重渲染，所以相对时间会自己变新，
 * 不需要客户端定时器（也就不会有水合不一致）。
 */
import type { Dict } from "@/i18n/dict.ts";

export function formatAgo(ms: number, t: Dict): string {
  const min = Math.floor(ms / 60_000);
  if (min < 1) return t.ago.justNow;
  if (min < 60) return t.ago.minutes(min);
  const hours = Math.floor(min / 60);
  if (hours < 24) return t.ago.hours(hours);
  return t.ago.days(Math.floor(hours / 24));
}
