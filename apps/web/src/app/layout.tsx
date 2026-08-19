import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
// @szyyw/design：设计令牌 + 玻璃组件层（与作者其他项目共用同一套设计语言）
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";
// 本应用的外壳布局（放在包之后，才能覆盖/补充）
import "./globals.css";
import { DesignChrome } from "./design-chrome.tsx";

export const metadata: Metadata = {
  title: "Cosme Vault",
  description: "@COSME 抽奖辅助控制面",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 明暗模式持久化在 cookie 里：SSR 项目必须服务端读到，首屏才不闪白
  // （设计规范第 5 节，与 scheme.ts 的 persist: "cookie" 对应）
  const jar = await cookies();
  const scheme = jar.get("cosme_scheme")?.value ?? "auto";

  return (
    <html lang="zh" data-theme="nebula" data-scheme={scheme}>
      <body>
        {/* z-index 0：点阵背景独立合成层 */}
        <div className="bg-layer" />
        {/* z-index 1：内容层 */}
        <div className="app-frame">{children}</div>
        <DesignChrome />
      </body>
    </html>
  );
}
