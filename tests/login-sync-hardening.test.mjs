// 登录 / 云存档 / 离线保存 / 跨设备同步的专项回归测试（纯 Node，不联网、不连任何 Supabase 项目）。
// 覆盖：项目隔离、不同邮箱、离线 XP 只上传一次、强制退出后继续上传、坏凭证不联网、
//       云端关闭零请求、测试配置拒绝正式项目伪装网址、旧存档升级、游客记录导入后又有新进度。
// 运行：node tests/login-sync-hardening.test.mjs
import { readFileSync } from "node:fs";
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { saveAccount, setCurrentAccount, loadAccount, getCurrentAccount, GUEST_KEY, getGuestId } from "../src/account-store.js";
import { emptyDoc, docToState, sumXp, guestToDoc, normalizeDoc, mergeDocs, docsEquivalent } from "../src/account-data.js";
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
  check("用户明确选择转存：云端变成 80 XP（不是 70 + 80，也不是丢掉 10）", r2.ok && xpOf(cloud, "guest@example.com") === 80, String(xpOf(cloud, "guest@example.com")));
  check("转存读回一致后游客记录才清除", r2.guestCleared === true && st.getItem(GUEST_KEY) === null);
}

const failed = results.filter((r) => !r).length;
console.log(`\n登录/同步加固专项：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
