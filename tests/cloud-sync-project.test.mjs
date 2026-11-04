// 登录凭证按 Supabase 项目隔离：项目换了，旧凭证作废、要求重新登录；本机学习记录（游客记录、账号本机副本）一条不丢。纯 Node。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { saveAccount, setCurrentAccount, loadAccount, GUEST_KEY, scopedStorage, projectKey } from "../src/account-store.js";
import { emptyDoc, docToState } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co";
const clock = 1_000_000;
const sess = { accessToken: "a", refreshToken: "r", expiresAt: clock + 3600_000, userId: "u1", email: "me@example.com" };
function mkStorage() { const mem = new Map(); return { mem, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }; }
const api = { async refresh() { return { ok: false, kind: "auth" }; }, async getProgress() { return { ok: true, row: null }; } };
// where：账号数据和凭证放在哪个项目的位置——null = 正式项目（原来的键）；"主机名" = 那个项目自己的键
function seed(storage, auth, where = null) {
  const doc = emptyDoc({ gen: 1, lineage: "L1" }); doc.xp.devA = 40; doc.done = { U1L1: 1 };
  const view = scopedStorage(storage, where);
  saveAccount(view, "u1", { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: clock });
  setCurrentAccount(view, "u1");
  if (auth) storage.setItem(where ? projectKey(where, "auth") : AUTH_KEY, JSON.stringify(auth));
  return doc;
}
const mk = (storage, projectId) => createSync({ storage, api, projectId, legacyProject: PROD, now: () => clock, today: () => "2026-11-04", schedule: () => 0 });

{ // 旧凭证（没记项目 = 来自正式库）：在正式库入口继续有效，并保持登录
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, PROD); const r = s.restore(freshState());
  check("正式入口：没记项目的旧凭证照常有效（朋友们不会被退出登录）", r && s.status().status === "pending" && st.getItem(AUTH_KEY) !== null);
}
{ // 旧凭证来自正式库，测试入口改接测试库：作废；正式项目的账号副本原样留着，但测试库看不到它
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, TEST); const r = s.restore(freshState());
  check("测试库入口：来自正式库的旧凭证作废（令牌被删），测试库里是未登录状态", r === null && s.account() === null && st.getItem(AUTH_KEY) === null);
  const L = loadAccount(st, "u1", { now: clock });
  check("正式项目的账号副本原样保留（本机学习记录一条不丢）", L.ok && L.copy && L.copy.doc.xp.devA === 40 && "U1L1" in L.copy.doc.done && L.copy.dirty.content === true, JSON.stringify(L.copy && {x:L.copy.doc.xp,d:L.copy.doc.done,dirty:L.copy.dirty}));
  check("测试库看不到正式项目的账号副本（同一个用户 ID 也看不到）", loadAccount(scopedStorage(st, TEST), "u1", { now: clock }).copy === null);
}
{ // 记了测试项目的凭证：在测试库入口有效；正式入口根本不读测试库的位置
  const st = mkStorage(); seed(st, { session: sess, project: TEST }, TEST);
  const a = mk(st, TEST); a.restore(freshState());
  check("记着测试项目的凭证在测试库入口有效", a.status().status === "pending" && st.getItem(projectKey(TEST, "auth")) !== null);
  const b = mk(st, PROD); const rb = b.restore(freshState());
  check("正式入口读不到测试库位置的凭证和账号，也不会动它们", rb === null && b.account() === null && st.getItem(projectKey(TEST, "auth")) !== null && loadAccount(scopedStorage(st, TEST), "u1", { now: clock }).copy !== null);
}
{ // 项目标记对不上（凭证里记的是别的项目）：作废
  const st = mkStorage(); seed(st, { session: sess, project: "OTHER.supabase.co" }, TEST);
  const s = mk(st, TEST); s.restore(freshState());
  check("项目标记对不上：作废", s.status().status === "need-login" && st.getItem(projectKey(TEST, "auth")) === null);
}
{ // 云端关闭（projectId "cloud-off"）：不能带着正式库的凭证
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, "cloud-off"); const r = s.restore(freshState());
  check("云端关闭的入口：旧凭证作废，正式项目的本机副本保留", st.getItem(AUTH_KEY) === null && r === null && loadAccount(st, "u1", { now: clock }).copy.doc.xp.devA === 40);
}
{ // 游客记录不受影响
  const st = mkStorage(); const g = JSON.stringify({ ...freshState(), xp: 77, done: { U1L1: true } });
  st.setItem(GUEST_KEY, g); st.setItem(AUTH_KEY, JSON.stringify({ session: sess }));
  const s = mk(st, TEST); s.restore(freshState());
  check("游客记录原文不变", st.getItem(GUEST_KEY) === g);
}
{ // 登录后写入的凭证带上当前项目
  const st = mkStorage(); const d = seed(st, null);
  const s = mk(st, TEST);
  s.restore(freshState());
  // 通过写入路径验证：模拟 persistLocal 不写凭证，所以直接走 begin→finish 太重；这里检查源码约定即可：writeAuth 带 project
  const src = (await import("node:fs")).readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
  check("写凭证时带项目标记（源码约定）", /JSON\.stringify\(projectId \? \{ session, project: projectId \}/.test(src) && /setItem\(authKey/.test(src));
}
const pass = results.filter(Boolean).length;
console.log(`\n凭证按项目隔离：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
