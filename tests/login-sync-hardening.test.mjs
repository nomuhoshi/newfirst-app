// 登录 / 云存档 / 离线保存 / 跨设备同步的专项回归测试（纯 Node，不联网、不连任何 Supabase 项目）。
// 覆盖：项目隔离、不同邮箱、离线 XP 只上传一次、强制退出后继续上传、坏凭证不联网、
//       云端关闭零请求、测试配置拒绝正式项目伪装网址、旧存档升级、游客记录导入后又有新进度。
// 运行：node tests/login-sync-hardening.test.mjs
import { readFileSync } from "node:fs";
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { saveAccount, setCurrentAccount, loadAccount, getCurrentAccount, GUEST_KEY, getGuestId, DEVICE_KEY, clearGuestAfterVerified } from "../src/account-store.js";
import { emptyDoc, docToState, sumXp, guestToDoc, guestFingerprint, guestImportStatus, replaceWithGuest, normalizeDoc, mergeDocs, docsEquivalent, mergeGuestProgress } from "../src/account-data.js";
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
// DB-3.1 退出异常：用真实的 cloud-api 把“服务器返回什么”翻译成 signOut 的返回值，fake 直接复用，保证测试和真实翻译一致
const SHAPE_SESS = { accessToken: "at", refreshToken: "rt", expiresAt: 1, userId: "u", email: "a@b.c" };
async function signOutShape(status, body) {
  const api = createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn: async () => ({ ok: false, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) }) });
  return api.signOut(SHAPE_SESS);
}
const SO_SHAPES = {
  gone: await signOutShape(403, { code: 403, error_code: "session_not_found", msg: "Session from session_id claim in JWT does not exist" }),
  forbidden: await signOutShape(403, { code: 403, error_code: "not_admin", msg: "User not allowed" }),
  route404: await signOutShape(404, "404 page not found"),
  proxy502: await signOutShape(502, "<html>Bad Gateway</html>"),
  badJwt: await signOutShape(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token has invalid claims: token is expired" }),
};
// 刷新令牌已被撤销 / 已用过：服务器真实返回 400 + 错误码（见 Q 段说明），由真实 cloud-api 翻译
const RF_SHAPES = {
  notFound: await (async () => createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }) }) }).refresh(SHAPE_SESS))(),
  alreadyUsed: await (async () => createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn: async () => ({ ok: false, status: 400, text: async () => JSON.stringify({ code: 400, error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" }) }) }).refresh(SHAPE_SESS))(),
};
function fakeCloud() {
  const users = new Map(), rows = new Map(), tokens = new Map(), calls = [];
  let seq = 0;
  const state = { online: true };
  const net = { ok: false, kind: "network", message: "网络连不上" };
  const authErr = { ok: false, kind: "auth", message: "登录已失效" };
  // 会话级撤销（DB-3.1）：每次验证码登录 = 一个新会话 sid；refresh 沿用 sid；signOut 按 scope 撤销 refresh token。
  // access token（JWT）撤销后到过期前仍然有效，和 Supabase 一致。signOut 不带 scope 时按 Supabase 默认 = global。
  const sidOf = new Map(), revokedSids = new Set(), sidUser = new Map();
  const issue = (uid, email, sid = "s" + (++seq)) => {
    const at = "at-" + (++seq), rt = "rt-" + seq;
    tokens.set(at, uid); tokens.set(rt, uid); sidOf.set(at, sid); sidOf.set(rt, sid); sidUser.set(sid, uid);
    return { accessToken: at, refreshToken: rt, expiresAt: NOW + 3600_000, userId: uid, email };
  };
  const usedRt = new Set();
  const uidOf = (s) => tokens.get(s?.accessToken);
  const api = {
    calls, state, users, rows, tokens, revokedSids, sidOf,
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
      const sid = sidOf.get(s?.refreshToken);
      if (!uid || revokedSids.has(sid)) return RF_SHAPES.notFound;
      if (usedRt.has(s.refreshToken)) return RF_SHAPES.alreadyUsed; // 刷新令牌一次性：旧的用过就作废（真实 Supabase 同样）
      usedRt.add(s.refreshToken);
      return { ok: true, session: issue(uid, s.email, sid) };
    },
    async signOut(s, scope = "global") {
      calls.push(["signOut", scope]);
      const mode = state.signOutMode || "ok"; // ok | fail(没撤销，返回断网) | lost-response(已撤销，但响应丢了) | invalid(401)
      if (mode === "fail") return net;
      if (mode === "invalid" || mode === "gone") return SO_SHAPES.gone;
      if (mode === "forbidden" || mode === "route404" || mode === "proxy502") return SO_SHAPES[mode];
      if (mode === "bad-jwt") return SO_SHAPES.badJwt;
      if (mode === "bad-jwt-once") { state.signOutMode = "ok"; return SO_SHAPES.badJwt; }
      const uid = tokens.get(s?.accessToken), sid = sidOf.get(s?.accessToken);
      if (!uid) return authErr;
      for (const [x, u] of sidUser) {
        if (u !== uid) continue;
        if (scope === "global" || (scope === "local" && x === sid) || (scope === "others" && x !== sid)) revokedSids.add(x);
      }
      return mode === "lost-response" ? net : { ok: true };
    },
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
  const docIn = clone(doc); // 每个场景用自己的文档，不改调用方手里的那份
  if (legacy !== null) docIn.imported[gid] = legacy;
  const cloud = fakeCloud();
  cloud.users.set(email, userId);
  cloud.rows.set(userId, { doc: clone(docIn), rev });
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
// 场景 9 自己造数据（111/22 XP、U9L9），不借用 I.11 或共享的 g80。
{
  const cloudDoc = emptyDoc({ gen: 5, lineage: "L-scene9" });
  cloudDoc.xp = { devA: 111, devB: 22 }; cloudDoc.runs = { devA: 6, devB: 2 };
  cloudDoc.done = { U9L1: "2026-09-01", U9L9: "2026-09-09" };
  cloudDoc.days = ["2026-09-01", "2026-09-09"];
  cloudDoc.hearts = { n: 3, msToNext: 90000 };
  cloudDoc.prefs = { sound: false, haptics: false, soundStyle: "A" };
  cloudDoc.imported = { Gother: "deadbeef" };
  const c = makeCase({ guest: guestWith({ xp: 70, lessons: 3, done: { U9L3: true } }), doc: cloudDoc, legacy: null });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", c.guest);
  check("I.9 准备：新游客编号（没有 imported 记录）→ 弹窗", v.ok && v.needChoice === true);
  const r = await sy.finishChoice("transfer");
  const row = rowOfCase(c);
  check("I.9 安全合并：其他设备 XP / 次数完整保留（devA=111, devB=22）", row.doc.xp.devA === 111 && row.doc.xp.devB === 22 && row.doc.runs.devA === 6 && row.doc.runs.devB === 2, JSON.stringify(row.doc.xp));
  check("I.9 安全合并：其他设备关卡和日期取并集，不覆盖", row.doc.done.U9L1 === "2026-09-01" && row.doc.done.U9L9 === "2026-09-09" && Object.hasOwn(row.doc.done, "U9L3") && row.doc.days.includes("2026-09-09") && row.doc.days.includes(TODAY), JSON.stringify({ done: row.doc.done, days: row.doc.days }));
  check("I.9 安全合并：红心 / 设置保留云端最新值", row.doc.hearts.n === 3 && row.doc.hearts.msToNext === 90000 && row.doc.prefs.sound === false && row.doc.prefs.soundStyle === "A", JSON.stringify({ hearts: row.doc.hearts, prefs: row.doc.prefs }));
  check("I.9 安全合并：gen / lineage 不变，其他游客的 imported 记录保留", row.doc.gen === 5 && row.doc.lineage === "L-scene9" && row.doc.imported.Gother === "deadbeef" && row.doc.imported[c.gid] === guestFingerprint(c.guest), JSON.stringify({ gen: row.doc.gen, lineage: row.doc.lineage, imported: row.doc.imported }));
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
// 场景 11 自己造数据（云端 41 XP、游客 64 XP、关卡 U11L2），不跟场景 9 共用文档。
{
  const guest11 = guestWith({ xp: 64, lessons: 2, done: { U11L2: true }, lastDay: "2026-11-11" });
  const c = makeCase({ guest: guest11, doc: bigCloud({ device: DEVICE, xp: 41, runs: 3, lineage: "L-scene11" }) });
  const sy = makeSync(c.st, c.cloud);
  const v = await sy.verify(c.email, "123456", guest11);
  check("I.11 准备：弹窗已挂起", v.ok && v.needChoice === true);
  const origGet = c.cloud.getProgress; let gets = 0;
  c.cloud.getProgress = async (s) => { gets++; return gets === 2 ? { ok: false, kind: "network", message: "读回失败（测试注入）" } : origGet(s); };
  const r = await sy.finishChoice("transfer");
  check("I.11 读回失败：上传本身成功（云端 64，含 U11L2），但只算待同步，不把“写成功”当成“读回一致”", r.ok && r.synced === false && r.verified !== true && xpOf(c.cloud, c.email) === 64 && Object.hasOwn(rowOfCase(c).doc.done, "U11L2"), JSON.stringify({ r, xp: xpOf(c.cloud, c.email), gets, done: rowOfCase(c).doc.done }));
  check("I.11 读回失败：游客记录逐字保留，不删除", r.guestCleared !== true && c.st.getItem(GUEST_KEY) === c.raw);
  check("I.11 读回失败：本机账号副本是刚上传的 64，没有回退到云端原来的 41", sumXp(stateOf(c.st).doc) === 64 && stateOf(c.st).doc.xp[DEVICE] === 64);
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

// ======================================================================
// K. DB-2 独立业务逻辑审查（Sonnet 2026-11-06）：对 J 的逐条对抗核对
//    1 保留云端写失败：状态 / 专用重试 / 游客保留（含 auth 类失败、强制退出后重登、游客期间又学习、换号隔离）
//    2 安全合并上传失败 / 读回失败 / 读回不一致：pending 与 dirty 标记（含 create 路径、重试期间改红心）
//    3 旧 imported=true 不得覆盖待上传的新指纹（合并两个方向 + 重试遇并发写）
//    4 重试成功后 XP / 次数 / 日期不重复，游客最多删除一次（含待办清除失败、游客删除失败、清除后游客又学习）
// ======================================================================
function spyStore(st) {
  const o = {
    _m: st._m, removed: [], failRemoveOnce: new Set(),
    getItem: (k) => st.getItem(k), setItem: (k, v) => st.setItem(k, v),
    removeItem: (k) => {
      if (o.failRemoveOnce.has(k)) { o.failRemoveOnce.delete(k); throw new Error("denied once"); }
      if (st._m.has(k)) o.removed.push(k);
      st.removeItem(k);
    },
  };
  return o;
}
const guestRemovals = (st) => st.removed.filter((k) => k === GUEST_KEY).length;
const failSaves = (cloud, kind = "network") => { const orig = cloud.saveProgress; cloud.saveProgress = async () => ({ ok: false, kind, message: "写云失败（K 注入：" + kind + "）" }); return () => { cloud.saveProgress = orig; }; };
const g95 = guestWith({ xp: 95, lessons: 6, done: { ...DONE4, U1L5: true, U1L6: true } });

// ---- K.1 保留云端写失败（network / server / auth）：未同步、游客保留、有待办；强制退出后重登自动重试 ----
for (const kind of ["network", "server", "auth"]) {
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k1-" + kind }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud, kind);
  const r = await sy.finishChoice("cloud");
  const copy = stateOf(c.st), fp = guestFingerprint(g80);
  check(`K.1[${kind}] 写指纹失败：未同步、本机不含新指纹、游客逐字保留、云端旧 true 不动`, r.ok && r.synced === false && copy.doc.imported[c.gid] !== fp && c.st.getItem(GUEST_KEY) === c.raw && rowOfCase(c).doc.imported[c.gid] === true, JSON.stringify({ r: { ok: r.ok, synced: r.synced }, imp: copy?.doc.imported[c.gid] }));
  check(`K.1[${kind}] 状态是待同步且有专用待办（不是已同步）`, sy.status().pending === true && sy.status().status === "pending" && pendingImportKeys(c.st).length === 1, JSON.stringify(sy.status()));
  restore();
  // 强制退出：待办必须留着；同账号重登自动重试
  const lo = await sy.logout({ force: true });
  check(`K.1[${kind}] 强制退出后待办仍在、游客仍在`, lo.ok && pendingImportKeys(c.st).length === 1 && c.st.getItem(GUEST_KEY) === c.raw, JSON.stringify(lo));
  const sy2 = makeSync(c.st, c.cloud);
  const v2 = await sy2.verify(c.email, "123456", g80);
  const row = rowOfCase(c);
  check(`K.1[${kind}] 同账号重登：不再弹窗，自动重试写入新指纹，待办清除，XP 仍 500`, v2.ok && !v2.needChoice && row.doc.imported[c.gid] === fp && pendingImportKeys(c.st).length === 0 && sumXp(row.doc) === 500 && sy2.status().status === "synced", JSON.stringify({ v2: { ok: v2.ok, need: v2.needChoice, synced: v2.synced }, imp: row.doc.imported[c.gid], keys: pendingImportKeys(c.st), st: sy2.status() }));
  check(`K.1[${kind}] 保留云端本来就不删游客`, c.st.getItem(GUEST_KEY) === c.raw);
}

// ---- K.1b 保留云端写失败后游客又学习：重试写的是当时选择的快照指纹，不覆盖游客新内容，下次登录重新提示 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k1b" }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud);
  await sy.finishChoice("cloud");
  restore();
  c.st.setItem(GUEST_KEY, JSON.stringify(g95)); // 待办期间游客又学了 15 XP
  const sy2 = makeSync(c.st, c.cloud);
  sy2.restore(freshState());
  const rr = await sy2.syncNow();
  check("K.1b 重试成功：云端写的是选择时的快照指纹（g80），不是新的 g95", rr.ok && rowOfCase(c).doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ rr: rr.ok, imp: rowOfCase(c).doc.imported[c.gid] }));
  check("K.1b 游客新学的内容逐字保留", c.st.getItem(GUEST_KEY) === JSON.stringify(g95));
  await sy2.logout();
  const sy3 = makeSync(c.st, c.cloud);
  const v3 = await sy3.verify(c.email, "123456", g95);
  check("K.1b 再次登录：指纹对不上 → 必须重新提示（不静默丢游客新进度）", v3.ok && v3.needChoice === true, JSON.stringify(v3));
}

// ---- K.1c 待办按账号隔离：另一个邮箱登录，不会执行别人的待办，也不会动别人的待办 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k1c" }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud);
  await sy.finishChoice("cloud");
  restore();
  await sy.logout({ force: true });
  const rec0 = c.st.getItem("suipian.acct.import." + c.userId);
  const sy2 = makeSync(c.st, c.cloud);
  const v = await sy2.verify("other@example.com", "123456", g80);
  check("K.1c 另一个邮箱：游客仍有学习记录 → 弹窗，不执行 uLegacy 的待办", v.ok && v.needChoice === true && rowOfCase(c).doc.imported[c.gid] === true, JSON.stringify(v));
  check("K.1c uLegacy 的待办原样保留", c.st.getItem("suipian.acct.import." + c.userId) === rec0 && rec0 !== null);
}

// ---- K.2 安全合并：上传失败 → 待同步；重试期间改红心 → dirty 不丢；再失败仍不丢；最终成功只合并一次 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k2", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  c.st = spyStore(c.st);
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud);
  const r = await sy.finishChoice("merge");
  let copy = stateOf(c.st);
  check("K.2 上传失败：待同步、游客保留、本机副本含合并结果但无新指纹、dirty.content=true", r.ok && r.synced === false && sy.status().status === "pending" && c.st.getItem(GUEST_KEY) === c.raw && copy.doc.xp[DEVICE] === 80 && copy.doc.imported[c.gid] === true && copy.dirty.content === true, JSON.stringify({ r: { ok: r.ok, synced: r.synced }, st: sy.status(), xp: copy?.doc.xp, imp: copy?.doc.imported[c.gid], dirty: copy?.dirty }));
  const dev = { sync: sy, state: r.state };
  dev.state.hearts = 2; sy.persistLocal(dev.state);
  copy = stateOf(c.st);
  check("K.2 失败后改红心：dirty.hearts 与 dirty.content 同时为真", copy.dirty.hearts === true && copy.dirty.content === true, JSON.stringify(copy.dirty));
  const rr1 = await sy.syncNow();
  copy = stateOf(c.st);
  check("K.2 再失败一次：dirty 标记、游客、XP（80，不是 160）都不变", !rr1.ok && copy.dirty.hearts === true && copy.dirty.content === true && copy.doc.xp[DEVICE] === 80 && c.st.getItem(GUEST_KEY) === c.raw && pendingImportKeys(c.st).length === 1, JSON.stringify({ rr1: rr1.ok, dirty: copy.dirty, xp: copy.doc.xp }));
  restore();
  const rr2 = await sy.syncNow();
  const row = rowOfCase(c); copy = stateOf(c.st);
  check("K.2 成功：XP 80 / 次数 5 只一份，红心用本机改过的 2，imported 为新指纹", rr2.ok && row.doc.xp[DEVICE] === 80 && row.doc.runs[DEVICE] === 5 && sumXp(row.doc) === 80 && row.doc.hearts.n === 2 && row.doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ xp: row.doc.xp, runs: row.doc.runs, hearts: row.doc.hearts, imp: row.doc.imported[c.gid] }));
  check("K.2 成功后 dirty 全部清零、待办清除、游客只删一次", copy.dirty.hearts === false && copy.dirty.content === false && pendingImportKeys(c.st).length === 0 && guestRemovals(c.st) === 1 && c.st.getItem(GUEST_KEY) === null, JSON.stringify({ dirty: copy.dirty, keys: pendingImportKeys(c.st), removals: guestRemovals(c.st) }));
}

