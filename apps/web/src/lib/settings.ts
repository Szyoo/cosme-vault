/**
 * 应用设置（app_settings 键值表）的读写。
 *
 * Bark 配置的语义：**库里的值优先，环境变量兜底**。
 * 用户要求在网页里就能配（不必登服务器改 .env 再重启）；同时不破坏已有部署——
 * VPS 上 compose 注入的环境变量在库里没配过时照常生效。
 */
import { eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";

export function getSetting(key: string): string | null {
  const row = db.select().from(schema.appSettings).where(eq(schema.appSettings.key, key)).get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const now = new Date().toISOString();
  db.insert(schema.appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({ target: schema.appSettings.key, set: { value, updatedAt: now } })
    .run();
}

export function deleteSetting(key: string): void {
  db.delete(schema.appSettings).where(eq(schema.appSettings.key, key)).run();
}

/** Bark 配置：库优先、环境变量兜底。source 告诉界面这个值是哪来的。 */
export function getBarkConfig(): {
  server: string;
  deviceKey: string;
  source: "db" | "env" | "none";
} {
  const dbServer = getSetting("bark.server");
  const dbKey = getSetting("bark.deviceKey");
  if (dbServer && dbKey) return { server: dbServer, deviceKey: dbKey, source: "db" };

  const envServer = process.env.BARK_SERVER?.trim() ?? "";
  const envKey = process.env.BARK_DEVICE_KEY?.trim() ?? "";
  if (envServer && envKey) return { server: envServer, deviceKey: envKey, source: "env" };
  return { server: dbServer ?? envServer, deviceKey: dbKey ?? envKey, source: "none" };
}
