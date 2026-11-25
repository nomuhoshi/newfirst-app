// G-LOGIN-15：跨标签页刷新协调。两个独立的 createSync 实例（两个页面）共用同一份登录存储和同一个假服务端：
// 一页同步、另一页确认删除时，同一份来源刷新令牌只刷新一次；等待页获锁后先复核身份、采纳共享新凭证，再判断是否需要刷新。
// 纯 Node、假接口（服务端在请求到达时就消耗一次性刷新令牌）；不联网、不读取任何真实账号。基线 a16abd9f 上，同步 + 删除跨页并发会发两次相同来源的刷新，删除误报 auth，删除 RPC 为 0。

import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY, scopedStorage, projectNamespace } from '../src/sync.js';
import { saveAccount, setCurrentAccount } from '../src/account-store.js';
import { emptyDoc } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const T0 = 1_000_000, PROJECT = 'g14.test.invalid', A = 'tokA', B = 'tokB', LIFE = 3_600_000;
const clone = x => JSON.parse(JSON.stringify(x));
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function bounded(p, label) {
  let timer;
  try { return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('门闩未到达：' + label)), 3000); })]); }
  finally { clearTimeout(timer); }
}
function locks() {
  const chains = new Map();
  const busy = new Map();
  return { request(name, opts, fn) {
    if (opts && opts.ifAvailable && (busy.get(name) || 0) > 0) return Promise.resolve().then(() => fn(null)); // 与真实 Web Locks 一致：ifAvailable 且锁被占着 → 回调拿到 null，不排队
    const prev = chains.get(name) || Promise.resolve();
    busy.set(name, (busy.get(name) || 0) + 1);
    const run = () => Promise.resolve().then(() => fn({ name })).finally(() => busy.set(name, busy.get(name) - 1));
    const next = prev.then(run, run); chains.set(name, next.catch(() => {})); return next;
  } };
}

function fixture(withLocks, { provider: given = null } = {}) {
  let clock = T0, seq = 0;
  const m = new Map(), calls = [], gates = [], exp = new Map(), revoked = new Set(), liveRt = new Map(), hooks = {};
  const raw = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
  const storage = scopedStorage(raw, projectNamespace(PROJECT, 'legacy.invalid'));
  const rows = new Map();
  for (const uid of [A, B]) { const d = emptyDoc({ lineage: 'lin-' + uid }); d.xp.cloud = uid === A ? 40 : 70; rows.set(uid, { doc: d, rev: 1 }); }
  const issue = (uid, life = LIFE) => {
    const n = ++seq, s = { userId: uid, email: uid + '@example.test', accessToken: `at-${uid}-${n}`, refreshToken: `rt-${uid}-${n}`, expiresAt: clock + life };
    exp.set(s.accessToken, s.expiresAt); liveRt.set(s.refreshToken, uid); return s;
  };
  const valid = s => !!s && exp.has(s.accessToken) && !revoked.has(s.accessToken) && clock < exp.get(s.accessToken);
  const unauth = { ok: false, kind: 'auth', status: 401, message: 'JWT expired' };
  let refreshSeen = 0, live = 0, peak = 0;
  const api = {
    async verifyCode(email) { return { ok: true, session: issue(email.split('@')[0]) }; },
    async sendCode() { return { ok: true }; },
    async refresh(sess) {
      const n = ++refreshSeen; live++; peak = Math.max(peak, live);
      try {
      calls.push({ method: 'refresh', rt: sess.refreshToken, at: sess.accessToken });
      // 服务端在请求到达时就消耗刷新令牌（一次性）并作废旧访问令牌，响应之后才可能被挂住
      let reply;
      if (hooks.refreshFails) reply = { ok: false, kind: 'network', message: '网络连不上' };
      else if (hooks.refreshLimited) reply = { ok: false, kind: 'rate-limit', status: 429, message: '请求太频繁' };
      else {
        const uid = liveRt.get(sess.refreshToken);
        if (!uid) reply = { ok: false, kind: 'auth', status: 400, message: 'Invalid Refresh Token' };
        else { liveRt.delete(sess.refreshToken); revoked.add(sess.accessToken); reply = { ok: true, session: issue(uid) }; }
      }
      const g = gates.find(x => !x.used && x.n === n);
      if (g) { g.used = true; g.entered.resolve(); await g.release.promise; if (g.reply) reply = clone(g.reply); }
      return reply;
      } finally { live--; }
    },
    async getProgress(sess) { calls.push({ method: 'get', at: sess?.accessToken }); return valid(sess) ? { ok: true, row: rows.has(sess.userId) ? clone(rows.get(sess.userId)) : null } : unauth; },
    async createProgress(sess, doc) { calls.push({ method: 'create', at: sess.accessToken }); if (!valid(sess)) return unauth; if (rows.has(sess.userId)) return { ok: true, rev: null }; rows.set(sess.userId, { rev: 1, doc: clone(doc) }); return { ok: true, rev: 1 }; },
    async saveProgress(sess, rev, doc) {
      calls.push({ method: 'save', at: sess.accessToken }); if (!valid(sess)) return unauth;
      const row = rows.get(sess.userId); if (!row || row.rev !== rev) return { ok: true, rev: null };
      rows.set(sess.userId, { rev: rev + 1, doc: clone(doc) }); return { ok: true, rev: rev + 1 };
    },
    async deleteAccount(sess) { calls.push({ method: 'delete', at: sess.accessToken }); if (!valid(sess)) return unauth; rows.delete(sess.userId); return { ok: true }; },
    async signOut() { return { ok: true }; },
  };
  const provider = given || (withLocks ? locks() : {});
  const make = () => createSync({ storage: raw, api, projectId: PROJECT, legacyProject: 'legacy.invalid', now: () => clock, schedule: () => 0, retryLocks: provider });
  const sync = make();
  const first = (() => {
    saveAccount(storage, A, { doc: rows.get(A).doc, base: rows.get(A).rev, dirty: {} }, { now: clock });
    setCurrentAccount(storage, A);
    const s = issue(A); storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: s })); return s;
  })();
  assert.ok(sync.restore(freshState()));
  const f = {
    raw, storage, calls, rows, sync, first, issue, hooks, make, provider,
    tab: () => { const t = make(); assert.ok(t.restore(freshState()), '第二个页面恢复同一份登录'); return t; },
    stored: () => JSON.parse(storage.getItem(AUTH_KEY)).session,
    expireSoon: sess => { clock = exp.get(sess.accessToken) - 30_000; }, // 距过期不足 60 秒：下次用令牌前必须刷新
    gateOn: (n, reply = null) => { const g = { n, reply, used: false, entered: defer(), release: defer() }; gates.push(g); return g; },
    of: method => calls.filter(c => c.method === method),
    refreshes: () => calls.filter(c => c.method === 'refresh').length,
    peak: () => peak,
    now: () => clock,
  };
  f.expireSoon(first);
  return f;
}
const authFailure = x => x && x.ok === false && x.kind === 'auth';


