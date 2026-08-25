/**
 * 节奏参数（网页设置页用）：
 *   GET  当前值
 *   PUT  保存 —— runner 在下一次心跳后（≤15 秒）拉到新值
 */
import { NextResponse } from "next/server";
import { PacingConfig } from "@cosme/contract";
import { requireUser } from "@/lib/auth.ts";
import { getPacingConfig, setPacingConfig } from "@/lib/settings.ts";
import { getT } from "@/i18n/server.ts";

export const dynamic = "force-dynamic";

async function guard(): Promise<NextResponse | null> {
  try {
    await requireUser();
    return null;
  } catch {
    const t = await getT();
    return NextResponse.json({ error: t.api.notLoggedIn }, { status: 401 });
  }
}

export async function GET(): Promise<NextResponse> {
  const denied = await guard();
  if (denied) return denied;
  return NextResponse.json(getPacingConfig());
}

export async function PUT(req: Request): Promise<NextResponse> {
  const denied = await guard();
  if (denied) return denied;
  const t = await getT();
  const parsed = PacingConfig.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  setPacingConfig(parsed.data);
  return NextResponse.json({ ok: true, ...getPacingConfig() });
}
