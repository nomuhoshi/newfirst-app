// 登录 / 同步的高危边界：连续冲突、普通退出失败、强制本机退出、删号本机清理失败、429 冷却。
// 纯 Node，不联网。运行：node tests/cloud-sync-edges.test.mjs
// 口径：本文件全部是硬断言；Case 9（旧备份 gen 覆盖较新云端）依赖 item 12 / DB-3 的 rev/updated_at，
//       未在本分支实现，因此不在这里伪装成通过，留给 docs/28 的剩余阻塞清单。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { emptyDoc, docToState, sumXp } from "../src/account-data.js";
import { saveAccount, setCurrentAccount, loadAccount, getCurrentAccount, loadCleanupPending, DEVICE_KEY } from "../src/account-store.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};
const clone = (x) => JSON.parse(JSON.stringify(x));
const ACCT_KEY = "suipian.acct.u1";
const NOW0 = 1_000_000;
const TODAY = "2026-11-05";

function mem() {
  const m = new Map();
  const storage = {
    _m: m,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    restoreRemove() { storage.removeItem = (k) => { m.delete(k); }; },
  };
  return storage;
}
const sess = (tag = "at1") => ({
  userId: "u1", accessToken: tag, refreshToken: "rt-" + tag, expiresAt: NOW0 + 1_000_000, email: "a@b.c",
});

// 每个用例自己造完整数据：账号副本 + 当前账号 + 凭证 + 设备编号，不引用别的场景的文字初始态。
function seedLoggedIn(storage, { doc, base = 1, dirty = { hearts: false, prefs: false, content: false } } = {}) {
  storage.setItem(DEVICE_KEY, "devEdge");
  saveAccount(storage, "u1", { doc, base, dirty }, { now: NOW0 });
  setCurrentAccount(storage, "u1");
  storage.setItem(AUTH_KEY, JSON.stringify({ session: sess() }));
  return doc;
}
function makeApi(overrides = {}) {
  const calls = [];
  const api = {
    calls,
    async refresh(s) { calls.push("refresh"); return { ok: true, session: sess("at-refreshed") }; },
    async sendCode() { calls.push("sendCode"); return { ok: true }; },
    async verifyCode() { calls.push("verifyCode"); return { ok: true, session: sess("at-verified") }; },
    async signOut() { calls.push("signOut"); return { ok: true }; },
    async getProgress() { calls.push("getProgress"); return { ok: true, row: null }; },
    async createProgress() { calls.push("createProgress"); return { ok: true, rev: 1 }; },
    async saveProgress() { calls.push("saveProgress"); return { ok: true, rev: 2 }; },
    async deleteAccount() { calls.push("deleteAccount"); return { ok: true }; },
    ...overrides,
  };
  return api;
}
function setup({ doc, base = 1, dirty, api = makeApi(), now = () => NOW0 } = {}) {
  const storage = mem();
  const full = doc || emptyDoc({ gen: 1, lineage: "L-edge" });
  seedLoggedIn(storage, { doc: full, base, dirty });
  const timers = [];
  const sync = createSync({
    storage, api, now, today: () => TODAY,
    schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  });
  sync.restore(freshState());
  return { storage, api, sync, timers };
}

