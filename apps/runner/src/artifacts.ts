/**
 * 现场快照：失败时留下截图 + HTML + trace，弥补无头环境「看不见画面」。
 *
 * 这是当初决定「后端可以跑在无头 VPS 上」的前提条件之一。
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Page } from "playwright";
import type { Artifacts } from "@cosme/contract";
import { config } from "./config.ts";

/** 为某个任务抓一组现场快照；任何一步失败都不应影响主流程，故各自 try */
export async function captureArtifacts(page: Page, jobId: string): Promise<Artifacts> {
  const dir = join(config.artifactsDir, jobId);
  await mkdir(dir, { recursive: true }).catch(() => undefined);

  const result: Artifacts = { screenshotPath: null, htmlSnapshotPath: null, tracePath: null };

  try {
    const p = join(dir, "screenshot.png");
    await page.screenshot({ path: p, fullPage: true });
    result.screenshotPath = p;
  } catch {
    // 页面已关闭等情况下截图会失败，忽略
  }

  try {
    const p = join(dir, "page.html");
    await writeFile(p, await page.content(), "utf8");
    result.htmlSnapshotPath = p;
  } catch {
    // 同上
  }

  return result;
}
