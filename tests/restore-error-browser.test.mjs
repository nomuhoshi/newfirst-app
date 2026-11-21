// G-LOGIN-05：真实应用 + 临时浏览器存储 + 本地拦截的假云；不连接真实 Supabase。
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium, webkit } from 'playwright';
import { startDistServer } from './helpers/dist-server.mjs';
import { emptyDoc } from '../src/account-data.js';

if (!existsSync(fileURLToPath(new URL('../dist/index.html', import.meta.url)))) {
  console.error('环境失败：需要 npm run build:ci 生成的测试 dist/'); process.exit(2);
}
const type = process.argv.includes('--webkit') || process.env.MOBILE_BROWSER === 'webkit' || process.env.BROWSER === 'webkit' ? webkit : chromium;
const FAKE = 'https://fake.supabase.test', NS = 'proj:fake.supabase.test:';
const UID = '11111111-1111-4111-8111-111111111111', COPY = NS + 'suipian.acct.' + UID;
const AUTH = NS + 'suipian.auth', SESSION = NS + 'suipian.session';
const doc = emptyDoc({ lineage: 'g05-browser-account' }); doc.xp.cloud = 120;
const goodCopy = JSON.stringify({ doc, base: 1, dirty: {} });
const guest = { version: 3, onboarded: true, xp: 15, hearts: 5, heartsAt: Date.now(), streak: 0, lastDay: null, done: {}, lessonsCompleted: 0,
  prefs: { sound: true, haptics: true, soundStyle: 'J', theme: 'system' } };
