// 登录 / 云存档 / 离线保存 / 跨设备同步的专项回归测试（纯 Node，不联网、不连任何 Supabase 项目）。
// 覆盖：项目隔离、不同邮箱、离线 XP 只上传一次、强制退出后继续上传、坏凭证不联网、
//       云端关闭零请求、测试配置拒绝正式项目伪装网址、旧存档升级、游客记录导入后又有新进度。
// 运行：node tests/login-sync-hardening.test.mjs
import { readFileSync } from "node:fs";
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { saveAccount, setCurrentAccount, loadAccount, getCurrentAccount, GUEST_KEY, getGuestId, DEVICE_KEY } from "../src/account-store.js";
import { emptyDoc, docToState, sumXp, guestToDoc, guestFingerprint, guestImportStatus, replaceWithGuest, normalizeDoc, mergeDocs, docsEquivalent } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const clone = (x) => JSON.parse(JSON.stringify(x));
const NOW = 1_000_000;
const TODAY = "2026-11-04";
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co";
const TEST = "abcdefgh.supabase.co";
const sess = (userId = "u1", email = "a@example.com", tag = "at", expiresAt = NOW + 3600_000) => ({
  accessToken: tag, refreshToken: "rt-" + tag, expiresAt, userId, email,
});
function mem() {
  const m = new Map();
  return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
function seedAccount(storage, userId, xp = 40) {
  const doc = emptyDoc({ gen: 1, lineage: "L-" + userId });
  doc.xp.devA = xp;
  doc.runs.devA = 2;
  doc.done = { U1L1: "2026-11-01" };
  doc.days = ["2026-11-01"];
  saveAccount(storage, userId, { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: NOW });
  setCurrentAccount(storage, userId);
  return doc;
}
function makeSync(storage, api, opts = {}) {
  return createSync({ storage, api, projectId: PROD, legacyProject: PROD, now: () => NOW, today: () => TODAY, schedule: () => 0, ...opts });
}
function noNetApi() {
  const calls = [];
  return {
    calls,
    async refresh() { calls.push("refresh"); return { ok: false, kind: "auth", message: "登录已失效" }; },
    async getProgress() { calls.push("getProgress"); return { ok: false, kind: "network", message: "断网" }; },
    async createProgress() { calls.push("createProgress"); return { ok: false, kind: "network", message: "断网" }; },
    async saveProgress() { calls.push("saveProgress"); return { ok: false, kind: "network", message: "断网" }; },
    async signOut() { calls.push("signOut"); return { ok: true }; },
  };
}
function fakeCloud() {
  const users = new Map(), rows = new Map(), tokens = new Map(), calls = [];
  let seq = 0;
  const state = { online: true };
  const net = { ok: false, kind: "network", message: "网络连不上" };
  const authErr = { ok: false, kind: "auth", message: "登录已失效" };
  const issue = (uid, email) => {
    const at = "at-" + (++seq), rt = "rt-" + seq;
    tokens.set(at, uid); tokens.set(rt, uid);
    return { accessToken: at, refreshToken: rt, expiresAt: NOW + 3600_000, userId: uid, email };
  };
  const uidOf = (s) => tokens.get(s?.accessToken);
  const api = {
    calls, state, users, rows, tokens,
    async sendCode(email) { calls.push(["sendCode", email]); return state.online ? { ok: true } : net; },
    async verifyCode(email, code) {
      calls.push(["verifyCode", email]);
      if (!state.online) return net;
      if (code !== "123456") return authErr;
      let uid = users.get(email);
      if (!uid) {
        do { uid = "u" + (++seq); } while ([...users.values()].includes(uid));
        users.set(email, uid);
      }
      return { ok: true, session: issue(uid, email) };
    },
    async refresh(s) {
      calls.push(["refresh", s?.refreshToken]);
      if (!state.online) return net;
      const uid = tokens.get(s?.refreshToken);
      return uid ? { ok: true, session: issue(uid, s.email) } : authErr;
    },
    async signOut() { calls.push(["signOut"]); return { ok: true }; },
    async getProgress(s) {
      calls.push(["getProgress", s?.accessToken]);
      if (!state.online) return net;
      const uid = uidOf(s); if (!uid) return authErr;
      const r = rows.get(uid);
      return { ok: true, row: r ? clone(r) : null };
    },
    async createProgress(s, doc) {
      calls.push(["createProgress"]);
      if (!state.online) return net;
      const uid = uidOf(s); if (!uid) return authErr;
      if (rows.has(uid)) return { ok: true, rev: null };
      rows.set(uid, { doc: clone(doc), rev: 1 });
      return { ok: true, rev: 1 };
    },
    async saveProgress(s, expected, doc) {
      calls.push(["saveProgress", expected]);
      if (!state.online) return net;
      const uid = uidOf(s); if (!uid) return authErr;
      const r = rows.get(uid);
      if (!r || r.rev !== expected) return { ok: true, rev: null };
      r.doc = clone(doc); r.rev++;
      return { ok: true, rev: r.rev };
    },
    async deleteAccount(s) {
      calls.push(["deleteAccount"]);
      if (!state.online) return net;
      const uid = uidOf(s); if (!uid) return authErr;
      rows.delete(uid);
      for (const [email, id] of users) if (id === uid) users.delete(email);
      return { ok: true };
    },
  };
  return api;
}
async function login(sync, email, state = freshState(), choice = null) {
  const v = await sync.verify(email, "123456", state);
  if (!v.ok) return v;
  const r = v.needChoice ? await sync.finishChoice(choice) : v;
  return r;
}
function learn(dev, id, xp = 20) {
  const s = dev.state;
  s.xp += xp; s.done[id] = true; s.lessonsCompleted++; s.streak = 1; s.lastDay = TODAY;
  return dev.sync.persistLocal(s);
}
const rowOf = (cloud, email) => cloud.rows.get(cloud.users.get(email));
const xpOf = (cloud, email) => sumXp(rowOf(cloud, email).doc);

// ======================================================================
// A. 测试入口配置：正式项目网址及伪装写法一律拒绝
// ======================================================================
let cfgCase = 0;
async function loadCloud({ id, test, loc, ls } = {}) {
  for (const k of ["__PREVIEW_ID__", "__TEST_CLOUD__", "location", "localStorage"]) delete globalThis[k];
  if (id !== undefined) globalThis.__PREVIEW_ID__ = id;
  if (test !== undefined) globalThis.__TEST_CLOUD__ = test;
  if (loc) globalThis.location = { hostname: loc };
  if (ls !== undefined) globalThis.localStorage = { getItem: () => ls };
  return (await import(`../src/cloud-config.js?hardening=${++cfgCase}`)).CLOUD;
}
const DISGUISED = [
  ["正式网址原样", "https://aqlcunkmggzzvyavlkjg.supabase.co"],
  ["主机名末尾多一个点", "https://aqlcunkmggzzvyavlkjg.supabase.co./"],
  ["全角字符主机名", "https://ａｑｌｃｕｎｋｍｇｇｚｚｖｙａｖｌｋｊｇ.supabase.co"],
  ["百分号编码的点", "https://aqlcunkmggzzvyavlkjg%2esupabase.co"],
  ["大写协议 + 反斜杠", "HTTPS:\\\\aqlcunkmggzzvyavlkjg.supabase.co"],
  ["项目编号当子域名前缀", "https://aqlcunkmggzzvyavlkjg.evil.example"],
  ["项目编号嵌在别的主机名里", "https://x-aqlcunkmggzzvyavlkjg-y.example.com"],
  ["javascript: 网址", "javascript:alert(1)"],
  ["data: 网址", "data:text/plain,aqlcunkmggzzvyavlkjg"],
  ["协议相对网址", "//aqlcunkmggzzvyavlkjg.supabase.co"],
  ["只有空白", "   "],
];
for (const [label, url] of DISGUISED) {
  const c = await loadCloud({ id: "rc1", test: { url, anonKey: "x" } });
  check(`测试构建配置填「${label}」：被拒绝，云端关闭`, c.url === "" && c.anonKey === "", JSON.stringify(c));
}
{
  const c = await loadCloud({ id: "rc1", test: { url: "https://abcdefgh.supabase.co", anonKey: "k" } });
  check("对照：合法的独立测试项目照常放行", c.url === "https://abcdefgh.supabase.co" && c.anonKey === "k");
  const p = await loadCloud({ id: "", test: { url: "https://abcdefgh.supabase.co", anonKey: "k" } });
  check("对照：正式构建忽略测试配置，仍是正式项目", p.url.includes(PROD));
}
for (const host of ["localhost", "127.0.0.1"]) {
  for (const [label, url] of DISGUISED) {
    const c = await loadCloud({ id: "rc1", loc: host, ls: JSON.stringify({ url, anonKey: "x" }) });
    check(`测试构建 + ${host} 浏览器设置「${label}」：被拒绝，云端关闭`, c.url === "" && c.anonKey === "", JSON.stringify(c));
  }
  const okTest = await loadCloud({ id: "rc1", loc: host, ls: JSON.stringify({ url: "https://abcdefgh.supabase.co", anonKey: " k " }) });
  check(`对照：${host} 浏览器设置写独立测试项目：照常使用`, okTest.url === "https://abcdefgh.supabase.co" && okTest.anonKey === "k");
  const okLocal = await loadCloud({ id: "rc1", loc: host, ls: JSON.stringify({ url: "http://localhost:54321", anonKey: "x" }) });
  check(`对照：${host} 浏览器设置写本机假服务器：照常使用`, okLocal.url === "http://localhost:54321");
  const broken = await loadCloud({ id: "rc1", loc: host, ls: "{not json" });
  check(`对照：${host} 浏览器设置损坏：不抛错，按没有测试项目处理`, broken.url === "" && broken.anonKey === "");
}
{
  const c = await loadCloud({ id: "", loc: "localhost", ls: JSON.stringify({ url: "https://aqlcunkmggzzvyavlkjg.supabase.co", anonKey: "x" }) });
  check("对照：正式构建 + localhost 覆盖写正式网址：不受影响（本来就是正式项目）", c.url.includes(PROD));
  const online = await loadCloud({ id: "", loc: "localhost.evil.example", ls: JSON.stringify({ url: "https://evil.example", anonKey: "x" }) });
  check("对照：主机名只是以 localhost 开头不算本机，覆盖无效", online.url.includes(PROD));
}
for (const k of ["__PREVIEW_ID__", "__TEST_CLOUD__", "location", "localStorage"]) delete globalThis[k];

// ======================================================================
// B. 旧存档升级：关卡 / XP / 日期 / 设置 / 账号归属不变
// ======================================================================
{
  const FIXTURE_NOW = 1_793_600_000_000;
  const local = JSON.parse(readFileSync(new URL("./fixtures/local-v3-progress.json", import.meta.url), "utf8"));
  const g = guestToDoc(local, { deviceId: "devGuest", guestId: "G1abc", now: FIXTURE_NOW });
  check("旧 v3 游客记录能升级成账号文档", g.ok && g.doc.schema === 1);
  check("升级后 XP / 完成次数不变（190 XP、11 次）", g.ok && sumXp(g.doc) === 190 && g.doc.runs.devGuest === 11);
  check("升级后完成的关卡一个不少（8 关）", g.ok && Object.keys(g.doc.done).length === 8 && g.doc.done.U1L1 === "" && g.doc.done.U2L2 === "");
  const days = g.ok ? g.doc.days : [];
  check("升级后学习日期不变：2026-10-30 到 2026-11-02 连续 4 天", days.join() === "2026-10-30,2026-10-31,2026-11-01,2026-11-02");
  check("升级后红心 / 设置不变（3 颗、音效 C、振动关）", g.ok && g.doc.hearts.n === 3 && g.doc.prefs.soundStyle === "C" && g.doc.prefs.haptics === false);
  const s = g.ok ? docToState(g.doc, null, FIXTURE_NOW) : freshState();
  check("账号状态转回本机：XP 190、连续 4 天、最后一天 11-02、8 关", s.xp === 190 && s.streak === 4 && s.lastDay === "2026-11-02" && Object.keys(s.done).length === 8);
  const st = mem();
  check("保存到账号 u1 后，u1 读得到", saveAccount(st, "u1", { doc: g.doc, base: 1, dirty: { content: false } }, { now: FIXTURE_NOW }) && loadAccount(st, "u1", { now: FIXTURE_NOW }).copy?.doc.xp.devGuest === 190);
  check("账号归属按本机键隔离：u2 读不到 u1 的副本", loadAccount(st, "u2", { now: FIXTURE_NOW }).copy === null);
  const cloud = JSON.parse(readFileSync(new URL("./fixtures/cloud-doc-schema1.json", import.meta.url), "utf8"));
  const n = normalizeDoc(cloud), n2 = normalizeDoc(cloud);
  check("云端 schema 1 旧文档清洗后内容不变（XP 190、8 关、设置 C）", n.ok && docsEquivalent(n.doc, n2.doc) && sumXp(n.doc) === 190 && n.doc.prefs.soundStyle === "C" && Object.keys(n.doc.done).length === 8);
  const m = mergeDocs(cloud, cloud);
  check("旧文档自己和自己合并仍等价（升级/重复合并不改数据）", m.outcome === "merged" && docsEquivalent(m.doc, cloud));
}

// ======================================================================
// C. 不同 Supabase 项目、同一个用户 ID：本机副本和进度不串
// ======================================================================
{
  const st = mem(), prod = fakeCloud(), test = fakeCloud();
  seedAccount(st, "u1", 40);
  st.setItem(AUTH_KEY, JSON.stringify({ session: sess("u1", "me@example.com"), project: PROD }));
  const testDoc = emptyDoc({ gen: 1, lineage: "L-test" }); testDoc.xp.devT = 50;
  test.users.set("me@example.com", "u1"); // 两个项目碰巧是同一个用户 ID
  test.rows.set("u1", { doc: testDoc, rev: 1 });
  const sy = makeSync(st, test, { projectId: TEST });
  const restored = sy.restore(freshState());
  check("切到测试项目：看不到正式项目的当前账号和登录凭证", restored === null && sy.account() === null && sy.status().status === null);
  const r = await login(sy, "me@example.com", freshState());
  check("测试项目登录后只显示自己的 50 XP，不是 40 + 50 = 90", r.ok && r.state.xp === 50 && !r.state.done.U1L1);
  check("正式项目的本机副本仍是 40 XP，一个字没动", loadAccount(scopedStorage(st, ""), "u1", { now: NOW }).copy?.doc.xp.devA === 40);
  const testAuth = scopedStorage(st, projectNamespace(TEST, PROD)).getItem(AUTH_KEY);
  check("正式项目的登录凭证还在，测试项目把凭证写进带项目前缀的键", st.getItem(AUTH_KEY) !== null && JSON.parse(testAuth).project === TEST);
}

// ======================================================================
// D. 不同邮箱：不合并上一个账号的本机副本
// ======================================================================
{
  const st = mem(), cloud = fakeCloud();
  cloud.users.set("a@example.com", "u1"); // 云端已经有 A；B 必须是另一个用户编号
  seedAccount(st, "u1", 40);
  st.setItem(AUTH_KEY, JSON.stringify({ session: sess("u1", "a@example.com") }));
  const a = makeSync(st, cloud);
  a.restore(freshState());
  const out = await a.logout({ force: true }); // 还有没上传的内容：强制退出会保留 u1 副本
  check("准备：A 强制退出成功，未上传副本保留、当前账号清空", out.ok && loadAccount(st, "u1", { now: NOW }).copy?.doc.xp.devA === 40 && getCurrentAccount(st) === null);
  const b = makeSync(st, cloud);
  const rb = await login(b, "b@example.com", freshState());
  check("B（不同邮箱）登录后从 0 开始，不合并 A 的 40 XP", rb.ok && rb.state.xp === 0 && Object.keys(rb.state.done).length === 0, JSON.stringify(rb));
  check("B 自己的本机副本是 0 XP；A 的副本仍是 40 XP，两者分开存", loadAccount(st, "u2", { now: NOW }).copy?.doc.xp.devA === undefined && loadAccount(st, "u1", { now: NOW }).copy?.doc.xp.devA === 40);
  check("B 的云端记录也只有自己的 XP（0）", xpOf(cloud, "b@example.com") === 0);
}

// ======================================================================
// E. 坏凭证 / 过期凭证 / 错误项目凭证：不参与网络请求
// ======================================================================
async function noNetworkCase(label, authRaw) {
  const st = mem();
  seedAccount(st, "u1", 40);
  if (authRaw !== null) st.setItem(AUTH_KEY, authRaw);
  const api = noNetApi();
  const sy = makeSync(st, api);
  const restored = sy.restore(freshState());
  const r = await sy.syncNow();
  check(`${label}：恢复后要求重新登录，不把凭证交给网络`, restored && sy.status().status === "need-login" && api.calls.length === 0, JSON.stringify({ restored: !!restored, status: sy.status(), calls: api.calls, r }));
  return { st, sy, api };
}
await noNetworkCase("损坏的凭证 JSON", "{not json");
await noNetworkCase("凭证缺少访问令牌 / 刷新令牌 / 过期时间", JSON.stringify({ session: { userId: "u1", email: "a@example.com" } }));
await noNetworkCase("凭证只有访问令牌、没有刷新令牌", JSON.stringify({ session: { accessToken: "at", expiresAt: NOW + 3600_000, userId: "u1", email: "a@example.com" } }));
await noNetworkCase("凭证只有刷新令牌、没有访问令牌", JSON.stringify({ session: { refreshToken: "rt", expiresAt: NOW + 3600_000, userId: "u1", email: "a@example.com" } }));
await noNetworkCase("凭证没有用户编号", JSON.stringify({ session: { accessToken: "at", refreshToken: "rt", expiresAt: NOW + 3600_000, email: "a@example.com" } }));
{
  const st = mem();
  seedAccount(st, "u1", 40);
  st.setItem(AUTH_KEY, JSON.stringify({ session: sess("u1", "a@example.com"), project: "other.supabase.co" }));
  const api = noNetApi();
  const sy = makeSync(st, api);
  sy.restore(freshState());
  const r = await sy.syncNow();
  const stale = JSON.parse(st.getItem(STALE_KEY));
  check("凭证记的项目和当前入口对不上：不向任何接口出示令牌", api.calls.length === 0 && sy.status().status === "need-login", JSON.stringify(api.calls));
  check("过渡标记只含账号编号 / 邮箱 / 项目，没有令牌", stale && Object.keys(stale).sort().join() === "email,project,userId" && !/at|rt|access|refresh/i.test(JSON.stringify(stale)));
  check("错误项目的凭证本身不被删除（可能另一个入口还在用）", st.getItem(AUTH_KEY) !== null);
}
{
  const st = mem(), cloud = fakeCloud();
  seedAccount(st, "u1", 40);
  const old = sess("u1", "a@example.com", "old-at", NOW + 1000); // 1 秒后过期：同步前需要刷新
  cloud.tokens.set(old.accessToken, "u1"); cloud.tokens.set(old.refreshToken, "u1");
  st.setItem(AUTH_KEY, JSON.stringify({ session: old }));
  const sy = makeSync(st, cloud);
  sy.restore(freshState());
  const r = await sy.syncNow();
  const dataCalls = cloud.calls.filter((c) => c[0] === "getProgress" || c[0] === "saveProgress" || c[0] === "createProgress");
  check("合法但快过期的凭证：先刷新一次，再同步成功", r.ok && cloud.calls.filter((c) => c[0] === "refresh").length === 1, JSON.stringify(cloud.calls));
  check("刷新后不再把旧访问令牌发给进度接口", dataCalls.length > 0 && dataCalls.every((c) => !String(c[1] || "").includes("old-at")), JSON.stringify(dataCalls));
}
{
  const st = mem(), cloud = fakeCloud();
  seedAccount(st, "u1", 40);
  st.setItem(AUTH_KEY, JSON.stringify({ session: sess("u1", "a@example.com") }));
  const sy = makeSync(st, cloud, { projectId: "cloud-off" }); // 云端关闭：沿用正式项目的键
  sy.restore(freshState());
  const r = await sy.syncNow();
  check("云端关闭：同步不发任何 Supabase 请求", r.ok === false && cloud.calls.length === 0, JSON.stringify({ status: sy.status(), calls: cloud.calls }));
}
{
  let fetches = 0;
  const api = createApi({ url: "", anonKey: "", fetchFn: async () => { fetches++; throw new Error("不应发请求"); } });
  const a = await api.sendCode("a@example.com");
  const b = await api.getProgress(sess());
  check("云端未配置：sendCode / getProgress 直接返回 config，fetch 零次", a.kind === "config" && b.kind === "config" && fetches === 0, `fetch ${fetches}`);
}

// 已登录时换另一个邮箱：必须先退出，验证码和发信请求都不该发出去
{
  const st = mem(), cloud = fakeCloud();
  seedAccount(st, "u1", 40);
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "a@example.com", freshState());
  const before = cloud.calls.length;
  const other = await sy.verify("b@example.com", "123456", logged.state);
  const sent = await sy.sendCode("b@example.com");
  check("已登录 A 时用 B 的邮箱登录：被拒绝（other-account）", other.ok === false && other.kind === "other-account", JSON.stringify(other));
  check("已登录 A 时给 B 发验证码：同样被拒绝", sent.ok === false && sent.kind === "other-account", JSON.stringify(sent));
  check("换邮箱的两次尝试没有发出任何验证码 / 发信请求", cloud.calls.length === before, JSON.stringify(cloud.calls.slice(before)));
}

