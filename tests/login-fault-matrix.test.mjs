// 登录 / 同步故障矩阵（Node，不联网）：Gemini 2026-11-19 的 L1–L6 中能自动化的部分，加上“验证码已用掉后读云端失败”（GPT1 / 程序员 2026-11-19 的缺陷 1）。
// 假 Supabase 在 fetch 层：验证码一次性（按 GoTrue 的常见行为建模，未对真实服务验证）、按账号隔离的进度行、令牌表、可注入的故障（离线 / 503 / 401 / 挂起）。
// 运行：node tests/login-fault-matrix.test.mjs
import { createSync } from "../src/sync.js";
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
  const S = { users: new Map(), rows: new Map(), tokens: new Map(), codes: new Set(), n: 0, offline: false, rules: [], gate: null, count: {}, saveCalls: 0, log: [] };
  const mkSession = (uid, email) => { const k = ++S.n; const at = `AT-${k}`, rt = `RT-${k}`; S.tokens.set(at, uid); S.tokens.set(rt, uid); return { access_token: at, refresh_token: rt, expires_in: 3600, user: { id: uid, email } }; };
  S.issue = (code = "123456") => S.codes.add(code); // 模拟“发了一封验证码邮件”
  S.fail = (re, status, body, times = 1) => S.rules.push({ re, status, body, times });
  S.hold = (re) => { let release; const p = new Promise((r) => { release = r; }); S.gate = { re, p }; return release; };
  S.fetch = async (url, init) => {
    if (S.offline) throw new TypeError("Failed to fetch");
    const u = new URL(url), path = u.pathname, method = init.method || "GET", key = `${method} ${path}`, body = init.body ? JSON.parse(init.body) : null;
    S.count[key] = (S.count[key] || 0) + 1;
    if (S.gate && S.gate.re.test(key)) { const g = S.gate; S.gate = null; await g.p; }
    const rule = S.rules.find((r) => r.times > 0 && r.re.test(key));
    if (rule) { rule.times--; S.log.push(`${key} → ${rule.status}`); return J(rule.status, rule.body); }
    const bearer = String(init.headers?.Authorization || "").replace(/^Bearer /, "");
    const uid = S.tokens.get(bearer);
    if (path === "/auth/v1/verify") {
      if (!S.codes.has(body.token)) return J(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
      S.codes.delete(body.token); // 一次性
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
const acctKeys = (st) => [...st._m.keys()].filter((k) => k.startsWith("suipian.acct.") && !k.includes("import."));

// ===== 缺陷 1：验证码这一步成功（验证码已被用掉），随后读云端记录失败 =====
for (const [label, rule] of [["503", [503, { msg: "upstream unavailable" }]], ["403 bad_jwt", [403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT" }]]]) {
  const S = fakeCloud(), d = device(S);
  S.issue(); S.fail(/GET \/rest\/v1\/progress/, ...rule);
  const r1 = await d.sync.verify("t@x.com", "123456", d.state);
  const x1 = describeVerifyError(r1, { xp: 0 });
  check(`读云端失败（${label}）：登录没完成，结果带 stage:"read"，界面是 V5（验证码已用过、请重新发送）`, r1.ok === false && r1.stage === "read" && x1.id === "V5" && /已经用过/.test(x1.text) && /「重新发送」/.test(x1.text) && !/再点「登录」|稍后再点/.test(x1.text), JSON.stringify({ stage: r1.stage, id: x1.id }));
  check(`读云端失败（${label}）：没有留下半个登录态（无账号、无登录凭证、无账号副本）`, d.sync.account() === null && !d.storage._m.has("suipian.auth") && acctKeys(d.storage).length === 0);
  const r2 = await d.sync.verify("t@x.com", "123456", d.state);
  const x2 = describeVerifyError(r2, { xp: 0 });
  check(`按旧文案“再点登录”用同一个码：必定是“验证码错误或已过期”（V1）——所以 V5 必须叫人重新发送`, r2.ok === false && x2.id === "V1", x2.id);
  S.issue("654321"); // 用户点了“重新发送”，收到新码
  const r3 = await d.sync.verify("t@x.com", "654321", d.state);
  check(`重新发送、输入新码：登录成功（${label}）`, r3.ok === true && d.sync.account() !== null && S.count["POST /auth/v1/verify"] === 3, JSON.stringify({ ok: r3.ok }));
}
{ // 读云端限流 / 断网 / 超时：同样是 V5
  for (const [label, setup] of [["429", (S) => S.fail(/GET \/rest\/v1\/progress/, 429, { msg: "rate limit" })], ["断网", (S) => { S.offlineAfterVerify = true; }]]) {
    const S = fakeCloud(), d = device(S); S.issue();
    if (label === "断网") { const f = S.fetch; S.fetch = async (u, i) => { const r = await f(u, i); if (String(u).endsWith("/auth/v1/verify")) S.offline = true; return r; }; d.sync = createSync({ storage: d.storage, api: mkApi(S), schedule: () => 0, today: () => TODAY, now: () => d.clock }); } else setup(S);
    const r = await d.sync.verify("t@x.com", "123456", d.state);
    const x = describeVerifyError(r, { xp: 0 });
    check(`读云端失败（${label}）：同样是 V5（不是“再点一次登录”的 V3 / V2）`, r.stage === "read" && x.id === "V5", JSON.stringify({ kind: r.kind, stage: r.stage, id: x.id }));
  }
}
{ // 验证码这一步本身失败：不带 stage:"read"，验证码没被用掉的情况保持原提示
  const S = fakeCloud(), d = device(S); S.issue(); S.fail(/POST \/auth\/v1\/verify/, 500, { msg: "boom" });
  const r = await d.sync.verify("t@x.com", "123456", d.state); const x = describeVerifyError(r);
  check("对照：验证码这一步本身 500（码没用掉）→ V4，仍可再点「登录」", r.stage === "verify" && x.id === "V4" && /再点「登录」/.test(x.text), JSON.stringify({ stage: r.stage, id: x.id }));
  const r2 = await d.sync.verify("t@x.com", "123456", d.state);
  check("对照：随后同一个码再点「登录」成功", r2.ok === true);
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
  check("L5 标签 A：同步结果是失败并要求重新登录（不是静默成功 / 卡死）", r.settled && r.v.ok === false && ["need-login", "error", "offline", "pending"].includes(A.sync.status().status) && A.sync.status().status !== "synced", `status=${A.sync.status().status}`);
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
