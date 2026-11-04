// 账号登录与云端同步：用内存里的假 Supabase（带版本检查、按账号隔离）跑“两个账号、多台设备”的验收场景。
// 不依赖浏览器，纯 Node。运行：node tests/cloud-sync.test.mjs
import { createSync, AUTH_KEY } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { freshState, bumpStreak, loseHeart } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";
import { GUEST_KEY } from "../src/account-store.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

// ---------- 假 Supabase ----------
function fakeServer() {
  const users = new Map(), rows = new Map(), tokens = new Map();
  let n = 0;
  const S = { users, rows, tokens, expireAll: false, sendLog: [], rpcCalls: 0 };
  S.apiFor = (dev) => {
    const online = () => !dev.offline;
    const net = { ok: false, kind: "network", message: "网络连不上" };
    const auth = (session) => { const u = tokens.get(session.accessToken); return u && !(S.expireAll && session.accessToken.startsWith("old-")) ? u : null; };
    const mk = (uid, email, tag = "at") => { const at = `${tag}-${++n}`; const rt = `rt-${n}`; tokens.set(at, uid); tokens.set(rt, uid); return { accessToken: at, refreshToken: rt, expiresAt: Date.now() + (dev.shortToken ? 1000 : 3600000), userId: uid, email }; };
    return {
      configured: true,
      async sendCode(email) { if (!online()) return net; S.sendLog.push(email); return { ok: true }; },
      async verifyCode(email, code) { if (!online()) return net; if (code !== "123456") return { ok: false, kind: "auth", message: "验证码不对或已过期" };
        if (!users.has(email)) users.set(email, "u" + newId()); return { ok: true, session: mk(users.get(email), email) }; },
      async refresh(session) { if (!online()) return net; const uid = tokens.get(session.refreshToken); if (!uid) return { ok: false, kind: "auth", message: "登录已失效" }; return { ok: true, session: mk(uid, session.email) }; },
      async signOut(session) { if (online()) { tokens.delete(session.accessToken); tokens.delete(session.refreshToken); } return { ok: true }; },
      async getProgress(session) { if (!online()) return net; const uid = auth(session); if (!uid) return { ok: false, kind: "auth", message: "未登录" }; const r = rows.get(uid); return { ok: true, row: r ? JSON.parse(JSON.stringify(r)) : null }; },
      async createProgress(session, doc) { if (!online()) return net; const uid = auth(session); if (!uid) return { ok: false, kind: "auth" }; S.rpcCalls++; if (rows.has(uid)) return { ok: true, rev: null }; rows.set(uid, { doc: JSON.parse(JSON.stringify(doc)), rev: 1 }); return { ok: true, rev: 1 }; },
      async saveProgress(session, expected, doc) { if (!online()) return net; const uid = auth(session); if (!uid) return { ok: false, kind: "auth" }; S.rpcCalls++; const r = rows.get(uid); if (!r || r.rev !== expected) return { ok: true, rev: null }; r.doc = JSON.parse(JSON.stringify(doc)); r.rev++; return { ok: true, rev: r.rev }; },
      async deleteAccount(session) { if (!online()) return net; const uid = auth(session); if (!uid) return { ok: false, kind: "auth" }; rows.delete(uid); for (const [e, u] of users) if (u === uid) users.delete(e); return { ok: true }; },
    };
  };
  return S;
}
function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; }
const TODAY = "2026-11-03";
function device(server, name) {
  const dev = { name, storage: fakeStorage(), offline: false, state: freshState(), timers: [] };
  const base = server.apiFor(dev);
  const api = { ...base, async getProgress(session) { if (dev.hold) { await dev.hold; if (dev.heldFails) return { ok: false, kind: "network", message: "网络连不上" }; } return base.getProgress(session); } }; // dev.hold：让读云端卡住，用来模拟“断网时发出的请求”
  dev.sync = createSync({ storage: dev.storage, api, schedule: (fn, ms) => { dev.timers.push({ fn, ms }); return dev.timers.length; }, today: () => TODAY, onState: (doc) => { dev.state = docToState(doc, dev.state); } });
  return dev;
}
// 模拟应用里“完成一关”：加 XP、记完成、连续天数，然后保存
function finishLesson(dev, id, xp = 20) { const s = dev.state; s.xp += xp; s.done[id] = true; s.lessonsCompleted++; bumpStreak(s, new Date(TODAY + "T12:00:00")); return dev.sync.persistLocal(s); }
async function login(dev, email, choice = null) {
  const v = await dev.sync.verify(email, "123456", dev.state);
  if (!v.ok) return v;
  const r = v.needChoice ? await dev.sync.finishChoice(choice) : v;
  if (r.ok && r.state) dev.state = r.state;
  return r;
}
const xpOf = (server, email) => sumXp(server.rows.get(server.users.get(email)).doc);

