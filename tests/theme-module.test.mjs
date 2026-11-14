// 外观模块 src/theme.js 的单元检查（纯 Node，用假的 document / localStorage / matchMedia）：
// 外观缓存写不进去时，手动选择不能被“系统外观变化”覆盖；useTheme 在选择没变时不重复写缓存。
// 运行：node tests/theme-module.test.mjs
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
let seq = 0;
async function scene({ failWrite = false, cache = {} } = {}) {
  const store = { ...cache }; let writes = 0, listener = null; const media = { matches: false };
  const meta = { v: "", setAttribute(_, v) { this.v = v; } };
  globalThis.document = { documentElement: { dataset: {} }, querySelector: () => meta };
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { writes++; if (failWrite) throw new Error("quota"); store[k] = String(v); },
    removeItem: (k) => { writes++; if (failWrite) throw new Error("denied"); delete store[k]; },
  };
  globalThis.matchMedia = () => ({ get matches() { return media.matches; }, addEventListener: (_, fn) => { listener = fn; } });
  const T = await import("../src/theme.js?scene=" + ++seq);
  const root = document.documentElement;
  return { T, store, root, meta, media, writes: () => writes, systemChanged: (dark) => { media.matches = dark; listener && listener(); } };
}
let s = await scene();
s.T.setTheme("dark"); s.systemChanged(true); s.systemChanged(false);
check("缓存正常：选深色后系统外观来回变，仍是深色", s.root.dataset.theme === "dark" && s.store["suipian-theme"] === "dark");
s = await scene({ failWrite: true });
const saved = s.T.setTheme("dark");
check("缓存写失败：setTheme 返回 false，但 data-theme 已是 dark、顶栏变深", saved === false && s.root.dataset.theme === "dark" && s.meta.v === "#101E28");
s.systemChanged(true); s.systemChanged(false);
check("缓存写失败：系统外观来回变化后，手动选的深色仍在（不被当成“跟随系统”）", s.root.dataset.theme === "dark", JSON.stringify(s.root.dataset));
s = await scene({ failWrite: true, cache: { "suipian-theme": "dark" } });
s.T.setTheme("system"); s.systemChanged(false);
check("缓存里是旧的 dark、但这次选了“跟随系统”且缓存删不掉：以当前选择为准，去掉 data-theme、跟系统", s.root.dataset.theme === undefined && s.meta.v === "#F7F5F0", JSON.stringify(s.root.dataset));
s.systemChanged(true);
check("同上：之后系统变深色，顶栏跟着变深（确实在跟随系统）", s.root.dataset.theme === undefined && s.meta.v === "#101E28", s.meta.v);
s = await scene({ cache: { "suipian-theme": "light" } });
check("页面刚打开：先按缓存套外观（light），避免闪一下系统外观", s.root.dataset.theme === "light");
s.T.useTheme("dark"); const w = s.writes(); s.T.useTheme("dark"); s.T.useTheme("dark");
check("useTheme：选择没变时不重复写缓存", s.writes() === w && s.root.dataset.theme === "dark");
s.T.useTheme("blue");
check("useTheme：乱值当成跟随系统", s.root.dataset.theme === undefined && s.T.getTheme() === "system");
console.log(`\n外观模块：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
