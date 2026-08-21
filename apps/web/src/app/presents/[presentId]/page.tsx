/**
 * 奖品详情页：把库里关于这个奖品的全部信息摊开，并给出 @COSME 原页面的链接。
 *
 * ⚠️ Next 16：动态段 `params` 必须 await。
 */
import { and, desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/index.ts";
import { Nav } from "../../nav.tsx";
import { DrawOneButton } from "./draw-one.tsx";
import { sourceOf, statusOf } from "../../labels.ts";

export const dynamic = "force-dynamic";



export default async function PresentDetail({ params }: { params: Promise<{ presentId: string }> }) {
  const { presentId } = await params;

  const present = db.select().from(schema.presents).where(eq(schema.presents.id, presentId)).get();
  if (!present) notFound();

  const accounts = db.select().from(schema.accounts).all();
  const links = db
    .select()
    .from(schema.accountPresents)
    .where(eq(schema.accountPresents.presentId, presentId))
    .all();

  // 与这个奖品相关的任务（用于看历史与失败原因）
  const jobs = db
    .select()
    .from(schema.jobs)
    .where(eq(schema.jobs.kind, "draw"))
    .orderBy(desc(schema.jobs.createdAt))
    .limit(60)
    .all()
    .filter((j) => {
      try {
        return (JSON.parse(j.payload) as { presentId?: string }).presentId === presentId;
      } catch {
        return false;
      }
    })
    .slice(0, 6);

  return (
    <main className="page">
      {/* 返回入口放在**顶部**：底部导航在手机上要滚过整页才看得到，等于退不出去 */}
      <nav className="back-row">
        <a className="chip" href="/">
          ← 控制台
        </a>
        <a className="chip" href="/records">
          记录
        </a>
      </nav>
      <h1 className="page-title">{present.name}</h1>
      <p className="page-sub">
        {present.brand ? `${present.brand} · ` : ""}
        {sourceOf(present.source).full}
      </p>

      <section className="glass section">
        <div className="row" style={{ alignItems: "flex-start", gap: 18 }}>
          {present.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图，不走 next/image
            <img
              src={present.imageUrl}
              alt={present.name}
              width={132}
              height={132}
              style={{ borderRadius: 12, objectFit: "cover", flex: "none", border: "1px solid var(--glass-border)" }}
            />
          ) : (
            <span className="thumb thumb-none" style={{ width: 132, height: 132, borderRadius: 12 }} aria-hidden />
          )}

          <dl className="kv" style={{ flex: 1, minWidth: 220, marginTop: 0 }}>
            <dt>类型</dt>
            <dd>
              <span className={`pill ${sourceOf(present.source).pill}`}>{sourceOf(present.source).short}</span>
            </dd>
            <dt>应募期间</dt>
            <dd className="num">{present.period ?? "—"}</dd>
            <dt>数量 / 形式</dt>
            <dd>{present.quantity ?? "—"}</dd>
            <dt>文案</dt>
            <dd>{present.tagline ?? "—"}</dd>
            <dt>奖品 ID</dt>
            <dd className="mono tiny">{present.id}</dd>
            <dt>最近扫描</dt>
            <dd className="num tiny muted">{present.scannedAt?.replace("T", " ").slice(0, 16)}</dd>
          </dl>
        </div>

        <div className="actions">
          {/* 用户明确要的：能跳到 @COSME 的原页面 */}
          <a className="btn" href={present.link} target="_blank" rel="noreferrer">
            打开 @COSME 原页面 ↗
          </a>
        </div>
        <p className="tiny muted" style={{ wordBreak: "break-all", marginTop: 8 }}>
          <code>{present.link}</code>
        </p>
      </section>

      <section className="glass section">
        <div className="section-name">各账号的投递状态</div>
        {links.length === 0 ? (
          <p className="small muted">还没有任何账号的记录。</p>
        ) : (
          <div className="stack">
            {links.map((l) => {
              const st = statusOf(l.status);
              const account = accounts.find((a) => a.id === l.accountId);
              return (
                <div key={l.id} className="inner row spread">
                  <span>
                    <strong>{account?.label ?? l.accountId}</strong>
                    {l.pattern && <span className="mono tiny muted"> · {l.pattern}</span>}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    {l.status === "needsChoice" && (
                      <a className="btn-ghost btn-small" href={`/choices/${present.id}?account=${l.accountId}`}>
                        去选择
                      </a>
                    )}
                    {l.status === "unknownPattern" && (
                      <a className="btn-ghost btn-small" href="/diagnostics">
                        看现场
                      </a>
                    )}
                    {l.status === "pending" && (
                      <DrawOneButton accountId={l.accountId} presentId={present.id} presentLink={present.link} />
                    )}
                    <span className={`pill ${st.pill}`}>{st.label}</span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
        {links.some((l) => l.error) && (
          <p className="small" style={{ marginTop: 10 }}>
            {links.find((l) => l.error)?.error}
          </p>
        )}
      </section>

      {jobs.length > 0 && (
        <section className="glass section">
          <div className="section-name">相关任务</div>
          <div className="stack">
            {jobs.map((j) => (
              <div key={j.id} className="inner row spread">
                <span className="tiny">
                  {j.trigger} · {j.createdAt?.replace("T", " ").slice(0, 16)}
                </span>
                <span className="tiny">
                  {j.status}
                  {j.error ? ` · ${j.error.slice(0, 40)}` : ""}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      <Nav />
    </main>
  );
}