// ---------- 1. 两个账号、两台设备 ----------
{
  const S = fakeServer();
  const a1 = device(S, "A-iPhone"), a2 = device(S, "A-iPad"), b1 = device(S, "B-phone");
  check("登录：新账号第一次登录成功，云端创建一行", (await login(a1, "a@x.com")).ok && S.rows.size === 1);
  finishLesson(a1, "U1L1", 20); finishLesson(a1, "U1L2", 20);
  check("A 在 iPhone 完成两关后同步，云端有 40 XP 和两关", (await a1.sync.syncNow()).ok && xpOf(S, "a@x.com") === 40 && Object.keys(S.rows.get(S.users.get("a@x.com")).doc.done).length === 2);
  const r2 = await login(a2, "a@x.com");
  check("A 换到 iPad 登录：恢复 40 XP、两关、连续天数", r2.ok && a2.state.xp === 40 && a2.state.done.U1L1 && a2.state.done.U1L2 && a2.state.streak === 1, JSON.stringify({ xp: a2.state.xp, done: a2.state.done }));
  const rb = await login(b1, "b@x.com");
  check("B 登录：看不到 A 的进度（0 XP、没有完成的关卡）", rb.ok && b1.state.xp === 0 && Object.keys(b1.state.done).length === 0 && S.rows.size === 2);
  finishLesson(b1, "U1L1", 20); await b1.sync.syncNow();
  check("B 学习后，A 的云端记录不变", xpOf(S, "a@x.com") === 40 && xpOf(S, "b@x.com") === 20);
  // iPad 上继续学，iPhone 回来合并
  finishLesson(a2, "U1L3", 20); await a2.sync.syncNow(); await a1.sync.syncNow();
  check("A 在 iPad 学新关后，iPhone 同步得到 60 XP 和三关", a1.state.xp === 60 && a1.state.done.U1L3 && xpOf(S, "a@x.com") === 60, String(a1.state.xp));
  const before = JSON.stringify(S.rows.get(S.users.get("a@x.com")));
  await a1.sync.syncNow(); await a2.sync.syncNow(); await a1.sync.syncNow();
  check("重复同步不改变云端内容，也不重复加分", JSON.stringify(S.rows.get(S.users.get("a@x.com"))) === before && a1.state.xp === 60 && a2.state.xp === 60);
}

// ---------- 2. 断网、重连 ----------
{
  const S = fakeServer();
  const d1 = device(S, "d1"), d2 = device(S, "d2");
  await login(d1, "c@x.com"); await login(d2, "c@x.com");
  d1.offline = true; d2.offline = true;
  finishLesson(d1, "U1L1", 20); finishLesson(d1, "U1L2", 20);
  finishLesson(d2, "U1L1", 20); finishLesson(d2, "U1L3", 20); // U1L1 两台设备都做了：XP 各挣各的，关卡只记一次
  check("离线：本机照常保存进度，状态显示未同步", (await d1.sync.syncNow()).ok === false && d1.sync.status().status === "offline" && d1.state.xp === 40);
  d1.offline = false; d2.offline = false;
  await d1.sync.syncNow(); await d2.sync.syncNow(); await d1.sync.syncNow();
  const doc = S.rows.get(S.users.get("c@x.com")).doc;
  check("重连后：两台设备各挣的 XP 相加一次（80），关卡并集（3 关），没有丢也没有重复", sumXp(doc) === 80 && Object.keys(doc.done).length === 3 && d1.state.xp === 80 && d2.state.xp === 80, `云端 ${sumXp(doc)} · d1 ${d1.state.xp} · d2 ${d2.state.xp}`);
  const before = JSON.stringify(S.rows.get(S.users.get("c@x.com")).doc);
  for (let i = 0; i < 3; i++) { await d1.sync.syncNow(); await d2.sync.syncNow(); }
  check("再同步很多次也不会多加分", JSON.stringify(S.rows.get(S.users.get("c@x.com")).doc) === before && sumXp(S.rows.get(S.users.get("c@x.com")).doc) === 80);
  // 离线时重启（模拟刷新页面）：本机副本还在，继续学，联网后补上
  d1.offline = true; finishLesson(d1, "U1L4", 20);
  const again = createSync({ storage: d1.storage, api: S.apiFor(d1), schedule: () => 0, today: () => TODAY, onState: () => {} });
  const rs = again.restore(freshState());
  check("离线重启：从本机副本恢复账号和进度（100 XP）", rs && rs.state.xp === 100 && rs.state.done.U1L4, rs ? String(rs.state.xp) : "null");
  d1.offline = false; d1.sync = again; again.persistLocal({ ...rs.state }); await again.syncNow();
  check("联网后离线期间的进度补传，云端 100 XP", sumXp(S.rows.get(S.users.get("c@x.com")).doc) === 100);
}

