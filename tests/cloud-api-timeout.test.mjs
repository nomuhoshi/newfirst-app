// 云端请求的超时要覆盖“响应头 + 响应正文”全过程（GPT1 2026-11-19 验收条件 1–4 的 Node 部分）。
// 背景：旧版 cloud-api.js 的 req() 在拿到响应头后就清掉计时器，之后读正文没有任何时限；响应头到了、正文一直不来
// （弱网 / 半开连接）时，请求永远不返回，登录弹窗停在“发送中 / 登录中”、同步的 running 永远不结束。
// 全部用假 fetch / 内存里的假服务器，不联网、不碰任何真实服务。运行：node tests/cloud-api-timeout.test.mjs
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createApi } from "../src/cloud-api.js";
import { createSync } from "../src/sync.js";
import { describeSendError, describeVerifyError } from "../src/auth-errors.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 最多等 ms：返回 { settled, v }，用来区分“按时返回”和“一直挂着”
const within = (p, ms) => { let t; return Promise.race([p.then((v) => ({ settled: true, v })), new Promise((r) => { t = setTimeout(() => r({ settled: false }), ms); })]).finally(() => clearTimeout(t)); };
const T = 120;   // 测试里的请求时限（默认 15000ms）
const BOUND = 1500; // 判定“按时返回”的上限（远大于 T，远小于真实的“一直挂着”）

// ---------- 假 fetch：几种故障模式 ----------
const J = (status, body) => ({ ok: status < 400, status, headers: { get: () => null }, text: async () => JSON.stringify(body) });
// 响应头已到、正文永远不来。abortAware=false：不响应中止信号（假接口 / 个别浏览器的最坏情况）；true：真实 fetch 那样，被中止后 text() 报错
const bodyStall = (abortAware) => (_url, init) => Promise.resolve({
  ok: true, status: 200, headers: { get: () => null },
  text: () => new Promise((_, rej) => { if (abortAware) init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))); }),
});
const headersStall = () => (_url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new DOMException("aborted", "AbortError"))));
const healthy = () => async () => J(200, []); // 读进度：没有进度行 = []

const SESS = { accessToken: "AT", refreshToken: "RT", expiresAt: Date.now() + 3600000, userId: newId(), email: "t@x.com" };
const METHODS = {
  sendCode: (api) => api.sendCode("t@x.com"),
  verifyCode: (api) => api.verifyCode("t@x.com", "123456"),
  refresh: (api) => api.refresh(SESS),
  signOut: (api) => api.signOut(SESS),
  getProgress: (api) => api.getProgress(SESS),
  createProgress: (api) => api.createProgress(SESS, {}),
  saveProgress: (api) => api.saveProgress(SESS, 1, {}),
  deleteAccount: (api) => api.deleteAccount(SESS),
};
const mkApi = (CreateApi, fetchFn, timeoutMs = T) => CreateApi({ url: "https://fake.supabase.test", anonKey: "k", fetchFn, timeoutMs, isOnline: () => true });

// 用给定的 createApi 实现跑一遍“正文挂起”：返回每个方法是否按时返回了 timedOut 网络结果
async function bodyStallSweep(CreateApi, abortAware) {
  const t0 = Date.now();
  const entries = await Promise.all(Object.entries(METHODS).map(async ([name, call]) => {
    const r = await within(call(mkApi(CreateApi, bodyStall(abortAware))), BOUND);
    return [name, { settled: r.settled, ok: r.settled && r.v.ok === false && r.v.kind === "network" && r.v.timedOut === true, ms: Date.now() - t0 }];
  }));
  return Object.fromEntries(entries);
}

