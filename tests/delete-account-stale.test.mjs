// 删除账号的“迟到响应”隔离（Node，不联网）：删除请求发出时就绑定账号和会话所有权；每次异步返回后复查，所有权变了就不再清理本机。
// 起因（GPT1 2026-11-20 13:08 队列第 2 项，Gemini 发现 2）：A 删除请求挂起 → 本机退出 A → 登录 B 并产生未上传进度 → A 的请求返回成功，
// 请求返回后才读取“当前账号”，把 B 的本机副本、待导入记录和凭证清掉。
// 假 Supabase 在 fetch 层，可以挂起删除 / 刷新请求，之后放行成功 / 失败。
// 运行：node tests/delete-account-stale.test.mjs
import { createSync } from "../src/sync.js";
import { createAccountUi } from "../src/account-ui.js";
import { GUEST_KEY, getGuestId, savePendingImport } from "../src/account-store.js";
import { createApi } from "../src/cloud-api.js";
import { freshState, bumpStreak } from "../src/storage.js";
import { docToState, sumXp, newId, guestFingerprint } from "../src/account-data.js";

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
    if (gi >= 0) { const g = S.gates.splice(gi, 1)[0]; await g.p;
      if (g.failStatus && g.failStatus.lose) { // 服务端已经提交了删除，但响应没回来：drop = 连接断了；body = 状态码 200 但读正文失败；stall = 正文一直不来（超时）
        const uidL = S.tokens.get(String(init.headers?.Authorization || "").replace(/^Bearer /, "")); if (uidL) S.rows.delete(uidL); S.log.push(`${key} → 服务端已提交，响应丢失（${g.failStatus.lose}）`);
        if (g.failStatus.lose === "drop") throw new TypeError("Failed to fetch");
        if (g.failStatus.lose === "body") return { ok: true, status: 200, headers: { get: () => null }, text: async () => { throw new TypeError("body stream error"); } };
        return { ok: true, status: 200, headers: { get: () => null }, text: () => new Promise(() => {}) };
      }
      if (g.failStatus) { const fs = g.failStatus; S.log.push(`${key} → ${fs.status ?? fs}（挂起后放行）`); return J(fs.status ?? fs, fs.body ?? { msg: "x" }); } }
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

const DEL = /POST \/rest\/v1\/rpc\/delete_my_account/, dels = (S) => S.count["POST /rest/v1/rpc/delete_my_account"] || 0;
const unsentOf = (S, email) => S.xpOf(email);


// 删除界面回归使用真实 createAccountUi；h 展开一层，append 不展开数组。
function deleteUi(d) {
  const sheets = [], toasts = [], out = [];
  class E {
    constructor(tag, attrs = {}) { this.tag = tag; this.attrs = attrs; this.children = []; this.textContent = attrs.text || ""; this.dataset = {}; this.classList = { add() {}, remove() {} }; }
    append(...xs) { for (const x of xs) this.children.push(x instanceof E ? x : String(x)); }
  }
  const h = (tag, attrs = {}, ...children) => { const n = new E(tag, attrs); for (const c of children.flat()) if (c != null && c !== false) n.append(c); return n; };
  const find = (n, pred) => { if (Array.isArray(n)) { for (const c of n) { const r = find(c, pred); if (r) return r; } return null; } if (!(n instanceof E)) return null; return pred(n) ? n : find(n.children, pred); };
  const ui = createAccountUi({ h, button: (label, click, cls, attrs = {}) => Object.assign(h("button", { ...attrs, text: label }), { click }),
    icon: () => h("i"), api: { configured: true }, sync: d.sync, getState: () => d.state,
    showToast: x => toasts.push(x), onSwitchedOut: () => out.push(true), onSwitchedIn() {}, rerender() {},
    sheet: render => { const sheet = { closed: false }; sheet.nodes = render(() => { sheet.closed = true; }); sheets.push(sheet); return () => { sheet.closed = true; }; },
  });
  const card = ui.accountCard();
  return { toasts, out, confirm() { const open = find(card, n => Object.hasOwn(n.attrs, "data-delete-account")); if (!open) throw new Error("G12_PRECONDITION 无删除按钮"); open.click(); const confirm = find(sheets.at(-1).nodes, n => n.tag === "button" && n.textContent === "永久删除"); if (!confirm) throw new Error("G12_PRECONDITION 无永久删除确认"); return confirm.click(); } };
}
const G12_COPY = "无法确认云端是否已完成删除，本机记录未清理，请先备份学习进度。";

