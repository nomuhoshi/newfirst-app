// 整合测试：R1「损坏导入待办硬锁」× DB-3.1「refresh 失败只有明确死亡码才算已退出」
// 真实 createApi → createSync，只替换 fetch；不接任何 Supabase 项目。
// 运行：node tests/r1-exit-interaction.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../src/cloud-api.js';
import { createSync, AUTH_KEY } from '../src/sync.js';
import { GUEST_KEY, DEVICE_KEY, SESSION_KEY, saveAccount, setCurrentAccount, getCurrentAccount } from '../src/account-store.js';
import { emptyDoc } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const NOW = 1_000_000;
const TODAY = '2026-11-05';
const UID = 'uInteract';
const PENDING_KEY = `suipian.acct.import.${UID}`;
const SESSION = () => ({ userId: UID, email: 'x@example.test', accessToken: 'fake-at', refreshToken: 'fake-rt', expiresAt: NOW + 3_600_000 });

function mem() {
  const m = new Map();
  return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
const json = (status, body) => ({ ok: false, status, text: async () => JSON.stringify(body) });
const BAD_JWT = json(403, { code: 403, error_code: 'bad_jwt', msg: 'invalid JWT: token is expired' });
const REFRESH_GENERIC_403 = json(403, { code: 403, error_code: 'not_admin', msg: 'User not allowed' });
const REFRESH_DEAD = json(400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });

function fixture({ pendingRaw = '{bad json', readFailure = false, refreshReply = REFRESH_DEAD, wrap = null } = {}) {
  const raw = mem(); raw.setItem(DEVICE_KEY, 'devX');
  const guestRaw = JSON.stringify({ ...freshState(), onboarded: true, xp: 40, lessonsCompleted: 3, done: { U1L1: true }, streak: 1, lastDay: TODAY });
  raw.setItem(GUEST_KEY, guestRaw);
  assert.equal(saveAccount(raw, UID, { doc: emptyDoc({ gen: 1, lineage: 'L-x' }), base: 3, dirty: { content: false, hearts: false, prefs: false } }, { now: NOW }), true);
  assert.equal(setCurrentAccount(raw, UID), true);
  raw.setItem(AUTH_KEY, JSON.stringify({ session: SESSION() }));
  if (pendingRaw !== null) raw.setItem(PENDING_KEY, pendingRaw);
  let storage = readFailure ? { ...raw, getItem(k) { if (k === PENDING_KEY) throw new Error('storage read failure'); return raw.getItem(k); } } : raw;
  if (wrap) storage = wrap(raw);
  const urls = [];
  const fetchFn = async (url) => {
    urls.push(String(url));
    if (String(url).includes('/auth/v1/logout')) return BAD_JWT;
    if (String(url).includes('/auth/v1/token')) return refreshReply;
    return json(500, { msg: 'unexpected' });
  };
  const api = createApi({ url: 'https://x.supabase.co', anonKey: 'anon', fetchFn });
  const sync = createSync({ storage, api, now: () => NOW, today: () => TODAY, schedule: () => 1 });
  sync.restore(freshState());
  const snap = () => ({ guest: raw.getItem(GUEST_KEY), pending: raw.getItem(PENDING_KEY), account: raw.getItem(`suipian.acct.${UID}`), auth: raw.getItem(AUTH_KEY), pointer: getCurrentAccount(raw) });
  return { raw, sync, urls, snap, guestRaw };
}

test('X1: 损坏待办 + 普通退出：被守卫拦下，零网络请求（不会走到 bad_jwt → refresh），数据原样', async () => {
  for (const refreshReply of [REFRESH_DEAD, REFRESH_GENERIC_403]) {
    const f = fixture({ refreshReply }); const before = f.snap();
    const r = await f.sync.logout();
    assert.equal(r.ok, false); assert.equal(r.kind, 'import-corrupt');
    assert.deepEqual(f.urls, []);
    assert.deepEqual(f.snap(), before);
  }
});

test('X2: 读取失败的待办 + 普通退出：同样被拦，零网络请求', async () => {
  const f = fixture({ readFailure: true, pendingRaw: 'whatever' }); const before = f.snap();
  const r = await f.sync.logout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'import-read-failed');
  assert.deepEqual(f.urls, []);
  assert.deepEqual(f.snap(), before);
});

test('X3: 损坏待办 + 强制本机退出（forceLocalLogout 与 logout({force:true})）：零网络请求，游客/待办/账号副本原样，凭证与账号指针清掉', async () => {
  for (const act of [(s) => s.forceLocalLogout(), (s) => s.logout({ force: true })]) {
    const f = fixture(); const before = f.snap();
    const r = await act(f.sync);
    assert.equal(r.ok, true); assert.equal(r.cloudSessionMaybeValid, true);
    assert.deepEqual(f.urls, []);
    const after = f.snap();
    assert.equal(after.guest, before.guest); assert.equal(after.pending, '{bad json');
    assert.equal(after.account, before.account);
    assert.equal(after.auth, null); assert.equal(after.pointer, null);
  }
});

test('X4: 对照（待办正常）+ bad_jwt 后刷新返回通用 403：不算已退出，本机原样（守卫不会误伤，DB-3.1 规则照常生效）', async () => {
  const f = fixture({ pendingRaw: null, refreshReply: REFRESH_GENERIC_403 }); const before = f.snap();
  const r = await f.sync.logout();
  assert.equal(r.ok, false); assert.equal(r.stayed, true);
  assert.equal(f.urls.filter((u) => u.includes('/auth/v1/logout')).length, 1);
  assert.equal(f.urls.filter((u) => u.includes('/auth/v1/token')).length, 1);
  assert.deepEqual(f.snap(), before);
});

test('X5: 对照（待办正常）+ bad_jwt 后刷新返回明确死亡码：才算已退出', async () => {
  const f = fixture({ pendingRaw: null, refreshReply: REFRESH_DEAD });
  const r = await f.sync.logout();
  assert.equal(r.ok, true);
  assert.equal(f.snap().pointer, null);
});

test('X6: 故障注入——凭证删除「静默无效」（不抛错但没删掉）：强制退出必须读回发现，回滚账号指针，报告失败，数据原样', async () => {
  const f = fixture({ wrap: (raw) => ({ ...raw, removeItem(k) { if (k === AUTH_KEY) return; return raw.removeItem(k); } }) });
  const before = f.snap();
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local'); assert.equal(r.rollbackFailed, false);
  assert.deepEqual(f.urls, []);
  assert.deepEqual(f.snap(), before, '指针已回滚，凭证、游客、损坏待办、账号副本全部原样');
});

test('X7: 故障注入——账号指针「删掉后才报错」但回滚可用：强制退出失败，指针恢复，rollbackFailed=false，数据原样', async () => {
  const f = fixture({ wrap: (raw) => ({ ...raw, removeItem(k) { if (k === SESSION_KEY) { raw.removeItem(k); throw new Error('removed then failed'); } return raw.removeItem(k); } }) });
  const before = f.snap();
  const r = await f.sync.forceLocalLogout();
  assert.equal(r.ok, false); assert.equal(r.kind, 'local'); assert.equal(r.rollbackFailed, false);
  assert.deepEqual(f.urls, []);
  assert.deepEqual(f.snap(), before);
});