// ---------- 3. 并发：两台设备几乎同时写 ----------
{
  const S = fakeServer();
  const d1 = device(S, "p1"), d2 = device(S, "p2");
  await login(d1, "p@x.com"); await login(d2, "p@x.com");
  finishLesson(d1, "U1L1", 20); finishLesson(d2, "U1L2", 20);
  const [r1, r2] = await Promise.all([d1.sync.syncNow(), d2.sync.syncNow()]);
  await d1.sync.syncNow(); await d2.sync.syncNow();
  const doc = S.rows.get(S.users.get("p@x.com")).doc;
  check("并发写入：版本检查让后到的重新合并，最终两边都是 40 XP、两关", r1.ok && r2.ok && sumXp(doc) === 40 && Object.keys(doc.done).length === 2 && d1.state.xp === 40 && d2.state.xp === 40, `${sumXp(doc)}`);
}

// ---------- 4. 游客记录 ----------
{
  const S = fakeServer();
  const g = device(S, "guest-dev");
  g.state = { ...freshState(), onboarded: true, xp: 70, lessonsCompleted: 4, done: { U1L1: true, U1L2: true, U1L3: true, U1L4: true }, streak: 1, lastDay: TODAY };
  g.storage.setItem(GUEST_KEY, JSON.stringify(g.state));
  const v = await g.sync.verify("g@x.com", "123456", g.state);
  check("游客有进度、云端为空：登录后先问用户怎么处理（不自动转存）", v.ok && v.needChoice === true && v.cloudHasData === false && v.guest.xp === 70);
  const r = await g.sync.finishChoice("transfer");
  check("选择转存：账号里有 70 XP 和四关，游客记录读回一致后才清除", r.ok && r.state.xp === 70 && xpOf(S, "g@x.com") === 70 && r.guestCleared === true && g.storage.getItem(GUEST_KEY) === null);
  // 云端已有进度，另一台设备有游客记录：选“用云端”→ 游客记录保留
  const h = device(S, "guest-dev2");
  h.state = { ...freshState(), onboarded: true, xp: 30, lessonsCompleted: 2, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY };
  h.storage.setItem(GUEST_KEY, JSON.stringify(h.state));
  const v2 = await h.sync.verify("g@x.com", "123456", h.state);
  check("云端已有进度且这台有游客记录：提示云端已有数据", v2.ok && v2.needChoice && v2.cloudHasData === true);
  const r2 = await h.sync.finishChoice("cloud");
  check("选择用云端：显示云端的 70 XP，游客记录原样保留", r2.ok && r2.state.xp === 70 && h.storage.getItem(GUEST_KEY) !== null && r2.guestCleared === false);
  // 第三台：选“用游客覆盖云端” → 云端换成游客的内容（代数 +1），需要用户明确选择
  const k = device(S, "guest-dev3");
  k.state = { ...freshState(), onboarded: true, xp: 10, lessonsCompleted: 1, done: { U1L1: true }, streak: 1, lastDay: TODAY };
  k.storage.setItem(GUEST_KEY, JSON.stringify(k.state));
  await k.sync.verify("g@x.com", "123456", k.state);
  const r3 = await k.sync.finishChoice("transfer");
  check("明确选择“用游客覆盖云端”：云端变成 10 XP（代数 +1）", r3.ok && xpOf(S, "g@x.com") === 10 && S.rows.get(S.users.get("g@x.com")).doc.gen === 2);
}

