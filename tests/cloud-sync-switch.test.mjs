// 切换 Supabase 项目（测试库 ↔ 正式库）后的数据隔离：旧存档原样留在本机 → 同邮箱重新登录只加载新项目自己的进度 → 旧进度绝不上传到新项目、旧副本绝不被删；换邮箱仍要先退出；强制退出不删本机副本。纯 Node。
// 假服务器和辅助函数与 cloud-sync.test.mjs 相同（那个文件一导入就会跑测试，所以这里复制了一份）。
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { freshState, bumpStreak, loseHeart } from "../src/storage.js";
import { docToState, sumXp, newId } from "../src/account-data.js";
import { GUEST_KEY, loadAccount, getCurrentAccount } from "../src/account-store.js";

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
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", TEST = "abcdefgh.supabase.co";
// 同一台设备（同一份浏览器存储）接不同项目的服务器：每次“重新打开应用”就是新建一个 sync
function open(storage, server, projectId, state = freshState()) {
  const dev = { storage, offline: false, state, timers: [] };
  const api = server.apiFor(dev);
  dev.sync = createSync({ storage, api, projectId, legacyProject: PROD, schedule: (fn, ms) => { dev.timers.push({ fn, ms }); return dev.timers.length; }, today: () => TODAY, onState: (doc) => { dev.state = docToState(doc, dev.state); } });
  const r = dev.sync.restore(dev.state);
  if (r) dev.state = r.state;
  return dev;
}
function finishLesson(dev, id, xp = 20) { const s = dev.state; s.xp += xp; s.done[id] = true; s.lessonsCompleted++; bumpStreak(s, new Date(TODAY + "T12:00:00")); return dev.sync.persistLocal(s); }
async function login(dev, email, choice = null) {
  const v = await dev.sync.verify(email, "123456", dev.state);
  if (!v.ok) return v;
  const r = v.needChoice ? await dev.sync.finishChoice(choice) : v;
  if (r.ok && r.state) dev.state = r.state;
  return r;
}
const rowOf = (server, email) => server.rows.get(server.users.get(email));

const view = (st, proj) => scopedStorage(st, projectNamespace(proj, PROD));
const copyOf = (st, proj, uid) => loadAccount(view(st, proj), uid, { now: Date.now() }).copy;
const snap = (st) => JSON.stringify([...st._m.entries()].sort());
function prodSetup() { const prod = fakeServer(), test = fakeServer(), st = fakeStorage(); return { prod, test, st, d1: open(st, prod, PROD) }; }

// ---------- 1. 旧凭证还在（同一个项目重新打开）：照常登录，什么都不变 ----------
{
  const { prod, st, d1 } = prodSetup();
  await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); finishLesson(d1, "U1L2", 20); await d1.sync.syncNow();
  const raw = JSON.parse(st.getItem(AUTH_KEY)); delete raw.project; st.setItem(AUTH_KEY, JSON.stringify(raw)); // 旧版本留下的凭证：没有项目标记
  const d2 = open(st, prod, PROD);
  check("场景1 旧凭证还在：同一个项目重新打开，仍是登录状态，不用重新登录", d2.sync.account() !== null && d2.sync.status().status !== "need-login" && st.getItem(AUTH_KEY) !== null);
  check("场景1 进度原样（40 XP、两关），云端也没变", d2.state.xp === 40 && d2.state.done.U1L2 && sumXp(rowOf(prod, "me@x.com").doc) === 40);
}