// ======================================================================
// F. 离线答题重连：只上传一次 XP
// ======================================================================
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const r = await login(sy, "offline@example.com", freshState());
  const dev = { sync: sy, state: r.state };
  cloud.state.online = false;
  learn(dev, "U1L1", 20); learn(dev, "U1L2", 20);
  const off = await sy.syncNow();
  check("离线时完成两关：进度保存在本机，同步失败但不丢", off.ok === false && dev.state.xp === 40 && sy.status().status === "offline");
  cloud.state.online = true;
  const writesBefore = cloud.calls.filter((c) => c[0] === "createProgress" || c[0] === "saveProgress").length;
  for (let i = 0; i < 3; i++) await sy.syncNow();
  const writesAfter = cloud.calls.filter((c) => c[0] === "createProgress" || c[0] === "saveProgress").length;
  check("重连后连续同步 3 次：云端 XP 只加一次（40）", xpOf(cloud, "offline@example.com") === 40, String(xpOf(cloud, "offline@example.com")));
  check("重连后只发生一次云端写入，后续同步不重复上传", writesAfter - writesBefore === 1, `新增写入 ${writesAfter - writesBefore} 次`);
  check("重连后本机仍是 40 XP，没有重复加", dev.state.xp === 40 && sumXp(rowOf(cloud, "offline@example.com").doc) === 40);
}