for (const MODE of ["无锁", "有 Web Locks"]) {
CUR_MODE = MODE;

// ===== 1. 删除请求挂起 → 本机强制退出 A → 登录（B 或再登录 A）并产生未上传进度 → 删除响应迟到（成功 / 失败） =====
for (const [who, email] of [["A→B", EMAIL_B], ["A→A", EMAIL_A]]) for (const lateFails of [false, true]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(DEL, lateFails ? 503 : null);
  const del = d.sync.deleteAccount(); await tick();               // 云端删除请求挂起
  const lo = await d.sync.forceLocalLogout();                      // 本机强制退出 A
  const v = await login(S, d, email);                              // 登录 B（或再登录 A）
  finishLesson(d, "u1-l1", 30);                                    // 新会话有 30 XP 还没上传
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d)), midAuth = authRaw(d);
  rel(); const r = await del; await tick();
  check(`1 ${who}，删除响应迟到${lateFails ? "失败（503）" : "成功"}：结果标记 stale，不清新会话的本机副本 / 待导入 / 凭证 / 账号指针（存储逐字节不变）`, lo.ok === true && v.ok === true && r.stale === true && r.superseded === true && snap(d.storage) === mid && authRaw(d) === midAuth && JSON.stringify(statusOf(d)) === midStatus && consistent(d, email), JSON.stringify([r, d.sync.account()?.email]));
  check(`1 ${who}，删除响应迟到${lateFails ? "失败" : "成功"}：结果如实说明云端${lateFails ? "没有删掉" : "已删除"}（cloudDeleted=${!lateFails}）`, r.cloudDeleted === !lateFails, JSON.stringify(r));
  const sy = await d.sync.syncNow({ manual: true });
  check(`1 ${who}，之后新会话的 30 XP 照常上传（副本没被清掉），云端 ${email} 为 30 XP`, sy.ok === true && S.xpOf(email) === 30, JSON.stringify([sy, S.xpOf(email)]));
}

// ===== 1b. 删除请求发出后响应丢了（服务端可能已提交）：结果是“未知”，不能说成“删除没有完成” =====
for (const lose of ["drop", "body", "stall"]) for (const [who, email] of [["A→B", EMAIL_B], ["A→A", EMAIL_A]]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(DEL, { lose });
  const del = d.sync.deleteAccount(); await tick();
  await d.sync.forceLocalLogout();
  const v = await login(S, d, email);
  finishLesson(d, "u1-l1", 30);
  const mid = snap(d.storage), midStatus = JSON.stringify(statusOf(d)), midAuth = authRaw(d);
  rel(); const w = await within(del, 3000); const r = w.v; await tick();
  check(`1b ${who}，服务端已提交但响应丢失（${lose}）：结果是 stale + cloudDeleted:null（未知），提示“无法确认旧账号是否已删除”，不是“删除没有完成”`, w.settled && v.ok === true && r.stale === true && r.cloudDeleted === null && /无法确认旧账号是否已删除；当前登录和本机数据未改动/.test(r.message) && !/没有完成/.test(r.message), JSON.stringify(r));
  check(`1b ${who}（${lose}）：新会话原样保留（存储逐字节不变、凭证 / 状态不变）`, snap(d.storage) === mid && authRaw(d) === midAuth && JSON.stringify(statusOf(d)) === midStatus && consistent(d, email), "");
  check(`1b ${who}（${lose}）：没有自动重删（删除接口仍只有 1 次）`, dels(S) === 1, `删除接口=${dels(S)}`);
  const sy = await d.sync.syncNow({ manual: true });
  check(`1b ${who}（${lose}）：之后新会话的 30 XP 照常上传，云端 ${email} 为 30 XP`, sy.ok === true && S.xpOf(email) === 30, JSON.stringify([sy, S.xpOf(email)]));
}

