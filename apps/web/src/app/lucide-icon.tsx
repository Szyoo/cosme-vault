/**
 * 设计包线性图标（`@szyyw/design/icons`）的 React 外壳。
 *
 * 为什么不直接 `<span dangerouslySetInnerHTML={{ __html: iconSvg(…) }} />`：包里按钮的图标尺寸规则
 * 都是直接子选择器（`.close-x > .icon`、`.btn-ghost > .icon` …），多包一层 span 就失效。
 * 这里把 `iconSvg()` 的输出原样拆成 `<svg>` 自身的属性 + 内部标记，渲染出来的就是包生成的那枚 svg，
 * 图形数据仍然只来自包（不在应用里抄 SVG）。服务端 / 客户端组件都能用（icons.js 顶层不碰 DOM）。
 */
import type { SVGProps } from "react";
import { iconSvg, type IconName, type IconOptions } from "@szyyw/design/icons";

/** HTML 属性名 → React 属性名（`class` → `className`，`stroke-width` → `strokeWidth`；aria-* 原样） */
function reactAttr(name: string): string {
  if (name === "class") return "className";
  if (name.startsWith("aria-") || name.startsWith("data-")) return name;
  return name.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function Icon({ name, ...options }: { name: IconName } & IconOptions) {
  const svg = iconSvg(name, options);
  const open = svg.indexOf(">");
  const props: Record<string, string> = {};
  for (const m of svg.slice(4, open).matchAll(/([\w:-]+)="([^"]*)"/g)) props[reactAttr(m[1]!)] = m[2]!;
  const inner = svg.slice(open + 1, svg.lastIndexOf("</svg>"));
  return <svg {...(props as SVGProps<SVGSVGElement>)} dangerouslySetInnerHTML={{ __html: inner }} />;
}
