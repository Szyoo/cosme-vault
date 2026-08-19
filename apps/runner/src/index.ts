/**
 * runner 主循环（pull 模型）。
 *
 * 反复：心跳 → 长轮询领任务 → 分发执行 → 上报结果（失败/未知模式附现场快照）。
 * draw 与 inspect 已实现；scan（奖品扫描）待实现。
 */
import type { DrawJob, InspectJob, Job, JobReport, ScanJob } from "@cosme/contract";
import { config } from "./config.ts";
import { fetchCredentials, fetchNextJob, pushLog, reportJob, sendHeartbeat } from "./control-plane.ts";
import { closeBrowser, newPage } from "./browser.ts";
import { captureArtifacts } from "./artifacts.ts";
import { drawOnce } from "./cosme/draw.ts";
import { inspectPage } from "./cosme/inspect.ts";

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

async function handleDraw(job: DrawJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // 凭证按需拉取，不进任务载荷（避免明文落 jobs 表）
  const credentials = await fetchCredentials(job.accountId);
  const page = await newPage();
  try {
    const outcome = await drawOnce(
      page,
      {
        presentLink: job.presentLink,
        credentials,
        resolvedChoices: job.resolvedChoices,
      },
      {
        log: (text, level = "info") => pushLog({ jobId: job.id, at: nowIso(), level, text }),
      },
    );

    // 未知模式与失败都留现场，便于事后补 pattern 或排查
    const needArtifacts = outcome.status === "unknownPattern" || outcome.status === "failed";
    const artifacts = needArtifacts ? await captureArtifacts(page, job.id) : null;

    return { ok: outcome.status !== "failed", outcome, error: null, artifacts };
  } finally {
    await page.close().catch(() => undefined);
  }
}

async function handleInspect(job: InspectJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // 只读巡检：回传页面全部可交互元素与建议选择器，用于校验/补写 selectors
  const page = await newPage();
  try {
    await page.goto(job.url, { waitUntil: "domcontentloaded", timeout: 40_000 });
    const elements = await inspectPage(page);
    await pushLog({ jobId: job.id, at: nowIso(), level: "info", text: `巡检 ${job.url}：${elements.length} 个可交互元素` });
    return {
      ok: true,
      outcome: { kind: "inspect", elements },
      error: null,
      artifacts: await captureArtifacts(page, job.id),
    };
  } finally {
    await page.close().catch(() => undefined);
  }
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