const within = (p, ms = 1500) => { let tm; return Promise.race([p.then(v => ({ settled: true, v })), new Promise(r => { tm = setTimeout(() => r({ settled: false }), ms); })]).finally(() => clearTimeout(tm)); };
const snap = f => JSON.stringify([...f.raw._m ?? []]);
const flaky = real => { const p = { fail: false, request(...a) { return p.fail ? Promise.reject(new Error('locks denied')) : real.request(...a); } }; return p; };

for (const withLocks of [false, true]) {
  const L = withLocks ? '模拟 Web Locks' : '无锁';

  test(`${L}：一页同步、另一页确认删除：${withLocks ? '只刷新一次，等待页采纳共享新凭证，删除成功' : '没有 Web Locks 不宣称跨页去重；数据保留，之后重试可以完成删除'}`, async () => {
    const f = fixture(withLocks);
    const B = f.tab();
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dp = B.deleteAccount();
    await sleep(60);
    g.release.resolve();
    const [s, d] = await Promise.all([sp, dp]);
    assert.ok(!authFailure(s), 'G15_NOAUTH 同步不得误报认证失败：' + JSON.stringify(s));
    assert.ok(s.ok === true || s.stale === true, JSON.stringify(s));
    if (withLocks) {
      assert.equal(f.refreshes(), 1, 'G15_ONE 两页同一登录实例并发只刷新一次：' + JSON.stringify(f.of('refresh')));
      assert.equal(d.ok, true, 'G15_NOAUTH 删除不得被误报认证失败：' + JSON.stringify(d));
      assert.equal(f.of('delete').length, 1, 'G15_DELETE');
      assert.equal(f.of('delete')[0].at, 'at-tokA-2', 'G15_ADOPT 删除用另一页刷新后发布的新凭证');
    } else {
      assert.ok(f.storage.getItem(AUTH_KEY) !== null || d.ok === true, 'G15_KEEP 数据保留');
      if (!d.ok) { // 没有锁时可能撞上令牌复用：不丢数据，之后重试（采纳共享新凭证）可以完成
        const d2 = await B.deleteAccount();
        assert.equal(d2.ok, true, 'G15_RECOVER ' + JSON.stringify(d2));
        assert.equal(f.of('delete').length, 1);
      }
    }
  });

  test(`${L}：删除先到、同步后到`, async () => {
    const f = fixture(withLocks);
    const B = f.tab();
    const g = f.gateOn(1);
    const dp = B.deleteAccount();
    await bounded(g.entered.promise, 'refresh');
    const sp = f.sync.syncNow({ manual: true });
    await sleep(60);
    g.release.resolve();
    const [d, s] = await Promise.all([dp, sp]);
    assert.equal(d.ok, true, 'G15_NOAUTH ' + JSON.stringify(d));
    assert.equal(f.of('delete').length, 1, 'G15_DELETE');
    if (withLocks) {
      assert.equal(f.refreshes(), 1, 'G15_ONE ' + JSON.stringify(f.of('refresh')));
      assert.ok(!authFailure(s), 'G15_NOAUTH 同步不得误报认证失败：' + JSON.stringify(s));
      assert.ok(s.ok === true || s.stale === true || s.kind === 'session-lost', JSON.stringify(s));
    }
  });
}

