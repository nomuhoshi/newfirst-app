// 多标签页进度合并 / 清除 / 读写异常 的单元测试（模拟两个标签页 = 两个 loadState() 出来的内存记录，共用一份存储）。node tests/storage-merge.test.mjs
const mem = {}; let failRead = false, failWrite = false;
globalThis.localStorage = {
  getItem: (k) => { if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (failWrite) throw new Error("quota"); mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; },
  key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, mergeStored, clearState, freshState, getLastSavedAt } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const stored = () => JSON.parse(mem["suipian.progress"]);
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; };
// 模拟答题：和 app 一致，完成一关加 XP / 次数后保存
const finish = (s, id, xp = 60) => { s.done[id] = true; s.xp += xp; s.lessonsCompleted += 1; s.lastDay = "2026-11-12"; s.streak = Math.max(1, s.streak); };

// 1 旧标签页回到前台整份写回，不盖掉别处的新进度
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = loadState().state, B = loadState().state;           // 两个标签页同时打开，都是空进度
  finish(B, "U1L1"); finish(B, "U1L2"); saveState(B);            // B 通关两关
  A.hearts = 3; saveState(A);                                     // A 回前台写回（没做题）
  ok("1 旧标签页写回后关卡和 XP 都在", stored().done.U1L2 === true && stored().xp === 120 && stored().lessonsCompleted === 2, JSON.stringify(stored()));
  ok("1 旧标签页内存同步到新进度，红心沿用本标签页", A.xp === 120 && A.done.U1L2 && stored().hearts === 3); }

// 2 两个标签页分别完成不同关卡：关卡并集，XP 相加不丢
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = loadState().state, B = loadState().state;
  finish(A, "U1L1"); saveState(A);
  finish(B, "U1L2"); saveState(B);
  ok("2 两标签页完成不同关卡：关卡并集", stored().done.U1L1 && stored().done.U1L2);
  ok("2 XP 相加 = 120（不是取大 60）", stored().xp === 120 && stored().lessonsCompleted === 2, JSON.stringify(stored()));
  finish(A, "U1L3"); saveState(A);
  ok("2 A 再做一关：XP 180，三关都在", stored().xp === 180 && Object.keys(stored().done).length === 3, JSON.stringify(stored())); }

// 3 同一份记录重复保存不重复加分
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = loadState().state; finish(A, "U1L1"); for (let i = 0; i < 5; i++) saveState(A);
  const B = loadState().state; for (let i = 0; i < 5; i++) saveState(B);
  for (let i = 0; i < 3; i++) { saveState(A); mergeStored(B); saveState(B); }
  ok("3 重复保存 / 反复合并：XP 仍是 60，次数 1", stored().xp === 60 && stored().lessonsCompleted === 1, JSON.stringify(stored())); }

// 4 清除后旧标签页不复活清除前的记录
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = loadState().state, B = loadState().state;
  finish(A, "U1L1"); finish(A, "U1L2"); saveState(A); mergeStored(B);   // B 已经看到 120
  const prefs = A.prefs; let C = clearState(); C.prefs = prefs; C.onboarded = true; saveState(C, { replace: true }); // A 页清除
  ok("4 清除后存储为空记录", stored().xp === 0 && Object.keys(stored().done).length === 0);
  saveState(B);                                                          // 旧标签页回到前台 / 保存
  ok("4 旧标签页保存后仍是清除后的空记录", stored().xp === 0 && Object.keys(stored().done).length === 0 && stored().lessonsCompleted === 0, JSON.stringify(stored()));
  ok("4 旧标签页内存也变成空记录", B.xp === 0 && Object.keys(B.done).length === 0);
  finish(B, "U1L1"); saveState(B);                                       // 旧标签页再做题
  ok("4 再做题只记新进度（XP 60，一关）", stored().xp === 60 && Object.keys(stored().done).length === 1, JSON.stringify(stored()));
  const R = loadState().state;                                           // 刷新
  ok("4 刷新后仍是新进度", R.xp === 60 && Object.keys(R.done).length === 1 && !R.done.U1L2); }

// 5 清除后存储没有记录时，旧标签页回前台也不复活
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const B = loadState().state; finish(B, "U1L1"); saveState(B);
  clearState();                                                          // 另一页清除，还没来得及保存
  const changed = mergeStored(B);
  ok("5 清除未保存时旧标签页采用空状态", changed && B.xp === 0 && Object.keys(B.done).length === 0); }

// 6 读取异常：保留原始存储，不写空档
{ reset(); const seed = freshState(); seed.onboarded = true; seed.xp = 40; saveState(seed);
  const before = mem["suipian.progress"];
  failRead = true; const r = loadState(); const wrote = saveState(r.state); failRead = false;
  ok("6 读取失败标记 readFailed，且不写入", r.readFailed === true && wrote === false && mem["suipian.progress"] === before); }

// 7 写入失败：返回 false，最后保存时间不更新
{ reset(); const s = freshState(); s.onboarded = true; saveState(s); const t0 = getLastSavedAt();
  failWrite = true; const res = saveState(s); failWrite = false;
  ok("7 写入失败返回 false，保存时间不变", res === false && getLastSavedAt() === t0);
  ok("7 写入成功后保存时间更新", saveState(s) === true && getLastSavedAt() >= t0); }

// 8 读不懂的记录被新记录覆盖且不抛错
{ reset(); mem["suipian.progress"] = "{坏的"; const s2 = freshState(); s2.xp = 5; ok("8 坏记录不抛错", saveState(s2) === true && stored().xp === 5); }
process.exit(fail ? 1 : 0);
