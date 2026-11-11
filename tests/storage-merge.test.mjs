// 存储 v4（每页独立键 + 读时合并）的单元测试。两个“页面” = 两个 loadState() 出来的内存记录（_asTab 给不同页面 id），共用一份 localStorage。node tests/storage-merge.test.mjs
const mem = {}; let failRead = false, failWrite = false, quota = Infinity;
globalThis.localStorage = {
  getItem: (k) => { if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (failWrite) throw new Error("quota"); if (Object.values(mem).join("").length + String(v).length > quota) throw new Error("quota"); mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, mergeStored, syncFromStorage, addXp, addRun, clearState, freshState, getLastSavedAt, _asTab, hasV4, clearGuestV4 } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; failRead = failWrite = false; quota = Infinity; };
let n = 0; const page = () => _asTab(loadState().state, "p" + ++n);            // 打开一个新页面
const seen = () => { const s = loadState().state; return { xp: s.xp, runs: s.lessonsCompleted, done: Object.keys(s.done).sort().join(","), streak: s.streak, lastDay: s.lastDay, hearts: s.hearts }; }; // 一个新打开的页面看到的合并结果
const legacyV3 = (o = {}) => JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: 1, streak: 0, lastDay: null, done: {}, doneOn: {}, lessonsCompleted: 0, installTipClosed: false, lastActive: 1, prefs: { sound: true, haptics: true, soundStyle: "J" }, ...o });
// 完成一关：和 app 一致 —— 首次通关途中 XP 记 firstXp，完成次数 +1，保存
const finish = (s, id, xp = 60, review = false) => { addXp(s, xp, id, !review); s.done[id] = true; addRun(s); s.lastDay = "2026-11-12"; s.streak = Math.max(1, s.streak); };
const day = "2026-11-12";

// 1 旧页面回前台保存，不盖掉别处的新进度（每个页面只写自己的键，根本不会覆盖）
{ reset(); const A = page(), B = page();
  finish(B, "U1L1"); finish(B, "U1L2"); saveState(B);
  A.hearts = 3; saveState(A);
  const r = seen(); ok("1 旧页面保存后关卡和 XP 都在", r.done === "U1L1,U1L2" && r.xp === 120 && r.runs === 2, JSON.stringify(r));
  ok("1 旧页面内存同步到新进度", A.xp === 120 && A.done.U1L2); }

// 2 两个页面分别完成不同关卡：关卡并集，XP 相加
{ reset(); const A = page(), B = page();
  finish(A, "U1L1"); saveState(A); finish(B, "U1L2"); saveState(B); finish(A, "U1L3"); saveState(A);
  const r = seen(); ok("2 三关都在，XP 180，次数 3", r.done === "U1L1,U1L2,U1L3" && r.xp === 180 && r.runs === 3, JSON.stringify(r)); }

// 3 重复保存、重复读取不加分
{ reset(); const A = page(); finish(A, "U1L1"); for (let i = 0; i < 6; i++) saveState(A);
  const B = page(); for (let i = 0; i < 6; i++) { mergeStored(B); saveState(B); mergeStored(A); saveState(A); }
  const r = seen(); ok("3 反复保存/合并后 XP 60、次数 1", r.xp === 60 && r.runs === 1, JSON.stringify(r)); }

// 4 同时首次完成同一关：奖励只算一次；途中部分 XP 不叠加
{ reset(); const A = page(), B = page(); finish(A, "U1L1"); finish(B, "U1L1"); saveState(A); saveState(B); saveState(A);
  let r = seen(); ok("4 同一关两页面各首次完成：XP 只算 60", r.xp === 60, JSON.stringify(r));
  ok("4 完成次数 2（两个页面各实际完成一次，见 docs/56 §6）", r.runs === 2, JSON.stringify(r));
  reset(); const C = page(), D = page(); addXp(D, 20, "U1L2", true); saveState(D); finish(C, "U1L2"); saveState(C); finish(D, "U1L2", 40); saveState(D);
  r = seen(); ok("4b 途中 XP 不叠加：U1L2 只算 60", r.xp === 60, JSON.stringify(r)); }

// 5 刷新后不能重复提交已保存的奖励：刷新 = 同一页面 id 再次 loadState，接着写同一个键
{ reset(); const A = page(); const aid = "p" + n; finish(A, "U1L1"); saveState(A);
  const keysBefore = Object.keys(mem).filter((k) => k.includes(".tab.")).length;
  const R = _asTab(loadState().state, aid); saveState(R); saveState(R);
  const r = seen(); ok("5 刷新再保存：XP 仍 60、次数 1", r.xp === 60 && r.runs === 1, JSON.stringify(r));
  ok("5 刷新没有多写键", Object.keys(mem).filter((k) => k.includes(".tab.")).length === keysBefore); }

// 6 复习 XP 记在各自页面名下，相加
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 60, lessonsCompleted: 1 });
  const A = page(), B = page(); addXp(A, 5, "U1L1", false); addXp(A, 5, "U1L1", false); saveState(A); addXp(B, 5, "U1L1", false); saveState(B);
  for (let i = 0; i < 3; i++) { mergeStored(A); mergeStored(B); saveState(A); saveState(B); }
  const r = seen(); ok("6 旧存档 60 + 复习 15 = 75，反复合并不变", r.xp === 75, JSON.stringify(r)); }

