// 普通同步遵守服务器 429 的等待时间（Node，不联网）：Retry-After 的秒数 / HTTP 日期、缺失 / 非法的保底等待、超大值封顶、
// 重复 429 不缩短等待、多个触发源同时重试、进度保留且不重复上传，以及和会话代次（acctGen）的配合。
// 起因（GPT1 2026-11-20 05:00 任务 2）：假接口回 Retry-After: 180，第 61 秒再次同步已经发出请求（同步层固定冷却 60 秒）。
// 运行：node tests/sync-retry-after.test.mjs
import { createSync } from "../src/sync.js";
import { GUEST_KEY } from "../src/account-store.js";
import { createApi, parseRetryAfter } from "../src/cloud-api.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";
import { statusText, errorText } from "../src/account-ui.js";
import { SYNC_COPY } from "../src/auth-errors.js";

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
const EMAIL_A2 = EMAIL_A;
const RATE = (hdr) => ({ status: 429, headers: hdr === undefined ? {} : { "retry-after": String(hdr) } });
const LIM = { code: 429, error_code: "over_request_rate_limit", msg: "rate limited" };
const req = (S) => Object.entries(S.count).filter(([k]) => /GET \/rest\/v1\/progress|rpc\/(create|save)_progress|\/auth\/v1\/token/.test(k)).reduce((n, [, v]) => n + v, 0);
const secs = (n) => n * 1000;
// 一次 429 → 在 +t 秒各探测一次：返回每个时间点“这次手动同步有没有发出请求”
async function probe(S, d, times) {
  const out = [];
  for (const t of times) { d.clock = T0 + secs(t); const before = req(S); const r = await d.sync.syncNow({ manual: true }); out.push({ t, sent: req(S) > before, r }); if (r.ok) break; }
  return out;
}
const T0 = Date.now() + 1e6;
async function limitedDevice(S, header, { rule = GET, lesson = true } = {}) {
  const d = await loggedInA(S); d.clock = T0;
  S.fail(rule, 429, LIM, 1, header === undefined ? {} : { "retry-after": header });
  const first = await d.sync.syncNow({ manual: true });
  return { d, first };
}

// ===== 0. 解析 Retry-After（cloud-api） =====
{
  const now = Date.UTC(2026, 10, 20, 0, 0, 0);
  const fut = new Date(now + 120_000).toUTCString(), past = new Date(now - 3600_000).toUTCString();
  const P = (v) => parseRetryAfter(v, now);
  check("解析：秒数 180 / 0 / 带空格", P("180").sec === 180 && P("0").sec === 0 && P("  30 ").sec === 30 && P("180").valid);
  check("解析：未来日期 → 剩余秒数 120；过期日期 → 0（合法但已过）", P(fut).valid && P(fut).sec === 120 && P(past).valid && P(past).sec === 0);
  {
    const f3 = (d3) => [d3.toUTCString(), `${["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d3.getUTCDay()]}, ${String(d3.getUTCDate()).padStart(2, "0")}-${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d3.getUTCMonth()]}-${String(d3.getUTCFullYear()).slice(2)} ${d3.toUTCString().slice(17, 25)} GMT`, `${d3.toUTCString().slice(0, 3)} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][d3.getUTCMonth()]} ${String(d3.getUTCDate()).padStart(2, " ")} ${d3.toUTCString().slice(17, 25)} ${d3.getUTCFullYear()}`];
    const three = f3(new Date(now + 180_000));
    check("解析：三种 HTTP 日期（IMF-fixdate / rfc850 两位年 / asctime 天数补空格）都认，未来 180 秒 → 180", three.every((v) => P(v).valid && P(v).sec === 180), JSON.stringify(three.map((v) => [v, P(v)])));
    const oldOnes = ["Sun, 06 Nov 1994 08:49:37 GMT", "Sunday, 06-Nov-94 08:49:37 GMT", "Sun Nov  6 08:49:37 1994"];
    check("  RFC 9110 的三个示例：都合法、都已过期（0 秒）", oldOnes.every((v) => P(v).valid && P(v).sec === 0), JSON.stringify(oldOnes.map(P)));
    check("  rfc850 两位年：比现在晚 50 年以上的当成最近的过去那一年（76 → 1976 → 已过期；30 → 2030 → 未来）", P("Friday, 20-Nov-76 00:03:00 GMT").sec === 0 && P("Wednesday, 20-Nov-30 00:00:00 GMT").sec > 3e7, JSON.stringify([P("Friday, 20-Nov-76 00:03:00 GMT"), P("Wednesday, 20-Nov-30 00:00:00 GMT")]));
    const strict = ["Fri, 30 Feb 2027 00:00:00 GMT", "Fri Feb 30 00:03:00 2026", "Friday, 31-Apr-26 00:00:00 GMT", "Fri, 20 Nov 2026 24:00:00 GMT", "Fri, 20 Nov 2026 00:60:00 GMT", "Foo, 20 Nov 2026 00:03:00 GMT", "Fri, 20 Foo 2026 00:03:00 GMT", "Fri Nov 20 00:03:00 PST 2026", "Friday, 20-Nov-2026 00:03:00 GMT", "Fri, 29 Feb 2027 00:00:00 GMT"];
    check("  严格校验：不存在的日期（2 月 30 日、4 月 31 日、非闰年 2 月 29 日）、24 点、60 分、假星期 / 月份名、带时区名的 asctime → 非法", strict.every((v) => P(v).valid === false), JSON.stringify(strict.map((v) => [v, P(v).valid])));
    const tzs = ["Asia/Tokyo", "America/Los_Angeles", "UTC", "Pacific/Auckland"]; const oldTz = process.env.TZ;
    const res = tzs.map((z) => { process.env.TZ = z; return three.map((v) => P(v).sec).join(","); });
    if (oldTz === undefined) delete process.env.TZ; else process.env.TZ = oldTz;
    check("  不依赖本地时区：东京 / 洛杉矶 / UTC / 奥克兰下，三种格式解析结果都一样（asctime 也按 UTC）", res.every((r) => r === "180,180,180"), JSON.stringify(res));
  }
  check("解析：缺失 / 空串 → 没给", P(null).present === false && P(undefined).present === false && P("").present === false && P("   ").present === false);
  check("解析：非法值（负数、小数、乱码、科学计数、非 GMT 日期、半截日期）→ 给了但不合法", ["-5", "1.5", "abc", "1e3", "12 s", "Wed, 99 Foo 2020 00:00:00 GMT", "2026-11-20T00:00:00Z", "Fri, 20 Nov 2026 00:00:00 PST", "Fri, 20 Nov"].every((v) => { const r = P(v); return r.present && r.valid === false; }), JSON.stringify(["-5", "1.5", "abc", "1e3"].map(P)));
  check("解析：超大数字不变成 NaN / Infinity（交给调用方封顶）", Number.isFinite(P("9".repeat(400)).sec) && P("99999999999999").sec >= 99999999999999);
  const mk = (headers) => createApi({ url: "https://f.test", anonKey: "k", now: () => now, fetchFn: async () => J(429, { msg: "x" }, headers) });
  const r1 = await mk({ "retry-after": "180" }).sendCode("a@b.co"), r2 = await mk({ "retry-after": fut }).sendCode("a@b.co"), r3 = await mk({ "retry-after": "abc" }).sendCode("a@b.co"), r4 = await mk({}).sendCode("a@b.co");
  check("cloud-api：429 响应带出 retryAfterSec（秒数 180 / 日期 120）；非法 / 缺失不带这个字段", r1.retryAfterSec === 180 && r2.retryAfterSec === 120 && !("retryAfterSec" in r3) && !("retryAfterSec" in r4) && r1.kind === "rate-limit", JSON.stringify([r1, r2, r3, r4]));
}

