/**
 * 问卷作答规则的读写与「命中流水」。
 *
 * 规则出厂默认在 `@cosme/core` 的 `DEFAULT_RULES`，首次访问时播种进 `answer_rules` 表，
 * 之后以表为准（规则页可增删改），经 `RunnerConfig.rules` 下发给 runner。
 *
 * 「命中流水」拿 `survey_captures` 当语料：做题时顺手采下的真实题库（114 份问卷、
 * 3000+ 选项）。因此**不需要额外埋点、也不用再上站点**，就能回答
 * 「这条词到底命中了什么」——这正是当初做问卷采集的目的。
 */
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import type { CapturedQuestion } from "@cosme/contract";
import { DEFAULT_RULES, normalizeText, type RuleKind } from "@cosme/core";
import { db } from "@/db/index.ts";
import { answerRules, surveyCaptures } from "@/db/schema.ts";
import { nextStamp } from "./stamp.ts";

export interface RuleRow {
  id: string;
  kind: RuleKind;
  category: string;
  keyword: string;
  enabled: boolean;
  note: string | null;
  builtin: boolean;
}

/** 一条命中：某份问卷的某道题的某个选项被这条词匹配到 */
export interface RuleHit {
  presentId: string;
  prompt: string;
  label: string;
  /** 被反转标记压掉了——命中了 answer 词，但同时含 negation 词，实际不会勾 */
  suppressedBy: string | null;
}

/**
 * 播种出厂词表。
 *
 * ⚠️ 判据是「表里一条都没有」而不是逐条补齐：用户**停用或删掉**某条出厂词是
 * 正当操作，逐条补会把它又塞回来，用户删一次它长回来一次。
 */
function seedIfEmpty(): void {
  const existing = db.select({ id: answerRules.id }).from(answerRules).limit(1).all();
  if (existing.length > 0) return;
  const now = nextStamp();
  const rows = DEFAULT_RULES.map((r) => ({
    id: randomUUID(),
    kind: r.kind,
    category: r.category,
    keyword: r.keyword,
    enabled: true,
    note: null,
    builtin: true,
    createdAt: now,
  }));
  try {
    // 分批插：sqlite 单条语句的绑定参数上限是 999，一百条 × 八列已经逼近，
    // 词库以后只会变长，现在就按批走免得将来莫名其妙插不进去
    for (let i = 0; i < rows.length; i += 50) {
      db.insert(answerRules).values(rows.slice(i, i + 50)).run();
    }
  } catch {
    // 并发的两个请求同时播种时，唯一索引会让后一个抛错。
    // 播种不是关键路径，失败就让本次读到已有的部分——不该把整页 500 掉。
  }
}

export function listRules(): RuleRow[] {
  seedIfEmpty();
  return db
    .select()
    .from(answerRules)
    .all()
    .map((r) => ({
      id: r.id,
      kind: r.kind as RuleKind,
      category: r.category,
      keyword: r.keyword,
      enabled: r.enabled,
      note: r.note,
      builtin: r.builtin,
    }));
}

/** 下发给 runner 的生效规则（只发启用中的） */
export function activeRules(): { answer: string[]; manual: string[]; negation: string[] } {
  const rows = listRules().filter((r) => r.enabled);
  return {
    answer: rows.filter((r) => r.kind === "answer").map((r) => r.keyword),
    manual: rows.filter((r) => r.kind === "manual").map((r) => r.keyword),
    negation: rows.filter((r) => r.kind === "negation").map((r) => r.keyword),
  };
}

/** 采集到的题库拍平成「选项」清单，供命中统计复用（一次请求内构建一次） */
function optionCorpus(): { presentId: string; prompt: string; label: string; norm: string }[] {
  const out: { presentId: string; prompt: string; label: string; norm: string }[] = [];
  for (const cap of db
    .select({ presentId: surveyCaptures.presentId, questions: surveyCaptures.questions })
    .from(surveyCaptures)
    .all()) {
    let questions: CapturedQuestion[];
    try {
      questions = JSON.parse(cap.questions) as CapturedQuestion[];
    } catch {
      continue; // 单份坏数据不该让整页 500
    }
    for (const q of questions) {
      for (const o of q.options) {
        if (!o.label) continue;
        out.push({ presentId: cap.presentId, prompt: q.prompt, label: o.label, norm: normalizeText(o.label) });
      }
    }
  }
  return out;
}

/**
 * 每条规则命中多少选项。
 *
 * `manual` 类比的是**题干**而不是选项，语义也是 AND（全部命中才挂起），
 * 逐条统计「这一条命中几个题干」仍然有意义——能看出某条词是不是形同虚设。
 */
export function hitCounts(): Record<string, number> {
  const rules = listRules();
  const opts = optionCorpus();
  const prompts = promptCorpus();
  const counts: Record<string, number> = {};
  for (const r of rules) {
    const n = normalizeText(r.keyword);
    if (!n) {
      counts[r.id] = 0;
      continue;
    }
    counts[r.id] =
      r.kind === "manual"
        ? prompts.filter((p) => p.norm.includes(n)).length
        : opts.filter((o) => o.norm.includes(n)).length;
  }
  return counts;
}

