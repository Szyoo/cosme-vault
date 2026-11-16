/**
 * 当前部署的版本号：Next 每次构建生成的 `.next/BUILD_ID`。
 *
 * 页面把它写进 `<html data-version>`，`/api/version` 返回它；主屏 App 里的
 * `autoUpdate`（web-app.tsx）发现两者不同就自动重载。两处读的是同一个文件，
 * 所以一定一致（不用构建时注入的时间戳——构建会在多个进程里各求值一次 next.config）。
 * standalone 运行时 cwd 就是 apps/web，dev 下内容是 "development"。读不到时为空串，
 * 前端拿到空版本就不做自动更新。
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

let cached: string | null = null;

export function appVersion(): string {
  if (cached === null) {
    try {
      cached = readFileSync(join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
    } catch {
      cached = "";
    }
  }
  return cached;
}
