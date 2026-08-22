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

import { PACING } from "@cosme/core";
import type { RunnerConfig } from "@cosme/contract";

/** 节奏配置：库优先、core 默认值兜底。给设置页与 /api/runner/config 共用。 */
export function getPacingConfig(): RunnerConfig {
  const read = (key: string, fallback: number): number => {
    const v = Number(getSetting(key));
    return Number.isFinite(v) && v >= 0 ? v : fallback;
  };
  const cfg = {
    stepDelayMs: {
      min: read("pacing.step.min", PACING.stepDelayMs.min),
      max: read("pacing.step.max", PACING.stepDelayMs.max),
    },
    betweenPresentsMs: {
      min: read("pacing.between.min", PACING.betweenPresentsMs.min),
      max: read("pacing.between.max", PACING.betweenPresentsMs.max),
    },
  };
  // min > max 视为配置写反了，交换而不是报错——runner 靠它跑，宁可容错
  for (const r of [cfg.stepDelayMs, cfg.betweenPresentsMs]) {
    if (r.min > r.max) [r.min, r.max] = [r.max, r.min];
  }
  return cfg;
}

export function setPacingConfig(cfg: RunnerConfig): void {
  setSetting("pacing.step.min", String(cfg.stepDelayMs.min));
  setSetting("pacing.step.max", String(cfg.stepDelayMs.max));
  setSetting("pacing.between.min", String(cfg.betweenPresentsMs.min));
  setSetting("pacing.between.max", String(cfg.betweenPresentsMs.max));
}
