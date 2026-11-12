// 方案 B「无变化不新增账本」：没有未保存变化时 saveState 不写任何键；有变化正常保存；失败后仍待保存。纯 node，假 localStorage。
const mem = {}; let failWrite = false, writes = 0;
globalThis.localStorage = {
  getItem: (k) => (k in mem ? mem[k] : null),
  setItem: (k, v) => { if (failWrite) throw new Error("quota"); writes++; mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, mergeStored, addXp, addRun, freshState, clearState, regenHearts, loseHeart, _asTab, readSnapshot } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; failWrite = false; writes = 0; };
const tabKeys = () => Object.keys(mem).filter((k) => k.includes(".tab."));
let n = 0; const page = () => _asTab(loadState().state, "p" + ++n);
const finish = (s, id, xp = 60) => { addXp(s, xp, id, true); s.done[id] = true; addRun(s); s.lastDay = "2026-11-12"; s.streak = Math.max(1, s.streak); s.doneOn = { ...s.doneOn, [id]: "2026-11-12" }; };
const tick = () => { const t = Date.now(); while (Date.now() === t); }; // meta 以毫秒时间戳分先后，测试里让两次写入不落在同一毫秒
const seen = () => { const s = loadState().state; return { xp: s.xp, runs: s.lessonsCompleted, done: Object.keys(s.done).sort().join(","), hearts: s.hearts, sound: s.prefs.sound, soundStyle: s.prefs.soundStyle }; };

// 1 反复无操作打开：不增账本、不写任何键
{ reset(); const A = page(); finish(A, "U1L1"); ok("1 首次学习保存成功", saveState(A) === true);
  const k0 = tabKeys().length, w0 = writes;
  for (let i = 0; i < 20; i++) { const P = page(); regenHearts(P); mergeStored(P); if (!saveState(P)) ok("1 无变化保存应返回 true", false); }
  ok("1 20 次无操作打开：账本键数不变", tabKeys().length === k0, tabKeys().length + " vs " + k0);
  ok("1 20 次无操作打开：没有任何写入", writes === w0, writes + " vs " + w0);
  ok("1 进度不变", seen().xp === 60 && seen().done === "U1L1"); }

// 2 只有自动时间变化（满红心 heartsAt、lastActive）不算变化
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  const P = page(); const w0 = writes; P.heartsAt += 12345; P.lastActive += 99; saveState(P);
  ok("2 满红心时 heartsAt / lastActive 变动不触发写入", writes === w0); }

// 3 真实变化正常保存：关卡 / 红心 / 偏好 / 开场 / 安装提示
{ reset(); const A = page(); A.onboarded = true; ok("3 开场标记保存", saveState(A) && tabKeys().length === 1);
  const w1 = writes; A.prefs.sound = false; saveState(A); ok("3 偏好修改会写入", writes > w1 && seen().sound === false);
  const w2 = writes; loseHeart(A); saveState(A); ok("3 失去红心会写入", writes > w2 && seen().hearts === 4);
  const w3 = writes; A.heartsAt -= 31 * 60 * 1000; regenHearts(A); saveState(A); ok("3 红心恢复会写入", writes > w3 && seen().hearts === 5, JSON.stringify(seen()));
  const w4 = writes; finish(A, "U1L1"); saveState(A); ok("3 完成关卡会写入", writes > w4 && seen().done === "U1L1" && seen().xp === 60);
  const w5 = writes; A.installTipClosed = true; saveState(A); ok("3 安装提示关闭会写入", writes > w5 && loadState().state.installTipClosed === true);
  const w6 = writes; A.soundStyle = "x"; A.prefs.soundStyle = "B"; saveState(A); ok("3 音效风格会写入", writes > w6 && seen().soundStyle === "B"); }

// 4 复习（只加 XP / 次数，不新增关卡）也写入
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A); const w = writes; addXp(A, 10, "U1L1", false); addRun(A); saveState(A);
  ok("4 复习 XP 与次数保存", writes > w && seen().xp === 70 && seen().runs === 2, JSON.stringify(seen())); }

