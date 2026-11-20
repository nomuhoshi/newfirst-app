// 登录 / 同步故障矩阵（Node，不联网）：Gemini 2026-11-19 的 L1–L6 中能自动化的部分，加上“验证码已用掉后读云端失败”（GPT1 / 程序员 2026-11-19 的缺陷 1）。
// 假 Supabase 在 fetch 层：验证码一次性（按 GoTrue 的常见行为建模，未对真实服务验证）、按账号隔离的进度行、令牌表、可注入的故障（离线 / 503 / 401 / 挂起）。
// 运行：node tests/login-fault-matrix.test.mjs
import { createSync } from "../src/sync.js";
import { GUEST_KEY } from "../src/account-store.js";
import { createApi } from "../src/cloud-api.js";
import { describeVerifyError } from "../src/auth-errors.js";
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
  S.hold = (re) => { let release; const p = new Promise((r) => { release = r; }); S.gate = { re, p }; return release; };
  S.fetch = async (url, init) => {
    if (S.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), path = u.pathname, method = init.method || "GET", key = `${method} ${path}`, body = init.body ? JSON.parse(init.body) : null;
    S.count[key] = (S.count[key] || 0) + 1;
    if (S.gate && S.gate.re.test(key)) { const g = S.gate; S.gate = null; await g.p; }
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

// ===== 缺陷 1（GPT1 方案）：验证码这一步成功（验证码已被用掉），随后读云端记录失败 → 保留已验证会话，「重试读取」不再调用验证接口 =====
const EMAIL = "t@x.com", VERIFY = "POST /auth/v1/verify";
const FAULTS = [
  ["503", (S) => S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "upstream unavailable" })],
  ["403 bad_jwt", (S) => S.fail(/GET \/rest\/v1\/progress/, 403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" })],
  ["429", (S) => S.fail(/GET \/rest\/v1\/progress/, 429, { msg: "rate limit" })],
  ["超时", (S) => S.timeout(/GET \/rest\/v1\/progress/)],
  ["断网", (S) => { S.offlineAfterVerify = true; }],
];
for (const [label, inject] of FAULTS) {
  const S = fakeCloud(), d = device(S);
  seedGuest(d, 50); // 游客先学了一关（50 XP）
  const before = snap(d.storage);
  S.issue(); inject(S);
  const r1 = await d.sync.verify(EMAIL, "123456", d.state);
  const x1 = describeVerifyError(r1, { xp: 50 });
  check(`读云端失败（${label}）：登录没完成，结果带 stage:"read" + canRetry:true，界面是 V5（429 是 V5w：要等倒计时再点「重试读取」；都不叫人再输码）`, r1.ok === false && r1.stage === "read" && r1.canRetry === true && x1.id === (label === "429" ? "V5w" : "V5") && /「重试读取」/.test(x1.text) && !/验证码错误/.test(x1.text), JSON.stringify({ stage: r1.stage, canRetry: r1.canRetry, id: x1.id }));
  check(`读云端失败（${label}）：没有切账号、没写登录凭证 / 账号副本，游客进度逐字节不变`, d.sync.account() === null && !d.storage._m.has("suipian.auth") && acctKeys(d.storage).length === 0 && snap(d.storage) === before);
  check(`读云端失败（${label}）：已验证会话留在内存里（hasVerified），验证接口只调了 1 次`, d.sync.hasVerified() === true && S.count[VERIFY] === 1);
  S.rules.length = 0; S.offline = false; // 故障恢复
  if (label === "429") d.clock += 61_000; // 429：没有 Retry-After 时保底等 60 秒，等完才能重试读取（等待期间的行为见 retry-read-cooldown.test.mjs）
  const r2 = await d.sync.retryRead(d.state);
  check(`重试读取（${label}→恢复）：不再调验证接口（仍是 1 次），拿到游客进度的选择步骤（游客 50 XP），还没动账号`, r2.ok === true && r2.needChoice === true && r2.guest.xp === 50 && S.count[VERIFY] === 1 && d.sync.account() === null, JSON.stringify({ ok: r2.ok, needChoice: r2.needChoice, verify: S.count[VERIFY] }));
  const r3 = await d.sync.finishChoice("transfer");
  check(`选择「安全合并」后登录完成：云端 50 XP、本机 50 XP，验证接口始终 1 次，已验证会话已清掉`, r3.ok === true && d.sync.account()?.email === EMAIL && S.xpOf(EMAIL) === 50 && sumXp(S.rows.get(S.users.get(EMAIL)).doc) === 50 && S.count[VERIFY] === 1 && d.sync.hasVerified() === false, `云端=${S.xpOf(EMAIL)}`);
}
{ // 无游客进度：重试读取成功 = 直接登录完成
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  const r1 = await d.sync.verify(EMAIL, "123456", d.state);
  const r2 = await d.sync.retryRead(d.state);
  check("GPT1 反例：验证码只能成功验证一次；读取先 503、再成功 → 最终登录成功，验证接口只调 1 次", r1.ok === false && r2.ok === true && d.sync.account()?.email === EMAIL && S.count[VERIFY] === 1 && S.count["POST /rest/v1/rpc/create_progress"] === 1, JSON.stringify({ verify: S.count[VERIFY], create: S.count["POST /rest/v1/rpc/create_progress"] }));
  const g1 = S.get();
  check("登录完成后凭证已落盘、已验证会话已清掉；再调 retryRead 是“已失效”，不发请求", d.storage._m.has("suipian.auth") && d.sync.hasVerified() === false && (await d.sync.retryRead(d.state)).canRetry === false && S.get() === g1);
}
{ // 同邮箱同码从 verify() 再进来：也不再调用验证接口（只重读）
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  const r = await d.sync.verify("  T@x.com ", " 123456 ", d.state);
  check("同一个邮箱（大小写 / 空格不同）+ 同一个码再调 verify：只重读云端、不调验证接口，登录成功", r.ok === true && S.count[VERIFY] === 1 && d.sync.account()?.email === EMAIL, JSON.stringify({ ok: r.ok, verify: S.count[VERIFY] }));
}
{ // 超时 / 403 / 断网：重试读取仍失败时不误报验证码错误，也不误报登录成功
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  S.timeout(/GET \/rest\/v1\/progress/);
  const r = await within(d.sync.retryRead(d.state), 3000);
  const x = r.settled ? describeVerifyError(r.v, { xp: 0 }) : null;
  check("重试读取又超时：按时返回；仍是 V5（可再试），不是验证码错、不是登录成功，仍没有登录态", r.settled && r.v.ok === false && r.v.canRetry === true && x.id === "V5" && d.sync.account() === null && !d.storage._m.has("suipian.auth"));
  const r2 = await d.sync.retryRead(d.state);
  check("再重试：成功，验证接口仍只调 1 次", r2.ok === true && S.count[VERIFY] === 1 && d.sync.account()?.email === EMAIL);
}

// ----- 重试次数 / 时限（Gemini：403 最多重试 1 次；到期不能死循环）-----
{
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" }, 5);
  const r1 = await d.sync.verify(EMAIL, "123456", d.state);
  const r2 = await d.sync.retryRead(d.state);
  const x2 = describeVerifyError(r2, { xp: 0 });
  check("403：首读 + 1 次重试后不再允许重试（canRetry:false，V6 要求重新发送），共读 2 次", r1.canRetry === true && r2.ok === false && r2.canRetry === false && r2.exhausted === true && x2.id === "V6" && S.get() === 2 && d.sync.hasVerified() === false, JSON.stringify({ canRetry: r2.canRetry, id: x2.id, get: S.get() }));
  const r3 = await d.sync.retryRead(d.state);
  check("用完之后再点：不再发任何请求（GET 仍是 2、验证仍是 1）", r3.ok === false && r3.canRetry === false && S.get() === 2 && S.count[VERIFY] === 1);
}
{
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" }, 99);
  let last = await d.sync.verify(EMAIL, "123456", d.state), n = 1;
  while (last.canRetry === true && n < 20) { last = await d.sync.retryRead(d.state); n++; }
  check("503 一直不好：最多读 5 次，之后 canRetry:false（V6），不会无限重试", last.canRetry === false && n === 5 && S.get() === 5 && describeVerifyError(last).id === "V6", `读了 ${S.get()} 次`);
}
{ // 到期：5 分钟
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  d.clock += 4 * 60_000;
  check("4 分钟时仍有效", d.sync.hasVerified() === true);
  d.clock += 61_000; // 共 5 分 01 秒
  const g = S.get();
  const r = await d.sync.retryRead(d.state);
  check("超过 5 分钟：已验证会话到期作废，不再发请求；界面是 V6（换新码）；没有登录", r.ok === false && r.expired === true && r.canRetry === false && S.get() === g && describeVerifyError(r).id === "V6" && d.sync.account() === null && d.sync.hasVerified() === false);
}
{ // 不超过会话本身的有效期：令牌只剩 100 秒 → 最多留 40 秒
  const S = fakeCloud(), d = device(S); S.expiresIn = 100; S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  check("令牌只剩 100 秒：30 秒时仍有效", (d.clock += 30_000, d.sync.hasVerified()) === true);
  check("令牌只剩 100 秒：45 秒时已作废（不拿快过期的令牌去读）", (d.clock += 15_000, d.sync.hasVerified()) === false);
}

{ // 重试读取在途时跨过了时限：这次读失败后不再允许重试
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  const release = S.hold(/GET \/rest\/v1\/progress/); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  const p = d.sync.retryRead(d.state); await sleep(30);
  d.clock += 6 * 60_000; // 读取在途时过了 6 分钟
  release(); const r = await within(p, 3000);
  check("重试读取在途时过了 5 分钟、结果又失败：canRetry:false（expired），已验证会话作废，V6", r.settled && r.v.ok === false && r.v.canRetry === false && r.v.expired === true && d.sync.hasVerified() === false && describeVerifyError(r.v).id === "V6");
}
{ // 重试时发现云端记录格式不对（重读也不会好）：作废已验证会话，不再给「重试读取」
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  S.rows.set(S.users.get(EMAIL), { doc: { broken: true }, rev: 1 });
  const r = await d.sync.retryRead(d.state);
  check("重试读取读到格式不对的云端记录（data 类）：失败、不再允许重试、没有登录态", r.ok === false && r.kind === "data" && d.sync.hasVerified() === false && d.sync.account() === null && !d.storage._m.has("suipian.auth"), JSON.stringify({ kind: r.kind }));
}

// ----- GPT1 19:44 复审 1：读取在途中到期，成功响应也不能再完成登录 -----
for (const [label, expiresIn, startAt, advance] of [["5 分钟时限", 3600, 299_000, 2_000], ["短会话（令牌只剩 100 秒，最多留 40 秒）", 100, 30_000, 15_000]]) {
  const S = fakeCloud(), d = device(S); S.expiresIn = expiresIn;
  seedGuest(d, 50);
  S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  d.clock += startAt;
  check(`到期前仍有效（${label}）`, d.sync.hasVerified() === true);
  const before = snap(d.storage);
  const release = S.hold(/GET \/rest\/v1\/progress/);
  const p = d.sync.retryRead(d.state); await sleep(30);
  d.clock += advance; // 读取在途时越过截止时间
  release(); const r = await within(p, 3000);
  check(`读取在途时到期（${label}），随后成功响应：不登录、不进游客选择，返回 stage:read + expired + canRetry:false（V6）`, r.settled && r.v.ok === false && r.v.stage === "read" && r.v.expired === true && r.v.canRetry === false && !r.v.needChoice && describeVerifyError(r.v).id === "V6", JSON.stringify(r.settled ? { ok: r.v.ok, expired: r.v.expired, needChoice: r.v.needChoice } : "挂着"));
  check(`读取在途时到期（${label}）：没有账号、没有 suipian.auth、存储逐字节不变（游客进度还在）、已验证会话已清、验证接口仍 1 次`, d.sync.account() === null && !d.storage._m.has("suipian.auth") && snap(d.storage) === before && d.sync.hasVerified() === false && S.count[VERIFY] === 1 && S.xpOf(EMAIL) === null);
  const g = S.get(); const r2 = await d.sync.retryRead(d.state);
  check(`到期后再点重试读取（${label}）：不发请求、仍是 V6`, r2.canRetry === false && S.get() === g && describeVerifyError(r2).id === "V6");
}

{ // 令牌本身只剩 30 秒（不足 60 秒余量）：首读失败后一开始就不留可重试会话
  const S = fakeCloud(), d = device(S); S.expiresIn = 30; S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  const r = await d.sync.verify(EMAIL, "123456", d.state);
  check("令牌只剩 30 秒：首读失败后不留已验证会话（canRetry:false + expired，V6），不拿快过期的令牌重试", r.ok === false && r.canRetry === false && r.expired === true && d.sync.hasVerified() === false && describeVerifyError(r).id === "V6");
}

// ----- GPT1 19:44 复审 2：退出必须作废待读取会话（含没有登录账号时），在途的旧读取返回后丢弃 -----
for (const [entry, doLogout] of [["logout({force:true})", (d) => d.sync.logout({ force: true })], ["forceLocalLogout()", (d) => d.sync.forceLocalLogout()], ["logout()", (d) => d.sync.logout()]]) {
  for (const [label, lateRule] of [["迟到 200", null], ["迟到 500", [500, { msg: "late boom" }]]]) {
    const S = fakeCloud(), d = device(S); seedGuest(d, 50);
    S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
    await d.sync.verify(EMAIL, "123456", d.state);
    const release = S.hold(/GET \/rest\/v1\/progress/);
    if (lateRule) S.fail(/GET \/rest\/v1\/progress/, ...lateRule);
    const p = d.sync.retryRead(d.state); await sleep(30);
    const lo = await within(doLogout(d), 3000);
    const afterLogout = snap(d.storage);
    release(); const r = await within(p, 3000); await sleep(30);
    check(`重试读取在途时 ${entry}（${label}）：退出返回成功；旧读取的结果被丢弃，不恢复账号、不写凭证，游客进度逐字节不变`, lo.settled && lo.v.ok === true && r.settled && r.v.discarded === true && d.sync.account() === null && !d.storage._m.has("suipian.auth") && snap(d.storage) === afterLogout && d.sync.hasVerified() === false && S.xpOf(EMAIL) === null, JSON.stringify({ logout: lo.settled && lo.v.ok, late: r.settled && r.v.discarded }));
  }
  { // 退出之后再点重试读取：已失效，不发请求
    const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
    await d.sync.verify(EMAIL, "123456", d.state);
    await doLogout(d);
    const g = S.get(), r = await d.sync.retryRead(d.state);
    check(`${entry} 之后再点重试读取：已失效（canRetry:false），不发读取请求、不登录`, r.ok === false && r.canRetry === false && S.get() === g && d.sync.account() === null && S.count[VERIFY] === 1);
  }
  { // 验证后的首次读取在途时退出
    const S = fakeCloud(), d = device(S); S.issue();
    const release = S.hold(/GET \/rest\/v1\/progress/);
    const p = d.sync.verify(EMAIL, "123456", d.state); await sleep(30);
    await doLogout(d); const afterLogout = snap(d.storage);
    release(); const r = await within(p, 3000);
    check(`验证后首次读取在途时 ${entry}：迟到的成功结果被丢弃，不登录、不写凭证`, r.settled && r.v.discarded === true && d.sync.account() === null && !d.storage._m.has("suipian.auth") && snap(d.storage) === afterLogout && d.sync.hasVerified() === false);
  }
}

// ----- 作废边界（Gemini 用例 3 / GPT1：换邮箱、重发、关窗）-----
for (const [label, act] of [
  ["换邮箱（界面调 clearVerified）", async (d) => { d.sync.clearVerified(); }],
  ["关闭弹窗再打开（clearVerified）", async (d) => { d.sync.clearVerified(); }],
  ["点「重新发送」（sendCode）", async (d, S) => { await d.sync.sendCode(EMAIL); }],
  ["换成别的邮箱 + 新码重新验证", async (d, S) => { S.issue("222222"); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" }); await d.sync.verify("other@x.com", "222222", d.state); }],
]) {
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  const r1 = await d.sync.verify(EMAIL, "123456", d.state);
  await act(d, S);
  const g = S.get(), v = S.count[VERIFY];
  const hadOther = label.startsWith("换成别的邮箱");
  if (hadOther) {
    // 新流程自己有一份已验证会话（other@，读取也被 503 了一次）；旧的 t@ 会话必须没了：重试读取只会登录 other@，不会碰 t@
    const r = await d.sync.retryRead(d.state);
    check(`作废：${label} → 重试读取登录的是新邮箱 other@，旧邮箱 ${EMAIL} 的会话没被复用（没有它的账号 / 云端行）`, r1.canRetry === true && r.ok === true && d.sync.account()?.email === "other@x.com" && S.xpOf(EMAIL) === null && S.count[VERIFY] === v, JSON.stringify({ ok: r.ok, acct: d.sync.account()?.email }));
    continue;
  }
  const r = await d.sync.retryRead(d.state);
  check(`作废：${label} → 旧的已验证会话不能再用（retryRead 不发读取请求、不登录 ${EMAIL}）`, r1.canRetry === true && S.get() === g && S.count[VERIFY] === v && r.ok === false && r.canRetry === false && d.sync.account() === null, JSON.stringify({ ok: r.ok, canRetry: r.canRetry }));
  check(`作废：${label} → hasVerified 为 false，同邮箱同码再调 verify 会重新走验证（码已用掉 → V1）而不是复用旧会话`, d.sync.hasVerified() === false && describeVerifyError(await d.sync.verify(EMAIL, "123456", d.state)).id === "V1" && S.count[VERIFY] === v + 1);
}

// ----- 迟到响应不串进新流程（Gemini 用例 4）-----
for (const [label, lateRule] of [["迟到 200", null], ["迟到 500", [500, { msg: "late boom" }]]]) {
  { // 重试读取在途时关窗
    const S = fakeCloud(), d = device(S); S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
    await d.sync.verify(EMAIL, "123456", d.state);
    const before = snap(d.storage);
    const release = S.hold(/GET \/rest\/v1\/progress/);
    if (lateRule) S.fail(/GET \/rest\/v1\/progress/, ...lateRule);
    const p = d.sync.retryRead(d.state); await sleep(30);
    d.sync.clearVerified(); // 关窗
    release(); const r = await within(p, 3000);
    check(`重试读取在途时关窗（${label}）：迟到的结果被丢弃（discarded），不切账号、不写任何存储`, r.settled && r.v.discarded === true && r.v.ok === false && d.sync.account() === null && snap(d.storage) === before, JSON.stringify(r.settled ? { discarded: r.v.discarded } : "挂着"));
  }
  { // 首次验证后的读取在途时关窗 / 换邮箱
    const S = fakeCloud(), d = device(S); S.issue();
    const before = snap(d.storage);
    const release = S.hold(/GET \/rest\/v1\/progress/);
    if (lateRule) S.fail(/GET \/rest\/v1\/progress/, ...lateRule);
    const p = d.sync.verify(EMAIL, "123456", d.state); await sleep(30);
    d.sync.clearVerified();
    release(); const r = await within(p, 3000);
    check(`验证后读取在途时关窗（${label}）：迟到的结果被丢弃，不登录、没有半个登录态，也没有留下待读取会话`, r.settled && r.v.discarded === true && d.sync.account() === null && snap(d.storage) === before && d.sync.hasVerified() === false);
  }
  { // 验证请求在途时重发 / 关窗
    const S = fakeCloud(), d = device(S); S.issue();
    const before = snap(d.storage);
    const release = S.hold(/POST \/auth\/v1\/verify/);
    if (lateRule) S.fail(/POST \/auth\/v1\/verify/, ...lateRule);
    const p = d.sync.verify(EMAIL, "123456", d.state); await sleep(30);
    d.sync.clearVerified();
    release(); const r = await within(p, 3000);
    check(`验证请求在途时关窗（${label}）：迟到的结果被丢弃，不登录、不弹误导性错误（discarded 结果界面不显示）`, r.settled && r.v.discarded === true && d.sync.account() === null && snap(d.storage) === before);
  }
}
{ // 旧流程的迟到响应不能影响新流程
  const S = fakeCloud(), d = device(S); S.issue("111111"); S.issue("222222");
  const release = S.hold(/GET \/rest\/v1\/progress/);
  const p1 = d.sync.verify("old@x.com", "111111", d.state); await sleep(30);
  d.sync.clearVerified(); // 换了邮箱
  const r2 = await d.sync.verify("new@x.com", "222222", d.state); // 新流程完整走完
  const acct = d.sync.account(), authBefore = d.storage.getItem("suipian.auth");
  release(); const r1 = await within(p1, 3000);
  check("旧流程（old@）读云端迟到、新流程（new@）已登录：迟到的旧结果被丢弃，当前账号仍是 new@、凭证没被改写", r2.ok === true && acct?.email === "new@x.com" && r1.settled && r1.v.discarded === true && d.sync.account()?.email === "new@x.com" && d.storage.getItem("suipian.auth") === authBefore && S.xpOf("old@x.com") === null);
}

// ----- 连点重试、游客合并、重新进入流程不重复计分 -----
{
  const S = fakeCloud(), d = device(S);
  seedGuest(d, 50);
  S.issue(); S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "x" });
  await d.sync.verify(EMAIL, "123456", d.state);
  const [a, b, c] = await Promise.all([d.sync.retryRead(d.state), d.sync.retryRead(d.state), d.sync.retryRead(d.state)]);
  check("连点 3 次「重试读取」：共用同一次读取（只多读 1 次），结果一致", a.ok && b.ok && c.ok && S.get() === 2 && a.needChoice && b.needChoice && c.needChoice && S.count[VERIFY] === 1, `GET=${S.get()}`);
  const f = await d.sync.finishChoice("transfer");
  await d.sync.syncNow({ manual: true }); await d.sync.syncNow({ manual: true });
  check("游客合并只算一次：云端 50 XP、本机 50 XP（反复同步也不加分）", f.ok === true && S.xpOf(EMAIL) === 50 && d.state.xp === 50, `云端=${S.xpOf(EMAIL)} 本机=${d.state.xp}`);
  await d.sync.logout(); d.state = freshState();
  S.issue("999999"); const re = await d.sync.verify(EMAIL, "999999", d.state); await d.sync.syncNow({ manual: true });
  check("退出后重新进入登录流程（新码）：云端仍是 50 XP，不重复计分", re.ok === true && S.xpOf(EMAIL) === 50 && S.count[VERIFY] === 2, `云端=${S.xpOf(EMAIL)}`);
}

{ // 读云端限流 / 断网 / 超时的旧断言已并入上面的 FAULTS 循环。对照：验证码这一步本身失败，不带 stage:"read"，验证码没被用掉的情况保持原提示
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/POST \/auth\/v1\/verify/, 500, { msg: "boom" });
  const r = await d.sync.verify(EMAIL, "123456", d.state); const x = describeVerifyError(r);
  check("对照：验证码这一步本身 500（码没用掉）→ V4，仍可再点「登录」，不留已验证会话", r.stage === "verify" && x.id === "V4" && /再点「登录」/.test(x.text) && d.sync.hasVerified() === false, JSON.stringify({ stage: r.stage, id: x.id }));
  const r2 = await d.sync.verify(EMAIL, "123456", d.state);
  check("对照：随后同一个码再点「登录」成功", r2.ok === true);
}
{ // 云端数据本身有问题（重读也不会好）：不留待读取会话
  const S = fakeCloud(), d = device(S); S.issue();
  S.rows.set((S.users.set(EMAIL, newId()), S.users.get(EMAIL)), { doc: { broken: true }, rev: 1 });
  const r = await d.sync.verify(EMAIL, "123456", d.state);
  check("云端记录格式不对（data 类）：登录失败，不留可重试会话（重读也不会好）", r.ok === false && r.kind === "data" && d.sync.hasVerified() === false && d.sync.account() === null, JSON.stringify({ kind: r.kind }));
}

