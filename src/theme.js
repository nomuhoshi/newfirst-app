// 外观：跟随系统 / 固定浅色 / 固定深色。选择保存在学习记录的 prefs.theme 里（登录后随账号同步）；
// 这里的 localStorage 只是“上次的外观”缓存，用来在页面一打开就套上，避免先闪一下系统外观。
// 做法：给 <html> 加 data-theme="light"|"dark"（跟随系统时去掉），game.css 里的色值按它切换。
const KEY = "suipian-theme";
const DARK_BAR = "#101E28", LIGHT_BAR = "#F7F5F0"; // 对应 --g-bg，用于浏览器顶栏颜色

// current：本页当前生效的选择（启动时来自 prefs.theme，点按 / 云端 / 切换账号 / 别的标签页改了之后都会更新）。
// 缓存（localStorage）可能写不进去（无痕 / 配额）或被别处改过，所以“是否跟随系统”的判断以 current 为准，缓存只用来在页面刚打开时先套一个外观。
let current = null;
const norm = (v) => (v === "light" || v === "dark" ? v : "system");
export function getTheme() {
  if (current) return current;
  try { return norm(localStorage.getItem(KEY)); } catch { return "system"; }
}
function systemDark() { try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } }

export function applyTheme(v = getTheme()) {
  const root = document.documentElement;
  if (v === "light" || v === "dark") root.dataset.theme = v; else delete root.dataset.theme;
  const dark = v === "dark" || (v !== "light" && systemDark());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? DARK_BAR : LIGHT_BAR);
}

// 按 prefs.theme 套用外观（启动、云端带来新设置、切换账号后都走这里），并更新缓存
// 选择没变时什么都不做（不重复写缓存）；变了才套用。
export function useTheme(v) { const t = norm(v); return t === current ? true : setTheme(t); }

// 返回缓存是否写成功（写不成功只影响“页面一打开先显示哪个外观”，不影响已保存的选择）
export function setTheme(v) {
  const t = norm(v);
  current = t;
  let saved = true;
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { saved = false; }
  applyTheme(t);
  return saved;
}

applyTheme();
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (getTheme() === "system") applyTheme("system"); }); } catch { /* 老浏览器：跟随系统时不实时更新顶栏颜色 */ }