// ===== 1. 核心：Retry-After: 180，第 61 秒不得再发请求 =====
{
  const S = fakeCloud(); const { d, first } = await limitedDevice(S, "180");
  check("首次同步被 429：返回 rate-limit，不可自动重试", first.ok === false && first.kind === "rate-limit" && first.retryable === false, JSON.stringify(first));
  const base = req(S);
  const out = await probe(S, d, [1, 30, 61, 120, 179]);
  check("Retry-After 180：第 1 / 30 / 61 / 120 / 179 秒手动同步都不发请求，都返回 rate-limit", out.every((o) => !o.sent && o.r.kind === "rate-limit" && o.r.retryable === false) && req(S) === base, JSON.stringify(out.map((o) => [o.t, o.sent, o.r.kind])));
  check("  等待期里的状态是错误（不是“同步中”卡住）、提示带约几分钟", statusOf(d).status === "error" && /分钟/.test(statusOf(d).message || ""), JSON.stringify(statusOf(d)));
  const last = await probe(S, d, [181]);
  check("  第 181 秒恢复：发出请求并同步成功，云端 40 XP，只上传一次", last[0].sent && last[0].r.ok === true && S.xpOf(EMAIL_A) === 40 && (S.count["POST /rest/v1/rpc/create_progress"] || 0) === 1, JSON.stringify([last[0].sent, last[0].r, S.xpOf(EMAIL_A), S.count]));
  check("  同步成功后状态恢复为 synced", statusOf(d).status === "synced");
}

// ===== 2. HTTP 日期：未来 / 过期 =====
{
  const S = fakeCloud(); const d0 = Date.now();
  const mkFut = () => new Date(T0 + secs(120)).toUTCString();
  const { d } = await limitedDevice(S, mkFut());
  const out = await probe(S, d, [30, 61, 119]);
  const ok = await probe(S, d, [122]);
  check("未来日期（+120 秒）：第 30 / 61 / 119 秒不发请求；第 122 秒恢复并成功", out.every((o) => !o.sent) && ok[0].sent && ok[0].r.ok === true, JSON.stringify([out.map((o) => o.sent), ok[0].sent, ok[0].r.kind]));
}
for (const [label, hdr] of [["过期日期（一小时前）", () => new Date(T0 - 3600_000).toUTCString()], ["Retry-After: 0", () => "0"]]) {
  const S = fakeCloud(); const { d, first } = await limitedDevice(S, hdr());
  const out = await probe(S, d, [1, 4]);
  const ok = await probe(S, d, [6]);
  check(`${label}：合法但已过 → 最短等 5 秒（防止立刻打回去）：第 1 / 4 秒不发请求；第 6 秒恢复`, first.kind === "rate-limit" && out.every((o) => !o.sent) && ok[0].sent && ok[0].r.ok === true, JSON.stringify([first.kind, out.map((o) => o.sent), ok[0].sent]));
}

