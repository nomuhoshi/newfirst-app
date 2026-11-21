// G-LOGIN-05：假存储 / 假 API；不联网，不读取真实账号。restore() 仍以 null 表示失败。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY, STALE_KEY, scopedStorage, projectNamespace } from '../src/sync.js';
import { SESSION_KEY, PENDING_IMPORT_PREFIX, saveAccount, setCurrentAccount, loadAccount } from '../src/account-store.js';
import { emptyDoc, sumXp } from '../src/account-data.js';
import { freshState, loadState, saveState, addXp } from '../src/storage.js';
import { createAccountUi } from '../src/account-ui.js';

const A = 'restoreA', B = 'restoreB', NOW = 1_800_000_000_000;
const PROJECT = 'restore.test.invalid', LEGACY = 'legacy.test.invalid';
function fixture(scoped = false) {
  const m = new Map(), faults = new Map(), hooks = {}, calls = [];
  const raw = {
    get length() { return m.size; }, key(i) { return [...m.keys()][i] ?? null; },
    getItem(k) {
      const v = m.has(k) ? m.get(k) : null;
      hooks.get?.(k, v);
      if (faults.has(k)) { const f = faults.get(k); if (f === 'throw') throw new Error('synthetic storage failure'); return f; }
      return v;
    },
    setItem(k, v) { m.set(k, String(v)); }, removeItem(k) { m.delete(k); },
  };
  const project = scoped ? PROJECT : LEGACY, ns = projectNamespace(project, LEGACY);
  const storage = scopedStorage(raw, ns), key = k => ns + k;
  const sess = (uid = A, instance = 'old') => ({ userId: uid, email: uid + '@example.test', accessToken: 'fake-at-' + instance, refreshToken: 'fake-rt-' + instance, expiresAt: NOW + 3_600_000 });
  const seed = (uid = A, instance = 'old', xp = uid === A ? 120 : 300) => {
    const doc = emptyDoc({ lineage: 'lineage-' + uid }); doc.xp.device = xp;
    assert.equal(saveAccount(storage, uid, { doc, base: 1, dirty: {} }, { now: NOW }), true);
    assert.equal(setCurrentAccount(storage, uid), true);
    storage.setItem(AUTH_KEY, JSON.stringify({ project, instanceId: instance, session: sess(uid, instance) }));
  };
  const api = Object.fromEntries(['getProgress', 'refresh', 'createProgress', 'saveProgress', 'signOut', 'verifyCode', 'sendCode'].map(method => [method, async () => {
    calls.push(method); return { ok: false, kind: 'network', message: 'synthetic offline' };
  }]));
  const sync = createSync({ storage: raw, api, projectId: project, legacyProject: LEGACY, now: () => NOW, schedule: () => 0, retryLocks: {} });
  const snapshot = () => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
  return { raw, m, faults, hooks, storage, key, seed, sync, calls, snapshot, sess, project };
}
function failed(f, target = 'account') {
  assert.equal(f.sync.restore(freshState()), null);
  assert.equal(f.sync.account(), null);
  assert.equal(f.sync.status().status, null);
  assert.equal(f.sync.restoreError()?.target, target);
}

