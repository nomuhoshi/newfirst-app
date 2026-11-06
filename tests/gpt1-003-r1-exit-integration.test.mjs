// GPT1-003 v4（本机写回失败重试上限）× R1（损坏导入待办硬锁）× DB-3.1（退出修复）的交界：
// R1 守卫的强制退出走独立清理路径，不经过 finishLocalLogout，所以必须单独证明：
//   - 退出成功：重试计数键与内存状态清掉；账号副本、游客记录、损坏待办原样；
//   - 退出失败（凭证/指针清不掉）：计数、账号副本、登录态全部保留，不提示成功。
// 全部用假存储/假云端，不联网。运行：node --test tests/gpt1-003-r1-exit-integration.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY } from '../src/sync.js';
import { saveAccount, setCurrentAccount, getCurrentAccount, SESSION_KEY, GUEST_KEY, DEVICE_KEY } from '../src/account-store.js';
import { emptyDoc } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const NOW = 1_000_000;
const USER = 'u1';
const KEY = `suipian.acct.${USER}`;
const RETRY_KEY = `suipian.acct.writebackRetry.${USER}`;
const PENDING_KEY = `suipian.acct.import.${USER}`;
const settle = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

function memory() {
  const map = new Map();
  const faults = { writeback: false, silentAuthRemove: false, silentPointerRemove: false, pointerRemoveThrows: false, silentRetryRemove: false };
  return {
    map, faults,
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) { if (k === KEY && faults.writeback) throw Error('simulated quota error'); map.set(k, String(v)); },
    removeItem(k) {
      if (k === AUTH_KEY && faults.silentAuthRemove) return;
      if (k === RETRY_KEY && faults.silentRetryRemove) return;
      if (k === SESSION_KEY && faults.silentPointerRemove) return;
      if (k === SESSION_KEY && faults.pointerRemoveThrows) throw Error('pointer remove denied');
      map.delete(k);
    },
  };
}
function clock() {
  let t = NOW, id = 1; const jobs = [];
  return { get t() { return t; }, jobs, schedule(fn, ms) { jobs.push({ id: id++, ms, at: t + ms, fn }); return id - 1; },
    async fire() { jobs.sort((a, b) => a.at - b.at); const j = jobs.shift(); t = j.at; j.fn(); await settle(); return j; } };
}
// 云端「永远能读写」，本机写回故障由 storage.faults.writeback 注入，于是每次同步都以 localWritebackFailed 失败。
function fixture() {
  const storage = memory(); const time = clock();
  storage.setItem(DEVICE_KEY, 'devX');
  storage.setItem(GUEST_KEY, JSON.stringify({ ...freshState(), onboarded: true, xp: 30, lessonsCompleted: 2, done: { U1L1: true }, streak: 1, lastDay: '2026-11-04' }));
  const local = emptyDoc({ gen: 1, lineage: 'L-u1' }); local.xp.devA = 80; local.runs.devA = 5; local.done.U1L1 = '2026-11-01'; local.days = ['2026-11-01'];
  assert.equal(saveAccount(storage, USER, { doc: local, base: 2, dirty: { hearts: false, prefs: false, content: true } }, { now: NOW }), true);
  assert.equal(setCurrentAccount(storage, USER), true);
  const session = { userId: USER, email: 'case@example.com', accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 };
  storage.setItem(AUTH_KEY, JSON.stringify({ session }));
  const cloud = { row: { doc: emptyDoc({ gen: 1, lineage: 'L-u1' }), rev: 2 }, calls: [] };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const api = {
    async getProgress() { cloud.calls.push('get'); return { ok: true, row: clone(cloud.row) }; },
    async saveProgress(_s, exp, doc) { cloud.calls.push('save'); if (cloud.row.rev !== exp) return { ok: true, rev: null }; cloud.row = { doc: clone(doc), rev: exp + 1 }; return { ok: true, rev: cloud.row.rev }; },
    async createProgress() { cloud.calls.push('create'); return { ok: true, rev: 1 }; },
    async signOut() { cloud.calls.push('signOut'); return { ok: true }; },
    async refresh() { cloud.calls.push('refresh'); throw Error('refresh must not be called'); },
  };
  const sync = createSync({ storage, api, now: () => time.t, today: () => '2026-11-04', schedule: time.schedule });
  assert.ok(sync.restore(freshState()));
  return { storage, time, cloud, sync };
}
// 制造「失败计数 = n」：本机写回连续失败（第 1 次手动触发，第 2 次由 3 秒定时器触发）
async function failTimes(f, n) {
  f.storage.faults.writeback = true;
  await f.sync.syncNow(); await settle();
  if (n >= 2) await f.time.fire();
  assert.equal(f.storage.getItem(RETRY_KEY), String(n), '前置条件：失败计数写进了存储');
}
const corruptPending = (f) => f.storage.map.set(PENDING_KEY, '{bad json');
const dataSnap = (f) => ({ account: f.storage.getItem(KEY), guest: f.storage.getItem(GUEST_KEY), pending: f.storage.getItem(PENDING_KEY), retry: f.storage.getItem(RETRY_KEY) });

