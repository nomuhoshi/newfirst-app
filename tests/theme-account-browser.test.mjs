// #102 follow-up: browser-level theme/account lifecycle with a fake Supabase HTTP backend.
// Run after npm run build: MOBILE_BROWSER=chromium node tests/theme-account-browser.test.mjs
// The mobile runner executes this file for both chromium and webkit.
import { chromium, webkit } from 'playwright';
import { startDistServer } from './helpers/dist-server.mjs';

const engine = process.env.MOBILE_BROWSER === 'webkit' ? webkit : chromium;
const FAKE = 'https://fake.supabase.test';
const srv = await startDistServer();
let browser; let failed = 0; let passed = 0;
const check = (name, ok, detail = '') => { (ok ? passed++ : failed++); console.log(`${ok ? '✅' : '❌'} ${name}${ok ? '' : ' — ' + detail}`); };
const users = new Map(), rows = new Map(), tokens = new Map(); let serial = 0;
const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,OPTIONS' };
const reply = (route, status, body) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: body === undefined ? '' : JSON.stringify(body) });
try {
  browser = await engine.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: 'block', colorScheme: 'light' });
  await ctx.route(`${FAKE}/**`, async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const uid = tokens.get((req.headers().authorization || '').replace('Bearer ', ''));
    const issue = (id, email) => { const at = `at-${++serial}`, rt = `rt-${serial}`; tokens.set(at, id); tokens.set(rt, id); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now()/1000)+3600, user: { id, email } }; };
    if (url.pathname === '/auth/v1/otp') return reply(route, 200, {});
    if (url.pathname === '/auth/v1/verify') {
      if (body.token !== '123456') return reply(route, 403, { msg: 'Token has expired or is invalid' });
      if (!users.has(body.email)) users.set(body.email, `u${users.size}xxxxxxxx`);
      return reply(route, 200, issue(users.get(body.email), body.email));
    }
    if (url.pathname === '/auth/v1/token') { const id = tokens.get(body.refresh_token); return id ? reply(route, 200, issue(id, [...users].find(([, v]) => v === id)?.[0] || '')) : reply(route, 400, { msg: 'invalid refresh token' }); }
    if (url.pathname === '/auth/v1/logout') return reply(route, 204);
    if (!uid) return reply(route, 401, { message: 'JWT expired' });
    if (url.pathname === '/rest/v1/progress') return reply(route, 200, rows.has(uid) ? [rows.get(uid)] : []);
    if (url.pathname === '/rest/v1/rpc/create_progress') { if (rows.has(uid)) return reply(route, 200, null); rows.set(uid, { doc: body.new_doc, rev: 1 }); return reply(route, 200, 1); }
    if (url.pathname === '/rest/v1/rpc/save_progress') { const row = rows.get(uid); if (!row || row.rev !== body.expected_rev) return reply(route, 200, null); row.doc = body.new_doc; row.rev++; return reply(route, 200, row.rev); }
    return reply(route, 404, { message: 'no route' });
  });
  await ctx.addInitScript(cfg => { try { if (!localStorage.getItem('suipian.cloudConfig')) localStorage.setItem('suipian.cloudConfig', JSON.stringify(cfg)); } catch {} }, { url: FAKE, anonKey: 'pub-key' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const ready = async () => { await page.waitForFunction(() => window.__app?.getState && window.__app?.sync); await page.waitForSelector('.pathview'); };
  const me = async () => { await page.getByRole('button', { name: '我的' }).tap(); };
  const settings = async () => { await me(); await page.locator('[data-me-menu="settings"]').tap(); await page.waitForSelector('[data-theme-row]'); };
  const account = async () => { await me(); await page.locator('[data-me-menu="account"]').tap(); await page.waitForSelector('[data-account]'); };
  const state = () => page.evaluate(() => ({ theme: window.__app.getState().prefs.theme, attr: document.documentElement.getAttribute('data-theme'), bg: getComputedStyle(document.documentElement).getPropertyValue('--g-bg').trim().toUpperCase(), email: window.__app.sync.account()?.email || null }));
  const assertTheme = async (name, expected, email) => {
    await settings();
    const s = await state();
    const pressed = await page.locator('[data-theme-opt]').evaluateAll(els => Object.fromEntries(els.map(el => [el.dataset.themeOpt, el.getAttribute('aria-pressed')])));
    const expectedAttr = expected === 'system' ? null : expected;
    const expectedBg = expected === 'dark' ? '#101E28' : '#F7F5F0';
    check(name, s.theme === expected && s.attr === expectedAttr && s.bg === expectedBg && s.email === email && ['system','light','dark'].every(t => pressed[t] === String(t === expected)), JSON.stringify({ s, pressed, expected, email }));
    await page.getByRole('button', { name: '学习' }).tap();
  };
  const setTheme = async theme => { await settings(); await page.locator(`[data-theme-opt="${theme}"]`).tap(); await page.getByRole('button', { name: '学习' }).tap(); };
  const login = async (email, switching = false) => {
    await account();
    await page.locator(switching ? '[data-switch]' : '[data-open-login]').tap();
    await page.locator('[data-email]').fill(email); await page.locator('[data-send-code]').tap();
    await page.locator('[data-code]').fill('123456'); await page.locator('[data-verify]').tap();
    const choice = page.locator('[data-choice="cloud"]');
    // New accounts normally finish without a choice; existing guest data can require one.
    await Promise.race([page.locator('[data-sync-status]').waitFor({ state: 'visible' }), choice.waitFor({ state: 'visible' })]);
    if (await choice.isVisible()) await choice.tap();
    await page.waitForFunction(e => window.__app.sync.account()?.email === e, email);
    await page.getByRole('button', { name: '学习' }).tap();
  };
  await page.goto(srv.base); await ready();
  await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.installTipClosed = true; window.__app.persist(); window.__app.renderPath(); });
  await setTheme('light');
  await assertTheme('游客：浅色设置三者一致', 'light', null);
  await login('a@example.com');
  await setTheme('dark');
  check('A：深色已同步到假云端', (await page.evaluate(() => window.__app.sync.syncNow())).ok && rows.get(users.get('a@example.com'))?.doc?.prefs?.theme === 'dark');
  await assertTheme('A 登录：深色三者一致', 'dark', 'a@example.com');
  await page.reload(); await ready();
  await page.waitForFunction(() => window.__app.sync.account()?.email === 'a@example.com');
  await assertTheme('会话恢复：A 深色三者一致', 'dark', 'a@example.com');
  await login('b@example.com', true);
  await assertTheme('切换到 B：默认跟随系统三者一致，无 A 设置泄漏', 'system', 'b@example.com');
  await setTheme('light');
  check('B：浅色已同步到假云端', (await page.evaluate(() => window.__app.sync.syncNow())).ok && rows.get(users.get('b@example.com'))?.doc?.prefs?.theme === 'light');
  await assertTheme('B：浅色三者一致', 'light', 'b@example.com');
  await login('a@example.com', true);
  await assertTheme('切回 A：恢复深色三者一致', 'dark', 'a@example.com');
  await account(); await page.locator('[data-logout]').tap();
  await page.waitForFunction(() => window.__app.sync.account() === null);
  await page.getByRole('button', { name: '学习' }).tap();
  await assertTheme('退出回游客：恢复原游客浅色三者一致', 'light', null);
  check('全程无页面脚本异常', errors.length === 0, errors.join(' | '));
  await ctx.close();
} catch (e) { check('浏览器执行异常', false, String(e.stack || e)); }
finally { if (browser) await browser.close(); await srv.close(); }
console.log(`\n账号外观浏览器专项 (${process.env.MOBILE_BROWSER || 'chromium'})：通过 ${passed}，失败 ${failed}`);
process.exit(failed ? 1 : 0);
