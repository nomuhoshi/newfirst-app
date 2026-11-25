// G-LOGIN-13：游客导入全链路刷新令牌后，后续读取 / 创建 / 保存 / 读回和收尾落盘都用刷新之后的会话。
// 纯 Node、假接口：服务端对令牌严格判断（刷新后旧访问令牌立即作废，过期也作废）；不联网、不读取任何真实账号。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY, scopedStorage, projectNamespace } from '../src/sync.js';
import { GUEST_KEY, GUEST_ID_KEY, DEVICE_KEY, saveAccount, setCurrentAccount, savePendingImport, loadPendingImport } from '../src/account-store.js';
import { emptyDoc, guestFingerprint, sumXp } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const T0 = 1_000_000, PROJECT = 'g13.test.invalid', A = 'tokA', B = 'tokB', LIFE = 3_600_000;
const clone = x => JSON.parse(JSON.stringify(x));
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function bounded(p, label) {
  let timer;
  try { return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('门闩未到达：' + label)), 3000); })]); }
  finally { clearTimeout(timer); }
}
function locks() {
  const chains = new Map();
  return { request(name, _o, fn) { const prev = chains.get(name) || Promise.resolve(); const next = prev.then(fn, fn); chains.set(name, next.catch(() => {})); return next; } };
}

