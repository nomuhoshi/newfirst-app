// B 只读测量：本机存储 v4 账本的增长。纯模拟（内存里的假 localStorage），不碰任何真实用户存档，不启用压缩，不删任何键。
// 运行：node scripts/measure-ledger-growth.mjs [--json]
// 量的东西：键数、序列化体积（字符数；localStorage 配额按字符计，约 5M）、完整读取耗时（loadState 一次扫描全部账本合并）、写满后的行为。
// 注意：耗时是 Node 里 JS 解析 + 合并的耗时，没有包含真机 localStorage 逐键读取的开销（手机上更慢），只能看“随键数增长的趋势”。
const mem = new Map(); let quota = Infinity, total = 0, keyCache = null;
const used = () => total;
globalThis.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => { v = String(v); const old = mem.has(k) ? k.length + mem.get(k).length : 0; if (total - old + k.length + v.length > quota) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } if (!mem.has(k)) keyCache = null; total += k.length + v.length - old; mem.set(k, v); },
  removeItem: (k) => { if (mem.has(k)) { total -= k.length + mem.get(k).length; mem.delete(k); keyCache = null; } },
  key: (i) => (keyCache ??= [...mem.keys()])[i] ?? null, get length() { return mem.size; },
};
const SRC = (process.argv.find((a) => a.startsWith("--src=")) || "--src=../src/storage.js").slice(6); // --src=<路径>：对比优化前后时指向旧版 storage.js
const { loadState, saveState, addXp, addRun, _asTab, _auto, readSnapshot, freshState } = await import(SRC);
_auto.on = false; // 不压缩
const DAY = 86400000, realNow = Date.now.bind(Date), t0 = realNow();
const LESSONS = Array.from({ length: 34 }, (_, i) => "U" + (1 + Math.floor(i / 7)) + "L" + ((i % 7) + 1));
const keysOf = () => [...mem.keys()].filter((k) => k.includes(".tab."));
const reset = () => { mem.clear(); total = 0; keyCache = null; quota = Infinity; Date.now = realNow; };
const ms = (f, n = 15) => { const a = performance.now(); for (let i = 0; i < n; i++) f(); return (performance.now() - a) / n; };

