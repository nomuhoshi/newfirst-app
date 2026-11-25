// G-LOGIN-14：同一页面、同一登录实例、同一份来源凭证的并发刷新只发一次请求，等待方共享结果，避免“刷新令牌被复用”误报认证失败。
// 纯 Node、假接口：服务端在请求到达时就消耗刷新令牌（一次性），并立即作废旧访问令牌；响应可以被门闩挂住，模拟“刷新还没回来”。
// 不联网、不读取任何真实账号。
// 复现（基线 2360a218）：“立即同步”的刷新还没返回时确认删除 → 第二次刷新带着同一份刷新令牌 → 被拒（400）→ 删除返回 auth，删除 RPC 次数为 0。
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
  return { request(name, _o, fn) { const prev = chains.get(name) || Promise.resolve(); const next = prev.then(fn, fn); chains.set(name, next.catch(() => {})); return next; } };
}

function fixture(withLocks) {
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
  let refreshSeen = 0;
  const api = {
    async verifyCode(email) { return { ok: true, session: issue(email.split('@')[0]) }; },
    async sendCode() { return { ok: true }; },
    async refresh(sess) {
      const n = ++refreshSeen;
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
  const provider = withLocks ? locks() : {};
  const make = () => createSync({ storage: raw, api, projectId: PROJECT, legacyProject: 'legacy.invalid', now: () => clock, schedule: () => 0, retryLocks: provider });
  const sync = make();
  const first = (() => {
    saveAccount(storage, A, { doc: rows.get(A).doc, base: rows.get(A).rev, dirty: {} }, { now: clock });
    setCurrentAccount(storage, A);
    const s = issue(A); storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: s })); return s;
  })();
  assert.ok(sync.restore(freshState()));
  const f = {
    raw, storage, calls, rows, sync, first, issue, hooks,
    stored: () => JSON.parse(storage.getItem(AUTH_KEY)).session,
    expireSoon: sess => { clock = exp.get(sess.accessToken) - 30_000; }, // 距过期不足 60 秒：下次用令牌前必须刷新
    gateOn: (n, reply = null) => { const g = { n, reply, used: false, entered: defer(), release: defer() }; gates.push(g); return g; },
    of: method => calls.filter(c => c.method === method),
    refreshes: () => calls.filter(c => c.method === 'refresh').length,
    now: () => clock,
  };
  f.expireSoon(first);
  return f;
}
const authFailure = x => x && x.ok === false && x.kind === 'auth';

