import type { Metadata } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
// @szyyw/design：设计令牌 + 玻璃组件层（与作者其他项目共用同一套设计语言）
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";
// 本应用的外壳布局（放在包之后，才能覆盖/补充）
import "./globals.css";
import { DesignChrome } from "./design-chrome.tsx";
import { getI18n } from "@/i18n/server.ts";
import { I18nProvider } from "@/i18n/context.tsx";
import { LocaleSwitcher } from "@/i18n/switcher.tsx";

/** 标题也跟着语言走（⚠️ Next 16：generateMetadata 里同样要 await cookies） */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return { title: t.appName, description: t.appSub };
}

export default async function RootLayout({
  children,
  modal,
}: {
  children: ReactNode;
  /**
   * 平行路由 slot：从列表点奖品时由拦截路由填进来（modal 呈现）。
   * 见 `app/@modal/(.)presents/[presentId]/page.tsx` 与 `modal-shell.tsx`。
   */
  modal: ReactNode;
}) {
  // 明暗模式持久化在 cookie 里：SSR 项目必须服务端读到，首屏才不闪白
  // （设计规范第 5 节，与 scheme.ts 的 persist: "cookie" 对应）
  const jar = await cookies();
  const scheme = jar.get("cosme_scheme")?.value ?? "auto";
  const { locale } = await getI18n();

  return (
    <html lang={locale} data-theme="nebula" data-scheme={scheme}>
      <body>
        {/* z-index 0：点阵背景独立合成层 */}
        <div className="bg-layer" />
        <I18nProvider locale={locale}>
          {/* z-index 1：内容层 */}
          <div className="app-frame">{children}</div>
          {/* modal 层：children 保持挂载，所以列表的筛选状态不会丢 */}
          {modal}
          {/* 语言切换放右上角，与设计包挂的明暗切换同列 */}
          <LocaleSwitcher />
        </I18nProvider>
        <DesignChrome />
      </body>
    </html>
  );
}
