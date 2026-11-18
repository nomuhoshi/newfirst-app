// 生成 P3 真机验收用的“进度码”：全部 43 个关卡标记为已完成（这样任何关卡都能从地图点进去重玩，不用从头通关才能走到 U6L8）。
// 只用于测试入口（p3-code）：粘贴进“我的 → 数据与备份 → 粘贴进度码”。内容固定，可重复生成：node scripts/make-p3-progress-code.mjs > docs/p3-progress-code.txt
import { readFileSync } from "node:fs";
import { encodeCode } from "../src/progress-file.js";
import { DATA_VERSION } from "../src/storage.js";
const done = {}, doneOn = {};
for (let n = 1; n <= 6; n++) for (const l of JSON.parse(readFileSync(new URL(`../content/unit${n}.json`, import.meta.url))).lessons) { done[l.id] = true; doneOn[l.id] = "2026-11-01"; }
const state = { version: DATA_VERSION, xp: 1000, lessonsCompleted: Object.keys(done).length, streak: 1, lastDay: "2026-11-01", done, doneOn };
process.stdout.write(encodeCode(state, { now: Date.parse("2026-11-18T00:00:00Z"), build: "p3-acceptance" }) + "\n");
