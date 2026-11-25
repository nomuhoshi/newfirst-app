import assert from "node:assert/strict";
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from "../src/sync.js";
import { SESSION_KEY, GUEST_KEY, getCurrentAccount, setCurrentAccount, saveAccount, loadAccount, readGuest, loadPendingImport, savePendingImport } from "../src/account-store.js";
import { emptyDoc, guestFingerprint, sumXp } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

function makeStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    _map: m,
  };
}

function makeMockLocks() {
  const chains = new Map(), busy = new Map();
  return {
    request(name, opts, fn) {
      if (opts && opts.ifAvailable && (busy.get(name) || 0) > 0) return Promise.resolve().then(() => fn(null)); // 与真实 Web Locks 一致：ifAvailable 且锁被占着 → 回调拿到 null，不排队
      const prev = chains.get(name) || Promise.resolve();
      busy.set(name, (busy.get(name) || 0) + 1);
      const run = () => Promise.resolve().then(() => fn({ name })).finally(() => busy.set(name, busy.get(name) - 1));
      const next = prev.then(run, run);
      chains.set(name, next.catch(() => {}));
      return next;
    },
  };
}

function defer() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function makeGate(predicate) {
  return {
    predicate,
    entered: defer(),
    release: defer(),
    consumed: false,
  };
}

