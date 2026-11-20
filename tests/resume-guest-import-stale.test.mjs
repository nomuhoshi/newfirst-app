// G-LOGIN-04：纯 Node、假接口与门闩；不联网、不读取任何真实账号或存档。
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSync, AUTH_KEY, scopedStorage, projectNamespace } from '../src/sync.js';
import { createAccountUi } from '../src/account-ui.js';
import { SESSION_KEY, GUEST_KEY, GUEST_ID_KEY, DEVICE_KEY, saveAccount, setCurrentAccount } from '../src/account-store.js';
import { emptyDoc, guestFingerprint, sumXp } from '../src/account-data.js';
import { freshState } from '../src/storage.js';

const NOW = 1_000_000, PROJECT = 'resume.test.invalid', A = 'resumeA', B = 'resumeB';
const clone = x => JSON.parse(JSON.stringify(x));
const defer = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
async function bounded(p, label) {
  let timer;
  try { return await Promise.race([p, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('门闩未到达：' + label)), 3000); })]); }
  finally { clearTimeout(timer); }
}
function locks() {
  const chains = new Map();
  return { request(name, _opts, fn) {
    const prev = chains.get(name) || Promise.resolve();
    const next = prev.then(fn, fn);
    chains.set(name, next.catch(() => {}));
    return next;
  } };
}
function fixture(withLocks, { guestXp = 80, expiresIn = 3_600_000, imported = false } = {}) {
  const m = new Map(), hooks = {}, calls = [], gates = [];
  const raw = {
    getItem(k) { hooks.get?.(k); return m.has(k) ? m.get(k) : null; },
    setItem(k, v) { m.set(k, String(v)); },
    removeItem(k) { m.delete(k); },
  };
  const storage = scopedStorage(raw, projectNamespace(PROJECT, 'legacy.invalid'));
  const guest = { ...freshState(), onboarded: true, xp: guestXp, heartsAt: NOW, done: guestXp ? { U1L1: true } : {}, lessonsCompleted: guestXp ? 1 : 0 };
  raw.setItem(GUEST_KEY, JSON.stringify(guest));
  raw.setItem(GUEST_ID_KEY, 'resumeGuest');
  raw.setItem(DEVICE_KEY, 'resumeDevice');
  const rows = new Map();
  for (const uid of [A, B]) {
    const doc = emptyDoc({ lineage: 'lineage-' + uid });
    doc.xp.cloud = uid === A ? 40 : 70;
    if (imported) doc.imported.resumeGuest = guestFingerprint(guest);
    rows.set(uid, { doc, rev: 1 });
  }
  const session = (uid, tag, life = 3_600_000) => ({ userId: uid, email: uid + '@example.test', accessToken: 'at-' + uid + '-' + tag, refreshToken: 'rt-' + uid + '-' + tag, expiresAt: NOW + life });
  const snapshot = () => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
  function seedShared(uid, tag = 'seed') {
    assert.equal(saveAccount(storage, uid, { doc: rows.get(uid).doc, base: rows.get(uid).rev, dirty: {} }, { now: NOW }), true);
    assert.equal(setCurrentAccount(storage, uid), true);
    storage.setItem(AUTH_KEY, JSON.stringify({ project: PROJECT, instanceId: 'instance-' + uid + '-' + tag, session: session(uid, tag, tag === 'seed' ? expiresIn : 3_600_000) }));
  }
  seedShared(A);
  async function pause(method, sess, response) {
    calls.push({ method, uid: sess?.userId });
    const gate = gates.find(g => !g.used && g.method === method && g.match(sess, calls));
    if (!gate) return response;
    gate.used = true; gate.entered.resolve();
    await gate.release.promise;
    return gate.reply ? clone(gate.reply) : response;
  }
  let verifyTag = 0;
  const api = {
    async verifyCode(email) { return { ok: true, session: session(email.split('@')[0], 'verify' + ++verifyTag) }; },
    async sendCode() { return { ok: true }; },
    async refresh(sess) { return pause('refresh', sess, { ok: true, session: { ...sess, accessToken: sess.accessToken + '-rotated', refreshToken: sess.refreshToken + '-rotated', expiresAt: NOW + 3_600_000 } }); },
    async getProgress(sess) { return pause('get', sess, { ok: true, row: sess && rows.has(sess.userId) ? clone(rows.get(sess.userId)) : null }); },
    async createProgress(sess, doc) {
      calls.push({ method: 'create', uid: sess.userId });
      if (rows.has(sess.userId)) return { ok: true, rev: null };
      rows.set(sess.userId, { rev: 1, doc: clone(doc) }); return { ok: true, rev: 1 };
    },
    async saveProgress(sess, rev, doc) {
      calls.push({ method: 'save', uid: sess.userId });
      const row = rows.get(sess.userId);
      if (!row || row.rev !== rev) return { ok: true, rev: null };
      rows.set(sess.userId, { rev: rev + 1, doc: clone(doc) }); return { ok: true, rev: rev + 1 };
    },
    async signOut() { return { ok: true }; },
  };
  const provider = withLocks ? locks() : {};
  const make = () => createSync({ storage: raw, api, projectId: PROJECT, legacyProject: 'legacy.invalid', now: () => NOW, schedule: () => 0, retryLocks: provider });
  const sync = make(); assert.ok(sync.restore(freshState()));
  const gate = (method = 'get', match = () => true, reply = null) => {
    const g = { method, match, reply, used: false, entered: defer(), release: defer() };
    gates.push(g); return g;
  };
  async function relog(target, uid, keepGuest = false) {
    assert.equal((await target.forceLocalLogout()).ok, true);
    const savedGuest = raw.getItem(GUEST_KEY);
    if (!keepGuest) raw.removeItem(GUEST_KEY);
    const r = await target.verify(uid + '@example.test', '123456', freshState());
    if (!keepGuest && savedGuest !== null) raw.setItem(GUEST_KEY, savedGuest);
    assert.equal(r.ok, true);
    if (!keepGuest) assert.equal(target.account()?.userId, uid);
    return r;
  }
  return { raw, storage, m, hooks, calls, rows, sync, make, gate, relog, snapshot, seedShared, releaseAll: () => gates.forEach(g => g.release.resolve()) };
}
const stale = r => { assert.equal(r.ok, false); assert.equal(r.stale, true); assert.notEqual(r.needChoice, true); assert.notEqual(r.noChoiceNeeded, true); };

