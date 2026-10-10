/**
 * 登录防暴力：**越错越慢，但永不锁死**。
 *
 * 为什么要有：控制面在公网上，登录接口原先可以无限次、零延迟地尝试——管理员密码
 * 一度是字面上的 `password`（2026-09-30 发现），撞库字典第一条就能进来，进来就能拿
 * 两个 @cosme 账号真实投递。
 *
 * 为什么不是「连错 N 次锁 15 分钟」（2026-09-30 定）：那会把自己锁在外面。
 * 暴力破解的命门是**速度**（一秒试几百次），人不需要速度。所以：
 * - 前 FREE_FAILS 次输错**完全无感**（正常手滑的范围）；
 * - 之后每错一次，下一次要等 1、2、4、8、16… 秒，**封顶 MAX_WAIT_MS**；
 * - 人最坏也只是等 30 秒再输一次；机器被压到每分钟两次，一天不到 3000 次，
 *   配上像样的密码等于永远试不中。
 * 等待是**按时间戳放行**（没到点直接拒绝），不是 sleep——开多少并发都绕不过去。
 *
 * 状态放**进程内存**：当前 compose 里 web 只有一个进程，够用（与 events.ts 的事件总线
 * 同一个前提）。重启会清零——可接受，攻击者没法靠重启我们的容器来重置计数。
 * 上多副本时要换成共享存储，否则各副本各数各的。
 */
const FREE_FAILS = 5;
const MAX_WAIT_MS = 30_000;
/** 这么久没再输错，计数作废（免得昨天的两次手滑累计进来） */
const RESET_AFTER_MS = 30 * 60 * 1000;

interface Entry {
  fails: number;
  lastFailAt: number;
  /** 这个时刻之前的尝试一律直接拒绝（不校验密码） */
  nextAllowedAt: number;
}

const byIp = new Map<string, Entry>();

/**
 * 取客户端 IP。生产在 Caddy 反代之后：Caddy 默认**丢弃**不可信客户端自带的
 * X-Forwarded-For、改写成它亲眼看到的对端地址，所以取**最后一段**——
 * 即便链路上有人伪造前面几段，最后一段也是 Caddy 写的。
 */
export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1]!;
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

/** 清理过期条目，防止大量不同 IP 把内存撑大 */
function prune(now: number): void {
  for (const [ip, e] of byIp) {
    if (now - e.lastFailAt > RESET_AFTER_MS) byIp.delete(ip);
  }
}

/** 该 IP 现在还得等几秒才能再试（向上取整）；可以试则返回 null */
export function waitSeconds(ip: string): number | null {
  const e = byIp.get(ip);
  const now = Date.now();
  if (!e || e.nextAllowedAt <= now) return null;
  return Math.ceil((e.nextAllowedAt - now) / 1000);
}

/** 记一次输错，并排定下一次最早可试的时刻 */
export function recordFailure(ip: string): void {
  const now = Date.now();
  prune(now);
  const prev = byIp.get(ip);
  const fails = prev && now - prev.lastFailAt <= RESET_AFTER_MS ? prev.fails + 1 : 1;
  const over = fails - FREE_FAILS;
  const wait = over > 0 ? Math.min(1000 * 2 ** (over - 1), MAX_WAIT_MS) : 0;
  byIp.set(ip, { fails, lastFailAt: now, nextAllowedAt: now + wait });
}

/** 输对即清零 */
export function recordSuccess(ip: string): void {
  byIp.delete(ip);
}