// ===== 2. 删除请求发出之前（令牌刷新期间）会话已被取代：绝不能发出删除请求（否则会拿新账号的令牌删掉新账号） =====
{
  const S = fakeCloud(); S.expiresIn = 30;                         // 令牌快过期：删除前要先刷新
  const d = device(S); await login(S, d, EMAIL_A);
  const relRf = S.hold(REFRESH);
  const del = d.sync.deleteAccount(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, EMAIL_B);
  const mid = snap(d.storage);
  relRf(); const r = await del; await tick();
  check("2 删除在等“先刷新令牌”，被取代并登录 B 后刷新回来：不发删除请求（删除接口 0 次）、不动 B 的任何东西，结果 stale", r.stale === true && dels(S) === 0 && snap(d.storage) === mid && consistent(d, EMAIL_B) && S.users.has(EMAIL_B), JSON.stringify([r, dels(S)]));
}

// ===== 3. 重复调用合并：只发一次删除请求，同一个结果 =====
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel = S.hold(DEL);
  const p1 = d.sync.deleteAccount(), p2 = d.sync.deleteAccount(); await tick();
  check("3a 删除进行中再点一次：合并成同一个调用，删除接口只有 1 次", p1 === p2 && dels(S) === 1, `删除接口=${dels(S)}`);
  rel(); const [r1, r2] = await Promise.all([p1, p2]); await tick();
  check("3b 删除成功：本机清干净（没有账号 / 凭证），两次调用拿到同一个结果；之后可再次删除（登记已释放）", r1.ok === true && r1 === r2 && consistent(d, null), JSON.stringify(r1));
  const again = await d.sync.deleteAccount();
  check("3c 已没有账号时再调用：no-account，不联网", again.ok === false && again.kind === "no-account" && dels(S) === 1);
}

// ===== 3d. 旧删除还挂着时，新会话（B 或再登录 A）自己点删除：是一次独立的删除，不能被并进旧的，也不能被旧结果带走 =====
for (const [who, email] of [["A→B", EMAIL_B], ["A→A", EMAIL_A]]) {
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const rel1 = S.hold(DEL), rel2 = S.hold(DEL);                    // 先后两个删除请求各挂一个
  const p1 = d.sync.deleteAccount(); await tick();
  await d.sync.forceLocalLogout(); await login(S, d, email);
  const p2 = d.sync.deleteAccount(); await tick();
  check(`3d ${who}：新会话的删除不并进旧删除——是另一个调用，各发一次请求（删除接口 2 次）`, p1 !== p2 && dels(S) === 2, `删除接口=${dels(S)}`);
  // 错误合并时先放行旧请求，使上面的行为断言失败后仍能收尾，避免变异靠挂起退出被误算检出。
  if (p1 === p2) rel1();
  rel2(); const r2 = await p2; await tick();
  check(`3d ${who}：新会话的删除成功，本机清干净`, r2.ok === true && consistent(d, null), JSON.stringify(r2));
  rel1(); const r1 = await p1; await tick();
  check(`3d ${who}：旧删除之后返回，只是 stale，不改已清理好的本机状态`, r1.stale === true && consistent(d, null), JSON.stringify(r1));
}

// ===== 4. 对照（原有行为不变）：没被取代时成功 / 失败 / 本机清理失败 =====
{
  const S = fakeCloud(); const d = device(S); await login(S, d, EMAIL_A);
  const r = await d.sync.deleteAccount(); await tick();
  check("4a 单次删除成功：云端记录没了，本机没有账号 / 凭证，状态为空", r.ok === true && consistent(d, null) && S.rows.size === 0 && statusOf(d).status === null, JSON.stringify(r));
  const v = await login(S, d, EMAIL_B);
  S.fail(DEL, 503, { msg: "x" }, 1);
  const f = await d.sync.deleteAccount(); await tick();
  check("4b 删除失败（503）：返回失败，仍是登录 B，凭证在，再删一次可成功", f.ok === false && !f.stale && consistent(d, EMAIL_B), JSON.stringify(f));
  const r2 = await d.sync.deleteAccount(); await tick();
  check("4c 失败之后再删一次成功（登记已释放）", v.ok === true && r2.ok === true && consistent(d, null), JSON.stringify(r2));
}

