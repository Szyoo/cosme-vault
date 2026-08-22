/**
 * Bark 推送配置：
 *   GET  当前配置（server 与 deviceKey **原样回显**——用户明确要求可见；
 *        它是推送地址不是登录凭证，泄露风险 = 会收到垃圾通知，可随时在 App 里换）
 *   PUT  保存 { server, deviceKey }，存 app_settings（库优先、.env 兜底）
 *   POST 发一条测试推送——配置对不对，手机响一下最直观
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth.ts";
import { getBarkConfig, setSetting } from "@/lib/settings.ts";
import { sendBark } from "@/lib/bark.ts";
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
  return NextResponse.json(getBarkConfig());
}

const Body = z.object({
  server: z.string().trim().url().or(z.literal("")),
  deviceKey: z.string().trim().max(120),
});

export async function PUT(req: Request): Promise<NextResponse> {
  const denied = await guard();
  if (denied) return denied;
  const t = await getT();
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: t.api.badParams }, { status: 400 });
  setSetting("bark.server", parsed.data.server);
  setSetting("bark.deviceKey", parsed.data.deviceKey);
  return NextResponse.json({ ok: true, ...getBarkConfig() });
}

export async function POST(): Promise<NextResponse> {
  const denied = await guard();
  if (denied) return denied;
  const t = await getT();
  const ok = await sendBark({
    title: "Cosme Vault",
    body: t.barkSettings.testBody,
    group: "cosme-vault",
    sound: "minuet",
  });
  return ok
    ? NextResponse.json({ ok: true })
    : NextResponse.json({ error: t.barkSettings.testFailed }, { status: 502 });
}
