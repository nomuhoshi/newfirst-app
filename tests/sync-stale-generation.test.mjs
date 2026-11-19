// 同步任务的“账号会话代次”（Node，不联网）：退出 / 重新登录之后，旧的同步任务迟到的结果（成功或失败）不得污染新状态。
// 起因（GPT1 2026-11-20 05:00 任务 1）：强制退出后，迟到响应把状态从 null 改成 error；随后登录 B，旧 A 的响应还会把 B 的状态改成 conflict。
// 假 Supabase 在 fetch 层，可以挂起指定请求（读取 / 保存 / 刷新），退出或换账号之后再放行成功或失败的响应。
// 运行：node tests/sync-stale-generation.test.mjs
import { createSync } from "../src/sync.js";
import { GUEST_KEY } from "../src/account-store.js";
import { createApi } from "../src/cloud-api.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const within = (p, ms = 2000) => { let t; return Promise.race([p.then((v) => ({ settled: true, v })), new Promise((r) => { t = setTimeout(() => r({ settled: false }), ms); })]).finally(() => clearTimeout(t)); };
const J = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
const TODAY = "2026-11-03";

// ---------- 假 Supabase ----------
function fakeCloud() {
  const S = { users: new Map(), rows: new Map(), tokens: new Map(), codes: new Set(), n: 0, offline: false, expiresIn: 3600, offlineAfterVerify: false, rules: [], gate: null, count: {}, saveCalls: 0, log: [] };
  const mkSession = (uid, email) => { const k = ++S.n; const at = `AT-${k}`, rt = `RT-${k}`; S.tokens.set(at, uid); S.tokens.set(rt, uid); return { access_token: at, refresh_token: rt, expires_in: S.expiresIn, user: { id: uid, email } }; };
  S.issue = (code = "123456") => S.codes.add(code); // 模拟“发了一封验证码邮件”
  S.fail = (re, status, body, times = 1) => S.rules.push({ re, status, body, times });
  S.timeout = (re, times = 1) => S.rules.push({ re, stall: true, times }); // 请求一直不回（响应头都没有），被超时中止
  S.get = () => S.count["GET /rest/v1/progress"] || 0;
  S.hold = (re, failStatus = null) => { let release; const p = new Promise((r) => { release = r; }); S.gate = { re, p, failStatus }; return release; }; // failStatus：放行时这一个请求回这个失败状态（不影响期间别的请求）
  S.fetch = async (url, init) => {
    if (S.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), path = u.pathname, method = init.method || "GET", key = `${method} ${path}`, body = init.body ? JSON.parse(init.body) : null;
    S.count[key] = (S.count[key] || 0) + 1;
    if (S.gate && S.gate.re.test(key)) { const g = S.gate; S.gate = null; await g.p; if (g.failStatus) { S.log.push(`${key} → ${g.failStatus}（挂起后放行）`); return J(g.failStatus, { msg: "x" }); } }
    const rule = S.rules.find((r) => r.times > 0 && r.re.test(key));
    if (rule && rule.stall) { rule.times--; S.log.push(`${key} → 超时`); return new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); }
    if (rule) { rule.times--; S.log.push(`${key} → ${rule.status}`); return J(rule.status, rule.body); }
    const bearer = String(init.headers?.Authorization || "").replace(/^Bearer /, "");
    const uid = S.tokens.get(bearer);
    if (path === "/auth/v1/verify") {
      if (!S.codes.has(body.token)) return J(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      S.codes.delete(body.token); // 一次性
      if (S.offlineAfterVerify) { S.offline = true; S.offlineAfterVerify = false; } // 验证通过的这一刻起断网
      if (!S.users.has(body.email)) S.users.set(body.email, newId());
      return J(200, mkSession(S.users.get(body.email), body.email));
    }
    if (path === "/auth/v1/token") { const id = S.tokens.get(body.refresh_token); if (!id) return J(400, { code: 400, error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" }); const email = [...S.users].find(([, v]) => v === id)[0]; return J(200, mkSession(id, email)); }
    if (path === "/auth/v1/logout") { if (!uid) return J(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" }); S.tokens.delete(bearer); return J(204); }
    if (!uid) return J(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" });
    if (path === "/rest/v1/progress") { const r = S.rows.get(uid); return J(200, r ? [{ doc: r.doc, rev: r.rev }] : []); }
    if (path === "/rest/v1/rpc/create_progress") { if (S.rows.has(uid)) return J(200, null); S.rows.set(uid, { doc: body.new_doc, rev: 1 }); return J(200, 1); }
    if (path === "/rest/v1/rpc/save_progress") { S.saveCalls++; const r = S.rows.get(uid); if (!r || r.rev !== body.expected_rev) return J(200, null); S.rows.set(uid, { doc: body.new_doc, rev: r.rev + 1 }); return J(200, r.rev + 1); }
    return J(404, {});
  };
  S.xpOf = (email) => { const r = S.rows.get(S.users.get(email)); return r ? sumXp(r.doc) : null; };
  return S;
}
const fakeStorage = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; };
const snap = (st) => JSON.stringify([...st._m.entries()].sort());
const mkApi = (S) => createApi({ url: "https://fake.supabase.test", anonKey: "k", fetchFn: S.fetch, timeoutMs: 400, isOnline: () => !S.offline });
function device(S, storage = fakeStorage()) {
  const dev = { storage, state: freshState(), timers: [], clock: Date.now(), notices: [] };
  dev.sync = createSync({ storage, api: mkApi(S), schedule: (fn, ms) => { dev.timers.push({ fn, ms }); return dev.timers.length; }, today: () => TODAY, now: () => dev.clock, onState: (doc) => { dev.state = docToState(doc, dev.state); }, onNotice: (k) => dev.notices.push(k) });
  return dev;
}
const finishLesson = (dev, id, xp) => { const s = dev.state; s.xp += xp; s.done[id] = true; s.lessonsCompleted++; bumpStreak(s, new Date(TODAY + "T12:00:00")); return dev.sync.persistLocal(s); };
async function login(S, dev, email) { S.issue(); const v = await dev.sync.verify(email, "123456", dev.state); if (v.ok && v.state) dev.state = v.state; return v; }
// 游客记录：没登录时学的进度（storage.js 把它存在 GUEST_KEY 下）；登录时 sync.begin 读它，决定要不要让用户选“怎么处理”
const seedGuest = (dev, xp, lessons = ["u1-l1"]) => { dev.state = { ...freshState(), onboarded: true, xp, lessonsCompleted: lessons.length, done: Object.fromEntries(lessons.map((k) => [k, true])), streak: 1, lastDay: TODAY }; dev.storage.setItem(GUEST_KEY, JSON.stringify(dev.state)); };
const acctKeys = (st) => [...st._m.keys()].filter((k) => k.startsWith("suipian.acct.") && !k.includes("import."));


const EMAIL_A = "a@x.com", EMAIL_B = "b@x.com";
const GET = /GET \/rest\/v1\/progress/, CREATE = /POST \/rest\/v1\/rpc\/create_progress/, SAVE = /POST \/rest\/v1\/rpc\/save_progress/, REFRESH = /POST \/auth\/v1\/token/;
const tick = () => sleep(25);
const statusOf = (d) => d.sync.status();
const A_KEY = (st) => acctKeys(st).map((k) => k + "=" + st.getItem(k)).join("|");

// 一台已登录 A 的设备，本机有未上传的进度
async function loggedInA(S, { xp = 40 } = {}) {
  const d = device(S);
  const v = await login(S, d, EMAIL_A);
  if (!v.ok) throw new Error("登录 A 失败：" + JSON.stringify(v));
  finishLesson(d, "u1-l1", xp);
  return d;
}

// ===== 1. 挂起读取 → 强制退出 → 放行失败 / 成功：状态保持未登录，不安排重试 =====
for (const [label, failStatus] of [["503 失败", 503], ["成功", null]]) {
  const S = fakeCloud(), d = await loggedInA(S);
  const release = S.hold(GET, failStatus);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  const timersBefore = d.timers.length;
  await d.sync.forceLocalLogout();
  const afterLogout = { st: statusOf(d), snap: snap(d.storage), acct: d.sync.account() };
  release();
  const r = await within(p);
  await tick();
  check(`挂起读取 → 强制退出 → 放行${label}：旧任务结果是“已丢弃”（stale），不是成功也不是失败`, r.settled && r.v.stale === true && r.v.ok === false, JSON.stringify(r.v));
  check(`  退出后状态保持未登录：status 仍是 null（不会被迟到响应改成 error / offline / synced）`, statusOf(d).status === null && statusOf(d).message === "" && d.sync.account() === null, JSON.stringify(statusOf(d)));
  check(`  本机存储逐字节不变，没有写登录凭证，没有计时器被安排（不重试）`, snap(d.storage) === afterLogout.snap && !d.storage._m.has("suipian.auth") && d.timers.length === timersBefore, `timers ${timersBefore}→${d.timers.length}`);
  check(`  最近确认同步的时间戳没有被迟到响应写入`, statusOf(d).lastSyncedAt === null && statusOf(d).lastStatusAt === afterLogout.st.lastStatusAt);
}

// ===== 2. 挂起保存 → 强制退出 → 放行成功 =====
{
  const S = fakeCloud(), d = await loggedInA(S);
  const release = S.hold(SAVE);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  const timers0 = d.timers.length;
  await d.sync.forceLocalLogout();
  const snap0 = snap(d.storage);
  release();
  const r = await within(p); await tick();
  check("挂起保存 → 强制退出 → 放行成功：旧任务 stale；本机存储不变（不把 A 的新版本号写回、不清待同步标记）；状态仍为 null",
    r.settled && r.v.stale === true && snap(d.storage) === snap0 && statusOf(d).status === null && d.timers.length === timers0, JSON.stringify(r.v));
}

// ===== 3. 挂起令牌刷新 → 强制退出 → 放行：不写凭证、不报“登录账号不一致” =====
{
  const S = fakeCloud(); S.expiresIn = 30; // 令牌 30 秒后过期：同步前要先刷新
  const d = await loggedInA(S);
  const release = S.hold(REFRESH);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  const snap0 = snap(d.storage);
  release();
  const r = await within(p); await tick();
  check("挂起刷新 → 强制退出 → 放行：旧任务 stale；不重新写入登录凭证，状态仍为 null（不会变成“登录账号不一致”的 error）",
    r.settled && r.v.stale === true && !d.storage._m.has("suipian.auth") && snap(d.storage) === snap0 && statusOf(d).status === null, JSON.stringify([r.v, statusOf(d)]));
}

// ===== 2b. 云端还没有这个账号的记录：挂起创建 → 强制退出 → 放行成功 =====
{
  const S = fakeCloud(), d = await loggedInA(S);
  S.rows.delete(S.users.get(EMAIL_A));                       // 云端记录不存在：同步会走“创建”
  const release = S.hold(CREATE);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  const snap0 = snap(d.storage);
  release();
  const r = await within(p); await tick();
  check("挂起创建 → 强制退出 → 放行成功：旧任务 stale；本机存储不变，状态仍为 null", r.settled && r.v.stale === true && snap(d.storage) === snap0 && statusOf(d).status === null, JSON.stringify(r.v));
}

// ===== 3b. 挂起刷新 → 强制退出 → 再登录【同一个】账号 → 放行：旧刷新结果不得覆盖新会话的凭证 =====
{
  const S = fakeCloud(); S.expiresIn = 30;
  const d = await loggedInA(S);
  const release = S.hold(REFRESH);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  await login(S, d, EMAIL_A);                                // 新会话（新令牌）
  const authNew = d.storage.getItem("suipian.auth");
  release();
  const r = await within(p); await tick();
  check("A→退出→A，旧刷新放行：旧任务 stale；存储里的凭证仍是新会话的（没被旧令牌覆盖）", r.settled && r.v.stale === true && d.storage.getItem("suipian.auth") === authNew && authNew !== null, JSON.stringify(r.v));
}

// ===== 4. A → 退出 → 再登录 A：旧任务（失败 / 成功）不得覆盖新会话的状态、凭证、进度、时间戳 =====
for (const [label, failStatus] of [["503 失败", 503], ["成功", null]]) {
  const S = fakeCloud(), d = await loggedInA(S);
  const release = S.hold(GET, failStatus);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  const again = await login(S, d, EMAIL_A);               // 同一个账号再登录：新会话
  const ns = await d.sync.syncNow({ manual: true });       // 新会话自己同步一次
  const mine = { st: statusOf(d), auth: d.storage.getItem("suipian.auth"), acct: A_KEY(d.storage), xp: S.xpOf(EMAIL_A), timers: d.timers.length };
  release();
  const r = await within(p); await tick();
  check(`A→退出→A，旧任务放行${label}：旧任务 stale`, again.ok && ns.ok && r.settled && r.v.stale === true, JSON.stringify([again.ok, ns, r.v]));
  check(`  新会话的状态 / 凭证 / 本机进度 / 云端进度 / 时间戳 / 计时器都没被旧响应改动`, JSON.stringify(statusOf(d)) === JSON.stringify(mine.st) && d.storage.getItem("suipian.auth") === mine.auth && A_KEY(d.storage) === mine.acct && S.xpOf(EMAIL_A) === mine.xp && d.timers.length === mine.timers, JSON.stringify([statusOf(d), mine.st]));
  check(`  新会话仍是已登录且已同步（status = synced）`, d.sync.account()?.email === EMAIL_A && statusOf(d).status === "synced", JSON.stringify(statusOf(d)));
}

// ===== 5. A → 退出 → 登录 B：A 的旧响应不得把 B 的状态改成 conflict / error，不得动 B 的进度 =====
for (const [label, failStatus, hookRe] of [["503 失败", 503, GET], ["成功", null, GET], ["刷新被拒（400）", 400, REFRESH]]) {
  const S = fakeCloud(); if (hookRe === REFRESH) S.expiresIn = 30;
  const d = await loggedInA(S);
  const release = S.hold(hookRe, failStatus);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  S.expiresIn = 3600;
  const vb = await login(S, d, EMAIL_B);
  finishLesson(d, "u1-l1", 70);                              // B 自己学了 70 XP（未上传）
  const before = { st: statusOf(d), auth: d.storage.getItem("suipian.auth"), acct: A_KEY(d.storage), xpA: S.xpOf(EMAIL_A), timers: d.timers.length };
  release();
  const r = await within(p); await tick();
  check(`A→退出→B，旧任务放行（${label}）：旧任务 stale，B 已登录`, vb.ok && d.sync.account()?.email === EMAIL_B && r.settled && r.v.stale === true, JSON.stringify([vb.ok, r.v]));
  check(`  B 的状态 / 凭证 / 本机进度（含待同步标记）/ A 的云端进度 / 计时器都没被旧响应改动；状态不是 conflict / error`, JSON.stringify(statusOf(d)) === JSON.stringify(before.st) && d.storage.getItem("suipian.auth") === before.auth && A_KEY(d.storage) === before.acct && S.xpOf(EMAIL_A) === before.xpA && d.timers.length === before.timers && !["conflict", "error", "offline"].includes(statusOf(d).status), JSON.stringify(statusOf(d)));
  const nb = await d.sync.syncNow({ manual: true });
  check(`  B 的新会话能独立同步：成功，B 的云端进度 = 70 XP`, nb.ok === true && S.xpOf(EMAIL_B) === 70 && statusOf(d).status === "synced", JSON.stringify([nb, S.xpOf(EMAIL_B)]));
}

// ===== 6. 旧任务结束时，新会话的同步仍在运行：旧任务的收尾不能清掉新同步的 running =====
{
  const S = fakeCloud(), d = await loggedInA(S);
  const releaseOld = S.hold(GET);
  const pOld = d.sync.syncNow({ manual: true });
  await tick();
  await d.sync.forceLocalLogout();
  await login(S, d, EMAIL_B);
  finishLesson(d, "u1-l1", 70);
  const releaseNew = S.hold(GET);                              // B 的同步停在读取
  const pNew = d.sync.syncNow({ manual: true });
  await tick();
  const getsBefore = S.get();
  releaseOld();                                                 // 旧任务（A）现在结束
  await within(pOld); await tick();
  const joined = d.sync.syncNow({ manual: true });             // 新同步还在跑：这次调用必须并入它，而不是另开一轮
  await tick();
  check("旧任务结束时新同步仍在运行：再触发同步会并入正在跑的那一轮（没有另发读取请求）", S.get() === getsBefore, `读取 ${getsBefore}→${S.get()}`);
  releaseNew();
  const [rn, rj] = await Promise.all([pNew, joined]);
  check("  新同步正常完成，B 的云端进度 = 70 XP，状态 synced", rn.ok === true && rj.ok === true && S.xpOf(EMAIL_B) === 70 && statusOf(d).status === "synced", JSON.stringify([rn, rj, S.xpOf(EMAIL_B)]));
}

// ===== 7. 旧任务之前排好的重试 / 自动同步计时器：退出后再登录，到点也不发请求 =====
{
  const S = fakeCloud(), d = await loggedInA(S);
  S.offline = true;
  const r0 = await d.sync.syncNow({ manual: true });           // 断网失败 → 排了一个退避重试
  const scheduled = d.timers.length;
  S.offline = false;
  await d.sync.forceLocalLogout();
  await login(S, d, EMAIL_B);
  const gets = S.get();
  for (const t of d.timers) t.fn();                              // 旧计时器到点
  await tick();
  check("A 排好的重试计时器：退出并登录 B 之后到点，不发任何请求，也不改 B 的状态", r0.ok === false && r0.kind === "network" && scheduled >= 2 && S.get() === gets && statusOf(d).status !== "error" && statusOf(d).status !== "offline", `计时器 ${scheduled}，读取 ${gets}→${S.get()}，状态 ${statusOf(d).status}`);
}

// ===== 8. 正常路径不受影响 =====
{ // 8a 正常令牌刷新：同步前刷新，成功写回新凭证
  const S = fakeCloud(); S.expiresIn = 30;
  const d = await loggedInA(S);
  const before = d.storage.getItem("suipian.auth");
  const r = await d.sync.syncNow({ manual: true });
  check("正常令牌刷新：同步成功，凭证已换成新的，状态 synced", r.ok === true && d.storage.getItem("suipian.auth") !== before && statusOf(d).status === "synced", JSON.stringify([r.ok, statusOf(d)]));
}
{ // 8b 普通退出失败（云端 503）→ 回滚仍登录；退出期间在途的同步不受影响，正常完成
  const S = fakeCloud(), d = await loggedInA(S);
  const release = S.hold(GET);
  const p = d.sync.syncNow({ manual: true });
  await tick();
  S.fail(/POST \/auth\/v1\/logout/, 503, { msg: "x" });
  const loP = d.sync.logout();                                  // 普通退出会等在途同步结束；先放行再取结果
  await tick();
  release();
  const [lo, r] = [await loP, await within(p)]; await tick();
  check("普通退出失败后回滚：仍登录，在途同步不被当成旧任务，正常完成（synced），云端进度 = 40 XP", lo.ok === false && d.sync.account()?.email === EMAIL_A && r.settled && r.v.ok === true && statusOf(d).status === "synced" && S.xpOf(EMAIL_A) === 40, JSON.stringify([lo.ok, r.v, statusOf(d)]));
}
{ // 8c 普通同步（没有任何退出）仍正常
  const S = fakeCloud(), d = await loggedInA(S);
  const r = await d.sync.syncNow({ manual: true });
  check("没有退出的普通同步：成功，云端 40 XP", r.ok === true && S.xpOf(EMAIL_A) === 40 && statusOf(d).status === "synced");
}

const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