// ===== L1 错码 / 过期码后重试恢复 =====
{
  const S = fakeCloud(), d = device(S); S.issue();
  const before = snap(d.storage);
  const bad = await d.sync.verify("t@x.com", "000000", d.state); const x = describeVerifyError(bad, { xp: 0 });
  check("L1 错码：V1 文案，不含服务器原文，没登录", bad.ok === false && x.id === "V1" && !/Token has expired|otp_expired/.test(x.text + x.diag) && d.sync.account() === null);
  check("L1 错码：本机存储逐字节不变（游客进度 / 设备编号等都没动）", snap(d.storage) === before);
  const ok = await d.sync.verify("t@x.com", "123456", d.state);
  check("L1 重输正确的码：可以正常登录（失败没有把登录流程锁住）", ok.ok === true && d.sync.account()?.email === "t@x.com");
}

// ===== L2 连续切换不同账号隔离 =====
{
  const S = fakeCloud(), d = device(S);
  await login(S, d, "a@x.com"); finishLesson(d, "u1-l1", 20); await d.sync.syncNow({ manual: true });
  const uidA = S.users.get("a@x.com");
  const lo = await d.sync.logout(); d.state = freshState();
  check("L2 A 登出：成功，界面回到未登录；A 的账号副本和登录凭证已从本机清掉", lo.ok === true && d.sync.account() === null && !acctKeys(d.storage).some((k) => k.endsWith(uidA)) && !d.storage._m.has("suipian.auth"), JSON.stringify(lo));
  const vb = await login(S, d, "b@x.com");
  check("L2 不刷新直接登录 B：只加载 B 自己的进度（0 XP、没有 A 的完成记录）", vb.ok === true && d.sync.account()?.email === "b@x.com" && d.state.xp === 0 && !d.state.done["u1-l1"], `xp=${d.state.xp}`);
  finishLesson(d, "u1-l2", 10); await d.sync.syncNow({ manual: true });
  check("L2 B 学一关并同步：云端 A 仍是 20 XP、B 是 10 XP，互不影响", S.xpOf("a@x.com") === 20 && S.xpOf("b@x.com") === 10, `A=${S.xpOf("a@x.com")} B=${S.xpOf("b@x.com")}`);
}

