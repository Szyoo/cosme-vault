/**
 * 控制面客户端（pull 模型）。
 * runner 主动出站调用 web 的 /api/runner/*，不开任何入站端口、不依赖 tailnet。
 */
import {
  AccountCredentials,
  NextJobResponse,
  type JobReport,
  type RunnerHeartbeat,
  type RunnerLog,
  RunnerConfig,
} from "@cosme/contract";
import { config } from "./config.ts";

function url(path: string): string {
  return `${config.controlPlaneUrl}${path}`;
}

function authHeaders(): Record<string, string> {
  return {
    "content-type": "application/json",
    authorization: `Bearer ${config.runnerToken}`,
  };
}

/** 长轮询领取下一个任务；控制面在超时窗口内无任务则返回 { job: null } */
export async function fetchNextJob(signal?: AbortSignal): Promise<NextJobResponse> {
  const res = await fetch(url("/api/runner/next-job"), {
    // 长轮询：服务端最多挂 pollTimeoutMs，客户端多给 15 秒余量
    signal: signal ?? AbortSignal.timeout(config.pollTimeoutMs + 15_000),
    method: "GET",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`领取任务失败：HTTP ${res.status}`);
  return NextJobResponse.parse(await res.json());
}

/** 上报任务最终结果 */
export async function reportJob(report: JobReport): Promise<void> {
  const res = await fetch(url("/api/runner/report"), {
    // 无超时的 fetch 是吊死点（close 那次的教训举一反三）
    signal: AbortSignal.timeout(20_000),
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(report),
  });
  if (!res.ok) throw new Error(`上报结果失败：HTTP ${res.status}`);
}

/** 推送一条实时日志（网页展示） */
export async function pushLog(log: RunnerLog): Promise<void> {
  try {
    await fetch(url("/api/runner/log"), {
    // 无超时的 fetch 是吊死点（close 那次的教训举一反三）
    signal: AbortSignal.timeout(20_000),
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(log),
    });
  } catch {
    // 日志尽力而为，失败不影响任务
  }
}

/** 心跳，告知控制面 runner 在线状态与位置 */
export async function sendHeartbeat(hb: RunnerHeartbeat): Promise<void> {
  try {
    await fetch(url("/api/runner/heartbeat"), {
    // 无超时的 fetch 是吊死点（close 那次的教训举一反三）
    signal: AbortSignal.timeout(20_000),
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(hb),
    });
  } catch {
    // 心跳失败不影响任务
  }
}

/**
 * 按需取某账号的解密凭证。
 * 刻意走独立端点而非任务载荷——后者会把明文写进 jobs 表并留在历史里。
 */
/**
 * 拉运行配置（节奏参数）。失败时返回 null，调用方沿用上一次的值——
 * 配置拉不到不该让 runner 停摆。
 */
export async function fetchRunnerConfig(): Promise<RunnerConfig | null> {
  try {
    const res = await fetch(url("/api/runner/config"), {
    // 无超时的 fetch 是吊死点（close 那次的教训举一反三）
    signal: AbortSignal.timeout(20_000),
      headers: { authorization: `Bearer ${config.runnerToken}` },
    });
    if (!res.ok) return null;
    return RunnerConfig.parse(await res.json());
  } catch {
    return null;
  }
}

export async function fetchCredentials(accountId: string): Promise<AccountCredentials> {
  const res = await fetch(url(`/api/runner/credentials?accountId=${encodeURIComponent(accountId)}`), {
    method: "GET",
    headers: authHeaders(),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`取凭证失败：HTTP ${res.status}`);
  const body = (await res.json()) as { credentials: unknown };
  return AccountCredentials.parse(body.credentials);
}
