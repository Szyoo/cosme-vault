/**
 * 设置页入口（服务端）：只负责把 `ssoEnabled()` 传给客户端组件——客户端读不到 `SZYYW_SSO`。
 * 页面本体见 `settings-client.tsx`。
 */
import { ssoEnabled } from "@szyyw/auth";
import { SettingsClient } from "./settings-client.tsx";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  return <SettingsClient sso={ssoEnabled()} />;
}