// ===== 3. 缺失 / 非法 → 保底 60 秒；超大值 → 封顶 1 小时 =====
for (const [label, hdr] of [["缺失", undefined], ["空串", ""], ["乱码 abc", "abc"], ["负数 -5", "-5"], ["小数 1.5", "1.5"], ["科学计数 1e3", "1e3"], ["非 GMT 日期", "Fri, 20 Nov 2026 00:00:00 PST"]]) {
  const S = fakeCloud(); const { d, first } = await limitedDevice(S, hdr);
  const out = await probe(S, d, [1, 30, 59]);
  const ok = await probe(S, d, [61]);
  check(`Retry-After ${label}：保底等 60 秒（第 59 秒不发请求，第 61 秒恢复）`, first.kind === "rate-limit" && out.every((o) => !o.sent) && ok[0].sent && ok[0].r.ok === true, JSON.stringify([first.kind, out.map((o) => o.sent), ok[0].sent]));
}
// 长等待一律完整照服务器的来（不封顶）：7200 秒不能在第 3601 秒就放行
{
  const S = fakeCloud(); const { d } = await limitedDevice(S, "7200");
  const out = await probe(S, d, [61, 3599, 3601, 5400, 7199]); const ok = await probe(S, d, [7201]);
  check("Retry-After 7200：第 61 / 3599 / 3601 / 5400 / 7199 秒都不发请求；第 7201 秒恢复（不再有一小时上限）", out.every((o) => !o.sent && o.r.kind === "rate-limit") && ok[0].sent && ok[0].r.ok === true, JSON.stringify([out.map((o) => [o.t, o.sent]), ok[0].sent]));
}
for (const [label, hdr, probes, resume] of [["99999999 秒（约 3 年）", "99999999", [3601, 86400, 99999990], 100000001], ["400 位数字（实际等于永不）", "9".repeat(400), [3601, 1e9, 1e12], null]]) {
  const S2 = fakeCloud(); const { d } = await limitedDevice(S2, hdr);
  const out = await probe(S2, d, probes);
  const timers = d.timers.map((t) => t.ms);
  check(`超大值 ${label}：一小时、一天以后都不发请求，不被截短`, out.every((o) => !o.sent && o.r.kind === "rate-limit"), JSON.stringify(out.map((o) => [o.t, o.sent])));
  check("  唤醒计时器单次不超过 2^31-1 毫秒（不会溢出成立刻触发）", timers.length > 0 && timers.every((ms) => ms >= 1 && ms <= 2147483647), JSON.stringify(timers));
  if (resume) { const ok = await probe(S2, d, [resume]); check("  过了截止时间之后恢复", ok[0].sent && ok[0].r.ok === true); }
}
{
  const S = fakeCloud(); const { d } = await limitedDevice(S, "2");
  const out = await probe(S, d, [3]); const ok = await probe(S, d, [6]);
  check("Retry-After: 2（小于 5 秒下限）：按 5 秒等：第 3 秒不发请求，第 6 秒恢复", !out[0].sent && ok[0].sent && ok[0].r.ok === true);
}

// ===== 4. 重复 429：不缩短；连续限流各自重新计时 =====
{
  // 4a 连续限流：第一次 180 → 过期后再次 429（30）→ 新的等待从这一次开始
  const S = fakeCloud(); const { d } = await limitedDevice(S, "180");
  d.clock = T0 + secs(181); S.fail(GET, 429, LIM, 1, { "retry-after": "30" });
  const sec = await d.sync.syncNow({ manual: true });
  const out = await probe(S, d, [181 + 10, 181 + 29]); const ok = await probe(S, d, [181 + 31]);
  check("连续限流：180 秒过后再 429（Retry-After 30）→ 新一轮从此刻重新计时：+10 / +29 秒不发请求，+31 秒恢复", sec.kind === "rate-limit" && out.every((o) => !o.sent) && ok[0].sent && ok[0].r.ok === true, JSON.stringify([sec.kind, out.map((o) => o.sent), ok[0].sent]));
}
{
  // 4b 两个 sendCode 同时在途，先回来的 429（180），后回来的 429（30）：后者不得缩短前者
  const S = fakeCloud(); const d = device(S); d.clock = T0;
  const r1 = S.hold(/POST \/auth\/v1\/otp/, { status: 429, headers: { "retry-after": "180" } }), r2 = S.hold(/POST \/auth\/v1\/otp/, { status: 429, headers: { "retry-after": "30" } });
  const p1 = d.sync.sendCode("a@x.com"), p2 = d.sync.sendCode("a@x.com"); await sleep(30);
  r1(); await p1; r2(); await p2;
  const b = req(S) + (S.count["POST /auth/v1/otp"] || 0);
  d.clock = T0 + secs(61); const m61 = await d.sync.sendCode("a@x.com"); const n61 = S.count["POST /auth/v1/otp"];
  d.clock = T0 + secs(179); const m179 = await d.sync.sendCode("a@x.com");
  d.clock = T0 + secs(181); S.issue(); const m181 = await d.sync.sendCode("a@x.com");
  check("两次 429 先后回来（180 在先、30 在后）：后一次不缩短等待——第 61 / 179 秒仍被挡（不发请求），第 181 秒放行", m61.kind === "rate-limit" && m179.kind === "rate-limit" && n61 === 2 && S.count["POST /auth/v1/otp"] === 3 && m181.ok === true, JSON.stringify([m61.kind, m179.kind, n61, S.count["POST /auth/v1/otp"], m181]));
}