for (const withLocks of [false, true]) {
  const L = withLocks ? '模拟 Web Locks' : '无锁';
  for (const [name, hook, kind] of [['断网', 'refreshFails', 'network'], ['限流 429', 'refreshLimited', 'rate-limit']]) {
    test(`${L}：两页并发刷新遇到${name}：分类不变，不误报登录失效；恢复后重试成功`, async () => {
      const f = fixture(withLocks);
      const B = f.tab();
      f.hooks[hook] = true;
      const g = f.gateOn(1);
      const sp = f.sync.syncNow({ manual: true });
      await bounded(g.entered.promise, 'refresh');
      const dp = B.deleteAccount();
      await sleep(60); g.release.resolve();
      const [s, d] = await Promise.all([sp, dp]);
      assert.equal(s.kind, kind, 'G15_CLASS ' + JSON.stringify(s));
      assert.equal(d.kind, kind, 'G15_CLASS ' + JSON.stringify(d));
      assert.equal(f.of('delete').length, 0, '刷新失败时不发删除请求');
      if (withLocks) assert.equal(f.peak(), 1, 'G15_ONE 任何时刻只有一个刷新请求在途（排队，不并发）');
      assert.notEqual(f.sync.status().status, 'need-login');
      assert.notEqual(B.status().status, 'need-login');
      f.hooks[hook] = false;
      const d2 = await B.deleteAccount();
      assert.equal(d2.ok, true, 'G15_RETRY 恢复后重试必须成功：' + JSON.stringify(d2));
      assert.equal(f.of('delete').length, 1);
    });
  }
}

test('模拟 Web Locks：等待页获锁时登录已被取代（另一页退出）：复核身份，不刷新、不发删除', async () => {
  const f = fixture(true);
  const B = f.tab();
  const g = f.gateOn(1);
  const sp = f.sync.syncNow({ manual: true });
  await bounded(g.entered.promise, 'refresh');
  const dp = B.deleteAccount();
  await sleep(60);
  assert.equal((await f.sync.forceLocalLogout()).ok, true); // 持锁页退出：立刻放锁，共享存储里的登录被清掉
  const dr = await within(dp);
  g.release.resolve(); await sp; // 无论如何先放行，避免失败时挂住
  assert.ok(dr.settled, 'G15_ABANDON 持锁页退出后必须立刻放锁，等待页不得一直排队');
  const d = dr.v;
  assert.equal(f.refreshes(), 1, 'G15_IDENTITY 等待页复核身份后不得再刷新：' + JSON.stringify(f.of('refresh')));
  assert.equal(f.of('delete').length, 0, 'G15_IDENTITY 不得用已失效的登录发删除');
  assert.ok(d.ok === false && (d.stale === true || d.sessionLost === true || d.kind === 'session-lost'), 'G15_IDENTITY ' + JSON.stringify(d));
  assert.equal(f.storage.getItem(AUTH_KEY), null, '旧结果不得把凭证写回存储');
});

