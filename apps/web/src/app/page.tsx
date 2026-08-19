/**
 * 控制面首页：runner 状态 + 手动跑一轮 + 奖品与待处理项概览。
 * 视觉暂用最简样式，待统一到 @szyyw/design。
 */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getHeartbeat, isRunnerOnline } from "@/lib/runner-state.ts";
import { RunButton } from "./run-button.tsx";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "待投递",
  drawn: "已投递",
  needsChoice: "待选择",
  skipped: "已跳过",
  failed: "失败",
  unknownPattern: "未知模式",
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
      period: schema.presents.description,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .all();

  const jobs = db.select().from(schema.jobs).orderBy(desc(schema.jobs.createdAt)).limit(8).all();
  const logs = db.select().from(schema.runnerLogs).orderBy(desc(schema.runnerLogs.id)).limit(8).all();

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const needsChoice = rows.filter((r) => r.status === "needsChoice");

  return (
    <main style={{ maxWidth: 860, margin: "2.5rem auto", padding: "0 1.5rem" }}>
      <h1>Cosme Vault</h1>

      <section style={card}>
        <h2 style={h2}>Runner</h2>
        <p>
          {online ? "🟢 在线" : "⚪️ 离线"}
          {hb ? `　位置：${hb.location}　当前任务：${hb.busyJobId ?? "空闲"}` : "　（尚未收到心跳）"}
        </p>
        <RunButton />
        <p style={{ fontSize: "0.85rem", opacity: 0.65, marginTop: "0.5rem" }}>
          跑一轮 = 给每个启用账号扫描奖品；扫完会自动派发投递任务，奖品之间按人类速度随机间隔。
        </p>
      </section>

      {needsChoice.length > 0 && (
        <section style={{ ...card, borderColor: "var(--primary, #6b8afd)" }}>
          <h2 style={h2}>需要你选择（{needsChoice.length}）</h2>
          <ul>
            {needsChoice.map((r) => (
              <li key={`${r.accountId}-${r.presentId}`} style={{ marginBottom: "0.4rem" }}>
                <a href={`/choices/${r.presentId}?account=${r.accountId}`}>
                  {r.brand ? `${r.brand} · ` : ""}
                  {r.name ?? r.presentId}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section style={card}>
        <h2 style={h2}>奖品（{rows.length}）</h2>
        <p style={{ fontSize: "0.9rem", opacity: 0.75 }}>
          {Object.entries(counts)
            .map(([k, v]) => `${STATUS_LABEL[k] ?? k} ${v}`)
            .join("　·　") || "暂无数据，先跑一轮"}
        </p>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
            <thead>
              <tr>
                <th style={th}>奖品</th>
                <th style={th}>品牌</th>
                <th style={th}>期间</th>
                <th style={th}>状态</th>
                <th style={th}>模式</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.accountId}-${r.presentId}`}>
                  <td style={td}>{r.name ?? r.presentId}</td>
                  <td style={td}>{r.brand ?? "—"}</td>
                  <td style={td}>{r.period ?? "—"}</td>
                  <td style={td}>{STATUS_LABEL[r.status] ?? r.status}</td>
                  <td style={td}>{r.pattern ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={card}>
        <h2 style={h2}>最近任务</h2>
        <ul style={{ fontSize: "0.85rem", opacity: 0.85 }}>
          {jobs.length === 0 && <li>暂无</li>}
          {jobs.map((j) => (
            <li key={j.id}>
              {j.kind} · {j.status} · {j.trigger}
              {j.error ? ` · ${j.error}` : ""}
            </li>
          ))}
        </ul>
      </section>

      <section style={card}>
        <h2 style={h2}>运行日志</h2>
        <ul style={{ fontSize: "0.85rem", opacity: 0.85 }}>
          {logs.length === 0 && <li>暂无</li>}
          {logs.map((l) => (
            <li key={l.id}>
              [{l.level}] {l.text}
            </li>
          ))}
        </ul>
      </section>

      <nav style={{ marginTop: "2rem", display: "flex", gap: "1rem" }}>
        <a href="/settings">设置 / 账号管理</a>
      </nav>
    </main>
  );
}

const card: React.CSSProperties = {
  marginTop: "1.5rem",
  padding: "1.1rem 1.25rem",
  border: "1px solid var(--border, #8884)",
  borderRadius: 14,
};
const h2: React.CSSProperties = { fontSize: "1.05rem", marginBottom: "0.6rem" };
const th: React.CSSProperties = { textAlign: "left", padding: "0.4rem 0.5rem", opacity: 0.7, fontWeight: 500 };
const td: React.CSSProperties = { padding: "0.4rem 0.5rem", borderTop: "1px solid var(--border, #8883)" };