// ======================================================================
// G. 强制退出保留未上传副本；同账号重登继续上传
// ======================================================================
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const r = await login(sy, "return@example.com", freshState());
  const dev = { sync: sy, state: r.state };
  learn(dev, "U1L1", 20); await sy.syncNow();
  cloud.state.online = false;
  learn(dev, "U1L2", 20);
  const force = await sy.logout({ force: true });
  check("强制退出：回到游客，登录凭证清空", force.ok && sy.account() === null && st.getItem(AUTH_KEY) === null);
  check("强制退出：没上传的本机副本还在（40 XP）", sumXp(loadAccount(st, "u1", { now: NOW }).copy.doc) === 40);
  cloud.state.online = true;
  const reopen = makeSync(st, cloud);
  check("重新打开是游客，不会自动恢复上一个账号", reopen.restore(freshState()) === null && reopen.account() === null);
  const again = await login(reopen, "return@example.com", freshState());
  check("同账号重新登录：本机 40 XP 继续上传，云端 40 XP", again.ok && again.state.xp === 40 && xpOf(cloud, "return@example.com") === 40, String(xpOf(cloud, "return@example.com")));
  await reopen.syncNow(); await reopen.syncNow();
  check("再同步两次仍是 40 XP，不重复", xpOf(cloud, "return@example.com") === 40);
}

