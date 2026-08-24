/**
 * runner 主循环（pull 模型）。
 *
 * 反复：心跳 → 长轮询领任务 → 分发执行 → 上报结果（失败/未知模式附现场快照）。
 * scan / draw / inspect 均已实现。
 */
import type { DrawJob, InspectJob, Job, JobReport, ScanJob } from "@cosme/contract";
import { config } from "./config.ts";
import { fetchCredentials, fetchNextJob, pushLog, reportJob, sendHeartbeat, fetchRunnerConfig } from "./control-plane.ts";
import { closeBrowser, newPage, restartBrowser } from "./browser.ts";
import { captureArtifacts } from "./artifacts.ts";
import { drawOnce } from "./cosme/draw.ts";
import { inspectPage } from "./cosme/inspect.ts";
import { scanSources } from "./cosme/scan.ts";
import { betweenPresentsDelay, stepDelay, updatePacing } from "./pacing.ts";

let currentJobId: string | null = null;
let stopping = false;

function nowIso(): string {
  return new Date().toISOString();
}

async function heartbeatLoop(): Promise<void> {
  while (!stopping) {
    await sendHeartbeat({ location: config.location, at: nowIso(), busyJobId: currentJobId });
    // 顺路拉节奏配置：设置页改完 ≤15 秒生效（拉不到就沿用旧值）
    updatePacing(await fetchRunnerConfig());
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

async function handleScan(job: ScanJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  const page = await newPage(job.accountId);
  try {
    const { presents, reports } = await scanSources(
      page,
      job.sources,
      (text, level = "info") => pushLog({ jobId: job.id, at: nowIso(), level, text }),
      // 两跳解析器要逐个访问品牌主页，用较短的步进停顿而非奖品间隔
      () => new Promise((r) => setTimeout(r, stepDelay())),
    );

    // 有来源没认出版式 → 留现场，便于补解析器
    const unrecognized = reports.some((r) => !r.recognized);
    return {
      ok: true,
      outcome: { kind: "scan", presents, sourceReports: reports },
      error: null,
      artifacts: unrecognized ? await captureArtifacts(page, job.id) : null,
    };
  } finally {
    await closePageSafely(page);
  }
}

async function handleDraw(job: DrawJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // 凭证按需拉取，不进任务载荷（避免明文落 jobs 表）
  const credentials = await fetchCredentials(job.accountId);
  const page = await newPage(job.accountId);
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
    await closePageSafely(page);
  }
}

async function handleInspect(job: InspectJob): Promise<Omit<JobReport, "jobId" | "finishedAt">> {
  // 只读巡检：回传页面全部可交互元素与建议选择器，用于校验/补写 selectors
  const page = await newPage(job.accountId);
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
    await closePageSafely(page);
  }
}

/**
 * 关页面但不赌它会返回。
 *
 * ⚠️ 2026-08-23 实测：3 个 tieup 任务在**投递成功后**吊死在 `page.close()` 上
 * （PR 页载着一堆广告追踪脚本，close 等渲染进程应答等不到），各白吃 10 分钟
 * 看门狗。close 输给 5 秒计时就放着让它自生自灭——留一个僵尸标签页的代价
 * 远小于阻塞主循环；看门狗仍是最终兜底。
 */
async function closePageSafely(page: { close: () => Promise<void> }): Promise<void> {
  await Promise.race([
    page.close().catch(() => undefined),
    new Promise<void>((r) => setTimeout(r, 5_000)),
  ]);
}

/** 单个任务的最长执行时间。正常 draw 连问卷不到 2 分钟，10 分钟只可能是吊死。 */
const JOB_TIMEOUT_MS = 10 * 60 * 1000;

/** Promise 竞速超时。⚠️ 输了的那个 Promise 仍在后台悬着——调用方必须重启浏览器善后。 */
function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
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
      // ⚠️ 任务级看门狗（2026-08-23 实测教训）：一个 draw 曾把整个主循环吊死一小时——
      // Playwright 的个别调用在页面/浏览器进入坏状态时会永不返回，进程活着、心跳照跳
      //（界面上还显示「在线·执行中」），但 80 个排队任务没人领。控制面 15 分钟就把任务
      // 回收了，runner 自己却不会醒。超时后把浏览器整个杀掉重启（僵死的是页面级调用，
      // 只放弃 Promise 不够——底下的 Chrome 还占着 profile 锁），然后上报失败继续跑。
      let report: JobReport;
      try {
        report = await withTimeout(runJob(job), JOB_TIMEOUT_MS, `任务 ${job.id} 超过 ${JOB_TIMEOUT_MS / 60000} 分钟未完成`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[runner] 看门狗触发：${msg}，重启浏览器`);
        await pushLog({ jobId: job.id, at: nowIso(), level: "error", text: `看门狗：${msg}，浏览器已重启` }).catch(() => undefined);
        await restartBrowser().catch(() => undefined);
        report = { jobId: job.id, finishedAt: nowIso(), ok: false, outcome: null, error: msg, artifacts: null };
      }
      await reportJob(report);

      // 合规底线：奖品之间要有人类速度的随机间隔。
      // 放在这里而不是控制面，可保证无论任务怎么入队都不会连珠炮式投递。
      if (job.kind === "draw") {
        const gap = betweenPresentsDelay();
        console.log(`[runner] 距下一个奖品等待 ${Math.round(gap / 1000)} 秒（合规节奏）`);
        await sleep(gap);
      }
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
