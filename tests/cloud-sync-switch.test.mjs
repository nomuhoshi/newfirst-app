// 切换 Supabase 项目（测试库 ↔ 正式库）后：旧存档保留 → 同邮箱重新登录 → 新项目同步；换邮箱仍要先退出；强制退出不删本机副本。纯 Node。
// 假服务器和辅助函数与 cloud-sync.test.mjs 相同（那个文件一导入就会跑测试，所以这里复制了一份）。
import { createSync, AUTH_KEY, STALE_KEY } from "../src/sync.js";
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

// ---------- 1. 正式库里学了 40 XP（旧凭证没有项目标记）→ 测试入口改接测试库 ----------
{
  const prod = fakeServer(), test = fakeServer(), st = fakeStorage();
  const d1 = open(st, prod, PROD);
  await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); finishLesson(d1, "U1L2", 20);
  await d1.sync.syncNow();
  const oldUid = d1.sync.account().userId;
  check("准备：正式库里有这个账号 40 XP", sumXp(rowOf(prod, "me@x.com").doc) === 40);
  // 模拟旧版本留下的凭证：没有项目标记
  const raw = JSON.parse(st.getItem(AUTH_KEY)); delete raw.project; st.setItem(AUTH_KEY, JSON.stringify(raw));

  const d2 = open(st, test, TEST);
  check("改接测试库：旧凭证作废，显示需要重新登录", d2.sync.status().status === "need-login" && st.getItem(AUTH_KEY) === null);
  check("本机进度还在：40 XP、两关", d2.state.xp === 40 && d2.state.done.U1L1 && d2.state.done.U1L2);
  check("旧账号本机副本还在", loadAccount(st, oldUid, { now: Date.now() }).copy !== null);

  const other = await d2.sync.verify("other@x.com", "123456", d2.state);
  check("换成别的邮箱登录：仍要先退出（不把两个人的进度混在一起）", other.ok === false && other.kind === "other-account");
  check("被拒绝后旧副本和当前账号都没动", loadAccount(st, oldUid, { now: Date.now() }).copy !== null && getCurrentAccount(st) === oldUid);

  const re = await login(d2, "ME@X.com ".trim());
  check("同一个邮箱在测试库重新登录：成功", re.ok === true, JSON.stringify(re).slice(0, 120));
  check("新项目里创建了这个账号，XP 40、两关一个不少", test.users.has("ME@X.com") && sumXp(rowOf(test, "ME@X.com").doc) === 40 && rowOf(test, "ME@X.com").doc.done.U1L2, JSON.stringify(rowOf(test, "ME@X.com")?.doc.xp));
  check("应用里的进度没变（40 XP）", d2.state.xp === 40 && d2.state.done.U1L2);
  check("同步成功后旧账号副本被清掉，当前账号换成新项目的账号", loadAccount(st, oldUid, { now: Date.now() }).copy === null && getCurrentAccount(st) === d2.sync.account().userId && d2.sync.account().userId !== oldUid);
  check("正式库的数据一点没动", sumXp(rowOf(prod, "me@x.com").doc) === 40 && prod.rows.size === 1);
  finishLesson(d2, "U1L3", 20); await d2.sync.syncNow();
  check("之后继续学习，同步到测试库（60 XP）", sumXp(rowOf(test, "ME@X.com").doc) === 60 && sumXp(rowOf(prod, "me@x.com").doc) === 40);
  check("凭证带着测试项目标记；过渡用的标记已清除", JSON.parse(st.getItem(AUTH_KEY)).project === TEST && st.getItem(STALE_KEY) === null);
}

// ---------- 2. 上传失败（断网）：旧副本保留，不丢 ----------
{
  const prod = fakeServer(), test = fakeServer(), st = fakeStorage();
  const d1 = open(st, prod, PROD); await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 30); await d1.sync.syncNow();
  const oldUid = d1.sync.account().userId;
  const d2 = open(st, test, TEST);
  // 登录那一步要联网读取云端；断网时登录本身会失败，什么都不改
  d2.offline = true;
  const fail = await d2.sync.verify("me@x.com", "123456", d2.state);
  check("断网时登录失败：旧副本、当前账号、过渡标记都不动", fail.ok === false && loadAccount(st, oldUid, { now: Date.now() }).copy !== null && getCurrentAccount(st) === oldUid && st.getItem(STALE_KEY) !== null);
  d2.offline = false;
  // 登录成功但第一次上传失败（读云端成功、写失败）
  const api2 = test.apiFor(d2); const dev2 = { ...d2 };
  const flaky = { ...api2, async createProgress() { return { ok: false, kind: "network", message: "网络连不上" }; } };
  const sync2 = createSync({ storage: st, api: flaky, projectId: TEST, legacyProject: PROD, schedule: () => 0, today: () => TODAY });
  sync2.restore(freshState());
  const r = await sync2.verify("me@x.com", "123456", freshState());
  check("登录成功但上传失败：新账号副本里带着旧存档（待上传）", r.ok && r.state.xp === 30 && r.synced === false);
  check("上传没成功 → 旧账号副本保留", loadAccount(st, oldUid, { now: Date.now() }).copy !== null);
  const d3 = open(st, test, TEST);
  await d3.sync.syncNow();
  check("下次联网自动补传，云端 30 XP", sumXp(rowOf(test, "me@x.com").doc) === 30);
}

// ---------- 3. 强制退出不删本机副本 ----------
{
  const S = fakeServer(), st = fakeStorage();
  const d = open(st, S, TEST); await login(d, "me@x.com"); finishLesson(d, "U1L1", 20); await d.sync.syncNow();
  const uid = d.sync.account().userId;
  finishLesson(d, "U1L2", 20); d.offline = true;
  const lo = await d.sync.logout();
  check("有没上传的内容：普通退出被拒绝", lo.ok === false && lo.pending === true);
  const lf = await d.sync.logout({ force: true });
  check("强制退出：回到游客，但本机副本还在", lf.ok && d.sync.account() === null && loadAccount(st, uid, { now: Date.now() }).copy !== null);
  d.offline = false;
  const d2 = open(st, S, TEST, freshState());
  const re = await login(d2, "me@x.com");
  check("同一个账号重新登录：没上传的那一关接着上传（40 XP）", re.ok && d2.state.xp === 40 && sumXp(rowOf(S, "me@x.com").doc) === 40);
}

// ---------- 4. 云端被设为关闭的入口 / 正式站不受影响 ----------
{
  const prod = fakeServer(), st = fakeStorage();
  const d1 = open(st, prod, PROD); await login(d1, "me@x.com"); finishLesson(d1, "U1L1", 20); await d1.sync.syncNow();
  const d2 = open(st, prod, PROD);
  check("正式站重新打开：没标项目的旧凭证继续有效，不用重新登录", d2.sync.status().status === "pending" || d2.sync.status().status === "syncing", String(d2.sync.status().status));
}
const pass = results.filter(Boolean).length;
console.log(`\n切换项目：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
