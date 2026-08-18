/**
 * runner 主循环（pull 模型）。
 *
 * 反复：心跳 → 长轮询领任务 → 分发执行 → 上报结果（失败附现场快照）。
 * 具体抽奖流程（scan/draw/inspect 的页面操作）尚待把初版 Java 业务逻辑移植进来，
 * 现为带类型的骨架，跑通链路但不做真实页面操作。
 */
import type { DrawJob, InspectJob, Job, JobReport, ScanJob } from "@cosme/contract";
import { config } from "./config.ts";
import { fetchNextJob, pushLog, reportJob, sendHeartbeat } from "./control-plane.ts";
import { closeBrowser } from "./browser.ts";

let currentJobId: string | null = null;
let stopping = false;

function nowIso(): string {
  return new Date().toISOString();
}

async function heartbeatLoop(): Promise<void> {
  while (!stopping) {
    await sendHeartbeat({ location: config.location, at: nowIso(), busyJobId: currentJobId });
    await sleep(15_000);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** 分发一个任务到对应处理器 */
async function runJob(job: Job): Promise<JobReport> {
  const base = { jobId: job.id, finishedAt: "" };
  try {
    await pushLog({ jobId: job.id, at: nowIso(), level: "info", text: `开始任务 ${job.kind}` });
    switch (job.kind) {
      case "scan":
        return { ...base, ...(await handleScan(job)), finishedAt: nowIso() };
      case "draw":
        return { ...base, ...(await handleDraw(job)), finishedAt: nowIso() };
      case "inspect":
        return { ...base, ...(await handleInspect(job)), finishedAt: nowIso() };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await pushLog({ jobId: job.id, at: nowIso(), level: "error", text: `任务失败：${message}` });
    return { jobId: job.id, ok: false, outcome: null, error: message, artifacts: null, finishedAt: nowIso() };
  }
}

/* ── 任务处理器（待移植初版业务逻辑，先返回明确的未实现结果） ── */

async function handleScan(_job: ScanJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // TODO(移植): 打开 selectors.LIST_URLS 的两个列表页，提取奖品 → ScanResult
  throw new Error("scan 尚未实现：待移植奖品扫描逻辑");
}

async function handleDraw(_job: DrawJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // TODO(移植): 初版 Draw.gotoFill 状态机 + Fill.fillQuestion（用 @cosme/core 的关键词库）+ send
  //   遇到 needsManualChoice 的问题 → 返回 DrawResult{status:'needsChoice', pendingChoices}
  throw new Error("draw 尚未实现：待移植抽奖流程状态机");
}

async function handleInspect(_job: InspectJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // TODO(移植): 打开 url，回传全部可交互元素清单，用于选择器校验
  throw new Error("inspect 尚未实现：待接入元素清单回传");
}

/* ── 主循环 ── */

async function mainLoop(): Promise<void> {
  console.log(`[runner] 启动，控制面=${config.controlPlaneUrl} 位置=${config.location} 无头=${config.headless}`);
  void heartbeatLoop();

  while (!stopping) {
    try {
      const { job } = await fetchNextJob();
      if (!job) continue; // 长轮询窗口内无任务，直接下一轮
      currentJobId = job.id;
      const report = await runJob(job);
      await reportJob(report);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[runner] 轮询出错，退避重试：${message}`);
      await sleep(5_000); // 控制面不可达时退避，避免打爆
    } finally {
      currentJobId = null;
    }
  }
}

async function shutdown(): Promise<void> {
  stopping = true;
  await closeBrowser();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

// 兜底：让未捕获错误可见而非静默
process.on("unhandledRejection", (reason) => {
  console.error("[runner] 未处理的 Promise 拒绝：", reason);
});

void mainLoop();
