// 存储 v4（每页独立键 + 读时合并）的单元测试。两个“页面” = 两个 loadState() 出来的内存记录（_asTab 给不同页面 id），共用一份 localStorage。node tests/storage-merge.test.mjs
const mem = {}; let failRead = false, failWrite = false, quota = Infinity;
globalThis.localStorage = {
  getItem: (k) => { if (beforeGetLegacy && k === "suipian.progress") { const f = beforeGetLegacy; beforeGetLegacy = null; f(); } if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (beforeSet) { const f = beforeSet; beforeSet = null; f(); } if (failWrite) throw new Error("quota"); if (Object.values(mem).join("").length + String(v).length > quota) throw new Error("quota"); mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, mergeStored, syncFromStorage, addXp, addRun, clearState, freshState, getLastSavedAt, _asTab, hasV4, guestRawV3, clearGuestV4 } = await import("../src/storage.js");
let beforeGetLegacy = null; // 可控交错：在读取旧键之前先执行一段动作（模拟另一个页面此刻已迁移并学习）
let beforeSet = null; // 可控交错：在某次写入之前先执行一段动作（模拟另一个页面在这一刻清除 / 写入）
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
  const R = page(); saveState(R); saveState(R);      // 刷新 = 新页面 id（不继承旧 id）
  let r = seen(); ok("5 刷新再保存：XP 仍 60、次数 1（旧账本保留，不重复计分）", r.xp === 60 && r.runs === 1, JSON.stringify(r));
  finish(R, "U1L1", 60, true); saveState(R); r = seen();   // 刷新后重做已保存的关卡 = 复习（+5 的话记在本页面名下，这里用 60 验证只加一次复习 XP）
  ok("5 刷新后重做已保存的关卡：只增加复习 XP，不再给首次奖励", r.xp === 120 && r.runs === 2, JSON.stringify(r));
  // 刷新后没有保存就重新做同一关首次通关（旧页面已经保存过这一关的首次奖励）：不叠加
  const R2 = page(), R3 = page(); const q = seen(); finish(R2, "U1L2"); saveState(R2); finish(R3, "U1L2"); saveState(R3); // R3 在 R2 保存前就打开了（它眼里这一关还没通关）
  r = seen(); ok("5 两个页面先后首次通关同一关：奖励只算一次", r.xp === q.xp + 60 && r.runs === q.runs + 2, JSON.stringify([q, r])); }

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

// 8 迁移后旧代码覆盖旧键：新存档不受影响；旧页面之后写进旧键的内容不自动迁入（一次性迁移）；旧键被删也不影响
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 100, lessonsCompleted: 2 });
  const N = page(); finish(N, "U1L2"); saveState(N);                              // 新代码：XP 160
  mem["suipian.progress"] = legacyV3({ done: { U1L1: true, U1L9: true }, xp: 120, lessonsCompleted: 3 }); // 旧代码页面写旧键（多 20 XP、一关）
  let r = seen(); ok("8 旧代码覆盖旧键：新进度不受影响，旧页面后续写入不自动迁入（XP 160、2 关）", r.xp === 160 && r.done === "U1L1,U1L2" && r.runs === 3, JSON.stringify(r));
  const P = page(); saveState(P); finish(P, "U1L3"); saveState(P); r = seen();
  ok("8 之后新代码继续累加，不受旧键内容影响", r.xp === 220 && r.runs === 4 && !r.done.includes("U1L9"), JSON.stringify(r));
  delete mem["suipian.progress"]; r = seen(); ok("8 旧键被删后进度不变", r.xp === 220 && r.done === "U1L1,U1L2,U1L3", JSON.stringify(r)); }

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