// ---------- 1. 验收条件 1：响应头立即返回、正文挂起 → 到时结束、返回超时结果 ----------
for (const abortAware of [false, true]) {
  const o = await bodyStallSweep(createApi, abortAware);
  const bad = Object.entries(o).filter(([, v]) => !v.ok).map(([k, v]) => `${k}(${v.settled ? "返回了别的结果" : "一直挂着"})`);
  check(`正文挂起（${abortAware ? "真实 fetch 那样响应中止信号" : "不响应中止信号"}）：8 个接口方法都在时限后返回 kind=network + timedOut=true`, bad.length === 0, bad.length ? bad.join("、") : `用时 ${Object.values(o).map((v) => v.ms).join("/")}ms，时限 ${T}ms`);
}
{
  const t0 = Date.now(); const r = await within(mkApi(createApi, headersStall()).sendCode("t@x.com"), BOUND);
  check("对照：响应头没到（原有的超时保护）仍然有效", r.settled && r.v.kind === "network" && r.v.timedOut === true, `用时 ${Date.now() - t0}ms`);
}
{
  const r = await within(mkApi(createApi, healthy()).getProgress(SESS), BOUND);
  check("对照：健康请求不受影响（结果原样返回，不带 timedOut）", r.settled && r.v.ok === true && r.v.row === null && r.v.timedOut === undefined, JSON.stringify(r.v));
  const live = process.getActiveResourcesInfo().filter((x) => x === "Timeout").length;
  check("请求正常结束后计时器被清掉（不会留下 15 秒的悬挂计时器拖住进程）", live === 0, `残留 Timeout=${live}`);
}
{
  // 正文在时限内慢慢到达：不能被误判超时
  const slow = () => async () => ({ ok: true, status: 200, headers: { get: () => null }, text: async () => { await sleep(T / 3); return JSON.stringify([]); } });
  const r = await within(mkApi(createApi, slow()).getProgress(SESS), BOUND);
  check("对照：正文比较慢但在时限内到达 → 正常成功", r.settled && r.v.ok === true && r.v.row === null, JSON.stringify(r.v));
}
{
  // 非 2xx 的错误响应：正文挂起同样走超时（不能因为有状态码就一直等）
  const err = () => async () => ({ ok: false, status: 503, headers: { get: () => null }, text: () => new Promise(() => {}) });
  const r = await within(mkApi(createApi, err()).getProgress(SESS), BOUND);
  check("503 响应头已到但正文挂起：也在时限后返回超时结果", r.settled && r.v.kind === "network" && r.v.timedOut === true, JSON.stringify(r.settled ? r.v : "挂着"));
}

// ---------- 2. 验收条件 2：发码超时 → “可能已发出，先查邮箱”；不自动重发、不误报成功 ----------
{
  let calls = 0; const f = (u, i) => { calls++; return bodyStall(false)(u, i); };
  const sync = createSync({ storage: fakeStorage(), api: mkApi(createApi, f), schedule: () => 0 });
  const r = await within(sync.sendCode("t@x.com"), BOUND);
  const d = r.settled ? describeSendError(r.v, { xp: 0 }) : null;
  check("发码正文挂起：返回超时结果（不是成功）", r.settled && r.v.ok === false && r.v.kind === "network" && r.v.timedOut === true);
  check("发码超时的界面文案：邮件可能已发出、先检查邮箱（S1b）；允许直接去输入验证码；不冷却", !!d && d.id === "S1b" && d.uncertainSent === true && /邮件可能已发出/.test(d.text) && /检查邮箱/.test(d.text) && d.cooldownMs === 0, d && d.text);
  await sleep(T * 3);
  check("不自动重发：整个过程只发出 1 次请求", calls === 1, `请求 ${calls} 次`);
  check("没有留下登录态（不误报登录成功）", sync.account() === null);
}