// ---- K.2b 安全合并走“创建”路径（云端还没有记录）失败后重试：lineage 不变，不重复 ----
{
  const st = mem(); st.setItem(DEVICE_KEY, DEVICE); st.setItem(GUEST_KEY, JSON.stringify(g80));
  const cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const v = await sy.verify("fresh@example.com", "123456", g80);
  const uid = cloud.users.get("fresh@example.com");
  const origCreate = cloud.createProgress;
  cloud.createProgress = async () => ({ ok: false, kind: "network", message: "创建失败（K 注入）" });
  const r = await sy.finishChoice("merge");
  const lin1 = loadAccount(st, uid, { now: NOW }).copy?.doc.lineage;
  check("K.2b 云端无记录且创建失败：待同步、游客保留、本机副本已有合并结果", v.needChoice === true && r.ok && r.synced === false && st.getItem(GUEST_KEY) === JSON.stringify(g80) && loadAccount(st, uid, { now: NOW }).copy?.doc.xp[DEVICE] === 80, JSON.stringify({ v: v.needChoice, r: { ok: r.ok, synced: r.synced } }));
  cloud.createProgress = origCreate;
  const sy2 = makeSync(st, cloud); sy2.restore(freshState());
  const rr = await sy2.syncNow();
  const row = cloud.rows.get(uid);
  check("K.2b 重试创建成功：lineage 与失败时本机副本一致，XP 80 / 次数 5 只一份，游客删除", rr.ok && row.doc.lineage === lin1 && row.doc.xp[DEVICE] === 80 && row.doc.runs[DEVICE] === 5 && st.getItem(GUEST_KEY) === null && pendingImportKeys(st).length === 0, JSON.stringify({ lin1, lin2: row?.doc.lineage, xp: row?.doc.xp, runs: row?.doc.runs }));
}

// ---- K.3 imported 合并：旧 true 在任何参数顺序下都不能盖掉字符串指纹 ----
{
  const mk = (imp) => { const d = bigCloud({ gen: 3, lineage: "L-k3" }); d.imported = imp; return d; };
  check("K.3 mergeDocs(本机 指纹, 云端 true) → 指纹", mergeDocs(mk({ G: "deadbeef" }), mk({ G: true })).doc.imported.G === "deadbeef");
  check("K.3 mergeDocs(本机 true, 云端 指纹) → 指纹", mergeDocs(mk({ G: true }), mk({ G: "deadbeef" })).doc.imported.G === "deadbeef");
  check("K.3 mergeDocs(本机 true, 云端 没有) → 仍是 true；(没有, true) → true", mergeDocs(mk({ G: true }), mk({})).doc.imported.G === true && mergeDocs(mk({}), mk({ G: true })).doc.imported.G === true);
  check("K.3 normalizeDoc：非法指纹字符串不被当成指纹，降级为 true", normalizeDoc({ ...mk({}), imported: { G: "not-a-fp" } }).doc.imported.G === true);
}

// ---- K.3b 待办重试遇并发：其他设备在期间写了 XP（imported 仍是旧 true）+ 一次 CAS 冲突 → 新指纹落地、他人数据不丢 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k3b", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud);
  await sy.finishChoice("merge");
  restore();
  const row0 = rowOfCase(c); row0.doc.xp.devB = 10; row0.rev++; // 别的设备写入，imported 仍是旧 true
  const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState());
  const orig = c.cloud.saveProgress; let n = 0;
  c.cloud.saveProgress = async (s, rev, doc) => { if (n++ === 0) { rowOfCase(c).doc.xp.devC = 5; rowOfCase(c).rev++; } return orig(s, rev, doc); };
  const rr = await sy2.syncNow();
  const row = rowOfCase(c);
  check("K.3b 重试遇 CAS 冲突：新指纹是字符串（不是旧 true），devB / devC 的 XP 保留，本机设备只 80", rr.ok && row.doc.imported[c.gid] === guestFingerprint(g80) && row.doc.xp.devB === 10 && row.doc.xp.devC === 5 && row.doc.xp[DEVICE] === 80 && sumXp(row.doc) === 95, JSON.stringify({ imp: row.doc.imported[c.gid], xp: row.doc.xp }));
}

// ---- K.4 重试成功后“只做一次”：待办清除失败 / 游客删除失败 / 清除后游客又学习 ----
{ // A 待办清除失败：云端已写、游客已删；重试不再删、不重复加
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k4a", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  c.st = spyStore(c.st);
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  c.st.failRemoveOnce.add("suipian.acct.import." + c.userId);
  const r = await sy.finishChoice("merge");
  check("K.4A 待办清除失败：云端已合并一次、游客已删一次，但状态仍是待同步（会重试）", r.ok && sumXp(rowOfCase(c).doc) === 80 && guestRemovals(c.st) === 1 && sy.status().pending === true && pendingImportKeys(c.st).length === 1, JSON.stringify({ r: { ok: r.ok, synced: r.synced }, xp: sumXp(rowOfCase(c).doc), removals: guestRemovals(c.st), st: sy.status() }));
  const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState());
  const rr = await sy2.syncNow();
  const row = rowOfCase(c);
  check("K.4A 重试：待办清掉、游客没有第二次删除、XP 80 / 次数 5 / 日期无重复", rr.ok && pendingImportKeys(c.st).length === 0 && guestRemovals(c.st) === 1 && row.doc.xp[DEVICE] === 80 && row.doc.runs[DEVICE] === 5 && row.doc.days.length === new Set(row.doc.days).size, JSON.stringify({ keys: pendingImportKeys(c.st), removals: guestRemovals(c.st), xp: row.doc.xp, runs: row.doc.runs, days: row.doc.days }));
}
{ // B 游客删除失败：云端已写；状态必须是待同步（不得显示已同步）；重试删一次
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k4b", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  c.st = spyStore(c.st);
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  c.st.failRemoveOnce.add(GUEST_KEY);
  const r = await sy.finishChoice("merge");
  check("K.4B 游客删除失败：云端已写一次，游客还在，待办保留", r.ok && sumXp(rowOfCase(c).doc) === 80 && c.st.getItem(GUEST_KEY) === c.raw && pendingImportKeys(c.st).length === 1, JSON.stringify({ xp: sumXp(rowOfCase(c).doc), keys: pendingImportKeys(c.st) }));
  check("K.4B 游客删除失败：状态必须是待同步，不得显示“已同步”", sy.status().pending === true && sy.status().status === "pending", JSON.stringify(sy.status()));
  const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState());
  const rr = await sy2.syncNow();
  check("K.4B 重试：游客只成功删除一次，XP 仍 80，待办清除", rr.ok && guestRemovals(c.st) === 1 && c.st.getItem(GUEST_KEY) === null && sumXp(rowOfCase(c).doc) === 80 && pendingImportKeys(c.st).length === 0, JSON.stringify({ removals: guestRemovals(c.st), xp: sumXp(rowOfCase(c).doc) }));
}
{ // C 待办清除失败 + 游客随后又学习：重试绝不删新游客；下次登录重新提示
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k4c", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  c.st = spyStore(c.st);
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  c.st.failRemoveOnce.add("suipian.acct.import." + c.userId);
  await sy.finishChoice("merge");
  c.st.setItem(GUEST_KEY, JSON.stringify(g95)); // 删除之后，用户又以游客身份学了新内容
  const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState());
  const rr = await sy2.syncNow();
  check("K.4C 重试不删除新的游客记录，总共只删过一次，XP 仍 80", rr.ok && c.st.getItem(GUEST_KEY) === JSON.stringify(g95) && guestRemovals(c.st) === 1 && sumXp(rowOfCase(c).doc) === 80, JSON.stringify({ guest: c.st.getItem(GUEST_KEY) === JSON.stringify(g95), removals: guestRemovals(c.st), xp: sumXp(rowOfCase(c).doc) }));
  await sy2.logout();
  const sy3 = makeSync(c.st, c.cloud);
  const v3 = await sy3.verify(c.email, "123456", g95);
  check("K.4C 下次登录：新游客内容触发提示", v3.ok && v3.needChoice === true, JSON.stringify(v3));
}

// ---- K.5 损坏的待办：不得静默当成“没有”去覆盖，也不得抛错 ----
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-k5" }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  await sy.verify(c.email, "123456", g80);
  const restore = failSaves(c.cloud);
  await sy.finishChoice("cloud");
  restore();
  const key = "suipian.acct.import." + c.userId;
  c.st.setItem(key, "{bad json");
  const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState());
  let threw = false, rr = null;
  try { rr = await sy2.syncNow(); } catch { threw = true; }
  check("K.5 待办损坏：syncNow 不抛错、明确失败、不上传、游客保留、损坏待办原样保留", !threw && rr && rr.ok === false && c.st.getItem(GUEST_KEY) === c.raw && c.st.getItem(key) === "{bad json" && rowOfCase(c).doc.imported[c.gid] === true, JSON.stringify({ threw, rr }));
}

// ---- K.6 clearGuestAfterVerified 是删游客的最后一道防线：逐项缺一不可（直接单测，不经过 sync.js 的外层核对）----
{
  const up = bigCloud({ gen: 2, lineage: "L-k6" }), rb = clone(up);
  const mk = (raw) => { const st = mem(); if (raw !== null) st.setItem(GUEST_KEY, raw); return st; };
  const raw = JSON.stringify(g80), newer = JSON.stringify(g95);
  const base = { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: rb, guestSnapshotRaw: raw };
  let st = mk(raw);
  check("K.6 全部条件满足 → 删除，且只删这一次（第二次返回 false，不再动存储）", clearGuestAfterVerified(st, base) === true && st.getItem(GUEST_KEY) === null && clearGuestAfterVerified(st, base) === false);
  st = mk(newer);
  check("K.6 游客记录已被改写（快照不一致）→ 不删，新内容逐字保留", clearGuestAfterVerified(st, base) === false && st.getItem(GUEST_KEY) === newer);
  st = mk(raw);
  const rbBad = clone(rb); rbBad.xp.devGhost = 1;
  check("K.6 读回与上传不一致 → 不删", clearGuestAfterVerified(st, { ...base, readBack: rbBad }) === false && st.getItem(GUEST_KEY) === raw);
  check("K.6 缺读回 / 缺上传 / 非用户选择转存 / 上传未成功 / 缺快照 → 全都不删", [{ readBack: null }, { uploaded: null }, { userChoseTransfer: false }, { uploadOk: false }, { guestSnapshotRaw: undefined }].every((o) => clearGuestAfterVerified(st, { ...base, ...o }) === false) && st.getItem(GUEST_KEY) === raw);
  const flaky = { getItem: () => { throw new Error("read denied"); }, setItem() {}, removeItem() { throw new Error("must not be called"); } };
  check("K.6 游客记录读取失败 → 不删（不把读不到当成可以删）", clearGuestAfterVerified(flaky, base) === false);
}

