// 外观：跟随系统 / 固定浅色 / 固定深色。只存在这台设备上（localStorage），不进账号同步、不进学习记录。
// 做法：给 <html> 加 data-theme="light"|"dark"（跟随系统时去掉），game.css 里的色值按它切换。
const KEY = "suipian-theme";
const DARK_BAR = "#101E28", LIGHT_BAR = "#F7F5F0"; // 对应 --g-bg，用于浏览器顶栏颜色

export function getTheme() {
  try { const v = localStorage.getItem(KEY); return v === "light" || v === "dark" ? v : "system"; } catch { return "system"; }
}
function systemDark() { try { return matchMedia("(prefers-color-scheme: dark)").matches; } catch { return false; } }

export function applyTheme(v = getTheme()) {
  const root = document.documentElement;
  if (v === "light" || v === "dark") root.dataset.theme = v; else delete root.dataset.theme;
  const dark = v === "dark" || (v !== "light" && systemDark());
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? DARK_BAR : LIGHT_BAR);
}

// 返回是否真的存下了（存储被禁用时这次切换仍然生效，但下次打开会回到“跟随系统”）
export function setTheme(v) {
  const t = v === "light" || v === "dark" ? v : "system";
  let saved = true;
  try { if (t === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, t); } catch { saved = false; }
  applyTheme(t);
  return saved;
}

applyTheme();
try { matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (getTheme() === "system") applyTheme("system"); }); } catch { /* 老浏览器：跟随系统时不实时更新顶栏颜色 */ }