(async function run() {
  console.log("=== 登录 / 同步高危边界（硬断言）===\n");

  // ---------- Case 5：连续被抢先 5 次 ----------
  {
    const localDoc = emptyDoc({ gen: 1, lineage: "L-edge" });
    localDoc.xp.devEdge = 10;
    localDoc.done = { U1L1: "2026-11-01" };
    let cloud = emptyDoc({ gen: 1, lineage: "L-edge" });
    let tries = 0;
    const api = makeApi();
    api.getProgress = async () => ({ ok: true, row: { doc: clone(cloud), rev: 1 } });
    api.saveProgress = async () => { tries++; return { ok: true, rev: null }; };
    const { sync, storage, timers } = setup({
      doc: localDoc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
      api,
    });
    const timersBefore = timers.length;
    const r = await sync.syncNow();
    const st = sync.status();
    const local = loadAccount(storage, "u1", { now: NOW0 }).copy;
    await new Promise((res) => setImmediate(res));
    const newTimers = timers.slice(timersBefore).filter((t) => t.ms > 0);

    check("Case 5a：连续 5 次保存冲突后中止，返回 conflict", tries === 5 && r.ok === false && r.kind === "conflict", JSON.stringify({ tries, r }));
    check(
      "Case 5b：冲突停止后本机 10 XP 还在，dirty.content=true 且 pending=true（不再用 status=error 蒙混）",
      !!local && sumXp(local.doc) === 10 && local.dirty.content === true && st.pending === true,
      JSON.stringify({ xp: local && sumXp(local.doc), dirty: local?.dirty, status: st }),
    );
    check("Case 5c：冲突停止后没有自动退避定时器", tries === 5 && newTimers.length === 0, JSON.stringify(newTimers.map((t) => t.ms)));
    check("Case 5d：冲突停止后 status.autoRetry=false，状态仍是待同步（不是已同步）", st.autoRetry === false && st.status === "pending", JSON.stringify(st));

    // 能再次触发同步：修好云端写入后，用户手动再同步一次，10 XP 正常上传，dirty/pending 清掉。
    api.getProgress = async () => ({ ok: true, row: { doc: clone(cloud), rev: 1 } });
    api.saveProgress = async (_s, _expected, doc) => { cloud = clone(doc); return { ok: true, rev: 2 }; };
    const again = await sync.syncNow();
    const after = sync.status();
    check(
      "Case 5e：修好后再次触发同步成功，云端 10 XP，本机 dirty/pending 清零",
      again.ok && sumXp(cloud) === 10 && after.pending === false && after.status === "synced" && loadAccount(storage, "u1", { now: NOW0 }).copy.dirty.content === false,
      JSON.stringify({ again, xp: sumXp(cloud), status: after }),
    );
  }

  // ---------- Case 7a：普通退出时云端 signOut 失败 ----------
  {
    const doc = emptyDoc({ gen: 1, lineage: "L-edge" });
    doc.xp.devEdge = 40;
    const api = makeApi();
    api.signOut = async () => { throw new Error("500 Internal Server Error"); };
    const { sync, storage } = setup({ doc, base: 1, api });
    const beforeAuth = storage.getItem(AUTH_KEY);
    const beforeCopy = storage.getItem(ACCT_KEY);
    const r = await sync.logout();
    check(
      "Case 7a：普通退出 signOut 失败 → 仍保持登录、凭证和本机副本",
      r.ok === false && r.keptLogin === true && sync.account() !== null && storage.getItem(AUTH_KEY) === beforeAuth && storage.getItem(ACCT_KEY) === beforeCopy,
      JSON.stringify({ r, account: sync.account(), auth: storage.getItem(AUTH_KEY) === beforeAuth, copy: storage.getItem(ACCT_KEY) === beforeCopy }),
    );
  }

  // ---------- Case 7b：强制本机退出，同一账号重登后继续同步 ----------
  {
    const doc = emptyDoc({ gen: 1, lineage: "L-edge" });
    doc.xp.devEdge = 40;
    doc.runs.devEdge = 2;
    let cloud = emptyDoc({ gen: 1, lineage: "L-edge" });
    const api = makeApi();
    api.signOut = async () => { throw new Error("500 Internal Server Error"); };
    api.getProgress = async () => ({ ok: true, row: { doc: clone(cloud), rev: 1 } });
    api.saveProgress = async (_s, _expected, next) => { cloud = clone(next); return { ok: true, rev: 2 }; };
    const { sync, storage } = setup({
      doc, base: 1,
      dirty: { hearts: false, prefs: false, content: true },
      api,
    });
    const beforeCopy = storage.getItem(ACCT_KEY);
    const r = await sync.forceLocalLogout();
    check(
      "Case 7b：强制本机退出清当前账号和凭证，并提示云端会话可能仍有效",
      r.ok === true && r.cloudSessionMaybeValid === true && /云端会话/.test(r.message || "") && sync.account() === null && storage.getItem(AUTH_KEY) === null && getCurrentAccount(storage) === null,
      JSON.stringify({ r, auth: storage.getItem(AUTH_KEY), current: getCurrentAccount(storage) }),
    );
    check("Case 7b：没上传的 40 XP 本机副本原样保留（不是丢弃）", storage.getItem(ACCT_KEY) === beforeCopy && sumXp(loadAccount(storage, "u1", { now: NOW0 }).copy.doc) === 40, storage.getItem(ACCT_KEY));
    const relogin = await sync.verify("a@b.c", "123456", freshState());
    await sync.syncNow();
    check(
      "Case 7b＋10：同账号重新登录后继续上传 40 XP，云端只加一次",
      relogin.ok && relogin.state.xp === 40 && sumXp(cloud) === 40 && sync.status().status === "synced",
      JSON.stringify({ ok: relogin.ok, xp: relogin.state?.xp, cloud: sumXp(cloud), status: sync.status() }),
    );
  }

  // ---------- Case 8：删号成功但本机 removeItem 失败 ----------
  {
    const doc = emptyDoc({ gen: 1, lineage: "L-edge" });
    doc.xp.devEdge = 40;
    doc.done = { U1L1: "2026-11-01" };
    const api = makeApi();
    const { sync, storage } = setup({ doc, base: 1, api });
    const beforeCopy = storage.getItem(ACCT_KEY);
    storage.removeItem = () => { throw new Error("Disk Fail"); };
    const r = await sync.deleteAccount();
    const st = sync.status();
    const authRaw = storage.getItem(AUTH_KEY);
    const authDisabled = authRaw === null || (() => { try { return JSON.parse(authRaw).revoked === true; } catch { return false; } })();
    const marker = loadCleanupPending(storage);
    check("Case 8a：删号后本机清理失败 → 不返回 ok，明确 pendingLocalCleanup", r.ok !== true && r.accountDeleted === true && r.pendingLocalCleanup === true && r.kind === "local-cleanup", JSON.stringify(r));
    check("Case 8b：旧令牌在本机被禁用，当前账号不再恢复", r.tokenRevokedLocally === true && authDisabled && sync.account() === null && getCurrentAccount(storage) === null && st.status === null, JSON.stringify({ authRaw, account: sync.account(), current: getCurrentAccount(storage) }));
    check("Case 8c：删不掉的旧副本原样保留并记下清理待办", storage.getItem(ACCT_KEY) === beforeCopy && marker.ok && marker.record?.userId === "u1", JSON.stringify({ copySame: storage.getItem(ACCT_KEY) === beforeCopy, marker }));
    storage.restoreRemove();
    const retry = sync.retryLocalCleanup();
    check("Case 8d：恢复存储后重试清理成功，旧副本和清理待办都清掉", retry.ok === true && retry.cleaned === true && loadAccount(storage, "u1", { now: NOW0 }).copy === null && loadCleanupPending(storage).record === null, JSON.stringify(retry));
  }

  // ---------- Case 14：验证码和同步接口 429 ----------
  {
    let nowMs = NOW0;
    const api = makeApi();
    let sends = 0;
    api.sendCode = async () => { sends++; return { ok: false, kind: "rate-limit", status: 429, retryAfter: 42, message: "Too Many Requests" }; };
    const { sync } = setup({ doc: emptyDoc({ gen: 1, lineage: "L-edge" }), base: 1, api, now: () => nowMs });
    const first = await sync.sendCode("a@b.c");
    const second = await sync.sendCode("a@b.c");
    check("Case 14a：验证码 429 → 返回冷却秒数，冷却期内禁止连续重发（网络只发 1 次）", first.kind === "rate-limit" && first.retryAfter === 42 && second.kind === "rate-limit" && sends === 1, JSON.stringify({ first, second, sends }));
    nowMs += 43_000;
    api.sendCode = async () => { sends++; return { ok: true }; };
    const third = await sync.sendCode("a@b.c");
    check("Case 14b：冷却结束后才能再发；成功后重新进入 60 秒冷却", third.ok === true && sends === 2 && sync.status().sendCooldownSeconds > 0, JSON.stringify({ third, sends, cooldown: sync.status().sendCooldownSeconds }));
  }
  {
    let nowMs = NOW0;
    const api = makeApi();
    let verifies = 0;
    api.verifyCode = async () => { verifies++; return { ok: false, kind: "rate-limit", status: 429, retryAfter: 30, message: "Too Many Requests" }; };
    const { sync } = setup({ doc: emptyDoc({ gen: 1, lineage: "L-edge" }), base: 1, api, now: () => nowMs });
    const first = await sync.verify("a@b.c", "123456", freshState());
    const second = await sync.verify("a@b.c", "123456", freshState());
    check("Case 14c：校验验证码 429 → 冷却并禁止连续提交（网络只发 1 次）", first.kind === "rate-limit" && first.retryAfter === 30 && second.kind === "rate-limit" && verifies === 1, JSON.stringify({ first, second, verifies }));
  }
  {
    let nowMs = NOW0;
    const api = makeApi();
    let gets = 0;
    api.getProgress = async () => { gets++; return { ok: false, kind: "rate-limit", status: 429, retryAfter: 20, message: "Too Many Requests" }; };
    const { sync, timers } = setup({
      doc: (() => { const d = emptyDoc({ gen: 1, lineage: "L-edge" }); d.xp.devEdge = 10; return d; })(),
      base: 1,
      dirty: { hearts: false, prefs: false, content: true },
      api, now: () => nowMs,
    });
    const first = await sync.syncNow();
    const st = sync.status();
    const second = await sync.syncNow();
    check(
      "Case 14d：同步 429 → status=rate-limit、pending=true、显示冷却、不安排网络退避",
      first.kind === "rate-limit" && st.status === "rate-limit" && st.pending === true && st.syncCooldownSeconds === 20 && timers.every((t) => t.ms !== 3000),
      JSON.stringify({ first, status: st, timers: timers.map((t) => t.ms) }),
    );
    check("Case 14e：冷却期内再次同步不发请求（getProgress 仍只 1 次）", second.kind === "rate-limit" && gets === 1, JSON.stringify({ second, gets }));
    nowMs += 21_000;
    api.getProgress = async () => ({ ok: true, row: null });
    api.createProgress = async (_s, doc) => ({ ok: true, rev: 1 });
    const third = await sync.syncNow();
    check("Case 14f：冷却结束后手动同步恢复，本机 10 XP 正常上传", third.ok === true && sync.status().status === "synced", JSON.stringify({ third, status: sync.status() }));
  }

  // ---------- 场景 9：普通退出失败，显式完整数据 ----------
  {
    const storage = mem();
    const doc = emptyDoc({ gen: 1, lineage: "L-scene9" });
    doc.xp.devScene9 = 60; doc.runs.devScene9 = 3; doc.done = { U1L1: "2026-11-01" }; doc.days = ["2026-11-01"];
    saveAccount(storage, "u1", { doc, base: 4, dirty: { hearts: false, prefs: false, content: false } }, { now: NOW0 });
    setCurrentAccount(storage, "u1");
    storage.setItem(DEVICE_KEY, "devScene9");
    storage.setItem(AUTH_KEY, JSON.stringify({ session: { userId: "u1", accessToken: "scene9-at", refreshToken: "scene9-rt", expiresAt: NOW0 + 1_000_000, email: "scene9@example.com" } }));
    const beforeAuth = storage.getItem(AUTH_KEY), beforeCopy = storage.getItem(ACCT_KEY);
    const api = makeApi();
    api.signOut = async () => ({ ok: false, kind: "network", message: "断网" });
    const sync = createSync({ storage, api, now: () => NOW0, today: () => TODAY, schedule: () => 0 });
    sync.restore(freshState());
    const r = await sync.logout();
    check(
      "场景 9（完整数据独立构造）：普通退出失败保持登录 / 凭证 / 未上传副本",
      r.ok === false && sync.account()?.userId === "u1" && storage.getItem(AUTH_KEY) === beforeAuth && storage.getItem(ACCT_KEY) === beforeCopy,
      JSON.stringify(r),
    );
  }

  // ---------- 场景 11：删号成功但本机清理失败，显式完整数据 ----------
  {
    const storage = mem();
    const doc = emptyDoc({ gen: 2, lineage: "L-scene11" });
    doc.xp.devScene11 = 80; doc.runs.devScene11 = 4; doc.done = { U1L2: "2026-11-02" }; doc.days = ["2026-11-02"];
    saveAccount(storage, "u1", { doc, base: 5, dirty: { hearts: false, prefs: false, content: false } }, { now: NOW0 });
    setCurrentAccount(storage, "u1");
    storage.setItem(DEVICE_KEY, "devScene11");
    storage.setItem(AUTH_KEY, JSON.stringify({ session: { userId: "u1", accessToken: "scene11-at", refreshToken: "scene11-rt", expiresAt: NOW0 + 1_000_000, email: "scene11@example.com" } }));
    const beforeCopy = storage.getItem(ACCT_KEY);
    const api = makeApi();
    const sync = createSync({ storage, api, now: () => NOW0, today: () => TODAY, schedule: () => 0 });
    sync.restore(freshState());
    storage.removeItem = () => { throw new Error("Disk Fail"); };
    const r = await sync.deleteAccount();
    check(
      "场景 11（完整数据独立构造）：删号成功但本机清理失败 → 不宣称完全成功、旧副本保留、有清理待办",
      r.ok !== true && r.accountDeleted === true && r.pendingLocalCleanup === true && storage.getItem(ACCT_KEY) === beforeCopy && loadCleanupPending(storage).record?.userId === "u1",
      JSON.stringify(r),
    );
    storage.restoreRemove();
    check("场景 11：恢复存储后能重试清理，不把旧副本留给下一次登录", sync.retryLocalCleanup().ok === true && loadAccount(storage, "u1", { now: NOW0 }).copy === null);
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n登录/同步边缘硬断言：共 ${results.length} 项，失败 ${failed.length} 项`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
