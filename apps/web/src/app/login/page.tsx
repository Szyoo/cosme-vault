/**
 * 登录页（服务端外壳）。
 *
 * 门户 SSO（`SZYYW_SSO=1`）打开时本地登录不再使用：直接跳门户登录页，回跳到本站
 * （带上 `next`，Bark 深链接的查询串不丢）。关闭时渲染原来的本地登录表单。
 *
 * ⚠️ 必须 force-dynamic：否则页面在 `next build` 时被静态预渲染，开关值会按**构建期**
 * 环境（未设置）固化进产物，运行时再开 SSO 也不生效。
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginUrl, ssoEnabled } from "@szyyw/auth";
import { PORTAL_ORIGIN, siteUrl } from "@/lib/sso.ts";
import { LoginClient } from "./login-form.tsx";
import { safeNext } from "./safe-next.ts";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  if (ssoEnabled()) {
    const raw = (await searchParams).next;
    const next = safeNext(Array.isArray(raw) ? raw[0] : raw);
    redirect(loginUrl(PORTAL_ORIGIN, siteUrl(await headers(), new URL("http://localhost:3000"), next)));
  }
  return <LoginClient />;
}
