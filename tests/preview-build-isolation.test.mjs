// 真实构建层验证：用 PREVIEW_ID=login-sync 构建测试入口，再在浏览器里检查
//  1. 云端关闭的产物：Supabase 请求为 0；正式版的凭证 / 本机副本 / 游客记录逐字不变；测试入口只写 login-sync: 前缀的键；
//  2. 构建时把测试云配置指向本机假服务器：请求只发往假服务器，绝不出现正式 Supabase 域名；
//  3. 两份构建的 Service Worker 缓存前缀都是 login-sync-suipian-。
// 不连接真实 Supabase，不部署。运行：MOBILE_BROWSER=chromium|webkit node tests/preview-build-isolation.test.mjs
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const BROWSER = process.env.MOBILE_BROWSER || "chromium";
const PREFIX = "login-sync:";
const PROD_HOST = "aqlcunkmggzzvyavlkjg.supabase.co";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${BROWSER}] ${name}${!ok && detail ? "  — " + detail : ""}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };

// 正式版现有数据：全部用固定字符串，测试只比较原文，不解析、不重写。
const NOW_STR = String(Date.now());
const PROD_KEYS = {
  "suipian.auth": JSON.stringify({ session: { accessToken: "prod-at-keep", refreshToken: "prod-rt-keep", expiresAt: Number(NOW_STR) + 3600_000, userId: "prodUser1", email: "prod@example.com" } }),
  "suipian.session": "prodUser1",
  "suipian.acct.prodUser1": JSON.stringify({ doc: { schema: 1, gen: 1, lineage: "L-prod", xp: { prodDevice1: 40 }, runs: { prodDevice1: 2 }, done: { U1L1: "2026-11-01" }, days: ["2026-11-01"], hearts: { n: 4, msToNext: 123456 }, prefs: { sound: true, haptics: true, soundStyle: "C" }, imported: {} }, base: 3, dirty: { hearts: false, prefs: false, content: false }, savedAt: Number(NOW_STR) }),
  "suipian.progress": JSON.stringify({ version: 3, onboarded: true, xp: 70, hearts: 3, heartsAt: Number(NOW_STR), streak: 2, lastDay: "2026-11-03", done: { U1L1: true, U1L2: true }, lessonsCompleted: 2, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } }),
  "suipian.device": "prodDevice1",
  "suipian.guestId": "prodGuest1",
};
const PROD_RAW = { ...PROD_KEYS };

function buildPreview(outDir, testCloud) {
  const env = { ...process.env, PREVIEW_ID: "login-sync" };
  delete env.TEST_SUPABASE_URL; delete env.TEST_SUPABASE_ANON_KEY;
  if (testCloud) { env.TEST_SUPABASE_URL = testCloud.url; env.TEST_SUPABASE_ANON_KEY = testCloud.anonKey; }
  const r = spawnSync("npm", ["run", "build", "--", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8", timeout: 300000 });
  if (r.status !== 0) { console.log("环境失败：构建失败\n" + (r.stdout || "") + (r.stderr || "")); process.exit(2); }
  if (!existsSync(join(outDir, "index.html"))) { console.log("环境失败：构建产物没有 index.html"); process.exit(2); }
}

function serveDir(dir) {
  const base = resolve(dir);
  const srv = createServer((req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = resolve(join(base, p));
      if (!f.startsWith(base + sep) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(f));
    } catch { res.writeHead(500); res.end("error"); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, port: srv.address().port, origin: `http://127.0.0.1:${srv.address().port}` })));
}

