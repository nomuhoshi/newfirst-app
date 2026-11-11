// 进度合并（旧标签页不能覆盖新进度）与读取失败保护的单元测试。node tests/storage-merge.test.mjs
const mem = {}; let failRead = false;
globalThis.localStorage = {
  getItem: (k) => { if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; },
  key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, clearState, freshState } = await import("../src/storage.js");
let fail = 0; const ok = (n, c) => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n); };
const stored = () => JSON.parse(mem["suipian.progress"]);
// 旧标签页内存里是旧进度；另一个标签页已经通关 U1L1、U1L2
const oldTab = freshState(); oldTab.onboarded = true; oldTab.done = { U1L1: true }; oldTab.xp = 60; saveState(oldTab);
const newTab = loadState().state; newTab.done = { U1L1: true, U1L2: true }; newTab.xp = 120; newTab.lessonsCompleted = 2; newTab.streak = 2; newTab.lastDay = "2026-11-12"; saveState(newTab);
oldTab.hearts = 3; saveState(oldTab); // 旧标签页回到前台后整份写回
ok("旧标签页写回后，存储里仍有 U1L2", stored().done.U1L2 === true);
ok("XP 取较大值 120", stored().xp === 120);
ok("旧标签页的内存记录也被更新", oldTab.done.U1L2 === true && oldTab.xp === 120 && oldTab.streak === 2);
ok("红心沿用本标签页（3）", stored().hearts === 3);
// 清除学习记录：不合并旧记录
let st = clearState(); ok("清除后存储为空", !("suipian.progress" in mem));
saveState(st, { replace: true }); ok("清除后保存不把旧进度带回", Object.keys(stored().done).length === 0 && stored().xp === 0);
// 读取失败：loadState 标记 readFailed
failRead = true; const r = loadState(); ok("读取失败标记 readFailed", r.readFailed === true); failRead = false;
// 读不懂的记录不参与合并
mem["suipian.progress"] = "{坏的"; const s2 = freshState(); s2.xp = 5; saveState(s2); ok("坏记录被新记录覆盖且不抛错", stored().xp === 5);
process.exit(fail ? 1 : 0);