for (const scoped of [false, true]) {
  const label = scoped ? '项目命名空间' : '正式兼容键';
  test(label + '：确实无账号是普通游客，无错误、不写键、不联网', () => {
    const f = fixture(scoped), before = f.snapshot();
    assert.equal(f.sync.restore(freshState()), null);
    assert.equal(f.sync.restoreError(), null);
    assert.equal(f.sync.account(), null); assert.equal(f.sync.status().status, null);
    assert.equal(f.snapshot(), before); assert.deepEqual(f.calls, []);
    assert.equal(f.sync.retryRestore(freshState()).stale, true);
  });
  for (const target of ['session', 'account', 'auth']) {
    for (const value of ['throw', undefined, {}, 42]) {
      test(label + '：' + target + ' 读取异常 ' + String(value) + '，原文保留，解除后手动恢复', () => {
        const f = fixture(scoped); f.seed();
        const k = f.key(target === 'session' ? SESSION_KEY : target === 'auth' ? AUTH_KEY : 'suipian.acct.' + A);
        const before = f.snapshot(); f.faults.set(k, value); failed(f, target);
        const issue = f.sync.restoreError();
        assert.equal(issue.code, 'read-failed'); assert.equal(issue.retryable, true);
        issue.code = 'mutated'; assert.equal(f.sync.restoreError().code, 'read-failed');
        assert.equal(f.sync.persistLocal({ ...freshState(), xp: 25 }).code, 'no-account');
        const again = f.sync.retryRestore(freshState());
        assert.equal(again.ok, false); assert.equal(again.error.code, 'read-failed');
        assert.equal(f.snapshot(), before); assert.deepEqual(f.calls, []);
        f.faults.clear(); const r = f.sync.retryRestore(freshState());
        assert.equal(r.ok, true); assert.equal(r.restored.state.xp, 120);
        assert.equal(f.sync.account().userId, A); assert.equal(f.sync.restoreError(), null);
        assert.equal(f.snapshot(), before); assert.deepEqual(f.calls, []);
      });
    }
  }
  for (const [raw, code, retryable] of [[null, 'missing', true], ['{bad json', 'corrupt', false], [JSON.stringify({ doc: { ...emptyDoc(), schema: 999 } }), 'schema-newer', false]]) {
    test(label + '：副本 ' + code + ' 分清原因，保留原文，不伪造恢复成功', () => {
      const f = fixture(scoped); f.seed(); const k = f.key('suipian.acct.' + A);
      if (raw === null) f.raw.removeItem(k); else f.raw.setItem(k, raw);
      const before = f.snapshot(); failed(f);
      assert.equal(f.sync.restoreError().code, code); assert.equal(f.sync.restoreError().retryable, retryable);
      assert.equal(f.sync.retryRestore(freshState()).ok, false);
      assert.equal(f.snapshot(), before); assert.deepEqual(f.calls, []);
    });
  }
  for (const mode of ['absent', 'inert', 'other']) {
    test(label + '：凭证确实 ' + mode + '，保留账号本机进度并沿用 need-login', () => {
      const f = fixture(scoped); f.seed();
      if (mode === 'absent') f.storage.removeItem(AUTH_KEY);
      if (mode === 'inert') f.storage.setItem(AUTH_KEY, '{bad auth');
      if (mode === 'other') f.storage.setItem(AUTH_KEY, JSON.stringify({ project: 'foreign.invalid', instanceId: 'foreign', session: f.sess() }));
      const auth = f.storage.getItem(AUTH_KEY), copy = f.storage.getItem('suipian.acct.' + A);
      const r = f.sync.restore(freshState());
      assert.equal(r.state.xp, 120); assert.equal(f.sync.status().status, 'need-login');
      assert.equal(f.sync.restoreError(), null); assert.equal(f.storage.getItem(AUTH_KEY), auth);
      assert.equal(f.storage.getItem('suipian.acct.' + A), copy); assert.deepEqual(f.calls, []);
      if (mode === 'other') assert.equal(JSON.parse(f.storage.getItem(STALE_KEY)).userId, A);
    });
  }
  for (const stage of ['copy', 'pending']) {
    for (const mode of ['switch', 'logout', 'pointer-only-logout', 'relogin', 'auth-clear', 'instance-clear', 'rotate']) {
      test(label + '：读取 ' + stage + ' 期间 ' + mode + '，提交前复查身份', () => {
        const f = fixture(scoped); f.seed();
        const trigger = f.key(stage === 'copy' ? 'suipian.acct.' + A : PENDING_IMPORT_PREFIX + A);
        f.hooks.get = k => {
          if (k !== trigger) return; delete f.hooks.get;
          if (mode === 'switch') f.seed(B);
          if (mode === 'logout' || mode === 'pointer-only-logout') f.storage.removeItem(SESSION_KEY);
          if (mode === 'logout' || mode === 'auth-clear') f.storage.removeItem(AUTH_KEY);
          if (mode === 'relogin') f.seed(A, 'new');
          if (mode === 'instance-clear' || mode === 'rotate') {
            const a = JSON.parse(f.storage.getItem(AUTH_KEY));
            if (mode === 'instance-clear') delete a.instanceId;
            else { a.session.accessToken = 'fake-rotated-at'; a.session.refreshToken = 'fake-rotated-rt'; }
            f.storage.setItem(AUTH_KEY, JSON.stringify(a));
          }
        };
        const r = f.sync.restore(freshState());
        if (mode === 'rotate') { assert.equal(r.state.xp, 120); assert.equal(f.sync.account().userId, A); }
        else { assert.equal(r, null); assert.equal(f.sync.account(), null); assert.equal(f.sync.restoreError(), null); }
        assert.deepEqual(f.calls, []);
      });
    }
  }
  for (const mode of ['switch', 'logout', 'relogin', 'rotate']) {
    test(label + '：失败后、重试前 ' + mode + '，旧按钮不接管新登录', () => {
      const f = fixture(scoped); f.seed(); f.faults.set(f.key('suipian.acct.' + A), 'throw'); failed(f);
      f.faults.clear();
      if (mode === 'switch') f.seed(B);
      if (mode === 'logout') { f.storage.removeItem(SESSION_KEY); f.storage.removeItem(AUTH_KEY); }
      if (mode === 'relogin') f.seed(A, 'new');
      if (mode === 'rotate') { const a = JSON.parse(f.storage.getItem(AUTH_KEY)); a.session.accessToken = 'fake-rotated'; f.storage.setItem(AUTH_KEY, JSON.stringify(a)); }
      const before = f.snapshot(), r = f.sync.retryRestore(freshState());
      if (mode === 'rotate') assert.equal(r.restored.state.xp, 120);
      else { assert.equal(r.stale, true); assert.equal(f.sync.account(), null); assert.equal(f.sync.restoreError(), null); }
      assert.equal(f.snapshot(), before); assert.deepEqual(f.calls, []);
    });
  }
  for (const mode of ['switch', 'logout', 'relogin']) {
    test(label + '：存储事件协调 ' + mode + '，仅清旧提示，不自动接管账号', () => {
      const f = fixture(scoped); f.seed(); f.faults.set(f.key('suipian.acct.' + A), 'throw'); failed(f); f.faults.clear();
      if (mode === 'switch') f.seed(B);
      if (mode === 'logout') f.storage.removeItem(SESSION_KEY);
      if (mode === 'relogin') f.seed(A, 'new');
      const before = f.snapshot(), rec = f.sync.reconcileSession();
      assert.equal(rec.restoreChanged, true); assert.equal(f.sync.restoreError(), null);
      assert.equal(f.sync.account(), null); assert.equal(f.snapshot(), before);
    });
  }
}

