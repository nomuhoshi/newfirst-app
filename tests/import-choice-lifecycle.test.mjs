// G-LOGIN-11：真实账号界面和同步层 + 简化 DOM / 假接口；不联网、不读取真实存档。
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


const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
class Element {
  constructor(env, tag, attrs = {}, ...children) {
    this.env = env; this.tag = tag; this.attrs = attrs; this.children = []; this.parentNode = null;
    this.disabled = false; this.dataset = {}; this._text = attrs.text || ''; this.classes = new Set();
    this.classList = { add: k => this.classes.add(k), remove: k => this.classes.delete(k) };
    this.append(...children);
  }
  get isConnected() { return this === this.env.body || !!this.parentNode?.isConnected; }
  contains(n) { return this === n || this.children.some(c => c instanceof Element && c.contains(n)); }
  append(...xs) { for (const x of xs.flat(Infinity)) if (x != null && x !== false) { if (x instanceof Element) { x.remove(); x.parentNode = this; } this.children.push(x); } }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; }
  get textContent() { return this._text + this.children.map(x => x instanceof Element ? x.textContent : String(x)).join(''); }
  set textContent(x) { for (const c of this.children) if (c instanceof Element) c.parentNode = null; this.children = []; this._text = String(x); }
  focus() { if (this.isConnected) this.env.doc.activeElement = this; }
  blur() { this.env.doc.activeElement = this.env.body; }
}
function find(n, pred) {
  if (Array.isArray(n)) { for (const c of n) { const r = find(c, pred); if (r) return r; } return null; }
  if (!(n instanceof Element)) return null;
  return pred(n) ? n : find(n.children, pred);
}
function uiHarness(t, withLocks, { emptyCloud = false } = {}) {
  const f = fixture(withLocks);
  if (emptyCloud) {
    f.rows.get(A).doc.xp.cloud = 0;
    assert.equal(saveAccount(f.storage, A, { doc: f.rows.get(A).doc, base: 1, dirty: {} }, { now: NOW }), true);
  }
  f.storage.setItem('suipian.acct.import.' + A, '{broken');
  const priorDocument = globalThis.document;
  const e = { f, sheets: [], toasts: [], switched: [], pending: [], rerenders: 0, finishCalls: 0 };
  e.body = new Element(e, 'body'); e.doc = { activeElement: e.body, querySelectorAll: () => [] };
  globalThis.document = e.doc;
  const h = (tag, attrs, ...children) => new Element(e, tag, attrs || {}, ...children);
  const button = (text, fn, cls, attrs = {}) => {
    const b = h('button', { ...attrs, text: typeof text === 'string' ? text : '', class: cls });
    b.invoke = () => { let p; try { p = Promise.resolve(fn()); } catch (err) { p = Promise.reject(err); } e.pending.push(p); p.catch(() => {}); return p; };
    b.click = () => { if (!b.disabled && b.isConnected) { b.focus(); return b.invoke(); } };
    return b;
  };
  const sheet = (render, opts = {}) => {
    const opener = e.doc.activeElement;
    const s = { opts, closed: false, closeCount: 0 };
    s.close = () => {
      if (!s.wrap.isConnected) return;
      const hadFocus = s.wrap.contains(e.doc.activeElement);
      s.wrap.remove(); s.closed = true; s.closeCount++; opts.onClose?.();
      if (opener?.isConnected) opener.focus(); else if (hadFocus) e.doc.activeElement.blur();
    };
    s.requestClose = () => { if (!opts.canClose || opts.canClose()) s.close(); };
    s.wrap = h('div', { role: 'dialog' }, ...render(s.close)); e.body.append(s.wrap); e.sheets.push(s);
    find(s.wrap, n => n.tag === 'button')?.focus(); return s.close;
  };
  e.otherDialog = () => { sheet(() => [button('新弹窗', () => {}, '', { 'data-other-dialog': '' })]); const s = e.sheets.at(-1); s.focused = e.doc.activeElement; return s; };
  const originalFinish = f.sync.finishChoice;
  e.finishImpl = originalFinish;
  f.sync.finishChoice = (...args) => { e.finishCalls++; return e.finishImpl(...args); };
  e.ui = createAccountUi({ h, button, sheet, icon: () => h('i'), api: { configured: true }, sync: f.sync,
    getState: freshState, onSwitchedIn: r => e.switched.push(r), onSwitchedOut() {},
    showToast: x => e.toasts.push(x), rerender: () => e.rerenders++ });
  const card = e.ui.accountCard(); e.body.append(card);
  e.open = async () => {
    find(card, n => own(n.attrs, 'data-quarantine')).click();
    await find(e.sheets.at(-1).wrap, n => n.tag === 'button' && n.textContent === '备份并继续').click();
    e.sheet = e.sheets.at(-1); e.box = find(e.sheet.wrap, n => own(n.attrs, 'data-import-choice'));
    assert.ok(e.box, 'G11_PRECONDITION 恢复入口没有打开选择框');
    e.pick = choice => find(e.box, n => n.attrs['data-choice'] === choice);
    e.later = find(e.box, n => n.tag === 'button' && n.textContent === '稍后再说');
    e.msg = find(e.box, n => own(n.attrs, 'data-choice-msg'));
    e.controls = [e.pick('cloud'), e.pick('transfer'), e.later];
    e.beforeToast = e.toasts.length;
  };
  t.after(async () => {
    try { f.releaseAll(); await Promise.allSettled(e.pending); for (const s of e.sheets) s.close(); }
    finally { globalThis.document = priorDocument; }
  });
  return e;
}
for (const withLocks of [false, true]) {
  const mode = withLocks ? '模拟 Web Locks' : '无锁';
  for (const emptyCloud of [false, true]) for (const choice of ['cloud', 'transfer']) {
    test(mode + '：忙时互斥 / 关闭保护 / 正常成功 ' + JSON.stringify({ emptyCloud, choice }), async t => {
      const e = uiHarness(t, withLocks, { emptyCloud }); await e.open();
      const g = e.f.gate('get'), p = e.pick(choice).click(); await bounded(g.entered.promise, 'busy');
      assert.ok(e.controls.every(b => b.disabled), 'G11_DISABLED 三个按钮必须同时禁用');
      await e.pick(choice).invoke(); await e.pick(choice === 'cloud' ? 'transfer' : 'cloud').invoke();
      assert.equal(e.finishCalls, 1, 'G11_BUSY 绕过 disabled 也只能提交一次');
      await e.later.invoke(); e.sheet.requestClose();
      assert.equal(e.sheet.closed, false, 'G11_CLOSE 忙时按钮、Esc / 遮罩关闭请求都必须被挡');
      g.release.resolve(); await p;
      assert.equal(e.switched.length, 1, 'G11_SUCCESS 只切换一次');
      assert.equal(e.toasts.length, e.beforeToast + 1, 'G11_SUCCESS 只提示一次');
      assert.equal(e.sheet.closed, true);
      assert.equal(sumXp(e.f.rows.get(A).doc), (emptyCloud ? 0 : 40) + (choice === 'transfer' ? 80 : 0));
      assert.equal(e.f.raw.getItem(GUEST_KEY) === null, choice === 'transfer');
      await e.pick(choice).invoke(); assert.equal(e.finishCalls, 1, 'G11_INACTIVE 旧控件不能再提交');
    });
  }
  test(mode + '：503 保留游客与待办，恢复按钮后重试只导入一次', async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const guest = e.f.raw.getItem(GUEST_KEY), auth = e.f.storage.getItem(AUTH_KEY);
    const g = e.f.gate('get', () => true, { ok: false, kind: 'server', status: 503 });
    const p = e.pick('transfer').click(); await bounded(g.entered.promise, '503'); g.release.resolve(); await p;
    assert.ok(e.controls.every(b => !b.disabled), 'G11_REENABLE 失败后恢复全部控件');
    assert.equal(e.sheet.closed, false); assert.match(e.msg.textContent, /没有处理完/);
    assert.equal(e.f.raw.getItem(GUEST_KEY), guest); assert.equal(e.f.storage.getItem(AUTH_KEY), auth);
    assert.ok(e.f.storage.getItem('suipian.acct.import.' + A));
    await e.pick('transfer').click();
    assert.equal(e.switched.length, 1); assert.equal(sumXp(e.f.rows.get(A).doc), 120);
    await e.f.sync.syncNow({ manual: true }); assert.equal(sumXp(e.f.rows.get(A).doc), 120);
  });
  test(mode + '：意外异常不泄露原文、不挂住，恢复后仍可重试', async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const original = e.finishImpl;
    e.finishImpl = async () => { throw new Error('CANARY_PRIVATE'); };
    await e.pick('transfer').click();
    assert.ok(e.controls.every(b => !b.disabled), 'G11_REENABLE 异常后恢复控件');
    assert.match(e.msg.textContent, /没有处理完/); assert.doesNotMatch(e.msg.textContent, /CANARY/);
    e.finishImpl = original; await e.pick('transfer').click(); assert.equal(e.switched.length, 1);
  });
  for (const status of [200, 503]) test(mode + '：程序关闭后迟到结果静默 / ' + status, async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const g = e.f.gate('get', () => true, status === 503 ? { ok: false, kind: 'server', status } : null);
    const p = e.pick('transfer').click(); await bounded(g.entered.promise, 'closed');
    e.sheet.close(); const other = e.otherDialog(), before = e.msg.textContent;
    g.release.resolve(); await p;
    assert.equal(e.switched.length, 0, 'G11_LATE 关闭后不得调用 onSwitchedIn');
    assert.equal(e.toasts.length, e.beforeToast, 'G11_LATE 关闭后不得提示完成');
    assert.equal(e.msg.textContent, before, 'G11_LATE 关闭后不得改写旧提示');
    assert.equal(other.closed, false); assert.ok(e.doc.activeElement === other.focused, 'G11_FOCUS 新弹窗焦点保持');
  });
  test(mode + '：外部卸载但未触发 onClose 时同样丢弃结果', async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const g = e.f.gate('get'), p = e.pick('transfer').click(); await bounded(g.entered.promise, 'detached');
    e.sheet.wrap.remove(); const other = e.otherDialog(); g.release.resolve(); await p;
    assert.equal(e.switched.length, 0, 'G11_DETACHED 已卸载弹窗不得切换状态');
    assert.equal(e.toasts.length, e.beforeToast); assert.equal(other.closed, false);
  });
  for (const change of ['logout', 'other', 'same']) test(mode + '：旧选择在途被取代 / ' + change, async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const g = e.f.gate('get'), p = e.pick('transfer').click(); await bounded(g.entered.promise, change);
    if (change === 'logout') assert.equal((await e.f.sync.forceLocalLogout()).ok, true);
    else await e.f.relog(e.f.sync, change === 'same' ? A : B);
    const before = e.f.snapshot(), calls = e.f.calls.length, other = e.otherDialog();
    g.release.resolve(); await p;
    assert.equal(e.sheet.closed, true, 'G11_STALE stale 只收起旧弹窗');
    assert.equal(e.toasts.length, e.beforeToast, 'G11_STALE 不显示旧提示');
    assert.equal(e.switched.length, 0); assert.equal(e.f.snapshot(), before); assert.equal(e.f.calls.length, calls);
    assert.equal(other.closed, false); assert.ok(e.doc.activeElement === other.focused, 'G11_FOCUS 旧弹窗不得抢走新弹窗焦点');
  });
  test(mode + '：跨页换号已被识别时静默关闭旧选择', async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const g = e.f.gate('get'), p = e.pick('transfer').click(); await bounded(g.entered.promise, 'tab');
    const other = e.f.make(); assert.ok(other.restore(freshState())); await e.f.relog(other, B);
    assert.equal(e.f.sync.reconcileSession().ok, false);
    const before = e.f.snapshot(); g.release.resolve(); await p;
    assert.equal(e.sheet.closed, true, 'G11_STALE 跨页失权后关闭旧弹窗');
    assert.equal(e.f.snapshot(), before); assert.equal(e.switched.length, 0); assert.equal(e.toasts.length, e.beforeToast);
  });
  for (const uid of [A, B]) test(mode + '：旧收尾保留新登录的待选择 / ' + uid, async t => {
    const e = uiHarness(t, withLocks); await e.open();
    const g = e.f.gate('get'), p = e.pick('transfer').click(); await bounded(g.entered.promise, 'new waiting');
    assert.equal((await e.f.sync.forceLocalLogout()).ok, true);
    e.f.storage.removeItem('suipian.acct.' + uid); // 仅清理假存储里的测试副本，让新登录进入待选择
    const next = await e.f.sync.verify(uid + '@example.test', '123456', freshState());
    assert.equal(next.needChoice, true, 'G11_PRECONDITION 新登录必须进入待选择');
    const before = e.f.snapshot(), other = e.otherDialog(); g.release.resolve(); await p;
    assert.equal(e.sheet.closed, true, 'G11_STALE 新登录后旧弹窗收起');
    assert.equal(e.f.snapshot(), before); assert.equal(e.switched.length, 0); assert.equal(other.closed, false);
    const done = await e.f.sync.finishChoice('transfer');
    assert.equal(done.ok, true, 'G11_NEW_CHOICE 新登录的选择仍能提交');
    assert.equal(done.account.userId, uid); assert.equal(sumXp(e.f.rows.get(uid).doc), uid === A ? 120 : 150);
    await e.f.sync.syncNow({ manual: true }); assert.equal(sumXp(e.f.rows.get(uid).doc), uid === A ? 120 : 150);
  });
  test(mode + '：session-changed 不误显示游客重试提示', async t => {
    const e = uiHarness(t, withLocks); await e.open();
    e.finishImpl = async () => ({ ok: false, kind: 'session-changed' });
    await e.pick('transfer').click(); assert.equal(e.sheet.closed, true, 'G11_SESSION_CHANGED 会话变化只收起旧弹窗');
    assert.equal(e.toasts.length, e.beforeToast); assert.equal(e.switched.length, 0);
  });
  test(mode + '：空闲时稍后再说不提交、不改存档', async t => {
    const e = uiHarness(t, withLocks); await e.open(); const before = e.f.snapshot();
    await e.later.click(); assert.equal(e.sheet.closed, true); assert.equal(e.finishCalls, 0); assert.equal(e.f.snapshot(), before);
  });
}
