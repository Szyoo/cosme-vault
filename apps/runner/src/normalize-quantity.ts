/**
 * 一次性数据整理：把 presents.quantity 折成 `計N名様[・形式]`。
 *
 * 站点写法有 28 种（`20名` / `10名様` / `計20名様現品` / `現品200名様` …），
 * 界面上并排显示时看着像三套不同的字段。规则见 @cosme/core 的 normalizeQuantity。
 *
 *   npm run fix:quantity            只报告差异，不改库
 *   npm run fix:quantity -- --write 写回数据库
 */
import Database from "better-sqlite3";
import { isNormalizedQuantity, normalizeQuantity } from "@cosme/core";

const WRITE = process.argv.includes("--write");
const db = new Database(process.env.AUDIT_DB ?? "../web/data/cosme.db");

const rows = db.prepare("select id, quantity from presents").all() as { id: string; quantity: string | null }[];
const update = db.prepare("update presents set quantity = ? where id = ?");

let changed = 0;
let already = 0;
let empty = 0;
const samples: string[] = [];

for (const r of rows) {
  if (!r.quantity) {
    empty++;
    continue;
  }
  const next = normalizeQuantity(r.quantity);
  if (next === r.quantity) {
    already++;
    continue;
  }
  changed++;
  if (samples.length < 40) samples.push(`${r.id.padEnd(12)} ${String(r.quantity).padEnd(18)} → ${next}`);
  if (WRITE) update.run(next, r.id);
}

console.log(samples.join("\n"));
console.log(
  `\n[quantity] 共 ${rows.length} 行：需改 ${changed}，已合规 ${already}，为空 ${empty}` +
    (WRITE ? "（已写回）" : "（干跑，未写库；加 --write 才落盘）"),
);

// 落盘后自查一遍，确认没有漏网的
if (WRITE) {
  const bad = (db.prepare("select id, quantity from presents").all() as typeof rows).filter(
    (r) => !isNormalizedQuantity(r.quantity),
  );
  console.log(`[quantity] 写回后仍不合规：${bad.length}` + (bad.length ? ` → ${bad.map((b) => `${b.id}:${b.quantity}`).join(", ")}` : ""));
}
db.close();
