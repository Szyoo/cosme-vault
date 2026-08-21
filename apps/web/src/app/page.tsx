/**
 * 控制面首页：runner 状态 + 手动跑一轮 + 奖品与待处理项概览。
 * 样式一律用 @szyyw/design 的类（.glass / .stat-grid / .tbl / .pill / .term …），
 * 不硬编码颜色——规范要求新颜色先进 tokens.css。
 */
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getHeartbeat, isRunnerOnline } from "@/lib/runner-state.ts";
import { RunButton } from "./run-button.tsx";
import { Nav } from "./nav.tsx";
import { LiveRefresh } from "./live-refresh.tsx";

export const dynamic = "force-dynamic";

/** 状态 → 展示文案与 pill 配色 */
const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待投递", pill: "" },
  drawn: { label: "已投递", pill: "green" },
  needsChoice: { label: "待选择", pill: "violet" },
  skipped: { label: "已跳过", pill: "" },
  failed: { label: "失败", pill: "red" },
  unknownPattern: { label: "未知模式", pill: "amber" },
};

export default function Home() {
  const online = isRunnerOnline();
  const hb = getHeartbeat();

  const rows = db
    .select({
      presentId: schema.accountPresents.presentId,
      accountId: schema.accountPresents.accountId,
      status: schema.accountPresents.status,
      pattern: schema.accountPresents.pattern,
      name: schema.presents.name,
      brand: schema.presents.brand,
      imageUrl: schema.presents.imageUrl,
      period: schema.presents.description,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .all();

  const logs = db.select().from(schema.runnerLogs).orderBy(desc(schema.runnerLogs.id)).limit(20).all();

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const needsChoice = rows.filter((r) => r.status === "needsChoice");
  const unknown = rows.filter((r) => r.status === "unknownPattern");

  // 最近一次扫描里有没有「来源版式没认出来」
  const lastScan = db
    .select({ result: schema.jobs.result })
    .from(schema.jobs)
    .where(and(eq(schema.jobs.kind, "scan"), eq(schema.jobs.status, "done")))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(1)
    .get();
  const unrecognizedSources = (() => {
    if (!lastScan?.result) return 0;
    const outcome = (JSON.parse(lastScan.result) as { outcome?: { sourceReports?: { recognized?: boolean }[] } })
      .outcome;
    return (outcome?.sourceReports ?? []).filter((r) => r.recognized === false).length;
  })();
  const diagnosticsCount = unknown.length + unrecognizedSources;

  return (
    <main className="page">
      <h1 className="page-title grad-text">Cosme Vault</h1>
      <p className="page-sub">@COSME 抽奖辅助控制面</p>

      <section className="glass spot section">
        <div className="row spread">
          <div>
            <div className="section-name">Runner</div>
            <p className="small">
              {online ? "🟢 在线" : "⚪️ 离线"}
              {hb ? ` · ${hb.location} · ${hb.busyJobId ? "执行中" : "空闲"}` : " · 尚未收到心跳"}
            </p>
          </div>
          <div className="row">
            <LiveRefresh />
            <RunButton />
          </div>
        </div>
        <p className="tiny muted">
          跑一轮 = 给每个启用账号扫描奖品；扫完自动派发投递，奖品之间按人类速度随机间隔。
        </p>
      </section>

      <section className="stat-grid section">
        <StatCard label="奖品" value={rows.length} sub="已扫描" />
        <StatCard label="已投递" value={counts.drawn ?? 0} sub="本账号" />
        <StatCard label="待投递" value={counts.pending ?? 0} sub="下一轮处理" />
        <StatCard label="待选择" value={needsChoice.length} sub="需要你" />
      </section>

      {needsChoice.length > 0 && (
        <section className="glass section">
          <div className="section-name">需要你选择</div>
          <div className="stack">
            {needsChoice.map((r) => (
              <a key={`${r.accountId}-${r.presentId}`} className="inner row spread" href={`/choices/${r.presentId}?account=${r.accountId}`}>
                <span>
                  {r.brand && <strong>{r.brand} · </strong>}
                  {r.name ?? r.presentId}
                </span>
                <span className="pill violet">去选择</span>
              </a>
            ))}
          </div>
        </section>
      )}

      {diagnosticsCount > 0 && (
        <section className="glass section">
          <div className="section-name">有 {diagnosticsCount} 处未识别的页面版式</div>
          <p className="small">
            runner 已安全中止并留下现场（没有瞎点）。到 <a href="/diagnostics">诊断页</a> 查看元素清单，据此补一个流程模式。
          </p>
        </section>
      )}

      <section className="glass section">
        <div className="section-name">奖品</div>
        {rows.length === 0 ? (
          <div className="empty">
            <div>🎁</div>
            <p>还没有奖品数据，点上面的「跑一轮」开始扫描。</p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>奖品</th>
                  <th>品牌</th>
                  <th>期间</th>
                  <th>状态</th>
                  <th>模式</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS[r.status] ?? { label: r.status, pill: "" };
                  return (
                    <tr key={`${r.accountId}-${r.presentId}`}>
                      <td className="clip" title={r.name ?? r.presentId}>
                        <span className="pz">
                          <Thumb src={r.imageUrl} alt={r.name ?? ""} />
                          <span className="clip">{r.name ?? r.presentId}</span>
                        </span>
                      </td>
                      <td>{r.brand ?? "—"}</td>
                      <td className="num">{r.period ?? "—"}</td>
                      <td>
                        <span className={`pill ${s.pill}`}>{s.label}</span>
                      </td>
                      <td className="mono tiny">{r.pattern ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 终端窗：设计规范第 9 节，日志刻意保持深色 */}
      <section className="term section">
        <div className="term-head">
          <span className={`term-dot`} data-live={online ? "1" : "0"} />
          <span className="term-title">运行日志</span>
        </div>
        <div className="term-body">
          {logs.length === 0 && <div className="term-line debug">（暂无日志）</div>}
          {logs
            .slice()
            .reverse()
            .map((l) => (
              <div key={l.id} className={`term-line ${l.level}`}>
                <span className="term-time">{l.at.replace("T", " ").slice(5, 19)}</span> {l.text}
              </div>
            ))}
        </div>
      </section>

      <Nav diagnosticsCount={diagnosticsCount} />
    </main>
  );
}

/**
 * 奖品缩略图。
 * 无图时画一个占位方块而不是留空——表格行高才不会跳。
 * 图片地址已在 runner 侧经 validateImageUrl 过滤，这里不会拿到占位图或站点图标。
 */
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (!src) return <span className="thumb thumb-none" aria-hidden />;
  // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图，不走 next/image 优化
  return <img className="thumb" src={src} alt={alt} loading="lazy" width={40} height={40} />;
}

function StatCard({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value num">{value}</div>
      <div className="stat-sub">{sub}</div>
    </div>
  );
}