// ===== L3 同步在途时登出 =====
// 设计：本机有没上传的进度时，“强制本机退出”会保留账号副本（用同一个账号重新登录会接着上传），所以副本还在是对的；
// 要验证的是：迟到的同步结果不能改写它、不能再写云端、不能把登录凭证 / 账号写回来，重新登录后补传一次且不重复。
for (const [label, lateRule] of [["迟到回执 200", null], ["迟到回执 500", [500, { msg: "late boom" }]]]) {
  const S = fakeCloud(), d = device(S);
  await login(S, d, "a@x.com"); finishLesson(d, "u1-l1", 20);
  const release = S.hold(/GET \/rest\/v1\/progress/);
  if (lateRule) S.fail(/GET \/rest\/v1\/progress/, ...lateRule);
  const p = d.sync.syncNow({ manual: true });
  await sleep(30);
  const lo = await within(d.sync.logout({ force: true }), 3000); // 同步卡在读云端时点“退出”（强制本机退出，不被待上传挡住）
  const copyKey = acctKeys(d.storage)[0], copyAfterLogout = copyKey ? d.storage.getItem(copyKey) : null;
  const writes0 = (S.count["POST /rest/v1/rpc/save_progress"] || 0) + (S.count["POST /rest/v1/rpc/create_progress"] || 0);
  release();
  const late = await within(p, 3000);
  await sleep(50);
  check(`L3 ${label}：同步在途点登出——登出返回、迟到的同步也结束（不卡死）`, lo.settled && lo.v.ok === true && late.settled, JSON.stringify({ logout: lo.settled && lo.v.ok, late: late.settled }));
  check(`L3 ${label}：保持已登出——没有账号、没有登录凭证 / 会话记录，迟到的结果没有把它们写回来`, d.sync.account() === null && !d.storage._m.has("suipian.auth") && !d.storage._m.has("suipian.session"));
  check(`L3 ${label}：未上传的进度还留在本机副本里，迟到的结果没有改写它（逐字节相同）`, !!copyKey && d.storage.getItem(copyKey) === copyAfterLogout, copyKey ? "" : "副本不见了");
  check(`L3 ${label}：迟到的结果没有再向云端写入（登出后云端写入 0 次）`, (S.count["POST /rest/v1/rpc/save_progress"] || 0) + (S.count["POST /rest/v1/rpc/create_progress"] || 0) === writes0 && S.xpOf("a@x.com") === 0, `云端XP=${S.xpOf("a@x.com")}`);
  S.rules.length = 0; d.state = freshState();
  const re = await login(S, d, "a@x.com"); await d.sync.syncNow({ manual: true });
  check(`L3 ${label}：用同一个账号重新登录后接着上传，进度只算一次（云端 20 XP、本机 20 XP）`, re.ok === true && S.xpOf("a@x.com") === 20 && d.state.xp === 20, `云端=${S.xpOf("a@x.com")} 本机=${d.state.xp}`);
}