// ---------- 3. 验收条件 3：超时与恢复后，本机进度保留、重试不重复计分（含“云端已写入但回执丢了”） ----------
function fakeStorage() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); }, _m: m }; }
// 内存里的假 Supabase（fetch 层）：验证码 123456；进度行带版本号；可以让“某条请求处理完后，回执正文挂起”
function fakeCloud() {
  const S = { row: null, uid: newId(), saveCalls: 0, createCalls: 0, verifyCalls: 0, stall: [], log: [] };
  const done = (status, body, path, method) => {
    const i = S.stall.findIndex((m) => m.test(method + " " + path));
    if (i >= 0) { S.stall.splice(i, 1); S.log.push(`${method} ${path} → 回执正文挂起`); return { ok: status < 400, status, headers: { get: () => null }, text: () => new Promise(() => {}) }; }
    return J(status, body);
  };
  S.fetch = async (url, init) => {
    const u = new URL(url), path = u.pathname, method = init.method || "GET", body = init.body ? JSON.parse(init.body) : null;
    if (path === "/auth/v1/verify") { S.verifyCalls++; return body.token === "123456" ? done(200, { access_token: "AT-" + S.verifyCalls, refresh_token: "RT-" + S.verifyCalls, expires_in: 3600, user: { id: S.uid, email: body.email } }, path, method) : J(403, { error_code: "otp_expired", msg: "Token has expired or is invalid" }); }
    if (path === "/rest/v1/progress") return done(200, S.row ? [{ doc: S.row.doc, rev: S.row.rev }] : [], path, method);
    if (path === "/rest/v1/rpc/create_progress") { S.createCalls++; if (S.row) return done(200, null, path, method); S.row = { doc: body.new_doc, rev: 1 }; return done(200, 1, path, method); }
    if (path === "/rest/v1/rpc/save_progress") { S.saveCalls++; if (!S.row || S.row.rev !== body.expected_rev) return done(200, null, path, method); S.row = { doc: body.new_doc, rev: S.row.rev + 1 }; return done(200, S.row.rev, path, method); }
    return J(404, {});
  };
  return S;
}
const TODAY = "2026-11-03";
function device(S) {
  const dev = { storage: fakeStorage(), state: freshState() };
  dev.sync = createSync({ storage: dev.storage, api: mkApi(createApi, S.fetch), schedule: () => 0, today: () => TODAY, onState: (doc) => { dev.state = docToState(doc, dev.state); } });
  return dev;
}
const finishLesson = (dev, id, xp) => { const s = dev.state; s.xp += xp; s.done[id] = true; s.lessonsCompleted++; bumpStreak(s, new Date(TODAY + "T12:00:00")); return dev.sync.persistLocal(s); };
{
  const S = fakeCloud(), d = device(S);
  const v = await d.sync.verify("t@x.com", "123456", d.state);
  check("准备：登录成功并在云端建好进度行", v.ok === true && S.createCalls === 1 && S.row && S.row.rev === 1, JSON.stringify({ ok: v.ok, create: S.createCalls }));
  finishLesson(d, "u1-l1", 20);
  // 3a. 读云端的回执正文挂起：同步结束（不一直 syncing），本机进度还在
  S.stall.push(/GET \/rest\/v1\/progress/);
  const r1 = await within(d.sync.syncNow({ manual: true }), BOUND);
  check("同步读云端时正文挂起：按时结束，返回超时结果，状态不再是“同步中”", r1.settled && r1.v.ok === false && r1.v.kind === "network" && r1.v.timedOut === true && d.sync.status().status !== "syncing", `status=${d.sync.status().status}`);
  check("本机进度还在（20 XP、1 关），并保持“待上传”", d.state.xp === 20 && d.state.done["u1-l1"] === true && d.sync.status().status !== "synced", `xp=${d.state.xp}`);
  // 3b. 云端已经写入、但保存的回执正文挂起（最坏情况）
  S.stall.push(/POST \/rest\/v1\/rpc\/save_progress/);
  const r2 = await within(d.sync.syncNow({ manual: true }), BOUND);
  check("保存时回执正文挂起：按时结束并返回超时结果（不误报同步成功）", r2.settled && r2.v.ok === false && r2.v.timedOut === true && d.sync.status().status !== "synced", `status=${d.sync.status().status}`);
  check("此时云端其实已经写入（版本 +1），本机进度仍保留", S.row.rev === 2 && d.state.xp === 20 && sumXp(S.row.doc) === 20, `rev=${S.row.rev} 云端XP=${sumXp(S.row.doc)}`);
  // 3c. 网络恢复后再同步：成功，且不重复计分、不重复写
  const r3 = await within(d.sync.syncNow({ manual: true }), BOUND);
  check("恢复后再同步：成功（running 没有被挂起的旧请求卡住）", r3.settled && r3.v.ok === true && d.sync.status().status !== "error", JSON.stringify(r3.settled ? { ok: r3.v.ok } : "挂着"));
  check("不重复计分：云端 XP 仍是 20、本机 XP 仍是 20、没有多写一次（save 共 1 次，版本仍是 2）", sumXp(S.row.doc) === 20 && d.state.xp === 20 && S.saveCalls === 1 && S.row.rev === 2, `云端XP=${sumXp(S.row.doc)} 本机XP=${d.state.xp} save=${S.saveCalls} rev=${S.row.rev}`);
  // 3d. 再学一关：照常上传
  finishLesson(d, "u1-l2", 10);
  const r4 = await within(d.sync.syncNow({ manual: true }), BOUND);
  check("之后再学一关：正常上传（云端 30 XP，版本 3）", r4.settled && r4.v.ok === true && sumXp(S.row.doc) === 30 && S.row.rev === 3, `云端XP=${sumXp(S.row.doc)} rev=${S.row.rev}`);
}
{
  // 登录验证这一步的回执正文挂起：界面要能解除“登录中”（返回 V3），再点一次能正常登录
  const S = fakeCloud(), d = device(S);
  S.stall.push(/POST \/auth\/v1\/verify/);
  const r1 = await within(d.sync.verify("t@x.com", "123456", d.state), BOUND);
  const dv = r1.settled ? describeVerifyError(r1.v, { xp: 0 }) : null;
  check("登录验证时正文挂起：按时返回（界面可解除“登录中”），文案是 V3（网络不稳、登录没有确认）", r1.settled && r1.v.ok === false && !!dv && dv.id === "V3", dv && dv.text);
  check("此时没有留下半个登录态", d.sync.account() === null);
  const r2 = await within(d.sync.verify("t@x.com", "123456", d.state), BOUND);
  check("再点一次「登录」（这一次服务器正常）：登录成功", r2.settled && r2.v.ok === true && d.sync.account() !== null, JSON.stringify(r2.settled ? { ok: r2.v.ok, kind: r2.v.kind } : "挂着"));
}

