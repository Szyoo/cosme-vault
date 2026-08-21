/**
 * 队列的展示视图 —— **按批次聚合**。
 *
 * ⚠️ 这里存在的理由是一次设计纠正：队列原先按 job 逐条列，而「跑一轮」会产生上百个
 * draw（一个奖品一个 job），界面上就成了「26 个任务在排队」。那是内部实现，
 * 不是用户的操作单位——用户想的是「一轮」算一个任务、「单独点重跑」算一个任务
 * （用户原话：按你这个说法很容易让人误会，且没必要做成这种形式）。
 *
 * 所以按 `jobs.batch_id` 聚合：
 *   一轮      → 一条，带进度（已完成 / 总数）
 *   单独重跑   → 一条，标上奖品名
 *
 * 每批的顺序取组内最早的排序键，与 `claimNextJob` 的 order by createdAt 一致，
 * 这样界面上的先后就是 runner 真正的取用先后。
 */
import { db, schema } from "@/db/index.ts";

export type BatchKind = "run" | "single";

export interface QueueBatch {
  batchId: string;
  kind: BatchKind;
  trigger: string;
  /** 排序键：组内最早的 createdAt */
  firstAt: string | null;
  /** 这一批总共多少个 job */
  total: number;
  queued: number;
  running: number;
  done: number;
  failed: number;
  /** single 批次显示的奖品名；run 批次为 null */
  label: string | null;
  /** 正在执行的那一个在做什么（奖品名），用于「一轮」显示当前进度 */
  currentLabel: string | null;
  /** 是否还有未跑完的（决定能不能取消） */
  active: boolean;
}

/** 队列里最多列多少批 */
const MAX_SHOWN = 12;

export function loadQueue(): { batches: QueueBatch[]; hidden: number; activeJobs: number } {
  // 只关心「还没结束」的批次：全部 done/failed 的属于历史，记录页去看
  const rows = db.select().from(schema.jobs).all();

  const presents = new Map(
    db
      .select({ id: schema.presents.id, name: schema.presents.name })
      .from(schema.presents)
      .all()
      .map((p) => [p.id, p.name]),
  );

  const presentNameOf = (payload: string): string | null => {
    try {
      const p = JSON.parse(payload) as { presentId?: string };
      return p.presentId ? (presents.get(p.presentId) ?? p.presentId) : null;
    } catch {
      return null;
    }
  };

  const groups = new Map<string, QueueBatch & { _rows: typeof rows }>();
  for (const j of rows) {
    // 迁移前入队的老任务没有 batch_id，按 job 自己成一批，免得整批消失看不见
    const key = j.batchId ?? `legacy:${j.id}`;
    let g = groups.get(key);
    if (!g) {
      g = {
        batchId: key,
        kind: (j.batchKind ?? "single") as BatchKind,
        trigger: j.trigger,
        firstAt: j.createdAt,
        total: 0,
        queued: 0,
        running: 0,
        done: 0,
        failed: 0,
        label: null,
        currentLabel: null,
        active: false,
        _rows: [],
      };
      groups.set(key, g);
    }
    g._rows.push(j);
    g.total++;
    if (j.status === "queued") g.queued++;
    else if (j.status === "running") g.running++;
    else if (j.status === "done") g.done++;
    else if (j.status === "failed") g.failed++;
    if (j.createdAt && (!g.firstAt || j.createdAt < g.firstAt)) g.firstAt = j.createdAt;
    if (j.status === "running") g.currentLabel = presentNameOf(j.payload);
  }

  const all = [...groups.values()]
    .filter((g) => g.queued > 0 || g.running > 0) // 只列未跑完的
    .map((g) => {
      // single 批次就一个 job，直接拿它的奖品名当标题
      const label = g.kind === "single" ? presentNameOf(g._rows[0]!.payload) : null;
      const { _rows, ...rest } = g;
      void _rows;
      return { ...rest, label, active: g.queued > 0 || g.running > 0 };
    })
    .sort((a, b) => (a.firstAt ?? "").localeCompare(b.firstAt ?? ""));

  return {
    batches: all.slice(0, MAX_SHOWN),
    hidden: Math.max(0, all.length - MAX_SHOWN),
    activeJobs: all.reduce((n, g) => n + g.queued + g.running, 0),
  };
}