// ======================================================================
// L. 退出 / 删号 / 冲突停止 / 429 冷却（2026-11-06）
//    Case 10 的最终硬断言等 DB-2 验收，本段不加。
//    全部用假接口，不连接 Supabase，不发送验证码。
// ======================================================================
{
  const st = mem(), cloud = fakeCloud(), timers = [];
  const sy = makeSync(st, cloud, { schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; } });
  const logged = await login(sy, "cas5@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U5L2", 10);
  const origSave = cloud.saveProgress;
  let saves = 0;
  cloud.saveProgress = async (s, expected, doc) => {
    saves++;
    if (saves <= 5) return { ok: true, rev: null };
    return origSave(s, expected, doc);
  };
  const beforeTimers = timers.length;
  const first = await sy.syncNow();
  const copy = loadAccount(st, sy.account().userId, { now: NOW }).copy;
  const added = timers.slice(beforeTimers).filter((t) => t.ms > 0);
  check("Case 5a：连续被抢先 5 次后停止，不返回成功", saves === 5 && first.ok === false && first.retryable === false && /冲突太多次/.test(first.message || ""), JSON.stringify({ saves, first }));
  check("Case 5b：停止后本机仍是脏的、待同步（10 XP），不是只看错误状态", !!copy && sumXp(copy.doc) === 10 && copy.dirty.content === true && sy.status().pending === true && !!copy.doc.done.U5L2, JSON.stringify({ xp: copy && sumXp(copy.doc), dirty: copy?.dirty, status: sy.status() }));
  check("Case 5c：停止后没有盲目重试定时器", added.length === 0 && saves === 5, JSON.stringify(added));
  const second = await sy.syncNow();
  check("Case 5b：之后再同步可以上传这 10 XP", second.ok === true && saves === 6 && xpOf(cloud, "cas5@example.com") === 10, JSON.stringify({ second, saves, xp: xpOf(cloud, "cas5@example.com") }));
}
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "stay@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U1L1", 40);
  await sy.syncNow();
  const authBefore = st.getItem(AUTH_KEY);
  const copyBefore = sumXp(loadAccount(st, sy.account().userId, { now: NOW }).copy.doc);
  cloud.signOut = async () => { throw new Error("500 Internal Server Error"); };
  const out = await sy.logout();
  check("Case 7a：普通退出时 signOut 失败 → 保持登录", out.ok === false && out.stayed === true && sy.account() !== null && st.getItem(AUTH_KEY) === authBefore, JSON.stringify(out));
  check("Case 7a：signOut 失败时本机副本还在", (() => { const c = loadAccount(st, sy.account()?.userId, { now: NOW }).copy; return !!c && sumXp(c.doc) === copyBefore; })());
}
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "unsent@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U1L1", 15);
  await sy.syncNow();
  learn(dev, "U9L2", 15);
  const uid = sy.account().userId;
  const xpBefore = sumXp(loadAccount(st, uid, { now: NOW }).copy.doc);
  const realSet = st.setItem.bind(st);
  st.setItem = (k, v) => { if (String(k).includes("suipian.acct.")) throw new Error("full"); return realSet(k, v); };
  let signed = 0;
  cloud.signOut = async () => { signed++; return { ok: true }; };
  const synced = await sy.syncNow();
  const out = await sy.logout();
  check("普通退出：本机还没写上已同步副本时，同步如实失败(localWritebackFailed)，不退出、不调用 signOut、未上传进度还在", synced.ok === false && synced.kind === "local" && synced.localWritebackFailed === true && out.ok === false && out.pending === true && signed === 0 && sy.account() !== null && sumXp(loadAccount(st, uid, { now: NOW }).copy.doc) === xpBefore, JSON.stringify({ synced, out, signed, xpBefore }));
}
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "force-local@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U1L1", 40);
  const uid = sy.account().userId;
  cloud.signOut = async () => { throw new Error("500 Internal Server Error"); };
  const out = await sy.forceLocalLogout();
  const copy = loadAccount(st, uid, { now: NOW }).copy;
  check("Case 7b：强制本机退出清凭证，并说明云端会话可能仍有效", typeof sy.forceLocalLogout === "function" && out.ok === true && out.cloudSessionMaybeValid === true && out.warning === "cloud-session-maybe-valid" && /云端会话/.test(out.message || "") && sy.account() === null && st.getItem(AUTH_KEY) === null, JSON.stringify(out));
  check("Case 7b：强制退出仍留下未上传副本（40 XP）", !!copy && sumXp(copy.doc) === 40 && copy.dirty.content === true, JSON.stringify(copy && { xp: sumXp(copy.doc), dirty: copy.dirty }));
}
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  await login(sy, "cleanup@example.com", freshState());
  const uid = sy.account().userId;
  learn({ sync: sy, state: (await sy.syncNow(), docToState(loadAccount(st, uid, { now: NOW }).copy.doc, freshState(), NOW)) }, "U1L1", 40);
  await sy.syncNow();
  const beforeCopy = [...st._m.keys()].filter((k) => k.includes("suipian.acct." + uid)).map((k) => st.getItem(k)).join("|");
  st.removeItem = () => { throw new Error("Disk Fail"); };
  const out = await sy.deleteAccount();
  const afterCopy = [...st._m.keys()].filter((k) => k.includes("suipian.acct." + uid)).map((k) => st.getItem(k)).join("|");
  check("Case 8：删号已成功但本机清理失败 → 不宣称成功", out.ok !== true && out.pendingLocalCleanup === true && out.kind === "local-cleanup" && out.tokenRevokedLocally === true && out.copyIsolated === true, JSON.stringify(out));
  check("Case 8：状态是待本机清理，旧副本还在，内存里不再是登录态", sy.status().status === "pending-local-cleanup" && afterCopy === beforeCopy && beforeCopy.length > 0 && sy.account() === null, JSON.stringify({ status: sy.status(), same: afterCopy === beforeCopy }));
  const callsBefore = cloud.calls.length;
  await sy.syncNow();
  check("Case 8：清理失败后不再拿旧令牌发同步请求", cloud.calls.length === callsBefore, JSON.stringify(cloud.calls.slice(callsBefore)));
}
{
  const cloud = emptyDoc({ gen: 1, lineage: "A" });
  cloud.xp.devA = 500;
  cloud.done = { U1L1: "2026-11-01", U1L2: "2026-11-02" };
  cloud.runs.devA = 10;
  const backup = emptyDoc({ gen: 99, lineage: "B" });
  backup.xp.devA = 10;
  backup.done = { U1L1: "2026-11-01" };
  backup.runs.devA = 1;
  const m = mergeDocs(backup, cloud);
  check("Case 9：旧备份抬高 gen 不得覆盖较新云端（500 XP 和 U1L2 都在，身份仍是云端）", m.outcome === "merged" && sumXp(m.doc) >= 500 && !!m.doc.done.U1L2 && m.doc.gen === 1 && m.doc.lineage === "A" && m.doc.xp.devA === 500, JSON.stringify({ outcome: m.outcome, xp: m.doc && sumXp(m.doc), gen: m.doc?.gen, lineage: m.doc?.lineage }));
}
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-stop-retry", xp: 500, runs: 20 }), legacy: true });
  const timers = [];
  const sy = makeSync(c.st, c.cloud, { schedule: (fn, ms) => { timers.push(ms); return timers.length; } });
  await sy.verify(c.email, "123456", g80);
  const origSave = c.cloud.saveProgress;
  let saves = 0;
  c.cloud.saveProgress = async () => { saves++; return { ok: true, rev: null }; };
  await sy.finishChoice("cloud");
  const afterChoice = saves;
  const before = timers.length;
  const again = await sy.syncNow();
  check("五次冲突后停止盲目重试：再同步一轮也只再试 5 次，不安排退避", again.ok === false && again.kind === "conflict" && again.retryable === false && saves - afterChoice === 5 && timers.length === before, JSON.stringify({ again, saves, afterChoice, timers }));
  c.cloud.saveProgress = origSave;
  const ok = await sy.syncNow();
  check("五次冲突停止后，云端恢复时可以再同步完成", ok.ok === true && sy.status().status === "synced" && rowOfCase(c).doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ ok, status: sy.status(), imported: rowOfCase(c).doc.imported[c.gid] }));
}
{
  const clock = { t: NOW };
  const calls = [];
  const api = {
    async sendCode(email) { calls.push(["sendCode", email]); return { ok: false, kind: "rate-limit", message: "Too Many Requests" }; },
    async verifyCode() { calls.push(["verifyCode"]); return { ok: false, kind: "auth" }; },
    async getProgress() { calls.push(["getProgress"]); return { ok: false, kind: "rate-limit", message: "Too Many Requests" }; },
    async refresh() { return { ok: true, session: sess() }; },
    async signOut() { return { ok: true }; },
  };
  const sy = makeSync(mem(), api, { now: () => clock.t, schedule: () => 0 });
  const a = await sy.sendCode("cooldown@example.com");
  const b = await sy.sendCode("cooldown@example.com");
  check("429 冷却：第一次发信被限流后，冷却期内不再调用发信接口", a.kind === "rate-limit" && b.kind === "rate-limit" && calls.filter((c) => c[0] === "sendCode").length === 1, JSON.stringify(calls));
  clock.t += 60_000;
  await sy.sendCode("cooldown@example.com");
  check("429 冷却：过了一分钟才允许再调用发信接口（仍是假接口，没有真实验证码）", calls.filter((c) => c[0] === "sendCode").length === 2 && calls.every((c) => c[0] !== "verifyCode"), JSON.stringify(calls));
}
{
  const st = mem(), cloud = fakeCloud();
  const clock = { t: NOW };
  const timers = [];
  const sy = makeSync(st, cloud, { now: () => clock.t, schedule: (fn, ms) => { timers.push(ms); return timers.length; } });
  await login(sy, "limit@example.com", freshState());
  let gets = 0;
  cloud.getProgress = async () => { gets++; return { ok: false, kind: "rate-limit", message: "Too Many Requests" }; };
  const first = await sy.syncNow();
  const getsAfter = gets;
  const before = timers.length;
  const second = await sy.syncNow();
  check("429 冷却：同步被限流后不按网络退避重试，冷却期内不再读云端", first.kind === "rate-limit" && first.retryable === false && second.kind === "rate-limit" && gets === getsAfter && timers.length === before, JSON.stringify({ first, second, gets, timers }));
  clock.t += 60_000;
  cloud.getProgress = async (s) => { gets++; return { ok: true, row: cloud.rows.get(cloud.users.get("limit@example.com")) || null }; };
  const third = await sy.syncNow();
  check("429 冷却结束：可以再同步", third.ok === true && gets === getsAfter + 1, JSON.stringify({ third, gets }));
}
{
  let logoutCalls = 0;
  const api = createApi({
    url: "https://example.test/",
    anonKey: "pub",
    fetchFn: async (url) => {
      logoutCalls++;
      return { ok: false, status: 500, text: async () => JSON.stringify({ msg: "down" }) };
    },
  });
  const so = await api.signOut(sess());
  check("signOut 失败会把服务器错误交回去，不再假装成功", so.ok === false && so.kind === "server" && logoutCalls === 1 && !String(so.message || "").includes("supabase.co"), JSON.stringify(so));
}
{
  // 场景 9：自己的假服务器和自己的账号（scene9@example.com / 19 XP），不读场景 11 的行。
  // 客户端没有“直接 PATCH progress 表”的方法；保存只走 save_progress。真库的行级拒绝仍以 isolation.sql 为准，这里不连任何 Supabase。
  const calls = [];
  const api = createApi({
    url: "https://example.test/",
    anonKey: "pub",
    fetchFn: async (url, opt) => {
      calls.push({ url: String(url), method: opt?.method || "GET" });
      if (String(url).includes("/rest/v1/rpc/save_progress")) return { ok: true, status: 200, text: async () => "2" };
      return { ok: false, status: 401, text: async () => JSON.stringify({ message: "permission denied" }) };
    },
  });
  const saved = await api.saveProgress(sess("u-scene9", "scene9@example.com"), 1, { schema: 1, xp: { devScene9: 19 } });
  check("场景9：保存只请求 save_progress，不直接写 /rest/v1/progress", saved.ok === true && saved.rev === 2 && calls.length === 1 && calls[0].url.endsWith("/rest/v1/rpc/save_progress") && calls[0].method === "POST", JSON.stringify(calls));
  const cloud = fakeCloud();
  const st = mem();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "scene9@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U9L1", 19);
  await sy.syncNow();
  const uid = cloud.users.get("scene9@example.com");
  learn(dev, "U9L2", 4);
  const again = await sy.syncNow();
  check("场景9：这套自己的数据同步后是 23 XP，含 U9L2", again.ok === true && sumXp(cloud.rows.get(uid).doc) === 23 && cloud.rows.get(uid).doc.done.U9L1 && cloud.rows.get(uid).doc.done.U9L2, JSON.stringify(cloud.rows.get(uid).doc.xp));
}
{
  // 场景 11：另一套服务器和另一对设备，不读场景 9 的行。
  const cloud = fakeCloud();
  const aSt = mem(), bSt = mem();
  const a = makeSync(aSt, cloud);
  const b = makeSync(bSt, cloud);
  const la = await login(a, "scene11@example.com", freshState());
  const lb = await login(b, "scene11@example.com", freshState());
  const da = { sync: a, state: la.state };
  const db = { sync: b, state: lb.state };
  cloud.state.online = false;
  learn(da, "U11A", 15);
  learn(db, "U11B", 17);
  cloud.state.online = true;
  const ra = await a.syncNow();
  const rb = await b.syncNow();
  const row = cloud.rows.get(cloud.users.get("scene11@example.com"));
  check("场景11：两台设备各自的离线进度都在，总数 32，不丢关卡", ra.ok && rb.ok && sumXp(row.doc) === 32 && row.doc.done.U11A && row.doc.done.U11B, JSON.stringify({ ra, rb, xp: row.doc.xp, done: row.doc.done }));
}

// ======================================================================
// M. 清单 12：旧备份保护（2026-11-06，DB-3 整合）
//    旧备份 = 本机账号副本里一份过时的文档。它可能：rev 很旧、保存时间很旧（或被时钟拨到未来）、
//    gen 被抬得很高并换了 lineage（或沿用云端 lineage）。无论哪种，都不能覆盖较新的云端。
//    客户端不读 updated_at（那是服务端字段，只在 save_progress 里 now()）；唯一的写入凭证是“刚读到的 rev”（CAS），
//    副本里的旧 base 永远不会被拿去写云端。
// ======================================================================
const NEW_CLOUD = () => {
  const d = emptyDoc({ gen: 1, lineage: "L-cloud" });
  d.xp = { devA: 500, devB: 300 }; d.runs = { devA: 20, devB: 12 };
  d.done = { U1L1: "2026-10-01", U1L2: "2026-10-02", U2L1: "2026-10-03", U2L2: "2026-10-04" };
  d.days = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"];
  d.hearts = { n: 3, msToNext: 120000 }; d.prefs = { sound: false, haptics: true, soundStyle: "C" };
  return d;
};
const OLD_BACKUP = (over = {}) => {
  const d = emptyDoc({ gen: 1, lineage: "L-cloud" });
  d.xp = { devA: 10 }; d.runs = { devA: 1 }; d.done = { U1L1: "2026-10-01" }; d.days = ["2026-10-01"]; // 云端的真子集
  Object.assign(d, over);
  return d;
};
async function backupCase({ backup, base, savedAt, cloudDoc = NEW_CLOUD(), cloudRev = 9, dirty = { hearts: false, prefs: false, content: true } }) {
  const st = mem(); st.setItem(DEVICE_KEY, "devA");
  const cloud = fakeCloud(); cloud.users.set("bk@example.com", "uBk"); cloud.rows.set("uBk", { doc: clone(cloudDoc), rev: cloudRev });
  const notices = [];
  const sy = makeSync(st, cloud, { onNotice: (k) => notices.push(k) });
  const v = await sy.verify("bk@example.com", "123456", freshState());
  // 把本机副本换成这份“旧备份”
  saveAccount(st, "uBk", { doc: backup, base, dirty }, { now: savedAt });
  const before = clone(cloud.rows.get("uBk"));
  cloud.calls.length = 0;
  const r = await sy.syncNow();
  const saves = cloud.calls.filter((c) => c[0] === "saveProgress").map((c) => c[1]);
  return { st, cloud, sy, v, r, before, after: clone(cloud.rows.get("uBk")), saves, notices };
}

