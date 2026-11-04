// 登录凭证按 Supabase 项目隔离：项目换了，旧凭证作废、要求重新登录；本机学习记录（游客记录、账号本机副本）一条不丢。纯 Node。
import { createSync, AUTH_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
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
const view = (st, proj) => scopedStorage(st, projectNamespace(proj, PROD)); // 测试里“从某个项目的视角”读写同一份浏览器存储
function seed(raw, auth, proj = PROD) {
  const storage = view(raw, proj);
  const doc = emptyDoc({ gen: 1, lineage: "L1" }); doc.xp.devA = 40; doc.done = { U1L1: 1 };
  saveAccount(storage, "u1", { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: clock });
  setCurrentAccount(storage, "u1");
  if (auth) storage.setItem(AUTH_KEY, JSON.stringify(auth));
  return doc;
}
const mk = (storage, projectId) => createSync({ storage, api, projectId, legacyProject: PROD, now: () => clock, today: () => "2026-11-04", schedule: () => 0 });
const snap = (st) => JSON.stringify([...st.mem.entries()].sort());
const copyOf = (st, proj, uid = "u1") => loadAccount(view(st, proj), uid, { now: clock }).copy;

{ // 正式入口：没记项目的旧凭证照常有效
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, PROD); const r = s.restore(freshState());
  check("正式入口：没记项目的旧凭证照常有效（朋友们不会被退出登录）", r && s.status().status === "pending" && st.getItem(AUTH_KEY) !== null);
}
{ // 测试库入口看不到正式版的账号数据：登录凭证、当前账号、本机副本分开存
  const st = mkStorage(); seed(st, { session: sess });
  const before = snap(st);
  const s = mk(st, TEST); const r = s.restore(freshState());
  check("测试库入口：看不到正式版的当前账号和登录凭证，是游客状态", r === null && s.account() === null && s.status().status === null);
  check("正式版的账号键（当前账号、本机副本、登录凭证）一个字没变", snap(st) === before);
  const t = view(st, TEST); t.setItem("suipian.probe", "x"); // 非账号键不分项目（游客记录、设备编号共用）
  check("游客记录、设备编号这类键不分项目（共用同一个键）", st.getItem("suipian.probe") === "x");
  check("账号键在测试库里带项目前缀", projectNamespace(TEST, PROD) === `proj:${TEST}:` && projectNamespace(PROD, PROD) === "" && projectNamespace("cloud-off", PROD) === "");
}
{ // 测试库自己的凭证：在测试库入口有效；换到正式入口看不到
  const st = mkStorage(); seed(st, { session: sess, project: TEST }, TEST);
  const a = mk(st, TEST); a.restore(freshState());
  check("记着测试项目的凭证在测试库入口有效", a.status().status === "pending" && view(st, TEST).getItem(AUTH_KEY) !== null);
  const b = mk(st, PROD); const rb = b.restore(freshState());
  check("同一份存储拿到正式入口：看不到测试库的账号和凭证", rb === null && b.account() === null);
}
{ // 同一个命名空间里，凭证记的项目对不上：作废，本机副本保留
  const st = mkStorage(); seed(st, { session: sess, project: "OTHER.supabase.co" });
  const s = mk(st, PROD); s.restore(freshState());
  check("项目标记对不上：作废并要求重新登录", s.status().status === "need-login" && st.getItem(AUTH_KEY) === null);
  check("作废后本机学习记录原样保留", copyOf(st, PROD).doc.xp.devA === 40);
}
{ // 云端关闭（沿用正式版的键）：不能带着正式库的凭证
  const st = mkStorage(); seed(st, { session: sess });
  const s = mk(st, "cloud-off"); s.restore(freshState());
  check("云端关闭的入口：旧凭证作废，本机记录保留", st.getItem(AUTH_KEY) === null && copyOf(st, PROD).doc.xp.devA === 40);
}
{ // 游客记录不受影响
  const st = mkStorage(); const g = JSON.stringify({ ...freshState(), xp: 77, done: { U1L1: true } });
  st.setItem(GUEST_KEY, g); st.setItem(AUTH_KEY, JSON.stringify({ session: sess }));
  for (const proj of [TEST, PROD, "cloud-off"]) { const s = mk(st, proj); s.restore(freshState()); }
  check("游客记录原文不变", st.getItem(GUEST_KEY) === g);
}
{ // 写凭证时带项目标记
  const src = (await import("node:fs")).readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
  check("写凭证时带项目标记（源码约定）", /JSON\.stringify\(projectId \? \{ session, project: projectId \}/.test(src));
}
const pass = results.filter(Boolean).length;
console.log(`\n凭证和账号副本按项目分开：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
