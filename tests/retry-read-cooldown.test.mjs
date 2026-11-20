// 登录「重试读取」遵守 429 等待（Node，不联网）：验证码通过后读云端记录被 429，已验证会话留着，但要等到服务器给的时间（Retry-After，
// 和普通同步共用同一套解析 / 最短 5 秒 / 保底 60 秒）之后才能再读；等待期间任何入口（直接调用 retryRead / 同一个码再 verify）都不发请求、
// 不消耗读取次数、不延长会话到期时间；到期后转“不能再重试”，不会自动重发验证码；关窗 / 改邮箱 / 重发 / 退出之后旧等待作废，不影响新登录。
// 起因（GPT1 2026-11-20 任务 3）：源码层面 retryRead() 不看 429 的等待时间，连点会在等待期间照样打到接口。
// 运行：node tests/retry-read-cooldown.test.mjs
import { createSync } from "../src/sync.js";
import { GUEST_KEY } from "../src/account-store.js";
import { createApi, parseRetryAfter } from "../src/cloud-api.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const within = (p, ms = 2000) => { let t; return Promise.race([p.then((v) => ({ settled: true, v })), new Promise((r) => { t = setTimeout(() => r({ settled: false }), ms); })]).finally(() => clearTimeout(t)); };
const J = (status, body, headers = {}) => ({ ok: status < 400, status, headers: { get: (k) => headers[String(k).toLowerCase()] ?? null }, text: async () => (body === undefined ? "" : JSON.stringify(body)) });
let CUR_MODE = "";
const TODAY = "2026-11-03";
// ---------- 假 Supabase ----------
function fakeCloud() {
  const S = { users: new Map(), rows: new Map(), tokens: new Map(), codes: new Set(), n: 0, offline: false, expiresIn: 3600, offlineAfterVerify: false, rules: [], gates: [], count: {}, saveCalls: 0, log: [] };
  const mkSession = (uid, email) => { const k = ++S.n; const at = `AT-${k}`, rt = `RT-${k}`; S.tokens.set(at, uid); S.tokens.set(rt, uid); return { access_token: at, refresh_token: rt, expires_in: S.expiresIn, user: { id: uid, email } }; };
  S.issue = (code = "123456") => S.codes.add(code); // 模拟“发了一封验证码邮件”
  S.fail = (re, status, body, times = 1, headers = {}) => S.rules.push({ re, status, body, times, headers });
  S.timeout = (re, times = 1) => S.rules.push({ re, stall: true, times }); // 请求一直不回（响应头都没有），被超时中止
  S.get = () => S.count["GET /rest/v1/progress"] || 0;
  S.hold = (re, failStatus = null) => { let release; const p = new Promise((r) => { release = r; }); S.gates.push({ re, p, failStatus }); return release; }; // 可以同时挂起多个不同的请求（按先后各挂一个） // failStatus：放行时这一个请求回这个失败状态（不影响期间别的请求）
  S.fetch = async (url, init) => {
    if (S.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), path = u.pathname, method = init.method || "GET", key = `${method} ${path}`, body = init.body ? JSON.parse(init.body) : null;
    S.count[key] = (S.count[key] || 0) + 1;
    const gi = S.gates.findIndex((x) => x.re.test(key));
    if (gi >= 0) { const g = S.gates.splice(gi, 1)[0]; await g.p; if (g.failStatus) { S.log.push(`${key} → ${g.failStatus}（挂起后放行）`); return J(g.failStatus.status ?? g.failStatus, { msg: "x" }, g.failStatus.headers || {}); } }
    const rule = S.rules.find((r) => r.times > 0 && r.re.test(key));
    if (rule && rule.stall) { rule.times--; S.log.push(`${key} → 超时`); return new Promise((_, rej) => init.signal?.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError")))); }
    if (rule) { rule.times--; S.log.push(`${key} → ${rule.status}`); return J(rule.status, rule.body, rule.headers); }
    const bearer = String(init.headers?.Authorization || "").replace(/^Bearer /, "");
    const uid = S.tokens.get(bearer);
    if (path === "/auth/v1/otp") return J(200, {});
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
const mkApi = (S, now) => createApi({ url: "https://fake.supabase.test", anonKey: "k", fetchFn: S.fetch, timeoutMs: 400, now, isOnline: () => !S.offline });
function device(S, storage = fakeStorage(), locks = null) {
  const dev = { storage, state: freshState(), timers: [], clock: Date.now(), notices: [] };
  dev.sync = createSync({ storage, api: mkApi(S, () => dev.clock), retryLocks: locks || (CUR_MODE === "有 Web Locks" ? fakeLocks() : {}), schedule: (fn, ms) => { dev.timers.push({ fn, ms }); return dev.timers.length; }, today: () => TODAY, now: () => dev.clock, onState: (doc) => { dev.state = docToState(doc, dev.state); }, onNotice: (k) => dev.notices.push(k) });
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



// ===== 场景工具 =====
const GETP = /GET \/rest\/v1\/progress/, VERIFYP = /POST \/auth\/v1\/verify/, OTPP = /POST \/auth\/v1\/otp/;
const LIM = { code: 429, error_code: "over_request_rate_limit", msg: "rate limited" };
const secs = (n) => n * 1000;
const T0 = Date.now() + 1e6;
const gets = (S) => S.count["GET /rest/v1/progress"] || 0, verifies = (S) => S.count["POST /auth/v1/verify"] || 0, otps = (S) => S.count["POST /auth/v1/otp"] || 0;
// 一台还没登录的设备：验证码对了，第一次读云端记录被 429（Retry-After = hdr）
async function limited(S, hdr, { email = EMAIL_A, times = 1, expiresIn = null, t0 = T0 } = {}) {
  if (expiresIn) S.expiresIn = expiresIn;
  const d = device(S); d.clock = t0;
  S.issue(); S.fail(GETP, 429, LIM, times, hdr === undefined ? {} : { "retry-after": String(hdr) });
  const first = await d.sync.verify(email, "123456", d.state);
  return { d, first };
}
const isWait = (r, ms) => r && r.ok === false && r.kind === "rate-limit" && r.stage === "read" && r.canRetry === true && r.waitMs === ms;

// ===== 1. 验证通过 → 读取 429 → 等待 → 恢复 =====
{
  const S = fakeCloud(); const { d, first } = await limited(S, 120);
  check("1a 首次读取 429（Retry-After 120）：验证码已用掉，仍可重试读取，带剩余等待 120 秒", isWait(first, secs(120)) && d.sync.hasVerified() && verifies(S) === 1 && gets(S) === 1, JSON.stringify(first));
  const timers0 = d.timers.length;
  d.clock = T0 + secs(10);
  const g0 = gets(S);
  const r1 = await d.sync.retryRead(d.state);
  check("1b 第 10 秒点「重试读取」：不发请求（GET 不变）、不调验证接口，报回剩余 110 秒", isWait(r1, secs(110)) && gets(S) === g0 && verifies(S) === 1, JSON.stringify(r1));
  let allBlocked = true;
  for (const t of [11, 30, 60, 100, 119]) { d.clock = T0 + secs(t); const r = await d.sync.retryRead(d.state); const rv = await d.sync.verify(EMAIL_A, "123456", d.state); if (!isWait(r, secs(120 - t)) || !isWait(rv, secs(120 - t))) allBlocked = false; }
  check("1c 等待期间多次直接调用 retryRead 和「同一个邮箱 + 同一个码」再 verify：全部挡住，GET 总数仍是 1，验证接口仍只调过 1 次", allBlocked && gets(S) === g0 && verifies(S) === 1);
  check("1d 等待期间会话仍有效，没有安排任何定时器（不自动重试 / 不自动重发验证码）；发信接口 0 次", d.sync.hasVerified() && d.timers.length === timers0 && otps(S) === 0);
  d.clock = T0 + secs(121);
  const r2 = await d.sync.retryRead(d.state);
  check("1e 第 121 秒（等待结束）重试读取：发出请求并完成登录，账号是 a@x.com，云端记录已读到", r2.ok === true && gets(S) > g0 && d.sync.account()?.email === EMAIL_A && !d.sync.hasVerified(), JSON.stringify(r2));
  d.clock = T0 + secs(125);
  const g1 = gets(S); await d.sync.syncNow({ manual: true });
  check("1f 登录后的普通同步不受这段等待影响（手动同步照常联网）", gets(S) > g1);
}

// ===== 2. 等待期间“消耗读取次数”：被挡住的点击不算次数，被 429 的那次读取算一次 =====
{
  const S = fakeCloud(); const { d, first } = await limited(S, 30);        // 读取 #1（被 429）
  for (let i = 0; i < 8; i++) { d.clock = T0 + secs(1 + i); await d.sync.retryRead(d.state); }  // 8 次被挡，不能算次数
  d.clock = T0 + secs(31);
  S.fail(GETP, 503, { msg: "x" }, 3);
  const a = await d.sync.retryRead(d.state);                                // #2
  const b = await d.sync.retryRead(d.state);                                // #3
  const c = await d.sync.retryRead(d.state);                                // #4（一共五次里的第四次，还能重试）
  check("2a 8 次被挡的点击没有消耗次数：之后第 2 / 3 / 4 次读取（503）都还允许继续重试", a.canRetry === true && b.canRetry === true && c.canRetry === true && gets(S) === 4, JSON.stringify([a.canRetry, b.canRetry, c.canRetry, gets(S)]));
  S.fail(GETP, 503, { msg: "x" }, 1);
  const e = await d.sync.retryRead(d.state);                                // #5：用完
  check("2b 第 5 次读取也失败：次数用完，不能再重试（canRetry:false + exhausted），GET 总数恰好 5", e.canRetry === false && e.exhausted === true && gets(S) === 5 && !d.sync.hasVerified(), JSON.stringify(e));
}
{
  // 连续被 429：每次都把等待往后推（取较大值），不会缩短；第 5 次读取仍被 429 → 次数用完
  const S = fakeCloud(); const { d } = await limited(S, 30);
  let t = 0, okAll = true;
  for (let i = 0; i < 3; i++) { t += 31; d.clock = T0 + secs(t); S.fail(GETP, 429, LIM, 1, { "retry-after": "30" }); const r = await d.sync.retryRead(d.state); if (!isWait(r, secs(30))) okAll = false; }
  check("2c 连续 429（每次 Retry-After 30）：每次读取后重新给出完整 30 秒等待，GET 共 4 次", okAll && gets(S) === 4);
  t += 31; d.clock = T0 + secs(t); S.fail(GETP, 429, LIM, 1, { "retry-after": "30" });
  const last = await d.sync.retryRead(d.state);
  check("2d 第 5 次读取仍被 429：次数用完 → 不能再重试，不再带等待（转“重新发送”）", last.canRetry === false && last.exhausted === true && !d.sync.hasVerified(), JSON.stringify(last));
}

// ===== 3. 等待时间的来源和普通同步一致：缺失 60 秒 / 最短 5 秒 / HTTP 日期 / 大值不截断 =====
for (const [label, hdr, ms] of [["缺失 → 保底 60 秒", undefined, secs(60)], ["乱码 → 保底 60 秒", "abc", secs(60)], ["Retry-After: 1 → 最短 5 秒", "1", secs(5)], ["Retry-After: 0 → 最短 5 秒", "0", secs(5)], ["Retry-After: 240", "240", secs(240)]]) {
  const S = fakeCloud(); const { d, first } = await limited(S, hdr);
  const g = gets(S);
  d.clock = T0 + 1000; const early = await d.sync.retryRead(d.state);
  check(`3 ${label}：首次返回 ${ms / 1000} 秒；1 秒后被挡住（不发请求）`, isWait(first, ms) && early.kind === "rate-limit" && early.waitMs === ms - 1000 && gets(S) === g, JSON.stringify([first.waitMs, early.waitMs]));
}
{
  // HTTP 日期（由假时钟决定“还剩多久”）：cloud-api 的 now 是 dev.clock
  const S = fakeCloud(); const d = device(S); d.clock = Date.UTC(2026, 10, 20, 3, 0, 0);
  S.issue(); S.fail(GETP, 429, LIM, 1, { "retry-after": new Date(d.clock + 90_000).toUTCString() });
  const first = await d.sync.verify(EMAIL_A, "123456", d.state);
  check("3 HTTP 日期（未来 90 秒）→ 等待 90 秒", isWait(first, secs(90)), JSON.stringify(first));
}

// ===== 4. 等待跨过会话到期 =====
{
  const S = fakeCloud(); const { d } = await limited(S, 1000);   // 等 1000 秒，但已验证会话只有 5 分钟
  d.clock = T0 + secs(299); const a = await d.sync.retryRead(d.state);
  check("4a 第 299 秒：会话还没到期，仍显示等待（剩 701 秒）", isWait(a, secs(701)) && d.sync.hasVerified());
  d.clock = T0 + secs(301); const g = gets(S), o = otps(S), v = verifies(S);
  const b = await d.sync.retryRead(d.state);
  check("4b 第 301 秒：会话到期 → 不能再重试（canRetry:false + expired），没有请求、没有自动重发验证码", b.ok === false && b.canRetry === false && b.expired === true && b.waitMs === undefined && gets(S) === g && otps(S) === o && verifies(S) === v && !d.sync.hasVerified(), JSON.stringify(b));
}
{
  // 重试又被 429：等待不能把到期时间往后推
  const S = fakeCloud(); const { d } = await limited(S, 200);
  d.clock = T0 + secs(201); S.fail(GETP, 429, LIM, 1, { "retry-after": "200" });
  const a = await d.sync.retryRead(d.state);
  check("4c 第 201 秒重试又被 429（再等 200 秒 → 到第 401 秒）：仍可重试但等待已越过到期点", isWait(a, secs(200)) && d.sync.hasVerified());
  d.clock = T0 + secs(299);  check("4d 第 299 秒仍在会话内（剩 1 秒）", d.sync.hasVerified());
  d.clock = T0 + secs(301); const b = await d.sync.retryRead(d.state);
  check("4e 第 301 秒：到期（等待没有把会话续命）→ expired", b.canRetry === false && b.expired === true && !d.sync.hasVerified(), JSON.stringify(b));
}
{
  // 登录会话本身快到期（expires_in 很短）：以更早的为准
  // 假接口的 expires_in 由 cloud-api 用真实时间换算成到期时刻，所以这一项把假时钟对到真实“现在”
  const R0 = Date.now();
  const S = fakeCloud(); const { d, first } = await limited(S, 300, { expiresIn: 120, t0: R0 });
  d.clock = R0 + secs(61); const b = await d.sync.retryRead(d.state);
  check("4f 会话 120 秒有效（到期前 60 秒起算作失效）：第 61 秒 → expired，不联网", isWait(first, secs(300)) && b.expired === true && b.canRetry === false && gets(S) === 1, JSON.stringify([first, b]));
}

// ===== 5. 等待期间的其它操作：关窗 / 改验证码 / 换邮箱 / 重发 / 退出 =====
{
  const S = fakeCloud(); const { d } = await limited(S, 120);
  d.clock = T0 + secs(5); d.sync.clearVerified();
  const g = gets(S); const r = await d.sync.retryRead(d.state);
  check("5a 关窗 / 改验证码（clearVerified）：会话作废，retryRead 报“已失效”，不发请求", r.canRetry === false && r.expired === true && gets(S) === g && !d.sync.hasVerified());
  S.issue(); d.clock = T0 + secs(6);
  const v2 = await d.sync.verify(EMAIL_A, "123456", d.state);
  check("5b 之后马上用新验证码再登录（同一个邮箱）：不受旧等待影响，立刻读取并成功", v2.ok === true && gets(S) > g, JSON.stringify(v2));
}
{
  const S = fakeCloud(); const { d } = await limited(S, 120);
  d.clock = T0 + secs(5); S.issue("654321");
  const g = gets(S);
  const r = await d.sync.verify(EMAIL_B, "654321", d.state);
  check("5c 等待期间换邮箱（b@x.com + 新码）：新一轮立刻读取并登录成功，旧等待不套到新邮箱上", r.ok === true && gets(S) > g && d.sync.account()?.email === EMAIL_B, JSON.stringify(r));
}
{
  const S = fakeCloud(); const { d } = await limited(S, 120);
  d.clock = T0 + secs(5); const o = otps(S);
  const sc = await d.sync.sendCode(EMAIL_A);
  const g = gets(S); const r = await d.sync.retryRead(d.state);
  check("5d 等待期间重新发送验证码：发信接口真的调用一次（读取的 429 不算发信冷却）；旧会话作废，retryRead 报“已失效”且不联网", sc.ok === true && otps(S) === o + 1 && r.expired === true && r.canRetry === false && gets(S) === g, JSON.stringify([sc, r]));
  S.issue(); d.clock = T0 + secs(6); const gg = gets(S);
  const v2 = await d.sync.verify(EMAIL_A, "123456", d.state);
  check("5e 重发后输入新码登录：立刻读取并成功", v2.ok === true && gets(S) > gg);
}
{
  const S = fakeCloud(); const { d } = await limited(S, 120);
  d.clock = T0 + secs(5);
  const lo = await d.sync.logout();
  const g = gets(S); const r = await d.sync.retryRead(d.state);
  check("5f 等待期间退出（logout）：已验证会话作废，retryRead 报“已失效”，不联网", lo.ok === true && r.expired === true && gets(S) === g && !d.sync.hasVerified(), JSON.stringify([lo, r]));
  S.issue(); d.clock = T0 + secs(6);
  const v2 = await d.sync.verify(EMAIL_B, "123456", d.state);
  const g2 = gets(S); d.clock = T0 + secs(7); await d.sync.syncNow({ manual: true });
  check("5g 退出后登录 b@x.com：立刻成功，新会话的普通同步不带旧等待（手动同步照常联网）", v2.ok === true && d.sync.account()?.email === EMAIL_B && gets(S) > g, JSON.stringify(v2));
}

// ===== 6. 在途的重试读取被作废：迟到的 429 不能给新会话留下等待，也不能把旧会话“复活” =====
for (const how of ["关窗 / 改码", "换邮箱再登录", "退出"]) {
  const S = fakeCloud(); const { d } = await limited(S, 30);
  d.clock = T0 + secs(31);
  const release = S.hold(GETP, { status: 429, headers: { "retry-after": "500" } }); // 旧会话的这次重读：挂起，稍后以 429（Retry-After 500）回来
  const inflight = d.sync.retryRead(d.state); await tick();
  S.issue("654321");
  let mid = null;
  if (how === "关窗 / 改码") d.sync.clearVerified();
  else if (how === "退出") await d.sync.logout();
  else { mid = await d.sync.verify(EMAIL_B, "654321", d.state); }
  release(); const late = await inflight;
  const gate = await d.sync.retryRead(d.state);
  const resultOk = late.discarded === true || late.expired === true || late.canRetry === false;
  check(`6 ${how}：在途的旧读取（迟到的 429）被丢弃，不留下可重试的旧会话`, resultOk && !(late.waitMs > 0) && !d.sync.hasVerified() || (how === "换邮箱再登录" && !d.sync.hasVerified()), JSON.stringify({ late, gate: gate.expired }));
  // 新一轮登录 / 同步不受旧的 500 秒等待影响
  if (how !== "换邮箱再登录") { S.issue(); d.clock = T0 + secs(32); const v = await d.sync.verify(EMAIL_B, "123456", d.state); check(`6 ${how}：之后新登录立刻成功（旧的 500 秒等待没有带过来）`, v.ok === true, JSON.stringify(v)); }
  else check(`6 换邮箱再登录：b@x.com 在旧读取挂起时已经登录成功（mid.ok），迟到的旧 429 没有改写新账号`, mid.ok === true && d.sync.account()?.email === EMAIL_B);
  d.clock = T0 + secs(40); const g = gets(S); await d.sync.syncNow({ manual: true });
  check(`6 ${how}：新会话的手动同步照常联网（没有被旧等待拦下）`, gets(S) > g);
}

const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