// ---- M.1 旧 rev：副本 base=1，云端 rev=9。写云端只能用刚读到的 9；云端内容一个字不少 ----
{
  const c = await backupCase({ backup: OLD_BACKUP(), base: 1, savedAt: 1 });
  check("M.1 旧 rev 的旧备份：同步成功，云端 XP/runs/关卡/日期/红心/设置逐项不变", c.r.ok && JSON.stringify(c.after.doc) === JSON.stringify(c.before.doc), JSON.stringify({ r: c.r, after: c.after.doc.xp }));
  check("M.1 旧 rev 永远不会被拿去写云端（所有 saveProgress 的 expected_rev 只能是 9）", c.saves.every((x) => x === 9), JSON.stringify(c.saves));
  const l = loadAccount(c.st, "uBk", { now: NOW }).copy;
  check("M.1 同步后本机副本追上云端：base=9，XP 总数 800，不再有 content 脏标记", l.base === 9 && sumXp(l.doc) === 800 && l.dirty.content === false, JSON.stringify({ base: l.base, xp: sumXp(l.doc), dirty: l.dirty }));
}

// ---- M.2 旧 updated_at：副本保存时间在很久以前（1）或在遥远的未来（时钟被拨快）——都不能取得优先权 ----
for (const [label, savedAt] of [["很久以前", 1], ["遥远的未来(时钟拨快)", 4_102_444_800_000]]) {
  const c = await backupCase({ backup: OLD_BACKUP(), base: 3, savedAt });
  check(`M.2 副本保存时间${label}：云端不变，红心 / 设置沿用云端（不因“更晚保存”而被旧备份覆盖）`, c.r.ok && JSON.stringify(c.after.doc) === JSON.stringify(c.before.doc) && c.after.doc.hearts.n === 3 && c.after.doc.prefs.sound === false, JSON.stringify({ hearts: c.after.doc.hearts, prefs: c.after.doc.prefs }));
}

// ---- M.3 不同 lineage + 虚高 gen：不得取得覆盖权；云端其他设备的 XP / runs / 关卡 / 日期全保留，本机新增的并进去 ----
for (const [label, lineage] of [["不同 lineage", "L-forged"], ["同 lineage", "L-cloud"]]) {
  const bk = OLD_BACKUP({ gen: 999, lineage });
  bk.xp = { devA: 520, devC: 40 }; bk.runs = { devA: 21, devC: 3 }; bk.done = { ...bk.done, U9L9: "2026-11-05" }; bk.days = ["2026-11-05"];
  const c = await backupCase({ backup: bk, base: 2, savedAt: 1 });
  const d = c.after.doc;
  check(`M.3 虚高 gen(999)+${label}：不覆盖——云端身份不变 gen=1 lineage=L-cloud`, c.r.ok && d.gen === 1 && d.lineage === "L-cloud", JSON.stringify({ gen: d.gen, lineage: d.lineage, r: c.r }));
  check(`M.3 虚高 gen+${label}：devB 的 300 XP / 12 次保留，devA 取较大 520/21，devC 新增 40/3`, d.xp.devB === 300 && d.runs.devB === 12 && d.xp.devA === 520 && d.runs.devA === 21 && d.xp.devC === 40 && d.runs.devC === 3, JSON.stringify({ xp: d.xp, runs: d.runs }));
  check(`M.3 虚高 gen+${label}：云端四个关卡与四个日期全在，备份新增的 U9L9 与 2026-11-05 并入`, ["U1L1", "U1L2", "U2L1", "U2L2", "U9L9"].every((k) => d.done[k]) && d.done.U1L1 === "2026-10-01" && ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-11-05"].every((x) => d.days.includes(x)) && d.days.length === 5, JSON.stringify({ done: d.done, days: d.days }));
  check(`M.3 虚高 gen+${label}：没有触发“你的进度被别处覆盖”提示，rev 只前进一格（9→10）`, !c.notices.includes("replaced") && c.after.rev === 10 && c.saves.every((x) => x === 9), JSON.stringify({ notices: c.notices, rev: c.after.rev, saves: c.saves }));
}

// ---- M.4 对照：云端代数真的更高（另一台设备换代）→ 仍整份采用云端，旧一代不会复活，并提示 ----
{
  const cl = emptyDoc({ gen: 2, lineage: "L-new" }); cl.xp = { devB: 7 };
  const c = await backupCase({ backup: OLD_BACKUP(), base: 2, savedAt: 1, cloudDoc: cl, cloudRev: 4 });
  check("M.4 云端 gen 更高：云端不动，本机旧一代作废，且提示用户", c.r.ok && JSON.stringify(c.after.doc) === JSON.stringify(c.before.doc) && c.notices.includes("replaced") && sumXp(loadAccount(c.st, "uBk", { now: NOW }).copy.doc) === 7, JSON.stringify({ notices: c.notices }));
}

// ---- M.5 同代不同 lineage（两次独立覆盖）：不合并、不写云端、本机副本原样保留、留待用户选择 ----
{
  const bk = OLD_BACKUP({ gen: 1, lineage: "L-other" });
  const c = await backupCase({ backup: bk, base: 2, savedAt: 1 });
  const l = loadAccount(c.st, "uBk", { now: NOW }).copy;
  check("M.5 同 gen 不同 lineage：不写云端，云端原样；本机副本仍是那份备份（没被吞）", !c.r.ok && c.r.kind === "conflict" && JSON.stringify(c.after.doc) === JSON.stringify(c.before.doc) && c.saves.length === 0 && l.doc.lineage === "L-other" && l.dirty.content === true, JSON.stringify({ r: c.r, saves: c.saves }));
}

// ---- M.6 安全合并（游客）遇云端其他设备数据：runs / 日期 / 关卡 / gen / lineage 全保留 ----
{
  const cl = NEW_CLOUD(); cl.gen = 7; cl.lineage = "L-seven";
  const r = mergeGuestProgress(g80, { deviceId: DEVICE, guestId: "G-m6", cloudDoc: cl, now: NOW });
  const d = r.doc;
  check("M.6 安全合并：gen=7 / lineage 不变；其他设备 devA/devB 的 XP 和 runs 原样", r.ok && d.gen === 7 && d.lineage === "L-seven" && d.xp.devA === 500 && d.xp.devB === 300 && d.runs.devA === 20 && d.runs.devB === 12, JSON.stringify({ gen: d.gen, xp: d.xp, runs: d.runs }));
  check("M.6 安全合并：云端关卡与日期全部保留，游客的并进来；本设备 XP/次数按 max，不相加", ["U1L1", "U1L2", "U2L1", "U2L2", "U1L3", "U1L4"].every((k) => k in d.done) && ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"].every((x) => d.days.includes(x)) && d.xp[DEVICE] === 80 && d.runs[DEVICE] === 5 && d.hearts.n === 3 && d.prefs.sound === false, JSON.stringify({ xp: d.xp, done: Object.keys(d.done), hearts: d.hearts }));
}

// ======================================================================
// N. 清单 15：Case 10 全流程硬断言（旧 imported=true + 游客有新进度）
//    不止看函数返回值：逐项检查最终存储、rev、dirty / pending、游客保留、可重试性。
// ======================================================================
const writesOf = (cloud) => cloud.calls.filter((x) => x[0] === "saveProgress" || x[0] === "createProgress");
{
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-case10", device: DEVICE, xp: 70, runs: 4 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  const rowBefore = clone(rowOfCase(c));
  const v = await sy.verify(c.email, "123456", g80);
  check("N.1 Case 10：必须挂起让用户选择（不是静默 already-imported，也不是直接登录完成）", v.ok && v.needChoice === true, JSON.stringify(v));
  check("N.1 挂起期间存储：没写云端(0 次 save/create)、云端文档与 rev 逐字不变、没有账号副本、没有待办、没有当前账号", writesOf(c.cloud).length === 0 && JSON.stringify(rowOfCase(c)) === JSON.stringify(rowBefore) && rowOfCase(c).rev === 7 && stateOf(c.st) === null && pendingImportKeys(c.st).length === 0 && getCurrentAccount(c.st) === null && sy.account() === null, JSON.stringify({ writes: writesOf(c.cloud), rev: rowOfCase(c).rev, keys: pendingImportKeys(c.st) }));
  check("N.1 挂起期间游客记录逐字保留", c.st.getItem(GUEST_KEY) === c.raw);

  // 选择“安全合并”但写云失败 → 失败态必须可重试
  const restore = failSaves(c.cloud);
  const r = await sy.finishChoice("merge");
  const copy = stateOf(c.st);
  check("N.2 合并写失败：登录完成但未同步；云端 rev 仍是 7、文档不变", r.ok && r.synced === false && rowOfCase(c).rev === 7 && JSON.stringify(rowOfCase(c).doc) === JSON.stringify(rowBefore.doc), JSON.stringify({ r: { ok: r.ok, synced: r.synced }, rev: rowOfCase(c).rev }));
  check("N.2 合并写失败：游客逐字保留；本机副本含合并结果、dirty.content=true、无新指纹；专用待办存在；状态 pending", c.st.getItem(GUEST_KEY) === c.raw && copy.doc.xp[DEVICE] === 80 && copy.dirty.content === true && copy.doc.imported[c.gid] === true && pendingImportKeys(c.st).length === 1 && sy.status().status === "pending" && sy.status().pending === true, JSON.stringify({ dirty: copy?.dirty, imp: copy?.doc.imported[c.gid], keys: pendingImportKeys(c.st), st: sy.status() }));
  restore();
  // 重试：重开页面 → 恢复登录 → 同步
  const sy2 = makeSync(c.st, c.cloud);
  const restored = sy2.restore(freshState());
  check("N.3 重开页面：能恢复登录并知道有待办", !!restored && sy2.status().pending === true, JSON.stringify(sy2.status()));
  const rr = await sy2.syncNow();
  const row = rowOfCase(c), copy2 = stateOf(c.st);
  check("N.3 重试成功：云端 rev 7→8，XP 80 / 次数 5 只一份，imported 是新指纹字符串", rr.ok && row.rev === 8 && row.doc.xp[DEVICE] === 80 && row.doc.runs[DEVICE] === 5 && row.doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ rr, rev: row.rev, xp: row.doc.xp, imp: row.doc.imported[c.gid] }));
  check("N.3 重试成功：游客已删(1 次)、待办清空、本机副本 base=8 且 dirty 全清、状态 synced", c.st.getItem(GUEST_KEY) === null && pendingImportKeys(c.st).length === 0 && copy2.base === 8 && !copy2.dirty.content && !copy2.dirty.hearts && !copy2.dirty.prefs && sy2.status().status === "synced" && sy2.status().pending === false, JSON.stringify({ base: copy2.base, dirty: copy2.dirty, st: sy2.status() }));
  const rev8 = rowOfCase(c).rev;
  await sy2.syncNow(); await sy2.syncNow();
  check("N.3 再同步两次：不再写云端（rev 仍 8），不重复合并", rowOfCase(c).rev === rev8 && sumXp(rowOfCase(c).doc) === 80, JSON.stringify({ rev: rowOfCase(c).rev }));
}
{ // 选“保留云端”：rev 只前进一格，只有 imported 变；游客保留；本机副本干净
  const c = makeCase({ guest: g80, doc: bigCloud({ gen: 2, lineage: "L-case10b", xp: 500, runs: 20 }), legacy: true });
  const sy = makeSync(c.st, c.cloud);
  const before = clone(rowOfCase(c).doc);
  await sy.verify(c.email, "123456", g80);
  const r = await sy.finishChoice("cloud");
  const row = rowOfCase(c), copy = stateOf(c.st);
  const strip = (d) => { const x = clone(d); delete x.imported; return x; };
  check("N.4 保留云端：rev 7→8，除 imported 外文档逐字不变（XP 仍 500，没加游客）", r.ok && r.synced === true && row.rev === 8 && JSON.stringify(strip(row.doc)) === JSON.stringify(strip(before)) && row.doc.imported[c.gid] === guestFingerprint(g80), JSON.stringify({ rev: row.rev, imp: row.doc.imported[c.gid] }));
  check("N.4 保留云端：游客保留、待办清空、本机副本 base=8 且干净、状态 synced", c.st.getItem(GUEST_KEY) === c.raw && pendingImportKeys(c.st).length === 0 && copy.base === 8 && !copy.dirty.content && sy.status().status === "synced", JSON.stringify({ base: copy.base, dirty: copy.dirty, st: sy.status() }));
}