for (const withLocks of [false, true]) {
  const label = withLocks ? '模拟 Web Locks' : '无锁';
  test(label + '：第一个 await 前已绑定身份；同步退出后不得替旧操作发读取', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const p = f.sync.resumeGuestImportChoice(freshState());
    const out = f.sync.forceLocalLogout();
    await out; stale(await p);
    assert.equal(f.calls.filter(c => c.method === 'get').length, 0);
    assert.equal(f.sync.account(), null);
  });
  test(label + '：刷新挂起期间被取代，旧刷新不写新凭证', async t => {
    const f = fixture(withLocks, { expiresIn: 1000 }); t.after(f.releaseAll);
    const g = f.gate('refresh');
    const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'refresh');
    await f.relog(f.sync, B);
    const before = f.snapshot(); g.release.resolve(); stale(await p);
    assert.equal(f.snapshot(), before);
    assert.equal(f.sync.account().userId, B);
  });
  for (const mode of ['logout', 'other', 'same', 'tab-other', 'tab-same']) {
    for (const failure of [null, { ok: false, kind: 'server', status: 503, message: 'late 503' }, { ok: false, kind: 'auth', status: 403, message: 'late 403' }]) {
      test(label + '：读取迟到 ' + mode + ' / ' + (failure?.status || 'success'), async t => {
        const f = fixture(withLocks); t.after(f.releaseAll);
        const g = f.gate('get', () => true, failure);
        const p = f.sync.resumeGuestImportChoice(freshState());
        await bounded(g.entered.promise, mode);
        if (mode === 'logout') await f.sync.forceLocalLogout();
        else {
          const target = mode.startsWith('tab-') ? f.make() : f.sync;
          if (target !== f.sync) assert.ok(target.restore(freshState()));
          await f.relog(target, mode.endsWith('same') ? A : B);
        }
        const before = f.snapshot(), requests = f.calls.length;
        g.release.resolve(); stale(await p);
        assert.equal(f.snapshot(), before, '旧结果不能改任何共享存储');
        assert.equal(f.calls.length, requests, '旧结果不能替新账号发起同步');
        if (mode.startsWith('tab-')) assert.equal(f.sync.account(), null);
      });
    }
  }
  test(label + '：旧恢复不能覆盖退出后新账号的待选择记录', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const g = f.gate(); const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'new waiting');
    assert.equal((await f.relog(f.sync, B, true)).needChoice, true);
    const before = f.snapshot(); g.release.resolve(); stale(await p);
    assert.equal(f.snapshot(), before);
    const r = await f.sync.finishChoice('transfer');
    assert.equal(r.ok, true); assert.equal(r.account.userId, B);
    assert.equal(sumXp(f.rows.get(B).doc), 150);
    assert.equal(sumXp(f.rows.get(A).doc), 40);
  });
  test(label + '：新验证仍在读取、会话代次尚未变化时也取代旧恢复', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const g = f.gate(); const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'same-account verify');
    const gv = f.gate('get', s => s.accessToken.endsWith('verify1'));
    const v = f.sync.verify(A + '@example.test', '123456', freshState());
    await bounded(gv.entered.promise, 'new verify read');
    g.release.resolve(); stale(await p);
    gv.release.resolve(); assert.equal((await v).ok, true);
    assert.match(JSON.parse(f.storage.getItem(AUTH_KEY)).session.accessToken, /verify1$/);
  });
  for (const order of ['old-first', 'new-first']) {
    test(label + '：并发恢复后发有效 / ' + order, async t => {
      const f = fixture(withLocks); t.after(f.releaseAll);
      const g1 = f.gate(), g2 = f.gate();
      const p1 = f.sync.resumeGuestImportChoice(freshState());
      await bounded(g1.entered.promise, 'first');
      const p2 = f.sync.resumeGuestImportChoice(freshState());
      await bounded(g2.entered.promise, 'second');
      if (order === 'old-first') {
        g1.release.resolve(); stale(await p1); g2.release.resolve();
        assert.equal((await p2).needChoice, true);
      } else {
        g2.release.resolve(); assert.equal((await p2).needChoice, true);
        g1.release.resolve(); stale(await p1);
      }
      assert.equal((await f.sync.finishChoice('cloud')).ok, true);
    });
  }
  test(label + '：无需选择路径同步在途换号，返回顶层 stale', async t => {
    const f = fixture(withLocks, { guestXp: 0 }); t.after(f.releaseAll);
    const g = f.gate('get', (_s, calls) => calls.filter(c => c.method === 'get').length === 2);
    const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'syncNow');
    await f.relog(f.sync, B);
    const before = f.snapshot(); g.release.resolve(); stale(await p);
    assert.equal(f.snapshot(), before);
  });
  test(label + '：委托同步期间开始新验证，旧恢复不返回成功', async t => {
    const f = fixture(withLocks, { guestXp: 0 }); t.after(f.releaseAll);
    const g = f.gate('get', (_s, calls) => calls.filter(c => c.method === 'get').length === 2);
    const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'sync/new choice');
    const gv = f.gate('get', s => s.accessToken.endsWith('verify1'));
    const v = f.sync.verify(A + '@example.test', '123456', freshState());
    await bounded(gv.entered.promise, 'verify during sync');
    g.release.resolve(); stale(await p);
    gv.release.resolve(); assert.equal((await v).ok, true);
    assert.match(JSON.parse(f.storage.getItem(AUTH_KEY)).session.accessToken, /verify1$/);
  });
  test(label + '：用户已提交现有选择，旧恢复不能在导入途中重新弹出选择', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    assert.equal((await f.sync.resumeGuestImportChoice(freshState())).needChoice, true);
    const oldGate = f.gate();
    const old = f.sync.resumeGuestImportChoice(freshState());
    await bounded(oldGate.entered.promise, 'old resume before submit');
    const finishGate = f.gate();
    const finish = f.sync.finishChoice('cloud');
    await bounded(finishGate.entered.promise, 'choice in flight');
    oldGate.release.resolve(); stale(await old);
    finishGate.release.resolve(); assert.equal((await finish).ok, true);
    assert.equal(sumXp(f.rows.get(A).doc), 40);
    assert.equal(JSON.parse(f.raw.getItem(GUEST_KEY)).xp, 80);
  });
  test(label + '：读取本机副本期间共享身份变化，写 waiting 前再挡一次', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const g = f.gate(); const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'before choice');
    let afterInjection;
    f.hooks.get = k => {
      if (k.endsWith('suipian.acct.' + A)) {
        delete f.hooks.get; f.seedShared(B, 'other-tab'); afterInjection = f.snapshot();
      }
    };
    g.release.resolve(); stale(await p);
    assert.equal(f.snapshot(), afterInjection);
    assert.equal(f.sync.account(), null);
  });
  test(label + '：读取期间新出现损坏待办，恢复入口继续安全停机', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const g = f.gate(); const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'corrupt');
    f.storage.setItem('suipian.acct.import.' + A, '{broken');
    const before = f.snapshot(); g.release.resolve();
    const r = await p; assert.equal(r.kind, 'import-corrupt'); assert.equal(r.needChoice, undefined);
    assert.equal(f.snapshot(), before); assert.equal(f.sync.account().userId, A);
  });
  test(label + '：共享身份读不出时保留数据与会话，不伪装成跨页退出', async t => {
    const f = fixture(withLocks); t.after(f.releaseAll);
    const g = f.gate(); const p = f.sync.resumeGuestImportChoice(freshState());
    await bounded(g.entered.promise, 'read failed');
    const before = f.snapshot();
    f.hooks.get = k => { if (k.endsWith(AUTH_KEY)) throw new Error('denied'); };
    g.release.resolve(); const r = await p;
    assert.equal(r.kind, 'local'); assert.equal(r.stale, undefined);
    assert.equal(f.snapshot(), before); assert.equal(f.sync.account().userId, A);
  });
  for (const opts of [{}, { guestXp: 0 }, { imported: true }, { expiresIn: 1000 }]) {
    test(label + '：正常恢复对照 ' + JSON.stringify(opts), async t => {
      const f = fixture(withLocks, opts); t.after(f.releaseAll);
      const beforeInst = JSON.parse(f.storage.getItem(AUTH_KEY)).instanceId;
      const r = await f.sync.resumeGuestImportChoice(freshState());
      assert.equal(r.ok, true);
      assert.equal(JSON.parse(f.storage.getItem(AUTH_KEY)).instanceId, beforeInst, '普通刷新不能换登录实例');
      if (opts.guestXp === 0 || opts.imported) {
        assert.equal(r.noChoiceNeeded, true); assert.equal(sumXp(f.rows.get(A).doc), 40);
      } else {
        assert.equal(r.needChoice, true);
        assert.equal((await f.sync.finishChoice('transfer')).ok, true);
        assert.equal(sumXp(f.rows.get(A).doc), 120);
        await f.sync.syncNow({ manual: true });
        assert.equal(sumXp(f.rows.get(A).doc), 120, '重试不能重复加分');
      }
    });
  }
}