// ===== 5. 多个触发源同时重试 =====
{
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0;
  // 5a 限流之前：手动 + 自动 + 计时器 + 联网恢复同时触发 → 合并成一次请求
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" });
  const g0 = S.count["GET /rest/v1/progress"] || 0;
  const rs = await Promise.all([d.sync.syncNow({ manual: true }), d.sync.syncNow(), d.sync.syncNow(), d.sync.syncNow({ manual: true }), d.sync.syncNow()]);
  check("多个入口同时触发：合并成一次请求（一次 GET），结果一致都是 rate-limit", (S.count["GET /rest/v1/progress"] || 0) === g0 + 1 && rs.every((r) => r.kind === "rate-limit"), JSON.stringify([S.count["GET /rest/v1/progress"] - g0, rs.map((r) => r.kind)]));
  // 5b 等待期里：手动 / 自动 / 联网恢复 / 定时器 / 保存本机进度 同时触发 → 一个请求也不发
  const before = req(S), cloud0 = S.xpOf(EMAIL_A); d.clock = T0 + secs(90);
  finishLesson(d, "u1-l2", 10);                          // 学习进度照常保存在本机（不丢），并触发自动同步安排
  d.sync.scheduleSync?.();
  const fired = d.timers.splice(0).map((t) => t.fn());   // 触发所有已排的计时器
  const rs2 = await Promise.all([d.sync.syncNow({ manual: true }), d.sync.syncNow(), d.sync.syncNow(), ...fired.map((x) => Promise.resolve(x))]);
  await sleep(40);
  check("等待期内手动 / 自动 / 联网恢复 / 计时器同时触发：一个请求也不发，进度还留在本机", req(S) === before && d.state.xp === 50 && S.xpOf(EMAIL_A) === cloud0, JSON.stringify([req(S) - before, d.state.xp, S.xpOf(EMAIL_A), cloud0]));
  // 5c 到期后：多个入口同时触发 → 只发一轮，进度只上传一次
  d.clock = T0 + secs(181); const g1 = S.count["GET /rest/v1/progress"] || 0, sv1 = (S.count["POST /rest/v1/rpc/save_progress"] || 0) + (S.count["POST /rest/v1/rpc/create_progress"] || 0);
  const rs3 = await Promise.all([d.sync.syncNow({ manual: true }), d.sync.syncNow(), d.sync.syncNow(), d.sync.syncNow({ manual: true })]);
  check("到期后多个入口同时触发：只发一轮请求（读取 + 一次上传），云端 50 XP（不重复上传）", rs3.every((r) => r.ok === true) && S.xpOf(EMAIL_A) === 50 && (S.count["GET /rest/v1/progress"] || 0) <= g1 + 2 && (S.count["POST /rest/v1/rpc/save_progress"] || 0) + (S.count["POST /rest/v1/rpc/create_progress"] || 0) === sv1 + 1, JSON.stringify([rs3.map((r) => r.ok), S.xpOf(EMAIL_A), S.count, g1, sv1]));
}

// ===== 6. 保存被 429：进度保留，到期后只保存一次 =====
{
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0;
  const first = await d.sync.syncNow({ manual: true });            // 先把 40 XP 传上去（create）
  const rev0 = S.rows.get(S.users.get(EMAIL_A)).rev;
  finishLesson(d, "u1-l2", 30);                                    // 新进度，等着保存
  S.fail(SAVE, 429, LIM, 1, { "retry-after": "90" });
  const r = await d.sync.syncNow({ manual: true });
  check("保存被 429（Retry-After 90）：返回 rate-limit，本机进度保留（70 XP），云端还是 40", first.ok && r.kind === "rate-limit" && d.state.xp === 70 && S.xpOf(EMAIL_A) === 40, JSON.stringify([first.ok, r.kind, d.state.xp, S.xpOf(EMAIL_A)]));
  const saves0 = S.count["POST /rest/v1/rpc/save_progress"] || 0;
  const out = await probe(S, d, [30, 89]);
  const ok = await probe(S, d, [91]);
  const rev1 = S.rows.get(S.users.get(EMAIL_A)).rev;
  check("  等待期内不再保存；到期后保存成功：云端 70 XP，版本只 +1（没有重复上传）", out.every((o) => !o.sent) && (S.count["POST /rest/v1/rpc/save_progress"] || 0) === saves0 + 1 && ok[0].r.ok && S.xpOf(EMAIL_A) === 70 && rev1 === rev0 + 1, JSON.stringify([out.map((o) => o.sent), S.count["POST /rest/v1/rpc/save_progress"], saves0, S.xpOf(EMAIL_A), rev0, rev1]));
}

// ===== 7. 令牌刷新被 429 =====
{
  const S = fakeCloud(); S.expiresIn = 30; const d = await loggedInA(S); d.clock = T0 + secs(3600);   // 令牌已过期，下一次同步要先刷新
  S.fail(REFRESH, 429, LIM, 1, { "retry-after": "120" });
  const r = await d.sync.syncNow({ manual: true });
  const tok0 = S.count["POST /auth/v1/token"] || 0, get0 = S.count["GET /rest/v1/progress"] || 0;
  d.clock = T0 + secs(3600 + 61); const m = await d.sync.syncNow({ manual: true });
  check("刷新令牌被 429（Retry-After 120）：第 61 秒不再刷新也不读云端；仍是登录态（不当成登录失效）", r.kind === "rate-limit" && m.kind === "rate-limit" && (S.count["POST /auth/v1/token"] || 0) === tok0 && (S.count["GET /rest/v1/progress"] || 0) === get0 && d.sync.account()?.email === EMAIL_A && d.storage.getItem("suipian.auth") !== null, JSON.stringify([r.kind, m.kind, d.sync.account()]));
  d.clock = T0 + secs(3600 + 121); const ok = await d.sync.syncNow({ manual: true });
  check("  到期后刷新成功，同步成功，云端 40 XP", ok.ok === true && S.xpOf(EMAIL_A) === 40, JSON.stringify(ok));
}

