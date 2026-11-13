// D 第一小步：人机验证令牌（CAPTCHA token）的传递接口（纯 Node，全部本地假接口，不碰后台、不发真邮件）。
//   cloud-api.sendCode(email, token)：非空令牌 → 请求体 gotrue_meta_security.captcha_token；不传 / 空 / 非字符串 → 请求体与旧版完全一致；
//   每次调用独立：不复用上一次的令牌；超时不自动重发；令牌不出现在返回值、存储、日志里；
//   sync.sendCode(addr, token)：账号隔离 / 冷却拦下时不发请求；旧调用（无令牌）形状不变。
// 范围：只有“传递”。验证码组件、提供方、OTP 输入规则、后台配置都不在这里；D 防滥用整体验收仍未通过。
// 运行：node tests/captcha-token.test.mjs
import { createApi } from "../src/cloud-api.js";
import { createSync } from "../src/sync.js";
import { emptyDoc } from "../src/account-data.js";
import { freshState } from "../src/storage.js";
import { saveAccount, setCurrentAccount } from "../src/account-store.js";
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + String(d).slice(0, 300) : ""}`); };
const TOKEN_A = "CAPTCHA-TOKEN-AAAA-1111", TOKEN_B = "CAPTCHA-TOKEN-BBBB-2222";
const okReply = () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => "{}" });
function recorder(reply = okReply) { const calls = []; const fetchFn = async (url, init) => { calls.push({ url, method: init.method, body: init.body === undefined ? undefined : JSON.parse(init.body), raw: init.body, headers: init.headers }); return reply(); }; return { calls, fetchFn }; }
const mkApi = (fetchFn, extra = {}) => createApi({ url: "https://x.supabase.test", anonKey: "anon", fetchFn, ...extra });
const logs = []; const origLog = console.log, origErr = console.error, origWarn = console.warn;
const capture = () => { for (const k of ["log", "error", "warn"]) console[k] = (...a) => logs.push(a.map(String).join(" ")); };
const release = () => { console.log = origLog; console.error = origErr; console.warn = origWarn; };

{ // A cloud-api 请求体
  const R = recorder(); const api = mkApi(R.fetchFn);
  const r = await api.sendCode("a@b.co", TOKEN_A);
  check("A 带令牌：POST /auth/v1/otp，请求体 = { email, create_user, gotrue_meta_security: { captcha_token } }", r.ok && R.calls[0].method === "POST" && R.calls[0].url.endsWith("/auth/v1/otp") && JSON.stringify(R.calls[0].body) === JSON.stringify({ email: "a@b.co", create_user: true, gotrue_meta_security: { captcha_token: TOKEN_A } }), R.calls[0].raw);
  const R2 = recorder(); const api2 = mkApi(R2.fetchFn);
  await api2.sendCode("a@b.co");
  check("A 旧调用（不传令牌）：请求体与旧版逐字节一致，没有 gotrue_meta_security 字段", R2.calls[0].raw === JSON.stringify({ email: "a@b.co", create_user: true }), R2.calls[0].raw);
  const R3 = recorder(); const api3 = mkApi(R3.fetchFn);
  for (const bad of ["", "   ", null, undefined, 0, 123, {}, [], true, { captcha_token: TOKEN_A }]) await api3.sendCode("a@b.co", bad);
  check("A 空 / 空白 / null / undefined / 非字符串令牌：一律按旧行为，不放 gotrue_meta_security", R3.calls.length === 10 && R3.calls.every((c) => c.raw === JSON.stringify({ email: "a@b.co", create_user: true })), R3.calls.map((c) => c.raw).join(" | "));
  const R4 = recorder(); await mkApi(R4.fetchFn).sendCode("a@b.co", "  " + TOKEN_A + "\n");
  check("A 令牌两端空白被去掉，其余原样（不改写内容）", R4.calls[0].body.gotrue_meta_security.captcha_token === TOKEN_A);
  const same = R.calls[0].headers; check("A 令牌不进请求头（只在请求体里）", !JSON.stringify(same).includes(TOKEN_A), JSON.stringify(same));
  const bareFetch = recorder(); const noCfg = createApi({ url: "", anonKey: "", fetchFn: bareFetch.fetchFn });
  const nr = await noCfg.sendCode("a@b.co", TOKEN_A);
  check("A 云端未配置：直接返回 config，fetch 零次，返回值不含令牌", nr.kind === "config" && bareFetch.calls.length === 0 && !JSON.stringify(nr).includes(TOKEN_A));
}
{ // B 每次调用独立
  const R = recorder(); const api = mkApi(R.fetchFn);
  await api.sendCode("a@b.co", TOKEN_A); await api.sendCode("a@b.co"); await api.sendCode("a@b.co", TOKEN_B); await api.sendCode("c@d.co");
  const toks = R.calls.map((c) => c.body.gotrue_meta_security?.captcha_token ?? null);
  check("B 同一个 api 实例连续调用：A → 无 → B → 无，每次只带自己这次传入的令牌，不复用", JSON.stringify(toks) === JSON.stringify([TOKEN_A, null, TOKEN_B, null]), JSON.stringify(toks));
  check("B api 对象自身没有保存令牌（对象的所有可枚举属性里找不到）", !JSON.stringify(Object.fromEntries(Object.entries(api).map(([k, v]) => [k, typeof v === "function" ? "fn" : v]))).includes("CAPTCHA-TOKEN"));
}
{ // C 失败路径：超时不重发，令牌不外泄
  const calls = []; let aborted = 0;
  const hang = (u, init) => new Promise((_, rej) => { calls.push(init); init.signal.addEventListener("abort", () => { aborted++; rej(Object.assign(new Error("aborted"), { name: "AbortError" })); }); });
  const api = mkApi(hang, { timeoutMs: 40 });
  const r = await api.sendCode("a@b.co", TOKEN_A);
  await new Promise((ok) => setTimeout(ok, 250)); // 超时的 6 倍时间，足够暴露任何自动重试
  check("C 超时：返回 network + timedOut，fetch 只调用 1 次（不自动重发邮件）", r.ok === false && r.kind === "network" && r.timedOut === true && calls.length === 1 && aborted === 1, JSON.stringify({ r, n: calls.length }));
  check("C 超时的返回值里没有令牌", !JSON.stringify(r).includes(TOKEN_A));
  for (const [status, body] of [[400, { msg: "captcha verification process failed", error_code: "captcha_failed" }], [429, { msg: "rate" }], [500, "oops"]]) {
    const rr = await mkApi(async () => ({ ok: false, status, headers: { get: () => null }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) })).sendCode("a@b.co", TOKEN_A);
    check(`C 服务器 ${status}：失败返回值不含令牌`, rr.ok === false && !JSON.stringify(rr).includes(TOKEN_A), JSON.stringify(rr));
  }
}
function mem() { const m = new Map(); return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; }
const NOW = 1_000_000, PROD = "aqlcunkmggzzvyavlkjg.supabase.co";
const mkSync = (storage, api, opts = {}) => createSync({ storage, api, projectId: PROD, legacyProject: PROD, now: () => NOW, today: () => "2026-11-04", schedule: () => 0, ...opts });
const sess = (userId = "u1", email = "a@example.com") => ({ accessToken: "at", refreshToken: "rt", expiresAt: NOW + 3600_000, userId, email });
{ // D sync 层
  const calls = [];
  const api = { async sendCode(...args) { calls.push(args); return { ok: true }; }, async verifyCode() { return { ok: false, kind: "auth" }; }, async refresh() { return { ok: true, session: sess() }; }, async signOut() { return { ok: true }; }, async getProgress() { return { ok: false, kind: "network" }; } };
  const st = mem(); const sy = mkSync(st, api);
  capture(); const r1 = await sy.sendCode("new@example.com", TOKEN_A); const r0 = await sy.sendCode("new@example.com"); release();
  check("D sync 带令牌：把邮箱和令牌原样交给 api；旧调用（无令牌）只传邮箱一个参数，形状不变", r1.ok && r0.ok && JSON.stringify(calls) === JSON.stringify([["new@example.com", TOKEN_A], ["new@example.com"]]), JSON.stringify(calls));
  const dump = [...st._m.values()].join("\n") + JSON.stringify(sy.status()) + JSON.stringify(r1) + JSON.stringify(r0);
  check("D 令牌没有被保存：存储里、同步状态里、返回值里都找不到", !dump.includes(TOKEN_A), [...st._m.keys()].join(","));
  check("D 令牌没有被主动输出到日志（console.log / error / warn）", !logs.join("\n").includes(TOKEN_A));
}
{ // E 隔离与冷却：被拦下时不发请求
  const calls = [];
  const api = {
    async sendCode(...a) { calls.push(a); return { ok: true }; },
    async verifyCode(email) { return { ok: true, session: sess("u1", email) }; },
    async refresh() { return { ok: true, session: sess() }; }, async signOut() { return { ok: true }; },
    async getProgress() { return { ok: true, row: null }; }, async createProgress() { return { ok: true, rev: 1 }; }, async saveProgress() { return { ok: true, rev: 2 }; },
  };
  const st = mem();
  const doc = emptyDoc({ gen: 1, lineage: "L-u1" }); doc.done = { U1L1: "2026-11-01" };
  saveAccount(st, "u1", { doc, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: NOW }); setCurrentAccount(st, "u1");
  const sy = mkSync(st, api);
  const v = await sy.verify("a@example.com", "123456", freshState());
  const logged = v.needChoice ? await sy.finishChoice("cloud") : v;
  const before = calls.length;
  const same = await sy.sendCode("a@example.com", TOKEN_A);
  const blocked = await sy.sendCode("other@example.com", TOKEN_A);
  check("E 前提：本机已登录 A（登录成功）", logged.ok === true, JSON.stringify(logged));
  check("E 账号隔离：已登录 A，用 B 的邮箱带令牌发验证码 → other-account，api 零次调用", blocked.ok === false && blocked.kind === "other-account" && calls.length === before + 1 && calls.slice(before).every((c) => c[0] === "a@example.com"), JSON.stringify({ blocked, calls }));
  check("E 对照：同一个账号（A 自己的邮箱）带令牌仍能发（令牌随调用传到 api）", same.ok === true && calls[before][1] === TOKEN_A, JSON.stringify(calls));
}
{
  const calls = []; const clock = { t: NOW };
  const api = { async sendCode(...a) { calls.push(a); return { ok: false, kind: "rate-limit", message: "Too Many Requests" }; }, async refresh() { return { ok: true, session: sess() }; }, async signOut() { return { ok: true }; }, async getProgress() { return { ok: false, kind: "network" }; } };
  const sy = mkSync(mem(), api, { now: () => clock.t });
  const a = await sy.sendCode("c@example.com", TOKEN_A);
  const b = await sy.sendCode("c@example.com", TOKEN_B);
  check("E 冷却：第一次被限流后，冷却期内带新令牌再发 → 仍是 rate-limit，api 只被调用 1 次（令牌 B 没有发出去）", a.kind === "rate-limit" && b.kind === "rate-limit" && calls.length === 1 && calls[0][1] === TOKEN_A, JSON.stringify(calls));
  clock.t += 60_000;
  await sy.sendCode("c@example.com", TOKEN_B);
  check("E 冷却过后：新的调用带新的令牌 B（不是上一次的 A）", calls.length === 2 && calls[1][1] === TOKEN_B, JSON.stringify(calls));
}
{ // F sync 层超时：不自动重发
  const calls = [];
  const api = { async sendCode(...a) { calls.push(a); return { ok: false, kind: "network", timedOut: true, message: "网络连不上" }; }, async refresh() { return { ok: true, session: sess() }; }, async signOut() { return { ok: true }; }, async getProgress() { return { ok: false, kind: "network" }; } };
  const timers = []; const sy = mkSync(mem(), api, { schedule: (fn, ms) => { timers.push(ms); return 0; } });
  const r = await sy.sendCode("t@example.com", TOKEN_A);
  await new Promise((ok) => setTimeout(ok, 50));
  check("F sync 收到超时：原样返回，api 只调用 1 次，没有安排任何自动重发", r.kind === "network" && r.timedOut === true && calls.length === 1 && timers.length === 0, JSON.stringify({ calls, timers }));
}
const pass = results.filter(Boolean).length;
console.log(`\n共 ${results.length} 项，失败 ${results.length - pass} 项`);
process.exit(pass === results.length ? 0 : 1);