// ======================================================================
// H. 游客记录导入后又有新进度：不能静默丢掉新进度
// ======================================================================
{
  const st = mem(), cloud = fakeCloud();
  const guest70 = { ...freshState(), onboarded: true, xp: 70, lessonsCompleted: 4, done: { U1L1: true, U1L2: true, U1L3: true, U1L4: true }, streak: 1, lastDay: TODAY, prefs: { sound: true, haptics: true, soundStyle: "C" } };
  st.setItem(GUEST_KEY, JSON.stringify(guest70));
  const sy = makeSync(st, cloud);
  const v = await sy.verify("guest@example.com", "123456", guest70);
  const transferred = v.needChoice ? await sy.finishChoice("transfer") : v;
  const gid = getGuestId(st);
  check("准备：游客 70 XP 已转存到账号，游客记录按规则清掉", transferred.ok && xpOf(cloud, "guest@example.com") === 70 && transferred.guestCleared === true && gid.ok);
  // 模拟“清除游客记录失败 / 用户又离线学了一点”：同一份游客记录有了新内容，但云端还记着旧指纹。
  const guest80 = { ...guest70, xp: 80, lessonsCompleted: 5, done: { ...guest70.done, U1L5: true }, lastDay: TODAY };
  st.setItem(GUEST_KEY, JSON.stringify(guest80));
  await sy.logout({ force: true }); // 已同步，正常/强制退出都会删本机账号副本
  const sy2 = makeSync(st, cloud);
  const v2 = await sy2.verify("guest@example.com", "123456", guest80);
  check("同一游客编号但内容变了：再次登录会提示选择，而不是静默用云端的 70", v2.ok && v2.needChoice === true && v2.cloudHasData === true, JSON.stringify(v2));
  const r2 = v2.needChoice ? await sy2.finishChoice("transfer") : v2;
  check("用户明确选择安全合并：云端变成 80 XP（不是 70 + 80，也不是丢掉 10）", r2.ok && xpOf(cloud, "guest@example.com") === 80, String(xpOf(cloud, "guest@example.com")));
  check("安全合并读回一致后游客记录才清除", r2.guestCleared === true && st.getItem(GUEST_KEY) === null);
}

// ======================================================================
// I. 旧 true 无指纹 / 弹窗期间并发 / 保留云端 / 安全合并 / 读回校验
//    产品口径（2026-11-05）：
//    - 旧 true 没有指纹，禁止用云端总 XP / 总次数 / 日期推断“未变化”；
//      游客有学习记录 = unknown，必须提示；游客完全为空才允许跳过。
//    - 选保留云端：重读最新云端，只写当前游客指纹，其余云端数据逐字保留；CAS 冲突重读再写。
//    - 选安全合并：重读最新云端，XP/次数按设备取较大值，关卡/日期并集，绝不 gen+1 整份覆盖。
//    - 只有上传成功且读回与预期一致才删游客；失败、冲突、读回失败/不一致都保留游客原文。
// ======================================================================
const DEVICE = "devLegacy";
const DONE4 = { U1L1: true, U1L2: true, U1L3: true, U1L4: true };
const guestWith = (o = {}) => ({
  ...freshState(), onboarded: true,
  xp: o.xp ?? 70,
  lessonsCompleted: o.lessons ?? 4,
  done: o.done ?? { ...DONE4 },
  streak: o.streak ?? 1,
  lastDay: o.lastDay ?? TODAY,
  hearts: o.hearts ?? 5,
  prefs: o.prefs ?? { sound: true, haptics: true, soundStyle: "C" },
});
const g70 = guestWith({});
const g80 = guestWith({ xp: 80, lessons: 5, done: { ...DONE4, U1L5: true } });
// 造一份“云端已经导入过这个游客编号”的记录。legacy=true 是旧格式，字符串是旧/新指纹。
function makeCase({ guest = g80, doc, legacy = true, email = "legacy@example.com", userId = "uLegacy", rev = 7 } = {}) {
  const st = mem();
  st.setItem(DEVICE_KEY, DEVICE);
  st.setItem(GUEST_KEY, JSON.stringify(guest));
  const gid = getGuestId(st).id;
  if (legacy !== null) doc.imported[gid] = legacy;
  const cloud = fakeCloud();
  cloud.users.set(email, userId);
  cloud.rows.set(userId, { doc: clone(doc), rev });
  return { st, cloud, gid, email, userId, guest, raw: JSON.stringify(guest), before: clone(doc) };
}
// 云端 500 XP 的大记录：总 XP / 总次数 / 日期都远大于游客，用来证明“总量推断”会遮蔽新进度。
function bigCloud({ gen = 1, lineage = "L-big", device = "devA", xp = 500, runs = 20 } = {}) {
  const d = emptyDoc({ gen, lineage });
  d.xp[device] = xp;
  d.runs[device] = runs;
  d.done = { U1L1: "2026-10-01", U1L2: "2026-10-02", U2L1: "2026-10-03" };
  d.days = ["2026-10-01", "2026-10-02", "2026-10-03"];
  d.hearts = { n: 3, msToNext: 120000 };
  d.prefs = { sound: false, haptics: true, soundStyle: "C" };
  return d;
}
const rowOfCase = (c) => c.cloud.rows.get(c.userId);
const stateOf = (st) => {
  const r = loadAccount(st, "uLegacy", { now: NOW });
  return r.ok && r.copy ? r.copy : null;
};
// 专用“游客导入待办”在账号相关的独立键里；不靠 doc.imported 或“脏标记”猜。
const pendingImportKeys = (st) => [...st._m.keys()].filter((k) => k.includes("suipian.acct.import."));
const pendingRecordOf = (st) => { const k = pendingImportKeys(st)[0]; if (!k) return null; try { return JSON.parse(st.getItem(k)); } catch { return null; } };

// ---- I.0 Case 10 硬断言（原 gemini/login-sync-edge-tests-1 Case 10，不再软红）----
{
  const cloud = emptyDoc();
  cloud.imported.GID_12345 = true;
  const guestNew = guestWith({ xp: 150, lessons: 3, done: { U2L1: true, U2L2: true, U2L3: true }, lastDay: "2026-11-05" });
  const status = guestImportStatus(cloud, "GID_12345", guestNew);
  const r = replaceWithGuest(guestNew, { deviceId: "dev1", guestId: "GID_12345", cloudDoc: cloud });
  check("Case 10 硬断言：旧 imported=true + 游客有学习记录 → 状态 unknown，不再按总量推断 same", status === "unknown", status);
  check("Case 10 硬断言：replaceWithGuest 必须返回 guest-changed + 两个选择，不得 already-imported", r.ok && r.outcome === "guest-changed" && r.choices.join() === "keep-cloud,merge", JSON.stringify({ outcome: r.outcome, choices: r.choices }));
}

