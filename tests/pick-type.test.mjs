// 读报错选择题（pick）的数据与打乱规则：每题恰好一个正确选项；打乱后正确标记跟着选项走；带 trace 的题必须有 traceProgram 或 code。
import { readFileSync } from "node:fs";
import { shuffleExercise } from "../src/practice.js";
const unit = JSON.parse(readFileSync(new URL("../content/unit6.json", import.meta.url)));
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const picks = [...unit.lessons, ...(unit.heldLessons || [])].flatMap((l) => l.exercises.map((e, i) => ({ id: `${l.id}-Q${i + 1}`, e }))).filter((x) => x.e.type === "pick");
check("U6L6 四道基础题已开放（在 lessons 里），U6L6-M1 代码题仍待开放（pending）", (() => { const l = unit.lessons.find((x) => x.id === "U6L6"); return !!l && l.exercises.length === 4 && l.pending?.[0]?.task?.id === "U6L6-M1" && !(unit.heldLessons || []).some((h) => h.id === "U6L6"); })());
check("U6 有读报错选择题", picks.length >= 6, String(picks.length));
for (const { id, e } of picks) {
  check(`${id}：恰好一个正确选项，每个选项都有解释`, e.options.filter((o) => o.correct).length === 1 && e.options.every((o) => o.why && o.text));
  const right = e.options.find((o) => o.correct).text;
  let ok = true;
  for (let k = 0; k < 20; k++) { let r = 0.1 + k * 0.045; const s = shuffleExercise(e, () => (r = (r * 9301 + 49297) % 233280 / 233280)); ok = ok && s.options.length === e.options.length && s.options.filter((o) => o.correct).length === 1 && s.options.find((o) => o.correct).text === right && s.type === "pick"; }
  check(`${id}：打乱选项后正确标记跟着选项走`, ok);
  if (e.trace) check(`${id}：报错文字非空，且有程序可核对`, e.trace.length > 10 && (e.code || e.checks?.length));
}
for (const l of unit.lessons) for (const [i, e] of l.exercises.entries()) if (e.type !== "pick" && e.trace) check(`${l.id}-Q${i + 1}：带报错的${e.type}题有 traceProgram`, !!e.traceProgram);
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
