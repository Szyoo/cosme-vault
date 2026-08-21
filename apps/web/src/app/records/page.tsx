/**
 * 记录页：历史投递明细与统计。
 *
 * 服务端组件直接查库（无需 API）。因 @COSME 不标注「已应募」，
 * 这张表就是投递历史的唯一权威来源。
 *
 * 明细同样用「两行一条」的 PresentRow（原先 8 列表格在手机上横向溢出）。
 */
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/db/index.ts";
import { getT } from "@/i18n/server.ts";
import { Nav } from "../nav.tsx";
import { PresentList } from "../present-list.tsx";
import { toItem } from "../present-item.ts";

export const dynamic = "force-dynamic";

export default async function RecordsPage() {
  const t = await getT();

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
      <Nav current="/records" t={t} />

      <h1 className="page-title">{t.records.title}</h1>
      <p className="page-sub">{t.records.sub}</p>

      <section className="stat-grid section">
        <div className="stat-card">
          <div className="stat-label">{t.stat.total}</div>
          <div className="stat-value num">{rows.length}</div>
          <div className="stat-sub">{t.stat.rows}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stat.drawn}</div>
          <div className="stat-value num">{drawn.length}</div>
          <div className="stat-sub">{t.status.drawn}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stat.failed}</div>
          <div className="stat-value num">{counts.failed ?? 0}</div>
          <div className="stat-sub">{t.stat.needsReview}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">{t.stat.accounts}</div>
          <div className="stat-value num">{accounts.length}</div>
          <div className="stat-sub">{t.stat.configured}</div>
        </div>
      </section>

      <section className="glass section">
        <div className="section-name">{t.records.detailTable}</div>
        {rows.length === 0 ? (
          <div className="empty">
            <div>📋</div>
            <p>{t.records.empty}</p>
          </div>
        ) : (
          <PresentList
            items={rows.map((r) =>
              toItem(
                {
                  ...r,
                  // 单账号时不重复显示账号名，参数行本来就挤
                  accountLabel: accounts.length > 1 ? labelOf(r.accountId) : null,
                  at: r.drawnAt ?? r.updatedAt,
                },
                t,
              ),
            )}
          />
        )}
      </section>

    </main>
  );
}