// ---- N.5 清单 6：失败路径矩阵。每种失败点 × 两种选择：游客 / 待办 / 本机副本都保住，不谎报完成，故障排除后能恢复且只做一次 ----
function flakyStore(st) {
  const o = { _m: st._m, removed: [], failSet: new Set(), getItem: (k) => st.getItem(k), setItem: (k, v) => { if (o.failSet.has(k)) throw new Error("quota exceeded"); st.setItem(k, v); }, removeItem: (k) => { if (st._m.has(k)) o.removed.push(k); st.removeItem(k); } };
  return o;
}
for (const choice of ["cloud", "merge"]) {
  for (const fault of ["read-latest", "cas-exhaust", "local-save"]) {
    const tag = `N.5[${choice}/${fault}]`;
    const doc = choice === "merge" ? bigCloud({ gen: 2, lineage: "L-n5-" + fault, device: DEVICE, xp: 70, runs: 4 }) : bigCloud({ gen: 2, lineage: "L-n5-" + fault, xp: 500, runs: 20 });
    const c = makeCase({ guest: g80, doc, legacy: true });
    c.st = flakyStore(c.st);
    const sy = makeSync(c.st, c.cloud);
    const v = await sy.verify(c.email, "123456", g80);
    const rowBefore = clone(rowOfCase(c));
    const origGet = c.cloud.getProgress, origSave = c.cloud.saveProgress;
    if (fault === "read-latest") c.cloud.getProgress = async () => ({ ok: false, kind: "network", message: "断网（N.5 注入）" });
    if (fault === "cas-exhaust") c.cloud.saveProgress = async () => ({ ok: true, rev: null });
    if (fault === "local-save") c.st.failSet.add("suipian.acct." + c.userId);
    const r = await sy.finishChoice(choice);
    const claimsDone = r.ok && r.synced === true && r.verified !== false && !r.pending;
    check(`${tag} 挂起 → 故障：没有谎报完成（不是 synced+无 pending）`, v.needChoice === true && !claimsDone, JSON.stringify({ ok: r.ok, synced: r.synced, pending: r.pending, kind: r.kind }));
    check(`${tag} 故障后：游客逐字保留、专用待办在、没有删过游客`, c.st.getItem(GUEST_KEY) === c.raw && pendingImportKeys(c.st).length === 1 && guestRemovals(c.st) === 0, JSON.stringify({ keys: pendingImportKeys(c.st), removed: c.st.removed }));
    if (fault !== "local-save") check(`${tag} 故障后：云端文档与 rev 逐字不变`, JSON.stringify(rowOfCase(c)) === JSON.stringify(rowBefore), JSON.stringify(rowOfCase(c)));
    else check(`${tag} 故障后：云端已写入新指纹（上传成功），但本机登录没完成`, rowOfCase(c).doc.imported[c.gid] === guestFingerprint(g80) && r.ok === false, JSON.stringify({ imp: rowOfCase(c).doc.imported[c.gid], ok: r.ok }));
    if (fault === "cas-exhaust") {
      const cp = stateOf(c.st);
      check(`${tag} 冲突用尽：本机副本已保存，状态待同步；merge 时 dirty.content=true、含合并结果；cloud 时不带新指纹`, !!cp && sy.status().pending === true && (choice === "merge" ? cp.dirty.content === true && cp.doc.xp[DEVICE] === 80 : cp.doc.imported[c.gid] !== guestFingerprint(g80)), JSON.stringify({ dirty: cp?.dirty, st: sy.status() }));
    }
    // 排除故障后恢复
    c.cloud.getProgress = origGet; c.cloud.saveProgress = origSave; c.st.failSet.clear();
    let fin;
    if (r.ok) { const sy2 = makeSync(c.st, c.cloud); sy2.restore(freshState()); fin = await sy2.syncNow(); }
    else fin = await sy.finishChoice(choice);
    const row = rowOfCase(c), cp2 = stateOf(c.st);
    check(`${tag} 恢复后：成功，指纹落地，待办清空，本机副本 dirty 全清且含新指纹`, (fin.ok) && row.doc.imported[c.gid] === guestFingerprint(g80) && pendingImportKeys(c.st).length === 0 && cp2 && cp2.doc.imported[c.gid] === guestFingerprint(g80) && !cp2.dirty.content && !cp2.dirty.hearts && !cp2.dirty.prefs, JSON.stringify({ fin: { ok: fin.ok, kind: fin.kind }, keys: pendingImportKeys(c.st), imp: cp2?.doc.imported[c.gid], dirty: cp2?.dirty }));
    if (choice === "merge") check(`${tag} 恢复后：XP 80 / 次数 5 只一份，游客只删一次`, row.doc.xp[DEVICE] === 80 && row.doc.runs[DEVICE] === 5 && sumXp(row.doc) === 80 && c.st.getItem(GUEST_KEY) === null && guestRemovals(c.st) === 1, JSON.stringify({ xp: row.doc.xp, runs: row.doc.runs, removed: c.st.removed }));
    else check(`${tag} 恢复后：只写了指纹（XP 仍 500，没加游客），游客保留`, sumXp(row.doc) === 500 && c.st.getItem(GUEST_KEY) === c.raw && guestRemovals(c.st) === 0, JSON.stringify({ xp: sumXp(row.doc) }));
  }
}

// ======================================================================
// GPT DB-3 follow-up: 本机写回失败与强制退出凭证清理失败必须可恢复。
// ======================================================================
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "writeback-fail@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U1L1", 40);
  const uid = sy.account().userId;
  const originalSet = st.setItem;
  st.setItem = (key, value) => {
    if (key === `suipian.acct.${uid}`) throw new Error("quota exceeded");
    originalSet(key, value);
  };
  const first = await sy.syncNow();
  const localAfterFailure = loadAccount(st, uid, { now: NOW }).copy;
  const cloudAfterFailure = cloud.rows.get(uid);
  check(
    "DB-3 写回失败：不得谎报 synced，pending 保留且本机 XP/dirty 副本不变",
    first.ok === false && first.kind === "local" && first.retryable === true
      && sy.status().status === "pending" && sy.status().pending === true
      && !!localAfterFailure && sumXp(localAfterFailure.doc) === 40
      && localAfterFailure.dirty.content === true
      && !!cloudAfterFailure && sumXp(cloudAfterFailure.doc) === 40,
    JSON.stringify({ first, status: sy.status(), local: localAfterFailure?.dirty, cloudRev: cloudAfterFailure?.rev })
  );
  st.setItem = originalSet;
  const second = await sy.syncNow();
  const localAfterRetry = loadAccount(st, uid, { now: NOW }).copy;
  check(
    "DB-3 写回恢复：重试后本机副本同步、dirty 清空且 XP 不重复累计",
    second.ok === true && sy.status().status === "synced"
      && !!localAfterRetry && localAfterRetry.base === cloud.rows.get(uid).rev
      && !localAfterRetry.dirty.content
      && sumXp(localAfterRetry.doc) === 40
      && sumXp(cloud.rows.get(uid).doc) === 40,
    JSON.stringify({ second, local: localAfterRetry?.dirty, cloudRev: cloud.rows.get(uid)?.rev })
  );
}
{
  const st = mem(), cloud = fakeCloud();
  const sy = makeSync(st, cloud);
  const logged = await login(sy, "logout-auth-fail@example.com", freshState());
  const dev = { sync: sy, state: logged.state };
  learn(dev, "U1L1", 25);
  const uid = sy.account().userId;
  const authBefore = st.getItem(AUTH_KEY);
  const originalRemove = st.removeItem;
  const originalSet = st.setItem;
  st.removeItem = (key) => {
    if (key === AUTH_KEY) throw new Error("remove denied");
    originalRemove(key);
  };
  st.setItem = (key, value) => {
    if (key === AUTH_KEY) throw new Error("write denied");
    originalSet(key, value);
  };
  const failedLogout = await sy.forceLocalLogout();
  const preserved = loadAccount(st, uid, { now: NOW }).copy;
  check(
    "DB-3 凭证清理失败：不得宣称退出，账号指针、凭证和未上传副本保留",
    failedLogout.ok === false && sy.account()?.userId === uid
      && getCurrentAccount(st) === uid && st.getItem(AUTH_KEY) === authBefore
      && !!preserved && sumXp(preserved.doc) === 25 && preserved.dirty.content === true,
    JSON.stringify({ failedLogout, account: sy.account(), current: getCurrentAccount(st), dirty: preserved?.dirty })
  );
  st.removeItem = originalRemove;
  st.setItem = originalSet;
  const retriedLogout = await sy.forceLocalLogout();
  const afterLogout = loadAccount(st, uid, { now: NOW }).copy;
  check(
    "DB-3 凭证清理恢复：重试后本机退出成功，未上传学习副本仍保留",
    retriedLogout.ok === true && sy.account() === null && getCurrentAccount(st) === null
      && st.getItem(AUTH_KEY) === null
      && !!afterLogout && sumXp(afterLogout.doc) === 25 && afterLogout.dirty.content === true,
    JSON.stringify({ retriedLogout, current: getCurrentAccount(st), dirty: afterLogout?.dirty })
  );
}

// ======================================================================
// O. DB-3.1：退出顺序与云端会话撤销（GPT 独立审查发现，2026-11-06）
//    云端撤销 refresh token 不可逆 → 本机能失败的步骤必须排在云端撤销之前；退出只结束这台设备的会话（scope=local）。
//    fakeCloud 现在真实模拟：每次登录一个会话，signOut 按 scope 撤销 refresh token，access token 到期前仍有效，默认 scope=global。
// ======================================================================
async function twoDevices(email = "two@example.com") {
  const cloud = fakeCloud();
  const stA = flakyStore(mem()), stB = mem();
  stA.setItem(DEVICE_KEY, "devA"); stB.setItem(DEVICE_KEY, "devB");
  const A = makeSync(stA, cloud), B = makeSync(stB, cloud);
  const la = await login(A, email, freshState()), lb = await login(B, email, freshState());
  const uid = A.account().userId;
  return { cloud, stA, stB, A, B, la, lb, uid, devA: { sync: A, state: la.state } };
}
const copyXp = (st, uid) => { const c = loadAccount(st, uid, { now: NOW }).copy; return c ? sumXp(c.doc) : -1; };
const authSession = (st) => JSON.parse(st.getItem(AUTH_KEY)).session;
const refreshAlive = async (cloud, sess) => (await cloud.refresh(sess)).ok === true;
const signOutCalls = (cloud) => cloud.calls.filter((c) => c[0] === "signOut");
// 让某些键的 setItem / removeItem 抛错（flakyStore 已支持 failSet；这里补 failRemove）
function breakRemove(st, ...keys) { const real = st.removeItem; st.removeItem = (k) => { if (keys.includes(k)) throw new Error("remove denied: " + k); return real(k); }; return () => { st.removeItem = real; }; }
function breakSet(st, ...keys) { keys.forEach((k) => st.failSet.add(k)); return () => keys.forEach((k) => st.failSet.delete(k)); }

// ---- O.1 普通退出只结束这台设备的会话：其他设备的 refresh token 仍然有效 ----
{
  const t = await twoDevices();
  const sA = authSession(t.stA), sB = authSession(t.stB);
  const r = await t.A.logout();
  check("O.1 普通退出成功；云端 signOut 以 scope=local 调用（不是默认 global）", r.ok === true && JSON.stringify(signOutCalls(t.cloud)) === JSON.stringify([["signOut", "local"]]), JSON.stringify({ r, calls: signOutCalls(t.cloud) }));
  check("O.1 这台设备的 refresh token 被云端撤销；另一台设备的会话仍然有效", (await refreshAlive(t.cloud, sA)) === false && (await refreshAlive(t.cloud, sB)) === true);
  const sync2 = await t.B.syncNow();
  check("O.1 另一台设备照常同步（没被误退出）", sync2.ok === true && t.B.account() !== null && t.B.status().status === "synced", JSON.stringify(sync2));
  check("O.1 这台设备本机：账号指针、凭证、已同步副本都清了", t.A.account() === null && getCurrentAccount(t.stA) === null && t.stA.getItem(AUTH_KEY) === null && loadAccount(t.stA, t.uid, { now: NOW }).copy === null);
}

// ---- O.2 本机删除失败（副本删不掉 / 指针清不掉）：不联网、不撤销云端会话，本机原样 ----
for (const [label, breakIt] of [["副本删不掉", (t) => breakRemove(t.stA, "suipian.acct." + t.uid)], ["账号指针清不掉", (t) => breakRemove(t.stA, "suipian.session")]]) {
  const t = await twoDevices("two-" + label.length + "@example.com");
  const sA = authSession(t.stA), authRaw = t.stA.getItem(AUTH_KEY), copyRaw = t.stA.getItem("suipian.acct." + t.uid);
  const fix = breakIt(t);
  t.cloud.calls.length = 0;
  const r = await t.A.logout();
  check(`O.2[${label}] 普通退出：本机清理失败 → 不退出，且完全没调用云端 signOut`, r.ok === false && r.kind === "local" && r.cloudUntouched === true && signOutCalls(t.cloud).length === 0, JSON.stringify({ r, calls: t.cloud.calls }));
  check(`O.2[${label}] 云端会话原封不动（refresh 仍有效）；本机登录状态、凭证、副本逐字恢复`, (await refreshAlive(t.cloud, sA)) === true && t.A.account() !== null && getCurrentAccount(t.stA) === t.uid && t.stA.getItem(AUTH_KEY) === authRaw && copyXp(t.stA, t.uid) === sumXp(JSON.parse(copyRaw).doc), JSON.stringify({ account: t.A.account(), cur: getCurrentAccount(t.stA) }));
  fix();
  const r2 = await t.A.logout();
  check(`O.2[${label}] 故障排除后重试退出成功：这台设备会话撤销，另一台设备仍有效`, r2.ok === true && (await refreshAlive(t.cloud, sA)) === false && (await refreshAlive(t.cloud, authSession(t.stB))) === true, JSON.stringify(r2));
}

// ---- O.3 强制退出遇凭证清理失败（删不掉也写不了撤销标记）：回滚，不联网；未上传副本保留；恢复后重试成功 ----
{
  const t = await twoDevices("two-auth@example.com");
  learn(t.devA, "U1L1", 25); // 本机有未上传进度
  const sA = authSession(t.stA), authRaw = t.stA.getItem(AUTH_KEY);
  const fixR = breakRemove(t.stA, AUTH_KEY), fixS = breakSet(t.stA, AUTH_KEY);
  t.cloud.calls.length = 0;
  const r = await t.A.logout({ force: true });
  const kept = loadAccount(t.stA, t.uid, { now: NOW }).copy;
  check("O.3 凭证清不掉：强制退出失败，没联网、没撤销云端会话", r.ok === false && r.kind === "local" && signOutCalls(t.cloud).length === 0 && (await refreshAlive(t.cloud, sA)) === true, JSON.stringify({ r, calls: t.cloud.calls.length }));
  check("O.3 登录状态恢复：账号指针、凭证原文、未上传副本(25 XP, dirty)都在", t.A.account() !== null && getCurrentAccount(t.stA) === t.uid && t.stA.getItem(AUTH_KEY) === authRaw && !!kept && sumXp(kept.doc) === 25 && kept.dirty.content === true, JSON.stringify({ cur: getCurrentAccount(t.stA), dirty: kept?.dirty }));
  fixR(); fixS();
  const r2 = await t.A.logout({ force: true });
  check("O.3 恢复后重试：已退出；尽力撤销了这台设备的云端会话(scope=local)；未上传副本保留；另一台设备不受影响", r2.ok === true && signOutCalls(t.cloud).length === 1 && signOutCalls(t.cloud)[0][1] === "local" && (await refreshAlive(t.cloud, sA)) === false && (await refreshAlive(t.cloud, authSession(t.stB))) === true && copyXp(t.stA, t.uid) === 25, JSON.stringify(r2));
}

// ---- O.4 云端退出成功之后本机清凭证失败：已退出（云端已撤销），只提示残留的凭证已失效；重开不会复活登录 ----
{
  const t = await twoDevices("two-leftover@example.com");
  const sA = authSession(t.stA);
  breakRemove(t.stA, AUTH_KEY); breakSet(t.stA, AUTH_KEY);
  const r = await t.A.logout();
  check("O.4 云端会话已撤销、本机副本和指针已清；清凭证失败只给警告(local-auth-leftover)，仍算已退出", r.ok === true && r.warning === "local-auth-leftover" && t.A.account() === null && getCurrentAccount(t.stA) === null && (await refreshAlive(t.cloud, sA)) === false, JSON.stringify(r));
  const reopened = makeSync(t.stA, t.cloud);
  check("O.4 重开页面：不会靠残留的已失效凭证复活登录", reopened.restore(freshState()) === null && reopened.account() === null);
}

