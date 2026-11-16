/**
 * 当前部署的版本号（见 lib/version.ts），给主屏 App 的自动更新比对。
 * 不含任何数据，匿名也可取（proxy.ts 放行）。
 */
import { NextResponse } from "next/server";
import { appVersion } from "@/lib/version.ts";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json({ version: appVersion() }, { headers: { "Cache-Control": "no-store" } });
}
