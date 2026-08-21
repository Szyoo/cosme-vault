/**
 * 进程内事件总线 —— 给 SSE 用。
 *
 * 目的：让「回传」真正实时。runner 侧本来就是即时的（`pushLog` 每条日志立刻 POST），
 * 慢的是前端——控制台原先靠 4 秒轮询 `router.refresh()`，所以日志最多晚 4 秒才看得见。
 * 现在 runner 的端点落库后往这里 `publish()`，SSE 把消息推给浏览器，前端立刻刷新。
 *
 * ⚠️ **是进程内的**，不跨进程。当前部署是单容器单进程（compose 里 web 只有一个），
 * 所以够用。哪天上多 worker / 多副本，这里必须换成 Redis pub/sub 之类的外部通道，
 * 否则「写心跳的进程」和「持有 SSE 连接的进程」可能不是同一个，推送就丢了
 * ——和 runner-state 当初从进程内存改成落库是同一类问题。
 */
export type EventKind = "log" | "report" | "heartbeat" | "queue";

type Listener = (kind: EventKind) => void;

const listeners = new Set<Listener>();

export function publish(kind: EventKind): void {
  for (const fn of listeners) {
    try {
      fn(kind);
    } catch {
      // 单个订阅者出错不能拖累其他订阅者（连接可能刚断）
    }
  }
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** 当前订阅数，仅用于诊断 */
export function subscriberCount(): number {
  return listeners.size;
}