// ===== 8. 和会话代次配合：旧会话的等待不拖住新会话，也不被旧任务改写 =====
{
  // 8a 退出再登录 B：A 的 429 等待（600 秒）不拖住 B
  const S = fakeCloud(); const { d } = await limitedDevice(S, "600");
  const blocked = await d.sync.syncNow({ manual: true });
  await d.sync.logout({ force: true }); await login(S, d, EMAIL_B); finishLesson(d, "u1-l1", 25);
  const rb = await d.sync.syncNow({ manual: true });
  check("A 被限流 600 秒后强制退出并登录 B：B 立刻可以同步（不被 A 的等待拖住），云端 25 XP", blocked.kind === "rate-limit" && rb.ok === true && S.xpOf(EMAIL_B) === 25, JSON.stringify([blocked.kind, rb]));
}
{
  // 8b 退出再登录同一个账号 A：新会话重新开始，不继承旧会话的等待
  const S = fakeCloud(); const { d } = await limitedDevice(S, "600");
  await d.sync.logout({ force: true }); await login(S, d, EMAIL_A); finishLesson(d, "u1-l1", 40);
  const q0 = req(S); const r = await d.sync.syncNow({ manual: true });
  check("A 被限流 600 秒后退出再登录 A：新会话立刻可以同步（发出了请求，成功）", r.ok === true && req(S) > q0 && statusOf(d).status === "synced", JSON.stringify([r, req(S) - q0, statusOf(d)]));
}
{
  // 8c 旧任务的 429 响应在退出 / 登录 B 之后才回来：不得给 B 加上等待
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0;
  const rel = S.hold(GET, { status: 429, headers: { "retry-after": "3600" } });
  const pa = d.sync.syncNow({ manual: true }); await sleep(30);
  await d.sync.logout({ force: true }); await login(S, d, EMAIL_B); finishLesson(d, "u1-l1", 25);
  const st0 = JSON.stringify(statusOf(d));
  rel(); const ra = await within(pa); await sleep(30);
  check("旧任务的 429（Retry-After 3600）在退出并登录 B 之后才回来：返回 stale，不改 B 的状态", ra.settled && ra.v.stale === true && JSON.stringify(statusOf(d)) === st0, JSON.stringify([ra.v, st0, JSON.stringify(statusOf(d))]));
  const rb = await d.sync.syncNow({ manual: true });
  check("  之后 B 立刻可以同步（没有被旧任务设上等待），云端 25 XP", rb.ok === true && S.xpOf(EMAIL_B) === 25, JSON.stringify(rb));
}
{
  // 8d 同一会话里的等待照旧生效（不会被当成旧会话误清）：429 之后没有退出，等待还在
  const S = fakeCloud(); const { d } = await limitedDevice(S, "300");
  const m = await probe(S, d, [100]);
  check("同一会话内等待照旧生效：第 100 秒（300 秒的等待里）不发请求", !m[0].sent && m[0].r.kind === "rate-limit");
}

// ===== 9. 现有发码冷却不变 =====
{
  const S = fakeCloud(); const d = device(S); d.clock = T0;
  S.fail(/POST \/auth\/v1\/otp/, 429, LIM, 1);
  const r1 = await d.sync.sendCode("a@x.com");
  const n1 = S.count["POST /auth/v1/otp"];
  d.clock = T0 + secs(59); const r2 = await d.sync.sendCode("a@x.com");
  d.clock = T0 + secs(61); const r3 = await d.sync.sendCode("a@x.com");
  check("发码 429（无 Retry-After）：保底 60 秒——第 59 秒被挡（不发请求，提示“一分钟”），第 61 秒放行", r1.kind === "rate-limit" && r2.kind === "rate-limit" && /一分钟/.test(r2.message) && S.count["POST /auth/v1/otp"] === n1 + 1 && r3.ok === true, JSON.stringify([r1.kind, r2, r3]));
  const S2 = fakeCloud(); const d2 = device(S2); d2.clock = T0;
  S2.fail(/POST \/auth\/v1\/otp/, 429, LIM, 1, { "retry-after": "180" });
  await d2.sync.sendCode("a@x.com"); d2.clock = T0 + secs(61); const m61 = await d2.sync.sendCode("a@x.com"); d2.clock = T0 + secs(181); const m181 = await d2.sync.sendCode("a@x.com");
  check("发码 429 带 Retry-After 180：同样照服务器的等——第 61 秒被挡，第 181 秒放行", m61.kind === "rate-limit" && m181.ok === true, JSON.stringify([m61.kind, m181]));
}

// ===== 10. 三种 HTTP 日期都按服务器要求等（rfc850 / asctime 以前被判非法，第 61 秒就恢复请求） =====
{
  const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], DAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const fmt = {
    "IMF-fixdate": (t) => new Date(t).toUTCString(),
    "rfc850": (t) => { const x = new Date(t); return `${DAY[x.getUTCDay()]}, ${String(x.getUTCDate()).padStart(2, "0")}-${MON[x.getUTCMonth()]}-${String(x.getUTCFullYear()).slice(2)} ${x.toUTCString().slice(17, 25)} GMT`; },
    "asctime": (t) => { const x = new Date(t); return `${x.toUTCString().slice(0, 3)} ${MON[x.getUTCMonth()]} ${String(x.getUTCDate()).padStart(2, " ")} ${x.toUTCString().slice(17, 25)} ${x.getUTCFullYear()}`; },
  };
  for (const [name, f] of Object.entries(fmt)) {
    // 取整到秒：这些格式只有秒的精度
    const base = Math.floor(T0 / 1000) * 1000;
    const S = fakeCloud(); const d = await loggedInA(S); d.clock = base;
    S.fail(GET, 429, LIM, 1, { "retry-after": f(base + 180_000) });
    const first = await d.sync.syncNow({ manual: true });
    const out = await probe(S, d, [1, 61, 120, 179]); const ok = await probe(S, d, [181]);
    check(`${name} 日期（未来 180 秒）：第 1 / 61 / 120 / 179 秒不发请求，第 181 秒恢复`, first.kind === "rate-limit" && out.every((o) => !o.sent) && ok[0].sent && ok[0].r.ok === true, JSON.stringify([f(base + 180_000), first.kind, out.map((o) => o.sent), ok[0].sent]));
  }
}

