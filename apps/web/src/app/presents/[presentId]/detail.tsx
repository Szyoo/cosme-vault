/**
 * 奖品详情的**主体**。整页（/presents/<id>）与列表上的 modal 共用同一份，
 * 免得两处渲染漂移。
 *
 * 是服务端组件：直接查库，且字典 `t` 里有函数、只能在服务端之间传。
 * 抓来的内容（奖品名、品牌、文案、数量原文如「計20名様現品」）一律原样展示，
 * 不翻译——那是数据不是界面文案。
 */
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db, schema } from "@/db/index.ts";
import { fmtDateTime } from "@/lib/when.ts";
import type { Dict } from "@/i18n/dict.ts";
import { DrawOneButton } from "./draw-one.tsx";
import { ResolveButtons } from "../../resolve-buttons.tsx";
import { GoneFix } from "../../gone-fix.tsx";
import { sourceOf, statusOf } from "../../labels.ts";

export function PresentDetailBody({ presentId, t }: { presentId: string; t: Dict }) {
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

  const src = sourceOf(present.source, t);

  return (
    <>
      <h1 className="page-title">{present.name}</h1>
      <p className="page-sub">
        {present.brand ? `${present.brand} · ` : ""}
        {src.full}
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
              style={{
                borderRadius: 12,
                objectFit: "cover",
                flex: "none",
                border: "1px solid var(--glass-border)",
              }}
            />
          ) : (
            <span
              className="thumb thumb-none"
              style={{ width: 132, height: 132, borderRadius: 12 }}
              aria-hidden
            />
          )}

          <dl className="kv" style={{ flex: 1, minWidth: 220, marginTop: 0 }}>
            <dt>{t.present.type}</dt>
            <dd>
              <span className={`pill ${src.pill}`}>{src.short}</span>
            </dd>
            <dt>{t.present.applyPeriod}</dt>
            <dd className="num">{present.period ?? t.common.none}</dd>
            <dt>{t.present.quantityForm}</dt>
            <dd>{present.quantity ?? t.common.none}</dd>
            <dt>{t.present.tagline}</dt>
            <dd>{present.tagline ?? t.common.none}</dd>
            <dt>{t.present.id}</dt>
            <dd className="mono tiny">{present.id}</dd>
            <dt>{t.present.lastScan}</dt>
            <dd className="num tiny muted">{fmtDateTime(present.scannedAt)}</dd>
          </dl>
        </div>

        <div className="actions">
          {/* 用户明确要的：能跳到 @COSME 的原页面 */}
          <a className="btn" href={present.link} target="_blank" rel="noreferrer">
            {t.present.openOriginal} ↗
          </a>
        </div>
        <p className="tiny muted" style={{ wordBreak: "break-all", marginTop: 8 }}>
          <code>{present.link}</code>
        </p>
      </section>

      <section className="glass section">
        <div className="section-name">{t.present.perAccountStatus}</div>
        {links.length === 0 ? (
          <p className="small muted">{t.present.noAccountRecord}</p>
        ) : (
          <div className="stack">
            {links.map((l) => {
              const st = statusOf(l.status, t);
              const account = accounts.find((a) => a.id === l.accountId);
              return (
                <div key={l.id} className="inner row spread">
                  <span>
                    <strong>{account?.label ?? l.accountId}</strong>
                    {l.pattern && <span className="mono tiny muted"> · {l.pattern}</span>}
                  </span>
                  <span className="row" style={{ gap: 8 }}>
                    {l.status === "needsChoice" && (
                      <Link className="btn-ghost btn-small" href={`/choices/${present.id}?account=${l.accountId}`}>
                        {t.choice.goChoose}
                      </Link>
                    )}
                    {l.status === "unknownPattern" && (
                      <a className="btn-ghost btn-small" href="/diagnostics">
                        {t.draw.seeScene}
                      </a>
                    )}
                    {l.status === "failed" && (
                      <ResolveButtons accountId={l.accountId} presentId={present.id} link={present.link} />
                    )}
                    {/* 404 开放人工改判成任何状态（可能是误判——瞬时故障/链接错/其实已投过） */}
                    {l.status === "gone" && <GoneFix accountId={l.accountId} presentId={present.id} />}
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
        {/* 用户做过的选择：把 resolvedChoices 的选项 ID 对着 pendingChoices 快照翻译成文本 */}
        {links.map((l) => {
          if (!l.resolvedChoices) return null;
          let picked: { prompt: string; text: string }[] = [];
          let refImages: string[] = [];
          try {
            const sel = JSON.parse(l.resolvedChoices) as Record<string, string>;
            const qs = l.pendingChoices
              ? (JSON.parse(l.pendingChoices) as {
                  questionId: string;
                  prompt: string;
                  options: { id: string; text: string }[];
                  referenceImages?: string[];
                }[])
              : [];
            picked = Object.entries(sel).map(([qid, oid]) => {
              const q = qs.find((x) => x.questionId === qid);
              const o = q?.options.find((x) => x.id === oid);
              return { prompt: q?.prompt ?? qid, text: o?.text ?? oid };
            });
            // 参考图跟着快照一起回看（选的时候看的什么图，历史里就摆什么图）
            refImages = qs.flatMap((q) => q.referenceImages ?? []);
          } catch {
            return null;
          }
          if (picked.length === 0) return null;
          const account = accounts.find((a) => a.id === l.accountId);
          return (
            <div key={`choice-${l.id}`} className="inner" style={{ marginTop: 10 }}>
              <div className="tiny muted">
                {t.choice.yourChoice}
                {accounts.length > 1 && account ? `（${account.label}）` : ""}
              </div>
              {picked.map((c, i) => (
                <p key={i} className="small" style={{ margin: "6px 0 0" }}>
                  {c.text}
                </p>
              ))}
              {refImages.length > 0 && (
                <div className="ref-imgs ref-imgs-compact">
                  {refImages.map((src) => (
                    // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图
                    <img key={src} className="ref-img" src={src} alt="" loading="lazy" />
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {links.some((l) => l.error) && (
          <p className="small" style={{ marginTop: 10 }}>
            {links.find((l) => l.error)?.error}
          </p>
        )}
      </section>

      {jobs.length > 0 && (
        <section className="glass section">
          <div className="section-name">{t.present.relatedJobs}</div>
          <div className="stack">
            {jobs.map((j) => (
              <div key={j.id} className="inner row spread">
                <span className="tiny">
                  {j.trigger} · {fmtDateTime(j.createdAt)}
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

    </>
  );
}
