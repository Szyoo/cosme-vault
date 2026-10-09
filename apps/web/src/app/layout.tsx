import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { ssoEnabled } from "@szyyw/auth";
import {
  appearanceAttrs,
  appearanceCookieNames,
  readAppearanceFromCookies,
  themeColorFor,
} from "@szyyw/design/appearance-data";
// @szyyw/design：设计令牌 + 玻璃组件层（与作者其他项目共用同一套设计语言）
import "@szyyw/design/tokens.css";
import "@szyyw/design/components.css";
// 本应用的外壳布局（放在包之后，才能覆盖/补充）
import "./globals.css";
import { DesignChrome } from "./design-chrome.tsx";
import { getI18n } from "@/i18n/server.ts";
import { I18nProvider } from "@/i18n/context.tsx";
import { PORTAL_ORIGIN } from "@/lib/sso.ts";

/**
 * 外观三项（主题 / 配色 / 明暗）的 cookie：前缀 "cosme_" → cosme_theme / cosme_palette / cosme_scheme，
 * 与客户端 mountChrome 的 cookiePrefix 同一组（design-chrome.tsx）。cosme_scheme 沿用旧名，已存偏好不丢。
 */
const APPEARANCE_COOKIES = appearanceCookieNames("cosme_");

/** SSR 首屏读外观（设计规范 §2.1）。明暗没选过时按本应用一贯的缺省「跟随系统」 */
function readAppearance(jar: { get(name: string): { value: string } | undefined }) {
  return readAppearanceFromCookies(
    (name) => jar.get(name)?.value ?? (name === APPEARANCE_COOKIES.scheme ? "auto" : undefined),
    APPEARANCE_COOKIES,
  );
}

/** 浏览器 chrome 着色跟随配色与明暗，服务端算好（auto 时按系统明暗各给一条） */
export async function generateViewport(): Promise<Viewport> {
  const { palette, scheme } = readAppearance(await cookies());
  if (scheme === "auto") {
    const c = themeColorFor(palette, "auto");
    return {
      themeColor: [
        { media: "(prefers-color-scheme: dark)", color: c.dark },
        { media: "(prefers-color-scheme: light)", color: c.light },
      ],
    };
  }
  return { themeColor: themeColorFor(palette, scheme) };
}

/** 标题也跟着语言走（⚠️ Next 16：generateMetadata 里同样要 await cookies） */
export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: t.appName,
    description: t.appSub,
    // 统一图标（平台 branding/ 生成，文件在 public/）：svg 首选，ico 兜底
    icons: {
      icon: [
        { url: "/favicon.svg", type: "image/svg+xml" },
        { url: "/favicon.ico", sizes: "any" },
      ],
      apple: "/apple-touch-icon.png",
    },
  };
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
  // 外观持久化在 cookie 里：SSR 项目必须服务端读到并铺到 <html>，首屏才不闪
  const appearance = readAppearance(await cookies());
  const { locale } = await getI18n();

  return (
    <html lang={locale} {...appearanceAttrs(appearance)}>
      <body>
        {/* z-index 0：点阵背景独立合成层 */}
        <div className="bg-layer" />
        <I18nProvider locale={locale}>
          {/* z-index 1：内容层 */}
          <div className="app-frame">{children}</div>
          {/* modal 层：children 保持挂载，所以列表的筛选状态不会丢 */}
          {modal}
          {/* 右上角工具位（切换器 / 账户只在门户 SSO 下挂；语言、明暗、外观都在这里） */}
          <DesignChrome portal={ssoEnabled() ? PORTAL_ORIGIN : null} />
        </I18nProvider>
      </body>
    </html>
  );
}