// ---- I.1 旧 true：云端 500 XP 也不能遮蔽游客新增的 10 XP ----
{
  const c = makeCase({ guest: guestWith({ xp: 10, lessons: 1, done: { U2L1: true }, lastDay: "2026-10-03" }), doc: bigCloud() });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", c.guest);
  check("I.1 旧 true + 云端 500 XP / 游客新增 10 XP：必须提示选择（总 XP 不能证明未变化）", v.ok && v.needChoice === true && v.cloudHasData === true, JSON.stringify(v));
}

// ---- I.2 旧 true：云端次数更高，游客新增复习也必须提示 ----
{
  const c = makeCase({ guest: guestWith({ xp: 5, lessons: 3, done: { U1L1: true }, lastDay: "2026-10-02" }), doc: bigCloud() });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", c.guest);
  check("I.2 旧 true + 云端次数更高但游客新增复习：必须提示选择（总次数不能遮蔽）", v.ok && v.needChoice === true, JSON.stringify(v));
}

// ---- I.3 旧 true：云端已有同关卡 / 同日期，游客新增 XP 也必须提示 ----
{
  const c = makeCase({ guest: guestWith({ xp: 10, lessons: 1, done: { U2L1: true }, lastDay: "2026-10-03" }), doc: bigCloud() });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", c.guest);
  check("I.3 旧 true + 云端已有同关卡和同日期但游客新增 XP：必须提示选择（日期遮蔽也不行）", v.ok && v.needChoice === true, JSON.stringify(v));
}

