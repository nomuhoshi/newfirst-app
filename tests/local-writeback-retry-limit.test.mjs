// TASK-GPT1-003: local writeback retry cap. All network/storage/time dependencies are fakes.
// Run from the repository root: node --test tests/local-writeback-retry-limit.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, cpSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createSync, AUTH_KEY } from '../src/sync.js';
import { saveAccount, loadAccount, setCurrentAccount } from '../src/account-store.js';
import { emptyDoc, sumXp, sumRuns } from '../src/account-data.js';
import { freshState } from '../src/storage.js';
import { statusText } from '../src/account-ui.js';

const NOW = 1_000_000;
const USER = 'u1';
const KEY = `suipian.acct.${USER}`;
const RETRY_KEY = `suipian.acct.writebackRetry.${USER}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const settle = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };

function memory() {
  const map = new Map();
  const faults = { writeback: false, retryCounter: false };
  return {
    map, faults,
    getItem(k) { return map.has(k) ? map.get(k) : null; },
    setItem(k, v) {
      if ((k === KEY && faults.writeback) || (k === RETRY_KEY && faults.retryCounter)) throw Error('simulated localStorage quota error');
      map.set(k, String(v));
    },
    removeItem(k) { map.delete(k); },
  };
}
function fakeClock() {
  let t = NOW, nextId = 1;
  const jobs = [];
  return {
    get t() { return t; }, jobs,
    schedule(fn, ms) { jobs.push({ id: nextId++, ms, at: t + ms, fn }); return nextId - 1; },
    async fire() {
      assert.ok(jobs.length > 0, 'no scheduled callback to execute');
      jobs.sort((a, b) => a.at - b.at || a.id - b.id);
      const job = jobs.shift(); t = job.at;
      job.fn(); await settle();
      return job;
    },
  };
}
function fixture({ mode = 'save', sharedStorage = null, sharedCloud = null, clock = null, retryLocks = null } = {}) {
  const storage = sharedStorage || memory();
  const time = clock || fakeClock();
  const local = emptyDoc({ gen: 1, lineage: 'L-u1' });
  local.xp.devA = 80;
  local.runs.devA = 5;
  local.done.U1L1 = '2026-11-01';
  local.days = ['2026-11-01'];
  const base = mode === 'create' ? null : 2;
  assert.equal(saveAccount(storage, USER, { doc: local, base, dirty: { hearts: false, prefs: false, content: true } }, { now: NOW }), true);
  assert.equal(setCurrentAccount(storage, USER), true);
  const session = { userId: USER, email: 'case@example.com', accessToken: 'at', refreshToken: 'rt', expiresAt: NOW + 3_600_000 };
  storage.setItem(AUTH_KEY, JSON.stringify({ session }));
  const cloud = sharedCloud || (() => {
    const remote = mode === 'equal' ? clone(local) : emptyDoc({ gen: 1, lineage: 'L-u1' });
    const state = { row: mode === 'create' ? null : { doc: remote, rev: 2 }, gets: 0, saves: 0, creates: 0, offline: false };
    return state;
  })();
  const api = {
    async getProgress() {
      cloud.gets++;
      return cloud.offline ? { ok: false, kind: 'network', message: 'offline' } : { ok: true, row: cloud.row ? clone(cloud.row) : null };
    },
    async saveProgress(_s, expectedRev, doc) {
      cloud.saves++;
      if (!cloud.row || cloud.row.rev !== expectedRev) return { ok: true, rev: null };
      cloud.row = { doc: clone(doc), rev: expectedRev + 1 };
      return { ok: true, rev: cloud.row.rev };
    },
    async createProgress(_s, doc) {
      cloud.creates++;
      if (cloud.row) return { ok: true, rev: null };
      cloud.row = { doc: clone(doc), rev: 1 };
      return { ok: true, rev: 1 };
    },
    async refresh() { throw Error('refresh must not be called'); },
  };
  const statuses = [];
  const sync = createSync({ storage, api, now: () => time.t, today: () => '2026-11-04', schedule: time.schedule, onStatus: (s) => statuses.push(s), retryLocks });
  assert.ok(sync.restore(freshState()), 'restore seeded account');
  storage.faults.writeback = true;
  return { storage, time, cloud, sync, local, api, statuses };
}
async function failThree(c) {
  const raw = c.storage.getItem(KEY);
  const first = await c.sync.syncNow();
  assert.equal(first.localWritebackFailed, true);
  assert.equal(first.retryLimitReached, undefined);
  assert.deepEqual(c.time.jobs.map(x => x.ms), [3000]);
  const retry1 = await c.time.fire();
  assert.equal(retry1.ms, 3000);
  assert.deepEqual(c.time.jobs.map(x => x.ms), [10000]);
  const retry2 = await c.time.fire();
  assert.equal(retry2.ms, 10000);
  assert.equal(c.time.jobs.length, 0, 'third failure must not schedule a fourth attempt');
  assert.equal(c.storage.getItem(KEY), raw, 'raw local copy must be byte-identical');
  return { first, raw };
}

test('01: failure #1 -> 3s, #2 -> 10s, #3 -> stop; no real-time waits', async () => {
  const c = fixture();
  await failThree(c);
  assert.equal(c.cloud.gets, 3);
  assert.equal(c.cloud.saves, 1);
  assert.equal(c.storage.getItem(RETRY_KEY), '3');
  const before = c.cloud.gets;
  for (let i = 0; i < 6; i++) {
    const r = await c.sync.syncNow(); // online / visibility / periodic / cross-tab trigger
    assert.equal(r.retryLimitReached, true);
    assert.equal(r.retryable, false);
  }
  assert.equal(c.cloud.gets, before, 'no more cloud reads after cap');
  assert.equal(c.time.jobs.length, 0, 'no more automatic timers after cap');
});

test('02: dirty local copy, pending status and actionable warning survive the cap', async () => {
  const c = fixture();
  const { raw } = await failThree(c);
  const copy = loadAccount(c.storage, USER, { now: c.time.t }).copy;
  assert.equal(c.storage.getItem(KEY), raw);
  assert.equal(copy.dirty.content, true);
  assert.equal(sumXp(copy.doc), 80);
  assert.equal(sumRuns(copy.doc), 5);
  assert.equal(c.sync.status().status, 'pending');
  assert.equal(c.sync.status().pending, true);
  assert.match(statusText(c.sync.status()), /停止自动同步/);
  assert.match(statusText(c.sync.status()), /检查浏览器存储/);
  assert.match(statusText(c.sync.status()), /手动重试/);
  assert.notEqual(statusText(c.sync.status()), '已同步 ✓');
});

test('03: manual sync after recovery succeeds and does not duplicate XP, runs or cloud rev', async () => {
  const c = fixture();
  await failThree(c);
  assert.equal(c.cloud.row.rev, 3);
  assert.equal(sumXp(c.cloud.row.doc), 80);
  assert.equal(sumRuns(c.cloud.row.doc), 5);
  c.storage.faults.writeback = false;
  const r = await c.sync.syncNow({ manual: true });
  assert.equal(r.ok, true);
  assert.equal(c.sync.status().status, 'synced');
  assert.equal(c.storage.getItem(RETRY_KEY), '0');
  assert.equal(loadAccount(c.storage, USER, { now: c.time.t }).copy.dirty.content, false);
  assert.equal(c.cloud.row.rev, 3);
  assert.equal(sumXp(c.cloud.row.doc), 80);
  assert.equal(sumRuns(c.cloud.row.doc), 5);
  const reads = c.cloud.gets;
  assert.equal((await c.sync.syncNow()).ok, true);
  assert.equal(c.cloud.gets, reads + 1, 'auto sync allowed again after manual recovery');
  assert.equal(c.cloud.row.rev, 3);
});

test('04: createProgress success then local failure retries without repeated cloud create', async () => {
  const c = fixture({ mode: 'create' });
  await failThree(c);
  assert.equal(c.cloud.creates, 1);
  assert.equal(c.cloud.row.rev, 1);
  assert.equal(sumXp(c.cloud.row.doc), 80);
  assert.equal(sumRuns(c.cloud.row.doc), 5);
  c.storage.faults.writeback = false;
  assert.equal((await c.sync.syncNow({ manual: true })).ok, true);
  assert.equal(c.cloud.creates, 1);
  assert.equal(c.cloud.row.rev, 1);
});

test('05: local failures do not advance network backoff from 3s to 10s', async () => {
  const c = fixture();
  await c.sync.syncNow(); // first local failure schedules local 3s
  assert.deepEqual(c.time.jobs.map(j => j.ms), [3000]);
  c.cloud.offline = true;
  const r = await c.sync.syncNow();
  assert.equal(r.kind, 'network');
  assert.deepEqual(c.time.jobs.map(j => j.ms), [3000, 3000], 'network backoff must start at 3s');
  assert.equal(c.storage.getItem(RETRY_KEY), '1', 'network error must not increment local failure count');
});

test('06: cloud-success message only when cloud API write returned success', async () => {
  const wrote = fixture({ mode: 'save' });
  const r1 = await wrote.sync.syncNow();
  assert.match(r1.message, /进度已保存在云端/);
  assert.equal(wrote.cloud.saves, 1);
  const equal = fixture({ mode: 'equal' });
  const r2 = await equal.sync.syncNow();
  assert.equal(equal.cloud.saves, 0);
  assert.equal(equal.cloud.creates, 0);
  assert.doesNotMatch(r2.message, /进度已保存在云端/);
});

test('07: a new tab and page restore respect the shared cap; explicit manual recovery works', async () => {
  const c = fixture();
  await failThree(c);
  const gets = c.cloud.gets;
  // New createSync instance using the same storage and cloud; no new seed / writes.
  const api = {
    async getProgress() { c.cloud.gets++; return { ok: true, row: clone(c.cloud.row) }; },
    async saveProgress() { throw Error('unexpected cloud save'); },
    async createProgress() { throw Error('unexpected cloud create'); },
    async refresh() { throw Error('unexpected refresh'); },
  };
  const other = createSync({ storage: c.storage, api, now: () => c.time.t, today: () => '2026-11-04', schedule: c.time.schedule });
  assert.ok(other.restore(freshState()));
  assert.equal((await other.syncNow()).retryLimitReached, true);
  assert.equal(c.cloud.gets, gets);
  c.storage.faults.writeback = false;
  assert.equal((await other.syncNow({ manual: true })).ok, true);
  assert.equal(c.cloud.gets, gets + 1);
  assert.equal(c.storage.getItem(RETRY_KEY), '0');
});

test('08: another trigger during an in-flight local failure cannot create an immediate retry', async () => {
  const c = fixture();
  let release;
  const api = {
    async getProgress() {
      c.cloud.gets++;
      if (c.cloud.gets === 1) await new Promise(resolve => { release = resolve; });
      return { ok: true, row: clone(c.cloud.row) };
    },
    async saveProgress(_s, rev, doc) {
      c.cloud.saves++;
      c.cloud.row = { doc: clone(doc), rev: rev + 1 };
      return { ok: true, rev: rev + 1 };
    },
    async createProgress() { throw Error('unexpected create'); },
    async refresh() { throw Error('unexpected refresh'); },
  };
  const other = createSync({ storage: c.storage, api, now: () => c.time.t, today: () => '2026-11-04', schedule: c.time.schedule });
  assert.ok(other.restore(freshState()));
  const first = other.syncNow();
  await settle();
  assert.equal(typeof release, 'function');
  const joined = other.syncNow(); // another event while first cloud read pending
  release();
  assert.equal((await first).localWritebackFailed, true);
  assert.equal((await joined).localWritebackFailed, true);
  await settle();
  assert.equal(c.cloud.gets, 1, 'again must not trigger immediate second cloud read');
  assert.deepEqual(c.time.jobs.map(j => j.ms), [3000]);
});

test('09: manual failure after cap does not restart automatic timers', async () => {
  const c = fixture();
  await failThree(c);
  const r = await c.sync.syncNow({ manual: true });
  assert.equal(r.retryLimitReached, true);
  assert.equal(c.time.jobs.length, 0);
  const gets = c.cloud.gets;
  assert.equal((await c.sync.syncNow()).retryLimitReached, true);
  assert.equal(c.cloud.gets, gets);
});

test('10: old scheduled timer invalidated by manual sync, no extra request', async () => {
  const c = fixture();
  await c.sync.syncNow();
  assert.equal(c.time.jobs.length, 1);
  c.storage.faults.writeback = false;
  assert.equal((await c.sync.syncNow({ manual: true })).ok, true);
  const gets = c.cloud.gets;
  await c.time.fire(); // old 3s callback exists in fake queue but must be inert
  assert.equal(c.cloud.gets, gets);
});

test('11: if a new trigger causes failure #2 early, the old 3s timer is inert and #2 schedules 10s', async () => {
  const c = fixture();
  await c.sync.syncNow();
  assert.deepEqual(c.time.jobs.map(j => j.ms), [3000]);
  await c.sync.syncNow(); // online event arrives before first timer fires
  assert.deepEqual(c.time.jobs.map(j => j.ms), [3000, 10000]);
  const gets = c.cloud.gets;
  await c.time.fire(); // old 3s is invalidated
  assert.equal(c.cloud.gets, gets);
  await c.time.fire(); // 10s triggers failure #3
  assert.equal(c.cloud.gets, gets + 1);
  assert.equal(c.time.jobs.length, 0);
});

test('12: a corrupt shared retry counter blocks automatic sync but allows manual repair', async () => {
  const c = fixture();
  c.storage.setItem(RETRY_KEY, '{corrupt');
  const r = await c.sync.syncNow();
  assert.equal(r.retryLimitReached, true);
  assert.equal(c.cloud.gets, 0);
  assert.match(statusText(c.sync.status()), /重试计数无法确认/);
  c.storage.faults.writeback = false;
  const manual = await c.sync.syncNow({ manual: true });
  assert.equal(manual.ok, true);
  assert.equal(c.storage.getItem(RETRY_KEY), '0');
});

// Mutation proof: remove the automatic-entry cap, run the same tests against the mutant,
// and REQUIRE at least one assertion to fail. No repository source is edited.
test('13: mutation removing automatic cap is killed by runtime assertions', { skip: !!process.env.WRITEBACK_MUTATION_CHILD }, () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const temp = mkdtempSync(join(tmpdir(), 'writeback-mutant-'));
  try {
    mkdirSync(join(temp, 'src'), { recursive: true });
    mkdirSync(join(temp, 'tests'), { recursive: true });
    for (const name of ['sync.js', 'account-data.js', 'account-store.js', 'storage.js', 'account-ui.js']) {
      cpSync(join(root, 'src', name), join(temp, 'src', name));
    }
    cpSync(join(root, 'tests', 'local-writeback-retry-limit.test.mjs'), join(temp, 'tests', 'local-writeback-retry-limit.test.mjs'));
    writeFileSync(join(temp, 'package.json'), '{"type":"module"}\n');
    const file = join(temp, 'src', 'sync.js');
    const source = readFileSync(file, 'utf8');
    const markers = [
      'if (!manual && ordinaryAutoBlocked()) return Promise.resolve(localRetryBlocked());',
      'if (!retryCounterWritable() || localFailureCount() >= LOCAL_RETRY_LIMIT) return localRetryBlocked();',
    ];
    let mutant = source;
    for (const marker of markers) {
      assert.equal(mutant.split(marker).length, 2, 'mutation target must exist exactly once: ' + marker);
      mutant = mutant.replace(marker, 'if (false) return localRetryBlocked();');
    }
    writeFileSync(file, mutant);
    const childEnv = { ...process.env, WRITEBACK_MUTATION_CHILD: '1' };
    delete childEnv.NODE_TEST_CONTEXT; // Node 22 forbids recursive --test while this variable is inherited.
    const child = spawnSync(process.execPath, [join(temp, 'tests', 'local-writeback-retry-limit.test.mjs')], {
      encoding: 'utf8', timeout: 15000, env: childEnv,
    });
    assert.notEqual(child.status, 0, `mutant unexpectedly passed:\n${child.stdout}\n${child.stderr}`);
    assert.match(child.stdout + child.stderr, /not ok|✖|AssertionError|ERR_ASSERTION/, 'mutant must fail an assertion');
  } finally { rmSync(temp, { recursive: true, force: true }); }
});

test('14: retry-counter write failure stops automatic cloud reads before the first request', async () => {
  const c = fixture();
  c.storage.faults.retryCounter = true;
  assert.equal((await c.sync.syncNow()).retryLimitReached, true);
  assert.equal(c.cloud.gets, 0);
  assert.equal(c.time.jobs.length, 0);
});

test('15: manual sync cannot claim recovery when retry-counter reset fails; retry after storage recovery succeeds', async () => {
  const c = fixture();
  await failThree(c);
  c.storage.faults.writeback = false;
  c.storage.faults.retryCounter = true;
  c.statuses.length = 0;
  const first = await c.sync.syncNow({ manual: true });
  assert.ok(!c.statuses.includes('synced'), 'counter reset failure must never emit a transient synced event');
  assert.equal(first.ok, false);
  assert.equal(first.retryLimitReached, true);
  assert.equal(c.storage.getItem(RETRY_KEY), '3');
  assert.equal(c.sync.status().pending, true);
  assert.match(statusText(c.sync.status()), /重试计数无法清零/);
  assert.equal((await c.sync.syncNow()).retryLimitReached, true);
  const rev = c.cloud.row.rev;
  c.storage.faults.retryCounter = false;
  const recovered = await c.sync.syncNow({ manual: true });
  assert.equal(recovered.ok, true);
  assert.equal(c.storage.getItem(RETRY_KEY), '0');
  assert.equal(c.cloud.row.rev, rev);
  assert.equal(sumXp(c.cloud.row.doc), 80);
  assert.equal(sumRuns(c.cloud.row.doc), 5);
  assert.equal((await c.sync.syncNow()).ok, true);
});


test('16: new tab cannot read cloud when retry counter is unwritable', async () => {
  const c = fixture();
  await failThree(c);
  const before = c.cloud.gets;
  c.storage.faults.retryCounter = true;
  const other = createSync({ storage:c.storage, api:{
    async getProgress(){ c.cloud.gets++; return {ok:true,row:clone(c.cloud.row)}; },
    async saveProgress(){ throw Error('unexpected save'); },
    async createProgress(){ throw Error('unexpected create'); },
    async refresh(){ throw Error('unexpected refresh'); },
  }, now:()=>c.time.t, today:()=> '2026-11-04', schedule:c.time.schedule });
  assert.ok(other.restore(freshState()));
  const result = await other.syncNow();
  assert.equal(result.retryLimitReached, true);
  assert.equal(c.cloud.gets, before);
});

function exclusiveLocks() {
  const tails = new Map();
  return { request(name, _opts, callback) {
    const previous = tails.get(name) || Promise.resolve();
    const task = previous.then(callback);
    tails.set(name, task.catch(()=>{}));
    return task;
  } };
}

test('17: two tabs concurrently requesting sync serialize the cap with a shared lock', async () => {
  const locks = exclusiveLocks();
  const c = fixture({ retryLocks: locks });
  const createTab = () => {
    const api = {
      async getProgress(){ c.cloud.gets++; return {ok:true,row:clone(c.cloud.row)}; },
      async saveProgress(_s,rev,doc){ c.cloud.saves++; c.cloud.row={doc:clone(doc),rev:rev+1}; return {ok:true,rev:rev+1}; },
      async createProgress(){ throw Error('unexpected create'); },
      async refresh(){ throw Error('unexpected refresh'); },
    };
    const sync=createSync({storage:c.storage,api,now:()=>c.time.t,today:()=> '2026-11-04',schedule:c.time.schedule,retryLocks:locks});
    assert.ok(sync.restore(freshState()));
    return sync;
  };
  const a=createTab(), b=createTab();
  const d=createTab();
  const results=await Promise.all([a.syncNow(),b.syncNow(),c.sync.syncNow(),d.syncNow()]);
  assert.equal(c.cloud.gets,3);
  assert.equal(c.storage.getItem(RETRY_KEY),'3');
  assert.equal((await a.syncNow()).retryLimitReached,true);
  assert.equal((await b.syncNow()).retryLimitReached,true);
  assert.equal(c.cloud.gets,3);
  assert.equal(results.filter(r=>r.retryLimitReached).length,2);
});


test('18: normal logout cleans the retry counter only after successful signOut', { skip: !!process.env.WRITEBACK_HARNESS }, async () => {
  const c = fixture({ mode: 'equal' });
  c.storage.faults.writeback = false;
  assert.equal((await c.sync.syncNow()).ok, true);
  c.storage.setItem(RETRY_KEY, '2');
  c.api.signOut = async () => ({ ok: true });
  const result = await c.sync.logout();
  assert.equal(result.ok, true);
  assert.equal(c.storage.getItem(RETRY_KEY), null, 'successful logout must remove retry counter');
});


test('19: browser without Web Locks blocks automatic cloud reads, but manual sync still works', async () => {
  // createSync captures navigator.locks at construction time. Simulate the browser
  // BEFORE fixture() creates the sync instance, otherwise this test can be a false positive.
  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const navigatorDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  try {
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: {} });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: {} });
    assert.equal(globalThis.navigator.locks, undefined);
    const c = fixture(); // sync is created only after the browser feature is disabled
    const automatic = await c.sync.syncNow();
    assert.equal(automatic.ok, false);
    assert.equal(automatic.retryLimitReached, true);
    assert.equal(c.cloud.gets, 0, 'automatic sync must not issue any cloud read');
    assert.equal(c.cloud.saves, 0, 'automatic sync must not issue any cloud write');
    assert.equal(c.time.jobs.length, 0, 'blocked automatic sync must not schedule retries');
    assert.equal(c.sync.status().pending, true);

    c.storage.faults.writeback = false; // storage recovered; explicit manual action is allowed
    const manual = await c.sync.syncNow({ manual: true });
    assert.equal(manual.ok, true, 'manual sync must remain available without Web Locks');
    assert.equal(c.cloud.gets, 1, 'manual sync must reach the cloud exactly once');
    assert.equal(c.cloud.saves, 1);
    assert.equal(c.sync.status().status, 'synced');
    assert.equal(c.time.jobs.length, 0);
  } finally {
    if (windowDescriptor) Object.defineProperty(globalThis, 'window', windowDescriptor);
    else delete globalThis.window;
    if (navigatorDescriptor) Object.defineProperty(globalThis, 'navigator', navigatorDescriptor);
    else delete globalThis.navigator;
  }
});


test('20: counter unwritable in both tabs prevents any automatic cloud reads', async () => {
  const c = fixture();
  c.storage.faults.retryCounter = true;
  const other = createSync({ storage: c.storage, api: c.api, now: () => c.time.t, today: () => '2026-11-04', schedule: c.time.schedule });
  assert.ok(other.restore(freshState()));
  const results = await Promise.all([c.sync.syncNow(), other.syncNow()]);
  assert.ok(results.every(r => r.retryLimitReached));
  assert.equal(c.cloud.gets, 0);
  assert.equal(c.time.jobs.length, 0);
});
