/**
 * 规则页：问卷自动作答的关键词库（增删改查）。
 *
 * 「查」不是查列表，而是**查这条词到底命中了什么**——语料是 `survey_captures`
 * （做题时顺手采下的真实题库）。当初做问卷采集就是为了重建匹配库，这里是它的第一个用处。
 */
import { Nav } from "../nav.tsx";
import { getT } from "@/i18n/server.ts";
import { hitCounts, listRules } from "@/lib/rules.ts";
import { RulesView, type RuleView } from "./rules-view.tsx";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const t = await getT();
  const counts = hitCounts();
  const rules: RuleView[] = listRules().map((r) => ({ ...r, hitCount: counts[r.id] ?? 0 }));

  return (
    <main className="page">
      <Nav current="/rules" t={t} />
      <h1 className="page-title">{t.rules.title}</h1>
      <p className="page-sub">{t.rules.sub}</p>
      <RulesView initial={rules} />
    </main>
  );
}
