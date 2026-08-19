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

interface Data {
  status: string;
  present: { id: string; name: string; brand: string | null; link: string } | null;
  choices: PendingChoice[];
}

/** ⚠️ Next 16：useSearchParams() 必须在 Suspense 内，否则构建失败。 */
export default function ChoicePage() {
  return (
    <Suspense fallback={<main style={wrap}>载入中…</main>}>
      <ChoiceInner />
    </Suspense>
  );
}

function ChoiceInner() {
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
      setError(body.error ?? "读取失败");
      return;
    }
    setData((await res.json()) as Data);
  }, [presentId, accountId]);

  useEffect(() => {
    if (!accountId) {
      setError("链接缺少 account 参数");
      return;
    }
    void load();
  }, [accountId, load]);

  async function submit() {
    if (!data) return;
    // 每道题都必须选，否则提交上去 runner 还是会卡住
    const unanswered = data.choices.filter((c) => !selections[c.questionId]);
    if (unanswered.length > 0) {
      setError(`还有 ${unanswered.length} 道题没选`);
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
        setError(body.error ?? "提交失败");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  if (error && !data) {
    return (
      <main style={wrap}>
        <h1>选择奖品</h1>
        <p style={{ color: "crimson" }}>{error}</p>
      </main>
    );
  }
  if (!data) {
    return (
      <main style={wrap}>
        <p>读取中…</p>
      </main>
    );
  }
  if (done) {
    return (
      <main style={wrap}>
        <h1>已提交</h1>
        <p>选择已保存，稍后会自动继续投递这个奖品。</p>
        <button type="button" onClick={() => router.push("/")}>
          回首页
        </button>
      </main>
    );
  }
  if (data.status !== "needsChoice") {
    return (
      <main style={wrap}>
        <h1>无需选择</h1>
        <p>
          该奖品当前状态是 <strong>{data.status}</strong>，可能已经处理过了。
        </p>
      </main>
    );
  }

  return (
    <main style={wrap}>
      <h1>选择奖品</h1>
      {data.present && (
        <p style={{ opacity: 0.8 }}>
          {data.present.brand && <strong>{data.present.brand} · </strong>}
          {data.present.name}
        </p>
      )}

      {data.choices.map((c) => (
        <section key={c.questionId} style={{ marginTop: "1.5rem" }}>
          <p style={{ fontWeight: 600 }}>{c.prompt || "请选择"}</p>
          <div style={{ display: "grid", gap: "0.5rem" }}>
            {c.options.map((o) => {
              const picked = selections[c.questionId] === o.id;
              return (
                <label
                  key={o.id}
                  style={{
                    display: "flex",
                    gap: "0.6rem",
                    alignItems: "flex-start",
                    padding: "0.85rem 1rem",
                    border: `1px solid ${picked ? "var(--primary, #6b8afd)" : "var(--border, #8884)"}`,
                    borderRadius: 12,
                    cursor: "pointer",
                  }}
                >
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

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={busy}
        style={{ marginTop: "1.5rem", padding: "0.9rem 1.5rem", width: "100%", borderRadius: 12 }}
      >
        {busy ? "提交中…" : "提交并继续投递"}
      </button>
    </main>
  );
}

const wrap: React.CSSProperties = { maxWidth: 560, margin: "2rem auto", padding: "0 1.25rem" };
