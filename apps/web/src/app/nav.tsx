/** 页面底部导航。各页共用，避免每页抄一遍。 */
export function Nav({ diagnosticsCount = 0, current }: { diagnosticsCount?: number; current?: string }) {
  const items = [
    { href: "/", label: "控制台" },
    { href: "/records", label: "记录" },
    { href: "/diagnostics", label: diagnosticsCount > 0 ? `诊断 (${diagnosticsCount})` : "诊断" },
    { href: "/settings", label: "设置" },
  ];
  return (
    <nav className="chip-row section">
      {items.map((i) => (
        <a key={i.href} className={`chip ${current === i.href ? "active" : ""}`} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
