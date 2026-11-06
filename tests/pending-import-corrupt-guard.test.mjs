// TASK-GPT1-002: 损坏游客导入待办安全锁（纯 Node / 假云端，不接任何 Supabase 项目）
// 运行：node tests/pending-import-corrupt-guard.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY } from '../src/sync.js';
import { GUEST_KEY, DEVICE_KEY, SESSION_KEY, getGuestId, loadPendingImport, loadAccount, saveAccount, setCurrentAccount, getCurrentAccount } from '../src/account-store.js';
import { emptyDoc, guestFingerprint, sumXp } from '../src/account-data.js';
import { freshState } from '../src/storage.js';
import { statusText } from '../src/account-ui.js';

const NOW = 1_000_000;
const TODAY = '2026-11-05';
const UID = 'uGuard';
const MAIL = 'guard@example.test';
const PENDING_KEY = `suipian.acct.import.${UID}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const session = () => ({ userId: UID, email: MAIL, accessToken: 'fake-at', refreshToken: 'fake-rt', expiresAt: NOW + 3_600_000 });

function mem() {
  const m = new Map();
  return { _m: m, getItem: (k) => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
function guestState() {
  return { ...freshState(), onboarded: true, xp: 80, lessonsCompleted: 5,
    done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY };
}
function makeCloudDoc(gid) {
  const d = emptyDoc({ gen: 1, lineage: 'L-guard' });
  d.xp.devGuard = 70; d.runs.devGuard = 4;
  d.done = { U1L1: '2026-11-04' }; d.days = ['2026-11-04'];
  d.imported[gid] = true; // 旧格式，要求明确选择
  return d;
}
function makeApi(initial, mode = 'normal') {
  const calls = [];
  const state = { row: { doc: clone(initial), rev: 7 }, gets: 0, mode };
  const api = {
    calls, state,
    async verifyCode() { calls.push('verifyCode'); return { ok: true, session: session() }; },
    async refresh() { calls.push('refresh'); return { ok: true, session: session() }; },
    async getProgress() {
      calls.push('getProgress'); state.gets++;
      if (state.mode === 'readback-fail' && state.gets === 3) return { ok: false, kind: 'network', message: '读回失败（注入）' };
      return { ok: true, row: clone(state.row) };
    },
    async saveProgress(_session, expected, doc) {
      calls.push('saveProgress');
      if (state.mode === 'upload-fail') return { ok: false, kind: 'network', message: '写入失败（注入）' };
      if (expected !== state.row.rev) return { ok: true, rev: null };
      state.row = { doc: clone(doc), rev: state.row.rev + 1 };
      return { ok: true, rev: state.row.rev };
    },
    async createProgress(_session, doc) { calls.push('createProgress'); state.row = { doc: clone(doc), rev: 1 }; return { ok: true, rev: 1 }; },
    async signOut() { calls.push('signOut'); return { ok: true }; },
  };
  return api;
}
function fixture({ dirty = false, pendingRaw = '{bad json', readFailure = false, withCopy = true, mode = 'normal' } = {}) {
  const rawStore = mem(); rawStore.setItem(DEVICE_KEY, 'devGuard');
  const guest = guestState(); const guestRaw = JSON.stringify(guest);
  rawStore.setItem(GUEST_KEY, guestRaw);
  const gid = getGuestId(rawStore).id;
  const cloudDoc = makeCloudDoc(gid);
  const localDoc = clone(cloudDoc);
  if (dirty) {
    localDoc.xp.devGuard = 80; localDoc.runs.devGuard = 5;
    localDoc.done.U1L2 = TODAY; localDoc.days.push(TODAY);
  }
  if (withCopy) {
    assert.equal(saveAccount(rawStore, UID, { doc: localDoc, base: 7,
      dirty: { content: dirty, hearts: false, prefs: false } }, { now: NOW }), true);
    assert.equal(setCurrentAccount(rawStore, UID), true);
    rawStore.setItem(AUTH_KEY, JSON.stringify({ session: session() }));
  }
  rawStore.setItem(PENDING_KEY, pendingRaw);
  const storage = readFailure ? { ...rawStore, getItem(k) {
    if (k === PENDING_KEY) throw new Error('storage read failure');
    return rawStore.getItem(k);
  } } : rawStore;
  const api = makeApi(cloudDoc, mode);
  const scheduled = [];
  const makeSync = () => createSync({ storage, api, now: () => NOW, today: () => TODAY,
    schedule: (fn, ms) => { scheduled.push({ fn, ms }); return scheduled.length; } });
  return { rawStore, storage, guest, guestRaw, gid, cloudDoc, localDoc, api, scheduled, makeSync };
}
function validPending(f) {
  return { version: 1, userId: UID, guestId: f.gid, choice: 'merge',
    fingerprint: guestFingerprint(f.guest), guestRaw: f.guestRaw,
    guestState: clone(f.guest), createdAt: NOW };
}
function dataSnapshot(f) {
  return { guest: f.rawStore.getItem(GUEST_KEY), pending: f.rawStore.getItem(PENDING_KEY),
    account: f.rawStore.getItem(`suipian.acct.${UID}`), cloud: JSON.stringify(f.api.state.row) };
}
function assertNoCloudCalls(f, from = 0) {
  assert.deepEqual(f.api.calls.slice(from), [], '锁定后禁止所有云端 API 调用');
}
function assertLearningSame(doc, before) {
  assert.deepEqual(doc.xp, before.xp);
  assert.deepEqual(doc.runs, before.runs);
  assert.deepEqual(doc.done, before.done);
  assert.deepEqual(doc.days, before.days);
}

// T001
 test('T001: 损坏 JSON 被识别为 corrupt，原始字节保留', () => {
  const f = fixture();
  assert.equal(loadPendingImport(f.storage, UID).code, 'corrupt');
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{bad json');
});

// T002
 test('T002: 缺字段、非法指纹、错误 userId / choice 均为 corrupt', () => {
  const f = fixture();
  const cases = [
    ((p) => { delete p.guestState; return p; })(validPending(f)),
    { ...validPending(f), fingerprint: 'invalid-fingerprint' },
    { ...validPending(f), fingerprint: 'deadbeef' }, // 8 位合法十六进制，但不匹配游客快照
    { ...validPending(f), guestRaw: '{broken guest snapshot' },
    { ...validPending(f), guestState: { ...f.guest, xp: f.guest.xp + 1 } },
    { ...validPending(f), userId: 'other' },
    { ...validPending(f), choice: 'unknown' },
  ];
  for (const p of cases) {
    const raw = JSON.stringify(p); f.rawStore.setItem(PENDING_KEY, raw);
    assert.equal(loadPendingImport(f.storage, UID).code, 'corrupt');
    assert.equal(f.rawStore.getItem(PENDING_KEY), raw);
  }
});

// T003
 test('T003: 读取失败与损坏区分；两者都在任何云端操作前阻断', async () => {
  const f = fixture({ readFailure: true });
  assert.equal(loadPendingImport(f.storage, UID).code, 'read-failed');
  const sync = f.makeSync(); sync.restore(freshState());
  assert.equal(sync.status().status, 'import-read-failed');
  assert.equal(sync.status().pending, true);
  const r = await sync.syncNow();
  assert.equal(r.kind, 'import-read-failed'); assert.equal(r.code, 'read-failed');
  assert.equal(r.retryable, false);
  assertNoCloudCalls(f);
  assert.match(statusText(sync.status()), /无法读取/);
});

// T004
 test('T004: 干净账号副本也必须锁定，不能因 dirty=false 放行', async () => {
  const f = fixture({ dirty: false });
  // 若先执行 ensureToken，这份快过期凭证会触发 refresh；锁必须更早生效。
  f.rawStore.setItem(AUTH_KEY, JSON.stringify({ session: { ...session(), expiresAt: NOW + 1000 } }));
  const before = dataSnapshot(f);
  const sync = f.makeSync(); const restored = sync.restore(freshState());
  assert.ok(restored);
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(sync.status().pending, true);
  const r = await sync.syncNow();
  assert.equal(r.kind, 'import-corrupt'); assert.equal(r.retryable, false);
  assertNoCloudCalls(f);
  assert.deepEqual(dataSnapshot(f), before);
  assert.match(statusText(sync.status()), /同步已暂停/);
});

// T005
 test('T005: dirty 副本不上传；本机学习可保存，锁定状态不被 pending 覆盖', async () => {
  const f = fixture({ dirty: true }); const sync = f.makeSync();
  const restored = sync.restore(freshState());
  const old = loadAccount(f.storage, UID, { now: NOW }).copy.doc;
  assertLearningSame(old, f.localDoc);
  const r = await sync.syncNow(); assert.equal(r.kind, 'import-corrupt');
  const next = { ...restored.state, xp: restored.state.xp + 10,
    lessonsCompleted: restored.state.lessonsCompleted + 1,
    done: { ...restored.state.done, U1L3: true }, streak: 1, lastDay: TODAY };
  const saved = sync.persistLocal(next);
  assert.equal(saved.ok, true); assert.equal(saved.syncBlocked, 'import-corrupt');
  const after = loadAccount(f.storage, UID, { now: NOW }).copy;
  assert.equal(sumXp(after.doc), 90);
  assert.equal(after.doc.runs.devGuard, 6);
  assert.ok(Object.hasOwn(after.doc.done, 'U1L3'));
  assert.ok(after.doc.days.includes(TODAY));
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(sync.status().pending, true);
  assert.equal(f.scheduled.length, 0, '不能安排任何自动重试或上传');
  assertNoCloudCalls(f);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{bad json');
  assertLearningSame(f.api.state.row.doc, f.cloudDoc);
});

async function damagedAfterMerge(mode) {
  const f = fixture({ withCopy: false, pendingRaw: '', mode });
  f.rawStore.removeItem(PENDING_KEY);
  const sync = f.makeSync();
  const v = await sync.verify(MAIL, '123456', f.guest);
  assert.equal(v.ok, true); assert.equal(v.needChoice, true);
  const finished = await sync.finishChoice('merge');
  assert.equal(finished.ok, true); assert.equal(finished.synced, false);
  const copy = loadAccount(f.storage, UID, { now: NOW }).copy;
  assert.ok(copy); assert.equal(copy.dirty.content, true);
  assert.equal(sumXp(copy.doc), 80);
  assert.equal(copy.doc.runs.devGuard, 5);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.ok(f.rawStore.getItem(PENDING_KEY));
  f.rawStore.setItem(PENDING_KEY, '{damaged');
  const before = dataSnapshot(f);
  const calls = f.api.calls.length;
  const again = await sync.syncNow();
  assert.equal(again.kind, 'import-corrupt');
  assert.equal(again.retryable, false);
  assertNoCloudCalls(f, calls);
  assert.deepEqual(dataSnapshot(f), before);
  assert.equal(f.scheduled.length, 0);
  const restored = f.makeSync(); restored.restore(freshState());
  assert.equal(restored.status().status, 'import-recovery-required');
  assert.equal(restored.status().pending, true);
  const r2 = await restored.syncNow(); assert.equal(r2.kind, 'import-corrupt');
  assertNoCloudCalls(f, calls);
  assert.deepEqual(dataSnapshot(f), before);
  return f;
}

// T006
 test('T006: 安全合并写云失败后损坏待办，不得绕过专用流程', async () => {
  const f = await damagedAfterMerge('upload-fail');
  assert.equal(f.api.state.row.rev, 7);
  assertLearningSame(f.api.state.row.doc, f.cloudDoc);
});

// T007
 test('T007: 合并未确认后待办损坏，写入失败和读回失败均不能偷渡上传', async () => {
  const failed = await damagedAfterMerge('upload-fail');
  assert.equal(failed.api.state.row.rev, 7);
  assertLearningSame(failed.api.state.row.doc, failed.cloudDoc);
  const f = await damagedAfterMerge('readback-fail');
  assert.equal(f.api.state.row.rev, 8);
  assert.equal(sumXp(f.api.state.row.doc), 80);
  assert.equal(f.api.state.row.doc.runs.devGuard, 5);
  assert.ok(Object.hasOwn(f.api.state.row.doc.done, 'U1L2'));
  assert.ok(f.api.state.row.doc.days.includes(TODAY));
});

// T008
 test('T008: 重新打开页面仍锁定，且没有定时器风暴', async () => {
  const f = fixture({ dirty: true });
  for (let i = 0; i < 3; i++) {
    const sync = f.makeSync(); sync.restore(freshState());
    assert.equal(sync.status().status, 'import-recovery-required');
    assert.equal(sync.status().pending, true);
    const r = await sync.syncNow(); assert.equal(r.kind, 'import-corrupt');
  }
  assertNoCloudCalls(f);
  assert.equal(f.scheduled.length, 0);
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{bad json');
});

 test('附加：普通退出必须阻断；强制本机退出保留三份原始数据', async () => {
  const f = fixture({ dirty: true }); const sync = f.makeSync(); sync.restore(freshState());
  const before = dataSnapshot(f);
  const normal = await sync.logout();
  assert.equal(normal.ok, false); assert.equal(normal.kind, 'import-corrupt');
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.deepEqual(dataSnapshot(f), before);
  assert.ok(getCurrentAccount(f.storage));
  const force = await sync.forceLocalLogout();
  assert.equal(force.ok, true);
  assert.equal(getCurrentAccount(f.storage), null);
  assert.equal(f.rawStore.getItem(AUTH_KEY), null);
  assert.deepEqual(dataSnapshot(f), before);
  assertNoCloudCalls(f);
});

 test('附加：强制退出后同账号重新登录仍不能静默上传', async () => {
  const f = fixture({ dirty: true }); const sync = f.makeSync(); sync.restore(freshState());
  const before = dataSnapshot(f);
  await sync.forceLocalLogout();
  // 模拟同一账号凭证和本机副本恢复；不触碰游客/待办/云端数据。
  f.rawStore.setItem(AUTH_KEY, JSON.stringify({ session: session() }));
  setCurrentAccount(f.storage, UID);
  const again = f.makeSync(); again.restore(freshState());
  assert.equal(again.status().status, 'import-recovery-required');
  assert.equal((await again.syncNow()).kind, 'import-corrupt');
  assert.deepEqual(dataSnapshot(f), before);
  assertNoCloudCalls(f);
});

 test('附加：损坏前已安排的单次定时同步触发后也不访问云端', async () => {
  const f = fixture({ dirty: false, pendingRaw: JSON.stringify({ version: 1 }) });
  // 先清掉无效待办，正常学习时会安排一个同步回调。
  f.rawStore.removeItem(PENDING_KEY);
  const sync = f.makeSync(); const restored = sync.restore(freshState());
  const next = { ...restored.state, xp: restored.state.xp + 10,
    lessonsCompleted: restored.state.lessonsCompleted + 1,
    done: { ...restored.state.done, U1L4: true }, lastDay: TODAY, streak: 1 };
  assert.equal(sync.persistLocal(next).ok, true);
  assert.equal(f.scheduled.length, 1);
  f.rawStore.setItem(PENDING_KEY, '{broken while timer queued');
  const before = dataSnapshot(f);
  f.scheduled[0].fn(); // 定时回调是 fire-and-forget；内部同步会被 preflight 直接阻断。
  await Promise.resolve(); await Promise.resolve();
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(f.scheduled.length, 1, '不得安排新的自动重试');
  assertNoCloudCalls(f);
  assert.deepEqual(dataSnapshot(f), before);
});

 test('附加：损坏待办锁定时禁止删除账号，避免删除原始证据', async () => {
  const f = fixture({ dirty: true }); const sync = f.makeSync(); sync.restore(freshState());
  const before = dataSnapshot(f);
  const r = await sync.deleteAccount();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.deepEqual(dataSnapshot(f), before);
  assertNoCloudCalls(f);
});

 test('附加：本机凭证删除失败时不得宣称强制退出成功', async () => {
  const f = fixture({ dirty: true });
  const storage = { ...f.storage, removeItem(k) {
    if (k === AUTH_KEY) throw new Error('remove auth denied');
    return f.storage.removeItem(k);
  } };
  const sync = createSync({ storage, api: f.api, now: () => NOW, today: () => TODAY,
    schedule: (fn, ms) => { f.scheduled.push({ fn, ms }); return f.scheduled.length; } });
  sync.restore(freshState());
  const before = dataSnapshot(f);
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(getCurrentAccount(storage), UID, '失败时应恢复账号指针');
  assert.deepEqual(dataSnapshot(f), before);
  assertNoCloudCalls(f);
});

 test('附加：普通同步的云端读取期间待办变坏，写云前再次锁定', async () => {
  const f = fixture({ dirty: true });
  f.rawStore.removeItem(PENDING_KEY);
  const original = f.api.getProgress;
  f.api.getProgress = async (...args) => {
    const r = await original(...args);
    f.rawStore.setItem(PENDING_KEY, '{corrupt during await');
    return r;
  };
  const sync = f.makeSync(); sync.restore(freshState());
  const beforeCloud = JSON.stringify(f.api.state.row);
  const r = await sync.syncNow();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(JSON.stringify(f.api.state.row), beforeCloud);
  assert.ok(f.api.calls.includes('getProgress'));
  assert.ok(!f.api.calls.includes('saveProgress'));
  assert.ok(!f.api.calls.includes('createProgress'));
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{corrupt during await');
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
});


// R1-01: ensureToken 的 refresh await 期间损坏待办。
test('R1-01: refresh 期间待办损坏，刷新后不再访问云端进度', async () => {
  const f = fixture({ dirty: true });
  f.rawStore.removeItem(PENDING_KEY);
  f.rawStore.setItem(AUTH_KEY, JSON.stringify({ session: { ...session(), expiresAt: NOW + 1_000 } }));
  f.api.refresh = async () => {
    f.api.calls.push('refresh');
    f.rawStore.setItem(PENDING_KEY, '{corrupt during refresh');
    return { ok: true, session: session() };
  };
  const sync = f.makeSync(); sync.restore(freshState());
  const beforeCloud = JSON.stringify(f.api.state.row);
  const r = await sync.syncNow();
  assert.equal(r.kind, 'import-corrupt');
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.deepEqual(f.api.calls, ['refresh']);
  assert.equal(JSON.stringify(f.api.state.row), beforeCloud);
  assert.equal(loadAccount(f.storage, UID, { now: NOW }).copy.dirty.content, true);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
});

// R1-02: 普通 CAS 写入期间待办损坏，云端可能已写但不得将本地标记已同步。
test('R1-02: saveProgress 期间待办损坏，dirty 与本机副本不清除', async () => {
  const f = fixture({ dirty: true }); f.rawStore.removeItem(PENDING_KEY);
  const original = f.api.saveProgress;
  f.api.saveProgress = async (...args) => {
    const result = await original(...args);
    f.rawStore.setItem(PENDING_KEY, '{corrupt during save');
    return result;
  };
  const sync = f.makeSync(); sync.restore(freshState());
  const beforeCopy = f.rawStore.getItem(`suipian.acct.${UID}`);
  const r = await sync.syncNow();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.ok(f.api.calls.includes('saveProgress'));
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(sync.status().pending, true);
  assert.equal(f.rawStore.getItem(`suipian.acct.${UID}`), beforeCopy);
  assert.equal(loadAccount(f.storage, UID, { now: NOW }).copy.dirty.content, true);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{corrupt during save');
  assert.equal(f.scheduled.length, 0);
});

// R1-03: 创建云端记录期间待办损坏，禁止将新 rev 落盘为已同步。
test('R1-03: createProgress 期间待办损坏，保留 dirty 副本', async () => {
  const f = fixture({ dirty: true }); f.rawStore.removeItem(PENDING_KEY);
  f.api.state.row = null;
  const original = f.api.createProgress;
  f.api.createProgress = async (...args) => {
    const result = await original(...args);
    f.rawStore.setItem(PENDING_KEY, '{corrupt during create');
    return result;
  };
  const sync = f.makeSync(); sync.restore(freshState());
  const beforeCopy = f.rawStore.getItem(`suipian.acct.${UID}`);
  const r = await sync.syncNow();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.ok(f.api.calls.includes('createProgress'));
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(sync.status().pending, true);
  assert.equal(f.rawStore.getItem(`suipian.acct.${UID}`), beforeCopy);
  assert.equal(loadAccount(f.storage, UID, { now: NOW }).copy.dirty.content, true);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.scheduled.length, 0);
});

async function importWithReadbackMutation(mutate) {
  const f = fixture({ withCopy: false, pendingRaw: '' });
  f.rawStore.removeItem(PENDING_KEY);
  const original = f.api.getProgress;
  f.api.getProgress = async (...args) => {
    const result = await original(...args);
    if (f.api.state.gets === 3) mutate(f);
    return result;
  };
  const sync = f.makeSync();
  const v = await sync.verify(MAIL, '123456', f.guest);
  assert.equal(v.ok, true); assert.equal(v.needChoice, true);
  const r = await sync.finishChoice('merge');
  return { f, sync, r };
}

// R1-04: readback await 期间待办损坏；上传成功也不能清游客。
test('R1-04: 专用导入 readback 期间待办损坏，游客原文保留', async () => {
  const { f, r } = await importWithReadbackMutation((f) => f.rawStore.setItem(PENDING_KEY, '{corrupt during readback'));
  assert.equal(f.api.state.gets, 3);
  assert.ok(f.api.calls.includes('saveProgress'));
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.equal(r.pending, true);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{corrupt during readback');
  assert.ok(loadAccount(f.storage, UID, { now: NOW }).copy);
});

// R1-05: 另一个标签页写入新待办，旧导入不能删除游客或新待办。
test('R1-05: 其他标签页替换合法待办，旧操作不得清除新记录', async () => {
  let newRaw = null;
  const { f, r } = await importWithReadbackMutation((f) => {
    const old = JSON.parse(f.rawStore.getItem(PENDING_KEY));
    newRaw = JSON.stringify({ ...old, choice: 'cloud', createdAt: NOW + 1 });
    f.rawStore.setItem(PENDING_KEY, newRaw);
  });
  assert.ok(newRaw);
  assert.equal(loadPendingImport(f.storage, UID).ok, true);
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-changed');
  assert.equal(r.retryable, false); assert.equal(r.pending, true);
  assert.equal(f.rawStore.getItem(PENDING_KEY), newRaw);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.ok(f.api.calls.includes('saveProgress'));
});

// R1-06: SESSION_KEY 删除被拒绝，不能继续删除 AUTH_KEY。
test('R1-06: SESSION_KEY 删除失败，凭证和全部学习数据保留', async () => {
  const f = fixture({ dirty: true });
  const storage = { ...f.storage, removeItem(k) {
    if (k === SESSION_KEY) throw new Error('session remove denied');
    return f.storage.removeItem(k);
  } };
  const sync = createSync({ storage, api: f.api, now: () => NOW, today: () => TODAY });
  sync.restore(freshState());
  const before = dataSnapshot(f), authBefore = f.rawStore.getItem(AUTH_KEY);
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(r.rollbackFailed, false);
  assert.equal(getCurrentAccount(storage), UID);
  assert.equal(f.rawStore.getItem(AUTH_KEY), authBefore);
  assert.deepEqual(dataSnapshot(f), before);
  assert.equal(sync.status().status, 'import-recovery-required');
  assertNoCloudCalls(f);
});

// R1-07: 删除指针已发生但报告失败，同时回滚写入也失败。
test('R1-07: SESSION_KEY 删除后报错且回滚失败，不宣称退出成功', async () => {
  const f = fixture({ dirty: true });
  const storage = { ...f.storage,
    removeItem(k) {
      if (k === SESSION_KEY) { f.storage.removeItem(k); throw new Error('session removed then failed'); }
      return f.storage.removeItem(k);
    },
    setItem(k, v) {
      if (k === SESSION_KEY) throw new Error('rollback denied');
      return f.storage.setItem(k, v);
    },
  };
  const sync = createSync({ storage, api: f.api, now: () => NOW, today: () => TODAY });
  sync.restore(freshState());
  const before = dataSnapshot(f), authBefore = f.rawStore.getItem(AUTH_KEY);
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(r.rollbackFailed, true);
  assert.equal(getCurrentAccount(storage), null, '故障注入使指针无法回滚，必须显式报告');
  assert.equal(f.rawStore.getItem(AUTH_KEY), authBefore);
  assert.deepEqual(dataSnapshot(f), before);
  assert.equal(sync.status().status, 'import-recovery-required');
  assertNoCloudCalls(f);
});

// R1-08: AUTH_KEY 删除失败且 SESSION_KEY 回滚失败，暴露半退出状态。
test('R1-08: 凭证删除失败并且指针回滚失败，报告恢复失败并保留证据', async () => {
  const f = fixture({ dirty: true });
  const storage = { ...f.storage,
    removeItem(k) {
      if (k === AUTH_KEY) throw new Error('auth remove denied');
      return f.storage.removeItem(k);
    },
    setItem(k, v) {
      if (k === SESSION_KEY) throw new Error('rollback denied');
      return f.storage.setItem(k, v);
    },
  };
  const sync = createSync({ storage, api: f.api, now: () => NOW, today: () => TODAY });
  sync.restore(freshState());
  const before = dataSnapshot(f), authBefore = f.rawStore.getItem(AUTH_KEY);
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(r.rollbackFailed, true);
  assert.equal(getCurrentAccount(storage), null);
  assert.equal(f.rawStore.getItem(AUTH_KEY), authBefore);
  assert.deepEqual(dataSnapshot(f), before);
  assert.equal(sync.status().status, 'import-recovery-required');
  assertNoCloudCalls(f);
});

// R1-09: deleteAccount 的 ensureToken refresh 期间待办损坏，不得调用删除接口。
test('R1-09: deleteAccount refresh 期间待办损坏，禁止云端删除', async () => {
  const f = fixture({ dirty: true }); f.rawStore.removeItem(PENDING_KEY);
  f.rawStore.setItem(AUTH_KEY, JSON.stringify({ session: { ...session(), expiresAt: NOW + 1_000 } }));
  f.api.refresh = async () => {
    f.api.calls.push('refresh');
    f.rawStore.setItem(PENDING_KEY, '{corrupt before delete');
    return { ok: true, session: session() };
  };
  f.api.deleteAccount = async () => { f.api.calls.push('deleteAccount'); return { ok: true }; };
  const sync = f.makeSync(); sync.restore(freshState());
  const before = dataSnapshot(f);
  const r = await sync.deleteAccount();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.deepEqual(f.api.calls, ['refresh']);
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.rawStore.getItem(`suipian.acct.${UID}`), before.account);
});

// R1-10: 已登录账号的专用导入在 readback 期间损坏，syncOnce 不得覆盖硬锁。
test('R1-10: syncOnce 专用导入中途损坏，保留恢复状态且不安排重试', async () => {
  const f = fixture({ dirty: true, pendingRaw: '' });
  f.rawStore.setItem(PENDING_KEY, JSON.stringify(validPending(f)));
  const original = f.api.getProgress;
  f.api.getProgress = async (...args) => {
    const result = await original(...args);
    if (f.api.state.gets === 2) f.rawStore.setItem(PENDING_KEY, '{broken during dedicated readback');
    return result;
  };
  const sync = f.makeSync(); sync.restore(freshState());
  const r = await sync.syncNow();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
  assert.equal(r.retryable, false);
  assert.equal(sync.status().status, 'import-recovery-required');
  assert.equal(sync.status().pending, true);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.equal(f.rawStore.getItem(PENDING_KEY), '{broken during dedicated readback');
  assert.equal(f.scheduled.length, 0);
});

// R1-11: cloud 分支也必须在清待办前验证原文身份。
test('R1-11: 保留云端导入期间其他标签页换待办，不能清除新待办', async () => {
  const f = fixture({ withCopy: false, pendingRaw: '' }); f.rawStore.removeItem(PENDING_KEY);
  let newRaw = null;
  const original = f.api.getProgress;
  f.api.getProgress = async (...args) => {
    const result = await original(...args);
    if (f.api.state.gets === 3) {
      const old = JSON.parse(f.rawStore.getItem(PENDING_KEY));
      newRaw = JSON.stringify({ ...old, choice: 'merge', createdAt: NOW + 1 });
      f.rawStore.setItem(PENDING_KEY, newRaw);
    }
    return result;
  };
  const sync = f.makeSync();
  const v = await sync.verify(MAIL, '123456', f.guest);
  assert.equal(v.ok, true); assert.equal(v.needChoice, true);
  const r = await sync.finishChoice('cloud');
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-changed');
  assert.equal(r.retryable, false);
  assert.equal(f.rawStore.getItem(PENDING_KEY), newRaw);
  assert.equal(f.rawStore.getItem(GUEST_KEY), f.guestRaw);
  assert.ok(f.api.calls.includes('saveProgress'));
});

// R1-12: storage.removeItem 静默无效，必须读回验证 SESSION_KEY。
test('R1-12: SESSION_KEY 删除静默无效，阻断强制退出', async () => {
  const f = fixture({ dirty: true });
  const storage = { ...f.storage, removeItem(k) {
    if (k === SESSION_KEY) return;
    return f.storage.removeItem(k);
  } };
  const sync = createSync({ storage, api: f.api, now: () => NOW, today: () => TODAY });
  sync.restore(freshState());
  const before = dataSnapshot(f), authBefore = f.rawStore.getItem(AUTH_KEY);
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(getCurrentAccount(storage), UID);
  assert.equal(f.rawStore.getItem(AUTH_KEY), authBefore);
  assert.deepEqual(dataSnapshot(f), before);
  assertNoCloudCalls(f);
});
