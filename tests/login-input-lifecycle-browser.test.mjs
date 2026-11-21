// G-LOGIN-07：真实 dist + 浏览器内假 Supabase，覆盖输入、取消、重开和已验证会话。
// npm run build:ci && MOBILE_BROWSER=chromium node tests/login-input-lifecycle-browser.test.mjs
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4398, BASE = `http://localhost:${PORT}/`, FAKE = "https://fake.supabase.test";
const CAN = "G07_RAW_SERVER_CANARY", BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
if (!existsSync(join(DIST, "index.html"))) { console.error("环境失败：先运行 npm run build:ci"); process.exit(2); }
const srv = createServer((req, res) => {
  const u = new URL(req.url, BASE);
  let p = resolve(DIST, "." + decodeURIComponent(u.pathname));
  if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST + sep) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); res.end(readFileSync(p));
});
await new Promise(r => srv.listen(PORT, r));
let browser;
try { browser = await (BNAME === "webkit" ? webkit : chromium).launch(); }
catch (e) { srv.close(); console.error("环境失败：" + String(e.message).split("\n")[0]); process.exit(2); }
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const session = { access_token: "test-at", refresh_token: "test-rt", expires_in: 3600, token_type: "bearer", user: { id: "user-g07", email: "a@example.com" } };
async function device(handlers = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const d = { ctx, hits: { send: 0, verify: 0, read: 0 }, bodies: [], errors: [], consoles: [], failures: new Map() };
  d.json = (route, status, body) => {
    if (status >= 400) d.failures.set(status, (d.failures.get(status) || 0) + 1);
    return route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: JSON.stringify(body) });
  };
  await ctx.route("**/*", async route => {
    const req = route.request(), u = new URL(req.url());
    if (u.origin !== FAKE) {
      if (u.hostname.endsWith(".supabase.co")) { d.errors.push("Unexpected real Supabase request"); return route.abort(); }
      return route.continue();
    }
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/otp") { const n = ++d.hits.send; return handlers.send ? handlers.send(route, n, d) : d.json(route, 200, {}); }
    if (u.pathname === "/auth/v1/verify") {
      const n = ++d.hits.verify; d.bodies.push(req.postDataJSON());
      return handlers.verify ? handlers.verify(route, n, d) : d.json(route, 403, { error_code: "otp_expired", msg: CAN });
    }
    if (u.pathname === "/rest/v1/progress") {
      const n = ++d.hits.read;
      return handlers.read ? handlers.read(route, n, d) : d.json(route, 503, { msg: CAN });
    }
    d.errors.push("Unexpected fake route: " + u.pathname); return d.json(route, 404, {});
  });
  const guest = { version: 3, onboarded: true, xp: 50, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-21", done: { U1L1: true }, lessonsCompleted: 1, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } };
  await ctx.addInitScript(([cfg, g]) => {
    if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg));
    if (!localStorage.getItem("suipian.progress") && !sessionStorage.getItem("g07-seeded")) { localStorage.setItem("suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g07-seeded", "1"); }
  }, [{ url: FAKE, anonKey: "test-pub-key" }, guest]);
  const page = d.page = await ctx.newPage();
  page.on("pageerror", e => d.errors.push(String(e.message || e)));
  page.on("console", m => { if (m.type() === "error") d.consoles.push(m.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app?.sync && window.__app?.getState);
  await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await page.getByRole("button", { name: "我的", exact: true }).tap();
  await page.locator('[data-me-menu="account"]').tap();
  d.open = async (email = "a@example.com") => { await page.locator("[data-open-login]").tap(); await page.locator("[data-email]").fill(email); };
  d.code = async () => { await d.open(); await page.locator("[data-send-code]").tap(); await page.locator("[data-code]").waitFor(); };
  return d;
}
async function checkNoErrors(d) {
  for (const msg of d.consoles) {
    if (/^Viewport argument key "interactive-widget" not recognized and ignored\.?$/.test(msg)) continue;
    const m = /^Failed to load resource: the server responded with a status of (403|503)(?: \([^\r\n)]*\))?$/.exec(msg);
    if (m && (d.failures.get(Number(m[1])) || 0) > 0) { d.failures.set(Number(m[1]), d.failures.get(Number(m[1])) - 1); continue; }
    d.errors.push(msg);
  }
  assert.deepEqual(d.errors, [], "G07 unexpected browser errors");
  assert.ok(!(await d.page.locator("body").innerText()).includes(CAN), "G07 raw server text leaked");
}
const text = (d, sel) => d.page.locator(sel).innerText();
const storage = d => d.page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
const ready = d => d.page.waitForFunction(() => !document.querySelector("[data-code]")?.disabled && !document.querySelector("[data-verify]")?.disabled);
let count = 0;
async function scenario(name, handlers, fn) {
  const d = await device(handlers);
  try { await fn(d); await checkNoErrors(d); count++; console.log("PASS G07 " + name); }
  finally { await d.ctx.close(); }
}
try {
  await scenario("六位格式、零请求、前导零及验证码页退出", {}, async d => {
    await d.code();
    for (const code of ["1234", "12345", "1234567", "12a456"]) {
      await d.page.locator("[data-code]").fill(code); await d.page.locator("[data-verify]").tap();
      assert.match(await text(d, "[data-login-msg]"), /6 位数字/); assert.equal(d.hits.verify, 0);
    }
    await d.page.locator("[data-code]").fill("00 12 34"); await d.page.locator("[data-verify]").tap();
    await d.page.waitForFunction(() => /验证码/.test(document.querySelector("[data-login-msg]")?.textContent || "") && !document.querySelector("[data-verify]")?.disabled);
    assert.equal(d.hits.verify, 1); assert.equal(d.bodies[0].token, "001234");
    await d.page.locator("[data-login-cancel]").tap(); assert.equal(await d.page.locator("[data-login]").count(), 0);
    await d.open("b@example.com"); assert.equal(await d.page.locator("[data-email]").inputValue(), "b@example.com");
  });

  const sending = deferred();
  await scenario("发码处理中取消后重开，迟到成功不翻页", { send: async (r, n, d) => { await sending.promise; return d.json(r, 200, {}); } }, async d => {
    await d.open(); await d.page.locator("[data-send-code]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-email]")?.disabled);
    assert.equal(d.hits.send, 1); assert.equal(await d.page.locator("[data-login-cancel]").isDisabled(), false);
    await d.page.keyboard.press("Escape"); assert.equal(await d.page.locator("[data-login]").count(), 1);
    await d.page.locator("[data-login-cancel]").tap(); await d.open("b@example.com");
    const response = d.page.waitForResponse(r => r.url() === FAKE + "/auth/v1/otp" && r.status() === 200);
    sending.resolve(); await response; await d.page.waitForTimeout(100);
    assert.equal(await d.page.locator("[data-code]").count(), 0); assert.equal(await d.page.locator("[data-email]").inputValue(), "b@example.com");
    assert.equal(await text(d, "[data-login-msg]"), ""); assert.equal(d.hits.send, 1);
  });

  const verifying = deferred();
  await scenario("验证互斥、读失败保留会话、改码作废旧会话", { verify: async (r, n, d) => { if (n === 1) { await verifying.promise; return d.json(r, 200, session); } return d.json(r, 403, { error_code: "otp_expired", msg: CAN }); } }, async d => {
    await d.code(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-code]")?.disabled);
    for (const sel of ["[data-code]", "[data-verify]", "[data-resend]", "[data-login-change-email]", "[data-login-cancel]"]) assert.equal(await d.page.locator(sel).isDisabled(), true, sel);
    await d.page.keyboard.press("Enter"); await d.page.keyboard.press("Escape"); assert.equal(await d.page.locator("[data-login]").count(), 1); assert.equal(d.hits.verify, 1);
    verifying.resolve();
    await d.page.waitForFunction(() => document.querySelector("[data-verify]")?.textContent === "重试读取"); await ready(d);
    assert.equal(await d.page.evaluate(() => window.__app.sync.hasVerified()), true); assert.equal(d.hits.read, 1);
    await d.page.locator("[data-code]").fill("654321"); assert.equal(await d.page.evaluate(() => window.__app.sync.hasVerified()), false);
    assert.equal(await text(d, "[data-verify]"), "登录"); await d.page.locator("[data-verify]").tap(); await ready(d);
    assert.equal(d.hits.verify, 2); assert.equal(d.hits.read, 1);
  });

  await scenario("取消可重试登录保留本机记录，重开与刷新仍是游客", { verify: (r, n, d) => d.json(r, 200, session) }, async d => {
    await d.code(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-verify]")?.textContent === "重试读取");
    assert.equal(await d.page.evaluate(() => window.__app.sync.hasVerified()), true);
    const before = await storage(d); await d.page.locator("[data-login-cancel]").tap();
    assert.equal(await d.page.evaluate(() => window.__app.sync.hasVerified()), false); assert.equal(await storage(d), before);
    await d.open("b@example.com"); await d.page.keyboard.press("Escape");
    await d.page.reload(); await d.page.waitForFunction(() => window.__app?.sync && window.__app?.getState);
    assert.deepEqual(await d.page.evaluate(() => [window.__app.sync.account(), window.__app.getState().xp]), [null, 50]);
  });

  await scenario("游客选择仍可显示并稍后再说", { verify: (r, n, d) => d.json(r, 200, session), read: (r, n, d) => d.json(r, 200, []) }, async d => {
    await d.code(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
    await d.page.locator('[data-choice="transfer"]').waitFor(); assert.equal(await d.page.locator('[data-choice="cloud"]').count(), 1);
    await d.page.locator("[data-choice-later]").tap(); assert.equal(await d.page.locator("[data-login]").count(), 0);
    assert.deepEqual(await d.page.evaluate(() => [window.__app.sync.account(), window.__app.getState().xp]), [null, 50]);
  });
  console.log(`G-LOGIN-07 real-app browser tests passed (${BNAME}, ${count} scenarios)`);
} finally { await browser.close(); srv.closeAllConnections(); await new Promise(r => srv.close(r)); }