for (const withLocks of [false, true]) {
  const L = withLocks ? '模拟 Web Locks' : '无锁';

  test(`${L}：同步的刷新还没返回时确认删除：只发一次刷新，删除不被误报认证失败`, async () => {
    const f = fixture(withLocks);
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dp = f.sync.deleteAccount();
    await sleep(40); // 让删除走到刷新这一步
    g.release.resolve();
    const [s, d] = await Promise.all([sp, dp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE 同一份凭证并发刷新只能发一次：' + JSON.stringify(f.of('refresh')));
    assert.equal(new Set(f.of('refresh').map(c => c.rt)).size, 1);
    assert.ok(!authFailure(d), 'G14_NOAUTH 删除不得被误报认证失败：' + JSON.stringify(d));
    assert.equal(d.ok, true, 'G14_NOAUTH ' + JSON.stringify(d));
    assert.equal(f.of('delete').length, 1, 'G14_DELETE 删除请求必须发出一次：' + JSON.stringify(f.calls));
    assert.match(f.of('delete')[0].at, /^at-tokA-2$/, 'G14_DELETE 删除用刷新后的令牌');
    assert.ok(!authFailure(s), 'G14_NOAUTH 同步不得误报认证失败：' + JSON.stringify(s));
    assert.ok(s.ok === true || s.stale === true, '同步要么成功、要么按既有规则判过期：' + JSON.stringify(s));
    assert.notEqual(f.sync.status().status, 'need-login');
  });

  test(`${L}：删除先到、同步后到：共用同一次刷新，删除成功`, async () => {
    const f = fixture(withLocks);
    const g = f.gateOn(1);
    const dp = f.sync.deleteAccount();
    await bounded(g.entered.promise, 'refresh');
    const sp = f.sync.syncNow({ manual: true });
    await sleep(40);
    g.release.resolve();
    const [d, s] = await Promise.all([dp, sp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE ' + JSON.stringify(f.of('refresh')));
    assert.equal(d.ok, true, 'G14_NOAUTH ' + JSON.stringify(d));
    assert.equal(f.of('delete').length, 1, 'G14_DELETE');
    assert.ok(!authFailure(s), 'G14_NOAUTH ' + JSON.stringify(s));
    assert.equal(s.ok === true || s.stale === true || s.kind === 'session-lost', true, JSON.stringify(s));
  });

  test(`${L}：刷新成功后凭证只写一次，存储和内存都是刷新后的新凭证`, async () => {
    const f = fixture(withLocks);
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const sp2 = f.sync.syncNow({ manual: true });
    const dp = f.sync.deleteAccount();
    await sleep(40); g.release.resolve();
    await Promise.all([sp, sp2, dp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE ' + JSON.stringify(f.of('refresh')));
    assert.equal(f.of('refresh')[0].rt, f.first.refreshToken);
  });

  test(`${L}：刷新失败（断网）：等待方共享失败，不误报登录失效；失败后可以重试并成功`, async () => {
    const f = fixture(withLocks);
    f.hooks.refreshFails = true;
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dp = f.sync.deleteAccount();
    await sleep(40); g.release.resolve();
    const [s, d] = await Promise.all([sp, dp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE 失败结果也共享：' + JSON.stringify(f.of('refresh')));
    assert.equal(s.ok, false); assert.equal(s.kind, 'network', 'G14_CLASS 同步仍按网络错误分类：' + JSON.stringify(s));
    assert.equal(d.ok, false); assert.equal(d.kind, 'network', 'G14_CLASS 删除仍按网络错误分类：' + JSON.stringify(d));
    assert.equal(f.of('delete').length, 0, '刷新失败时不发删除请求');
    assert.notEqual(f.sync.status().status, 'need-login');
    // 重试：失败后登记已释放，新的调用重新发刷新
    f.hooks.refreshFails = false;
    const d2 = await f.sync.deleteAccount();
    assert.equal(f.refreshes(), 2, 'G14_RETRY 失败后重试必须重新发刷新：' + JSON.stringify(f.of('refresh')));
    assert.equal(d2.ok, true, 'G14_RETRY ' + JSON.stringify(d2));
    assert.equal(f.of('delete').length, 1);
  });

  test(`${L}：刷新被限流（429）：等待方共享，分类与冷却不变，不发删除请求`, async () => {
    const f = fixture(withLocks);
    f.hooks.refreshLimited = true;
    const g = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dp = f.sync.deleteAccount();
    await sleep(40); g.release.resolve();
    const [s, d] = await Promise.all([sp, dp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE ' + JSON.stringify(f.of('refresh')));
    assert.equal(s.kind, 'rate-limit', 'G14_CLASS ' + JSON.stringify(s));
    assert.equal(d.kind, 'rate-limit', 'G14_CLASS ' + JSON.stringify(d));
    assert.equal(f.of('delete').length, 0);
    assert.equal(f.sync.status().status, 'error', 'G14_CLASS 同步状态进入冷却错误：' + JSON.stringify(f.sync.status()));
  });

  test(`${L}：刷新被拒但另一页已写入同实例新凭证：等待方都采用共享存储里的新凭证，删除用它`, async () => {
    const f = fixture(withLocks);
    const g = f.gateOn(1, { ok: false, kind: 'auth', status: 400, message: 'Invalid Refresh Token' });
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g.entered.promise, 'refresh');
    const dp = f.sync.deleteAccount();
    await sleep(40);
    const newer = f.issue(A); // 另一页刚刷新并写回了同一个登录实例的新凭证
    f.storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: newer }));
    g.release.resolve();
    const [s, d] = await Promise.all([sp, dp]);
    assert.equal(f.refreshes(), 1, 'G14_ONE ' + JSON.stringify(f.of('refresh')));
    assert.equal(d.ok, true, 'G14_ADOPT 删除须采用共享存储里的新凭证：' + JSON.stringify(d));
    assert.equal(f.of('delete')[0]?.at, newer.accessToken, 'G14_ADOPT');
    assert.ok(!authFailure(s), 'G14_ADOPT ' + JSON.stringify(s));
  });

  for (const who of [A, B]) {
    const what = who === A ? '同一账号重新登录' : '换成另一个账号';
    test(`${L}：刷新在途时${what}：新操作独立刷新，旧结果不写新会话，旧登记收尾不清新登记`, async () => {
      const f = fixture(withLocks);
      const g1 = f.gateOn(1), g2 = f.gateOn(2);
      const old = f.sync.syncNow({ manual: true });
      await bounded(g1.entered.promise, 'old refresh');
      assert.equal((await f.sync.forceLocalLogout()).ok, true);
      assert.equal((await f.sync.verify(who + '@example.test', '123456', freshState())).ok, true);
      const fresh = f.stored(); assert.equal(fresh.userId, who);
      f.expireSoon(fresh); // 新登录的凭证也进入刷新窗口
      const nd = f.sync.deleteAccount(); // 新操作：必须独立发自己的刷新（不能挂在旧登记上）
      await bounded(g2.entered.promise, 'new refresh');
      assert.equal(f.refreshes(), 2, 'G14_ISOLATE 新代次的操作不能合并进旧登记：' + JSON.stringify(f.of('refresh')));
      assert.deepEqual(f.of('refresh').map(c => c.rt), [f.first.refreshToken, fresh.refreshToken], 'G14_ISOLATE 两次刷新来源凭证不同');
      const before = JSON.stringify(f.stored());
      g1.release.resolve(); // 旧刷新先回来
      const oldRes = await old;
      assert.equal(oldRes.stale, true, 'G14_ISOLATE 旧同步按既有规则判过期：' + JSON.stringify(oldRes));
      assert.equal(JSON.stringify(f.stored()), before, 'G14_ISOLATE 旧结果不得覆盖新会话的存储凭证');
      assert.equal(f.stored().accessToken, fresh.accessToken, 'G14_ISOLATE 旧刷新结果不得写进新登录的存储凭证：' + JSON.stringify(f.stored()));
      // 旧登记收尾后，新登记必须还在：此时再来一个新操作应合并进新的在途刷新，而不是另发
      const nd2 = f.sync.syncNow({ manual: true });
      await sleep(40);
      assert.equal(f.refreshes(), 2, 'G14_FINALLY 旧登记收尾不得清掉新登记（否则第三个操作会重复刷新）：' + JSON.stringify(f.of('refresh')));
      g2.release.resolve();
      const [ndr, nd2r] = await Promise.all([nd, nd2]);
      assert.equal(ndr.ok, true, 'G14_ISOLATE 新操作独立完成：' + JSON.stringify(ndr));
      assert.ok(!authFailure(nd2r), JSON.stringify(nd2r));
      assert.equal(f.refreshes(), 2);
      assert.equal(f.of('delete').length, 1);
      assert.match(f.of('delete')[0].at, new RegExp('^at-' + who + '-'));
    });
  }
}

// ---- 登记的绑定条件：来源刷新令牌、账号代次各自都必须参与匹配 ----
for (const withLocks of [false, true]) {
  const L = withLocks ? '模拟 Web Locks' : '无锁';
  test(`${L}：在途期间会话换成另一份凭证（同页同实例、来源刷新令牌不同）：不能合并进旧刷新`, async () => {
    const f = fixture(withLocks);
    const g1 = f.gateOn(1);
    const sp = f.sync.syncNow({ manual: true });
    await bounded(g1.entered.promise, 'refresh');
    // 另一页写回了同一个登录实例、但很快又要过期的新凭证；本页下一次用令牌前会采用它，它自己需要刷新
    const newer = f.issue(A, 40_000);
    f.storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: newer }));
    const dp = f.sync.deleteAccount();
    await sleep(40);
    assert.equal(f.refreshes(), 2, 'G14_KEY_RT 来源刷新令牌不同，不能共用在途刷新：' + JSON.stringify(f.of('refresh')));
    assert.deepEqual(f.of('refresh').map(c => c.rt), [f.first.refreshToken, newer.refreshToken]);
    g1.release.resolve();
    await Promise.all([sp, dp]);
  });

  test(`${L}：旧登录在途时本机退出并恢复出相同的凭证和实例（只有账号代次不同）：新操作不能合并进旧刷新`, async () => {
    const f = fixture(withLocks);
    const g1 = f.gateOn(1);
    const old = f.sync.syncNow({ manual: true });
    await bounded(g1.entered.promise, 'refresh');
    assert.equal((await f.sync.forceLocalLogout()).ok, true);
    saveAccount(f.storage, A, { doc: f.rows.get(A).doc, base: 1, dirty: {} }, { now: f.now() });
    setCurrentAccount(f.storage, A);
    f.storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: f.first }));
    assert.ok(f.sync.restore(freshState()), '恢复出同一份凭证、同一个登录实例');
    const nd = f.sync.deleteAccount();
    await sleep(40);
    assert.equal(f.refreshes(), 2, 'G14_KEY_GEN 账号代次不同，不能共用旧登记：' + JSON.stringify(f.of('refresh')));
    g1.release.resolve();
    const oldRes = await old;
    assert.equal(oldRes.stale, true, JSON.stringify(oldRes));
    await nd;
    assert.equal(f.stored().accessToken, f.first.accessToken, 'G14_ISOLATE 旧代次的刷新结果不得写进恢复出来的新会话 / 存储：' + JSON.stringify(f.stored()));
  });
}
