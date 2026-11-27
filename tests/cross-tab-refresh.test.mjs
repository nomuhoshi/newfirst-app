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
const abortError = () => Object.assign(new Error('aborted'), { name: 'AbortError' });
function locks({ query = false } = {}) {
  const chains = new Map(), busy = new Map();
  return { ...(query ? { query: async () => ({ held: [...busy].filter(([, n]) => n > 0).map(([name]) => ({ name })), pending: [] }) } : {}), request(name, opts, fn) {
    if (opts && opts.ifAvailable && (busy.get(name) || 0) > 0) return Promise.resolve().then(() => fn(null)); // 与真实 Web Locks 一致：ifAvailable 且锁被占着 → 回调拿到 null，不排队
    const sig = opts && opts.signal;
    if (sig && sig.aborted) return Promise.reject(abortError());
    const prev = chains.get(name) || Promise.resolve();
    busy.set(name, (busy.get(name) || 0) + 1);
    let cancelled = false, started = false, rej;
    const out = new Promise((resolve, reject) => {
      rej = reject;
      const run = () => { if (cancelled) return; started = true; return Promise.resolve().then(() => fn({ name })).then(resolve, reject).finally(() => busy.set(name, busy.get(name) - 1)); };
      chains.set(name, prev.then(run, run).catch(() => {}));
    });
    // 与真实 Web Locks 一致：还没拿到锁时 signal 中止 → 撤销排队，request 以 AbortError 拒绝，回调永远不会被调用
    if (sig) sig.addEventListener('abort', () => { if (!started && !cancelled) { cancelled = true; busy.set(name, busy.get(name) - 1); rej(abortError()); } });
    return out;
  } };
}
// 不认 signal 的锁实现：排队的请求不会被撤销，之后拿到锁时回调照常被调用（用来证明回调自己也会拒绝联网）
const ignoreSignal = real => ({ request(name, opts, fn) { const { signal, ...rest } = opts || {}; return real.request(name, rest, fn); } });

function fixture(withLocks, { provider: given = null, waitMs } = {}) {
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
  const make = (r = raw) => createSync({ storage: r, api, projectId: PROJECT, legacyProject: 'legacy.invalid', now: () => clock, schedule: () => 0, retryLocks: provider, ...(waitMs ? { refreshLockWaitMs: waitMs } : {}) });
  const sync = make();
  const first = (() => {
    saveAccount(storage, A, { doc: rows.get(A).doc, base: rows.get(A).rev, dirty: {} }, { now: clock });
    setCurrentAccount(storage, A);
    const s = issue(A); storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: s })); return s;
  })();
  assert.ok(sync.restore(freshState()));
  const f = {
    raw, storage, calls, rows, sync, first, issue, hooks, make, provider,
    snap: () => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b))),
    tab: (r) => { const t = make(r); assert.ok(t.restore(freshState()), '第二个页面恢复同一份登录'); return t; },
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
  const ndr = await within(f.sync.syncNow({ manual: true })); // 新操作：同步（保留登录，便于比较存储里的凭证）
  assert.ok(ndr.settled, 'G15_ISOLATE 旧刷新仍被挂住时，新会话的操作不能被拖住');
  const nd = ndr.v;
  assert.equal(nd.ok, true, 'G15_ISOLATE 新操作独立完成：' + JSON.stringify(nd));
  const before = f.storage.getItem(AUTH_KEY);
  assert.ok(before && JSON.parse(before).session.userId === A && /^at-tokA-/.test(JSON.parse(before).session.accessToken), '前提：存储里是新会话刷新后的凭证（带项目前缀读取）');
  assert.notEqual(JSON.parse(before).session.accessToken, fresh.accessToken, '前提：新会话确实刷新过');
  g1.release.resolve();
  const oldRes = await old;
  assert.equal(oldRes.stale, true, JSON.stringify(oldRes));
  await sleep(100); // 旧刷新的后续落盘（如果有的话）发生在放行之后
  assert.equal(f.storage.getItem(AUTH_KEY), before, 'G15_ISOLATE 旧结果不得写存储');
});