// ---------- 2. 改接新项目：旧凭证、旧副本原样留着但不可见；同邮箱登录后只有新项目自己的进度 ----------
{
  const { prod, test, st, d1 } = prodSetup();
  await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); finishLesson(d1, "U1L2", 20); await d1.sync.syncNow();
  const oldUid = d1.sync.account().userId;
  const guestRaw = JSON.stringify({ ...freshState(), xp: 7 }); st.setItem(GUEST_KEY, guestRaw);
  const before = snap(st);

  const d2 = open(st, test, TEST);
  check("场景2 改接测试库：看不到正式版的账号，是游客状态（没有旧凭证可用）", d2.sync.account() === null && d2.state.xp === 0);
  check("场景2 打开测试库入口没有改动任何存储", snap(st) === before);

  const re = await login(d2, "me@x.com", "cloud"); // 游客记录原样保留（选“用云端 / 新账号”）
  check("场景2 同一个邮箱在测试库登录成功", re.ok === true, JSON.stringify(re).slice(0, 100));
  check("场景2 只显示新项目自己的进度：0 XP、没有旧项目的关卡", d2.state.xp === 0 && !d2.state.done.U1L1 && !d2.state.done.U1L2, String(d2.state.xp));
  const row = rowOf(test, "me@x.com");
  check("场景2 旧进度没有上传到新项目", !row || sumXp(row.doc) === 0, JSON.stringify(row && row.doc.xp));
  const after = JSON.parse(snap(st)).filter(([k]) => !k.startsWith("proj:"));
  const beforeOld = JSON.parse(before);
  check("场景2 正式版的键（当前账号、副本、凭证、游客记录）逐字没变；新增的只有带项目前缀的键和设备/游客编号", beforeOld.every(([k, v]) => st.getItem(k) === v) && st.getItem(GUEST_KEY) === guestRaw);
  check("场景2 新项目的账号数据在带前缀的键里", [...st._m.keys()].some((k) => k.startsWith(`proj:${TEST}:suipian.acct.`)) && getCurrentAccount(view(st, TEST)) === d2.sync.account().userId && getCurrentAccount(st) === oldUid);
  check("场景2 正式库的数据一点没动", sumXp(rowOf(prod, "me@x.com").doc) === 40 && prod.rows.size === 1);
  finishLesson(d2, "U1L3", 20); await d2.sync.syncNow();
  check("场景2 之后学习只同步到测试库（20 XP），正式库仍是 40", sumXp(rowOf(test, "me@x.com").doc) === 20 && sumXp(rowOf(prod, "me@x.com").doc) === 40);
  // 回到正式入口：原来的登录还在，进度原样
  const d3 = open(st, prod, PROD, freshState());
  check("场景2 回到正式入口：仍是原来的账号，40 XP、两关", d3.sync.account()?.userId === oldUid && d3.state.xp === 40 && d3.state.done.U1L2 && !d3.state.done.U1L3);
}

// ---------- 3. 回归：两个项目的用户 ID 相同，新项目已有自己的进度 ----------
{
  const { prod, test, st, d1 } = prodSetup();
  await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); finishLesson(d1, "U1L2", 20); await d1.sync.syncNow();
  const uid = d1.sync.account().userId;
  test.users.set("me@x.com", uid); // 新项目里同一个邮箱碰巧是同一个用户 ID（比如从同一份数据恢复出来的）
  const other = open(fakeStorage(), test, TEST); await login(other, "me@x.com");
  finishLesson(other, "U1L5", 50); await other.sync.syncNow();
  check("准备：两个项目里用户 ID 相同；测试库里该账号已有自己的 50 XP", other.sync.account().userId === uid && sumXp(rowOf(test, "me@x.com").doc) === 50 && sumXp(rowOf(prod, "me@x.com").doc) === 40);
  const oldKey = [...st._m.keys()].find((k) => k === "suipian.acct." + uid); const oldRaw = st.getItem(oldKey);
  const before = snap(st);
  const d2 = open(st, test, TEST);
  check("场景3 打开测试库入口：没有套用同 ID 的正式版本机副本", d2.sync.account() === null && d2.state.xp === 0);
  const re = await login(d2, "me@x.com");
  check("场景3 登录后只显示新项目自己的进度：50 XP、U1L5；没有旧项目的 U1L1/U1L2，也不是 90", re.ok && d2.state.xp === 50 && d2.state.done.U1L5 && !d2.state.done.U1L1 && !d2.state.done.U1L2, String(d2.state.xp));
  await d2.sync.syncNow();
  check("场景3 测试库仍是 50 XP：旧进度没被并进去", sumXp(rowOf(test, "me@x.com").doc) === 50);
  check("场景3 旧项目的本机副本原样保留（逐字相同）", st.getItem(oldKey) === oldRaw && JSON.parse(before).every(([k, v]) => st.getItem(k) === v));
  check("场景3 正式库没动", sumXp(rowOf(prod, "me@x.com").doc) === 40);
  check("场景3 两份本机副本各在各的键里", copyOf(st, PROD, uid).doc.xp && sumXp(copyOf(st, PROD, uid).doc) === 40 && sumXp(copyOf(st, TEST, uid).doc) === 50);
}

