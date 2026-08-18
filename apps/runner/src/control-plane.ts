/**
 * 控制面客户端（pull 模型）。
 * runner 主动出站调用 web 的 /api/runner/*，不开任何入站端口、不依赖 tailnet。
 */
import {
  NextJobResponse,
  type JobReport,
  type RunnerHeartbeat,
  type RunnerLog,
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
    method: "GET",
    headers: authHeaders(),
    signal,
  });
  if (!res.ok) throw new Error(`领取任务失败：HTTP ${res.status}`);
  return NextJobResponse.parse(await res.json());
}

/** 上报任务最终结果 */
export async function reportJob(report: JobReport): Promise<void> {
  const res = await fetch(url("/api/runner/report"), {
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
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(hb),
    });
  } catch {
    // 心跳失败不影响任务
  }
}