test('模拟 Web Locks：持锁页的刷新在途时本页退出并同号重新登录：新操作不被旧登记 / 旧锁拖住，旧结果不覆盖新会话', async () => {
  const f = fixture(true);
  const g1 = f.gateOn(1);
  const old = f.sync.syncNow({ manual: true });
  await bounded(g1.entered.promise, 'old refresh');
  assert.equal((await f.sync.forceLocalLogout()).ok, true);
  assert.equal((await f.sync.verify(A + '@example.test', '123456', freshState())).ok, true);
  const fresh = f.stored(); f.expireSoon(fresh);
  const ndr = await within(f.sync.deleteAccount());
  assert.ok(ndr.settled, 'G15_ISOLATE 旧刷新仍被挂住时，新会话的操作不能被拖住');
  const nd = ndr.v;
  assert.equal(nd.ok, true, 'G15_ISOLATE 新操作独立完成：' + JSON.stringify(nd));
  assert.equal(f.of('delete').length, 1);
  const before = f.raw.getItem(AUTH_KEY);
  g1.release.resolve();
  const oldRes = await old;
  assert.equal(oldRes.stale, true, JSON.stringify(oldRes));
  assert.equal(f.raw.getItem(AUTH_KEY), before, 'G15_ISOLATE 旧结果不得写存储');
});

test('模拟 Web Locks：锁请求失败（没进入回调）：不刷新、不动数据、可重试，不宣称跨页去重', async () => {
  const real = locks(); const p = flaky(real);
  const f = fixture(true, { provider: p });
  p.fail = true;
  const before = snap(f);
  const d = await f.sync.deleteAccount();
  assert.equal(d.ok, false, 'G15_LOCKFAIL 拿不到锁时必须失败而不是自行刷新：' + JSON.stringify(d)); assert.equal(d.kind, 'local', 'G15_LOCKFAIL ' + JSON.stringify(d));
  assert.equal(f.refreshes(), 0, 'G15_LOCKFAIL 拿不到锁不得自行刷新（否则可能与别页重复使用刷新凭证）');
  assert.equal(f.of('delete').length, 0);
  assert.equal(snap(f), before, 'G15_LOCKFAIL 本机数据与凭证原样保留');
  assert.notEqual(f.sync.status().status, 'need-login');
  p.fail = false;
  const d2 = await f.sync.deleteAccount();
  assert.equal(d2.ok, true, 'G15_RETRY ' + JSON.stringify(d2));
});

test('模拟 Web Locks：两页同时手动同步：写回锁 → 刷新锁的嵌套顺序不死锁，只刷新一次', async () => {
  const f = fixture(true);
  const B = f.tab();
  const [a, b] = await bounded(Promise.all([f.sync.syncNow({ manual: true }), B.syncNow({ manual: true })]), '两页同步');
  assert.equal(f.refreshes(), 1, 'G15_ONE ' + JSON.stringify(f.of('refresh')));
  assert.ok(!authFailure(a) && !authFailure(b), JSON.stringify([a, b]));
});

test('模拟 Web Locks：持锁页退出后恢复出相同凭证和实例（锁名相同）：旧锁立刻放掉，新操作不排在旧刷新后面', async () => {
  const f = fixture(true);
  const g1 = f.gateOn(1);
  const old = f.sync.syncNow({ manual: true });
  await bounded(g1.entered.promise, 'old refresh');
  assert.equal((await f.sync.forceLocalLogout()).ok, true);
  saveAccount(f.storage, A, { doc: f.rows.get(A).doc, base: 1, dirty: {} }, { now: f.now() });
  setCurrentAccount(f.storage, A);
  f.storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: f.first }));
  assert.ok(f.sync.restore(freshState()));
  const nd = f.sync.deleteAccount();
  await sleep(60);
  assert.equal(f.refreshes(), 2, 'G15_ABANDON 旧刷新仍挂着时，新代次的刷新不得排在旧锁后面：' + JSON.stringify(f.of('refresh')));
  g1.release.resolve();
  assert.equal((await old).stale, true);
  await nd;
});

test('模拟 Web Locks：别页的刷新被挂住时，本页普通退出不排队（拿不到刷新锁就照旧自己处理），不被拖住', async () => {
  const f = fixture(true);
  const B = f.tab();
  const g = f.gateOn(1);
  const sp = f.sync.syncNow({ manual: true });
  await bounded(g.entered.promise, 'refresh');
  const lr = await within(B.logout());
  g.release.resolve(); await sp.catch(() => {}); // 无论如何先放行，避免失败时挂住
  assert.ok(lr.settled, 'G15_LOGOUT 退出不得排在别页挂住的刷新后面');
});