// ===== G12. 当前会话 RPC 后未知、RPC 前失败和界面专用提示 =====
for (const lose of ["drop", "body", "stall"]) {
  const S = fakeCloud(), d = await loggedInA(S); const synced = await d.sync.syncNow({ manual: true });
  check(`G12_PRECONDITION ${lose}：删除前云端已有 40 XP`, synced.ok === true && S.xpOf(EMAIL_A) === 40);
  const uid = d.sync.account().userId;
  if (lose === "body") {
    const guest = { ...freshState(), onboarded: true, xp: 20, done: { G12G: true }, lessonsCompleted: 1 };
    const raw = JSON.stringify(guest), gid = getGuestId(d.storage); d.storage.setItem(GUEST_KEY, raw);
    const saved = savePendingImport(d.storage, uid, { version: 1, userId: uid, guestId: gid.id, choice: "merge", fingerprint: guestFingerprint(guest), guestState: guest, guestRaw: raw, createdAt: d.clock });
    check("G12_PRECONDITION body：快照还包含游客记录和健康导入待办", gid.ok && saved);
  }
  const before = snap(d.storage), rel = S.hold(DEL, { lose });
  const p1 = d.sync.deleteAccount(), p2 = d.sync.deleteAccount(); await tick(); rel();
  const r = await p1; await p2;
  check(`G12_META ${lose}：RPC 后响应未知携带删除元数据，不声称失败或已删除`, p1 === p2 && r.ok === false && r.kind === "network" && r.deleteUncertain === true && r.cloudDeleted === null && r.localCleaned === false && r.retryable === false && r.message === G12_COPY, JSON.stringify(r));
  await tick();
  check(`G12_KEEP ${lose}：假服务器已提交删除，本机所有键和当前登录不变，只发一次删除`, !S.rows.has(uid) && snap(d.storage) === before && consistent(d, EMAIL_A) && dels(S) === 1 && d.state.xp === 40, JSON.stringify({ deleteCalls: dels(S), cloudHasRow: S.rows.has(uid) }));
}
for (const failure of ["offline", "timeout", "503"]) {
  const S = fakeCloud(); S.expiresIn = 30; const d = await loggedInA(S);
  const before = snap(d.storage);
  if (failure === "offline") S.offline = true;
  else if (failure === "timeout") S.timeout(REFRESH);
  else S.fail(REFRESH, 503, { msg: "refresh unavailable" });
  const r = await d.sync.deleteAccount();
  check(`G12_BEFORE ${failure}：刷新失败，删除 RPC 零次，不能标记删除结果未知`, r.ok === false && !Object.hasOwn(r, "deleteUncertain") && !Object.hasOwn(r, "cloudDeleted") && dels(S) === 0 && snap(d.storage) === before && consistent(d, EMAIL_A) && (failure !== "timeout" || r.timedOut === true), JSON.stringify(r));
}
for (const status of [403, 503]) {
  const S = fakeCloud(), d = await loggedInA(S); await d.sync.syncNow({ manual: true });
  const before = snap(d.storage); S.fail(DEL, status, { msg: "explicit rejection" });
  const r = await d.sync.deleteAccount();
  check(`G12_EXPLICIT ${status}：明确错误不标未知，不清本机，云端仍有 40 XP`, r.ok === false && r.status === status && !Object.hasOwn(r, "deleteUncertain") && S.xpOf(EMAIL_A) === 40 && snap(d.storage) === before && consistent(d, EMAIL_A), JSON.stringify(r));
}
for (const lose of ["drop", "body", "stall"]) {
  const S = fakeCloud(), d = await loggedInA(S); await d.sync.syncNow({ manual: true });
  const e = deleteUi(d), before = snap(d.storage), rel = S.hold(DEL, { lose });
  const p = e.confirm(); await tick(); rel(); await p;
  check(`G12_UI ${lose}：真实删除回调显示专用未知提示，不走已退出回调`, e.toasts.length === 1 && e.toasts[0] === G12_COPY && e.out.length === 0 && snap(d.storage) === before && consistent(d, EMAIL_A) && dels(S) === 1, JSON.stringify(e.toasts));
}
{
  const S = fakeCloud(); S.expiresIn = 30; const d = await loggedInA(S);
  const e = deleteUi(d), before = snap(d.storage); S.offline = true; await e.confirm();
  check("G12_UI_BEFORE：刷新断网只提示通用网络失败，不误报删除未知", e.toasts.length === 1 && e.toasts[0] === "网络连不上，请检查网络后重试。" && e.out.length === 0 && dels(S) === 0 && snap(d.storage) === before, JSON.stringify(e.toasts));
}
}

const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