async function startFakeCloud() {
  const users = new Map(), rows = new Map(), tokens = new Map(), requests = [];
  const CORS = {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, apikey, content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
  let n = 0;
  const send = (res, status, body) => { res.writeHead(status, { ...CORS, "content-type": "application/json" }); res.end(body === undefined ? "" : JSON.stringify(body)); };
  const issue = (uid, email) => { const at = "at-" + (++n), rt = "rt-" + n; tokens.set(at, uid); tokens.set(rt, uid); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: uid, email } }; };
  const srv = createServer(async (req, res) => {
    const u = new URL(req.url, "http://x");
    requests.push({ method: req.method, path: u.pathname, host: req.headers.host });
    if (req.method === "OPTIONS") { res.writeHead(204, CORS); res.end(); return; }
    let raw = ""; for await (const c of req) raw += c;
    let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { body = {}; }
    const uid = tokens.get((req.headers.authorization || "").replace("Bearer ", ""));
    if (u.pathname === "/auth/v1/otp") return send(res, 200, {});
    if (u.pathname === "/auth/v1/verify") {
      if (body.token !== "123456") return send(res, 403, { msg: "Token has expired or is invalid" });
      if (!users.has(body.email)) users.set(body.email, "u" + users.size + "xxxxxxxx");
      return send(res, 200, issue(users.get(body.email), body.email));
    }
    if (u.pathname === "/auth/v1/token") { const id = tokens.get(body.refresh_token); return id ? send(res, 200, issue(id, "")) : send(res, 400, { msg: "invalid refresh token" }); }
    if (u.pathname === "/auth/v1/logout") return send(res, 204);
    if (!uid) return send(res, 401, { message: "JWT expired" });
    if (u.pathname === "/rest/v1/progress") return send(res, 200, rows.has(uid) ? [rows.get(uid)] : []);
    if (u.pathname === "/rest/v1/rpc/create_progress") { if (rows.has(uid)) return send(res, 200, null); rows.set(uid, { doc: body.new_doc, rev: 1 }); return send(res, 200, 1); }
    if (u.pathname === "/rest/v1/rpc/save_progress") { const r = rows.get(uid); if (!r || r.rev !== body.expected_rev) return send(res, 200, null); r.doc = body.new_doc; r.rev++; return send(res, 200, r.rev); }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") { rows.delete(uid); return send(res, 200, null); }
    return send(res, 404, { message: "no route" });
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, requests, users, rows, origin: `http://127.0.0.1:${srv.address().port}` })));
}

async function installSeed(ctx) {
  await ctx.addInitScript((prod) => {
    const real = window.localStorage;
    window.__rawLocalStorage = real;
    for (const [k, v] of Object.entries(prod)) real.setItem(k, v);
    window.__prodBefore = Object.fromEntries(Object.keys(prod).map((k) => [k, real.getItem(k)]));
  }, PROD_KEYS);
}
async function readRaw(page) {
  return page.evaluate(() => {
    const real = window.__rawLocalStorage;
    const before = window.__prodBefore || {};
    const all = {};
    for (let i = 0; i < real.length; i++) { const k = real.key(i); all[k] = real.getItem(k); }
    return { before, all, added: Object.keys(all).filter((k) => !(k in before)), unchanged: Object.keys(before).every((k) => all[k] === before[k]) };
  });
}

