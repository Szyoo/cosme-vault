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

/** ⚠️ Next 16：useSearchParams() 必须在 Suspense 内，否则构建失败。 */
export default function ChoicePage() {
  return (
    <Suspense fallback={<main className="page">…</main>}>
      <ChoiceInner />
    </Suspense>
  );
}

function ChoiceInner() {
  const t = useT();
  const params = useParams<{ presentId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const accountId = search.get("account") ?? "";
  const presentId = params.presentId;

  const [data, setData] = useState<Data | null>(null);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

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
      setDone(true);
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
  if (done) {
    return (
      <main className="page narrow">
      <BackRow t={t} />
        <h1 className="page-title">{t.choice.submitted}</h1>
        <p>{t.choice.submittedHint}</p>
        <button type="button" className="btn" onClick={() => router.push("/")}>
          {t.nav.console}
        </button>
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
        </p>
      )}

      {data.choices.map((c) => (
        <section key={c.questionId} className="glass section">
          <div className="section-name">{c.prompt || t.choice.pick}</div>
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
                  <span>{o.text}</span>
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