// 7 迁移：旧存档原样保留（XP、关卡、次数、连续天数、红心），旧键不被修改，重复迁移不加分
{ reset(); const raw = legacyV3({ done: { U1L1: true, U1L2: true }, xp: 130, lessonsCompleted: 5, streak: 3, lastDay: "2026-11-10", hearts: 4 }); mem["suipian.progress"] = raw;
  let r = seen(); ok("7 迁移后进度原样保留", r.xp === 130 && r.runs === 5 && r.done === "U1L1,U1L2" && r.streak === 3 && r.hearts === 4, JSON.stringify(r));
  ok("7 旧键没有被改动", mem["suipian.progress"] === raw);
  for (let i = 0; i < 4; i++) seen();
  const A = page(); finish(A, "U1L3"); saveState(A); r = seen();
  ok("7 重复迁移 / 打开不加分；通关一关后 XP 190、次数 6", r.xp === 190 && r.runs === 6, JSON.stringify(r)); }

// 8 迁移后旧代码覆盖旧键：新存档不受影响；旧代码多出来的进度被并入，且不重复计分；旧键被删除后也不丢
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 100, lessonsCompleted: 2 });
  const N = page(); finish(N, "U1L2"); saveState(N);                              // 新代码：XP 160
  mem["suipian.progress"] = legacyV3({ done: { U1L1: true, U1L9: true }, xp: 120, lessonsCompleted: 3 }); // 旧代码页面把旧键写成 120（比迁移时多 20、多一关 U1L9）
  let r = seen(); ok("8 旧代码覆盖旧键：新进度不丢，旧页多出的 20 XP / 一关被并入（XP 180）", r.xp === 180 && r.done === "U1L1,U1L2,U1L9" && r.runs === 4, JSON.stringify(r));
  for (let i = 0; i < 3; i++) { const P = page(); saveState(P); }
  r = seen(); ok("8 反复打开 / 保存不重复计分", r.xp === 180 && r.runs === 4, JSON.stringify(r));
  delete mem["suipian.progress"]; r = seen(); ok("8 旧键被删后，已并入的部分仍在", r.xp === 180 && r.done.includes("U1L9"), JSON.stringify(r)); }

// 9 导入进度文件（直接改总数）后不被旧页面覆盖
{ reset(); const A = page(), B = page();
  syncFromStorage(A); A.done.U1L1 = true; A.xp = Math.max(A.xp, 90); A.lessonsCompleted = 3; saveState(A);
  saveState(B);
  const r = seen(); ok("9 导入后另一页保存：XP 90、关卡、次数 3 仍在", r.xp === 90 && r.done === "U1L1" && r.runs === 3, JSON.stringify(r)); }

// 10 清除：旧页面保存 / 回前台 / 再做题 / 刷新都不复活；旧代码再写旧键也不复活
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 50, lessonsCompleted: 1 });
  const A = page(), B = page(); finish(A, "U1L2"); saveState(A); mergeStored(B);
  const C = clearState(); _asTab(C, "pc"); C.onboarded = true; saveState(C);
  ok("10 清除后新页面看到空记录", seen().xp === 0 && seen().done === "");
  saveState(B); mergeStored(A); saveState(A);
  let r = seen(); ok("10 旧页面保存 / 回前台后仍是空记录", r.xp === 0 && r.done === "" && B.xp === 0 && A.xp === 0, JSON.stringify(r));
  mem["suipian.progress"] = legacyV3({ done: { U1L1: true, U1L2: true }, xp: 500, lessonsCompleted: 9 }); // 旧代码页面把旧键写回
  r = seen(); ok("10 旧代码再写旧键也不复活", r.xp === 0 && r.done === "", JSON.stringify(r));
  finish(B, "U1L1"); saveState(B); const R = _asTab(loadState().state, "p-b"); saveState(R);
  r = seen(); ok("10 清除后新做的一关保住（XP 60，一关）", r.xp === 60 && r.done === "U1L1", JSON.stringify(r)); }

// 11 清除与保存交错：清除“写入前”旧页面又保存了一次，以及清除后紧接着旧页面保存
{ reset(); const B = page(); finish(B, "U1L1"); saveState(B);
  const C = clearState(); _asTab(C, "pc2"); finish(B, "U1L2"); saveState(B);   // B 在清除之后才保存（还是旧代内存）
  let r = seen(); ok("11 清除后旧页面保存：不复活", r.xp === 0 && r.done === "", JSON.stringify(r) + " B.xp=" + B.xp);
  ok("11 旧页面内存已被替换成新一代的空记录", B.xp === 0 && Object.keys(B.done).length === 0); }

