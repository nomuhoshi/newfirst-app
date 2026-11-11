// 多标签页进度合并 / 清除 / 读写异常 的单元测试（模拟两个标签页 = 两个 loadState() 出来的内存记录，共用一份存储）。node tests/storage-merge.test.mjs
const mem = {}; let failRead = false, failWrite = false;
globalThis.localStorage = {
  getItem: (k) => { if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (failWrite) throw new Error("quota"); mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; },
  key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, mergeStored, syncFromStorage, addXp, addRun, clearState, freshState, getLastSavedAt, _asTab } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const stored = () => JSON.parse(mem["suipian.progress"]);
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; };
// 模拟答题：和 app 一致，完成一关加 XP / 次数后保存
// 首次通关：4 题 +40 途中 + 通关 +10 ≈ 一关 xp（这里取 60）；review=true 是复习（+5 / 题，记在本标签页名下）
const finish = (s, id, xp = 60, review = false) => { addXp(s, xp, id, !review); s.done[id] = true; addRun(s); s.lastDay = "2026-11-12"; s.streak = Math.max(1, s.streak); };

// 1 旧标签页回到前台整份写回，不盖掉别处的新进度
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");           // 两个标签页同时打开，都是空进度
  finish(B, "U1L1"); finish(B, "U1L2"); saveState(B);            // B 通关两关
  A.hearts = 3; saveState(A);                                     // A 回前台写回（没做题）
  ok("1 旧标签页写回后关卡和 XP 都在", stored().done.U1L2 === true && stored().xp === 120 && stored().lessonsCompleted === 2, JSON.stringify(stored()));
  ok("1 旧标签页内存同步到新进度，红心沿用本标签页", A.xp === 120 && A.done.U1L2 && stored().hearts === 3); }

// 2 两个标签页分别完成不同关卡：关卡并集，XP 相加不丢
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
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
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
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

// 9 两个标签同时首次完成同一关：首次通关奖励只算一次，完成次数两次都计
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
  finish(A, "U1L1"); finish(B, "U1L1");
  saveState(A); saveState(B); saveState(A);
  ok("9 同一关两标签各首次完成：XP 只算 60", stored().xp === 60, JSON.stringify(stored()));
  ok("9 关卡 1 个；完成次数 2（两次通关都发生过）", Object.keys(stored().done).length === 1 && stored().lessonsCompleted === 2, JSON.stringify(stored()));
  // 其中一个标签页途中拿了一部分（未完成），另一个已完成
  reset(); saveState(seed); const C = _asTab(loadState().state, "tC"), D = _asTab(loadState().state, "tD");
  addXp(D, 20, "U1L2", true); saveState(D); finish(C, "U1L2"); saveState(C); finish(D, "U1L2", 40); saveState(D);
  ok("9b 途中部分 XP 不叠加：U1L2 只算一次 60", stored().xp === 60, JSON.stringify(stored())); }

// 10 复习 XP 记在各自标签页名下，相加；同一份重复合并不变
{ reset(); const seed = freshState(); seed.onboarded = true; seed.done.U1L1 = true; seed.xpBase = 60; seed.xp = 60; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
  addXp(A, 5, "U1L1", false); addXp(A, 5, "U1L1", false); saveState(A);
  addXp(B, 5, "U1L1", false); saveState(B);
  for (let i = 0; i < 4; i++) { syncFromStorage(A); syncFromStorage(B); saveState(A); saveState(B); }
  ok("10 复习 XP 相加 60+15=75，反复合并不变", stored().xp === 75 && A.xp === 75 && B.xp === 75, JSON.stringify(stored())); }

// 11 旧格式存档（没有账本字段）升级：XP 原样保留，之后正常累加
{ reset(); mem["suipian.progress"] = JSON.stringify({ version: 3, onboarded: true, xp: 130, hearts: 4, heartsAt: 1, streak: 3, lastDay: "2026-11-10", done: { U1L1: true, U1L2: true }, doneOn: {}, lessonsCompleted: 5, installTipClosed: false, lastActive: 1, prefs: { sound: true, haptics: true, soundStyle: "J" } });
  const A = _asTab(loadState().state, "tA"); ok("11 旧存档读入后 XP 130、次数 5", A.xp === 130 && A.lessonsCompleted === 5);
  finish(A, "U1L3"); saveState(A);
  ok("11 升级后通关一关：XP 190、次数 6、三关", stored().xp === 190 && stored().lessonsCompleted === 6 && Object.keys(stored().done).length === 3, JSON.stringify(stored())); }