function fixture(withLocks, { cloudRow = true } = {}) {
  let clock = T0, seq = 0;
  const m = new Map(), calls = [], hooks = {}, gates = [], exp = new Map(), revoked = new Set(), liveRt = new Map();
  const raw = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => { m.delete(k); } };
  const storage = scopedStorage(raw, projectNamespace(PROJECT, 'legacy.invalid'));
  const guest = { ...freshState(), onboarded: true, xp: 80, heartsAt: T0, done: { U1L1: true }, lessonsCompleted: 1 };
  raw.setItem(GUEST_KEY, JSON.stringify(guest)); raw.setItem(GUEST_ID_KEY, 'g13Guest'); raw.setItem(DEVICE_KEY, 'g13Device');
  const rows = new Map();
  for (const uid of [A, B]) { const d = emptyDoc({ lineage: 'lin-' + uid }); d.xp.cloud = uid === A ? 40 : 70; rows.set(uid, { doc: d, rev: 1 }); }
  if (!cloudRow) rows.delete(A);
  const issue = (uid, life = LIFE) => {
    const n = ++seq, s = { userId: uid, email: uid + '@example.test', accessToken: `at-${uid}-${n}`, refreshToken: `rt-${uid}-${n}`, expiresAt: clock + life };
    exp.set(s.accessToken, s.expiresAt); liveRt.set(s.refreshToken, uid); return s;
  };
  const valid = s => !!s && exp.has(s.accessToken) && !revoked.has(s.accessToken) && clock < exp.get(s.accessToken);
  const unauth = { ok: false, kind: 'auth', status: 401, message: 'JWT expired' };
  async function gate(method, sess) {
    const g = gates.find(x => !x.used && x.method === method);
    if (!g) return null;
    g.used = true; g.entered.resolve(); await g.release.promise; return g.reply ? clone(g.reply) : null;
  }
  const api = {
    async verifyCode(email) { return { ok: true, session: issue(email.split('@')[0]) }; },
    async sendCode() { return { ok: true }; },
    async refresh(sess) {
      calls.push({ method: 'refresh', at: sess.accessToken });
      const g = await gate('refresh', sess); if (g) return g;
      if (hooks.refreshFails) return { ok: false, kind: 'network', message: '网络连不上' };
      const uid = liveRt.get(sess.refreshToken);
      if (!uid) return { ok: false, kind: 'auth', status: 400, message: 'Invalid Refresh Token' };
      liveRt.delete(sess.refreshToken); revoked.add(sess.accessToken); // 严格：刷新后旧访问令牌立即作废
      return { ok: true, session: issue(uid) };
    },
    async getProgress(sess) {
      calls.push({ method: 'get', at: sess?.accessToken });
      await gate('get', sess);
      const r = valid(sess) ? { ok: true, row: rows.has(sess.userId) ? clone(rows.get(sess.userId)) : null } : unauth;
      hooks.afterGet?.(sess, calls.filter(c => c.method === 'get').length);
      return r;
    },
    async createProgress(sess, doc) {
      calls.push({ method: 'create', at: sess.accessToken });
      if (!valid(sess)) return unauth;
      if (rows.has(sess.userId)) return { ok: true, rev: null };
      rows.set(sess.userId, { rev: 1, doc: clone(doc) }); return { ok: true, rev: 1 };
    },
    async saveProgress(sess, rev, doc) {
      calls.push({ method: 'save', at: sess.accessToken });
      if (!valid(sess)) return unauth;
      hooks.beforeSave?.(sess);
      const row = rows.get(sess.userId);
      if (!row || row.rev !== rev) return { ok: true, rev: null };
      rows.set(sess.userId, { rev: rev + 1, doc: clone(doc) });
      hooks.afterSave?.(sess);
      return { ok: true, rev: rev + 1 };
    },
    async signOut() { return { ok: true }; },
  };
  const provider = withLocks ? locks() : {};
  const make = () => createSync({ storage: raw, api, projectId: PROJECT, legacyProject: 'legacy.invalid', now: () => clock, schedule: () => 0, retryLocks: provider });
  const sync = make();
  // 登录 A（已登录实例）：共享存储里是一份完整登录凭证
  const seedA = () => {
    saveAccount(storage, A, { doc: rows.get(A)?.doc ?? emptyDoc({ lineage: 'lin-' + A }), base: rows.get(A)?.rev ?? null, dirty: {} }, { now: clock });
    setCurrentAccount(storage, A);
    storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'inst-A-1', session: issue(A) }));
  };
  seedA();
  assert.ok(sync.restore(freshState()));
  const expireSoon = sess => { clock = exp.get(sess.accessToken) - 30_000; }; // 距过期不足 60 秒：下次用令牌前必须刷新
  const addPending = choice => {
    const rec = { version: 1, userId: A, guestId: 'g13Guest', choice, fingerprint: guestFingerprint(guest), guestState: clone(guest), guestRaw: raw.getItem(GUEST_KEY), createdAt: clock };
    assert.equal(savePendingImport(storage, A, rec), true);
  };
  const stored = () => JSON.parse(storage.getItem(AUTH_KEY)).session;
  const afterRefresh = () => { const i = calls.findIndex(c => c.method === 'refresh'); return i < 0 ? [] : calls.slice(i + 1).filter(c => c.method !== 'refresh'); };
  const gateOn = (method, reply = null) => { const g = { method, reply, used: false, entered: defer(), release: defer() }; gates.push(g); return g; };
  return { raw, storage, m, calls, hooks, rows, sync, make, guest, issue, expireSoon, addPending, stored, afterRefresh, gateOn, seedA,
    advance: ms => { clock += ms; }, snapshot: () => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b))),
    refreshes: () => calls.filter(c => c.method === 'refresh').length, pendingLeft: () => loadPendingImport(storage, A).record };
}
// 第一次保存时发生 CAS 冲突（别的设备抢先写）并且令牌进入刷新窗口。
const conflictThenExpire = f => { let done = false; f.hooks.beforeSave = sess => { if (done) return; done = true; f.rows.get(A).rev += 1; f.expireSoon(sess); }; };