// ---------- 4. 强制退出不删本机副本 ----------
{
  const S = fakeServer(), st = fakeStorage();
  const d = open(st, S, TEST); await login(d, "me@x.com"); finishLesson(d, "U1L1", 20); await d.sync.syncNow();
  const uid = d.sync.account().userId;
  finishLesson(d, "U1L2", 20); d.offline = true;
  const lo = await d.sync.logout();
  check("有没上传的内容：普通退出被拒绝", lo.ok === false && lo.pending === true);
  const lf = await d.sync.logout({ force: true });
  check("强制退出：回到游客，但本机副本还在", lf.ok && d.sync.account() === null && copyOf(st, TEST, uid) !== null);
  d.offline = false;
  const d2 = open(st, S, TEST, freshState());
  const re = await login(d2, "me@x.com");
  check("同一个账号重新登录：没上传的那一关接着上传（40 XP）", re.ok && d2.state.xp === 40 && sumXp(rowOf(S, "me@x.com").doc) === 40);
}

// ---------- 5. 正式站重新打开不受影响 ----------
{
  const prod = fakeServer(), st = fakeStorage();
  const d1 = open(st, prod, PROD); await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); await d1.sync.syncNow();
  const d2 = open(st, prod, PROD);
  check("正式站重新打开：没标项目的旧凭证继续有效，不用重新登录", d2.sync.status().status === "pending" || d2.sync.status().status === "syncing", String(d2.sync.status().status));
}
// ---------- 6. 退出时不误报“有进度还没上传” ----------
{
  const S = fakeServer(), st = fakeStorage();
  const d = open(st, S, PROD); await login(d, "me@x.com"); finishLesson(d, "U1L1", 20); await d.sync.syncNow();
  const d2 = open(st, S, PROD); d2.offline = true; // 重新打开页面（离线），没有任何新学习
  const lo = await d2.sync.logout();
  check("打开页面没学新东西、离线时退出：直接退出，不弹“有进度还没上传”", lo.ok === true && d2.sync.account() === null, JSON.stringify(lo));
  // 令牌失效（需要重新登录）也一样
  const d3 = open(st, S, PROD); await login(d3, "me@x.com"); await d3.sync.syncNow();
  st.removeItem(AUTH_KEY);
  const d4 = open(st, S, PROD);
  const st4 = d4.sync.status().status;
  const lo4 = await d4.sync.logout();
  check("没有登录凭证（需要重新登录）、没学新东西时退出：直接退出", st4 === "need-login" && lo4.ok === true, st4 + " " + JSON.stringify(lo4));
  // 真有没上传的内容：照常提示
  const d5 = open(st, S, PROD); await login(d5, "me@x.com"); finishLesson(d5, "U1L2", 20); d5.offline = true;
  const lo5 = await d5.sync.logout();
  check("真有没上传的新学习（离线）：仍然提示，不静默丢", lo5.ok === false && lo5.pending === true);
  const d6 = open(st, S, PROD); d6.offline = true;
  check("重新打开后（还没上传）再退出：仍然提示", (await d6.sync.logout()).pending === true);
}
const pass = results.filter(Boolean).length;
console.log(`\n切换项目：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
