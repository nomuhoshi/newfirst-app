// 退出操作的去重与旧结果隔离（Node，不联网）：同一会话重复退出合并成一次云端撤销；被新会话 / 强制退出取代的旧退出，迟到的撤销结果
// （成功 / 失败 / 刷新）不得撤销新会话、回滚旧账号、清新凭证、改状态，也不得让界面再走一次“已退出”。
// 起因（GPT1 2026-11-20 12:51 第 1 单）：A 连续两次退出，第一次完成后登录 B，第二次旧退出迟到返回 204 会清掉 B 的凭证；迟到返回 503 会把 A 的账号指针和凭证写回，造成内存与存储账号不一致。
// 假 Supabase 在 fetch 层，可以挂起退出请求，之后放行成功 / 失败。
// 运行：node tests/logout-dedupe-stale.test.mjs
import { createSync } from "../src/sync.js";
import { GUEST_KEY } from "../src/account-store.js";
import { createApi } from "../src/cloud-api.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";

const results = [];
let CUR_MODE = ""; // 跑两遍：无锁 / 有 Web Locks（假的独占锁，按名字排队，和真实 navigator.locks 的语义一致）
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${CUR_MODE ? "[" + CUR_MODE + "] " : ""}${name}${detail ? "  — " + detail : ""}`); };
function fakeLocks() { const tails = new Map(); return { request: async (name, opts, cb) => { const prev = tails.get(name) || Promise.resolve(); let rel; const mine = new Promise((r) => { rel = r; }); tails.set(name, prev.then(() => mine)); await prev; try { return await cb(); } finally { rel(); } } }; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const within = (p, ms = 2000) => { let t; return Promise.race([p.then((v) => ({ settled: true, v })), new Promise((r) => { t = setTimeout(() => r({ settled: false }), ms); })]).finally(() => clearTimeout(t)); };
const J = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
const TODAY = "2026-11-03";

// ---------- 假 Supabase ----------
function fakeCloud() {
  const S = { users: new Map(), rows: new Map(), tokens: new Map(), codes: new Set(), n: 0, offline: false, expiresIn: 3600, offlineAfterVerify: false, rules: [], gates: [], count: {}, saveCalls: 0, log: [] };
  const mkSession = (uid, email) => { const k = ++S.n; const at = `AT-${k}`, rt = `RT-${k}`; S.tokens.set(at, uid); S.tokens.set(rt, uid); return { access_token: at, refresh_token: rt, expires_in: S.expiresIn, user: { id: uid, email } }; };
  S.issue = (code = "123456") => S.codes.add(code); // 模拟“发了一封验证码邮件”
  S.fail = (re, status, body, times = 1) => S.rules.push({ re, status, body, times });
  S.timeout = (re, times = 1) => S.rules.push({ re, stall: true, times }); // 请求一直不回（响应头都没有），被超时中止
  S.get = () => S.count["GET /rest/v1/progress"] || 0;
  S.hold = (re, failStatus = null) => { let release; const p = new Promise((r) => { release = r; }); S.gates.push({ re, p, failStatus }); return release; }; // 可以同时挂起多个不同的请求（按先后各挂一个） // failStatus：放行时这一个请求回这个失败状态（不影响期间别的请求）
  S.fetch = async (url, init) => {
    if (S.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), path = u.pathname, method = init.method || "GET", key = `${method} ${path}`, body = init.body ? JSON.parse(init.body) : null;
    S.count[key] = (S.count[key] || 0) + 1;
    const gi = S.gates.findIndex((x) => x.re.test(key));
    if (gi >= 0) { const g = S.gates.splice(gi, 1)[0]; await g.p; if (g.failStatus) { const fs = g.failStatus; S.log.push(`${key} → ${fs.status ?? fs}（挂起后放行）`); return J(fs.status ?? fs, fs.body ?? { msg: "x" }); } }
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
    if (path === "/rest/v1/rpc/delete_my_account") { if (!uid) return J(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" }); S.rows.delete(uid); return J(200, null); }
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
function device(S, storage = fakeStorage(), locks = null) {
  const dev = { storage, state: freshState(), timers: [], clock: Date.now(), notices: [] };
  dev.sync = createSync({ storage, api: mkApi(S), retryLocks: locks || (CUR_MODE === "有 Web Locks" ? fakeLocks() : {}), schedule: (fn, ms) => { dev.timers.push({ fn, ms }); return dev.timers.length; }, today: () => TODAY, now: () => dev.clock, onState: (doc) => { dev.state = docToState(doc, dev.state); }, onNotice: (k) => dev.notices.push(k) });
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

const LOGOUT = /POST \/auth\/v1\/logout/, outs = (S) => S.count["POST /auth/v1/logout"] || 0;
const authRaw = (d) => d.storage.getItem("suipian.auth");
const ptr = (d) => d.storage.getItem("suipian.account.current") ?? [...d.storage._m.entries()].find(([k]) => /account.*current|current.*account/.test(k))?.[1] ?? null;
// 内存和存储里的账号必须一致：登录 X → 内存账号是 X、存储里的凭证是 X 的；没登录 → 内存空、存储没有凭证
const consistent = (d, email) => {
  const a = d.sync.account(), raw = authRaw(d);
  if (!email) return a === null && raw === null;
  let sess = null; try { sess = JSON.parse(raw)?.session; } catch {}
  return a?.email === email && !!sess && sess.email === email;
};

for (const MODE of ["无锁", "有 Web Locks"]) {
CUR_MODE = MODE;

// ===== 1. 重复点击只撤销一次（合并） =====
for (const revokeFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT, revokeFails ? 503 : null);
  const p1 = d.sync.logout(), p2 = d.sync.logout(), p3 = d.sync.logout();
  await tick();
  check(`1a 同一会话连点三次退出（撤销${revokeFails ? "失败" : "成功"}）：只发出 1 次云端撤销，三次拿到同一个结果`, outs(S) === 1 && p1 === p2 && p2 === p3, `撤销请求=${outs(S)}`);
  rel(); const [r1, r2, r3] = await Promise.all([p1, p2, p3]); await tick();
  check(`1b 放行后：三个调用结果一致且云端撤销总共 1 次；${revokeFails ? "失败 → 回滚，仍是登录 A，内存与存储一致" : "成功 → 已退出，内存与存储都没有账号"}`, outs(S) === 1 && r1 === r2 && r2 === r3 && (revokeFails ? r1.ok === false && r1.stayed === true && consistent(d, EMAIL_A) : r1.ok === true && consistent(d, null)), JSON.stringify([r1, outs(S)]));
}
{ // 退出前要先上传未同步的进度：这段等待里的重复点击也合并
  const S = fakeCloud(); const d = await loggedInA(S, { xp: 40 });   // 有 40 XP 没上传
  const relSave = S.hold(/POST \/rest\/v1\/rpc\/(create|save)_progress/);
  const p1 = d.sync.logout(); await tick(); const p2 = d.sync.logout(); const p3 = d.sync.logout();
  check("1c 退出在等“先上传进度”时再点两次：合并成同一个调用", p1 === p2 && p2 === p3);
  relSave(); const [r1, r2] = await Promise.all([p1, p2]); await tick();
  check("1d 上传完成后只撤销一次云端会话，退出成功，云端进度 40 XP", r1.ok === true && r1 === r2 && outs(S) === 1 && S.xpOf(EMAIL_A) === 40 && consistent(d, null), JSON.stringify([r1, outs(S), S.xpOf(EMAIL_A)]));
}

// ===== 2. A 连续两次退出，第一次完成后再登录（A 或 B）：第二次的结果不能影响新会话 =====
for (const [who, email] of [["重新登录 A", EMAIL_A], ["登录 B", EMAIL_B]]) for (const revokeFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT, revokeFails ? 503 : null);
  const p1 = d.sync.logout(), p2 = d.sync.logout();
  await tick(); rel(); const r1 = await p1; await tick();
  if (revokeFails) { check(`2 ${who}（撤销失败）：第一次失败 → 回滚仍是登录 A；第二次是同一个结果，没有第二次撤销`, r1.ok === false && (await p2) === r1 && outs(S) === 1 && consistent(d, EMAIL_A), JSON.stringify(r1)); continue; }
  const v = await login(S, d, email);                       // 第一次退出完成后马上登录
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d));
  const r2 = await p2; await tick();                         // “第二次退出”才返回
  check(`2 ${who}：第二次退出（和第一次是同一次）返回时不撤销新会话、不清新凭证、不改状态；云端撤销仍只有 1 次`, v.ok === true && r2 === r1 && outs(S) === 1 && snap(d.storage) === mid && JSON.stringify(statusOf(d)) === midStatus && consistent(d, email), JSON.stringify([r2, outs(S)]));
  finishLesson(d, "u1-l1", 10); const sy = await d.sync.syncNow({ manual: true });
  check(`2 ${who}：新会话继续正常同步（云端 10 XP）`, sy.ok === true && S.xpOf(email) === 10, JSON.stringify(sy));
}

// ===== 3. 旧的普通退出被“强制本机退出”取代后迟到返回：撤销成功 / 失败 × 再登录 A / 登录 B =====
for (const [who, email] of [["再登录 A", EMAIL_A], ["登录 B", EMAIL_B]]) for (const revokeFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT, revokeFails ? 503 : null);
  const old = d.sync.logout(); await tick();                  // 旧普通退出：本机已清、在等云端撤销
  const f = await d.sync.forceLocalLogout();                  // 用户改点“只在这台设备退出”：取代旧退出
  const v = await login(S, d, email);
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d)), midOuts = outs(S);
  rel(); const r = await old; await tick();
  check(`3 旧退出被强制本机退出取代，${who}，旧撤销${revokeFails ? "失败（503）" : "成功（204）"}：旧结果标记 stale/superseded，界面不会再走一次“已退出”`, f.ok === true && v.ok === true && r.ok === false && r.stale === true && r.superseded === true && !r.stayed, JSON.stringify([f, r]));
  check(`3 同上：新会话的凭证 / 账号指针 / 本机副本逐字节不变，内存与存储账号一致（${email}），状态不变`, snap(d.storage) === mid && JSON.stringify(statusOf(d)) === midStatus && consistent(d, email), `账号=${d.sync.account()?.email}`);
  finishLesson(d, "u1-l1", 15); const sy = await d.sync.syncNow({ manual: true });
  check("3 同上：新会话马上可以同步（旧退出没有留下“正在退出”的拦截），云端 15 XP", sy.ok === true && S.xpOf(email) === 15, JSON.stringify(sy));
}

// ===== 4. 旧的联网强制退出被“强制本机退出”取代后迟到返回，再登录 =====
for (const revokeFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT, revokeFails ? 503 : null);
  const old = d.sync.logout({ force: true }); await tick();   // 联网强制退出：本机已清，等云端撤销
  const f = await d.sync.forceLocalLogout();                  // 又点“仅本机退出”：不联网、不等撤销，取代旧的
  const v = await login(S, d, EMAIL_B);
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d));
  rel(); const r = await old; await tick();
  check(`4 旧的联网强制退出被强制本机退出取代，登录 B 后旧撤销${revokeFails ? "失败" : "成功"}返回：stale，不收尾、不清 B 的凭证、不改状态`, f.ok === true && v.ok === true && r.stale === true && r.superseded === true && snap(d.storage) === mid && JSON.stringify(statusOf(d)) === midStatus && consistent(d, EMAIL_B), JSON.stringify([f, r]));
}

// ===== 5. 强制退出重复调用也合并；普通退出在强制退出进行中也合并过去 =====
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT);
  const p1 = d.sync.logout({ force: true }); await tick(); const p2 = d.sync.logout({ force: true }); const p3 = d.sync.logout();
  check("5a 强制退出在跑时，再次强制退出和普通退出都合并过去", p1 === p2 && p2 === p3 && outs(S) === 1);
  rel(); const r = await p1; await tick();
  check("5b 放行后只撤销一次，退出成功，内存与存储都没有账号", r.ok === true && outs(S) === 1 && consistent(d, null), JSON.stringify(r));
}

// ===== 7. 旧退出的撤销里需要“刷新令牌再撤销一次”（先回 bad_jwt）：被取代之后不能拿新会话的令牌去刷新，也不能把轮换出的旧令牌写进新会话 =====
const BADJWT = { code: 403, error_code: "bad_jwt", msg: "invalid JWT" };
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(LOGOUT, { status: 403, body: BADJWT });      // 旧退出的第一次撤销：挂起，放行时回 bad_jwt
  const old = d.sync.logout(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_A);     // 取代它，并重新登录 A（新会话）
  const mid = snap(d.storage), refreshes0 = S.count["POST /auth/v1/token"] || 0;
  rel(); const r = await old; await tick();
  check("7a 旧退出的撤销（bad_jwt）在被取代之后返回：不去刷新（刷新请求数不变）、不写凭证（逐字节不变）、结果 stale", r.stale === true && (S.count["POST /auth/v1/token"] || 0) === refreshes0 && snap(d.storage) === mid && consistent(d, EMAIL_A), JSON.stringify([r, S.count["POST /auth/v1/token"], refreshes0]));
}
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  S.fail(LOGOUT, 403, BADJWT, 1);                                  // 第一次撤销马上回 bad_jwt → 旧退出去刷新
  const relRf = S.hold(REFRESH);                                   // 刷新挂起：旧退出停在刷新上
  const old = d.sync.logout(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_A);
  const mid = snap(d.storage);
  relRf(); const r = await old; await tick();
  check("7b 取代发生在刷新期间：刷新迟到返回，旧退出不把轮换出的旧令牌写进新会话（凭证逐字节不变）、不再撤销第二次", r.stale === true && snap(d.storage) === mid && consistent(d, EMAIL_A), JSON.stringify(r));
}

// ===== 8. 退出在等“先上传进度”、9. 在等“先刷新令牌”：期间被强制退出取代并登录 B，等待结束后不得继续清 B =====
{
  const S = fakeCloud(); const d = await loggedInA(S, { xp: 40 });
  const relSave = S.hold(/POST \/rest\/v1\/rpc\/(create|save)_progress/);
  const old = d.sync.logout(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_B);
  const mid = snap(d.storage);
  relSave(); const r = await old; await tick();
  check("8 旧退出停在“先上传进度”，被取代并登录 B 后上传结果回来：旧退出结束，不清 B 的本机副本 / 凭证、不改状态", r.stale === true && r.superseded === true && snap(d.storage) === mid && consistent(d, EMAIL_B), JSON.stringify(r));
}
{
  const S = fakeCloud(); S.expiresIn = 30;                        // 令牌快过期：退出前要先刷新
  const d = device(S); await login(S, d, EMAIL_A);
  const relRf = S.hold(REFRESH);
  const old = d.sync.logout(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_B);
  const mid = snap(d.storage);
  relRf(); const r = await old; await tick();
  check("9 旧退出停在“先刷新令牌”，被取代并登录 B 后刷新回来：stale（不是“云端退出失败、仍保持登录”），B 的凭证 / 副本不变", r.stale === true && r.superseded === true && !r.stayed && snap(d.storage) === mid && consistent(d, EMAIL_B), JSON.stringify(r));
}

// ===== 9b. 旧退出停在“先刷新令牌”，被强制本机退出取代后【同号重新登录 A】，旧刷新迟到返回：新会话凭证逐字节不变（GPT1 15:00：默认代次检查已保护，补回归） =====
for (const oldKind of ["普通退出"]) { // 联网强制退出不先刷新令牌（直接撤销），没有这个等待点
  const S = fakeCloud(); S.expiresIn = 30;                        // 令牌快过期：退出前要先刷新
  const d = device(S); await login(S, d, EMAIL_A);
  const relRf = S.hold(REFRESH);
  const old = oldKind === "普通退出" ? d.sync.logout() : d.sync.logout({ force: true }); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_A);
  const mid = snap(d.storage), authMid = authRaw(d), refreshes0 = S.count["POST /auth/v1/token"] || 0;
  relRf(); const r = await old; await tick();
  check(`9b 旧${oldKind}的刷新挂起，被取代后同号重新登录，旧刷新迟到返回：新会话凭证 / 存储逐字节不变，结果 stale`, r.stale === true && authRaw(d) === authMid && snap(d.storage) === mid && consistent(d, EMAIL_A), JSON.stringify(r));
}

// ===== 10. 旧退出迟到返回时，新会话自己的退出正在等云端撤销：旧退出不能把“正在退出”的拦截清掉 =====
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const relOld = S.hold(LOGOUT), relNew = S.hold(LOGOUT);
  const old = d.sync.logout(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_A);
  const cur = d.sync.logout(); await tick();                      // 新会话的普通退出：本机已清，在等云端撤销（拦截新同步）
  relOld(); const r = await old; await tick();                    // 旧退出此时才返回
  const sy = await d.sync.syncNow({ manual: true });
  check("10 新会话的退出还在等撤销时旧退出返回：旧退出 stale，新退出的“正在退出”拦截仍在（此时发起的同步被拒绝，不会把刚清掉的本机副本写回）", r.stale === true && sy.stale === true, JSON.stringify([r, sy]));
  relNew(); const rc = await cur; await tick();
  check("10 新会话的退出放行后正常完成，没有账号 / 凭证", rc.ok === true && consistent(d, null), JSON.stringify(rc));
}

// ===== 11. 同一个账号重新登录之后，新会话的退出必须独立执行，不能被合并进还没返回的旧退出（GPT1 14:47 复审 P2） =====
for (const oldKind of ["普通退出", "联网强制退出"]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const relOld = S.hold(LOGOUT);
  const old = oldKind === "普通退出" ? d.sync.logout() : d.sync.logout({ force: true }); await tick();
  const v = await login(S, d, EMAIL_A);                            // 旧退出还挂着：直接用新验证码重新登录 A（会话代次已变）
  const o0 = outs(S);
  const n1 = d.sync.logout(), n2 = d.sync.logout();                // 新会话连点两次退出
  await tick();
  check(`11a 旧${oldKind}还没返回，A 重新登录后新会话退出：不是旧退出的同一个调用，自己发起新的云端撤销（只 1 次）；新会话内连点仍合并`, v.ok === true && n1 !== old && n1 === n2 && outs(S) === o0 + 1, JSON.stringify([v.ok, n1 === old, n1 === n2, outs(S), o0]));
  const rn = await n1; await tick();
  check(`11b 新会话的退出成功：真的退出了（没有账号 / 凭证）`, rn.ok === true && consistent(d, null), JSON.stringify(rn));
  relOld(); const ro = await old; await tick();
  check(`11c 旧${oldKind}的迟到结果作废（stale），没有再动任何东西；撤销请求共 ${o0 + 1} 次，状态仍是已退出`, ro.stale === true && consistent(d, null) && outs(S) === o0 + 1, JSON.stringify([ro, outs(S)]));
}
for (const revokeFails of [false, true]) {                         // 新会话的退出失败：回滚，仍是登录 A；旧退出迟到不影响
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const relOld = S.hold(LOGOUT);
  const old = d.sync.logout(); await tick();
  await login(S, d, EMAIL_A);
  if (revokeFails) S.fail(LOGOUT, 503, { msg: "x" }, 1);
  const rn = await d.sync.logout(); await tick();
  relOld(); const ro = await old; await tick();
  check(`11d 新会话的退出${revokeFails ? "失败 → 回滚，仍是登录 A" : "成功 → 已退出"}；旧退出迟到只返回 stale，不改结果`, ro.stale === true && (revokeFails ? rn.ok === false && rn.stayed === true && consistent(d, EMAIL_A) : rn.ok === true && consistent(d, null)), JSON.stringify([rn, ro]));
}

// ===== 12. 删除账号取代在途的退出（只有会话代次能识别：logoutOp 还是自己）：旧退出迟到不影响删除之后再登录的新会话 =====
for (const revokeFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const relOld = S.hold(LOGOUT, revokeFails ? 503 : null);
  const old = d.sync.logout(); await tick();                        // 本机已清、等云端撤销
  const del = await d.sync.deleteAccount();
  const v = await login(S, d, EMAIL_B);
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d));
  relOld(); const ro = await old; await tick();
  check(`12 删除账号取代在途的退出，登录 B 后旧撤销${revokeFails ? "失败" : "成功"}返回：stale，不回滚被删账号、不清 B 的凭证、不改状态`, del.ok === true && v.ok === true && ro.stale === true && snap(d.storage) === mid && JSON.stringify(statusOf(d)) === midStatus && consistent(d, EMAIL_B), JSON.stringify([del, ro]));
}

// ===== 6. 对照（原有行为不变）：单次普通退出成功 / 失败回滚；强制本机退出；退出后同一个设备重新登录正常 =====
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const r = await d.sync.logout(); await tick();
  check("6a 单次普通退出：成功，云端撤销 1 次，没有账号 / 凭证", r.ok === true && outs(S) === 1 && consistent(d, null));
  const v = await login(S, d, EMAIL_B); check("6b 退出后登录 B 正常", v.ok === true && consistent(d, EMAIL_B));
  S.fail(LOGOUT, 503, { msg: "x" });
  const r2 = await d.sync.logout(); await tick();
  check("6c 单次普通退出撤销失败：回滚，仍是登录 B，凭证在", r2.ok === false && r2.stayed === true && consistent(d, EMAIL_B), JSON.stringify(r2));
  const r3 = await d.sync.logout(); await tick();
  check("6d 失败之后可以再退出一次（不会被上一次的“进行中”卡住），这次成功", r3.ok === true && consistent(d, null), JSON.stringify(r3));
  const v2 = await login(S, d, EMAIL_A); const o0 = outs(S); const f = await d.sync.forceLocalLogout();
  check("6e 强制本机退出：不联网，成功，没有账号 / 凭证", v2.ok === true && f.ok === true && outs(S) === o0 && consistent(d, null), JSON.stringify([f, outs(S), o0]));
}
}

const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