// ===== L4 刷新令牌过期 / 被吊销 =====
for (const [label, code, body] of [["401 session_expired", 401, { code: 401, error_code: "session_expired", msg: "Session expired" }], ["401 无错误码", 401, { msg: "unauthorized" }]]) {
  const S = fakeCloud(), d = device(S);
  await login(S, d, "a@x.com"); finishLesson(d, "u1-l1", 20);
  d.clock += 2 * 3600 * 1000; // 访问令牌过期，需要刷新
  const timers0 = d.timers.length; // 写本机进度时排的“1.5 秒后同步”防抖定时器不算重试
  S.fail(/POST \/auth\/v1\/token/, code, body, 5);
  const r = await d.sync.syncNow({ manual: true });
  check(`L4 刷新被拒（${label}）：同步失败、状态是“需要重新登录”`, r.ok === false && d.sync.status().status === "need-login", `status=${d.sync.status().status}`);
  check(`L4 （${label}）：刷新接口只请求 1 次，没有重试风暴、没有排定自动重试`, S.count["POST /auth/v1/token"] === 1 && d.timers.length === timers0, `刷新=${S.count["POST /auth/v1/token"]} 新增定时器=${d.timers.length - timers0}`);
  check(`L4 （${label}）：本地已学进度完整保留（20 XP、1 关），云端没被动`, d.state.xp === 20 && d.state.done["u1-l1"] === true && S.xpOf("a@x.com") === 0, `云端=${S.xpOf("a@x.com")}`);
  S.rules.length = 0; S.issue(); const re = await d.sync.verify("a@x.com", "123456", d.state); if (re.ok && re.state) d.state = re.state;
  await d.sync.syncNow({ manual: true });
  check(`L4 （${label}）：重新登录后，离线期间学的进度补传到云端（20 XP，不重复）`, re.ok === true && S.xpOf("a@x.com") === 20 && d.state.xp === 20, `云端=${S.xpOf("a@x.com")} 本机=${d.state.xp}`);
}