function fakeNode(tag, attrs = {}, ...children) {
  const n = { tag, attrs, children: children.flat().filter(x => x != null), textContent: attrs.text || '', classList: { add() {}, remove() {} }, dataset: {}, append(...xs) { this.children.push(...xs.flat().filter(x => x != null)); } };
  return n;
}
const find = (n, p) => {
  if (!n || typeof n !== 'object') return null;
  if (Array.isArray(n)) { for (const c of n) { const hit = find(c, p); if (hit) return hit; } return null; }
  if (p(n)) return n;
  return find(n.children || [], p);
};
for (const result of [{ ok: false, stale: true, kind: 'stale' }, { ok: false, kind: 'server', status: 503 }]) {
  test('UI：恢复调用方 ' + (result.stale ? '丢弃 stale' : '保留当前失败提示'), async () => {
    const toasts = [], sheets = [];
    let rerenders = 0;
    const gate = defer(), entered = defer();
    const ui = createAccountUi({
      h: fakeNode,
      button: (label, click, cls, attrs = {}) => Object.assign(fakeNode('button', { ...attrs, text: typeof label === 'string' ? label : '', class: cls }), { click }),
      icon: () => fakeNode('i'),
      sheet: render => { const nodes = render(() => {}); sheets.push(nodes); return nodes; },
      showToast: text => toasts.push(text), rerender: () => { rerenders++; },
      getState: freshState, onSwitchedIn() {}, onSwitchedOut() {},
      api: { configured: true },
      sync: {
        account: () => ({ userId: A, email: A + '@example.test' }), status: () => ({ status: 'synced' }),
        pendingRecoveryInfo: () => ({ state: 'corrupt', digest: 'd' }),
        quarantinePendingImport: async () => ({ ok: true }),
        resumeGuestImportChoice: () => { entered.resolve(); return gate.promise; },
      },
    });
    const card = ui.accountCard();
    find(card, n => Object.hasOwn(n.attrs, 'data-quarantine')).click();
    const confirm = find(sheets[0], n => n.tag === 'button' && n.textContent === '备份并继续');
    assert.ok(confirm);
    const p = confirm.click(); await bounded(entered.promise, 'UI recovery');
    assert.equal(toasts.length, 1); gate.resolve(result); await p;
    assert.equal(toasts.length, result.stale ? 1 : 2);
    assert.equal(rerenders, result.stale ? 0 : 1);
    assert.equal(sheets.length, 1, '旧任务不能打开导入选择');
  });
}
