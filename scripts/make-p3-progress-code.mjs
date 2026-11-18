// 生成 P3 真机验收用的“进度码”（只用于测试入口 p3-code）。
// 为什么要分关：地图上只有“第一个没完成的关”是可首次作答的；已完成的关再点进去是“复习”（答错不扣红心，XP 也少）。
// 所以每个进度码 = 43 关里“只留下要测的那一两关没完成”，其余全部完成：
//   A：U3L5、U3L6 没完成（P3-02/03/06：键盘、普通答错扣心、变式流程）
//   B：U4L6 没完成（P3-04：死循环超时，不扣红心）
//   C：U5L2 没完成（P3-05：IndexError 报错）
//   D：U5L5 没完成（P3-07：没有变式题）
// 用法：先“我的 → 数据与备份 → 清除学习记录”（只清测试入口自己的记录），再粘贴对应的进度码。
// 重新生成：node scripts/make-p3-progress-code.mjs > docs/p3-progress-codes.txt
import { readFileSync } from "node:fs";
import { encodeCode } from "../src/progress-file.js";
import { DATA_VERSION } from "../src/storage.js";
const ids = [];
for (let n = 1; n <= 6; n++) for (const l of JSON.parse(readFileSync(new URL(`../content/unit${n}.json`, import.meta.url))).lessons) ids.push(l.id);
export const SETS = { A: ["U3L5", "U3L6"], B: ["U4L6"], C: ["U5L2"], D: ["U5L5"] };
const out = [];
for (const [k, undone] of Object.entries(SETS)) {
  const done = {}, doneOn = {};
  for (const id of ids) if (!undone.includes(id)) { done[id] = true; doneOn[id] = "2026-11-01"; }
  const state = { version: DATA_VERSION, xp: 1000, lessonsCompleted: Object.keys(done).length, streak: 1, lastDay: "2026-11-01", done, doneOn };
  out.push(`## 进度码 ${k}（${undone.join("、")} 没完成，其余 ${Object.keys(done).length} 关已完成）\n${encodeCode(state, { now: Date.parse("2026-11-18T00:00:00Z"), build: "p3-acceptance-" + k })}\n`);
}
process.stdout.write(out.join("\n"));