// ===== 11. 游客导入（待办）里收到 429：和普通同步一样进冷却，不走 3 秒网络退避 =====
const imports = (st) => [...st._m.keys()].filter((k) => k.startsWith("suipian.acct.import.")).map((k) => k + "=" + st.getItem(k)).join("|");
async function withPendingImport(S, choice) {
  const d = device(S); d.clock = T0;
  seedGuest(d, 50);
  S.issue();
  const v = await d.sync.verify(EMAIL_A, "123456", d.state);
  if (!v.ok || !v.needChoice) throw new Error("需要选择：" + JSON.stringify(v));
  S.fail(/create_progress|save_progress/, 503, { msg: "x" }, 5);   // 写云失败 → 专用待办留在本机
  const f = await d.sync.finishChoice(choice);
  S.rules.length = 0;
  if (![...d.storage._m.keys()].some((k) => k.startsWith("suipian.acct.import."))) throw new Error("没有留下待办：" + JSON.stringify(f));
  return d;
}
const writes = (S) => (S.count["POST /rest/v1/rpc/create_progress"] || 0) + (S.count["POST /rest/v1/rpc/save_progress"] || 0);
const R180 = { status: 429, headers: { "retry-after": "180" } };
for (const choice of ["cloud", "transfer"]) for (const phase of ["读取", "写入", "读回"]) {
  const label = `${choice === "cloud" ? "保留云端" : "安全合并"}·${phase}`;
  const S = fakeCloud(); const d = await withPendingImport(S, choice); const t0 = d.timers.length;
  const imp0 = imports(d.storage), w00 = writes(S);
  let r;
  if (phase === "读取") { S.fail(GET, 429, LIM, 1, { "retry-after": "180" }); r = await d.sync.syncNow({ manual: true }); }
  else if (phase === "写入") { S.fail(/create_progress|save_progress/, 429, LIM, 1, { "retry-after": "180" }); r = await d.sync.syncNow({ manual: true }); }
  else { const g1 = S.hold(GET), g2 = S.hold(GET, R180); const p = d.sync.syncNow({ manual: true }); await tick(); g1(); await tick(); g2(); r = await p; }
  const newTimers = d.timers.slice(t0).map((t) => t.ms);
  const st1 = JSON.stringify(statusOf(d)), pend1 = statusOf(d).pending;
  const n0 = req(S) + writes(S);
  d.clock = T0 + secs(1); const m1 = await d.sync.syncNow({ manual: true });
  d.clock = T0 + secs(4); const m4 = await d.sync.syncNow(); // 原来 3 秒退避的位置
  d.clock = T0 + secs(61); const m61 = await d.sync.syncNow({ manual: true });
  check(`导入 ${label} 收到 429（Retry-After 180）：返回 rate-limit（不可重试），状态待同步，待办和游客记录都保留`, r.kind === "rate-limit" && r.retryable === false && pend1 === true && imports(d.storage) !== "" && d.storage.getItem(GUEST_KEY) !== null, JSON.stringify([r.kind, r.retryable, st1, imports(d.storage) === imp0]));
  check(`  不排 3 秒网络退避（只有 180 秒的到期唤醒）；第 1 / 4 / 61 秒的手动 / 自动同步都不发任何请求`, newTimers.every((ms) => ms > 100_000) && newTimers.length >= 1 && req(S) + writes(S) === n0 && [m1, m4, m61].every((x) => x.kind === "rate-limit"), JSON.stringify([newTimers, req(S) + writes(S) - n0, [m1, m4, m61].map((x) => x.kind)]));
  d.clock = T0 + secs(181); const ok = await d.sync.syncNow({ manual: true });
  check(`  到期后导入完成：待办已清（合并时游客记录一并清掉）、云端有数据（${choice === "cloud" ? "保留云端：云端记录存在" : "合并：50 XP"}）；上传次数：${phase === "读取" ? 1 : 2}（被 429 的那次 + 成功的一次，没有多传）`, ok.ok === true && (choice === "cloud" || d.storage.getItem(GUEST_KEY) === null) && imports(d.storage) === "" && S.rows.has(S.users.get(EMAIL_A)) && (choice === "cloud" || S.xpOf(EMAIL_A) >= 50) && writes(S) - w00 === (phase === "读取" ? 1 : 2), JSON.stringify([ok, imports(d.storage), S.xpOf(EMAIL_A), writes(S) - w00]));
}
// 登录选择（finishChoice）这一步本身收到 429：新会话带着这段等待
{
  const S = fakeCloud(); const d = device(S); d.clock = T0; seedGuest(d, 50); S.issue();
  const v = await d.sync.verify(EMAIL_A, "123456", d.state);
  S.fail(/create_progress|save_progress/, 429, LIM, 1, { "retry-after": "180" });
  const f = await d.sync.finishChoice("transfer");
  const n0 = req(S) + writes(S);
  d.clock = T0 + secs(61); const m = await d.sync.syncNow({ manual: true }); const a = await d.sync.syncNow();
  check("登录选择里导入写入被 429（180 秒）：登录成功但待同步；第 61 秒手动 / 自动同步都不发请求", v.needChoice && f.ok === true && f.synced === false && m.kind === "rate-limit" && a.kind === "rate-limit" && req(S) + writes(S) === n0, JSON.stringify([f.ok, f.synced, m.kind, req(S) + writes(S) - n0]));
  d.clock = T0 + secs(181); const ok = await d.sync.syncNow({ manual: true });
  check("  到期后完成导入", ok.ok === true && d.storage.getItem(GUEST_KEY) === null && S.xpOf(EMAIL_A) === 50, JSON.stringify([ok, S.xpOf(EMAIL_A)]));
}