// ---- I.4 旧 true + 游客确实没变：仍然必须提示（没有指纹就不能说“没变”）----
{
  // 游客的 XP / 次数 / 关卡 / 日期全部被云端“覆盖”，旧代码会据此判 same；但没有指纹就不能这么推断。
  const unchangedGuest = guestWith({ xp: 60, lessons: 3, done: { U1L1: true, U1L2: true, U2L1: true }, lastDay: "2026-10-03", streak: 3 });
  const c = makeCase({ guest: unchangedGuest, doc: bigCloud({ xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", unchangedGuest);
  check("I.4 旧 true + 游客有学习记录（XP/次数/关卡/日期看起来都被云端覆盖）：也必须提示，不再静默 same", v.ok && v.needChoice === true, JSON.stringify(v));
}

// ---- I.5 对照：游客完全为空才允许跳过 ----
{
  const empty = freshState();
  const c = makeCase({ guest: empty, doc: bigCloud(), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", empty);
  check("I.5 对照：旧 true + 游客完全为空（无 XP / 次数 / 关卡 / 日期）：允许跳过，不弹窗", v.ok && !v.needChoice && v.state.xp === 500, JSON.stringify(v));
  check("I.5 对照：跳过时游客原文保留，云端一个字没改", c.st.getItem(GUEST_KEY) === JSON.stringify(empty) && xpOf(c.cloud, c.email) === 500);
}

// ---- I.6 选“保留云端”：只写指纹，其余云端数据逐字保留；第二次不重复弹，游客再变再弹 ----
{
  const cloudDoc = bigCloud({ gen: 4, lineage: "L-keep", device: "devA", xp: 500, runs: 20 });
  cloudDoc.xp.devB = 40; cloudDoc.runs.devB = 3;
  cloudDoc.done.U3L1 = "2026-10-04"; cloudDoc.days.push("2026-10-04");
  const c = makeCase({ guest: g80, doc: cloudDoc, legacy: true });
  const before = clone(rowOfCase(c).doc);
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.6 准备：旧 true + 游客 80 → 弹窗", v.ok && v.needChoice === true, JSON.stringify(v));
  const r = await sy.finishChoice("cloud");
  const row = rowOfCase(c);
  const stripped = (d) => { const x = clone(d); delete x.imported[c.gid]; return JSON.stringify(x); };
  check("I.6 选保留云端：只写 imported[游客编号]=当前指纹", r.ok && row.doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify(row.doc.imported));
  check("I.6 选保留云端：gen / lineage / 其他设备 XP / 关卡 / 日期 / 红心 / 设置逐字保留", stripped(row.doc) === stripped(before), stripped(row.doc).slice(0, 120) + " != " + stripped(before).slice(0, 120));
  check("I.6 选保留云端：游客记录逐字保留，不删", c.st.getItem(GUEST_KEY) === c.raw);
  check("I.6 选保留云端：本机账号副本与云端一致，不标待上传", docsEquivalent(stateOf(c.st).doc, row.doc) && stateOf(c.st).dirty.content === false);
  await sy.logout({ force: true });
  const sy2 = makeSync(c.st, c.cloud);
  const v2 = await sy2.verify(c.email, "123456", g80);
  check("I.6 选保留云端后同一份游客记录再次登录：不再重复弹窗", v2.ok && !v2.needChoice && v2.state.xp === 540, JSON.stringify(v2));
  await sy2.logout({ force: true });
  const g82 = guestWith({ xp: 82, lessons: 6, done: { ...DONE4, U1L5: true, U1L6: true } });
  c.st.setItem(GUEST_KEY, JSON.stringify(g82));
  const sy3 = makeSync(c.st, c.cloud);
  const v3 = await sy3.verify(c.email, "123456", g82);
  check("I.6 游客再次变化：重新弹窗（指纹变了 → changed）", v3.ok && v3.needChoice === true, JSON.stringify(v3));
}

// ---- I.7 弹窗期间另一台设备增加 XP 和关卡：选保留云端也必须保留 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 3, lineage: "L-dialog", xp: 500, runs: 20 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.7 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const row = rowOfCase(c);
  row.doc.xp.devOther = 30; row.doc.runs.devOther = 2; row.doc.done.U2L9 = "2026-11-05"; row.doc.days.push("2026-11-05"); row.rev++;
  const latestRev = row.rev;
  const writes = [], origSave = c.cloud.saveProgress;
  c.cloud.saveProgress = async (s, expected, doc) => { writes.push({ expected, doc: clone(doc) }); return origSave(s, expected, doc); };
  const r = await sy.finishChoice("cloud");
  check("I.7 弹窗期间另一设备增加 XP 和关卡：选保留云端后重读最新，新增内容完整保留", r.ok && row.doc.xp.devOther === 30 && !!row.doc.done.U2L9 && row.doc.days.includes("2026-11-05"), JSON.stringify({ xp: row.doc.xp, done: row.doc.done }));
  check("I.7 保留云端第一次写入就基于最新 rev 和最新文档（不是挂起时的旧 remoteDoc）", writes.length === 1 && writes[0].expected === latestRev && writes[0].doc.xp.devOther === 30, JSON.stringify(writes.map((w) => ({ expected: w.expected, devOther: w.doc.xp.devOther }))));
  check("I.7 选保留云端仍只写指纹：gen / lineage 不变", row.doc.gen === 3 && row.doc.lineage === "L-dialog" && row.doc.imported[c.gid] === guestFingerprint(g80));
}

// ---- I.8 弹窗期间另一台设备增加 XP 和关卡：安全合并后必须保留 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 3, lineage: "L-dialog", device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.8 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const row = rowOfCase(c);
  row.doc.xp.devOther = 30; row.doc.runs.devOther = 2; row.doc.done.U2L9 = "2026-11-05"; row.doc.days.push("2026-11-05"); row.rev++;
  const latestRev = row.rev;
  const writes = [], origSave = c.cloud.saveProgress;
  c.cloud.saveProgress = async (s, expected, doc) => { writes.push({ expected, doc: clone(doc) }); return origSave(s, expected, doc); };
  const r = await sy.finishChoice("transfer");
  check("I.8 弹窗期间另一设备增加 XP 和关卡：安全合并后全部保留", r.ok && row.doc.xp.devOther === 30 && row.doc.runs.devOther === 2 && !!row.doc.done.U2L9 && row.doc.days.includes("2026-11-05"), JSON.stringify({ xp: row.doc.xp, done: row.doc.done }));
  check("I.8 安全合并第一次写入就基于最新 rev 和最新文档（不是挂起时的旧 remoteDoc）", writes.length === 1 && writes[0].expected === latestRev && writes[0].doc.xp.devOther === 30, JSON.stringify(writes.map((w) => ({ expected: w.expected, devOther: w.doc.xp.devOther }))));
  check("I.8 安全合并：游客 XP 记到本机设备格，按设备取较大值（70 → 80）", row.doc.xp[DEVICE] === 80 && sumXp(row.doc) === 110, JSON.stringify(row.doc.xp));
  check("I.8 安全合并：不再 gen + 1，lineage 不变", row.doc.gen === 3 && row.doc.lineage === "L-dialog");
  check("I.8 安全合并读回一致：游客记录才删除", r.guestCleared === true && c.st.getItem(GUEST_KEY) === null);
}

// ---- I.9 安全合并：其他设备 XP / 关卡 / 红心 / 设置完整保留 ----
{
  const cloudDoc = emptyDoc({ gen: 5, lineage: "L-five" });
  cloudDoc.xp = { devA: 100, devB: 40 }; cloudDoc.runs = { devA: 6, devB: 2 };
  cloudDoc.done = { U1L1: "2026-09-01", U1L2: "2026-09-02" };
  cloudDoc.days = ["2026-09-01", "2026-09-02"];
  cloudDoc.hearts = { n: 3, msToNext: 90000 };
  cloudDoc.prefs = { sound: false, haptics: false, soundStyle: "A" };
  cloudDoc.imported = { Gother: "deadbeef" };
  const c = makeCase({ guest: guestWith({ xp: 70, lessons: 3, done: { U1L3: true } }), doc: cloudDoc, legacy: null });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", c.guest);
  check("I.9 准备：新游客编号（没有 imported 记录）→ 弹窗", v.ok && v.needChoice === true);
  const r = await sy.finishChoice("transfer");
  const row = rowOfCase(c);
  check("I.9 安全合并：其他设备 XP / 次数完整保留（devA=100, devB=40）", row.doc.xp.devA === 100 && row.doc.xp.devB === 40 && row.doc.runs.devA === 6 && row.doc.runs.devB === 2, JSON.stringify(row.doc.xp));
  check("I.9 安全合并：其他设备关卡和日期取并集，不覆盖", row.doc.done.U1L1 === "2026-09-01" && row.doc.done.U1L2 === "2026-09-02" && Object.hasOwn(row.doc.done, "U1L3") && row.doc.days.includes("2026-09-02") && row.doc.days.includes(TODAY), JSON.stringify({ done: row.doc.done, days: row.doc.days }));
  check("I.9 安全合并：红心 / 设置保留云端最新值", row.doc.hearts.n === 3 && row.doc.hearts.msToNext === 90000 && row.doc.prefs.sound === false && row.doc.prefs.soundStyle === "A", JSON.stringify({ hearts: row.doc.hearts, prefs: row.doc.prefs }));
  check("I.9 安全合并：gen / lineage 不变，其他游客的 imported 记录保留", row.doc.gen === 5 && row.doc.lineage === "L-five" && row.doc.imported.Gother === "deadbeef" && row.doc.imported[c.gid] === guestFingerprint(c.guest));
}

// ---- I.10 上传失败：保留游客原文，本机账号副本不回退 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.10 准备：弹窗已挂起", v.ok && v.needChoice === true);
  c.cloud.saveProgress = async () => ({ ok: false, kind: "network", message: "上传失败（测试注入）" });
  const r = await sy.finishChoice("transfer");
  const copy = stateOf(c.st);
  check("I.10 上传失败：登录完成但明确未同步，不谎报成功", r.ok && r.synced === false && r.guestCleared !== true, JSON.stringify(r));
  check("I.10 上传失败：云端仍是 70，游客记录逐字保留", xpOf(c.cloud, c.email) === 70 && c.st.getItem(GUEST_KEY) === c.raw);
  check("I.10 上传失败：本机账号副本保留合并后的 80 XP 并标记待上传（没有回退到 70）", sumXp(copy.doc) === 80 && copy.dirty.content === true, JSON.stringify(copy && { xp: sumXp(copy.doc), dirty: copy.dirty }));
  check("I.10 上传失败：状态是待同步、有专用待办，不得显示已同步", sy.status().pending === true && sy.status().status === "pending" && pendingImportKeys(c.st).length === 1, JSON.stringify({ status: sy.status(), keys: pendingImportKeys(c.st) }));
}

// ---- I.11 读回失败：上传成功也不删游客 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.11 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const origGet = c.cloud.getProgress; let gets = 0;
  c.cloud.getProgress = async (s) => { gets++; return gets === 2 ? { ok: false, kind: "network", message: "读回失败（测试注入）" } : origGet(s); };
  const r = await sy.finishChoice("transfer");
  check("I.11 读回失败：上传本身成功（云端 80），但只算待同步，不把“写成功”当成“读回一致”", r.ok && r.synced === false && r.verified !== true && xpOf(c.cloud, c.email) === 80, JSON.stringify({ r, xp: xpOf(c.cloud, c.email), gets }));
  check("I.11 读回失败：游客记录逐字保留，不删除", r.guestCleared !== true && c.st.getItem(GUEST_KEY) === c.raw);
  check("I.11 读回失败：本机账号副本是刚上传的 80，没有回退", sumXp(stateOf(c.st).doc) === 80);
  check("I.11 读回失败：状态是待同步、有专用待办，不得显示已同步", sy.status().pending === true && sy.status().status === "pending" && pendingImportKeys(c.st).length === 1, JSON.stringify({ status: sy.status(), keys: pendingImportKeys(c.st) }));
}

// ---- I.12 读回不一致：保留游客，本机副本不用错误读回覆盖 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.12 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const origGet = c.cloud.getProgress; let gets = 0;
  c.cloud.getProgress = async (s) => {
    gets++;
    if (gets === 2) {
      const row = rowOfCase(c);
      const bad = clone(row.doc); bad.xp.devGhost = 999; // 读回多出不该有的数据
      return { ok: true, row: { doc: bad, rev: row.rev } };
    }
    return origGet(s);
  };
  const r = await sy.finishChoice("transfer");
  check("I.12 读回不一致：上传成功但读回文档与预期不同 → 待同步、不删游客", r.ok && r.synced === false && r.guestCleared !== true && c.st.getItem(GUEST_KEY) === c.raw, JSON.stringify(r));
  check("I.12 读回不一致：本机账号副本仍是上传的 80，不被错误读回（999）污染", sumXp(stateOf(c.st).doc) === 80 && stateOf(c.st).doc.xp.devGhost === undefined);
  check("I.12 读回不一致：状态是待同步、有专用待办，不得显示已同步", sy.status().pending === true && sy.status().status === "pending" && pendingImportKeys(c.st).length === 1, JSON.stringify({ status: sy.status(), keys: pendingImportKeys(c.st) }));
}

// ---- I.13 读回一致：才删除游客 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.13 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const r = await sy.finishChoice("transfer");
  check("I.13 读回与上传文档一致：游客记录才被删除", r.ok && r.synced === true && r.guestCleared === true && c.st.getItem(GUEST_KEY) === null, JSON.stringify(r));
  check("I.13 读回一致：云端是 80，本机副本也是 80", xpOf(c.cloud, c.email) === 80 && sumXp(stateOf(c.st).doc) === 80);
}

