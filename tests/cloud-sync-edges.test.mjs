// 登录与同步系统高危边缘场景（网络 / 存储 / 生命周期 / 双标签并发）。纯 Node。
// 运行：node tests/cloud-sync-edges.test.mjs
// 返工口径（产品官 2026-11-05）：Case 7/8 按目标行为断言；未实现标 expected-red(DB-3)，禁止把危险行为判绿。
// Case 9/10 在 data-compat-edges.test.mjs。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { emptyDoc, docToState, sumXp } from "../src/account-data.js";
import { saveAccount, setCurrentAccount, loadAccount, DEVICE_KEY } from "../src/account-store.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, kind: "pass-or-hard" });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};
const checkRed = (name, ok, detail = "") => {
  // 预期红灯靶点（DB-2/DB-3）：失败 = expected-red，不拖垮退出码；意外转绿也记录。
  // 软红绝不计入「全绿」。
  results.push({ name, ok: !!ok, kind: "expected-red" });
  const tag = ok ? "✅ unexpected-green (DB fix landed?)" : "🔴 expected-red";
  console.log(`${tag} ${name}${detail ? "  — " + detail : ""}`);
};

const NOW = 1_000_000;
const TODAY = "2026-11-05";
const ACCT_KEY = "suipian.acct.u1";
const sess = (tag = "at1") => ({
  userId: "u1", accessToken: tag, refreshToken: "rt-" + tag, expiresAt: NOW + 1_000_000, email: "a@b.c",
});

function mem() {
  const m = new Map();
  return {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
  };
}

function seedLoggedIn(storage, { doc = null, base = 1, dirty = null } = {}) {
  const d = doc || emptyDoc({ gen: 1, lineage: "L-edge" });
  const dirt = dirty || { hearts: false, prefs: false, content: false };
  storage.setItem(DEVICE_KEY, "devEdge");
  saveAccount(storage, "u1", { doc: d, base, dirty: dirt }, { now: NOW });
  setCurrentAccount(storage, "u1");
  storage.setItem(AUTH_KEY, JSON.stringify({ session: sess() }));
  return d;
}

function setup({ doc, base, dirty } = {}) {
  const storage = mem();
  const timers = [];
  seedLoggedIn(storage, { doc, base, dirty });
  const api = {
    async refresh() { return { ok: true, session: sess("at2") }; },
    async getProgress() { return { ok: true, row: { doc: emptyDoc({ gen: 1, lineage: "L-edge" }), rev: 1 } }; },
    async createProgress() { return { ok: true, rev: 1 }; },
    async saveProgress() { return { ok: true, rev: 2 }; },
    async signOut() { return { ok: true }; },
    async deleteAccount() { return { ok: true }; },
  };
  const sync = createSync({
    storage, api, now: () => NOW, today: () => TODAY,
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  });
  sync.restore(freshState());
  return { storage, api, sync, timers };
}