// ===== 12. 冷却到期自动恢复（不调用手动同步）：同一会话唯一的到期唤醒 =====
const fire = (d, i = d.timers.length - 1) => d.timers[i].fn();
{
  // 12a 180 秒到期，没有任何外部操作：自己恢复，本机 40 XP 上传一次
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0; const t0 = d.timers.length;
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" });
  await d.sync.syncNow({ manual: true });
  const wakes = d.timers.slice(t0).map((t) => t.ms);
  check("429 之后排了一个到期唤醒（180 秒），没有排网络退避", wakes.length === 1 && wakes[0] === 180000, JSON.stringify(wakes));
  const c0 = S.xpOf(EMAIL_A); const sv0 = writes(S);
  d.clock = T0 + secs(100); fire(d, t0); await tick();                 // 唤醒提前到点（时钟还没到）：不联网，重排剩余时间
  const early = req(S);
  check("  唤醒提前触发（还没到截止时间）：不发请求，重排剩余时间（约 80 秒）", d.timers.length === t0 + 2 && d.timers[t0 + 1].ms === 80000 && req(S) === early && S.xpOf(EMAIL_A) === c0, JSON.stringify([d.timers.slice(t0).map((t) => t.ms)]));
  d.clock = T0 + secs(181); fire(d); await sleep(80);                  // 到期：没有任何手动 / 外部同步调用
  check("  到期唤醒触发：自己完成同步，云端 40 XP，只上传一次，状态 synced", S.xpOf(EMAIL_A) === 40 && writes(S) === sv0 + 1 && statusOf(d).status === "synced" && statusOf(d).pending === false, JSON.stringify([S.xpOf(EMAIL_A), writes(S) - sv0, statusOf(d)]));
}
{
  // 12b 重复 429 延期：旧唤醒作废，只有新的那个管用
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0; const t0 = d.timers.length;
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" }); await d.sync.syncNow({ manual: true });
  d.clock = T0 + secs(181); S.fail(GET, 429, LIM, 1, { "retry-after": "120" });
  fire(d, t0); await sleep(80);                                        // 到期唤醒 → 同步又被 429（120 秒）
  const second = d.timers.length - 1; const ms2 = d.timers[second].ms;
  const r1 = req(S);
  const nT = d.timers.length;
  fire(d, t0); await tick();                                           // 旧唤醒再触发一次：已作废，不发请求，也不再排新的计时器
  const nT2 = d.timers.length;
  d.clock = T0 + secs(181 + 60); fire(d, second); await tick();       // 新唤醒提前触发：还没到，不发请求
  const r2 = req(S);
  d.clock = T0 + secs(181 + 121); fire(d, d.timers.length - 1); await sleep(80);
  check("重复 429 延期：新的 120 秒从这次开始；旧唤醒作废、提前的唤醒不联网；到期后恢复，云端 40 XP", ms2 === 120000 && r2 === r1 && nT2 === nT && S.xpOf(EMAIL_A) === 40, JSON.stringify([ms2, r1, r2, nT, nT2, S.xpOf(EMAIL_A)]));
}
{
  // 12c 唤醒与手动 / 自动触发同时发生：合并成一轮
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0; const t0 = d.timers.length;
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" }); await d.sync.syncNow({ manual: true });
  d.clock = T0 + secs(181); const w0 = writes(S), g0 = S.count["GET /rest/v1/progress"] || 0;
  fire(d, t0); const rs = await Promise.all([d.sync.syncNow({ manual: true }), d.sync.syncNow(), d.sync.syncNow()]); await sleep(60);
  check("到期时唤醒 + 手动 + 自动同时触发：合并成一轮（一次上传），云端 40 XP", writes(S) === w0 + 1 && (S.count["GET /rest/v1/progress"] || 0) <= g0 + 2 && S.xpOf(EMAIL_A) === 40 && rs.every((r) => r.ok), JSON.stringify([writes(S) - w0, rs.map((r) => r.ok)]));
}
{
  // 12d 退出 / 换号作废：旧会话的唤醒不联网、不动新会话
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0; const t0 = d.timers.length;
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" }); await d.sync.syncNow({ manual: true });
  await d.sync.logout({ force: true }); await login(S, d, EMAIL_B); finishLesson(d, "u1-l1", 25);
  const before = req(S), st0 = JSON.stringify(statusOf(d));
  d.clock = T0 + secs(181); fire(d, t0); await sleep(60);
  check("A 被限流后退出并登录 B：A 的到期唤醒到点什么都不做（不联网、不改 B 的状态、不替 B 同步）", req(S) === before && JSON.stringify(statusOf(d)) === st0 && S.xpOf(EMAIL_B) !== 25, JSON.stringify([req(S) - before, st0, JSON.stringify(statusOf(d)), S.xpOf(EMAIL_B)]));
}
{
  // 12e 停机保护：本机写回已连续失败达到上限 → 唤醒也只是被停机保护拦下，不联网
  const S = fakeCloud(); const d = await loggedInA(S); d.clock = T0; const t0 = d.timers.length;
  S.fail(GET, 429, LIM, 1, { "retry-after": "180" }); await d.sync.syncNow({ manual: true });
  d.storage.setItem(`suipian.acct.writebackRetry.${d.sync.account().userId}`, "3");     // 模拟：本机副本写回连续失败 3 次，普通自动同步已停机
  d.clock = T0 + secs(181); const before = req(S);
  fire(d, t0); await sleep(60);
  check("停机保护：本机写回连续失败达上限时，到期唤醒不绕过，不发请求（状态仍是待同步）", req(S) === before && statusOf(d).pending === true && S.xpOf(EMAIL_A) !== 40, JSON.stringify([req(S) - before, statusOf(d), S.xpOf(EMAIL_A)]));
  const m = await d.sync.syncNow({ manual: true });
  check("  手动“立即同步”仍可绕过停机保护并成功", m.ok === true && S.xpOf(EMAIL_A) === 40, JSON.stringify(m));
}
{
  // 12f 长等待分段：到点时还没到截止时间就重排，不提前联网
  const S = fakeCloud(); const { d } = await limitedDevice(S, "99999999"); const t0 = d.timers.length - 1;
  const first = d.timers[t0].ms;
  d.clock = T0 + first + 1000; const before = req(S); fire(d, t0); await tick();
  check("超长等待分段：第一段（≤2^31-1 毫秒）到点后截止时间还远，重排下一段，不发请求", first === 2147483647 && d.timers.length === t0 + 2 && d.timers[t0 + 1].ms >= 1 && d.timers[t0 + 1].ms <= 2147483647 && req(S) === before, JSON.stringify([first, d.timers.slice(t0).map((t) => t.ms)]));
}

