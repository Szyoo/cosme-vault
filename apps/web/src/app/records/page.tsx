/**
 * 记录页：历史投递明细与统计。
 *
 * 服务端组件直接查库（无需 API）。因 @COSME 不标注「已应募」，
 * 这张表就是投递历史的唯一权威来源。
 */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  pending: "待投递",
  drawn: "已投递",
  needsChoice: "待选择",
  skipped: "已跳过",
  failed: "失败",
  unknownPattern: "未知模式",
};

export default function RecordsPage() {
  const rows = db
    .select({
      presentId: schema.accountPresents.presentId,
      accountId: schema.accountPresents.accountId,
      status: schema.accountPresents.status,
      pattern: schema.accountPresents.pattern,
      error: schema.accountPresents.error,
      drawnAt: schema.accountPresents.drawnAt,
      updatedAt: schema.accountPresents.updatedAt,
      name: schema.presents.name,
      brand: schema.presents.brand,
      link: schema.presents.link,
      period: schema.presents.description,
      source: schema.presents.source,
    })
    .from(schema.accountPresents)
    .leftJoin(schema.presents, eq(schema.presents.id, schema.accountPresents.presentId))
    .orderBy(desc(schema.accountPresents.updatedAt))
    .all();

  const accounts = db.select().from(schema.accounts).all();
  const labelOf = (id: string) => accounts.find((a) => a.id === id)?.label ?? id;

  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const drawn = rows.filter((r) => r.status === "drawn");

  return (
    <main style={{ maxWidth: 980, margin: "2.5rem auto", padding: "0 1.5rem" }}>
      <h1>记录</h1>

      <section style={card}>
        <h2 style={h2}>统计</h2>
        <p style={{ fontSize: "0.95rem" }}>
          共 {rows.length} 条　·　已投递 <strong>{drawn.length}</strong>
          {Object.entries(counts)
            .filter(([k]) => k !== "drawn")
            .map(([k, v]) => `　·　${STATUS_LABEL[k] ?? k} ${v}`)
            .join("")}
        </p>
        {rows.length === 0 && (
          <p style={{ opacity: 0.7, fontSize: "0.9rem" }}>
            还没有记录。回<a href="/">首页</a>点「跑一轮」。
          </p>
        )}
      </section>

      {rows.length > 0 && (
        <section style={card}>
          <h2 style={h2}>明细</h2>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
              <thead>
                <tr>
                  <th style={th}>状态</th>
                  <th style={th}>品牌</th>
                  <th style={th}>奖品</th>
                  <th style={th}>期间</th>
                  <th style={th}>账号</th>
                  <th style={th}>模式</th>
                  <th style={th}>时间</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={`${r.accountId}-${r.presentId}`}>
                    <td style={td}>
                      {STATUS_LABEL[r.status] ?? r.status}
                      {r.error && (
                        <div style={{ fontSize: "0.75rem", opacity: 0.7 }} title={r.error}>
                          {r.error.slice(0, 40)}
                        </div>
                      )}
                    </td>
                    <td style={td}>{r.brand ?? "—"}</td>
                    <td style={td}>
                      {r.link ? (
                        <a href={r.link} target="_blank" rel="noreferrer">
                          {(r.name ?? r.presentId).slice(0, 42)}
                        </a>
                      ) : (
                        (r.name ?? r.presentId).slice(0, 42)
                      )}
                    </td>
                    <td style={td}>{r.period ?? "—"}</td>
                    <td style={td}>{labelOf(r.accountId)}</td>
                    <td style={td}>{r.pattern ?? "—"}</td>
                    <td style={{ ...td, whiteSpace: "nowrap", fontSize: "0.8rem", opacity: 0.75 }}>
                      {(r.drawnAt ?? r.updatedAt)?.replace("T", " ").slice(0, 16)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <nav style={{ marginTop: "2.5rem", display: "flex", gap: "1rem" }}>
        <a href="/">← 首页</a>
        <a href="/diagnostics">诊断</a>
        <a href="/settings">设置</a>
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
const td: React.CSSProperties = { padding: "0.45rem 0.5rem", borderTop: "1px solid var(--border, #8883)", verticalAlign: "top" };
