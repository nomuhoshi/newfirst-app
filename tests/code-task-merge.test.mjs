// 代码题试点的纯函数部分（不需要浏览器）：构建期合并 mergeCodeTasks，以及随机练习题池对代码题 / 未知题型的处理。
// 运行：node tests/code-task-merge.test.mjs
import { readFileSync } from "node:fs";
import { mergeCodeTasks } from "../src/code-task-merge.js";
import { buildPool, clearedScope, isPracticeType, PRACTICE_TYPES } from "../src/practice.js";

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const throws = (f) => { try { f(); return null; } catch (e) { return String(e.message); } };
const course = JSON.parse(readFileSync(new URL("../content/course.json", import.meta.url)));
const UNITS = {}; for (const u of course.units) if (u.available) UNITS[u.id] = JSON.parse(readFileSync(new URL(`../content/${u.file}`, import.meta.url)));
const lessonOf = (units, id) => Object.values(units).flatMap((u) => u.lessons).find((l) => l.id === id);

// ---- 合并 ----
check("没有启用任何题：原样返回同一个对象（正式构建 = 以前的行为）", mergeCodeTasks(UNITS, []) === UNITS && mergeCodeTasks(UNITS, undefined) === UNITS);
const M = mergeCodeTasks(UNITS, ["U3L5-M1"]);
const orig = lessonOf(UNITS, "U3L5"), merged = lessonOf(M, "U3L5");
check("启用 U3L5-M1：第 4 题（replaces=4）换成改代码题，其余 3 题原样", merged.exercises.length === 4 && merged.exercises[3].id === "U3L5-M1" && merged.exercises[3].type === "modify" && [0, 1, 2].every((i) => merged.exercises[i] === orig.exercises[i]));
check("合并后的题保留 tests / reference / variation / worked / hints（判题与变化题流程要用）", ["tests", "reference", "variation", "worked", "hints", "code", "given"].every((k) => merged.exercises[3][k] !== undefined));
check("这条 pending 被移出（关卡里不再有 pending）", merged.pending === undefined);
check("不改原数据：课程 JSON 里 U3L5 的第 4 题仍是选输出、pending 仍在", orig.exercises[3].type === "predict" && Array.isArray(orig.pending) && orig.pending.length === 1);
check("其它关卡逐字相同（U3L6 的 pending 还在、exercises 同一引用）", lessonOf(M, "U3L6") === lessonOf(UNITS, "U3L6") && lessonOf(M, "U3L6").pending.length === 1);
check("其它单元未被改动（同一引用）", M.U1.lessons === undefined ? false : M.U1.lessons.every((l, i) => l === UNITS.U1.lessons[i]));
// 错误必须抛出，不静默跳过
check("找不到启用的题 → 抛错并列出 ID", /找不到要启用的代码题：NOPE-M1/.test(throws(() => mergeCodeTasks(UNITS, ["NOPE-M1"])) || ""));
const bad = (mut) => { const u = JSON.parse(JSON.stringify(UNITS)); mut(lessonOf(u, "U3L5").pending[0]); return throws(() => mergeCodeTasks(u, ["U3L5-M1"])); };
check("replaces 越界 → 抛错", /越界/.test(bad((p) => { p.replaces = 9; }) || ""));
check("replaces 不是整数 → 抛错", /越界/.test(bad((p) => { p.replaces = "4"; }) || ""));
check("题不是 modify / write → 抛错", /类型不对/.test(bad((p) => { p.task.type = "predict"; p.type = "predict"; }) || ""));
check("pending 的 type 和 task 的 type 不一致 → 抛错", /类型不对/.test(bad((p) => { p.type = "write"; }) || ""));
// 重复 ID
{ const u = JSON.parse(JSON.stringify(UNITS)); const l = lessonOf(u, "U3L5"); l.pending.push(JSON.parse(JSON.stringify(l.pending[0]))); l.pending[1].replaces = 3; check("同一个 ID 出现两次 → 抛错", /重复/.test(throws(() => mergeCodeTasks(u, ["U3L5-M1"])) || "")); }

// ---- 随机练习题池 ----
check("PRACTICE_TYPES 只有三种点选题", JSON.stringify(PRACTICE_TYPES) === JSON.stringify(["predict", "fill", "order"]) && ["modify", "write", "weird", undefined].every((t) => !isPracticeType({ type: t })) && isPracticeType({ type: "fill" }));
const done = Object.fromEntries(Object.values(UNITS).flatMap((u) => u.lessons.map((l) => [l.id, true])));
const unitsList = (units) => course.units.filter((u) => u.available).map((u) => ({ id: u.id, title: u.title, lessons: units[u.id].lessons }));
const base = buildPool(unitsList(UNITS), done, ["U3L5"]), skipped = [];
const withCode = buildPool(unitsList(M), done, ["U3L5"], (s) => skipped.push(s));
check("没启用代码题：U3L5 题池 4 题；启用后题池只剩 3 道点选题（代码题那一题被排除）", base.length === 4 && withCode.length === 3 && withCode.every((p) => isPracticeType(p.ex)) && !withCode.some((p) => p.ex.id === "U3L5-M1"));
check("被排除的代码题通过 onSkip 说明：ID、类型 modify、known=true", skipped.length === 1 && skipped[0].id === "U3L5#3" && skipped[0].type === "modify" && skipped[0].known === true, JSON.stringify(skipped));
{ const u = JSON.parse(JSON.stringify(M)); lessonOf(u, "U3L5").exercises[0] = { type: "mystery", prompt: "?" }; const sk = []; const pool = buildPool(unitsList(u), done, ["U3L5"], (s) => sk.push(s));
  check("未知题型：排除出题池，onSkip 标 known=false，不会被当成排序题", pool.length === 2 && sk.some((s) => s.type === "mystery" && s.known === false) && pool.every((p) => isPracticeType(p.ex)), JSON.stringify(sk)); }
const scope = clearedScope(unitsList(M), done); const l5 = scope.find((u) => u.id === "U3").lessons.find((l) => l.id === "U3L5");
check("练习范围页的题数不含代码题（U3L5 显示 3 题，不是 4）", l5.count === 3, String(l5.count));
{ const u = JSON.parse(JSON.stringify(M)); lessonOf(u, "U3L5").exercises = [{ ...lessonOf(M, "U3L5").exercises[3] }]; const s2 = clearedScope(unitsList(u), done); check("整关都是代码题时，这一关不出现在练习范围里", !s2.find((x) => x.id === "U3").lessons.some((l) => l.id === "U3L5")); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
