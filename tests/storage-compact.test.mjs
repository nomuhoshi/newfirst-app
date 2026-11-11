// 存储 v4 安全压缩：视图压缩前后一致、不丢并发写入、多个页面同时压缩不丢、读不懂的账本放弃压缩。node tests/storage-compact.test.mjs
const mem = {}; let beforeSet = null, failRead = false, failWrite = false;
globalThis.localStorage = {
  getItem: (k) => { if (failRead) throw new Error("denied"); return k in mem ? mem[k] : null; },
  setItem: (k, v) => { if (beforeSet) { const f = beforeSet; beforeSet = null; f(); } if (failWrite) throw new Error("quota"); mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const { loadState, saveState, addXp, addRun, compactLedgers, _asTab, _auto } = await import("../src/storage.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const DAY = 24 * 3600 * 1000, realNow = Date.now.bind(Date);
const reset = () => { _auto.on = false; for (const k of Object.keys(mem)) delete mem[k]; beforeSet = null; failRead = failWrite = false; Date.now = realNow; };
let n = 0; const page = () => _asTab(loadState().state, "p" + ++n);
const seen = () => { const s = loadState().state; return JSON.stringify({ xp: s.xp, runs: s.lessonsCompleted, done: Object.keys(s.done).sort(), streak: s.streak, lastDay: s.lastDay, hearts: s.hearts }); };
const finish = (s, id, xp = 60) => { addXp(s, xp, id, true); s.done[id] = true; addRun(s); s.lastDay = "2026-11-12"; s.streak = Math.max(1, s.streak); };
const tabKeys = () => Object.keys(mem).filter((k) => k.includes(".tab."));
// 造 N 个“旧页面”：每个页面在 daysAgo 天前完成一关（时间戳用 Date.now 模拟）
function oldPages(count, daysAgo, startAt = 0) {
  for (let i = 0; i < count; i++) {
    Date.now = () => realNow() - daysAgo * DAY + i; const p = page(); finish(p, "U1L" + (((startAt + i) % 8) + 1), 50); p.hearts = 3; saveState(p);
  }
  Date.now = realNow;
}

// 1 压缩前后：视图完全一致，键数大幅减少
{ reset(); oldPages(60, 10); const before = seen(), k0 = tabKeys().length;
  const r = compactLedgers(); const after = seen();
  ok("1 压缩前后视图一致", before === after, before + " vs " + after);
  ok("1 键数大幅减少（60+ → 个位数）", k0 >= 60 && tabKeys().length <= 3 && r.folded >= 60, `${k0} → ${tabKeys().length} ${JSON.stringify(r)}`);
  ok("1 再压缩一次也不变（幂等）", (compactLedgers(), seen()) === before); }

// 2 最近动过的页面不压缩；自己的键不动
{ reset(); oldPages(30, 10); const recent = page(); finish(recent, "U2L1", 70); saveState(recent);
  const rk = tabKeys().find((k) => JSON.parse(mem[k]).entries[Object.keys(JSON.parse(mem[k]).entries)[0]].done.U2L1);
  const before = seen(); compactLedgers();
  ok("2 刚保存过的页面的键还在，视图不变", !!mem[rk] && seen() === before); }

// 3 少于阈值不压缩
{ reset(); oldPages(10, 10); const k0 = tabKeys().length; const r = compactLedgers();
  ok("3 键少于 24 个不压缩", tabKeys().length === k0 && /键不多/.test(r.skipped || "")); }

// 4 压缩中途，被压缩的页面又保存了新进度（交错）：新进度不丢
{ reset(); oldPages(30, 10); const victim = tabKeys()[5], rec = JSON.parse(mem[victim]), id = Object.keys(rec.entries)[0];
  beforeSet = () => { // 汇总键写入之前，这个“旧页面”回来又完成了一关并保存（直接改它的键，相当于它自己的写入）
    const r2 = JSON.parse(mem[victim]); r2.entries[id].done.U5L5 = true; r2.entries[id].xp += 60; r2.entries[id].runs += 1; r2.entries[id].meta.t = realNow(); mem[victim] = JSON.stringify(r2); };
  const r = compactLedgers(); const s = JSON.parse(seen());
  ok("4 中途被改的页面：新进度还在（它的键没被删）", s.done.includes("U5L5") && !!mem[victim], seen());
  const fin = JSON.parse(seen()); ok("4 没有重复计分：XP = 29×50 + 110 = 1560", fin.xp === 29 * 50 + 110, String(fin.xp)); }

// 5 两个页面同时压缩：各写各的汇总键，互不覆盖，视图不变
{ reset(); oldPages(40, 10); const before = seen();
  beforeSet = () => { compactLedgers(); }; // A 写汇总键之前，B 已经完整压缩了一遍
  compactLedgers(); ok("5 两个压缩器交错：视图不变", seen() === before, seen());
  ok("5 键数不多", tabKeys().length <= 6, String(tabKeys().length)); }

// 6 读不懂的账本 / 读写失败：放弃压缩，不删任何东西
{ reset(); oldPages(30, 10); mem["suipian.v4.tab.bad"] = "{坏"; const k0 = tabKeys().length, r = compactLedgers();
  ok("6 有读不懂的账本：放弃，一个键都不删", tabKeys().length === k0 && /读不懂/.test(r.skipped || "")); delete mem["suipian.v4.tab.bad"]; const k1 = tabKeys().length;
  failWrite = true; const r2 = compactLedgers(); failWrite = false; ok("6 写入失败：放弃，原键都在", tabKeys().length === k1 && /写入失败/.test(r2.skipped || ""));
  failRead = true; const r3 = compactLedgers(); failRead = false; ok("6 读取失败：放弃", /读取失败/.test(r3.skipped || "")); }

// 7 其他代（清除前）的账本不碰
{ reset(); oldPages(30, 10); const other = JSON.stringify({ v: 4, epoch: "别代", entries: { z: { xp: 5, runs: 1, firstXp: {}, done: {}, doneOn: {}, lastDay: null, streak: 0, meta: { t: realNow() - 20 * DAY } } } });
  mem["suipian.v4.tab.old1"] = other; compactLedgers(); ok("7 别的代数的账本原样保留", mem["suipian.v4.tab.old1"] === other); }

// 8 loadState 自动触发：键多时打开页面就压缩，进度不变
{ reset(); oldPages(40, 10); const before = seen(), k0 = tabKeys().length; _auto.on = true; loadState(); loadState(); _auto.on = false;
  ok("8 打开页面时自动压缩，视图不变", tabKeys().length < k0 && seen() === before, `${k0} → ${tabKeys().length}`); }

// 9 长期使用模拟：每天 3 次打开 × 365 天，键数保持有界，视图正确
{ reset(); _auto.on = true; let xp = 0, runs = 0;
  for (let day = 365; day > 0; day--) for (let o = 0; o < 3; o++) {
    Date.now = () => realNow() - day * DAY + o * 1000; const p = page();
    if (o === 0) { finish(p, "U1L" + ((day % 8) + 1), 50); } p.hearts = 4; saveState(p);
  }
  Date.now = realNow; const s = JSON.parse(seen());
  ok("9 一年后键数有界（不再线性增长）", tabKeys().length < 80, String(tabKeys().length));
  ok("9 一年后进度正确：8 关 + 每关首次 50 XP 只算一次", s.done.length === 8 && s.runs === 365, JSON.stringify(s)); }
process.exit(fail ? 1 : 0);
