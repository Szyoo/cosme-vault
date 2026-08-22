/**
 * 问卷作答的共用实现：从页面取题（含真正的题干）+ 按 `@cosme/core` 的规则作答。
 *
 * 两套流程（is-enq / present-blog）的问卷版式不同但作答判据相同，
 * 判据放在 core 的 `decideQuestion`，DOM 相关的部分放这里。
 */
import type { Page } from "playwright";
import type { PendingChoice } from "@cosme/contract";
import { decideQuestion, selectors, type SurveyQuestion } from "@cosme/core";
import type { PatternContext } from "./types.ts";

const qBlock = selectors.PRESENT_BLOG.questionBlock;
const aBlock = selectors.PRESENT_BLOG.answerBlock;

/**
 * 从问卷页提取题目（含**真正的题干**）。
 *
 * 题干抓取的要点（实测结构 `div.qa > div.answer`）：
 * 用 `.qa` 的文本减去 `.answer` 的文本，剩下的才是题干；
 * 直接取父元素文本会把选项混进来，减完就成空串——那样 `needsManualChoice()`
 * 永远不触发，「需人工选择」的题会被词库自动答掉（已踩过）。
 */
export async function scanQuestions(page: Page): Promise<SurveyQuestion[]> {
  return page.evaluate(
    ({ qBlock, aBlock }) => {
      const out: SurveyQuestion[] = [];
      const seen = new Set<string>();

      for (const el of Array.from(
        document.querySelectorAll<HTMLInputElement>("input[type=radio],input[type=checkbox]"),
      )) {
        // 只认问卷题目字段（is-enq 的 q001_… 与 present-blog 的 id[…]）
        if (!/^q\d+_/.test(el.name) && !/^id\[\d+\]/.test(el.name)) continue;
        if (seen.has(el.name)) continue;
        seen.add(el.name);

        const group = Array.from(
          document.querySelectorAll<HTMLInputElement>(`[name="${CSS.escape(el.name)}"]`),
        );
        const options = group.map((g) => ({
          value: g.value,
          label: (g.closest("label")?.innerText ?? g.parentElement?.innerText ?? "")
            .trim()
            .replace(/\s+/g, " "),
        }));

        // 题干：优先用 .qa 减 .answer；退回到 fieldset/table 的同样做法
        let prompt = "";
        const qa = el.closest(qBlock) ?? el.closest("fieldset, table, li");
        if (qa) {
          const whole = (qa.textContent ?? "").replace(/\s+/g, " ").trim();
          const answers = Array.from(qa.querySelectorAll(aBlock))
            .map((a) => (a.textContent ?? "").replace(/\s+/g, " ").trim())
            .join(" ");
          prompt = answers ? whole.replace(answers, "").trim() : whole;
          // 没有 .answer 容器时（is-enq 的表格版式），减掉各选项文本
          if (!answers) for (const o of options) if (o.label) prompt = prompt.replace(o.label, "");
          prompt = prompt.replace(/\s+/g, " ").trim();
        }

        out.push({
          field: el.name,
          type: el.type,
          prompt: prompt.slice(0, 240),
          // 站点用「＊/*」标必填，而非 HTML required
          required: group.some((g) => g.required) || /[＊*]/.test(prompt),
          options,
        });
      }
      return out;
    },
    { qBlock, aBlock },
  );
}

/** 按共享规则作答一份问卷；返回待人工决定的题（非空则应挂起） */
export async function applyDecisions(
  page: Page,
  questions: SurveyQuestion[],
  ctx: PatternContext,
): Promise<{ pending: PendingChoice[]; applied: number }> {
  const pending: PendingChoice[] = [];
  let applied = 0;

  for (const q of questions) {
    const d = decideQuestion(q, ctx.resolvedChoices);
    if (d.action === "manual") {
      pending.push({
        questionId: q.field,
        prompt: q.prompt || q.field,
        options: q.options.map((o) => ({ id: o.value, text: o.label, imageUrl: null })),
      });
      continue;
    }
    if (d.action === "skip") continue;
    for (const v of d.values) {
      await page
        .locator(`[name="${q.field}"][value="${v}"]`)
        .first()
        .check({ timeout: 3000 })
        .catch(() => undefined);
      applied++;
    }
  }
  return { pending, applied };
}