// 12 旧代码标签页（不认识账本字段，整份写回自己内存里的旧 JSON）：新标签页的进度合并回来，旧页自己的增量也保留
{ reset(); mem["suipian.progress"] = JSON.stringify({ version: 3, onboarded: true, xp: 100, hearts: 5, heartsAt: 1, streak: 1, lastDay: "2026-11-11", done: { U1L1: true }, doneOn: {}, lessonsCompleted: 2, installTipClosed: false, lastActive: 1, prefs: { sound: true, haptics: true, soundStyle: "J" } });
  const oldCode = JSON.parse(mem["suipian.progress"]);                    // 旧标签页加载时的内存记录
  const N = _asTab(loadState().state, "tN"); finish(N, "U1L2"); saveState(N);          // 新代码标签页通关一关（XP 160）
  oldCode.xp = 120; oldCode.done.U1L1 = true; mem["suipian.progress"] = JSON.stringify(oldCode); // 旧代码整份写回：盖掉了账本字段
  ok("12 旧代码覆盖后存储里确实丢了 U1L2（已知限制）", !stored().done.U1L2);
  saveState(N);                                                           // 新标签页下次保存把自己的进度补回来
  ok("12 新代码标签页保存后 U1L2 回来，XP = 120 + 60 = 180", stored().done.U1L2 === true && stored().xp === 180, JSON.stringify(stored())); }

// 13 导入合并（XP 取较大、直接改 xp）后不被旧标签页覆盖
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
  A.done.U1L1 = true; A.xp = Math.max(A.xp, 90); A.lessonsCompleted = 3; saveState(A);   // 与 progress-file 的 mergeImport 一样直接改总数
  saveState(B);                                                            // 旧标签页写回
  ok("13 导入后旧标签页保存：XP 90、关卡、次数都在", stored().xp === 90 && stored().done.U1L1 && stored().lessonsCompleted === 3, JSON.stringify(stored())); }

// 14 保存与清除交错：清除之后，旧标签页的任何保存 / 回前台都不复活；清除后新记录里的进度不被旧标签页丢弃
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
  finish(B, "U1L1"); saveState(B);
  const C = clearState(); C.onboarded = true; C.prefs = A.prefs;
  // 交错：旧标签页 B 在清除“写入前”又做了一关并保存
  finish(B, "U1L2"); saveState(B);
  saveState(C, { replace: true });                                       // 清除标签页写入空记录
  syncFromStorage(B); saveState(B); mergeStored(A); saveState(A);
  ok("14 清除后两个旧标签页都不复活", stored().xp === 0 && Object.keys(stored().done).length === 0 && B.xp === 0 && A.xp === 0, JSON.stringify(stored()));
  finish(A, "U1L1"); saveState(A); syncFromStorage(B); saveState(B);
  ok("14 清除后新做的一关保住（XP 60，一关）", stored().xp === 60 && Object.keys(stored().done).length === 1 && B.xp === 60, JSON.stringify(stored())); }

// 15 写后被另一个页面盖掉（模拟同时写）：回读发现缺内容，补写回来
{ reset(); const seed = freshState(); seed.onboarded = true; saveState(seed);
  const A = _asTab(loadState().state, "tA"), B = _asTab(loadState().state, "tB");
  finish(A, "U1L1"); saveState(A);
  const snapshotA = mem["suipian.progress"];
  finish(B, "U1L2"); mem["suipian.progress"] = snapshotA;               // B 的写入被 A 的旧快照盖掉
  syncFromStorage(B);                                                      // B 收到 storage 事件
  ok("15 B 补写回：两关都在，XP 120", stored().done.U1L1 && stored().done.U1L2 && stored().xp === 120, JSON.stringify(stored())); }
process.exit(fail ? 1 : 0);
