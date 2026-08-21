/**
 * 记录页：历史投递明细与统计。
 *
 * 服务端组件直接查库（无需 API）。因 @COSME 不标注「已应募」，
 * 这张表就是投递历史的唯一权威来源。
 */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { Nav } from "../nav.tsx";

export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; pill: string }> = {
  pending: { label: "待投递", pill: "" },
  drawn: { label: "已投递", pill: "green" },
  needsChoice: { label: "待选择", pill: "violet" },
  skipped: { label: "已跳过", pill: "" },
  failed: { label: "失败", pill: "red" },
  unknownPattern: { label: "未知模式", pill: "amber" },
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
      imageUrl: schema.presents.imageUrl,
      link: schema.presents.link,
      period: schema.presents.period,
      quantity: schema.presents.quantity,
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
    <main className="page">
      <h1 className="page-title">记录</h1>
      <p className="page-sub">投递历史。@COSME 不标注「已应募」，这张表是唯一权威来源。</p>

      <section className="stat-grid section">
        <div className="stat-card">
          <div className="stat-label">总计</div>
          <div className="stat-value num">{rows.length}</div>
          <div className="stat-sub">条记录</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">已投递</div>
          <div className="stat-value num">{drawn.length}</div>
          <div className="stat-sub">成功</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">失败</div>
          <div className="stat-value num">{counts.failed ?? 0}</div>
          <div className="stat-sub">需人工确认</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">账号</div>
          <div className="stat-value num">{accounts.length}</div>
          <div className="stat-sub">已配置</div>
        </div>
      </section>

      <section className="glass section">
        <div className="section-name">明细</div>
        {rows.length === 0 ? (
          <div className="empty">
            <div>📋</div>
            <p>
              还没有记录。回<a href="/">控制台</a>点「跑一轮」。
            </p>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th>状态</th>
                  <th>品牌</th>
                  <th>奖品</th>
                  <th>期间</th>
                  <th>账号</th>
                  <th>模式</th>
                  <th>时间</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATUS[r.status] ?? { label: r.status, pill: "" };
                  return (
                    <tr key={`${r.accountId}-${r.presentId}`}>
                      <td>
                        <span className={`pill ${st.pill}`}>{st.label}</span>
                        {r.error && <div className="tiny muted">{r.error.slice(0, 36)}</div>}
                      </td>
                      <td>{r.brand ?? "—"}</td>
                      <td className="clip" title={r.name ?? r.presentId}>
                        <span className="pz">
                          {r.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img className="thumb" src={r.imageUrl} alt="" loading="lazy" width={40} height={40} />
                          ) : (
                            <span className="thumb thumb-none" aria-hidden />
                          )}
                        {r.link ? (
                          <a href={r.link} target="_blank" rel="noreferrer">
                            {r.name ?? r.presentId}
                          </a>
                        ) : (
                          (r.name ?? r.presentId)
                        )}
                        </span>
                      </td>
                      <td className="num tiny">{r.period ?? "—"}</td>
                      <td className="tiny">{labelOf(r.accountId)}</td>
                      <td className="mono tiny">{r.pattern ?? "—"}</td>
                      <td className="num tiny muted">{(r.drawnAt ?? r.updatedAt)?.replace("T", " ").slice(0, 16)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Nav current="/records" />
    </main>
  );
}