if (!existsSync(join(ROOT, "node_modules", "playwright"))) { console.log("环境失败：没有 node_modules/playwright"); process.exit(2); }
const TMP = mkdtempSync(join(tmpdir(), "sp-preview-build-"));
let browser = null, cloudOffStatic = null, fakeStatic = null, fake = null;
try {
  const CLOUD_OFF = join(TMP, "cloud-off");
  buildPreview(CLOUD_OFF);
  const swOff = readFileSync(join(CLOUD_OFF, "sw.js"), "utf8");
  check("构建 PREVIEW_ID=login-sync（云端关闭）：Service Worker 缓存前缀是 login-sync-suipian-", swOff.includes('const PREFIX = "login-sync-suipian-";'), swOff.split("\n").find((l) => l.includes("PREFIX")) || "");

  fake = await startFakeCloud();
  const FAKE = join(TMP, "fake-cloud");
  buildPreview(FAKE, { url: fake.origin, anonKey: "sb_publishable_fake_local" });
  const swFake = readFileSync(join(FAKE, "sw.js"), "utf8");
  check("构建本机假服务器测试云配置：缓存前缀仍是 login-sync-suipian-（不会碰正式缓存）", swFake.includes('const PREFIX = "login-sync-suipian-";'));

  const browserType = BROWSER === "webkit" ? webkit : chromium;
  try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
  cloudOffStatic = await serveDir(CLOUD_OFF);
  fakeStatic = await serveDir(FAKE);

  // ---------- 1. 云端关闭的真实产物 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await installSeed(ctx);
    const page = await ctx.newPage();
    const reqs = [], errors = [];
    page.on("request", (r) => reqs.push(r.url()));
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.goto(cloudOffStatic.origin + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.sync);
    await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.getByRole("button", { name: "我的" }).click(); await page.locator('[data-me-menu="account"]').click();
    await page.waitForSelector("[data-account]");
    const me = await page.locator("[data-account]").innerText();
    check("云端关闭产物：我的页显示“云端暂未开通”，没有登录按钮", /云端暂未开通/.test(me) && (await page.locator("[data-open-login]").count()) === 0, me);
    await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.xp = 12; s.done = { U1L1: true }; window.__app.persist(); });
    const raw = await readRaw(page);
    check("云端关闭产物：正式版凭证 / 当前账号 / 本机副本 / 游客记录 / 编号逐字不变", raw.unchanged, JSON.stringify(Object.fromEntries(Object.keys(raw.before).filter((k) => raw.all[k] !== raw.before[k]))));
    check("云端关闭产物：没有发往 Supabase 的请求（Supabase 请求为零）", reqs.every((u) => !/supabase/i.test(u)) && reqs.filter((u) => /\/auth\/|\/rest\//.test(u)).length === 0, JSON.stringify(reqs.filter((u) => /supabase|\/auth\/|\/rest\//i.test(u))));
    check("云端关闭产物：测试入口自己写的游客记录在 login-sync: 前缀下", raw.all[PREFIX + "suipian.progress"] != null && raw.all[PREFIX + "suipian.progress"] !== raw.before["suipian.progress"]);
    check("云端关闭产物：所有新增键都有独立前缀 login-sync:（没有漏到正式键）", raw.added.length > 0 && raw.added.every((k) => k.startsWith(PREFIX)) && raw.added.includes(PREFIX + "suipian.progress"), JSON.stringify(raw.added));
    check("云端关闭产物：页面没有脚本错误", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }

  // ---------- 2. 构建时指向本机假服务器的真实产物 ----------
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
    await installSeed(ctx);
    const page = await ctx.newPage();
    const reqs = [], errors = [];
    page.on("request", (r) => reqs.push(r.url()));
    page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.goto(fakeStatic.origin + "/", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.sync);
    await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    const login = await page.evaluate(async () => {
      const sync = window.__app.sync;
      const sent = await sync.sendCode("iso@example.com");
      if (!sent.ok) return { ok: false, step: "sendCode", sent };
      const v = await sync.verify("iso@example.com", "123456", window.__app.getState());
      if (!v.ok) return { ok: false, step: "verify", v };
      return { ok: true, email: v.account?.email || "", synced: !!v.synced, needChoice: !!v.needChoice };
    });
    check("假服务器构建：能用测试入口的构建配置完成发码 / 登录 / 首次写入", login.ok && login.email === "iso@example.com" && login.synced === true, JSON.stringify(login));
    const apiOrigin = fake.origin;
    const apiReqs = reqs.filter((u) => u.startsWith(apiOrigin));
    const otherReqs = reqs.filter((u) => !u.startsWith(apiOrigin) && !u.startsWith(fakeStatic.origin));
    check("假服务器构建：登录 / 读进度 / 建记录都只发往假服务器", apiReqs.length >= 3 && fake.requests.some((r) => r.path === "/auth/v1/otp") && fake.requests.some((r) => r.path === "/auth/v1/verify") && fake.requests.some((r) => r.path === "/rest/v1/progress"), JSON.stringify({ apiReqs, fake: fake.requests }));
    check("假服务器构建：没有任何请求发到正式 Supabase 域名", reqs.every((u) => !u.includes(PROD_HOST)) && fake.requests.every((r) => !String(r.host || "").includes(PROD_HOST)) && otherReqs.length === 0, JSON.stringify({ prod: reqs.filter((u) => u.includes(PROD_HOST)), otherReqs }));
    const raw = await readRaw(page);
    check("假服务器构建：预览登录后，正式版凭证 / 当前账号 / 本机副本 / 游客记录仍逐字不变", raw.unchanged, JSON.stringify(Object.fromEntries(Object.keys(raw.before).filter((k) => raw.all[k] !== raw.before[k]))));
    check("假服务器构建：所有新增键都在 login-sync: 前缀下（账号键再带测试项目命名空间）", raw.added.length > 0 && raw.added.every((k) => k.startsWith(PREFIX)) && raw.added.some((k) => k.endsWith("suipian.auth")) && raw.added.some((k) => k.endsWith("suipian.session")) && raw.added.some((k) => k.includes("suipian.acct.")), JSON.stringify(raw.added));
    check("假服务器构建：页面没有脚本错误", errors.length === 0, JSON.stringify(errors));
    await ctx.close();
  }
} catch (e) {
  check("真实构建隔离测试执行完成（没有中途异常）", false, String(e.stack || e).split("\n").slice(0, 5).join(" | "));
} finally {
  try { if (browser) await browser.close(); } catch {}
  for (const s of [cloudOffStatic?.srv, fakeStatic?.srv, fake?.srv]) { try { s?.closeAllConnections?.(); s?.close(); } catch {} }
  rmSync(TMP, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n[${BROWSER}] 真实构建隔离验证：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