// ---- I.14 选保留云端遇 CAS 冲突：重读最新再写，弹窗期间新增不丢 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-cas", xp: 500, runs: 20 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.14 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const origSave = c.cloud.saveProgress; let first = true;
  c.cloud.saveProgress = async (s, expected, doc) => {
    if (first) {
      first = false;
      const row = rowOfCase(c);
      row.doc.xp.devOther = 30; row.doc.done.U2L9 = "2026-11-05"; row.doc.days.push("2026-11-05"); row.rev++;
      return { ok: true, rev: null }; // 模拟被别的设备抢先
    }
    return origSave(s, expected, doc);
  };
  const r = await sy.finishChoice("cloud");
  const row = rowOfCase(c);
  check("I.14 保留云端 CAS 冲突：重读最新后重写成功，指纹写入", r.ok && r.synced === true && row.doc.imported[c.gid] === guestFingerprint(g80));
  check("I.14 保留云端 CAS 冲突：冲突期间其他设备新增的 XP / 关卡完整保留", row.doc.xp.devOther === 30 && !!row.doc.done.U2L9, JSON.stringify({ xp: row.doc.xp, done: row.doc.done }));
}

// ---- I.15 安全合并遇 CAS 冲突：重读再合并，游客和其他设备数据都不丢 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-cas2", device: DEVICE, xp: 70, runs: 4 }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("I.15 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const origSave = c.cloud.saveProgress; let first = true;
  c.cloud.saveProgress = async (s, expected, doc) => {
    if (first) {
      first = false;
      const row = rowOfCase(c);
      row.doc.xp.devOther = 25; row.doc.done.U3L3 = "2026-11-06"; row.doc.days.push("2026-11-06"); row.rev++;
      return { ok: true, rev: null };
    }
    return origSave(s, expected, doc);
  };
  const r = await sy.finishChoice("transfer");
  const row = rowOfCase(c);
  check("I.15 安全合并 CAS 冲突：重读最新再合并，其他设备新增 XP / 关卡保留", r.ok && row.doc.xp.devOther === 25 && !!row.doc.done.U3L3, JSON.stringify({ xp: row.doc.xp, done: row.doc.done }));
  check("I.15 安全合并 CAS 冲突：游客进度也在，读回一致才删游客", row.doc.xp[DEVICE] === 80 && r.guestCleared === true && c.st.getItem(GUEST_KEY) === null);
}

// ---- I.16 对照：新指纹相同 → 不弹窗（合法）----
{
  const c = makeCase({ guest: g70, doc: bigCloud({ xp: 70, runs: 4 }), legacy: guestFingerprint(g70) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g70);
  check("I.16 对照：imported 记录了相同指纹且游客未变 → 不弹窗", v.ok && !v.needChoice && v.state.xp === 70, JSON.stringify(v));
}


// ======================================================================
// J. 选择结果写云失败后的待同步与重试（产品官 2026-11-05 第二次验收）
//    硬要求：
//    - 保留云端写指纹失败：本机不得提前把新指纹标成“已完成”；游客保留；有专用待办；
//      重连 / 重开后自动重试；指纹成功写入且读回一致后才标记完成，下次登录不重复弹窗。
//    - 云端旧 imported=true 不得覆盖待上传的新指纹。
//    - 安全合并上传失败 / 读回失败 / 读回不一致：游客保留、状态待同步、不得显示已同步。
//    - 失败后重试成功只合并一次：XP / 完成次数 / 日期不重复，游客只删除一次。
// ======================================================================

// ---- J.1 保留云端写指纹失败：不提前标完成，留专用待办，游客保留 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-keepfail", xp: 500, runs: 20 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", g80);
  check("J.1 准备：保留云端的弹窗已挂起", v.ok && v.needChoice === true, JSON.stringify(v));
  const origSave = c.cloud.saveProgress;
  c.cloud.saveProgress = async () => ({ ok: false, kind: "network", message: "写指纹失败（测试注入）" });
  const r = await sy.finishChoice("cloud");
  const copy = stateOf(c.st);
  const fp = guestFingerprint(g80);
  check("J.1 写指纹失败：登录完成但明确未同步、游客未清", r.ok && r.synced === false && r.guestCleared !== true, JSON.stringify(r));
  check("J.1 写指纹失败：本机不提前写入新指纹（不把“已完成”存成干净状态）", copy && copy.doc.imported[c.gid] !== fp && copy.dirty.content === false, JSON.stringify({ imported: copy?.doc.imported, dirty: copy?.dirty }));
  check("J.1 写指纹失败：游客记录逐字保留，云端旧 true 也没被改", c.st.getItem(GUEST_KEY) === c.raw && rowOfCase(c).doc.imported[c.gid] === true, JSON.stringify({ guest: c.st.getItem(GUEST_KEY) === c.raw, cloud: rowOfCase(c).doc.imported[c.gid] }));
  const pr = pendingRecordOf(c.st);
  check("J.1 写指纹失败：状态待同步、有专用待办，不得显示已同步", sy.status().pending === true && sy.status().status === "pending" && !!pr, JSON.stringify({ status: sy.status(), record: pr }));
  check("J.1 专用待办写明选择 / 游客编号 / 当时的指纹和游客原文", pr && pr.choice === "cloud" && pr.guestId === c.gid && pr.fingerprint === guestFingerprint(g80) && pr.guestRaw === c.raw, JSON.stringify(pr));
  c.cloud.saveProgress = origSave;
}

// ---- J.2 重开后自动重试 J.1 的专用待办；成功读回后才标完成，下次登录不弹 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-keepretry", xp: 500, runs: 20 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const origSave = c.cloud.saveProgress;
  c.cloud.saveProgress = async () => ({ ok: false, kind: "network", message: "写指纹失败（测试注入）" });
  await sy.finishChoice("cloud");
  c.cloud.saveProgress = origSave;
  const sy2 = makeSync(c.st, c.cloud);
  const restored = sy2.restore(freshState());
  check("J.2 重开：能恢复登录，并知道有专用待办（不是普通“已同步”）", restored && sy2.status().pending === true && sy2.status().status === "pending", JSON.stringify({ restored: !!restored, status: sy2.status() }));
  let writes = 0;
  const origSave2 = c.cloud.saveProgress;
  c.cloud.saveProgress = async (s, rev, doc) => { writes++; return origSave2(s, rev, doc); };
  const rr = await sy2.syncNow();
  const row = rowOfCase(c);
  const copy = stateOf(c.st);
  const fp = guestFingerprint(g80);
  check("J.2 重连后自动重试：指纹写入云端且读回一致", rr.ok && writes === 1 && row.doc.imported[c.gid] === fp, JSON.stringify({ rr, writes, imported: row.doc.imported[c.gid] }));
  check("J.2 重试成功：本机副本才写入指纹并标为干净，待办清空", copy.doc.imported[c.gid] === fp && copy.dirty.content === false && pendingImportKeys(c.st).length === 0, JSON.stringify({ imported: copy.doc.imported[c.gid], dirty: copy.dirty, keys: pendingImportKeys(c.st) }));
  check("J.2 重试成功：游客记录原样保留（保留云端本来就不删）", c.st.getItem(GUEST_KEY) === c.raw);
  check("J.2 重试成功：状态已同步，不再显示待同步", sy2.status().pending === false && sy2.status().status === "synced", JSON.stringify(sy2.status()));
  await sy2.logout();
  const sy3 = makeSync(c.st, c.cloud);
  const v3 = await sy3.verify(c.email, "123456", g80);
  check("J.2 指纹写入并读回后：同一游客再次登录不重复弹窗，XP 仍是云端的 500（不重复加游客）", v3.ok && !v3.needChoice && v3.state.xp === 500, JSON.stringify(v3));
}