// ---------- 5. 退出、重新登录、切换账号 ----------
{
  const S = fakeServer();
  const d = device(S, "sw");
  await login(d, "s1@x.com"); finishLesson(d, "U1L1", 20); finishLesson(d, "U1L2", 20);
  const lo = await d.sync.logout();
  check("退出登录：已同步的内容不丢；本机副本与凭证被清除，回到游客", lo.ok && d.sync.account() === null && d.storage.getItem(AUTH_KEY) === null && [...d.storage._m.keys()].every((k) => !k.startsWith("suipian.acct.")));
  d.state = freshState();
  const b = await login(d, "s2@x.com");
  check("同一台设备切换到账号 B：看不到 A 的进度", b.ok && d.state.xp === 0 && Object.keys(d.state.done).length === 0);
  await d.sync.logout();
  d.state = freshState();
  const a = await login(d, "s1@x.com");
  check("再切回 A：进度完整恢复（40 XP、两关）", a.ok && d.state.xp === 40 && d.state.done.U1L2, String(d.state.xp));
  // 离线退出：有未同步内容时不直接丢
  finishLesson(d, "U1L3", 20); d.offline = true;
  const lo2 = await d.sync.logout();
  check("离线时退出：有未同步内容 → 拒绝并提示（不静默丢进度）", lo2.ok === false && lo2.pending === true && d.sync.account() !== null);
  const lo3 = await d.sync.logout({ force: true });
  check("确认后强制退出：成功", lo3.ok && d.sync.account() === null);
}

// ---------- 6. 令牌过期、验证码错误、删除账号 ----------
{
  const S = fakeServer();
  const d = device(S, "tk");
  const bad = await d.sync.verify("t@x.com", "000000", d.state);
  check("验证码不对：登录失败，不创建任何本机或云端数据", bad.ok === false && bad.kind === "auth" && S.rows.size === 0 && d.sync.account() === null);
  d.shortToken = true;
  await login(d, "t@x.com"); finishLesson(d, "U1L1", 20);
  const r = await d.sync.syncNow();
  check("访问令牌快过期：自动刷新后同步成功", r.ok && xpOf(S, "t@x.com") === 20);
  // 刷新令牌被服务器撤销 → 需要重新登录，但本机进度仍可继续
  for (const k of [...S.tokens.keys()]) if (k.startsWith("rt-")) S.tokens.delete(k);
  finishLesson(d, "U1L2", 20);
  const r2 = await d.sync.syncNow();
  check("登录失效：提示重新登录，本机进度仍在、可继续学习", r2.ok === false && d.sync.status().status === "need-login" && d.state.xp === 40);
  const del = await (async () => { const d2 = device(S, "del"); await login(d2, "t@x.com"); return d2.sync.deleteAccount(); })();
  check("删除账号：云端记录和账号都被删除", del.ok && S.rows.size === 0 && !S.users.has("t@x.com"));
}

// ---------- 7. 红心跟着账号 ----------
{
  const S = fakeServer();
  const d1 = device(S, "h1"), d2 = device(S, "h2");
  await login(d1, "h@x.com"); await login(d2, "h@x.com");
  loseHeart(d1.state); loseHeart(d1.state); d1.sync.persistLocal(d1.state); await d1.sync.syncNow();
  await d2.sync.syncNow();
  check("红心：d1 扣两颗后，d2 同步得到 3 颗", d1.state.hearts === 3 && d2.state.hearts === 3, `${d1.state.hearts}/${d2.state.hearts}`);
}