// 12 读取异常：不写入，不当成“没有记录”；写入失败：返回 false，最后保存时间不变；空间不足：已保存的数据还在
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  failRead = true; const lr = loadState(); const wrote = saveState(A); failRead = false;
  ok("12 读取异常：readFailed，保存返回 false，存储没被改", lr.readFailed === true && wrote === false && seen().xp === 60);
  const t0 = getLastSavedAt(); failWrite = true; finish(A, "U1L2"); const res = saveState(A); failWrite = false;
  ok("12 写入失败返回 false，保存时间不变，已保存的数据还在", res === false && getLastSavedAt() === t0 && seen().xp === 60 && seen().done === "U1L1");
  ok("12 写入失败不丢内存里的进度，下次保存补上", saveState(A) === true && seen().done === "U1L1,U1L2" && seen().xp === 120);
  quota = Object.values(mem).join("").length + 5; finish(A, "U1L3"); ok("12 空间不足：保存返回 false，不显示成功", saveState(A) === false); quota = Infinity; }

// 13 损坏 / 读不懂的旧存档：留一份备份，提示，不静默变空档
{ reset(); mem["suipian.progress"] = "{坏的"; const r = loadState();
  ok("13 损坏的旧存档：提示 + 备份一份", !!r.notice && Object.keys(mem).some((k) => k.startsWith("suipian.progress.unreadable.")));
  reset(); mem["suipian.progress"] = JSON.stringify({ version: 9, xp: 1 }); const r2 = loadState(); ok("13 版本不认识：提示 + 备份", !!r2.notice && Object.keys(mem).some((k) => k.startsWith("suipian.progress.unreadable."))); }

// 14 迁移中断 / 重复：基线写不进去时本次照常使用，旧键没动，下次再迁移结果一样
{ reset(); const raw = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 }); mem["suipian.progress"] = raw;
  failWrite = true; const s = loadState().state; failWrite = false;
  ok("14 基线写失败：页面照常显示旧进度", s.xp === 70 && s.done.U1L1 === true);
  ok("14 旧键没动、没有半成品基线", mem["suipian.progress"] === raw && !Object.keys(mem).some((k) => k.includes(".base.")));
  const r = seen(); ok("14 下次打开重新迁移，结果一致", r.xp === 70 && r.runs === 1); }

// 15 键数量：很多页面（每次启动新页面）后压缩，不丢进度；压缩被中断（写池失败）不删任何键
{ reset(); const expect = { xp: 0, ids: [] };
  const pages = Array.from({ length: 60 }, () => page()); // 先全部打开（此时还没有账本键，不触发压缩），再各自保存
  pages.forEach((P, i) => { finish(P, "L" + i); saveState(P); });
  const before = Object.keys(mem).filter((k) => k.includes(".tab.")).length;
  failWrite = true; loadState(); failWrite = false;
  ok("15 压缩写池失败：不删任何键", Object.keys(mem).filter((k) => k.includes(".tab.")).length === before);
  loadState();
  const after = Object.keys(mem).filter((k) => k.includes(".tab.")).length, r = seen();
  ok(`15 压缩后键数明显减少（${before} → ${after}）`, after < before / 3 + 3);
  ok("15 压缩后进度一致：60 关、XP 3600", Object.keys(r.done.split(",")).length === 60 && r.xp === 3600 && r.runs === 60, JSON.stringify(r));
  const P = _asTab(loadState().state, "p-late"); finish(P, "LATE"); saveState(P); ok("15 压缩后继续累加", seen().xp === 3660); }

// 16 镜像：每次保存后旧键是最新合并结果（带指纹）；旧代码改了镜像 → 只并入多出来的部分；没改 → 忽略
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  const m = JSON.parse(mem["suipian.progress"]);
  ok("16 镜像内容 = 合并结果（XP 60、一关、次数 1），带 mirror 字段", m.version === 3 && m.xp === 60 && m.done.U1L1 === true && m.lessonsCompleted === 1 && m.mirrorXp === 60 && typeof m.mirrorFp === "string", JSON.stringify(m));
  for (let i = 0; i < 4; i++) { const P = page(); saveState(P); mergeStored(P); }
  ok("16 镜像没被改：反复打开 / 保存不重复计分", seen().xp === 60 && seen().runs === 1);
  m.xp += 20; m.done.U1L7 = true; m.lessonsCompleted += 1; mem["suipian.progress"] = JSON.stringify(m); // 旧代码页面读了镜像、做了一关、整份写回（保留未知字段）
  let r = seen(); ok("16 旧代码在镜像上做了一关（+20 XP）：并入且只并一次", r.xp === 80 && r.done === "U1L1,U1L7" && r.runs === 2, JSON.stringify(r));
  const B = page(); finish(B, "U1L8"); saveState(B); saveState(B); r = seen();
  ok("16 之后新代码继续累加，镜像重写后不重复计旧代码增量", r.xp === 140 && r.runs === 3, JSON.stringify(r)); }

// 17 账号兼容：清除游客记录（账号接管后）连 v4 一起清
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  ok("17 有 v4 存储", hasV4(globalThis.localStorage));
  ok("17 清除游客记录后进度为空，旧键也被删", clearGuestV4(globalThis.localStorage) === true && seen().xp === 0 && !("suipian.progress" in mem && JSON.parse(mem["suipian.progress"]).xp > 0)); }
process.exit(fail ? 1 : 0);