// ---- J.3 云端旧 imported=true 不得覆盖待上传的新指纹 ----
{
  const local = bigCloud({ gen: 3, lineage: "L-pending-fp" });
  local.imported.Gpending = "deadbeef";
  const remote = bigCloud({ gen: 3, lineage: "L-pending-fp" });
  remote.imported.Gpending = true; // 云端还是旧格式
  const m = mergeDocs(local, remote);
  check("J.3 合并时旧 true 不能盖掉本机已有的字符串指纹（待上传的新指纹保留）", m.doc?.imported.Gpending === "deadbeef", JSON.stringify(m.doc?.imported));
  check("J.3 对照：云端没有这项时，本机指纹照常保留", mergeDocs(local, bigCloud({ gen: 3, lineage: "L-pending-fp" })).doc.imported.Gpending === "deadbeef");
}

// ---- J.4 保留云端“上传成功但读回失败/不一致”：仍待同步、本机不标完成 ----
async function keepReadBackCase(label, badReadBack) {
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-keepread", xp: 500, runs: 20 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const origGet = c.cloud.getProgress;
  let gets = 0;
  c.cloud.getProgress = async (s) => {
    gets++;
    if (gets === 2) return badReadBack(c, origGet);
    return origGet(s);
  };
  const r = await sy.finishChoice("cloud");
  const copy = stateOf(c.st);
  const fp = guestFingerprint(g80);
  check(`J.4 ${label}：写云成功但读回没确认 → 不能标完成`, r.ok && r.synced === false && r.verified !== true && rowOfCase(c).doc.imported[c.gid] === fp, JSON.stringify({ r, cloud: rowOfCase(c).doc.imported[c.gid] }));
  const pr = pendingRecordOf(c.st);
  check(`J.4 ${label}：本机不写新指纹、不标干净，游客保留，待办还在`, copy.doc.imported[c.gid] !== fp && !!pr && c.st.getItem(GUEST_KEY) === c.raw, JSON.stringify({ imported: copy.doc.imported[c.gid], record: pr }));
  check(`J.4 ${label}：专用待办仍是“保留云端”且指纹是本次选择的游客快照`, pr && pr.choice === "cloud" && pr.fingerprint === guestFingerprint(g80) && pr.guestId === c.gid, JSON.stringify(pr));
  check(`J.4 ${label}：状态待同步，不得显示已同步`, sy.status().pending === true && sy.status().status === "pending", JSON.stringify(sy.status()));
  // 恢复读回接口后重试成功：才写本机指纹、清待办
  c.cloud.getProgress = origGet;
  const sy2 = makeSync(c.st, c.cloud);
  sy2.restore(freshState());
  const rr = await sy2.syncNow();
  const copy2 = stateOf(c.st);
  check(`J.4 ${label}：重试读回一致后才标完成`, rr.ok && copy2.doc.imported[c.gid] === fp && copy2.dirty.content === false && pendingImportKeys(c.st).length === 0 && sy2.status().status === "synced", JSON.stringify({ rr, imported: copy2.doc.imported[c.gid], keys: pendingImportKeys(c.st), status: sy2.status() }));
}
await keepReadBackCase("读回失败", () => ({ ok: false, kind: "network", message: "读回失败（测试注入）" }));
await keepReadBackCase("读回不一致", (c, origGet) => ({ ok: true, row: { doc: { ...rowOfCase(c).doc, xp: { ...rowOfCase(c).doc.xp, devGhost: 999 } }, rev: rowOfCase(c).rev } }));

// ---- J.5 安全合并“上传成功但读回失败”后重试：只合并一次，不重复 XP / 次数 / 日期，游客只删一次 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-mergeonce", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const origGet = c.cloud.getProgress;
  let gets = 0;
  c.cloud.getProgress = async (s) => { gets++; return gets === 2 ? { ok: false, kind: "network", message: "读回失败（测试注入）" } : origGet(s); };
  const r1 = await sy.finishChoice("transfer");
  const row1 = rowOfCase(c);
  check("J.5 第一次上传成功但读回失败：待同步、游客保留", r1.ok && r1.synced === false && c.st.getItem(GUEST_KEY) === c.raw && pendingImportKeys(c.st).length === 1, JSON.stringify(r1));
  check("J.5 第一次上传后云端只合并一次（本机设备 80 XP / 5 次）", row1.doc.xp[DEVICE] === 80 && row1.doc.runs[DEVICE] === 5, JSON.stringify({ xp: row1.doc.xp, runs: row1.doc.runs }));
  c.cloud.getProgress = origGet;
  const sy2 = makeSync(c.st, c.cloud);
  sy2.restore(freshState());
  const rr = await sy2.syncNow();
  const row2 = rowOfCase(c);
  const days = row2.doc.days;
  check("J.5 重试成功：XP / 次数没有被再加一次", rr.ok && row2.doc.xp[DEVICE] === 80 && row2.doc.runs[DEVICE] === 5 && sumXp(row2.doc) === 80, JSON.stringify({ xp: row2.doc.xp, runs: row2.doc.runs, sum: sumXp(row2.doc) }));
  check("J.5 重试成功：日期不重复、游客只删一次", days.length === new Set(days).size && c.st.getItem(GUEST_KEY) === null && pendingImportKeys(c.st).length === 0, JSON.stringify({ days, guest: c.st.getItem(GUEST_KEY), keys: pendingImportKeys(c.st) }));
  const before = JSON.stringify(row2.doc);
  await sy2.syncNow(); await sy2.syncNow();
  check("J.5 再同步两次：云端文档不变，不重复合并 / 不重复加 XP", JSON.stringify(rowOfCase(c).doc) === before && sumXp(rowOfCase(c).doc) === 80, JSON.stringify({ xp: sumXp(rowOfCase(c).doc) }));
}

// ---- J.6 待办重试时保留用户期间新学的进度（不被“保留云端”或重试覆盖）----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-keeplearn", xp: 500, runs: 20 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const origSave = c.cloud.saveProgress;
  c.cloud.saveProgress = async () => ({ ok: false, kind: "network", message: "写指纹失败（测试注入）" });
  const r = await sy.finishChoice("cloud");
  check("J.6 准备：保留云端写失败，登录完成且是待同步", r.ok && r.synced === false && sy.status().status === "pending", JSON.stringify(r));
  const dev = { sync: sy, state: r.state };
  learn(dev, "U2L9", 20); // 待办还没重试时，用户又学了一关
  const local = stateOf(c.st);
  check("J.6 待办期间新学的 20 XP 先保存在本机", local.doc.xp[DEVICE] === 20 && sumXp(local.doc) === 520 && local.doc.done.U2L9 && local.dirty.content === true, JSON.stringify({ xp: local.doc.xp, sum: sumXp(local.doc), done: local.doc.done }));
  c.cloud.saveProgress = origSave;
  const sy2 = makeSync(c.st, c.cloud);
  sy2.restore(freshState());
  const rr = await sy2.syncNow();
  const row = rowOfCase(c);
  check("J.6 重试写指纹时保留新学的 20 XP 和关卡，没被云端旧文档覆盖", rr.ok && sumXp(row.doc) === 520 && row.doc.xp[DEVICE] === 20 && row.doc.done.U2L9 && row.doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ rr, xp: row.doc.xp, sum: sumXp(row.doc), done: row.doc.done }));
  check("J.6 保留云端仍然不合并游客：没有把游客 80 XP 加进来", sumXp(row.doc) === 520 && c.st.getItem(GUEST_KEY) === c.raw);
}

const failed = results.filter((r) => !r).length;
console.log(`\n登录/同步加固专项：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