test('G1: 损坏待办 + 强制本机退出成功：重试计数键被清掉，账号副本/游客/损坏待办原样，零网络', async () => {
  for (const n of [1, 2]) {
    const f = fixture(); await failTimes(f, n); corruptPending(f);
    f.storage.faults.writeback = false; // 退出本身不写账号副本；解除故障只为方便读回比较
    const before = dataSnap(f); const cloudBefore = f.cloud.calls.length;
    const r = await f.sync.forceLocalLogout();
    assert.equal(r.ok, true, `n=${n} 退出应成功`);
    assert.equal(f.storage.getItem(RETRY_KEY), null, `n=${n} 守卫路径退出成功后必须清掉重试计数`);
    assert.equal(getCurrentAccount(f.storage), null);
    assert.equal(f.storage.getItem(AUTH_KEY), null);
    const after = dataSnap(f);
    assert.equal(after.account, before.account); assert.equal(after.guest, before.guest); assert.equal(after.pending, '{bad json');
    assert.equal(f.cloud.calls.length, cloudBefore, '零网络请求');
  }
});

test('G2: 失败 3 次已停止自动同步 + 损坏待办 + 强制本机退出成功：计数同样清掉', async () => {
  const f = fixture(); await failTimes(f, 2); await f.time.fire(); // 第 3 次失败 → 上限
  assert.equal(f.storage.getItem(RETRY_KEY), '3');
  corruptPending(f);
  const r = await f.sync.logout({ force: true }); // 「仍然退出」那条路也走守卫
  assert.equal(r.ok, true);
  assert.equal(f.storage.getItem(RETRY_KEY), null);
  assert.ok(f.storage.getItem(KEY), '账号副本保留');
});

test('G3: 凭证删除静默无效 → 退出失败：计数、账号副本、登录态全部保留，不提示成功', async () => {
  const f = fixture(); await failTimes(f, 2); corruptPending(f);
  f.storage.faults.writeback = false; f.storage.faults.silentAuthRemove = true;
  const before = dataSnap(f); const authBefore = f.storage.getItem(AUTH_KEY);
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local'); assert.equal(r.rollbackFailed, false);
  assert.equal(f.storage.getItem(RETRY_KEY), '2', '退出失败必须保留失败计数');
  assert.deepEqual(dataSnap(f), before);
  assert.equal(getCurrentAccount(f.storage), USER, '账号指针已回滚');
  assert.equal(f.storage.getItem(AUTH_KEY), authBefore);
});

test('G4: 账号指针删除静默无效 → 退出失败：计数与副本保留', async () => {
  const f = fixture(); await failTimes(f, 1); corruptPending(f);
  f.storage.faults.writeback = false; f.storage.faults.silentPointerRemove = true;
  const before = dataSnap(f);
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local');
  assert.equal(f.storage.getItem(RETRY_KEY), '1');
  assert.deepEqual(dataSnap(f), before);
  assert.equal(getCurrentAccount(f.storage), USER);
});

test('G5: 账号指针删除抛错 → 退出失败：计数与副本保留', async () => {
  const f = fixture(); await failTimes(f, 2); corruptPending(f);
  f.storage.faults.writeback = false; f.storage.faults.pointerRemoveThrows = true;
  const before = dataSnap(f);
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, false);
  assert.equal(f.storage.getItem(RETRY_KEY), '2');
  assert.deepEqual(dataSnap(f), before);
});

test('G6: 退出失败之后，故障排除再退出一次：这次成功并清计数（失败不会留下半清状态）', async () => {
  const f = fixture(); await failTimes(f, 2); corruptPending(f);
  f.storage.faults.writeback = false; f.storage.faults.silentAuthRemove = true;
  assert.equal((await f.sync.forceLocalLogout()).ok, false);
  assert.equal(f.storage.getItem(RETRY_KEY), '2');
  f.storage.faults.silentAuthRemove = false;
  const r2 = await f.sync.forceLocalLogout();
  assert.equal(r2.ok, true);
  assert.equal(f.storage.getItem(RETRY_KEY), null);
});

test('G7: 对照（无损坏待办）：普通本机强制退出成功清计数；与守卫路径行为一致', async () => {
  const f = fixture(); await failTimes(f, 2);
  f.storage.faults.writeback = false;
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, true);
  assert.equal(f.storage.getItem(RETRY_KEY), null);
});

test('G8: 计数键删除静默无效：守卫路径退出仍成功（不困住用户），计数不会被误当成 0——同账号再登录后再失败一次即停机', async () => {
  const f = fixture(); await failTimes(f, 2); corruptPending(f);
  f.storage.faults.writeback = false; f.storage.faults.silentRetryRemove = true;
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, true);
  assert.equal(f.storage.getItem(RETRY_KEY), '2', '删除没生效：存储里的计数仍在');
  // 同账号重新登录（模拟：恢复指针与凭证、去掉损坏待办、新开一个 sync），本机写回再失败一次 → 第 3 次 → 上限
  f.storage.faults.silentRetryRemove = false;
  assert.equal(setCurrentAccount(f.storage, USER), true);
  f.storage.map.set(AUTH_KEY, JSON.stringify({ session: { userId: USER, email: 'case@example.com', accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 } }));
  f.storage.map.delete(PENDING_KEY);
  const api = { async getProgress() { return { ok: true, row: { doc: emptyDoc({ gen: 1, lineage: 'L-u1' }), rev: 2 } }; }, async saveProgress(_s, exp, doc) { return { ok: true, rev: exp + 1 }; }, async createProgress() { return { ok: true, rev: 1 }; }, async refresh() { throw Error('no'); } };
  const sync2 = createSync({ storage: f.storage, api, now: () => f.time.t, today: () => '2026-11-04', schedule: f.time.schedule });
  assert.ok(sync2.restore(freshState()));
  f.storage.faults.writeback = true;
  const r2 = await sync2.syncNow(); await settle();
  assert.equal(f.storage.getItem(RETRY_KEY), '3');
  assert.equal(r2.retryLimitReached, true);
});