// ===== L5 跨标签会话漂移 =====
{
  const S = fakeCloud(), st = fakeStorage(), A = device(S, st);
  await login(S, A, "a@x.com"); finishLesson(A, "u1-l1", 20); await A.sync.syncNow({ manual: true });
  const B = device(S, st); const restored = B.sync.restore(freshState());
  const lo = await B.sync.logout();
  check("L5 标签 B 恢复同一账号并登出：成功", !!restored && lo.ok === true, JSON.stringify(lo));
  const rev0 = S.rows.get(S.users.get("a@x.com")).rev;
  const w = finishLesson(A, "u1-l2", 10);
  const r = await within(A.sync.syncNow({ manual: true }));
  check("L5 标签 A 切回继续学并同步：不抛错、按时结束、不再向云端写入（云端版本不变）", r.settled && S.rows.get(S.users.get("a@x.com")).rev === rev0 && S.xpOf("a@x.com") === 20, JSON.stringify({ settled: r.settled, ok: r.settled && r.v.ok, persist: w.ok, rev: S.rows.get(S.users.get("a@x.com")).rev }));
  check("L5 标签 A：同步结果是失败并说明没有账号（no-account / sessionLost），旧页退成游客（没有账号、状态不是 synced；不是静默成功 / 卡死）", r.settled && r.v.ok === false && (r.v.kind === "no-account" || r.v.sessionLost === true) && A.sync.account() === null && A.sync.status().status !== "synced", `res=${JSON.stringify(r.settled ? r.v : null)} account=${JSON.stringify(A.sync.account())} status=${A.sync.status().status}`);
}