// ---------- 8. 接口：请求长什么样、错误怎么分类 ----------
{
  const calls = [];
  const fetchFn = async (url, opt) => { calls.push({ url, opt }); const u = new URL(url);
    const reply = (status, body) => ({ ok: status < 300, status, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
    if (u.pathname === "/auth/v1/otp") return reply(200, {});
    if (u.pathname === "/auth/v1/verify") return JSON.parse(opt.body).token === "111111" ? reply(200, { access_token: "A", refresh_token: "R", expires_in: 3600, user: { id: "u1", email: "e@x.com" } }) : reply(403, { msg: "Token has expired or is invalid" });
    if (u.pathname === "/rest/v1/progress") return reply(200, []);
    if (u.pathname === "/rest/v1/rpc/save_progress") return reply(200, null);
    if (u.pathname === "/rest/v1/rpc/create_progress") return reply(200, 1);
    return reply(429, { msg: "rate" });
  };
  const api = createApi({ url: "https://p.supabase.co/", anonKey: "pub", fetchFn });
  await api.sendCode("e@x.com");
  const v = await api.verifyCode("e@x.com", " 111111 ");
  const bad = await api.verifyCode("e@x.com", "222222");
  const g = await api.getProgress(v.session);
  const sv = await api.saveProgress(v.session, 3, { schema: 1 });
  const cr = await api.createProgress(v.session, { schema: 1 });
  check("接口：验证码请求带 create_user、验证请求 type=email 且去掉空格", JSON.parse(calls[0].opt.body).create_user === true && JSON.parse(calls[1].opt.body).type === "email" && JSON.parse(calls[1].opt.body).token === "111111" && calls[0].url === "https://p.supabase.co/auth/v1/otp");
  check("接口：验证码错误归类为 auth；登录成功拿到会话", bad.ok === false && bad.kind === "auth" && v.ok && v.session.userId === "u1");
  check("接口：读进度带用户令牌；没有记录 → row=null；保存被抢先 → rev=null；创建 → rev=1", calls[3].opt.headers.Authorization === "Bearer A" && g.ok && g.row === null && sv.ok && sv.rev === null && cr.rev === 1);
  check("接口：保存请求带 expected_rev", JSON.parse(calls[4].opt.body).expected_rev === 3);
  const off = createApi({ url: "https://p.supabase.co", anonKey: "pub", fetchFn: async () => { throw new Error("offline"); } });
  const none = createApi({ url: "", anonKey: "" });
  check("接口：断网归类为 network；没配置 → config", (await off.sendCode("a@b.c")).kind === "network" && (await none.sendCode("a@b.c")).kind === "config");
}

// ---------- 回归：A2 重连后停在旧值（断网时发出的请求失败，被后来的同步请求“借走”失败结果）----------
{
  const S = fakeServer();
  const a1 = device(S, "A-iPhone"), a2 = device(S, "A-iPad");
  await login(a1, "r@x.com"); finishLesson(a1, "U1L1", 20); await a1.sync.syncNow();
  await login(a2, "r@x.com");
  // iPhone 断网学习 30 XP；iPad 联网学习 30 XP 并同步
  a1.offline = true; finishLesson(a1, "U1L2", 30);
  finishLesson(a2, "U1L3", 30); await a2.sync.syncNow();
  check("准备：iPad 先同步，云端 50 XP（20 + iPad 30）；iPhone 离线本机 50 XP", xpOf(S, "r@x.com") === 50 && a1.state.xp === 20 + 30);
  // 联网事件触发的同步（P1）卡在断网时发出的读云端请求上；这时又有人要求同步（P2，借用 P1）；P1 失败后网络已恢复
  let release; a1.hold = new Promise((r) => { release = r; }); a1.heldFails = true;
  const p1 = a1.sync.syncNow();
  await new Promise((r) => setImmediate(r));
  const p2 = a1.sync.syncNow();
  release(); a1.hold = null; a1.offline = false; // 卡住的请求在断网状态下失败（heldFails），随后网络恢复
  const r1 = await p1, r2b = await p2;
  check("单次重连：后来要求同步的那次拿到的是成功结果，不是借来的旧失败", r2b.ok === true, JSON.stringify(r2b));
  check("单次重连：云端合并为 80 XP（20 + 30 + 30），没有重复加分", xpOf(S, "r@x.com") === 80, String(xpOf(S, "r@x.com")));
  check("单次重连后 iPad 再同步一次就是 80 XP（不需要多余的轮次）", (await a2.sync.syncNow()).ok && a2.state.xp === 80 && a1.state.xp === 80, `${a1.state.xp}/${a2.state.xp}`);
  await a1.sync.syncNow(); await a2.sync.syncNow();
  check("再多同步几次仍是 80 XP", xpOf(S, "r@x.com") === 80 && a1.state.xp === 80 && a2.state.xp === 80);
}
// 没有人催的时候，网络失败也要自己重试（退避），不能一直停在“离线”
{
  const S = fakeServer();
  const a1 = device(S, "A-iPhone");
  await login(a1, "t@x.com"); finishLesson(a1, "U1L1", 20); await a1.sync.syncNow();
  a1.offline = true; finishLesson(a1, "U1L2", 30);
  const r = await a1.sync.syncNow();
  check("断网同步失败：状态是离线，并且安排了退避重试", r.ok === false && a1.sync.status().status === "offline" && a1.timers.some((t) => t.ms === 3000), JSON.stringify(a1.timers.map((t) => t.ms)));
  a1.offline = false; a1.timers.filter((t) => t.ms === 3000).forEach((t) => t.fn());
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  check("网络恢复后，重试自动把离线学的 30 XP 补传到云端（50 XP）", xpOf(S, "t@x.com") === 50 && a1.sync.status().status === "synced", `${xpOf(S, "t@x.com")} ${a1.sync.status().status}`);
}

const failed = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