// ---------- 4. 反向验证：把修复拿掉，上面的检查必须红 ----------
{
  const srcPath = fileURLToPath(new URL("../src/cloud-api.js", import.meta.url));
  const src = readFileSync(srcPath, "utf8");
  const dir = mkdtempSync(join(tmpdir(), "api-timeout-mut-"));
  const MUTS = [
    ["拿到响应头就清计时器（回到修复前的行为）", "      let data = null;\n", "      clearTimeout(timer);\n      let data = null;\n"],
    ["读正文不和超时赛跑", "const text = await (ctl ? Promise.race([resp.text().catch(() => \"\"), timeoutP.then(() => TIMED_OUT)]) : resp.text().catch(() => \"\"));", "const text = await resp.text().catch(() => \"\");"],
    ["正文超时不标 timedOut", "if (text === TIMED_OUT || timedOut) return netFail();", "if (text === TIMED_OUT || timedOut) return { ok: false, kind: \"network\", message: \"x\" };"],
  ];
  let i = 0;
  try {
    for (const [name, from, to] of MUTS) {
      if (!src.includes(from)) { check(`变异“${name}”：要改的片段存在`, false, from.slice(0, 50)); continue; }
      // 第 1 种变异单独处理：把第一处出现替换成 clearTimeout（"let data = null;" 在 req() 里只出现一次）
      const file = join(dir, `mut${i++}.mjs`); writeFileSync(file, src.replace(from, to));
      const M = await import(pathToFileURL(file).href);
      const o = await bodyStallSweep(M.createApi, name.startsWith("拿到响应头") ? true : false);
      const failed = Object.values(o).some((v) => !v.ok);
      check(`变异“${name}”：测试能抓到（至少一个接口方法不再按时返回 timedOut）`, failed, failed ? "已红" : "没红：测试没有覆盖到");
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

const failed = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
