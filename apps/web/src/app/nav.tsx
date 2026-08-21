/**
 * 页面顶部导航（tab）。各页共用，避免每页抄一遍。
 * 原先放在页面底部——奖品列表有一百多条，等于要滚完整页才能换页，故上移。
 * 服务端组件之间传字典 `t`（字典里有函数，不能跨 RSC 边界传给客户端组件）。
 */
import type { Dict } from "@/i18n/dict.ts";

export function Nav({
  diagnosticsCount = 0,
  current,
  t,
}: {
  diagnosticsCount?: number;
  current?: string;
  t: Dict;
}) {
  const items = [
    { href: "/", label: t.nav.console },
    { href: "/records", label: t.nav.records },
    { href: "/diagnostics", label: diagnosticsCount > 0 ? `${t.nav.diagnostics} (${diagnosticsCount})` : t.nav.diagnostics },
    { href: "/settings", label: t.nav.settings },
  ];
  return (
    <nav className="chip-row nav-top">
      {items.map((i) => (
        <a key={i.href} className={`chip ${current === i.href ? "active" : ""}`} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
