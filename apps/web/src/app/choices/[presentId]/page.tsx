/**
 * 奖品选择页 —— Bark 推送的深链接落点。
 *
 * 场景：runner 遇到「ご希望の…お選びください」这类必须人工决定的题目时挂起，
 * 手机收到推送点进来，选完提交，runner 会带着选择重跑该奖品并完成投递。
 *
 * 手机优先：单列、大点击区域。
 */
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import type { PendingChoice } from "@cosme/contract";
import { useT } from "@/i18n/context.tsx";
import { useInModal } from "../../modal-shell.tsx";
import type { Dict } from "@/i18n/dict.ts";

/** 顶部返回条。选择页有多个状态分支，各自都要有出口，故抽成组件。 */
function BackRow({ t }: { t: Dict }) {
  return (
    <nav className="back-row">
      <a className="chip" href="/">
        ← {t.nav.console}
      </a>
    </nav>
  );
}

interface Data {
  status: string;
  present: { id: string; name: string; brand: string | null; link: string } | null;
  choices: PendingChoice[];
}

/**
 * 参考图纠错器：启发式选的图有时不对或缺失（实测反馈），
 * 展开候选池（PR 页全部内容图）让用户点选，保存即替换快照里的参考图。
 */
function ImageFixer({
  presentId,
  accountId,
  current,
  candidates,
  onSaved,
}: {
  presentId: string;
  accountId: string;
  current: string[];
  candidates: string[];
  onSaved: () => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set(current));
  const [busy, setBusy] = useState(false);

  if (candidates.length === 0) return null;

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/choices/${presentId}/images`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, images: [...sel] }),
      });
      if (res.ok) {
        setOpen(false);
        onSaved();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="img-fixer">
      <button type="button" className="btn-ghost btn-small" onClick={() => setOpen((v) => !v)}>
        {open ? t.choice.fixImagesClose : t.choice.fixImages}
      </button>
      {open && (
        <>
          <p className="tiny muted">{t.choice.fixImagesHint}</p>
          <div className="cand-grid">
            {candidates.map((src) => {
              const picked = sel.has(src);
              return (
                <button
                  key={src}
                  type="button"
                  className={`cand-thumb${picked ? " picked" : ""}`}
                  onClick={() =>
                    setSel((s0) => {
                      const n = new Set(s0);
                      if (n.has(src)) n.delete(src);
                      else if (n.size < 8) n.add(src);
                      return n;
                    })
                  }
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图 */}
                  <img src={src} alt="" loading="lazy" />
                </button>
              );
            })}
          </div>
          <button type="button" className="btn btn-small" onClick={() => void save()} disabled={busy}>
            {busy ? t.choice.fixImagesSaving : t.choice.fixImagesSave(sel.size)}
          </button>
        </>
      )}
    </div>
  );
}

/** ⚠️ Next 16：useSearchParams() 必须在 Suspense 内，否则构建失败。 */
export default function ChoicePage() {
  return (
    <Suspense fallback={<main className="page">…</main>}>
      <ChoiceInner />
    </Suspense>
  );
}

export function ChoiceInner() {
  const t = useT();
  const inModal = useInModal();
  const params = useParams<{ presentId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const accountId = search.get("account") ?? "";
  const presentId = params.presentId;

  const [data, setData] = useState<Data | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/choices/${presentId}?account=${encodeURIComponent(accountId)}`);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? t.choice.loadFailed);
      return;
    }
    setData((await res.json()) as Data);
  }, [presentId, accountId, t]);

  useEffect(() => {
    if (!accountId) {
      setError(t.choice.missingAccount);
      return;
    }
    void load();
  }, [accountId, load, t]);

  async function submit() {
    if (!data) return;
    // 每道题都必须选，否则提交上去 runner 还是会卡住
    const unanswered = data.choices.filter((c) => !selections[c.questionId]);
    if (unanswered.length > 0) {
      setError(t.choice.unanswered(unanswered.length));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/choices/${presentId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accountId, selections }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? t.choice.submitFailed);
        return;
      }
      // 提交成功不弹「已提交」确认屏（用户嫌多余）：modal 直接关、
      // 整页（手机 Bark 深链接）跳回控制台——队列里能实时看到重投在跑
      if (inModal) router.back();
      else router.push("/");
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main className="page narrow">
      <BackRow t={t} />
        <h1 className="page-title">{t.choice.title}</h1>
        <p className="err-text">{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main className="page narrow">
      <BackRow t={t} />
        <p>{t.common.loading}</p>
      </main>
    );
  }
  if (data.status !== "needsChoice") {
    return (
      <main className="page narrow">
      <BackRow t={t} />
        <h1 className="page-title">{t.choice.noNeed}</h1>
        <p>{t.choice.noNeedHint(data.status)}</p>
      </main>
    );
  }

  return (
    <main className="page narrow">
      <BackRow t={t} />
      <h1 className="page-title">{t.choice.title}</h1>
      {data.present && (
        <p className="page-sub">
          {data.present.brand && <strong>{data.present.brand} · </strong>}
          {data.present.name}
          {"　"}
          <a href={data.present.link} target="_blank" rel="noreferrer">
            {t.resolve.openSite} ↗
          </a>
        </p>
      )}

      {data.choices.map((c) => (
        <section key={c.questionId} className="glass section">
          <div className="section-name">{c.prompt || t.choice.pick}</div>
          {/* 奖品参考图：整组原样展示，不与选项一一对应（PR 页多为合成图，
              图内自带「or」等说明；对应关系让用户自己看图判断） */}
          {c.referenceImages?.length > 0 && (
            <div className="ref-imgs">
              {c.referenceImages.map((src) => (
                // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图
                <img key={src} className="ref-img" src={src} alt="" loading="lazy" />
              ))}
              <p className="tiny muted">{t.choice.refImagesHint}</p>
            </div>
          )}
          {/* 图不对/缺图的自助纠错：从候选池点选替换（纯数据修正，不触发投递） */}
          <ImageFixer
            presentId={presentId}
            accountId={accountId}
            current={c.referenceImages ?? []}
            candidates={c.candidateImages ?? []}
            onSaved={() => void load()}
          />
          <div className="stack">
            {c.options.map((o) => {
              const picked = selections[c.questionId] === o.id;
              return (
                <label key={o.id} className={`opt${picked ? " picked" : ""}`}>
                  <input
                    type="radio"
                    name={c.questionId}
                    value={o.id}
                    checked={picked}
                    onChange={() => setSelections((s) => ({ ...s, [c.questionId]: o.id }))}
                  />
                  <span className="opt-body">
                    {/* 选项配图：只有 PR 页的 present_img 模板与选项数目对上时才有，
                        宁可没图也不挂错图（见 ChoiceOption.imageUrl） */}
                    {o.imageUrl && (
                      // eslint-disable-next-line @next/next/no-img-element -- 外站 CDN 图
                      <img className="opt-img" src={o.imageUrl} alt="" loading="lazy" />
                    )}
                    <span>{o.text}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </section>
      ))}

      {error && <p className="err-text">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        className="btn"
        style={{ width: "100%", marginTop: 18 }}
      >
        {busy ? t.choice.submitting : t.choice.submit}
      </button>
    </main>
  );
}