for (const withLocks of [false, true]) {
  const L = withLocks ? '模拟 Web Locks' : '无锁';
  for (const choice of ['cloud', 'merge']) {
    const expectXp = choice === 'cloud' ? 40 : 120;
    test(`${L}：同步重试待办（${choice}）CAS 冲突 + 刷新后，重读 / 保存 / 读回都用新令牌`, async () => {
      const f = fixture(withLocks); f.addPending(choice); conflictThenExpire(f);
      const r = await f.sync.syncNow({ manual: true });
      assert.equal(r.ok, true, 'G13_REUSE ' + JSON.stringify(r));
      assert.equal(f.sync.status().status, 'synced', 'G13_REUSE 不得误报需要重新登录：' + JSON.stringify(f.sync.status()));
      assert.equal(f.refreshes(), 1);
      const post = f.afterRefresh();
      assert.ok(post.some(c => c.method === 'get') && post.some(c => c.method === 'save'), 'G13_REUSE 刷新后须有重读和保存：' + JSON.stringify(post));
      assert.ok(post.every(c => c.at.endsWith('-2') || c.at.endsWith('-3')) && !post.some(c => c.at.endsWith('-1')), 'G13_REUSE 刷新后的所有请求都不得带旧令牌：' + JSON.stringify(post));
      assert.equal(post.at(-1).method, 'get', 'G13_READBACK 最后一步是读回');
      assert.match(f.stored().accessToken, /-2$/, 'G13_FINAL 存储里是刷新后的令牌');
      assert.equal(sumXp(f.rows.get(A).doc), expectXp + 0, '积分只算一次');
      assert.equal(f.pendingLeft(), null, '待办已完成并清除');
      await f.sync.syncNow({ manual: true });
      assert.equal(sumXp(f.rows.get(A).doc), expectXp, '再同步一次不重复计分');
    });
    test(`${L}：恢复后重新选择（${choice}）CAS 冲突 + 刷新后用新令牌，收尾不回写旧令牌`, async () => {
      const f = fixture(withLocks);
      const v = await f.sync.resumeGuestImportChoice(freshState());
      assert.equal(v.needChoice, true);
      conflictThenExpire(f);
      const r = await f.sync.finishChoice(choice === 'cloud' ? 'cloud' : 'transfer');
      assert.equal(r.ok, true, 'G13_REUSE ' + JSON.stringify(r));
      assert.equal(r.synced, true, 'G13_REUSE 导入须同步完成：' + JSON.stringify(r));
      assert.equal(f.sync.status().status, 'synced', 'G13_REUSE ' + JSON.stringify(f.sync.status()));
      const post = f.afterRefresh();
      assert.ok(post.length >= 3 && !post.some(c => c.at.endsWith('-1')), 'G13_REUSE 刷新后的请求都不得带旧令牌：' + JSON.stringify(post));
      assert.match(f.stored().accessToken, /-2$/, 'G13_FINAL 收尾不得把旧令牌写回存储：' + f.stored().accessToken);
      assert.equal(sumXp(f.rows.get(A).doc), expectXp);
      assert.equal(f.refreshes(), 1, '后续同步不需要再刷新，也没有刷新令牌被复用');
      assert.equal((await f.sync.syncNow({ manual: true })).ok, true);
      assert.equal(f.refreshes(), 1);
    });
  }
  test(`${L}：写入成功后令牌进入刷新窗口：读回前刷新，读回用新令牌且校验通过`, async () => {
    const f = fixture(withLocks); f.addPending('cloud');
    f.hooks.afterSave = sess => f.expireSoon(sess);
    const r = await f.sync.syncNow({ manual: true });
    assert.equal(r.ok, true, 'G13_READBACK ' + JSON.stringify(r));
    assert.equal(f.sync.status().status, 'synced', 'G13_READBACK ' + JSON.stringify(f.sync.status()));
    const post = f.afterRefresh();
    assert.ok(post.length >= 1 && post.every(c => c.method === 'get' && /-2$/.test(c.at)), 'G13_READBACK 刷新后的读回及后续读取都用新令牌：' + JSON.stringify(post));
    assert.match(f.stored().accessToken, /-2$/);
  });
  test(`${L}：云端尚无记录时创建前刷新，创建用新令牌`, async () => {
    const f = fixture(withLocks, { cloudRow: false }); f.addPending('cloud');
    f.hooks.afterGet = (sess, n) => { if (n === 1) f.expireSoon(sess); };
    const r = await f.sync.syncNow({ manual: true });
    assert.equal(r.ok, true, 'G13_CREATE ' + JSON.stringify(r));
    const create = f.calls.find(c => c.method === 'create');
    assert.ok(create && /-2$/.test(create.at), 'G13_CREATE 创建须用刷新后的令牌：' + JSON.stringify(f.calls));
    assert.equal(f.sync.status().status, 'synced');
  });
  test(`${L}：刷新失败（断网）：游客与待办原样保留，不误报重新登录，不再发旧令牌请求`, async () => {
    const f = fixture(withLocks); f.addPending('merge'); conflictThenExpire(f);
    const guestRaw = f.raw.getItem(GUEST_KEY);
    f.hooks.refreshFails = true;
    const r = await f.sync.syncNow({ manual: true });
    assert.equal(r.ok, false, 'G13_FAIL');
    assert.notEqual(f.sync.status().status, 'need-login', 'G13_FAIL 刷新失败不是需要重新登录：' + JSON.stringify(f.sync.status()));
    assert.equal(f.raw.getItem(GUEST_KEY), guestRaw, 'G13_FAIL 游客记录保留');
    assert.ok(f.pendingLeft(), 'G13_FAIL 待办保留');
    assert.equal(f.afterRefresh().length, 0, 'G13_FAIL 刷新失败后不再发请求：' + JSON.stringify(f.afterRefresh()));
    assert.equal(sumXp(f.rows.get(A).doc), 40 + 0, 'G13_FAIL 云端只有别处写的 1 次冲突，没有重复计分');
  });
  for (const who of [B, A]) {
    test(`${L}：刷新在途时被取代（换成 ${who === A ? '同一账号重新登录' : '另一个账号'}）：旧任务作废，不借新会话继续`, async () => {
      const f = fixture(withLocks); f.addPending('merge'); conflictThenExpire(f);
      const g = f.gateOn('refresh');
      const p = f.sync.syncNow({ manual: true });
      await bounded(g.entered.promise, 'refresh');
      assert.equal((await f.sync.forceLocalLogout()).ok, true);
      const saved = f.raw.getItem(GUEST_KEY); f.raw.removeItem(GUEST_KEY);
      assert.equal((await f.sync.verify(who + '@example.test', '123456', freshState())).ok, true);
      f.raw.setItem(GUEST_KEY, saved);
      const before = f.snapshot(), reqs = f.calls.length, bRow = JSON.stringify(f.rows.get(B)), aRow = JSON.stringify(f.rows.get(A));
      g.release.resolve(); const r = await p;
      assert.equal(r.ok, false); assert.equal(r.stale, true, 'G13_STALE ' + JSON.stringify(r));
      assert.equal(f.calls.length, reqs, 'G13_STALE 旧任务不得再发任何请求：' + JSON.stringify(f.calls.slice(reqs)));
      assert.equal(f.snapshot(), before, 'G13_STALE 不改任何共享存储（含新登录凭证）');
      assert.equal(JSON.stringify(f.rows.get(B)), bRow); assert.equal(JSON.stringify(f.rows.get(A)), aRow);
      assert.equal(f.sync.account().userId, who);
    });
  }
  test(`${L}：验证码登录流程（尚未设全局会话）仍只用刚验证的会话，选择后正常完成`, async () => {
    const f = fixture(withLocks);
    assert.equal((await f.sync.forceLocalLogout()).ok, true);
    const v = await f.sync.verify(A + '@example.test', '123456', freshState());
    assert.equal(v.needChoice, true);
    const verifyTok = f.calls.at(-1).at;
    const r = await f.sync.finishChoice('transfer');
    assert.equal(r.ok, true, 'G13_LOGIN ' + JSON.stringify(r)); assert.equal(r.synced, true);
    assert.ok(f.calls.filter(c => c.method !== 'refresh').every(c => c.at === verifyTok), 'G13_LOGIN 登录流程里的请求都用验证得到的会话：' + JSON.stringify(f.calls));
    assert.equal(f.stored().accessToken, verifyTok);
    assert.equal(sumXp(f.rows.get(A).doc), 120);
  });
}