test('同页读取回调中另一次恢复已完成，旧恢复不得改新账号及错误', () => {
  const f = fixture(); f.seed();
  f.hooks.get = k => { if (k === 'suipian.acct.' + A) { delete f.hooks.get; f.seed(B); assert.equal(f.sync.restore().userId, B); } };
  assert.equal(f.sync.restore(), null); assert.equal(f.sync.account().userId, B);
  assert.equal(f.sync.restoreError(), null); assert.equal(f.sync.retryRestore().stale, true);
});
test('本页新验证流程取代读取中的恢复，旧恢复不创建旧错误', () => {
  const f = fixture(); f.seed();
  f.hooks.get = k => { if (k === 'suipian.acct.' + A) { delete f.hooks.get; f.sync.clearVerified(); } };
  assert.equal(f.sync.restore(), null); assert.equal(f.sync.restoreError(), null);
});
test('读取失败后的提示在账号代次前进并退出后不会复活', async () => {
  const f = fixture(); f.seed(); f.faults.set('suipian.acct.' + A, 'throw'); failed(f); f.faults.clear();
  assert.equal(f.sync.restore().userId, A); await f.sync.forceLocalLogout();
  assert.equal(f.sync.restoreError(), null);
});
test('后发恢复仍然失败时，旧恢复不得覆盖后发错误或提交账号', () => {
  const f = fixture(); f.seed();
  f.hooks.get = k => {
    if (k !== 'suipian.acct.' + A) return; delete f.hooks.get;
    f.faults.set(AUTH_KEY, 'throw'); assert.equal(f.sync.restore(), null); f.faults.clear();
  };
  assert.equal(f.sync.restore(), null); assert.equal(f.sync.account(), null);
  assert.equal(f.sync.restoreError().target, 'auth');
});
test('协调读取期间新恢复接管账号，旧协调不清新状态且不抛异常', () => {
  const f = fixture(); f.seed(); f.faults.set('suipian.acct.' + A, 'throw'); failed(f); f.faults.clear();
  f.hooks.get = k => { if (k === SESSION_KEY) { delete f.hooks.get; f.seed(B); assert.equal(f.sync.restore().userId, B); } };
  const r = f.sync.reconcileSession(); assert.equal(r.stale, true);
  assert.equal(f.sync.account().userId, B); assert.equal(f.sync.restoreError(), null);
});
test('提交前AUTH才变不可读：保持游客与可重试提示，不误报 need-login', () => {
  const f = fixture(); f.seed(); let reads = 0;
  f.hooks.get = k => { if (k === AUTH_KEY && ++reads === 2) { delete f.hooks.get; f.faults.set(AUTH_KEY, 'throw'); } };
  failed(f, 'auth'); assert.equal(f.sync.restoreError().retryable, true);
  f.faults.clear(); assert.equal(f.sync.retryRestore().restored.state.xp, 120);
});
test('读取途中已确认退出，即使AUTH同时不可读，也不能挂上旧账号错误', () => {
  const f = fixture(); f.seed();
  f.hooks.get = k => {
    if (k !== 'suipian.acct.' + A) return; delete f.hooks.get;
    f.storage.removeItem(SESSION_KEY); f.faults.set(AUTH_KEY, 'throw');
  };
  assert.equal(f.sync.restore(), null); assert.equal(f.sync.account(), null); assert.equal(f.sync.restoreError(), null);
});
test('无instanceId旧格式可恢复；读取途中出现新登录实例则中止', () => {
  const f = fixture(); f.seed(A, null); assert.equal(f.sync.restore().state.xp, 120);
  const g = fixture(); g.seed(A, null);
  g.hooks.get = k => { if (k === 'suipian.acct.' + A) { delete g.hooks.get; g.seed(A, 'new'); } };
  assert.equal(g.sync.restore(), null); assert.equal(g.sync.account(), null);
});
test('真实 storage.js 持久化：游客 15→25→刷新仍25；120 XP账号原文不变，恢复不自动合并', t => {
  const f = fixture(); f.seed();
  const prev = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: f.raw });
  t.after(() => { if (prev) Object.defineProperty(globalThis, 'localStorage', prev); else delete globalThis.localStorage; });
  f.raw.setItem('suipian.progress', JSON.stringify({ ...freshState(), onboarded: true, xp: 15 }));
  const copy = f.raw.getItem('suipian.acct.' + A), state = loadState().state;
  assert.equal(state.xp, 15); f.faults.set('suipian.acct.' + A, 'throw'); failed(f);
  addXp(state, 10); assert.equal(saveState(state), true);
  assert.equal(loadState().state.xp, 25);
  assert.equal(f.m.get('suipian.acct.' + A), copy); // 故障仍开着：检查底层假存储原文，不绕回故意抛错的读取接口。
  f.faults.clear(); const r = f.sync.retryRestore(loadState().state);
  assert.equal(r.restored.state.xp, 120); assert.equal(loadState().state.xp, 25);
  assert.equal(sumXp(loadAccount(f.raw, A).copy.doc), 120); assert.equal(f.raw.getItem('suipian.acct.' + A), copy);
});