// ---- O.5 云端 signOut 失败（没撤销）：回滚本机，保持登录，副本 / 指针 / 凭证原样；联网后重试成功 ----
{
  const t = await twoDevices("two-signfail@example.com");
  const sA = authSession(t.stA), authRaw = t.stA.getItem(AUTH_KEY), copyBefore = copyXp(t.stA, t.uid);
  t.cloud.state.signOutMode = "fail";
  const r = await t.A.logout();
  check("O.5 signOut 失败：ok:false stayed，保持登录，本机指针 / 凭证 / 副本恢复", r.ok === false && r.stayed === true && t.A.account() !== null && getCurrentAccount(t.stA) === t.uid && t.stA.getItem(AUTH_KEY) === authRaw && !!loadAccount(t.stA, t.uid, { now: NOW }).copy && copyXp(t.stA, t.uid) === copyBefore, JSON.stringify(r));
  check("O.5 云端会话没被撤销（refresh 仍有效）", (await refreshAlive(t.cloud, sA)) === true);
  t.cloud.state.signOutMode = "ok";
  const r2 = await t.A.logout();
  check("O.5 联网后重试退出成功", r2.ok === true && (await refreshAlive(t.cloud, sA)) === false && t.A.account() === null, JSON.stringify(r2));
}

// ---- O.6 signOut 响应丢失（云端其实撤销了）：不假装已退出、不丢进度；之后 token 过期会被如实要求重新登录 ----
{
  const t = await twoDevices("two-lost@example.com");
  learn(t.devA, "U1L1", 30);
  await t.A.syncNow();
  const xp = copyXp(t.stA, t.uid);
  t.cloud.state.signOutMode = "lost-response";
  const r = await t.A.logout();
  check("O.6 响应丢失：报告退出失败(stayed)，保持登录，学习副本一个字不少", r.ok === false && r.stayed === true && t.A.account() !== null && copyXp(t.stA, t.uid) === xp, JSON.stringify(r));
  // access token 过期后才会发现 refresh token 已经被撤销：如实 need-login，进度仍在
  const stored = JSON.parse(t.stA.getItem(AUTH_KEY)); stored.session.expiresAt = NOW + 1000; t.stA.setItem(AUTH_KEY, JSON.stringify(stored));
  const sy2 = makeSync(t.stA, t.cloud); sy2.restore(freshState());
  const rs = await sy2.syncNow();
  check("O.6 token 过期后同步：如实要求重新登录(auth / need-login)，进度仍在本机", rs.ok === false && rs.kind === "auth" && sy2.status().status === "need-login" && copyXp(t.stA, t.uid) === xp, JSON.stringify({ rs, st: sy2.status() }));
}

// ---- O.7 forceLocalLogout 是纯本机退出：零网络、不撤销云端会话；未上传副本保留；同一账号重登接着传 ----
{
  const t = await twoDevices("two-local@example.com");
  learn(t.devA, "U1L1", 40);
  const sA = authSession(t.stA);
  t.cloud.calls.length = 0;
  const r = await t.A.forceLocalLogout();
  check("O.7 纯本机退出：没有任何网络请求，返回云端会话可能仍有效", r.ok === true && r.cloudSessionMaybeValid === true && t.cloud.calls.length === 0, JSON.stringify({ r, calls: t.cloud.calls }));
  check("O.7 云端会话没被撤销（refresh 仍有效）；未上传的 40 XP 副本保留", (await refreshAlive(t.cloud, sA)) === true && copyXp(t.stA, t.uid) === 40 && t.A.account() === null);
  const A2 = makeSync(t.stA, t.cloud);
  const re = await login(A2, "two-local@example.com", freshState());
  await A2.syncNow();
  check("O.7 同一账号重新登录：接着上传，40 XP 到云端且不重复", re.ok && sumXp(t.cloud.rows.get(t.uid).doc) === 40, JSON.stringify({ xp: sumXp(t.cloud.rows.get(t.uid).doc) }));
}

// ---- O.8 强制退出 + 云端 signOut 失败：本机照常退出，明确提示云端会话可能仍有效 ----
{
  const t = await twoDevices("two-forcefail@example.com");
  learn(t.devA, "U1L1", 15);
  t.cloud.state.signOutMode = "fail";
  const r = await t.A.logout({ force: true });
  check("O.8 强制退出遇断网：已在本机退出，提示云端会话可能仍有效，未上传副本保留", r.ok === true && r.cloudSessionMaybeValid === true && t.A.account() === null && copyXp(t.stA, t.uid) === 15, JSON.stringify(r));
}

// ---- O.9 云端说会话本来就失效(401)，或 refresh 被拒：等于已退出，不应卡死 ----
{
  const t = await twoDevices("two-401@example.com");
  t.cloud.state.signOutMode = "invalid";
  const r = await t.A.logout();
  check("O.9 signOut 返回 401(会话已失效)：视为已退出，本机清理完成", r.ok === true && t.A.account() === null && getCurrentAccount(t.stA) === null, JSON.stringify(r));
  const t2 = await twoDevices("two-expired@example.com");
  t2.cloud.revokedSids.add(t2.cloud.sidOf.get(authSession(t2.stA).refreshToken)); // 云端已把这台设备的会话撤销（比如别处退出）
  const stored = JSON.parse(t2.stA.getItem(AUTH_KEY)); stored.session.expiresAt = NOW + 1000; t2.stA.setItem(AUTH_KEY, JSON.stringify(stored));
  const sy = makeSync(t2.stA, t2.cloud); sy.restore(freshState());
  const r2 = await sy.logout();
  check("O.9 access token 已过期且 refresh 被拒：不卡在“退出失败”，直接完成本机退出", r2.ok === true && sy.account() === null && getCurrentAccount(t2.stA) === null, JSON.stringify(r2));
}

// ---- O.10 cloud-api：signOut 的请求带 scope；默认 local；非法值回落 local；失败如实返回 ----
{
  const urls = []; let status = 204;
  const api = createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn: async (u, o) => { urls.push([o.method, u]); return { ok: status < 300, status, text: async () => (status < 300 ? "" : JSON.stringify({ msg: "boom" })) }; } });
  const sess = { accessToken: "at", refreshToken: "rt", expiresAt: NOW + 1, userId: "u", email: "a@b.c" };
  await api.signOut(sess); await api.signOut(sess, "global"); await api.signOut(sess, "others"); await api.signOut(sess, "bogus");
  check("O.10 signOut 请求：POST /auth/v1/logout?scope=...，默认 local，非法值回落 local", JSON.stringify(urls.map((x) => x[0] + " " + x[1].replace("https://x.supabase.co", ""))) === JSON.stringify(["POST /auth/v1/logout?scope=local", "POST /auth/v1/logout?scope=global", "POST /auth/v1/logout?scope=others", "POST /auth/v1/logout?scope=local"]), JSON.stringify(urls));
  status = 500;
  const bad = await api.signOut(sess);
  check("O.10 signOut 服务器返回 500：如实返回 ok:false（不当成成功）", bad.ok === false && bad.kind === "server", JSON.stringify(bad));
}

// ======================================================================
// P. DB-3.1 退出异常处理（2026-11-06 19:23）
//    依据：supabase-js auth-js 的 _signOut 对 401/403/404 一律忽略（按状态码）；GoTrue 服务端 /logout 自己不返回这三种，
//    它们来自鉴权中间件：bad_jwt / session_not_found / user_not_found 为 403，no_authorization 为 401。
//    我们收紧为“明确的错误码”才算会话已失效；其余 403 / 404 / 5xx / 代理错误都不是退出成功。
// ======================================================================
// ---- P.1 cloud-api 对 signOut 失败的判断（真实翻译）----
{
  const sh = async (status, body) => signOutShape(status, body);
  const st = async (status, body) => (await sh(status, body)).sessionState ?? null;
  check("P.1 403 session_not_found → 会话已不存在 (gone)", (await st(403, { error_code: "session_not_found" })) === "gone");
  check("P.1 403 user_not_found / 404 user_not_found（旧版）→ gone", (await st(403, { error_code: "user_not_found" })) === "gone" && (await st(404, { error_code: "user_not_found" })) === "gone");
  check("P.1 403 bad_jwt → 访问令牌无效，但不等于会话已撤销 (token-invalid，需再核实)", (await st(403, { error_code: "bad_jwt" })) === "token-invalid");
  check("P.1 老版本 GoTrue 没有 error_code：401 + 消息明确说 JWT 过期 → token-invalid", (await st(401, { msg: "invalid JWT: token is expired" })) === "token-invalid");
  check("P.1 通用权限拒绝 403 not_admin → 不是会话失效", (await st(403, { error_code: "not_admin", msg: "denied" })) === null);
  check("P.1 403 纯文本 / 代理拦截 → 不是会话失效", (await st(403, "Forbidden")) === null && (await st(403, "<html>blocked by proxy</html>")) === null);
  check("P.1 404 路由不存在（没有 user_not_found）→ 不是会话失效", (await st(404, "404 page not found")) === null && (await st(404, { msg: "no Route matched" })) === null);
  check("P.1 401 no_authorization（我们没带令牌）→ 不是会话失效", (await st(401, { error_code: "no_authorization", msg: "This endpoint requires a valid Bearer token" })) === null);
  check("P.1 401 apikey 问题 → 不是会话失效", (await st(401, { message: "Invalid API key" })) === null);
  check("P.1 5xx / 400(scope 非法) / 429 → 不是会话失效", (await st(502, "bad gateway")) === null && (await st(500, { msg: "Error logging out user" })) === null && (await st(400, { error_code: "validation_failed" })) === null && (await st(429, { error_code: "over_request_rate_limit" })) === null);
  check("P.1 gone 码配了不相干的状态（如 500）不算 gone", (await st(500, { error_code: "session_not_found" })) === null);
  const g = await sh(403, { error_code: "session_not_found", msg: "x" });
  check("P.1 失败结果保留 status 和 errorCode 供排查", g.ok === false && g.status === 403 && g.errorCode === "session_not_found", JSON.stringify(g));
}

// ---- P.2 通用 403 / 路由 404 / 代理 502：不是退出成功 —— 回滚、保持登录、云端会话没动，恢复后重试成功 ----
for (const mode of ["forbidden", "route404", "proxy502"]) {
  const t = await twoDevices("p2-" + mode + "@example.com");
  const sA = authSession(t.stA), authBefore = t.stA.getItem(AUTH_KEY), xp0 = copyXp(t.stA, t.uid);
  t.cloud.state.signOutMode = mode;
  const r = await t.A.logout();
  check("P.2 " + mode + "：不当成退出成功（ok:false, stayed:true），仍是登录态", r.ok === false && r.stayed === true && t.A.account() !== null && getCurrentAccount(t.stA) === t.uid, JSON.stringify(r));
  check("P.2 " + mode + "：凭证和本机副本原样，XP 没变，云端会话还活着", t.stA.getItem(AUTH_KEY) === authBefore && copyXp(t.stA, t.uid) === xp0 && (await refreshAlive(t.cloud, sA)) === true);
  t.cloud.state.signOutMode = "ok";
  const r2 = await t.A.logout();
  check("P.2 " + mode + "：恢复后再退出一次成功，云端会话被撤销", r2.ok === true && t.A.account() === null && (await refreshAlive(t.cloud, sA)) === false, JSON.stringify(r2));
}

// ---- P.3 云端明确说会话不存在(session_not_found)：才按已退出处理 ----
{
  const t = await twoDevices("p3@example.com");
  t.cloud.state.signOutMode = "gone";
  const r = await t.A.logout();
  check("P.3 session_not_found：按已退出处理，本机清理完成，只调用了一次 signOut", r.ok === true && t.A.account() === null && getCurrentAccount(t.stA) === null && signOutCalls(t.cloud).length === 1, JSON.stringify(r));
}

// ---- P.4 bad_jwt（访问令牌无效）不等于会话已撤销：先核实 refresh token ----
{
  // (a) refresh 也被拒：会话确实死了 → 已退出，不卡死
  const a = await twoDevices("p4a@example.com");
  a.cloud.revokedSids.add(a.cloud.sidOf.get(authSession(a.stA).refreshToken));
  a.cloud.state.signOutMode = "bad-jwt";
  const ra = await a.A.logout();
  check("P.4a bad_jwt 且 refresh token 也被拒：会话已死，按已退出处理", ra.ok === true && a.A.account() === null && getCurrentAccount(a.stA) === null, JSON.stringify(ra));
  // (b) refresh 还活着：刷新后拿新令牌重试 signOut，真的撤销了才算退出
  const b = await twoDevices("p4b@example.com");
  const sB0 = authSession(b.stA);
  b.cloud.state.signOutMode = "bad-jwt-once";
  const rb = await b.A.logout();
  const sCalls = signOutCalls(b.cloud).length;
  check("P.4b bad_jwt 一次、refresh 还活着：刷新后重试 signOut 成功，云端会话真的被撤销", rb.ok === true && sCalls === 2 && (await refreshAlive(b.cloud, sB0)) === false && b.A.account() === null, JSON.stringify({ rb, sCalls }));
  const sOther = authSession(b.stB);
  check("P.4b 重试仍是 scope=local：另一台设备不受影响", (await refreshAlive(b.cloud, sOther)) === true && JSON.stringify(signOutCalls(b.cloud).map((c) => c[1])) === JSON.stringify(["local", "local"]));
  // (c) 一直 bad_jwt 但 refresh 活着：不能宣称退出；保持登录；存储里是刷新后的新凭证（旧的已被轮换作废），且仍能用
  const c = await twoDevices("p4c@example.com");
  const xpC = copyXp(c.stA, c.uid);
  c.cloud.state.signOutMode = "bad-jwt";
  const rc = await c.A.logout();
  const stored = authSession(c.stA);
  check("P.4c 一直 bad_jwt 但 refresh 还活着：不宣称退出，保持登录，副本不丢", rc.ok === false && rc.stayed === true && c.A.account() !== null && getCurrentAccount(c.stA) === c.uid && copyXp(c.stA, c.uid) === xpC, JSON.stringify(rc));
  check("P.4c 回滚后存储里是刷新后的有效凭证（没有恢复成已被轮换的旧令牌）", (await refreshAlive(c.cloud, stored)) === true, JSON.stringify(stored));
  c.cloud.state.signOutMode = "ok";
  const rc2 = await c.A.logout();
  check("P.4c 之后重试退出成功", rc2.ok === true && c.A.account() === null && (await refreshAlive(c.cloud, stored)) === false, JSON.stringify(rc2));
  // (d) bad_jwt 时断网无法核实：不宣称退出
  const d = await twoDevices("p4d@example.com");
  d.cloud.state.signOutMode = "bad-jwt";
  const origRefresh = d.cloud.refresh; d.cloud.refresh = async (s) => { d.cloud.calls.push(["refresh", s?.refreshToken]); return { ok: false, kind: "network", message: "网络连不上，请检查网络后重试" }; };
  const stored0 = d.stA.getItem(AUTH_KEY);
  const rd = await d.A.logout();
  check("P.4d bad_jwt 且无法核实 refresh token（断网）：不宣称退出，保持登录", rd.ok === false && rd.stayed === true && d.A.account() !== null && d.stA.getItem(AUTH_KEY) === stored0, JSON.stringify(rd));
  d.cloud.refresh = origRefresh;
}

