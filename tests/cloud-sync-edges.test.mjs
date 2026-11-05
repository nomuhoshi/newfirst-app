// 登录与同步系统高危边缘场景（网络 / 存储 / 生命周期 / 双标签并发）。纯 Node。
// 运行：node tests/cloud-sync-edges.test.mjs
// Case 9 / 10 的靶点在 data-compat-edges.test.mjs；本文件 Case 1 为双标签并发刷新+保存。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { emptyDoc, docToState, sumXp } from "../src/account-data.js";
import { saveAccount, setCurrentAccount, loadAccount, DEVICE_KEY } from "../src/account-store.js";
import { freshState } from "../src/storage.js";

const results = [];
const expectedRed = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, expectedRed: false });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};
const checkRed = (name, ok, detail = "") => {
  // 预期红灯靶点：失败记为 expected-red（不拖垮退出码）；意外转绿也记下来。
  results.push({ name, ok: !!ok, expectedRed: true });
  expectedRed.push({ name, passed: !!ok });
  const tag = ok ? "✅ (unexpected green)" : "🔴 expected-red";
  console.log(`${tag} ${name}${detail ? "  — " + detail : ""}`);
};

const NOW = 1_000_000;
const TODAY = "2026-11-05";
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
  console.log("=== 网络、存储与生命周期边界测试 ===\n");

  // ---------- Case 1: 双标签并发 refresh + save（仿 cloud-sync-tabs / cloud-sync 并发）----------
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
    // 令牌快过期，同步前会 refresh
    storage.setItem(AUTH_KEY, JSON.stringify({ session: { ...sess("old"), expiresAt: NOW + 1000 } }));
    const opts = { storage, api, now: () => NOW, today: () => TODAY, schedule: () => 0 };
    const A = createSync(opts), B = createSync(opts);
    A.restore(freshState()); B.restore(freshState());

    // A 卡在读云端；B 本机学完新关并开始同步；再放行 A
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
      pLocal.ok && rA.ok && rB.ok && finalXp === 50 && localXp === 50,
      `cloud=${finalXp} local=${localXp} rA=${JSON.stringify(rA)} rB=${JSON.stringify(rB)}`,
    );
  }

  // ---------- Case 2: 同步进行中产生的本地新进度不丢 ----------
  {
    const localDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    localDoc.xp.devEdge = 40;
    localDoc.runs.devEdge = 2;
    localDoc.done = { U1L1: "2026-11-01" };
    const { sync, api, storage } = setup({
      doc: localDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    // 云端是旧空/少内容，迫使走 saveProgress
    api.getProgress = async () => ({
      ok: true,
      row: { doc: emptyDoc({ gen: 1, lineage: "L-edge" }), rev: 1 },
    });
    let release;
    let saves = 0;
    api.saveProgress = async (_s, _expected, _doc) => {
      saves++;
      if (saves === 1) {
        await new Promise((r) => { release = r; });
        return { ok: true, rev: 2 };
      }
      return { ok: true, rev: 2 + saves }; // 后续轮次不再挂起
    };
    const syncPromise = sync.syncNow();
    // 等到第一次 saveProgress 真正挂起
    for (let i = 0; i < 20 && !release; i++) await new Promise((r) => setImmediate(r));
    if (!release) throw new Error("Case 2: saveProgress 未挂起");
    const mid = docToState(loadAccount(storage, "u1", { now: NOW }).copy.doc, freshState(), NOW);
    mid.onboarded = true; mid.xp += 20; mid.done.U1L2 = true; mid.lessonsCompleted += 1; mid.lastDay = TODAY;
    sync.persistLocal(mid);
    release();
    await syncPromise;
    // 再跑一轮把同步中学的内容补上传
    await sync.syncNow();
    const local = loadAccount(storage, "u1", { now: NOW }).copy;
    const st = sync.status();
    check(
      "Case 2: 同步中产生的本地新进度不丢失，且能触发后续同步",
      local && sumXp(local.doc) >= 60 && (local.dirty.content === true || st.pending === true || st.status === "synced"),
      `xp=${local ? sumXp(local.doc) : "?"} dirty=${JSON.stringify(local?.dirty)} status=${JSON.stringify(st)}`,
    );
  }

  // ---------- Case 3: 存储写满 ----------
  {
    const { sync, storage } = setup();
    storage.setItem(DEVICE_KEY, "devEdge"); // 保证读设备号不触发写
    const realSet = storage.setItem.bind(storage);
    storage.setItem = (k, v) => {
      if (String(k).startsWith("suipian.acct.")) throw new Error("QuotaExceededError");
      return realSet(k, v);
    };
    const r = sync.persistLocal({ ...freshState(), onboarded: true, xp: 10, lessonsCompleted: 1, done: { U1L1: true } });
    check(
      "Case 3: 存储容量满时，persistLocal 优雅返回 false，不抛错",
      r.ok === false && r.message === "无法保存到本机",
      JSON.stringify(r),
    );
  }

  // ---------- Case 5: 连续被抢先 5 次中止 ----------
  {
    const localDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    localDoc.xp.devEdge = 10;
    const { sync, api } = setup({
      doc: localDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
    });
    let tries = 0;
    api.getProgress = async () => ({
      ok: true,
      row: { doc: emptyDoc({ gen: 1, lineage: "L-edge" }), rev: 1 },
    });
    api.saveProgress = async () => { tries++; return { ok: true, rev: null }; };
    const r = await sync.syncNow();
    check(
      "Case 5: 连续被抢先 5 次后中止并返回 server 错误，避免死循环",
      tries === 5 && r.ok === false && /冲突太多次/.test(r.message || ""),
      `tries=${tries} ${JSON.stringify(r)}`,
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

  // ---------- Case 7: signOut 失败不锁死本机 ----------
  {
    const { sync, api, storage } = setup();
    api.signOut = async () => { throw new Error("500 Internal Server Error"); };
    const r = await sync.logout();
    check(
      "Case 7: 服务端 signOut 失败，不阻碍本机销毁凭证与副本",
      r.ok === true && sync.account() === null && storage.getItem(AUTH_KEY) === null,
      JSON.stringify({ r, account: sync.account(), auth: storage.getItem(AUTH_KEY) }),
    );
  }

  // ---------- Case 8: 删号后 storage.removeItem 异常，内存仍重置 ----------
  {
    const { sync, storage } = setup();
    storage.removeItem = () => { throw new Error("Disk Fail"); };
    const r = await sync.deleteAccount();
    check(
      "Case 8: 删号成功后即便 storage.removeItem 异常，内存状态仍重置为游客",
      r.ok === true && sync.account() === null && sync.status().status === null,
      JSON.stringify({ r, account: sync.account(), status: sync.status() }),
    );
  }

  const hardFail = results.filter((r) => !r.ok && !r.expectedRed).length;
  const softRed = results.filter((r) => !r.ok && r.expectedRed).length;
  const pass = results.filter((r) => r.ok).length;
  console.log(`\n完成：${results.length} 项，通过 ${pass}，硬失败 ${hardFail}，expected-red ${softRed}`);
  process.exit(hardFail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