function fakeNode(tag, attrs = {}, ...children) {
  return { tag, attrs, children: children.flat().filter(x => x != null), textContent: attrs.text || '',
    append(...xs) { this.children.push(...xs); } };
}
function find(n, attr) {
  if (!n || typeof n !== 'object') return null;
  if (Object.hasOwn(n.attrs || {}, attr)) return n;
  for (const c of n.children || []) { const r = find(c, attr); if (r) return r; }
  return null;
}
function uiFixture(f) {
  const events = []; let state = { ...freshState(), xp: 25 };
  f.sync.syncNow = () => { events.push(['sync', state.xp]); return Promise.resolve({ ok: true }); };
  const ui = createAccountUi({ h: fakeNode, button: (text, click, cls, attrs = {}) => Object.assign(fakeNode('button', { ...attrs, text, class: cls }), { click }),
    icon: () => fakeNode('i'), sheet: () => {}, getState: () => state, sync: f.sync, api: { configured: true },
    rerender: () => events.push(['render']), showToast: text => events.push(['toast', state.xp, text]),
    onSwitchedIn: r => { state = r.state; events.push(['state', state.xp]); }, onSwitchedOut: () => {} });
  return { ui, events, state: () => state };
}
test('恢复入口在地图和账号卡片可见；先切换state，再提示及后台同步', () => {
  const f = fixture(); f.seed(); f.faults.set('suipian.acct.' + A, 'throw'); failed(f);
  const u = uiFixture(f); assert.ok(find(u.ui.accountRow(), 'data-restore-error'));
  const retry = find(u.ui.accountCard(), 'data-retry-restore'); assert.ok(retry);
  f.faults.clear(); retry.click();
  assert.equal(u.state().xp, 120); assert.deepEqual(u.events.map(x => x.slice(0, 2)), [['state', 120], ['toast', 120], ['sync', 120]]);
  assert.equal(retry.disabled, false);
});
test('恢复仍失败时按钮复位；旧按钮失效时无旧成功/失败提示、不触发同步', () => {
  const f = fixture(); f.seed(); f.faults.set('suipian.acct.' + A, 'throw'); failed(f);
  const u = uiFixture(f), retry = find(u.ui.accountCard(), 'data-retry-restore'); retry.click();
  assert.equal(retry.disabled, false); assert.equal(u.state().xp, 25); assert.equal(u.events.some(x => x[0] === 'sync'), false);
  u.events.length = 0; f.faults.clear(); f.seed(B); retry.click();
  assert.deepEqual(u.events, [['render']]); assert.equal(f.sync.account(), null); assert.equal(u.state().xp, 25);
});
test('永久损坏 / 新版本副本保留原文，账号卡片不提供虚假恢复按钮', () => {
  for (const raw of ['{bad json', JSON.stringify({ doc: { ...emptyDoc(), schema: 999 } })]) {
    const f = fixture(); f.seed(); f.raw.setItem('suipian.acct.' + A, raw); failed(f);
    const u = uiFixture(f); assert.ok(find(u.ui.accountCard(), 'data-restore-error'));
    assert.equal(find(u.ui.accountCard(), 'data-retry-restore'), null);
    assert.equal(f.raw.getItem('suipian.acct.' + A), raw);
  }
});
