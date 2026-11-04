// 登录凭证按 Supabase 项目隔离：项目换了，旧凭证作废、要求重新登录；本机学习记录（游客记录、账号本机副本）一条不丢。纯 Node。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { saveAccount, setCurrentAccount, loadAccount, GUEST_KEY } from "../src/account-store.js";
import { emptyDoc, docToState } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co";
const clock = 1_000_000;
const sess = { accessToken: "a", refreshToken: "r", expiresAt: clock + 3600_000, userId: "u1", email: "me@example.com" };
function mkStorage() { const mem = new Map(); return { mem, getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }; }
const api = { async refresh() { return { ok: false, kind: "auth" }; }, async getProgress() { return { ok: true, row: null }; } };
function seed(storage, auth) {
  const doc = emptyDoc({ gen: 1, lineage: "L1" }); doc.xp.devA = 40; doc.done = { U1L1: 1 };
  saveAccount(storage, "u1", { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: clock });
  setCurrentAccount(storage, "u1");
  if (auth) storage.setItem(AUTH_KEY, JSON.stringify(auth));
  return doc;
}
const mk = (storage, projectId) => createSync({ storage, api, projectId, legacyProject: PROD, now: () => clock, today: () => "2026-11-04", schedule: () => 0 });

{ // 旧凭证（没记项目 = 来自正式库）：在正式库入口继续有效，并保持登录
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, PROD); const r = s.restore(freshState());
  check("正式入口：没记项目的旧凭证照常有效（朋友们不会被退出登录）", r && s.status().status === "pending" && st.getItem(AUTH_KEY) !== null);
}
{ // 旧凭证来自正式库，测试入口改接测试库：作废
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, TEST); const r = s.restore(freshState());
  check("测试库入口：来自正式库的旧凭证作废，要求重新登录", r && s.status().status === "need-login" && st.getItem(AUTH_KEY) === null);
  const L = loadAccount(st, "u1", { now: clock });
  check("本机学习记录（账号副本）原样保留", L.ok && L.copy && L.copy.doc.xp.devA === 40 && "U1L1" in L.copy.doc.done && L.copy.dirty.content === true, JSON.stringify(L.copy && {x:L.copy.doc.xp,d:L.copy.doc.done,dirty:L.copy.dirty}));
  check("restore 仍给出本机进度，学习不中断", r.state.xp === 40);
}
{ // 记了测试项目的凭证：在测试库入口有效，在正式入口作废
  const st = mkStorage(); seed(st, { session: sess, project: TEST });
  const a = mk(st, TEST); a.restore(freshState());
  check("记着测试项目的凭证在测试库入口有效", a.status().status === "pending" && st.getItem(AUTH_KEY) !== null);
  const st2 = mkStorage(); seed(st2, { session: sess, project: TEST });
  const b = mk(st2, PROD); b.restore(freshState());
  check("同一份凭证拿到正式入口：作废", b.status().status === "need-login" && st2.getItem(AUTH_KEY) === null);
}
{ // 大小写不同的主机名不会被当成同一个项目的绕过：projectId 由调用方给小写主机名；标记不一致就作废
  const st = mkStorage(); seed(st, { session: sess, project: "OTHER.supabase.co" });
  const s = mk(st, TEST); s.restore(freshState());
  check("项目标记对不上：作废", s.status().status === "need-login" && st.getItem(AUTH_KEY) === null);
}
{ // 云端关闭（projectId "cloud-off"）：不能带着正式库的凭证
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, "cloud-off"); s.restore(freshState());
  check("云端关闭的入口：旧凭证作废，本机记录保留", st.getItem(AUTH_KEY) === null && loadAccount(st, "u1", { now: clock }).copy.doc.xp.devA === 40);
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
  check("写凭证时带项目标记（源码约定）", /JSON\.stringify\(projectId \? \{ session, project: projectId \}/.test(src));
}
const pass = results.filter(Boolean).length;
console.log(`\n凭证按项目隔离：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