async function waitGateEntered(gate, ms = 3000) {
  let timer;
  try {
    return await Promise.race([
      gate.entered.promise,
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`gate entered timed out after ${ms}ms`)), ms); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

function makeCloud(getClock) {
  const rows = new Map();
  let nextSess = null;
  let refreshGate = null;
  let getGate = null;
  let deleteGate = null;
  let signOutMode = "ok";
  let deleteMode = "ok";
  return {
    rows,
    setNextSession(s) { nextSess = s; },
    setRefreshGate(g) { refreshGate = g; },
    setGetGate(g) { getGate = g; },
    setDeleteGate(g) { deleteGate = g; },
    setSignOutMode(mode) { signOutMode = mode; },
    setDeleteMode(mode) { deleteMode = mode; },
    releaseAllGates() {
      for (const g of [refreshGate, getGate, deleteGate]) {
        if (g) g.release.resolve();
      }
      refreshGate = null;
      getGate = null;
      deleteGate = null;
    },
    api: {
      async sendCode() { return { ok: true }; },
      async verifyCode() { return { ok: true, session: nextSess }; },
      async getProgress(sess) {
        if (getGate && !getGate.consumed && getGate.predicate(sess)) {
          getGate.consumed = true;
          getGate.entered.resolve(sess);
          try { await getGate.release.promise; } finally { getGate = null; }
        }
        const row = rows.get(sess.userId) || null;
        return { ok: true, row: row ? JSON.parse(JSON.stringify(row)) : null };
      },
      async createProgress(sess, doc) {
        if (rows.has(sess.userId)) return { ok: true, rev: null };
        rows.set(sess.userId, { rev: 1, doc: JSON.parse(JSON.stringify(doc)) });
        return { ok: true, rev: 1 };
      },
      async saveProgress(sess, expectedRev, doc) {
        const cur = rows.get(sess.userId);
        if (!cur || cur.rev !== expectedRev) return { ok: true, rev: null };
        const rev = cur.rev + 1;
        rows.set(sess.userId, { rev, doc: JSON.parse(JSON.stringify(doc)) });
        return { ok: true, rev };
      },
      async refresh(sess) {
        if (refreshGate && !refreshGate.consumed && refreshGate.predicate(sess)) {
          refreshGate.consumed = true;
          refreshGate.entered.resolve(sess);
          try { await refreshGate.release.promise; } finally { refreshGate = null; }
        }
        return {
          ok: true,
          session: {
            ...sess,
            accessToken: `${sess.accessToken}-refreshed`,
            refreshToken: `${sess.refreshToken}-refreshed`,
            expiresAt: getClock() + 7200_000,
          },
        };
      },
      async signOut() {
        if (signOutMode === "fail") return { ok: false, kind: "network", message: "offline" };
        return { ok: true };
      },
      async deleteAccount(sess) {
        if (deleteGate && !deleteGate.consumed && deleteGate.predicate(sess)) {
          deleteGate.consumed = true;
          deleteGate.entered.resolve(sess);
          try { await deleteGate.release.promise; } finally { deleteGate = null; }
        }
        if (deleteMode === "network") return { ok: false, kind: "network", message: "timeout" };
        if (deleteMode === "server") return { ok: false, kind: "server", message: "server error" };
        rows.delete(sess.userId);
        return { ok: true };
      },
    },
  };
}

async function runMode(withLocks) {
  const makeLocks = () => (withLocks ? makeMockLocks() : {});

  // 1. P1-1 必测：旧 A 刷新挂起 -> 另一页退出 A 并登录 B -> 旧刷新返回，B 凭证逐字节不变（同时验证 project 与 instanceId 运行时行为）
  {
    let clock = 1_000_000;
    const now = () => clock;
    const makeSess = (userId, email, tag, life = 300_000) => ({
      userId,
      email,
      accessToken: `at-${userId}-${tag}`,
      refreshToken: `rt-${userId}-${tag}`,
      expiresAt: clock + life,
    });
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const projectId = "staging.supabase.co";
    const legacyProject = "prod.supabase.co";
    const nsStorage = scopedStorage(storage, projectNamespace(projectId, legacyProject));
    let lostCount = 0;

    const tabA = createSync({ storage, api: cloud.api, projectId, legacyProject, now, retryLocks: locks, onSessionLost: () => { lostCount++; } });
    const tabB = createSync({ storage, api: cloud.api, projectId, legacyProject, now, retryLocks: locks });

    try {
      cloud.setNextSession(makeSess(U1, "u1@example.com", "a1", 300_000));
      const loginA = await tabA.verify("u1@example.com", "123456", freshState());
      assert.equal(loginA.ok, true);

      const authAfterLoginA = JSON.parse(nsStorage.getItem(AUTH_KEY));
      assert.equal(authAfterLoginA.project, projectId);
      assert.equal(typeof authAfterLoginA.instanceId, "string");
      assert.ok(authAfterLoginA.instanceId.length > 0);
      const instA = authAfterLoginA.instanceId;

      clock += 250_000;
      const normalRefreshSync = await tabA.syncNow({ manual: true });
      assert.equal(normalRefreshSync.ok, true);
      const authAfterNormalRefresh = JSON.parse(nsStorage.getItem(AUTH_KEY));
      assert.equal(authAfterNormalRefresh.instanceId, instA, "normal token refresh must preserve instanceId");
      assert.equal(authAfterNormalRefresh.session.accessToken, `at-${U1}-a1-refreshed`);

      clock += 7_150_000;
      const rGate = makeGate((s) => s.userId === U1 && s.accessToken === `at-${U1}-a1-refreshed`);
      cloud.setRefreshGate(rGate);

      const syncA = tabA.syncNow({ manual: true });
      await waitGateEntered(rGate);

      assert.ok(tabB.restore());
      const outB = await tabB.logout();
      assert.equal(outB.ok, true);
      cloud.setNextSession(makeSess(U2, "u2@example.com", "b1", 3600_000));
      const loginB = await tabB.verify("u2@example.com", "654321", freshState());
      assert.equal(loginB.ok, true);
      assert.equal(getCurrentAccount(nsStorage), U2);

      const authRawB = nsStorage.getItem(AUTH_KEY);
      const sessionRawB = nsStorage.getItem(SESSION_KEY);
      const parsedB = JSON.parse(authRawB);
      assert.equal(parsedB.session.userId, U2);
      assert.notEqual(parsedB.instanceId, instA);

      rGate.release.resolve();
      const resA = await syncA;
      assert.equal(resA.stale, true);
      assert.equal(tabA.account(), null);
      assert.equal(lostCount, 1);
      assert.equal(nsStorage.getItem(AUTH_KEY), authRawB, "B credentials in AUTH_KEY must remain byte-for-byte identical");
      assert.equal(nsStorage.getItem(SESSION_KEY), sessionRawB);
    } finally {
      cloud.releaseAllGates();
    }
  }

  // 2. P1-2 必测：旧 A 删除挂起 -> 另一页同号重登并产生 30 XP -> 旧删除返回，新凭证、指针、副本、待办全部不变，沿用 #144 stale 三态
  for (const [delMode, expectedCloudDeleted] of [["ok", true], ["network", null], ["server", false]]) {
    let clock = 2_000_000;
    const now = () => clock;
    const makeSess = (userId, email, tag) => ({
      userId,
      email,
      accessToken: `at-${userId}-${tag}`,
      refreshToken: `rt-${userId}-${tag}`,
      expiresAt: clock + 3600_000,
    });
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks });
    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    try {
      cloud.setNextSession(makeSess(U1, "u1@example.com", "old"));
      const loginOld = await tabA.verify("u1@example.com", "111111", freshState());
      assert.equal(loginOld.ok, true);
      const oldInst = JSON.parse(storage.getItem(AUTH_KEY)).instanceId;
      assert.ok(tabB.restore());

      cloud.setDeleteMode(delMode);
      const dGate = makeGate((s) => s.userId === U1 && s.accessToken === `at-${U1}-old`);
      cloud.setDeleteGate(dGate);

      const delPromise = tabA.deleteAccount();
      await waitGateEntered(dGate);

      const outOld = await tabB.forceLocalLogout();
      assert.equal(outOld.ok, true);
      cloud.setNextSession(makeSess(U1, "u1@example.com", "new"));
      const loginNew = await tabB.verify("u1@example.com", "222222", freshState());
      assert.equal(loginNew.ok, true);
      assert.equal(getCurrentAccount(storage), U1);
      const newInst = JSON.parse(storage.getItem(AUTH_KEY)).instanceId;
      assert.notEqual(newInst, oldInst);

      const saved30 = tabB.persistLocal({ ...freshState(), xp: 30, done: { "0-0": true } });
      assert.equal(saved30.ok, true);
      assert.equal(sumXp(loadAccount(storage, U1).copy.doc), 30);

      const guestSnap = { ...freshState(), xp: 30, done: { "0-0": true } };
      const guestRaw = JSON.stringify(guestSnap);
      const fp = guestFingerprint(guestSnap);
      assert.ok(fp, "guestFingerprint must succeed");
      const pendingRec = {
        version: 1,
        userId: U1,
        guestId: "guest-new-1",
        choice: "merge",
        fingerprint: fp,
        guestState: guestSnap,
        guestRaw,
        createdAt: clock,
      };
      assert.equal(savePendingImport(storage, U1, pendingRec), true, "savePendingImport must succeed with valid fingerprint");

      const snapAuth = storage.getItem(AUTH_KEY);
      const snapSession = storage.getItem(SESSION_KEY);
      const snapCopy = JSON.stringify(loadAccount(storage, U1).copy);
      const snapPending = JSON.stringify(loadPendingImport(storage, U1).record);

      dGate.release.resolve();
      const delRes = await delPromise;
      assert.equal(delRes.ok, false);
      assert.equal(delRes.stale, true);
      assert.equal(delRes.superseded, true);
      assert.equal(delRes.cloudDeleted, expectedCloudDeleted);

      assert.equal(storage.getItem(AUTH_KEY), snapAuth);
      assert.equal(storage.getItem(SESSION_KEY), snapSession);
      assert.equal(JSON.stringify(loadAccount(storage, U1).copy), snapCopy);
      assert.equal(sumXp(loadAccount(storage, U1).copy.doc), 30);
      assert.equal(JSON.stringify(loadPendingImport(storage, U1).record), snapPending);
      assert.equal(tabB.account()?.userId, U1);
    } finally {
      cloud.releaseAllGates();
    }
  }

  // 3. 路径 A：跨标签页退出后，旧标签页直接调用 persistLocal()，不得写入旧账号副本，且立即触发 onSessionLost
  {
    let clock = 3_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    let lostCount = 0;
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks, onSessionLost: () => { lostCount++; } });
    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-a", refreshToken: "rt-a", expiresAt: clock + 3600_000 });
    const loginA = await tabA.verify("u1@example.com", "123456", freshState());
    assert.equal(loginA.ok, true);
    assert.ok(tabB.restore());

    const outB = await tabB.logout();
    assert.equal(outB.ok, true);
    assert.equal(getCurrentAccount(storage), null);

    const pRes = tabA.persistLocal({ ...freshState(), xp: 99, done: { "0-0": true } });
    assert.equal(pRes.ok, false);
    assert.equal(pRes.code, "session-lost");
    assert.equal(pRes.kind, "session-lost");
    assert.equal(pRes.sessionLost, true);
    assert.equal(lostCount, 1);
    assert.equal(tabA.account(), null);
    assert.equal(loadAccount(storage, U1).copy, null);
    assert.equal(readGuest(storage).status, "none");
  }

  // 4. 路径 B：跨标签页退出后，旧标签页先调用 reconcileSession()，通知一次、内存清退、后续 persistLocal 返回 no-account 且不写存储
  {
    let clock = 3_500_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    let lostCount = 0;
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks, onSessionLost: () => { lostCount++; } });
    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-a", refreshToken: "rt-a", expiresAt: clock + 3600_000 });
    const loginA = await tabA.verify("u1@example.com", "123456", freshState());
    assert.equal(loginA.ok, true);
    assert.ok(tabB.restore());

    const outB = await tabB.logout();
    assert.equal(outB.ok, true);
    assert.equal(getCurrentAccount(storage), null);

    const recA = tabA.reconcileSession();
    assert.equal(recA.ok, false);
    assert.equal(recA.kind, "session-lost");
    assert.equal(recA.sessionLost, true);
    assert.equal(lostCount, 1);
    assert.equal(tabA.account(), null);

    const pRes = tabA.persistLocal({ ...freshState(), xp: 99, done: { "0-0": true } });
    assert.equal(pRes.ok, false);
    assert.equal(pRes.code, "no-account");
    assert.equal(lostCount, 1);
    assert.equal(loadAccount(storage, U1).copy, null);
    assert.equal(readGuest(storage).status, "none");
  }

  // 5. 同步 getProgress 在途时另一标签页强制退出（保留 U1 未上传副本）并登录 U2：迟到响应不得覆盖 U2 且保留 U1 未上传副本
  {
    let clock = 4_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const lostEvents = [];
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks, onSessionLost: (e) => lostEvents.push(e) });
    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    try {
      cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-a", refreshToken: "rt-a", expiresAt: clock + 3600_000 });
      await tabA.verify("u1@example.com", "123456", freshState());
      assert.ok(tabB.restore());

      tabA.persistLocal({ ...freshState(), xp: 40, done: { "0-0": true } });
      const gGate = makeGate((s) => s.userId === U1 && s.accessToken === "at-a");
      cloud.setGetGate(gGate);
      const syncPromise = tabA.syncNow({ manual: true });
      await waitGateEntered(gGate);

      await tabB.forceLocalLogout();
      cloud.setNextSession({ userId: U2, email: "u2@example.com", accessToken: "at-b", refreshToken: "rt-b", expiresAt: clock + 3600_000 });
      const loginU2 = await tabB.verify("u2@example.com", "654321", freshState());
      assert.equal(loginU2.ok, true);
      const authRawU2 = storage.getItem(AUTH_KEY);

      gGate.release.resolve();
      const syncRes = await syncPromise;
      assert.equal(syncRes.stale, true);
      assert.equal(tabA.account(), null);
      assert.equal(lostEvents.length, 1);
      assert.equal(getCurrentAccount(storage), U2);
      assert.equal(storage.getItem(AUTH_KEY), authRawU2);
      assert.equal(sumXp(loadAccount(storage, U1).copy.doc), 40, "unsent U1 local copy preserved by forceLocalLogout must remain intact");
    } finally {
      cloud.releaseAllGates();
    }
  }

  // 6. 同账号正常重新登录（退出后重登 & need-login 重登）与旧格式存储兼容不被误拦
  {
    let clock = 5_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const tab = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-1", refreshToken: "rt-1", expiresAt: clock + 3600_000 });
    const r1 = await tab.verify("u1@example.com", "111111", freshState());
    assert.equal(r1.ok, true);

    const out = await tab.logout();
    assert.equal(out.ok, true);
    assert.equal(tab.account(), null);

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-2", refreshToken: "rt-2", expiresAt: clock + 3600_000 });
    const r2 = await tab.verify("u1@example.com", "222222", freshState());
    assert.equal(r2.ok, true);
    assert.equal(tab.account()?.userId, U1);

    storage.removeItem(AUTH_KEY);
    const tabReload = createSync({ storage, api: cloud.api, now, retryLocks: locks });
    const restored = tabReload.restore(freshState());
    assert.equal(restored?.userId, U1);
    assert.equal(tabReload.status().status, "need-login");
    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-3", refreshToken: "rt-3", expiresAt: clock + 3600_000 });
    const r3 = await tabReload.verify("u1@example.com", "333333", freshState());
    assert.equal(r3.ok, true);
    assert.equal(tabReload.account()?.userId, U1);

    storage.setItem(AUTH_KEY, JSON.stringify({ session: { userId: U1, email: "u1@example.com", accessToken: "at-legacy", refreshToken: "rt-legacy", expiresAt: clock + 3600_000 } }));
    const tabLegacy = createSync({ storage, api: cloud.api, now, retryLocks: locks });
    const legRestored = tabLegacy.restore(freshState());
    assert.equal(legRestored?.userId, U1);
    assert.equal(tabLegacy.persistLocal({ ...freshState(), xp: 15, done: { "0-0": true } }).ok, true);
    assert.equal(sumXp(loadAccount(storage, U1).copy.doc), 15);
  }

  // 7. 登录选框挂起期间另一标签页抢先登录其他账号，迟到提交被拦截而不覆盖新账号
  {
    let clock = 6_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    storage.setItem(GUEST_KEY, JSON.stringify({ ...freshState(), xp: 30, done: { "0-0": true } }));
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks });
    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-1", refreshToken: "rt-1", expiresAt: clock + 3600_000 });
    const v1 = await tabA.verify("u1@example.com", "111111", freshState());
    assert.equal(v1.needChoice, true);

    storage.removeItem(GUEST_KEY);
    cloud.setNextSession({ userId: U2, email: "u2@example.com", accessToken: "at-2", refreshToken: "rt-2", expiresAt: clock + 3600_000 });
    const v2 = await tabB.verify("u2@example.com", "222222", freshState());
    assert.equal(v2.ok, true);
    const authRawU2 = storage.getItem(AUTH_KEY);

    const fin = await tabA.finishChoice("cloud");
    assert.equal(fin.ok, false);
    assert.equal(fin.kind, "session-changed");
    assert.equal(getCurrentAccount(storage), U2);
    assert.equal(storage.getItem(AUTH_KEY), authRawU2);
  }

  // 8. 退出自身清理阶段与跨页失权区分：signOut 失败时回滚正常恢复；已被另一标签页退出时不重复 signOut
  {
    let clock = 7_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const tabA = createSync({ storage, api: cloud.api, now, retryLocks: locks });

    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-1", refreshToken: "rt-1", expiresAt: clock + 3600_000 });
    await tabA.verify("u1@example.com", "111111", freshState());
    cloud.setSignOutMode("fail");
    const failOut = await tabA.logout();
    assert.equal(failOut.ok, false);
    assert.equal(failOut.stayed, true);
    assert.equal(tabA.account()?.userId, U1);
    assert.equal(getCurrentAccount(storage), U1);

    const tabB = createSync({ storage, api: cloud.api, now, retryLocks: locks });
    assert.ok(tabB.restore());
    await tabB.forceLocalLogout();
    const outAfterLost = await tabA.logout();
    assert.equal(outAfterLost.ok, true);
    assert.equal(outAfterLost.alreadyLoggedOut, true);
    assert.equal(tabA.account(), null);
    assert.equal(getCurrentAccount(storage), null);
  }

  // 9. P2-1 回归：用 emptyDoc()+saveAccount() 准备合法 25 XP 副本及外项目凭证 -> restore -> sendCode -> 同邮箱验证迁移（保留外项目凭证、旧副本与游客记录）
  {
    let clock = 8_000_000;
    const now = () => clock;
    const storage = makeStorage();
    const cloud = makeCloud(now);
    const locks = makeLocks();
    const prodHost = "prod.supabase.co";
    const previewHost = "preview.supabase.co";

    const prodSync = createSync({ storage, api: cloud.api, projectId: prodHost, legacyProject: prodHost, now, retryLocks: locks });
    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-prod", refreshToken: "rt-prod", expiresAt: clock + 3600_000 });
    assert.equal((await prodSync.verify("u1@example.com", "111111", freshState())).ok, true);
    assert.equal(prodSync.persistLocal({ ...freshState(), xp: 45, done: { "0-0": true } }).ok, true);
    const prodAuthRaw = storage.getItem(AUTH_KEY);
    const guestRaw = JSON.stringify({ ...freshState(), xp: 10, done: { "0-1": true } });
    storage.setItem(GUEST_KEY, guestRaw);

    const nsStorage = scopedStorage(storage, projectNamespace(previewHost, prodHost));
    const prevDoc = emptyDoc({ gen: 1, lineage: "lineage-prev-25" });
    prevDoc.xp.devPreview = 25;
    prevDoc.done = { U1L1: "2026-11-20" };
    prevDoc.days = ["2026-11-20"];
    assert.equal(saveAccount(nsStorage, U1, { doc: prevDoc, base: 1, dirty: { hearts: false, prefs: false, content: true } }, { now: clock }), true);
    assert.equal(setCurrentAccount(nsStorage, U1), true);
    nsStorage.setItem(AUTH_KEY, prodAuthRaw);

    const previewSync = createSync({ storage, api: cloud.api, projectId: previewHost, legacyProject: prodHost, now, retryLocks: locks });
    const restored = previewSync.restore(freshState());
    assert.equal(restored?.userId, U1);
    assert.equal(previewSync.status().status, "need-login");
    assert.ok(nsStorage.getItem(STALE_KEY), "STALE_KEY must record foreign-project migration hint");

    const blockedOther = await previewSync.sendCode("other@example.com");
    assert.equal(blockedOther.ok, false);
    assert.equal(blockedOther.kind, "other-account");

    const sentSame = await previewSync.sendCode("u1@example.com");
    assert.equal(sentSame.ok, true);
    cloud.setNextSession({ userId: U1, email: "u1@example.com", accessToken: "at-prev-new", refreshToken: "rt-prev-new", expiresAt: clock + 3600_000 });
    const migrated = await previewSync.verify("u1@example.com", "222222", freshState());
    assert.equal(migrated.ok, true);
    assert.equal(previewSync.account()?.userId, U1);

    assert.equal(storage.getItem(AUTH_KEY), prodAuthRaw, "foreign project AUTH_KEY in prod namespace must never be deleted");
    assert.equal(sumXp(loadAccount(storage, U1).copy.doc), 45);
    assert.equal(sumXp(loadAccount(nsStorage, U1).copy.doc), 25);
    assert.equal(storage.getItem(GUEST_KEY), guestRaw);
  }
}

await runMode(false);
await runMode(true);
console.log("cross-tab-session-loss tests passed (lock-free & with-lock)");