// ===== 13. 发码冷却（较长）和同步冷却叠加：到期唤醒要按实际门禁排期，不能被较长的发码冷却吞掉 =====
{
  const S = fakeCloud(); const d = device(S); d.clock = T0; seedGuest(d, 50);
  S.fail(/POST \/auth\/v1\/otp/, 429, LIM, 1, { "retry-after": "600" });
  const sc = await d.sync.sendCode("a@x.com");                                   // 重发验证码被 429：发码冷却 600 秒
  S.issue(); const v = await d.sync.verify(EMAIL_A, "123456", d.state);          // 用仍然有效的旧码登录，需要选择游客记录怎么办
  const t0 = d.timers.length;
  S.fail(/create_progress|save_progress/, 429, LIM, 1, { "retry-after": "180" });
  const f = await d.sync.finishChoice("transfer");                               // 选择转移：导入写入被 429（同步冷却 180 秒）
  const wakes = d.timers.slice(t0).map((t) => t.ms);
  check("叠加前提：发码冷却 600 秒 + 导入写入 429（180 秒）：登录成功但待同步，导入待办保留", sc.kind === "rate-limit" && v.needChoice === true && f.ok === true && f.synced === false && imports(d.storage) !== "" && d.storage.getItem(GUEST_KEY) !== null, JSON.stringify([sc.kind, v.needChoice, f.ok, f.synced]));
  check("  到期唤醒按实际门禁（两份冷却的较大值）排期：600 秒，不是 180 秒", wakes.length === 1 && wakes[0] === 600000, JSON.stringify(wakes));
  const n0 = req(S) + writes(S), w0 = writes(S);
  d.clock = T0 + secs(180); fire(d, t0); await tick();                           // 同步冷却到点，但发码冷却还剩 420 秒：唤醒重排，不联网
  const rearm = d.timers.slice(t0 + 1).map((t) => t.ms);
  d.clock = T0 + secs(181); const m1 = await d.sync.syncNow({ manual: true }); const a1 = await d.sync.syncNow();
  d.clock = T0 + secs(599); const m2 = await d.sync.syncNow({ manual: true });
  check("  第 180 秒唤醒被较长的发码冷却拦下后重排剩余约 420 秒（没有丢）；第 181 / 599 秒手动和自动同步都不发请求", rearm.length === 1 && rearm[0] === 420000 && [m1, a1, m2].every((x) => x.kind === "rate-limit") && req(S) + writes(S) === n0, JSON.stringify([rearm, [m1, a1, m2].map((x) => x.kind), req(S) + writes(S) - n0]));
  d.clock = T0 + secs(601); fire(d); await sleep(80);                             // 到期：不做任何手动操作
  check("  第 601 秒到期自动完成：导入完成（游客记录和待办已清），云端 50 XP，状态 synced，导入写入只多一次（成功的那次）", d.storage.getItem(GUEST_KEY) === null && imports(d.storage) === "" && S.xpOf(EMAIL_A) === 50 && statusOf(d).status === "synced" && statusOf(d).pending === false && writes(S) - w0 === 1, JSON.stringify([imports(d.storage), S.xpOf(EMAIL_A), statusOf(d), writes(S) - w0]));
}

// ===== 14. G-LOGIN-10：冷却内再次同步仍按同步限流展示，不回退成发验证码 / 固定一分钟 =====
for (const [header, elapsed] of [["30", 1], ["180", 121]]) {
  const S = fakeCloud(); const { d, first } = await limitedDevice(S, header);
  const label = `G10 Retry-After ${header}，第 ${elapsed} 秒`;
  check(`${label}：首次 429 的实际状态映射为同步限流`, first.kind === "rate-limit" && statusText(statusOf(d)) === SYNC_COPY.Y3b);
  const requests = JSON.stringify(S.count), stored = snap(d.storage), xp = d.state.xp, writeBefore = writes(S);
  const timers = d.timers.map((t) => t.ms), wake = d.timers.length - 1;
  const until = T0 + secs(Number(header));
  d.clock = T0 + secs(elapsed);
  for (const manual of [true, false]) {
    const r = await d.sync.syncNow({ manual });
    const shown = statusText(statusOf(d)), toast = errorText(r);
    check(`${label} ${manual ? "手动" : "自动"}：G10 状态栏仍为同步限流，不出现发送 / 验证码 / 固定一分钟`, shown === SYNC_COPY.Y3b && !/发送|验证码|一分钟/.test(shown), shown);
    check(`${label} ${manual ? "手动" : "自动"}：提示条保持 G08 中性文案`, toast === "云端请求太频繁了，请稍后再试。", toast);
    check(`${label} ${manual ? "手动" : "自动"}：零新增请求，账号存档和 XP 不变，截止时间及原唤醒不变`, r.kind === "rate-limit" && r.retryable === false && r.retryAt === until && JSON.stringify(S.count) === requests && snap(d.storage) === stored && d.state.xp === xp && JSON.stringify(d.timers.map((t) => t.ms)) === JSON.stringify(timers), JSON.stringify(r));
  }
  d.clock = until + secs(1); fire(d, wake); await sleep(80);
  check(`${label}：原唤醒到期仍自动同步成功，云端 40 XP 且只新增一次上传`, statusOf(d).status === "synced" && S.xpOf(EMAIL_A) === 40 && writes(S) - writeBefore === 1, JSON.stringify([statusOf(d), S.xpOf(EMAIL_A), writes(S) - writeBefore]));
}

const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