// ===== L6 离线写入 → 503 → 恢复：补偿且幂等 =====
{
  const S = fakeCloud(), d = device(S);
  await login(S, d, "a@x.com");
  S.offline = true; finishLesson(d, "u1-l1", 20);
  const r1 = await d.sync.syncNow({ manual: true });
  check("L6 断网：本机进度已落盘，状态是离线（不是错误）", r1.ok === false && d.sync.status().status === "offline" && d.state.xp === 20, `status=${d.sync.status().status}`);
  S.offline = false; S.fail(/GET \/rest\/v1\/progress/, 503, { msg: "upstream down" });
  const r2 = await d.sync.syncNow({ manual: true });
  check("L6 恢复网络但云端 503：失败、状态不是“已同步”，进度仍在", r2.ok === false && d.sync.status().status !== "synced" && d.state.xp === 20, `status=${d.sync.status().status}`);
  const r3 = await d.sync.syncNow({ manual: true });
  check("L6 云端恢复：同步成功", r3.ok === true && d.sync.status().status !== "error");
  check("L6 云端与本机一致且没有重复累加（云端 20 XP、本机 20 XP、save 只 1 次）", S.xpOf("a@x.com") === 20 && d.state.xp === 20 && S.saveCalls === 1, `云端=${S.xpOf("a@x.com")} 本机=${d.state.xp} save=${S.saveCalls}`);
  const r4 = await d.sync.syncNow({ manual: true });
  check("L6 再同步一次（幂等）：不再写云端", r4.ok === true && S.saveCalls === 1 && S.xpOf("a@x.com") === 20, `save=${S.saveCalls}`);
}

const failed = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