(async function run() {
  console.log("=== 网络、存储与生命周期边界测试（返工版）===\n");

  // ---------- Case 1: 双标签并发 refresh + save ----------
  {
    const storage = mem();
    const cloudDoc = emptyDoc({ gen: 1, lineage: "L-tabs" });
    cloudDoc.xp.devEdge = 20;
    cloudDoc.runs.devEdge = 1;
    cloudDoc.done = { U1L1: "2026-11-01" };
    let rev = 1;
    const row = () => ({ doc: JSON.parse(JSON.stringify(cloudDoc)), rev });
    let holdGet = null;
    const api = {
      async refresh(s) {
        return { ok: true, session: { ...sess("ref"), refreshToken: "rt-new-" + Date.now(), accessToken: "at-new", expiresAt: NOW + 3_600_000, userId: s.userId, email: s.email } };
      },
      async getProgress() {
        if (holdGet) await holdGet;
        return { ok: true, row: row() };
      },
      async createProgress(_s, doc) {
        Object.assign(cloudDoc, JSON.parse(JSON.stringify(doc)));
        rev = 1;
        return { ok: true, rev };
      },
      async saveProgress(_s, expected, doc) {
        if (expected !== rev) return { ok: true, rev: null };
        Object.assign(cloudDoc, JSON.parse(JSON.stringify(doc)));
        rev++;
        return { ok: true, rev };
      },
      async signOut() { return { ok: true }; },
      async deleteAccount() { return { ok: true }; },
    };
    seedLoggedIn(storage, {
      doc: (() => { const d = emptyDoc({ gen: 1, lineage: "L-tabs" }); d.xp.devEdge = 20; d.runs.devEdge = 1; d.done = { U1L1: "2026-11-01" }; return d; })(),
      base: 1,
      dirty: { hearts: false, prefs: false, content: false },
    });
    storage.setItem(AUTH_KEY, JSON.stringify({ session: { ...sess("old"), expiresAt: NOW + 1000 } }));
    const opts = { storage, api, now: () => NOW, today: () => TODAY, schedule: () => 0 };
    const A = createSync(opts), B = createSync(opts);
    A.restore(freshState()); B.restore(freshState());

    let release;
    holdGet = new Promise((r) => { release = r; });
    const pA = A.syncNow();
    await new Promise((r) => setImmediate(r));
    const stB = { ...docToState(loadAccount(storage, "u1", { now: NOW }).copy.doc, freshState(), NOW), onboarded: true };
    stB.xp += 30; stB.done.U1L2 = true; stB.lessonsCompleted += 1; stB.lastDay = TODAY; stB.streak = 1;
    const pLocal = B.persistLocal(stB);
    holdGet = null; release();
    const rA = await pA;
    const rB = await B.syncNow();
    await A.syncNow(); await B.syncNow();
    const finalXp = sumXp(cloudDoc);
    const localXp = sumXp(loadAccount(storage, "u1", { now: NOW }).copy.doc);
    check(
      "Case 1: 双标签并发 refresh+save：两边最终都保留合并后的进度，不丢 XP",
      pLocal.ok && rA.ok && rB.ok && finalXp === 50 && localXp === 50 && !!cloudDoc.done.U1L2,
      `cloud=${finalXp} local=${localXp} done=${JSON.stringify(cloudDoc.done)}`,
    );
  }

  // ---------- Case 2: 同步中产生的本地新进度必须真正写进云端 ----------
  {
    const localDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    localDoc.xp.devEdge = 40;
    localDoc.runs.devEdge = 2;
    localDoc.done = { U1L1: "2026-11-01" };
    const { sync, api, storage } = setup({
      doc: localDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    let cloud = emptyDoc({ gen: 1, lineage: "L-edge" });
    let rev = 1;
    const savedDocs = [];
    let release;
    let saves = 0;
    api.getProgress = async () => ({ ok: true, row: { doc: JSON.parse(JSON.stringify(cloud)), rev } });
    api.saveProgress = async (_s, expected, doc) => {
      saves++;
      savedDocs.push(JSON.parse(JSON.stringify(doc)));
      if (saves === 1) {
        await new Promise((r) => { release = r; });
      }
      if (expected !== rev) return { ok: true, rev: null };
      cloud = JSON.parse(JSON.stringify(doc));
      rev++;
      return { ok: true, rev };
    };
    const syncPromise = sync.syncNow();
    for (let i = 0; i < 20 && !release; i++) await new Promise((r) => setImmediate(r));
    if (!release) throw new Error("Case 2: saveProgress 未挂起");
    const mid = docToState(loadAccount(storage, "u1", { now: NOW }).copy.doc, freshState(), NOW);
    mid.onboarded = true; mid.xp += 20; mid.done.U1L2 = true; mid.lessonsCompleted += 1; mid.lastDay = TODAY;
    sync.persistLocal(mid);
    release();
    await syncPromise;
    await sync.syncNow(); // 补传同步中学的内容
    const last = savedDocs[savedDocs.length - 1];
    const cloudXp = last ? sumXp(last) : -1;
    const hasNewLesson = !!(last && last.done && last.done.U1L2);
    check(
      "Case 2: 同步中新增进度最终写入云端（saveProgress 文档 = 60 XP 且含 U1L2）",
      !!last && cloudXp === 60 && hasNewLesson && sumXp(cloud) === 60 && !!cloud.done.U1L2,
      `saves=${saves} lastXp=${cloudXp} lastDone=${last ? JSON.stringify(last.done) : "n/a"} cloudXp=${sumXp(cloud)}`,
    );
  }

  // ---------- Case 3: 存储写满 — 旧副本逐字不变 ----------
  {
    const seedDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    seedDoc.xp.devEdge = 40;
    seedDoc.done = { U1L1: "2026-11-01" };
    const { sync, storage } = setup({
      doc: seedDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: false },
    });
    const beforeRaw = storage.getItem(ACCT_KEY);
    storage.setItem(DEVICE_KEY, "devEdge");
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      if (String(k).startsWith("suipian.acct.")) throw new Error("QuotaExceededError");
      return realSet(k, v);
    };
    const r = sync.persistLocal({
      ...freshState(), onboarded: true, xp: 99, lessonsCompleted: 9, done: { U9L9: true },
    });
    const afterRaw = storage.getItem(ACCT_KEY);
    check(
      "Case 3a: 存储容量满时，persistLocal 优雅返回 false，不抛错",
      r.ok === false && r.message === "无法保存到本机",
      JSON.stringify(r),
    );
    check(
      "Case 3b: 写入失败后旧账号副本逐字不变",
      typeof beforeRaw === "string" && beforeRaw === afterRaw,
      beforeRaw === afterRaw ? `len=${beforeRaw.length}` : `beforeLen=${beforeRaw?.length} afterLen=${afterRaw?.length}`,
    );
  }

  // ---------- Case 5: 连续被抢先 5 次 — 本机仍在、待同步、无无限重试 ----------
  {
    const localDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    localDoc.xp.devEdge = 10;
    localDoc.done = { U1L1: "2026-11-01" };
    const { sync, api, storage, timers } = setup({
      doc: localDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    let tries = 0;
    api.getProgress = async () => ({
      ok: true,
      row: { doc: emptyDoc({ gen: 1, lineage: "L-edge" }), rev: 1 },
    });
    api.saveProgress = async () => { tries++; return { ok: true, rev: null }; };
    const timersBefore = timers.length;
    const r = await sync.syncNow();
    const triesAfterFirst = tries;
    // 再给事件循环一点时间：确认没有偷偷再开一轮
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    const local = loadAccount(storage, "u1", { now: NOW }).copy;
    const st = sync.status();
    const newConflictTimers = timers.slice(timersBefore).filter((t) => t.ms > 0);
    check(
      "Case 5a: 连续被抢先 5 次后中止并返回 server 错误",
      triesAfterFirst === 5 && r.ok === false && /冲突太多次/.test(r.message || ""),
      `tries=${triesAfterFirst} ${JSON.stringify(r)}`,
    );
    check(
      "Case 5b: 冲突停止后本机进度仍在（10 XP）、仍标记待同步",
      !!local && sumXp(local.doc) === 10 && !!local.doc.done.U1L1
        && (local.dirty.content === true || st.pending === true || st.status === "error" || st.status === "pending"),
      `xp=${local ? sumXp(local.doc) : "?"} dirty=${JSON.stringify(local?.dirty)} status=${JSON.stringify(st)}`,
    );
    check(
      "Case 5c: 冲突停止后没有无限重试（tries 停在 5，未再追加冲突退避）",
      tries === 5 && newConflictTimers.length === 0,
      `tries=${tries} extraTimers=${JSON.stringify(newConflictTimers.map((t) => t.ms))}`,
    );
  }

  // ---------- Case 6: 网络超时 / 限流归类 ----------
  {
    const { sync, api, timers } = setup({
      doc: emptyDoc({ gen: 1, lineage: "L-edge" }),
      base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    api.getProgress = async () => ({ ok: false, kind: "network", message: "Timeout" });
    await sync.syncNow();
    check(
      "Case 6a: 网络超时归类为 offline，并安排退避重试 (3s)",
      sync.status().status === "offline" && timers.some((t) => t.ms === 3000),
      JSON.stringify({ status: sync.status(), timers: timers.map((t) => t.ms) }),
    );

    api.getProgress = async () => ({ ok: false, kind: "rate-limit", message: "Too Many Requests" });
    await sync.syncNow();
    check(
      "Case 6b: 限流(429) 归类为 error，不按网络退避",
      sync.status().status === "error",
      JSON.stringify(sync.status()),
    );
  }

  // ---------- Case 7: 拆「普通退出失败」vs「强制本机退出」（DB-3 靶点）----------
  // 产品口径：普通退出时 signOut 失败 → 保持登录与本机副本；
  //           只有用户明确「强制本机退出」才清凭证，并提示云端会话可能仍有效。
  {
    const { sync, api, storage } = setup({
      doc: (() => { const d = emptyDoc({ gen: 1, lineage: "L-edge" }); d.xp.devEdge = 40; return d; })(),
      base: 1,
      dirty: { hearts: false, prefs: false, content: false },
    });
    api.signOut = async () => { throw new Error("500 Internal Server Error"); };
    const beforeAuth = storage.getItem(AUTH_KEY);
    const beforeCopy = storage.getItem(ACCT_KEY);
    const r = await sync.logout(); // 普通退出
    const stayedLoggedIn =
      r.ok === false
      && sync.account() !== null
      && storage.getItem(AUTH_KEY) !== null
      && storage.getItem(ACCT_KEY) === beforeCopy;
    checkRed(
      "Case 7a [expected-red until DB-3]: 普通退出时 signOut 失败 → 保持登录与本机副本",
      stayedLoggedIn,
      `当前: r=${JSON.stringify(r)} account=${JSON.stringify(sync.account())} authCleared=${storage.getItem(AUTH_KEY) === null} copyChanged=${storage.getItem(ACCT_KEY) !== beforeCopy}`,
    );
  }
  {
    // 强制本机退出：目标 API 形态（尚未实现则红）
    // 期望：清除本机凭证/会话；返回需提示「云端会话可能仍有效」；本机未同步副本按产品规则保留或隔离。
    const { sync, api, storage } = setup({
      doc: (() => { const d = emptyDoc({ gen: 1, lineage: "L-edge" }); d.xp.devEdge = 40; return d; })(),
      base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    api.signOut = async () => { throw new Error("500 Internal Server Error"); };
    let r;
    let apiExists = typeof sync.forceLocalLogout === "function";
    if (apiExists) {
      r = await sync.forceLocalLogout();
    } else if (typeof sync.logout === "function") {
      // 探测是否已有带标志的强制本机退出；没有则记为未实现
      r = await sync.logout({ forceLocal: true, force: true });
      // 现有 force 只表示「丢弃未同步也退出」，并不保证 signOut 失败时的目标语义
      apiExists = false;
    }
    const warnsCloud =
      r && (r.cloudSessionMaybeValid === true
        || /云端会话/.test(r.message || "")
        || /cloud session/i.test(r.message || "")
        || r.warning === "cloud-session-maybe-valid");
    const clearedLocal = r && r.ok && sync.account() === null && storage.getItem(AUTH_KEY) === null;
    checkRed(
      "Case 7b [expected-red until DB-3]: 强制本机退出清凭证并提示云端会话可能仍有效",
      apiExists && clearedLocal && warnsCloud,
      apiExists
        ? `r=${JSON.stringify(r)} account=${JSON.stringify(sync.account())}`
        : "尚未实现 forceLocalLogout / 等价 API（当前 logout(force) 语义不同）",
    );
  }

  // ---------- Case 8: 删号后本机清理失败 — DB-3 目标行为（当前应红）----------
  // 禁止把「返回 ok + 内存重置」判绿。目标：记录待本机清理、禁止继续用旧令牌、旧副本隔离；不可宣称完全成功。
  {
    const { sync, api, storage } = setup({
      doc: (() => { const d = emptyDoc({ gen: 1, lineage: "L-edge" }); d.xp.devEdge = 40; return d; })(),
      base: 1,
      dirty: { hearts: false, prefs: false, content: false },
    });
    const beforeCopy = storage.getItem(ACCT_KEY);
    storage.removeItem = () => { throw new Error("Disk Fail"); };
    const r = await sync.deleteAccount();
    const st = sync.status();
    const notClaimSuccess = r.ok !== true;
    const pendingCleanup = !!(r.pendingLocalCleanup || r.kind === "local-cleanup" || st.status === "pending-local-cleanup");
    const tokenDisabled = storage.getItem(AUTH_KEY) === null || r.tokenRevokedLocally === true;
    const copyIsolated =
      storage.getItem(ACCT_KEY) === beforeCopy // 删不掉则原样保留
      || (typeof storage.getItem(ACCT_KEY + ".orphan") === "string")
      || r.copyIsolated === true;
    checkRed(
      "Case 8 [expected-red until DB-3]: 删号后本机清理失败 → 待清理/禁旧令牌/隔离副本，且不宣称成功",
      notClaimSuccess && pendingCleanup && tokenDisabled && copyIsolated,
      `当前危险行为若被判绿将被拒：r=${JSON.stringify(r)} status=${JSON.stringify(st)} auth=${storage.getItem(AUTH_KEY)} copySame=${storage.getItem(ACCT_KEY) === beforeCopy}`,
    );
  }

  const hardPass = results.filter((r) => r.kind === "pass-or-hard" && r.ok);
  const hardFail = results.filter((r) => r.kind === "pass-or-hard" && !r.ok);
  const redPass = results.filter((r) => r.kind === "expected-red" && r.ok);
  const redFail = results.filter((r) => r.kind === "expected-red" && !r.ok);
  console.log("\n—— 分类汇总（软红不计全绿）——");
  console.log(`当前通过: ${hardPass.length}`);
  hardPass.forEach((r) => console.log(`  ✅ ${r.name}`));
  console.log(`预期红(靶点): ${redFail.length} 红 + ${redPass.length} 意外转绿`);
  redFail.forEach((r) => console.log(`  🔴 ${r.name}`));
  redPass.forEach((r) => console.log(`  ✅ unexpected-green ${r.name}`));
  console.log(`硬失败: ${hardFail.length}`);
  hardFail.forEach((r) => console.log(`  ❌ ${r.name}`));
  console.log(`合计断言: ${results.length}（通过硬断言 ${hardPass.length}/${hardPass.length + hardFail.length}；软红不计入全绿）`);
  process.exit(hardFail.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
