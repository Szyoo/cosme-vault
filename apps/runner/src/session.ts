/**
 * @COSME 会话有效性判断（login.ts 与 runner 的 login 任务共用）。
 *
 * ⚠️ 不能只看「是否被重定向到授权服务器」——实测 brandfanclub 页未登录时
 * 照样返回 200，只是渲染成未登录版本。可靠依据是页面上还有没有登录入口
 * （未登录版本会渲染 `/isauth/login/` 链接）。
 */
import type { BrowserContext } from "playwright";
import { selectors } from "@cosme/core";

/** 登录后才能看到内容的页面 */
export const GATED_URL = selectors.LIST_URLS.brandFanClub;

export async function isSessionValid(ctx: BrowserContext): Promise<boolean> {
  const page = await ctx.newPage();
  try {
    await page.goto(GATED_URL, { waitUntil: "domcontentloaded", timeout: 30_000 });
    const loginLinks = await page.locator('a[href*="/isauth/login/"]').count();
    return loginLinks === 0;
  } finally {
    await page.close().catch(() => undefined);
  }
}
