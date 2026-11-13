// 外观设置进账号同步的数据层检查（不需要浏览器）：prefs.theme 的整理、新旧文档、同步进文档、从文档还原。
import * as D from "../src/account-data.js";
import { freshState } from "../src/storage.js";
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };

check("normPrefs：缺 theme → system；不认识的值 → system；light/dark 保留", D.normPrefs({}).theme === "system" && D.normPrefs({ theme: "blue" }).theme === "system" && D.normPrefs({ theme: "light" }).theme === "light" && D.normPrefs({ theme: "dark" }).theme === "dark");
check("normPrefs：键的顺序固定，其余设置照旧", JSON.stringify(D.normPrefs({ sound: false, theme: "dark", soundStyle: "C" })) === '{"sound":false,"haptics":true,"soundStyle":"C","theme":"dark"}');
check("空文档的 prefs 里有 theme:system", D.emptyDoc().prefs.theme === "system");
check("新本机状态默认 theme:system", freshState().prefs.theme === "system");

const old = D.emptyDoc(); delete old.prefs.theme;
const n = D.normalizeDoc(old);
check("老云端文档（没有 theme）能读：补 system，文档仍然有效", n.ok && n.doc.prefs.theme === "system");
const bad = D.normalizeDoc({ ...D.emptyDoc(), prefs: { sound: true, haptics: true, soundStyle: "J", theme: "<script>" } });
check("云端 theme 是乱值 → 当成 system，不报错", bad.ok && bad.doc.prefs.theme === "system");

const st = { ...D.docToState(D.emptyDoc(), null, 1_800_000_000_000) };
st.prefs = { ...st.prefs, theme: "dark" };
const r = D.syncStateIntoDoc(D.emptyDoc(), st, { deviceId: "devA", today: "2026-11-13", now: 1_800_000_000_000 });
check("本机改了外观 → 写进文档，并标记设置有改动（会被同步）", r.doc.prefs.theme === "dark" && r.changed.prefs === true);
const r2 = D.syncStateIntoDoc(r.doc, st, { deviceId: "devA", today: "2026-11-13", now: 1_800_000_000_000 });
check("外观没变 → 不标记设置有改动", r2.changed.prefs === false);
check("从云端文档还原：本机外观跟着变成 dark", D.docToState(r.doc, null, 1_800_000_000_000).prefs.theme === "dark");

const L = D.emptyDoc({ lineage: "L1" }), R = { ...L, gen: L.gen, prefs: { ...L.prefs, theme: "light" } };
const m = D.mergeDocs({ ...L, prefs: { ...L.prefs, theme: "dark" } }, R, { localPrefsDirty: true });
check("两台设备外观不同：本机改过 → 用本机的", m.doc && m.doc.prefs.theme === "dark", JSON.stringify(m.doc?.prefs));
const m2 = D.mergeDocs({ ...L, prefs: { ...L.prefs, theme: "dark" } }, R, { localPrefsDirty: false });
check("两台设备外观不同：本机没改过 → 用云端的", m2.doc && m2.doc.prefs.theme === "light", JSON.stringify(m2.doc?.prefs));

console.log(`\n外观设置同步：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
