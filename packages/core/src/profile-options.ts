/**
 * 个人资料里「职业」的候选值 —— 必须与 @COSME 问卷 `select[name=prof_010_job1]`
 * 的选项**逐字一致**。
 *
 * 出处：v3(Draw_Cosme_Py `ProfessionEnum`) 与 v4(draw4cosme `Profession`) 两代项目
 * 里各有一份完全相同的枚举，是当年对着站点抄下来的。
 *
 * ⚠️ 为什么必须是枚举而不是自由输入（2026-08-25 事故）：用户手填「自営業」，
 * 站点选项是「自営業・自由業」，精确匹配不中 → 必填下拉留空 → 送信被弹回，
 * 该账号 81 个奖品全数失败。设置页改成下拉后，值天然对得上。
 * 代码里的包含匹配兜底仍保留，用于兜住历史数据与站点措辞微调。
 */
export const JOB_OPTIONS = [
  "会社員",
  "パート・アルバイト",
  "自営業・自由業",
  "専業主婦",
  "学生",
  "仕事はしていない",
] as const;

export type JobOption = (typeof JOB_OPTIONS)[number];

/**
 * 把历史上手填的值规整到枚举值（包含匹配，取最短候选）。
 * 匹配不上时原样返回——不猜、不丢，交由界面提示用户重选。
 */
export function normalizeJob(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if ((JOB_OPTIONS as readonly string[]).includes(v)) return v;
  const hit = JOB_OPTIONS.filter((o) => o.includes(v) || v.includes(o)).sort((a, b) => a.length - b.length)[0];
  return hit ?? v;
}