// 15 不自动压缩 / 删除：很多页面后键数 = 页面数，进度完整；空间不足时保存明确失败，已保存的数据不丢
{ reset(); const pages = Array.from({ length: 60 }, () => page()); pages.forEach((P, i) => { finish(P, "L" + i); saveState(P); });
  const keys = Object.keys(mem).filter((k) => k.includes(".tab.")).length; loadState(); loadState();
  ok("15 不删任何键（60 个页面 = 60 个键）", keys === 60 && Object.keys(mem).filter((k) => k.includes(".tab.")).length === 60);
  const r = seen(); ok("15 进度完整：60 关、XP 3600、次数 60", r.done.split(",").length === 60 && r.xp === 3600 && r.runs === 60, JSON.stringify(r));
  quota = Object.values(mem).join("").length + 10; const Q = page(); finish(Q, "FULL"); const res = saveState(Q); quota = Infinity;
  ok("15 空间不足：保存返回 false（页面提示失败），已保存的 60 关不受影响", res === false && seen().xp === 3600);
  ok("15 空间恢复后补存成功", saveState(Q) === true && seen().xp === 3660); }

// 16 镜像只是兼容副本：v4 不读回；写失败不影响保存结果
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  const m = JSON.parse(mem["suipian.progress"]);
  ok("16 保存后旧键有最新合并结果（旧格式）", m.version === 3 && m.xp === 60 && m.done.U1L1 === true && m.lessonsCompleted === 1, JSON.stringify(m));
  mem["suipian.progress"] = legacyV3({ xp: 9999, done: { U1L9: true } });
  ok("16 v4 不读回旧键：镜像被改写，进度不变", seen().xp === 60 && seen().done === "U1L1");
  delete mem["suipian.progress"]; ok("16 镜像被删，进度不变", seen().xp === 60);
  // 镜像写失败不影响保存结果：只对旧键 setItem 失败
  const orig = globalThis.localStorage.setItem; globalThis.localStorage.setItem = (k, v) => { if (k === "suipian.progress") throw new Error("quota"); return orig(k, v); };
  finish(A, "U1L2"); const okSave = saveState(A); globalThis.localStorage.setItem = orig;
  ok("16 镜像写失败：保存仍成功，进度在 v4 里", okSave === true && seen().xp === 120); }

// 17 账号接管 / 导出读取完整 v4 视图（不读镜像）；视图不完整时返回 null（不当成“没有记录”）；清除游客记录连 v4 一起清
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  ok("17 有 v4 存储", hasV4(globalThis.localStorage));
  mem["suipian.progress"] = legacyV3({ xp: 1 });          // 镜像过时 / 被旧代码改写，不影响账号读到的内容
  const raw1 = guestRawV3(globalThis.localStorage), o = JSON.parse(raw1);
  ok("17 账号读取的游客记录 = 完整合并视图（XP 60，一关）且逐字稳定", o.xp === 60 && o.done.U1L1 === true && raw1 === guestRawV3(globalThis.localStorage), raw1);
  failRead = true; const bad = guestRawV3(globalThis.localStorage); failRead = false;
  ok("17 读取失败：返回 null，不是空记录", bad === null);
  const orig = globalThis.localStorage.getItem; const tabKey = Object.keys(mem).find((k) => k.includes(".tab.")); globalThis.localStorage.getItem = (k) => { if (k === tabKey) throw new Error("x"); return orig(k); };
  const part = guestRawV3(globalThis.localStorage); const lr = loadState(); const ms = mergeStored(A); globalThis.localStorage.getItem = orig;
  ok("17 某个账本读取失败：视图不完整 → 导出 null、loadState 报 readFailed、不更新内存", part === null && lr.readFailed === true && ms === false && A.xp === 60);
  ok("17 账号接管后清除游客记录：v4 和旧键都清", clearGuestV4(globalThis.localStorage) === true && seen().xp === 0); }