test('模拟 Web Locks：锁请求失败（没进入回调）：不刷新、不动数据、可重试，不宣称跨页去重', async () => {
  const real = locks(); const p = flaky(real);
  const f = fixture(true, { provider: p });
  p.fail = true;
  const before = f.snap();
  assert.ok(f.storage.getItem(AUTH_KEY), '前提：存储里有带项目前缀的登录凭证');
  assert.ok(JSON.parse(before).length >= 2, '前提：快照里有内容');
  const d = await f.sync.deleteAccount();
  assert.equal(d.ok, false, 'G15_LOCKFAIL 拿不到锁时必须失败而不是自行刷新：' + JSON.stringify(d)); assert.equal(d.kind, 'local', 'G15_LOCKFAIL ' + JSON.stringify(d));
  assert.equal(f.refreshes(), 0, 'G15_LOCKFAIL 拿不到锁不得自行刷新（否则可能与别页重复使用刷新凭证）');
  assert.equal(f.of('delete').length, 0);
  assert.equal(f.snap(), before, 'G15_LOCKFAIL 本机数据与凭证原样保留');
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

test('断言有效性自检：快照和带项目前缀的凭证读取，在数据被篡改时会变化', () => {
  const f = fixture(true);
  const s0 = f.snap(), a0 = f.storage.getItem(AUTH_KEY);
  assert.ok(JSON.parse(s0).length >= 2 && a0, '快照与凭证都不是空的');
  assert.equal(f.raw.getItem(AUTH_KEY), null, '未加项目前缀的原始存储读不到凭证（正是之前断言恒为 null 的原因）');
  f.storage.setItem(AUTH_KEY, a0.replace('at-tokA', 'at-TAMPER'));
  assert.notEqual(f.snap(), s0, '篡改凭证后快照必须不同');
  assert.notEqual(f.storage.getItem(AUTH_KEY), a0, '篡改凭证后读到的值必须不同');
  f.raw.setItem('suipian.tamper', '1');
  assert.ok(JSON.parse(f.snap()).some(([k]) => k === 'suipian.tamper'), '快照包含原始存储里新增的键');
});

// ---- 刷新锁排队的独立期限（终审 P2）----
for (const mode of ['认 signal（撤销排队）', '不认 signal（回调自己拒绝）']) {
  test(`模拟 Web Locks · ${mode}：持锁方长期不释放时，等待操作按期结束，不联网、不绕锁；之后释放旧锁没有迟到请求；用户重试可以完成`, async () => {
    const real = locks(); const prov = mode.startsWith('认') ? real : ignoreSignal(real);
    const f = fixture(true, { provider: prov, waitMs: 80 });
    const B = f.tab();
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const t0 = Date.now();
    const dr = await within(B.deleteAccount(), 1500);
    assert.ok(dr.settled, 'G15_TIMEOUT 持锁方不释放时，等待操作必须按期结束');
    assert.ok(Date.now() - t0 < 1200, 'G15_TIMEOUT 在期限附近结束：' + (Date.now() - t0));
    const d = dr.v;
    assert.equal(d.ok, false); assert.equal(d.kind, 'local', 'G15_TIMEOUT 超时返回可重试的本机错误：' + JSON.stringify(d));
    assert.equal(f.refreshes(), 1, 'G15_TIMEOUT 不得绕锁自行刷新：' + JSON.stringify(f.of('refresh')));
    assert.equal(f.of('delete').length, 0, 'G15_TIMEOUT 没有删除请求');
    assert.notEqual(B.status().status, 'need-login');
    g.release.resolve(); // 释放旧锁
    await sp.catch(() => {});
    await sleep(200);
    assert.equal(f.refreshes(), 1, 'G15_LATE 释放旧锁后，已过期的排队回调不得迟到联网：' + JSON.stringify(f.of('refresh')));
    assert.equal(f.of('delete').length, 0, 'G15_LATE 没有迟到的删除请求');
    const d2 = await B.deleteAccount(); // 用户明确重试
    assert.equal(d2.ok, true, 'G15_RETRY 用户重试可以完成：' + JSON.stringify(d2));
    assert.equal(f.of('delete').length, 1);
    assert.equal(f.refreshes(), 1, '重试时采纳别页发布的新凭证，不再刷新');
  });
}

for (const who of [A, B]) {
  test(`模拟 Web Locks：排队等刷新锁期间本页退出并${who === A ? '同号重新登录' : '换成另一个账号'}：立刻作废排队，不等到期，也没有迟到请求`, async () => {
    const f = fixture(true, { waitMs: 5_000 });
    const T = f.tab();
    const g = f.gateOn(1);
    const sp = f.sync.deleteAccount(); // 持锁页用删除（删除不占写回锁），这样等待页退出 / 登录不会被持锁页的同步写回锁挡住
    await bounded(g.entered.promise, 'refresh');
    const dp = T.deleteAccount();
    await sleep(60);
    assert.equal((await T.forceLocalLogout()).ok, true);
    assert.equal((await T.verify(who + '@example.test', '123456', freshState())).ok, true);
    const dr = await within(dp, 1500);
    assert.ok(dr.settled, 'G15_ABANDON_WAIT 排队期间退出 / 换号必须立刻作废排队');
    assert.equal(dr.v.ok, false);
    assert.ok(dr.v.stale === true || dr.v.sessionLost === true || dr.v.kind === 'session-lost', 'G15_ABANDON_WAIT ' + JSON.stringify(dr.v));
    const reqs = f.calls.length;
    g.release.resolve(); await sp.catch(() => {});
    await sleep(150);
    assert.ok(!f.calls.slice(reqs).some(c => c.method === 'delete' || (c.method === 'refresh' && c.rt === f.first.refreshToken)), 'G15_LATE 作废后没有迟到的旧请求：' + JSON.stringify(f.calls.slice(reqs)));
    assert.equal(f.of('delete').length, 0, 'G15_LATE 持锁页发现登录已被取代，也没有任何删除请求');
    assert.equal(f.refreshes(), 1, 'G15_LATE 排队页没有迟到的刷新');
  });
}

for (const mode of ['认 signal（撤销排队）', '不认 signal（回调自己拒绝）']) {
  test(`模拟 Web Locks · ${mode}：持锁方最终没有发布新凭证（刷新失败）时，已过期的排队回调也不会迟到联网`, async () => {
    const real = locks(); const prov = mode.startsWith('认') ? real : ignoreSignal(real);
    const f = fixture(true, { provider: prov, waitMs: 80 });
    const B = f.tab();
    const g = f.gateOn(1, { ok: false, kind: 'network', message: '网络连不上' });
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dr = await within(B.deleteAccount(), 1500);
    assert.ok(dr.settled && dr.v.kind === 'local', 'G15_TIMEOUT ' + JSON.stringify(dr));
    g.release.resolve(); await sp.catch(() => {});
    await sleep(200);
    assert.equal(f.refreshes(), 1, 'G15_LATE 持锁方没发布新凭证，过期的排队回调不得拿到锁后再刷新：' + JSON.stringify(f.of('refresh')));
    assert.equal(f.of('delete').length, 0, 'G15_LATE');
  });
}

// ---- G-LOGIN-16：锁请求异常收尾时释放排队登记 ----
const recorder = real => { const r = { mode: 'ok', signals: [], request(name, opts, fn) { r.signals.push(opts && opts.signal); if (r.mode === 'throw') throw new Error('locks threw'); if (r.mode === 'reject') return Promise.reject(new Error('locks denied')); return real.request(name, opts, fn); } }; return r; };
for (const mode of ['throw', 'reject']) {
  const what = mode === 'throw' ? '同步抛错' : '异步拒绝';
  test(`模拟 Web Locks：锁请求${what}，连续重试 12 次：零刷新零删除、存储不变；随后退出不会再取消已结束的请求；恢复后重试成功`, async () => {
    const rec = recorder(locks());
    const f = fixture(true, { provider: rec });
    rec.mode = mode;
    const before = f.snap();
    assert.ok(f.storage.getItem(AUTH_KEY) && JSON.parse(before).length >= 2, '前提：存储里有带项目前缀的凭证');
    for (let i = 0; i < 12; i++) {
      const d = await f.sync.deleteAccount();
      assert.equal(d.ok, false); assert.equal(d.kind, 'local', 'G16_FAIL ' + JSON.stringify(d));
    }
    assert.equal(rec.signals.length, 12); assert.ok(rec.signals.every(s => s && s.aborted === false), '前提：12 次请求都带着自己的 signal，且还没被取消');
    assert.equal(f.refreshes(), 0, 'G16_FAIL 失败期间零刷新'); assert.equal(f.of('delete').length, 0, 'G16_FAIL 失败期间零删除');
    assert.equal(f.snap(), before, 'G16_FAIL 存储逐字节不变');
    // 换号 / 退出（账号代次前进）：已结束的请求不得再被旧登记取消
    rec.mode = 'ok';
    const keep = rec.signals.slice();
    assert.equal((await f.sync.forceLocalLogout()).ok, true);
    assert.ok(keep.every(s => s?.aborted === false), 'G16_LEAK 已结束的锁请求不得再收到旧登记触发的 abort：' + keep.map(s => s?.aborted).join(','));
  });
}
test('模拟 Web Locks：锁请求失败后恢复，用户重试成功；仍在排队的有效请求遇到超时继续正确撤销', async () => {
  const rec = recorder(locks());
  const f = fixture(true, { provider: rec, waitMs: 80 });
  const B = f.tab();
  rec.mode = 'reject';
  for (let i = 0; i < 3; i++) assert.equal((await B.deleteAccount()).kind, 'local');
  rec.mode = 'ok';
  const failed = rec.signals.slice();
  const g = f.gateOn(1);
  const sp = f.sync.syncNow({ manual: true });
  await bounded(g.entered.promise, 'refresh');
  const queued = rec.signals.length;
  const dr = await within(B.deleteAccount(), 1500);
  assert.ok(dr.settled && dr.v.kind === 'local', 'G16_QUEUE 仍在排队的有效请求到期后正确结束：' + JSON.stringify(dr));
  assert.equal(rec.signals[queued]?.aborted, true, 'G16_QUEUE 到期撤销了这个仍在排队的请求');
  assert.ok(failed.every(s => s?.aborted === false), 'G16_LEAK 之前失败的请求不受影响');
  g.release.resolve(); await sp.catch(() => {});
  const d2 = await B.deleteAccount();
  assert.equal(d2.ok, true, 'G16_RETRY 恢复后用户重试成功：' + JSON.stringify(d2));
});


// G-LOGIN-18：持锁页刷新后写回的新凭证，晚一点才在等待页的存储里可见（实测 WebKit 多进程：锁释放比 localStorage 跨页同步先到）。
// 等待页拿到锁时如果直接读存储，会拿旧刷新令牌再刷新一次（被当作令牌复用拒绝）。基线上本测试失败：refresh 2 次、第二次是复用。
function laggy(raw, ms) {
  const late = new Map(); // key → { old, until }：写入方刚写的值，在 ms 毫秒内对另一页还不可见
  return {
    writer: { getItem: k => raw.getItem(k), setItem: (k, v) => { late.set(k, { old: raw.getItem(k), until: Date.now() + ms }); raw.setItem(k, v); }, removeItem: k => raw.removeItem(k) },
    reader: { getItem: k => { const x = late.get(k); return x && Date.now() < x.until ? x.old : raw.getItem(k); }, setItem: (k, v) => raw.setItem(k, v), removeItem: k => raw.removeItem(k) },
  };
}
test('G-LOGIN-18 跨页存储传播晚于锁释放：等待页等到新凭证再判断，只刷新一次，删除用新凭证成功', async () => {
  const f = fixture(true, { provider: locks({ query: true }) });
  const lag = laggy(f.raw, 150);
  const A = f.tab(lag.writer), B = f.tab(lag.reader);
  const g = f.gateOn(1);
  const sp = A.syncNow({ manual: true });
  await bounded(g.entered.promise, 'refresh');
  const dp = B.deleteAccount();
  await sleep(60);
  g.release.resolve();
  const [s, d] = await Promise.all([sp, dp]);
  assert.ok(!authFailure(s), 'G18_NOAUTH 同步：' + JSON.stringify(s));
  assert.equal(f.refreshes(), 1, 'G18_ONE 只刷新一次（没有拿旧令牌复用）：' + JSON.stringify(f.of('refresh')));
  assert.equal(d.ok, true, 'G18_DELETE 删除成功：' + JSON.stringify(d));
  assert.equal(f.of('delete').length, 1);
  assert.notEqual(f.of('delete')[0].at, f.first.accessToken, 'G18_ADOPT 删除不能用刷新前的旧访问令牌');
});
test('G-LOGIN-18 持锁页刷新失败（没有写回新凭证）：等待页最多短暂等一下，然后自己刷新，不会卡住', async () => {
  const f = fixture(true, { provider: locks({ query: true }) });
  const A = f.tab(), B = f.tab();
  const g = f.gateOn(1, { ok: false, kind: 'network', message: '网络连不上' });
  const sp = A.syncNow({ manual: true });
  await bounded(g.entered.promise, 'refresh');
  const dp = B.deleteAccount();
  await sleep(30);
  g.release.resolve();
  const t0 = Date.now();
  const r = await within(Promise.all([sp, dp]), 3000);
  assert.ok(r.settled, 'G18_NOHANG 不能卡住');
  assert.ok(Date.now() - t0 < 2500, 'G18_BOUNDED 等待有上限');
});