// ---- P.5 强制退出遇到同样的失败：本机照常退出，但不能说云端已撤销 ----
for (const mode of ["forbidden", "route404", "proxy502", "bad-jwt"]) {
  const t = await twoDevices("p5-" + mode + "@example.com");
  t.cloud.state.signOutMode = mode;
  const r = await t.A.logout({ force: true });
  check("P.5 强制退出 + " + mode + "：本机已退出，明确标注云端会话可能仍有效", r.ok === true && r.cloudSessionMaybeValid === true && r.warning === "cloud-session-maybe-valid" && t.A.account() === null, JSON.stringify(r));
}

// ---- P.6 云端已撤销、本机凭证清不掉：如实说明（访问令牌可能还没过期），保留可再次清理的入口 ----
{
  const t = await twoDevices("p6@example.com");
  const sA = authSession(t.stA);
  const restoreRm = breakRemove(t.stA, AUTH_KEY), restoreSet = breakSet(t.stA, AUTH_KEY);
  const r = await t.A.logout();
  check("P.6 返回 local-auth-leftover，并明确 authLeftover / accessTokenValidUntil（令牌到期时间）", r.ok === true && r.warning === "local-auth-leftover" && r.authLeftover === true && r.accessTokenValidUntil === sA.expiresAt, JSON.stringify(r));
  check("P.6 不再声称“已失效、不能再用”：说明访问令牌到期前可能仍可用，并提示再清理", typeof r.message === "string" && /访问令牌/.test(r.message) && /再次清理|重新清理|再清理/.test(r.message) && !/不能再用/.test(r.message), r.message);
  check("P.6 云端：刷新令牌确实已撤销；访问令牌（JWT）到期前仍能读云端（所以不能说完全失效）", (await refreshAlive(t.cloud, sA)) === false && (await t.cloud.getProgress(sA)).ok === true);
  check("P.6 本机：账号指针和副本已清；hasLeftoverAuth() 为 true", getCurrentAccount(t.stA) === null && t.A.hasLeftoverAuth() === true);
  const realGet = t.stA.getItem; t.stA.getItem = (k) => { if (k === AUTH_KEY) throw new Error("read denied"); return realGet(k); };
  check("P.6 存储读不出来时，内存里的残留标记仍让 hasLeftoverAuth() 为 true", t.A.hasLeftoverAuth() === true);
  t.stA.getItem = realGet;
  const again = await t.A.retryAuthCleanup();
  check("P.6 存储还坏着时再次清理：如实返回失败，仍标记有残留", again.ok === false && t.A.hasLeftoverAuth() === true, JSON.stringify(again));
  restoreRm(); restoreSet();
  const fixed = await t.A.retryAuthCleanup();
  check("P.6 存储恢复后再次清理：成功，凭证被清掉，残留标记消失", fixed.ok === true && t.stA.getItem(AUTH_KEY) === null && t.A.hasLeftoverAuth() === false, JSON.stringify(fixed));
  // 页面重开后（新的 sync 实例，没有内存标记）也能发现并清理
  const t2 = await twoDevices("p6b@example.com");
  const un1 = breakRemove(t2.stA, AUTH_KEY), un2 = breakSet(t2.stA, AUTH_KEY);
  await t2.A.logout(); un1(); un2();
  const reopened = makeSync(t2.stA, t2.cloud);
  check("P.6 页面重开：没有账号但存储里还留着登录凭证 → hasLeftoverAuth() 为 true，restore() 仍不会复活登录", reopened.restore(freshState()) === null && reopened.hasLeftoverAuth() === true);
  const f2 = await reopened.retryAuthCleanup();
  check("P.6 页面重开后也能再次清理", f2.ok === true && t2.stA.getItem(AUTH_KEY) === null && reopened.hasLeftoverAuth() === false, JSON.stringify(f2));
}

// ---- P.7 retryAuthCleanup 不能误清登录中的凭证 ----
{
  const t = await twoDevices("p7@example.com");
  const before = t.stA.getItem(AUTH_KEY);
  const r = await t.A.retryAuthCleanup();
  check("P.7 还在登录状态时 retryAuthCleanup 拒绝执行，凭证原样", r.ok === false && t.stA.getItem(AUTH_KEY) === before && t.A.account() !== null && t.A.hasLeftoverAuth() === false, JSON.stringify(r));
}

// ---- P.7b 另一个标签页已登录（共用存储）：本标签页不能把它的凭证当“残留”清掉 ----
{
  const t = await twoDevices("p7b@example.com");
  const tabB = makeSync(t.stA, t.cloud); // 同一份存储，还没 restore（没有内存账号）
  const before = t.stA.getItem(AUTH_KEY);
  check("P.7b 同存储别的标签页已登录：hasLeftoverAuth() 为 false", tabB.hasLeftoverAuth() === false);
  const r = await tabB.retryAuthCleanup();
  check("P.7b 同存储别的标签页已登录：拒绝清理，凭证原样，登录那边照常同步", r.ok === false && t.stA.getItem(AUTH_KEY) === before && (await t.A.syncNow()).ok === true, JSON.stringify(r));
}