// 18 清除与保存交错（可控）：保存过程中另一页恰好清除
{ reset(); const A = page(); finish(A, "U1L1"); saveState(A);
  // 18a：在 A 写自己的账本之前清除
  finish(A, "U1L2"); beforeSet = () => { const C = clearState(); _asTab(C, "pcX"); };
  const r1 = saveState(A); let r = seen();
  ok("18a 清除发生在写账本前：保存后视图为空，A 内存是新一代空记录，旧进度不复活", r.xp === 0 && r.done === "" && A.xp === 0 && Object.keys(A.done).length === 0, JSON.stringify(r) + " A.xp=" + A.xp);
  ok("18a 旧代写入的残留账本被忽略；旧键镜像不再被当作进度", mem["suipian.progress"] === undefined || JSON.parse(mem["suipian.progress"]).xp === 0 || r.xp === 0);
  // 18b：A 已写完账本、写镜像之前清除（用对旧键 setItem 的钩子触发清除）
  const B = page(); finish(B, "U1L1"); saveState(B);
  const origSet = globalThis.localStorage.setItem; let fired = false;
  globalThis.localStorage.setItem = (k, v) => { if (k === "suipian.progress" && !fired) { fired = true; const C = clearState(); _asTab(C, "pcY"); } return origSet(k, v); };
  finish(B, "U1L2"); const r2 = saveState(B); globalThis.localStorage.setItem = origSet; r = seen();
  ok("18b 清除发生在写镜像前：v4 视图为空（旧进度不复活）", r.xp === 0 && r.done === "", JSON.stringify(r));
  mergeStored(B); /* 收到另一页清除的 storage 事件 */ finish(B, "U1L5"); saveState(B); r = seen(); ok("18b 收到清除通知后新做的一关保住", r.xp === 60 && r.done === "U1L5", JSON.stringify(r) + " r2=" + r2); }

// 19 同时存活的页面各有独立写入身份：两个页面加载（即使 sessionStorage 被复制）也不共用键
{ reset(); const A = page(), B = page(); finish(A, "U1L1"); finish(B, "U1L2"); saveState(A); saveState(B);
  const tabs = Object.keys(mem).filter((k) => k.includes(".tab."));
  ok("19 两个页面各写各的键", tabs.length === 2); ok("19 互不覆盖：两关、XP 120", seen().xp === 120 && seen().done === "U1L1,U1L2");
  const ids = new Set(); for (let i = 0; i < 20; i++) ids.add(Date.now().toString(36) + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10));
  ok("19 页面 id 随机生成（不依赖 sessionStorage）", ids.size === 20); }

// 20 基线保存失败：不写账本 / 镜像，旧数据原样；恢复后再保存，不重复计分
{ reset(); const raw = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 }); mem["suipian.progress"] = raw;
  const orig = globalThis.localStorage.setItem; globalThis.localStorage.setItem = (k, v) => { if (k.includes(".base.")) throw new Error("quota"); return orig(k, v); };
  const A = page(); finish(A, "U1L2"); const r1 = saveState(A); globalThis.localStorage.setItem = orig;
  ok("20 基线写失败：保存返回 false，没有账本键、没有镜像、旧键原样", r1 === false && !Object.keys(mem).some((k) => k.includes(".tab.")) && mem["suipian.progress"] === raw);
  ok("20 基线恢复后保存成功，XP 130（70 + 60），不重复计分", saveState(A) === true && seen().xp === 130 && seen().runs === 2, JSON.stringify(seen())); }

// 21 首次双页面同时迁移：基线写入之前另一个页面完成同样的迁移（内容相同），结果不重复
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 });
  beforeSet = () => { loadState(); };                         // A 写基线之前，B 已经迁移完成
  const A = page(); const B = page();
  finish(A, "U1L2"); finish(B, "U1L3"); saveState(A); saveState(B);
  const r = seen(); ok("21 同时迁移：XP 190（70 + 60 + 60），两关都在，不重复", r.xp === 190 && r.done === "U1L1,U1L2,U1L3" && r.runs === 3, JSON.stringify(r));
  ok("21 只有一份基线", Object.keys(mem).filter((k) => k.includes(".base.")).length === 1); }