const auth = JSON.stringify({ project: 'fake.supabase.test', instanceId: 'g05-instance-old', session: {
  userId: UID, email: 'g05@example.test', accessToken: 'fake-g05-at', refreshToken: 'fake-g05-rt', expiresAt: Date.now() + 3_600_000,
} });
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const srv = await startDistServer(); let browser;
const errors = [];
function collect(page, label) {
  page.on('pageerror', e => errors.push(label + ' pageerror: ' + e.message));
  const benign = /^Viewport argument key "interactive-widget" not recognized and ignored\.?$/;
  page.on('console', m => { if (m.type() === 'error' && !benign.test(m.text())) errors.push(label + ' console.error: ' + m.text()); });
}
async function context(copyRaw = goodCopy) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block' });
  await ctx.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(srv.base).origin) return route.continue();
    if (u.origin !== FAKE) { errors.push('拒绝意外外部请求：' + u.origin); return route.abort(); }
    if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    let body;
    if (u.pathname === '/rest/v1/progress') body = [{ user_id: UID, rev: 1, doc }];
    else if (u.pathname === '/auth/v1/logout') return route.fulfill({ status: 204, headers: CORS });
    else { errors.push('意外假云请求：' + u.pathname); return route.fulfill({ status: 500, headers: CORS, body: '{}' }); }
    return route.fulfill({ status: 200, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  });
  await ctx.addInitScript(({ copy, acct, session, credential, g, a, raw }) => {
    if (localStorage.getItem('g05-seeded') !== '1') {
      localStorage.setItem('suipian.cloudConfig', JSON.stringify({ url: 'https://fake.supabase.test', anonKey: 'fake-public-key' }));
      localStorage.setItem('suipian.progress', JSON.stringify(g));
      localStorage.setItem(copy, raw); localStorage.setItem(session, acct); localStorage.setItem(credential, a);
      localStorage.setItem('g05-seeded', '1');
    }
  }, { copy: COPY, acct: UID, session: SESSION, credential: AUTH, g: guest, a: auth, raw: copyRaw });
  return ctx;
}
async function faultyPage(ctx, faultKey = COPY) {
  const p = await ctx.newPage(); collect(p, 'faulty');
  await p.addInitScript(key => {
    const get = Storage.prototype.getItem;
    window.__g05raw = k => get.call(localStorage, k); // 仅测试读取底层假数据，用于故障仍开启时比对原文。
    Storage.prototype.getItem = function(k) {
      if (this === localStorage && k === key && sessionStorage.getItem('g05-fault-off') !== '1') throw new Error('synthetic g05 storage failure');
      return get.call(this, k);
    };
  }, faultKey);
  await p.goto(srv.base, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__app?.sync);
  return p;
}
async function accountPage(p) {
  await p.getByRole('button', { name: '我的', exact: true }).tap();
  await p.locator('[data-me-menu="account"]').tap();
}
try {
  browser = await type.launch();
  for (const target of [SESSION, COPY, AUTH]) {
    const ctx = await context();
    try {
      const p = await faultyPage(ctx, target);
      const initial = await p.evaluate(() => ({ xp: window.__app.getState().xp, account: window.__app.sync.account(), status: window.__app.sync.status().status }));
      assert.deepEqual(initial, { xp: 15, account: null, status: null });
      await p.locator('[data-restore-error="read-failed"]').waitFor(); // 地图就能看到失败提示。
      await accountPage(p); await p.locator('[data-retry-restore]').waitFor();
      await p.evaluate(() => { window.__app.addXp(10); if (!window.__app.persist()) throw new Error('guest persist failed'); });
      await p.reload({ waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__app?.sync);
      const before = await p.evaluate(([copy, a]) => ({ xp: window.__app.getState().xp, copy: window.__g05raw(copy), auth: window.__g05raw(a) }), [COPY, AUTH]);
      assert.equal(before.xp, 25); assert.equal(before.copy, goodCopy); assert.equal(before.auth, auth);
      await accountPage(p);
      await p.evaluate(() => sessionStorage.setItem('g05-fault-off', '1'));
      await p.locator('[data-retry-restore]').tap();
      await p.waitForFunction(uid => window.__app.sync.account()?.userId === uid && window.__app.getState().xp === 120, UID);
      await p.waitForFunction(() => window.__app.sync.status().status === 'synced');
      const after = await p.evaluate(() => ({ issue: window.__app.sync.restoreError(), guest: JSON.parse(localStorage.getItem('suipian.progress')).xp }));
      assert.equal(after.issue, null); assert.equal(after.guest, 25);
      console.log('PASS G05 browser：' + target + ' 失败→游客15/25落盘→重试120，原账号副本保留');
    } finally { await ctx.close(); }
  }
  for (const mode of ['logout', 'same-user-new-instance']) {
    const ctx = await context();
    try {
      const a = await faultyPage(ctx); await accountPage(a); await a.locator('[data-restore-error]').waitFor();
      const b = await ctx.newPage(); collect(b, 'other-tab');
      await b.goto(srv.base, { waitUntil: 'domcontentloaded' }); await b.waitForFunction(() => window.__app?.sync?.account());
      await b.waitForFunction(() => window.__app.sync.status().status === 'synced');
      if (mode === 'logout') {
        await accountPage(b); await b.locator('[data-logout]').tap(); await b.locator('[data-open-login]').waitFor();
      } else {
        await b.evaluate(key => { const v = JSON.parse(localStorage.getItem(key)); v.instanceId = 'g05-new-instance'; localStorage.setItem(key, JSON.stringify(v)); }, AUTH);
      }
      await a.locator('[data-restore-error]').waitFor({ state: 'detached' });
      assert.equal(await a.evaluate(() => window.__app.sync.account()), null);
      assert.equal(await a.evaluate(() => window.__app.getState().xp), 15);
      console.log('PASS G05 browser：跨页 ' + mode + ' 清旧提示，不自动接管账号');
    } finally { await ctx.close(); }
  }
  for (const [raw, code] of [['{bad account json', 'corrupt'], [JSON.stringify({ doc: { ...doc, schema: 999 } }), 'schema-newer']]) {
    const ctx = await context(raw);
    try {
      const p = await ctx.newPage(); collect(p, code);
      await p.goto(srv.base, { waitUntil: 'domcontentloaded' }); await p.waitForFunction(() => window.__app?.sync);
      await accountPage(p); await p.locator('[data-restore-error="' + code + '"]').waitFor();
      assert.equal(await p.locator('[data-retry-restore]').count(), 0);
      assert.equal(await p.evaluate(k => localStorage.getItem(k), COPY), raw);
      assert.equal(await p.evaluate(() => window.__app.sync.account()), null);
    } finally { await ctx.close(); }
  }
  assert.deepEqual(errors, []);
  console.log('G-LOGIN-05 real-app browser tests passed (' + (type === webkit ? 'webkit' : 'chromium') + ')');
} finally { if (browser) await browser.close(); await srv.close(); }