function promptCorpus(): { presentId: string; prompt: string; norm: string }[] {
  const out: { presentId: string; prompt: string; norm: string }[] = [];
  for (const cap of db
    .select({ presentId: surveyCaptures.presentId, questions: surveyCaptures.questions })
    .from(surveyCaptures)
    .all()) {
    let questions: CapturedQuestion[];
    try {
      questions = JSON.parse(cap.questions) as CapturedQuestion[];
    } catch {
      continue;
    }
    for (const q of questions) {
      if (q.prompt) out.push({ presentId: cap.presentId, prompt: q.prompt, norm: normalizeText(q.prompt) });
    }
  }
  return out;
}

/**
 * 某条规则的命中流水（下钻用）。
 *
 * answer 类会额外标出**被反转标记压掉**的那些：命中了这条词、但选项里同时含
 * negation 词，实际并不会勾。这类是最值得看的——词表看着有效，实跑却不生效。
 */
export function ruleHits(id: string, limit = 60): { total: number; hits: RuleHit[] } {
  const rule = listRules().find((r) => r.id === id);
  if (!rule) return { total: 0, hits: [] };
  const n = normalizeText(rule.keyword);
  if (!n) return { total: 0, hits: [] };

  if (rule.kind === "manual") {
    const matched = promptCorpus().filter((p) => p.norm.includes(n));
    return {
      total: matched.length,
      hits: matched.slice(0, limit).map((p) => ({
        presentId: p.presentId,
        prompt: p.prompt,
        label: "（题干匹配）",
        suppressedBy: null,
      })),
    };
  }

  const negations = listRules()
    .filter((r) => r.kind === "negation" && r.enabled)
    .map((r) => ({ kw: r.keyword, norm: normalizeText(r.keyword) }))
    .filter((r) => r.norm);

  const matched = optionCorpus().filter((o) => o.norm.includes(n));
  return {
    total: matched.length,
    hits: matched.slice(0, limit).map((o) => ({
      presentId: o.presentId,
      prompt: o.prompt,
      label: o.label,
      // negation 规则本身不看「被谁压掉」——它就是压别人的那个
      suppressedBy:
        rule.kind === "answer" ? (negations.find((g) => o.norm.includes(g.norm))?.kw ?? null) : null,
    })),
  };
}

export function addRule(input: {
  kind: RuleKind;
  category: string;
  keyword: string;
  note?: string | null;
}): { ok: true; id: string } | { ok: false; error: string } {
  seedIfEmpty();
  const keyword = input.keyword.trim();
  if (!keyword) return { ok: false, error: "关键词不能为空" };
  const dup = db
    .select({ id: answerRules.id })
    .from(answerRules)
    .where(and(eq(answerRules.kind, input.kind), eq(answerRules.keyword, keyword)))
    .all();
  if (dup.length > 0) return { ok: false, error: "同类下已有这条词" };

  const id = randomUUID();
  db.insert(answerRules)
    .values({
      id,
      kind: input.kind,
      category: input.category.trim() || "custom",
      keyword,
      enabled: true,
      note: input.note?.trim() || null,
      builtin: false,
      createdAt: nextStamp(),
    })
    .run();
  return { ok: true, id };
}

export function updateRule(
  id: string,
  patch: { category?: string; keyword?: string; enabled?: boolean; note?: string | null },
): { ok: true } | { ok: false; error: string } {
  const rule = listRules().find((r) => r.id === id);
  if (!rule) return { ok: false, error: "规则不存在" };

  const keyword = patch.keyword?.trim();
  if (keyword !== undefined && keyword !== rule.keyword) {
    if (!keyword) return { ok: false, error: "关键词不能为空" };
    const dup = db
      .select({ id: answerRules.id })
      .from(answerRules)
      .where(and(eq(answerRules.kind, rule.kind), eq(answerRules.keyword, keyword)))
      .all();
    if (dup.length > 0) return { ok: false, error: "同类下已有这条词" };
  }

  db.update(answerRules)
    .set({
      ...(patch.category !== undefined ? { category: patch.category.trim() || "custom" } : {}),
      ...(keyword !== undefined ? { keyword } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.note !== undefined ? { note: patch.note?.trim() || null } : {}),
    })
    .where(eq(answerRules.id, id))
    .run();
  return { ok: true };
}

/**
 * 删除一条规则。
 *
 * ⚠️ **出厂词只许停用，不许删**：每一条都是 2023 年实跑调教出来的，
 * 删掉哪条会漏答哪类题事先无从判断，而且删了就没有复原依据了。
 * 停用同样能达到「不生效」的目的，且随时可以开回来。
 */
export function deleteRule(id: string): { ok: true } | { ok: false; error: string } {
  const rule = listRules().find((r) => r.id === id);
  if (!rule) return { ok: false, error: "规则不存在" };
  if (rule.builtin) return { ok: false, error: "出厂词只能停用，不能删除" };
  db.delete(answerRules).where(eq(answerRules.id, id)).run();
  return { ok: true };
}
