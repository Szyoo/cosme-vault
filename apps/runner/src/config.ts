/** runner 运行配置，全部来自环境变量（经 --env-file 注入）。 */

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少必需的环境变量：${name}`);
  return v;
}

export const config = {
  /** 控制面基址：VPS 阶段为 compose 内网地址，Mac mini 阶段为公网 https */
  controlPlaneUrl: (process.env.CONTROL_PLANE_URL ?? "http://web:3000").replace(/\/$/, ""),
  /** 拉取任务的鉴权令牌，与控制面 RUNNER_TOKEN 一致 */
  runnerToken: required("RUNNER_TOKEN"),
  /** Playwright 浏览器通道：'chrome' 用系统真 Chrome（指纹更像真人），留空用内置 chromium */
  channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
  /** runner 部署位，仅用于心跳展示 */
  location: (process.env.RUNNER_LOCATION ?? "unknown") as "vps" | "mac-mini" | "unknown",
  /** 是否无头（VPS 阶段 true；Mac mini 调试期设 false 看画面） */
  headless: process.env.RUNNER_HEADLESS !== "false",
  /** 持久化浏览器 profile 目录（保登录态，避免反复登录这个最高风险动作） */
  profileDir: process.env.RUNNER_PROFILE_DIR ?? "./profile",
  /** 现场快照（截图/HTML/trace）输出目录 */
  artifactsDir: process.env.RUNNER_ARTIFACTS_DIR ?? "./artifacts",
  /** 长轮询领取任务的等待上限（毫秒） */
  pollTimeoutMs: Number(process.env.RUNNER_POLL_TIMEOUT_MS ?? 25_000),
} as const;