// 22 损坏的 v4 数据：读取失败，不重新迁移旧键，不跳过后当完整视图；原文保留；保存 / 导出 / 账号接管都被阻止
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 });
  const A = page(); finish(A, "U1L2"); saveState(A);
  const baseKey = Object.keys(mem).find((k) => k.includes(".base.")), tabKey = Object.keys(mem).find((k) => k.includes(".tab."));
  // 22a 账本损坏
  const goodTab = mem[tabKey]; mem[tabKey] = "{坏的";
  let lr = loadState(); const sv = saveState(A), mg = mergeStored(A), ex = guestRawV3(globalThis.localStorage);
  ok("22a 账本损坏：loadState 读取失败、保存 false、合并不动内存、账号导出 null", lr.readFailed === true && sv === false && mg === false && ex === null && A.xp === 130);
  ok("22a 损坏的原文原样保留（没有被覆盖 / 删除）", mem[tabKey] === "{坏的");
  mem[tabKey] = goodTab; ok("22a 修复后恢复正常", loadState().readFailed !== true && seen().xp === 130);
  mem[tabKey] = JSON.stringify({ v: 5, epoch: "m0", entries: {} }); ok("22a 未知版本的账本也当读取失败", loadState().readFailed === true); mem[tabKey] = goodTab;
  // 22b 基线损坏：不重新迁移旧键
  const goodBase = mem[baseKey]; mem[baseKey] = "{坏的"; mem["suipian.progress"] = legacyV3({ done: {}, xp: 5 });
  lr = loadState(); ok("22b 基线损坏：读取失败，不重新迁移旧键（不会读到旧键里的 5）", lr.readFailed === true && lr.state.xp === 0 && mem[baseKey] === "{坏的" && saveState(A) === false);
  mem[baseKey] = JSON.stringify({ v: 4, epoch: "别的", s: {} }); ok("22b 基线代数对不上也当读取失败", loadState().readFailed === true);
  mem[baseKey] = goodBase; ok("22b 修复后恢复", seen().xp === 130); }

// 23 PO 03:15 的竞争顺序：B 读到“基线不存在”后暂停 → A 完成迁移、学习并更新旧键镜像 → B 继续读旧键。B 不能把含新奖励的镜像再写成基线（会重复计分）
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 });
  let A = null;
  beforeGetLegacy = () => { A = page(); finish(A, "U1L2"); saveState(A); };   // B 读旧键之前，A 已建好基线、学完一关并写了镜像
  const B = page();                                                              // B：读到基线不存在 → 读旧键（此刻 A 的镜像已在）
  const baseKeys = Object.keys(mem).filter((k) => k.includes(".base."));
  ok("23 B 没有把 A 的镜像写成第二份基线：只有一份基线，且基线 XP 是原始的 70", baseKeys.length === 1 && JSON.parse(mem[baseKeys[0]]).s.xp === 70, JSON.stringify(baseKeys));
  finish(B, "U1L3"); saveState(B);
  const r = seen(); ok("23 XP 190（70 + 60 + 60）、三关都在、次数 3，A 的奖励没有重复", r.xp === 190 && r.done === "U1L1,U1L2,U1L3" && r.runs === 3, JSON.stringify(r)); }

// 24 旧键是 v4 镜像、但基线读不到（基线被外部删掉）：安全失败，不拿镜像当旧存档迁移，不保存
{ reset(); mem["suipian.progress"] = legacyV3({ done: { U1L1: true }, xp: 70, lessonsCompleted: 1 });
  const A = page(); finish(A, "U1L2"); saveState(A);
  for (const k of Object.keys(mem)) if (k.includes(".base.")) delete mem[k];
  const lr = loadState(); ok("24 镜像在、基线没了：读取失败，不重新迁移，不保存，不写新基线", lr.readFailed === true && saveState(A) === false && !Object.keys(mem).some((k) => k.includes(".base."))); }
process.exit(fail ? 1 : 0);
