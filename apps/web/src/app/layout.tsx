import type { Metadata } from "next";
import type { ReactNode } from "react";
// @szyyw/design：设计令牌 + 玻璃组件层（与其他项目共用）
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";

export const metadata: Metadata = {
  title: "Cosme Vault",
  description: "@COSME 抽奖辅助控制面",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" data-theme="nebula" data-scheme="auto">
      <body>{children}</body>
    </html>
  );
}