// 一个模拟用户：每天 opens 次打开页面（每次新页面 id），每次打开保存一次（最坏情形：每次打开都写自己的账本）；
// tabs>1 时每次打开同时开 tabs 个页面交替保存；learnEvery 天里完成一关（前 34 关首次，之后重复刷）。
// mode：nochange = 前 34 天每天学一关，之后只是打开（无任何变化）；meta = 同上，但每次打开红心都变（最坏情形，旧脚本的口径）；learn = 每天都真实学习（复习），红心不变。
function simulate({ days, opens, tabs = 1, learnEvery = 1, checkpoints, quotaChars = Infinity, mode = "meta" }) {
  reset(); quota = quotaChars; const out = []; let lessonIdx = 0, id = 0, fullAt = null, refused = 0;
  for (let d = 1; d <= days; d++) {
    Date.now = () => t0 + d * DAY;
    for (let o = 0; o < opens; o++) {
      const pages = []; for (let t = 0; t < tabs; t++) pages.push(_asTab(id === 0 ? loadState().state : freshState(), "s" + ++id));
      for (const p of pages) {
        if (o === 0 && d % learnEvery === 0 && (mode === "learn" || d <= LESSONS.length)) { const l = LESSONS[lessonIdx % LESSONS.length]; const first = lessonIdx < LESSONS.length; lessonIdx++; addXp(p, 50, l, first); p.done[l] = true; addRun(p); p.lastDay = new Date(t0 + d * DAY).toISOString().slice(0, 10); p.streak = Math.max(1, p.streak); }
        if (mode === "meta") p.hearts = Math.max(0, Math.min(5, p.hearts + (o % 2 ? -1 : 1)));
        if (!saveState(p)) { refused++; if (fullAt === null) fullAt = d; }
      }
    }
    if (checkpoints?.includes(d)) {
      const keys = keysOf(), chars = used();
      const s0 = loadState().state; const load = ms(() => loadState()), snap = ms(() => readSnapshot(s0));
      out.push({ day: d, tabKeys: keys.length, kChars: Math.round(chars / 1000), loadMs: +load.toFixed(2), snapshotMs: +snap.toFixed(2) });
    }
  }
  return { out, fullAt, refused, final: (() => { const s = loadState().state; return { xp: s.xp, done: Object.keys(s.done).length, runs: s.lessonsCompleted }; })() };
}
const MODES = process.argv.includes("--modes");
const scenarios = MODES ? [
  { name: "无变化：每天打开 3 次、单标签(34天后不学)", days: 365, opens: 3, tabs: 1, mode: "nochange" },
  { name: "仅 meta 变化：每次打开红心都变", days: 365, opens: 3, tabs: 1, mode: "meta" },
  { name: "真实学习：每天学 1 关(复习)、每天打开 3 次", days: 365, opens: 3, tabs: 1, mode: "learn" },
  { name: "无变化·2 标签", days: 365, opens: 3, tabs: 2, mode: "nochange" },
  { name: "无变化·高频刷新每天 20 次", days: 90, opens: 20, tabs: 1, mode: "nochange" },
] : [
  { name: "普通：每天打开 3 次、单标签", days: 365, opens: 3, tabs: 1 },
  { name: "多标签：每天打开 3 次、每次 2 个标签", days: 365, opens: 3, tabs: 2 },
  { name: "高频刷新：每天 20 次", days: 90, opens: 20, tabs: 1 }, // 365 天要模拟 7300 个页面，O(n²) 太慢；只量到 90 天，之后按每键平均字符数外推
];
const res = {};
for (const s of scenarios) res[s.name] = simulate({ ...s, checkpoints: [30, 90, 365].filter((d) => d <= s.days) });
// 写满的行为：用小配额（300,000 字符）快速写满，看保存失败后的表现；再按每键平均字符数外推到 5,000,000
const perKey = MODES ? 306 : (() => { const r = res["普通：每天打开 3 次、单标签"].out.at(-1); return Math.round((r.kChars * 1000) / r.tabKeys); })();
const fullRun = (() => { reset(); const r = simulate({ days: 400, opens: 20, tabs: 1, quotaChars: 300_000 }); const s = loadState().state; return { quotaChars: 300000, fullAtDay: r.fullAt, refusedSaves: r.refused, keys: keysOf().length, kChars: Math.round(used() / 1000), 写满后仍可读取: { xp: s.xp, done: Object.keys(s.done).length, runs: s.lessonsCompleted } }; })();
const extrapolate = { 平均每个账本键字符数: perKey, 配额5M可容纳键数: Math.floor(5_000_000 / perKey), 每天3次写满约需年: +(5_000_000 / perKey / 3 / 365).toFixed(1), 每天20次写满约需年: +(5_000_000 / perKey / 20 / 365).toFixed(1), 每天3次每次2标签写满约需年: +(5_000_000 / perKey / 6 / 365).toFixed(1) };
if (process.argv.includes("--json")) console.log(JSON.stringify({ res, fullRun, extrapolate }, null, 1));
else {
  console.log("| 场景 | 天数 | 账本键数 | 体积(千字符) | 完整读取 loadState(ms) | readSnapshot(ms) |\n|---|---|---|---|---|---|");
  for (const [n, r] of Object.entries(res)) for (const c of r.out) console.log(`| ${n} | ${c.day} | ${c.tabKeys} | ${c.kChars} | ${c.loadMs} | ${c.snapshotMs} |`);
  console.log("\n写满行为（小配额模拟）：", JSON.stringify(fullRun));
  console.log("外推到 5,000,000 字符：", JSON.stringify(extrapolate));
}