// 5 失败后仍待保存，恢复后补存；失败不记成已保存
{ reset(); const A = page(); finish(A, "U1L1"); failWrite = true; ok("5 写入失败返回 false", saveState(A) === false);
  ok("5 再试仍返回 false（没被当成已保存）", saveState(A) === false);
  failWrite = false; ok("5 恢复后保存成功", saveState(A) === true && seen().xp === 60 && seen().done === "U1L1");
  const w = writes; saveState(A); ok("5 保存成功后无变化不再写", writes === w);
  // 红心 / 偏好的失败同样保持待保存
  A.prefs.sound = false; failWrite = true; ok("5 偏好写入失败 false", saveState(A) === false); failWrite = false;
  ok("5 偏好重试补存", saveState(A) === true && seen().sound === false); }

// 6 导入式直接改总数（XP、关卡、doneOn）仍保存
{ reset(); const A = page(); saveState(A); A.onboarded = true; saveState(A);
  A.xp += 100; A.lessonsCompleted += 2; A.done.U1L1 = true; A.doneOn = { U1L1: "2026-01-01" }; A.lastDay = "2026-11-01"; A.streak = 3;
  ok("6 导入后保存", saveState(A) === true);
  const s = loadState().state; ok("6 XP / 次数 / 关卡 / 日期都在", s.xp === 100 && s.lessonsCompleted === 2 && s.done.U1L1 && s.doneOn.U1L1 === "2026-01-01" && s.lastDay === "2026-11-01" && s.streak === 3, JSON.stringify([s.xp, s.lessonsCompleted, s.doneOn, s.lastDay])); }

// 7 双标签：旧页面无变化不盖新页面；另一页的红心变化后旧页采用，不回写旧值
{ reset(); const A = page(), B = page(); finish(A, "U1L1"); saveState(A);
  mergeStored(B); const w = writes; saveState(B); ok("7 B 合并后无变化不写", writes === w);
  tick(); loseHeart(B); saveState(B); ok("7 B 红心变化写入", seen().hearts === 4);
  const w2 = writes; mergeStored(A); saveState(A); ok("7 A 采用 B 的红心且不回写", A.hearts === 4 && writes === w2 && seen().hearts === 4, A.hearts + " " + (writes - w2));
  finish(B, "U1L2"); saveState(B); mergeStored(A); ok("7 A 看到 B 的新关卡", !!A.done.U1L2 && A.xp === 120); }

// 8 清除后：旧页无变化不复活；旧页有变化时按新一代保存
{ reset(); const A = page(), B = page(); finish(A, "U1L1"); saveState(A); mergeStored(B);
  const f = clearState(); ok("8 清除成功", !f.clearFailed);
  const w = writes; ok("8 旧页无变化保存返回 true 且不写", saveState(B) === true && writes === w);
  ok("8 清除后进度仍为空", seen().xp === 0 && seen().done === "");
  ok("8 旧页再保存没有复活旧键", tabKeys().every((k) => { const r = JSON.parse(mem[k]); return r.epoch === JSON.parse(mem["suipian.v4.epoch"] ? JSON.stringify({ epoch: mem["suipian.v4.epoch"] }) : "{}").epoch; }) || tabKeys().length === 0, tabKeys().join(",")); }

// 9 读取快照（备份）完整
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A); const r = readSnapshot(A); ok("9 快照完整", r.ok && r.snap.xp === 60 && r.snap.done.U1L1 && r.snap.doneOn.U1L1 === "2026-11-12"); }

// 10 升级用户（旧 v3 记录）：只启动、回前台不新建账本；真实学习后才建
{ reset(); mem["suipian.progress"] = JSON.stringify({ version: 3, onboarded: true, xp: 40, hearts: 5, heartsAt: 1, streak: 1, lastDay: "2026-11-10", done: { U1L1: true }, doneOn: {}, lessonsCompleted: 1, installTipClosed: false, lastActive: 5, prefs: { sound: true, haptics: true, soundStyle: "J" } });
  const A = page(); const k0 = tabKeys().length; regenHearts(A); saveState(A);
  ok("10 旧记录升级后仅打开不建账本", tabKeys().length === k0 && seen().xp === 40 && seen().done === "U1L1", tabKeys().length + "/" + k0);
  finish(A, "U1L2"); saveState(A); ok("10 学习后建立账本且保留旧进度", tabKeys().length === k0 + 1 && seen().xp === 100 && seen().done === "U1L1,U1L2", JSON.stringify(seen())); }

console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