// ======================================================================
// Q. DB-3.1 刷新错误的判断（208ee2e 的 P1，2026-11-06 20:16）
//    logout 返回 403 bad_jwt 后要用 refresh 核实会话。旧实现把 refresh 的任何 "auth" 类失败（含 403 not_admin、404 路由不存在、
//    400 请求格式错误——cloud-api 把所有 <500 的失败都归成 auth）都当成“会话已死 = 已退出”，于是假退出并清掉凭证。
//    依据（GoTrue tokens/service.go RefreshTokenGrant）：令牌/会话已死 = refresh_token_not_found / refresh_token_already_used /
//    session_not_found / session_expired（均为 400）；空令牌是 OAuth invalid_request，格式不对是 validation_failed —— 都不是“已死”。
//    这一段全部走真实 createApi（只替换 fetch），不再用 fake api 的手写形状。
// ======================================================================
async function refreshShape(status, body) {
  const api = createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn: async () => ({ ok: false, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) }) });
  return api.refresh(SHAPE_SESS);
}
function httpCloud() {
  const st = { calls: [], logoutAuth: [], logout: () => resp(204), token: () => resp(500, "unset"), netTokenFail: false };
  function resp(status, body) { return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body)) }; }
  const fresh = (n) => resp(200, { access_token: "at-" + n, refresh_token: "rt-" + n, expires_at: Math.floor(NOW / 1000) + 3600, user: { id: "uhttp", email: "http@example.com" } });
  const fetchFn = async (url, o) => {
    const path = url.replace("https://x.supabase.co", "");
    st.calls.push(o.method + " " + path.split("?")[0]);
    if (path.startsWith("/auth/v1/verify")) return fresh(1);
    if (path.startsWith("/rest/v1/progress")) return resp(200, []);
    if (path.startsWith("/rest/v1/rpc/create_progress")) return resp(200, 1);
    if (path.startsWith("/auth/v1/token")) { if (st.netTokenFail) throw new Error("offline"); return st.token(JSON.parse(o.body)); }
    if (path.startsWith("/auth/v1/logout")) { st.logoutAuth.push(o.headers.Authorization); return st.logout(); }
    return resp(404, "no route");
  };
  st.resp = resp; st.fresh = fresh;
  st.api = createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn });
  st.count = (needle) => st.calls.filter((c) => c.includes(needle)).length;
  return st;
}
async function httpLogin(tag) {
  const h = httpCloud(), stor = flakyStore(mem());
  stor.setItem(DEVICE_KEY, "dev-" + tag);
  const sync = makeSync(stor, h.api);
  const l = await login(sync, "http@example.com", freshState());
  h.calls.length = 0; h.logoutAuth.length = 0;
  return { h, stor, sync, l, uid: sync.account().userId };
}
const BADJWT = (h) => () => h.resp(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT: unable to parse or verify signature, token is expired" });

// ---- Q.1 cloud-api.refresh 的失败判断（真实翻译）：只有明确的错误码才是“令牌/会话已死”；status / errorCode 保留 ----
{
  const dead = async (status, body) => (await refreshShape(status, body)).sessionState === "dead";
  check("Q.1 400 refresh_token_not_found → dead", await dead(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }));
  check("Q.1 400 refresh_token_already_used → dead", await dead(400, { error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" }));
  check("Q.1 400 session_not_found / session_expired → dead", (await dead(400, { error_code: "session_not_found", msg: "Invalid Refresh Token: No Valid Session Found" })) && (await dead(400, { error_code: "session_expired", msg: "Invalid Refresh Token: Session Expired" })));
  check("Q.1 老版本无 error_code：OAuth invalid_grant，或消息以 Invalid Refresh Token 开头 → dead", (await dead(400, { error: "invalid_grant", error_description: "refresh token revoked" })) && (await dead(400, { msg: "Invalid Refresh Token: Already Used" })));
  check("Q.1 403 not_admin（通用权限错误）→ 不是 dead", !(await dead(403, { error_code: "not_admin", msg: "User not allowed" })));
  check("Q.1 403 纯文本 / 代理拦截 → 不是 dead", !(await dead(403, "Forbidden")) && !(await dead(403, "<html>blocked</html>")));
  check("Q.1 404 路由不存在 → 不是 dead", !(await dead(404, "404 page not found")) && !(await dead(404, { msg: "no Route matched" })));
  check("Q.1 400 OAuth invalid_request（请求格式）/ validation_failed → 不是 dead", !(await dead(400, { error: "invalid_request", error_description: "refresh_token required" })) && !(await dead(400, { error_code: "validation_failed", msg: "Refresh token is not valid" })));
  check("Q.1 400 validation_failed 即使消息像 Invalid Refresh Token 也不是 dead（有明确错误码就按错误码）", !(await dead(400, { error_code: "validation_failed", msg: "Invalid Refresh Token: Not Issued By This Server" })));
  check("Q.1 429 / 500 / 502 → 不是 dead", !(await dead(429, { error_code: "over_request_rate_limit" })) && !(await dead(500, { msg: "boom" })) && !(await dead(502, "bad gateway")));
  check("Q.1 dead 码配了 500/404 状态 → 不是 dead", !(await dead(500, { error_code: "session_expired" })) && !(await dead(404, { error_code: "refresh_token_not_found" })));
  const r = await refreshShape(403, { error_code: "not_admin", msg: "denied" });
  check("Q.1 失败结果保留 status / errorCode，供排查", r.ok === false && r.status === 403 && r.errorCode === "not_admin", JSON.stringify(r));
}

// ---- Q.2 端到端（真实 createApi → sync）：logout 返回 bad_jwt，refresh 返回“不是已死”的失败 → 不是已退出，回滚，保持登录 ----
const NOT_DEAD = {
  "403 not_admin": (h) => () => h.resp(403, { code: 403, error_code: "not_admin", msg: "User not allowed" }),
  "404 Route not found": (h) => () => h.resp(404, "Route not found"),
  "400 invalid_request": (h) => () => h.resp(400, { error: "invalid_request", error_description: "refresh_token required" }),
  "400 validation_failed": (h) => () => h.resp(400, { code: 400, error_code: "validation_failed", msg: "Refresh token is not valid" }),
  "429": (h) => () => h.resp(429, { code: 429, error_code: "over_request_rate_limit", msg: "rate limited" }),
  "502": (h) => () => h.resp(502, "<html>Bad Gateway</html>"),
};
for (const [name, mk] of Object.entries(NOT_DEAD)) {
  const t = await httpLogin("q2");
  const authBefore = t.stor.getItem(AUTH_KEY), xp0 = copyXp(t.stor, t.uid);
  t.h.logout = BADJWT(t.h); t.h.token = mk(t.h);
  const r = await t.sync.logout();
  check("Q.2 bad_jwt + refresh " + name + "：不是已退出（ok:false, stayed:true）", r.ok === false && r.stayed === true, JSON.stringify(r));
  check("Q.2 bad_jwt + refresh " + name + "：本机凭证、账号指针、副本原样，仍是登录态", t.stor.getItem(AUTH_KEY) === authBefore && getCurrentAccount(t.stor) === t.uid && t.sync.account() !== null && copyXp(t.stor, t.uid) === xp0);
  check("Q.2 bad_jwt + refresh " + name + "：只问了一次 logout、一次 refresh（没有重试风暴）", t.h.count("/auth/v1/logout") === 1 && t.h.count("/auth/v1/token") === 1, JSON.stringify(t.h.calls));
}
{ // 断网：refresh 的 fetch 直接抛错
  const t = await httpLogin("q2n");
  const authBefore = t.stor.getItem(AUTH_KEY);
  t.h.logout = BADJWT(t.h); t.h.netTokenFail = true;
  const r = await t.sync.logout();
  check("Q.2 bad_jwt + refresh 断网：不是已退出，保持登录，凭证原样", r.ok === false && r.stayed === true && r.kind === "network" && t.stor.getItem(AUTH_KEY) === authBefore && t.sync.account() !== null, JSON.stringify(r));
  t.h.netTokenFail = false; t.h.logout = () => t.h.resp(204); t.h.token = () => t.h.fresh(2);
  const again = await t.sync.logout();
  check("Q.2 恢复后再退出成功", again.ok === true && t.sync.account() === null && getCurrentAccount(t.stor) === null, JSON.stringify(again));
}

// ---- Q.3 对照：refresh 明确证明令牌/会话已死 → 才按已退出处理 ----
const DEAD = {
  "400 refresh_token_not_found": (h) => () => h.resp(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token: Refresh Token Not Found" }),
  "400 refresh_token_already_used": (h) => () => h.resp(400, { code: 400, error_code: "refresh_token_already_used", msg: "Invalid Refresh Token: Already Used" }),
  "400 session_not_found": (h) => () => h.resp(400, { code: 400, error_code: "session_not_found", msg: "Invalid Refresh Token: No Valid Session Found" }),
  "400 session_expired": (h) => () => h.resp(400, { code: 400, error_code: "session_expired", msg: "Invalid Refresh Token: Session Expired" }),
  "legacy invalid_grant": (h) => () => h.resp(400, { error: "invalid_grant", error_description: "refresh token revoked" }),
};
for (const [name, mk] of Object.entries(DEAD)) {
  const t = await httpLogin("q3");
  t.h.logout = BADJWT(t.h); t.h.token = mk(t.h);
  const r = await t.sync.logout();
  check("Q.3 bad_jwt + refresh " + name + "：令牌/会话已死，按已退出处理，本机清理完成", r.ok === true && t.sync.account() === null && getCurrentAccount(t.stor) === null && t.stor.getItem(AUTH_KEY) === null, JSON.stringify(r));
}

// ---- Q.4 对照：正常刷新轮换——刷新成功后用“新令牌”重试 logout；仍 bad_jwt 则回滚且存储里是新凭证 ----
{
  const t = await httpLogin("q4");
  let n = 1; t.h.token = () => t.h.fresh(++n);
  let first = true; t.h.logout = () => { if (first) { first = false; return BADJWT(t.h)(); } return t.h.resp(204); };
  const r = await t.sync.logout();
  check("Q.4 bad_jwt 一次 + 刷新成功：用新令牌重试 logout 成功", r.ok === true && t.h.logoutAuth.length === 2 && t.h.logoutAuth[0] === "Bearer at-1" && t.h.logoutAuth[1] === "Bearer at-2" && t.sync.account() === null, JSON.stringify({ r, auth: t.h.logoutAuth }));
  const u = await httpLogin("q4b"); n = 1;
  u.h.token = () => u.h.fresh(++n); u.h.logout = BADJWT(u.h);
  const r2 = await u.sync.logout();
  const stored = JSON.parse(u.stor.getItem(AUTH_KEY)).session;
  check("Q.4 一直 bad_jwt 但刷新成功：不宣称退出；回滚后存储里是刷新后的新凭证（不是已被轮换作废的旧令牌）", r2.ok === false && r2.stayed === true && stored.refreshToken === "rt-2" && stored.accessToken === "at-2" && u.sync.account() !== null, JSON.stringify({ r2, stored }));
}

// ---- Q.5 普通退出前 ensureToken 的刷新失败：只有“已死”才继续退出；其他失败不动本机、不发 logout ----
async function expiredHttp(tag) {
  const t = await httpLogin(tag);
  const stored = JSON.parse(t.stor.getItem(AUTH_KEY)); stored.session.expiresAt = NOW + 1000; t.stor.setItem(AUTH_KEY, JSON.stringify(stored));
  const sync = makeSync(t.stor, t.h.api); sync.restore(freshState());
  return { ...t, sync };
}
for (const [name, mk] of Object.entries(NOT_DEAD)) {
  const t = await expiredHttp("q5");
  const authBefore = t.stor.getItem(AUTH_KEY), xp0 = copyXp(t.stor, t.uid);
  t.h.token = mk(t.h);
  const r = await t.sync.logout();
  check("Q.5 访问令牌已过期、refresh " + name + "：不退出，不动本机，没有发 logout 请求", r.ok === false && r.stayed === true && t.h.count("/auth/v1/logout") === 0 && t.stor.getItem(AUTH_KEY) === authBefore && getCurrentAccount(t.stor) === t.uid && copyXp(t.stor, t.uid) === xp0, JSON.stringify({ r, calls: t.h.calls }));
}
{
  const t = await expiredHttp("q5n");
  t.h.netTokenFail = true;
  const r = await t.sync.logout();
  check("Q.5 访问令牌已过期、refresh 断网：不退出，没发 logout，本机原样", r.ok === false && r.stayed === true && t.h.count("/auth/v1/logout") === 0 && getCurrentAccount(t.stor) === t.uid, JSON.stringify(r));
}
for (const [name, mk] of Object.entries(DEAD)) {
  const t = await expiredHttp("q5d");
  t.h.token = mk(t.h); t.h.logout = BADJWT(t.h);
  const r = await t.sync.logout();
  check("Q.5 访问令牌已过期、refresh " + name + "：会话已死，直接完成退出", r.ok === true && t.sync.account() === null && getCurrentAccount(t.stor) === null, JSON.stringify(r));
}
{ // 刷新成功（正常轮换）：用新令牌退出
  const t = await expiredHttp("q5ok");
  t.h.token = () => t.h.fresh(7); t.h.logout = () => t.h.resp(204);
  const r = await t.sync.logout();
  check("Q.5 访问令牌已过期、refresh 成功：用新令牌退出", r.ok === true && t.h.logoutAuth.length === 1 && t.h.logoutAuth[0] === "Bearer at-7", JSON.stringify({ r, a: t.h.logoutAuth }));
}
{ // 强制退出对同样的刷新失败：本机照常退出，但不能说云端已撤销
  const t = await httpLogin("q6");
  t.h.logout = BADJWT(t.h); t.h.token = NOT_DEAD["403 not_admin"](t.h);
  const r = await t.sync.logout({ force: true });
  check("Q.6 强制退出 + bad_jwt + refresh 403 not_admin：本机已退出，标注云端会话可能仍有效", r.ok === true && r.cloudSessionMaybeValid === true && t.sync.account() === null, JSON.stringify(r));
}

// ---- Q.7 另一个标签页在 logout 进行中刚轮换了刷新令牌：核实时要用最新的令牌，不能拿旧令牌撞“已使用”就当会话已死 ----
{
  const t = await httpLogin("q7");
  const sessionNow = JSON.parse(t.stor.getItem(AUTH_KEY));
  let first = true;
  t.h.logout = () => {
    if (first) { // 这个请求在路上时，另一个标签页刷新了令牌并写回存储
      first = false;
      sessionNow.session = { ...sessionNow.session, accessToken: "at-9", refreshToken: "rt-9", expiresAt: NOW + 7200_000 };
      t.stor.setItem(AUTH_KEY, JSON.stringify(sessionNow));
      return BADJWT(t.h)();
    }
    return t.h.resp(204);
  };
  t.h.token = (body) => (body.refresh_token === "rt-1" ? DEAD["400 refresh_token_already_used"](t.h)() : t.h.fresh(10));
  const r = await t.sync.logout();
  check("Q.7 别的标签页刚轮换过令牌：用最新令牌核实并重试 logout（共 2 次，第二次用刷新后的新令牌），真的退出", r.ok === true && t.h.logoutAuth.length === 2 && t.h.logoutAuth[1] === "Bearer at-10" && t.sync.account() === null, JSON.stringify({ r, auth: t.h.logoutAuth, calls: t.h.calls }));
}

// ======================================================================
// R. retryAuthCleanup / hasLeftoverAuth 的读取失败（2026-11-07）
//    旧实现：getCurrentAccount / readAuth 把“读取失败”折叠成 null —— 指针读不出来就当成“没有别的标签页在登录”并删凭证；
//    页面重开后凭证读不出来就当成“没有凭证”，retryAuthCleanup 返回 ok:true（界面显示已清理）。
//    要求：读取失败必须明确报告“无法确认”，不能当成没有；有别的标签页的有效登录时不能删它的凭证；成功必须以读回确认。
// ======================================================================
const SESSION_KEY = "suipian.session";
// 读取故障：getItem 对指定键抛错 / 静默返回 undefined（非字符串也非 null）
function breakGet(st, keys, mode = "throw") { const real = st.getItem; st.getItem = (k) => { if (keys.includes(k)) { if (mode === "throw") throw new Error("read denied: " + k); return undefined; } return real(k); }; return () => { st.getItem = real; }; }
// 制造“云端已撤销但本机凭证没清掉”的现场，返回 { t, authRaw, reopen(), fixStorage() }
async function leftoverScene(email) {
  const t = await twoDevices(email);
  const authRaw = t.stA.getItem(AUTH_KEY);
  const u1 = breakRemove(t.stA, AUTH_KEY), u2 = breakSet(t.stA, AUTH_KEY);
  const r = await t.A.logout();
  assert(r.ok === true && r.authLeftover === true, "leftoverScene: " + JSON.stringify(r));
  return { t, authRaw, fixStorage: () => { u1(); u2(); }, reopen: () => makeSync(t.stA, t.cloud) };
}
function assert(c, m) { if (!c) throw new Error("场景搭建失败：" + m); }

for (const mode of ["throw", "undefined"]) {
  const tag = mode === "throw" ? "读取抛错" : "读取静默返回 undefined";
  // ---- R.1 账号指针读不出来：无法确认别的标签页是否还在登录 → 不清理、不删凭证、明确失败 ----
  {
    const sc = await leftoverScene("r1-" + mode + "@example.com");
    sc.fixStorage(); // 存储本身能删：如果代码误以为“没有别的标签页”，凭证就真的会被删掉
    const reopened = sc.reopen();
    const undo = breakGet(sc.t.stA, [SESSION_KEY], mode);
    const r = await reopened.retryAuthCleanup();
    undo();
    check("R.1 指针" + tag + "：retryAuthCleanup 明确失败（read-failed），不是 ok", r.ok === false && r.kind === "read-failed" && /无法/.test(r.message || ""), JSON.stringify(r));
    check("R.1 指针" + tag + "：凭证没有被删（可能是别的标签页在用的）", sc.t.stA.getItem(AUTH_KEY) === sc.authRaw);
    const undo2 = breakGet(sc.t.stA, [SESSION_KEY], mode);
    check("R.1 指针" + tag + "：hasLeftoverAuth() 不能说“没有”（无法确认）→ true", reopened.hasLeftoverAuth() === true);
    undo2();
  }
  // ---- R.2 凭证读不出来（页面重开，没有内存标记）：不是“没有凭证” ----
  {
    const sc = await leftoverScene("r2-" + mode + "@example.com");
    const reopened = sc.reopen();
    const undo = breakGet(sc.t.stA, [AUTH_KEY], mode);
    const has = reopened.hasLeftoverAuth();
    const r = await reopened.retryAuthCleanup();
    undo();
    check("R.2 凭证" + tag + "：hasLeftoverAuth() 为 true（无法排除残留）", has === true);
    check("R.2 凭证" + tag + "：retryAuthCleanup 明确失败（read-failed），不是 ok / nothingToClean", r.ok === false && r.kind === "read-failed" && !r.nothingToClean && /无法/.test(r.message || ""), JSON.stringify(r));
    check("R.2 凭证" + tag + "：存储原样", sc.t.stA.getItem(AUTH_KEY) === sc.authRaw);
    // 读取恢复后可以清理成功，并以读回确认
    sc.fixStorage();
    const ok = await reopened.retryAuthCleanup();
    check("R.2 读取和存储都恢复后再清理：成功，读回确认凭证没了，残留标记消失", ok.ok === true && sc.t.stA.getItem(AUTH_KEY) === null && reopened.hasLeftoverAuth() === false, JSON.stringify(ok));
  }
}

// ---- R.3 清理时读回失败：删除“看起来”成功，但读回抛错 / 返回 undefined → 不能算清理成功 ----
for (const mode of ["throw", "undefined"]) {
  const sc = await leftoverScene("r3-" + mode + "@example.com");
  sc.fixStorage();
  const reopened = sc.reopen();
  // 只在“清理动作发生之后”才让读取坏掉：用 removeItem 钩子触发
  const realRemove = sc.t.stA.removeItem; let undoGet = null;
  sc.t.stA.removeItem = (k) => { realRemove(k); if (k === AUTH_KEY) undoGet = breakGet(sc.t.stA, [AUTH_KEY], mode); };
  const r = await reopened.retryAuthCleanup();
  sc.t.stA.removeItem = realRemove; if (undoGet) undoGet();
  check("R.3 清理后读回" + (mode === "throw" ? "抛错" : "返回 undefined") + "：不算清理成功（ok:false），因为读回无法确认", r.ok === false, JSON.stringify(r));
}

// ---- R.4 别的标签页有有效登录：不能删它的凭证 ----
{
  const sc = await leftoverScene("r4@example.com");
  sc.fixStorage();
  const stA = sc.t.stA;
  const other = makeSync(stA, sc.t.cloud); // 同一份存储里“另一个标签页”重新登录
  const lg = await login(other, "r4@example.com", freshState());
  const newAuth = stA.getItem(AUTH_KEY);
  const mine = sc.t.A; // 本标签页内存里还有 leftover 标记
  const hl = mine.hasLeftoverAuth();
  const r = await mine.retryAuthCleanup();
  check("R.4 另一个标签页已有有效登录：拒绝清理（logged-in），不是 ok", hl === false && r.ok === false && r.kind === "logged-in", JSON.stringify(r));
  check("R.4 另一个标签页的凭证原样，账号指针还在，它还能同步", stA.getItem(AUTH_KEY) === newAuth && getCurrentAccount(stA) !== null && (await other.syncNow()).ok === true && lg.state !== undefined);
}
// ---- R.4b 没有指针，但存储里的凭证已经不是当时留下的那份（被别的标签页换过）：不删 ----
{
  const sc = await leftoverScene("r4b@example.com");
  sc.fixStorage();
  const stA = sc.t.stA;
  const other = JSON.parse(sc.authRaw); other.session = { ...other.session, accessToken: "at-other", refreshToken: "rt-other" };
  stA.setItem(AUTH_KEY, JSON.stringify(other));
  const r = await sc.t.A.retryAuthCleanup();
  check("R.4b 留下的凭证已被换成另一份：拒绝清理（changed），存储原样", r.ok === false && r.kind === "changed" && stA.getItem(AUTH_KEY) === JSON.stringify(other), JSON.stringify(r));
}

// ---- R.5 清理失败后重试：失败如实报告并保留标记，修好后重试成功 ----
{
  const sc = await leftoverScene("r5@example.com");
  const r1 = await sc.t.A.retryAuthCleanup();
  check("R.5 存储仍坏：失败（local），仍有残留标记，凭证原样", r1.ok === false && r1.kind === "local" && sc.t.A.hasLeftoverAuth() === true && sc.t.stA.getItem(AUTH_KEY) === sc.authRaw, JSON.stringify(r1));
  const r2 = await sc.t.A.retryAuthCleanup();
  check("R.5 再试一次仍如实失败（不会第二次就算成功）", r2.ok === false);
  sc.fixStorage();
  const r3 = await sc.t.A.retryAuthCleanup();
  check("R.5 存储修好后重试成功，读回确认", r3.ok === true && !r3.nothingToClean && sc.t.stA.getItem(AUTH_KEY) === null && sc.t.A.hasLeftoverAuth() === false, JSON.stringify(r3));
  const r4 = await sc.t.A.retryAuthCleanup();
  check("R.5 已经干净：明确是“没有可清理的”（nothingToClean），不是清理成功", r4.ok === true && r4.nothingToClean === true);
}

// ---- R.6 没有任何残留、读取也正常：nothingToClean；别的项目的凭证绝不碰 ----
{
  const t = await twoDevices("r6@example.com");
  await t.A.logout();
  const r = await t.A.retryAuthCleanup();
  check("R.6 正常退出后没有残留：hasLeftoverAuth() false，retry 为 nothingToClean", t.A.hasLeftoverAuth() === false && r.ok === true && r.nothingToClean === true, JSON.stringify(r));
}

// ---- R.7 动手前再确认一次：第一次读指针时还是空，清理前别的标签页刚好登录了 → 不删 ----
{
  const sc = await leftoverScene("r7@example.com");
  sc.fixStorage();
  const stA = sc.t.stA, reopened = sc.reopen();
  const real = stA.getItem; let n = 0;
  stA.getItem = (k) => { if (k === SESSION_KEY && ++n >= 2) return "u0000000001"; return real(k); }; // 第 2 次读起，指针出现
  const r = await reopened.retryAuthCleanup();
  stA.getItem = real;
  check("R.7 清理前指针刚好出现：拒绝（logged-in），凭证原样", r.ok === false && r.kind === "logged-in" && stA.getItem(AUTH_KEY) === sc.authRaw, JSON.stringify(r));
}

const failed = results.filter((r) => !r).length;
console.log(`\n登录/同步加固专项：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
