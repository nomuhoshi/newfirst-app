// G-LOGIN-14：同步期间确认删除（真实构建产物 + 严格令牌的假 Supabase HTTP 层）：“立即同步”的刷新还没返回时在界面上确认删除，
// 同一份刷新令牌只发一次刷新（刷新令牌一次性，第二次会被拒），删除用刷新后的令牌发出并成功，不误报认证失败。
// 运行：npm run build:ci && MOBILE_BROWSER=chromium node tests/refresh-dedupe-browser.test.mjs

import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4377, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = "https://fake.supabase.test";
const results = [];
const defer = () => { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; };
const SHOTS = process.env.SHOTS_DIR || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${process.env.MOBILE_BROWSER || "chromium"}-${name}.png` }); };
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const browserType = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

// ---------- 假 Supabase（HTTP 层）----------
const S = { users: new Map(), rows: new Map(), tokens: new Map(), n: 0, expired: new Set(), atOf: new Map(), usedRt: new Set(), rtReuse: 0, refreshCount: 0, log: [], skew: 0 }; // G-LOGIN-13：令牌严格——被标记过期 / 刷新后旧访问令牌立即 401，刷新令牌一次性
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: body === undefined ? "" : JSON.stringify(body) });
async function fakeSupabase(ctx) {
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (ctx.__off) return route.abort("internetdisconnected"); // Chromium 的 setOffline 拦不住 route 接管的请求，这里自己断
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const tok = (req.headers().authorization || "").replace("Bearer ", ""), uid = S.expired.has(tok) ? undefined : S.tokens.get(tok);
    if (u.pathname.startsWith("/rest/")) S.log.push({ m: req.method(), p: u.pathname, tok, ok: !!uid });
    const issue = (id, email) => { const at = "at-" + ++S.n, rt = "rt-" + S.n; S.tokens.set(at, id); S.tokens.set(rt, id); S.atOf.set(rt, at); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor((Date.now() + S.skew) / 1000) + 3600, user: { id, email } }; };
    if (u.pathname === "/auth/v1/otp") return json(route, 200, {});
    if (u.pathname === "/auth/v1/verify") { if (body.token !== "123456") return json(route, 403, { msg: "Token has expired or is invalid" }); if (!S.users.has(body.email)) S.users.set(body.email, "u" + S.users.size + "xxxxxxxx"); return json(route, 200, issue(S.users.get(body.email), body.email)); }
    if (u.pathname === "/auth/v1/token") { if (S.usedRt.has(body.refresh_token)) { S.rtReuse++; return json(route, 400, { msg: "refresh token already used" }); } ctx.__onRefresh?.(); S.refreshCount++; const id = S.tokens.get(body.refresh_token); if (id) { S.usedRt.add(body.refresh_token); S.expired.add(S.atOf.get(body.refresh_token)); } const rg = ctx.__refreshGate; if (rg && !rg.used) { rg.used = true; rg.entered.resolve(); await rg.release.promise; } return id ? json(route, 200, issue(id, [...S.users].find(([, v]) => v === id)?.[0] || "")) : json(route, 400, { msg: "invalid refresh token" }); }
    if (u.pathname === "/auth/v1/logout") return json(route, 204);
    if (!uid) return json(route, 401, { message: "JWT expired" });
    if (u.pathname === "/rest/v1/progress") {
      const gate = ctx.__g04Gate;
      if (gate && !gate.used && gate.uid === uid && !(gate.skip > 0 && gate.skip--)) {
        gate.used = true;
        const rows = S.rows.has(uid) ? [JSON.parse(JSON.stringify(S.rows.get(uid)))] : [];
        gate.entered.resolve();
        await gate.release.promise;
        try { return await json(route, gate.status, gate.status === 200 ? rows : { message: "injected late 503" }); }
        finally { gate.done.resolve(); }
      }
      return json(route, 200, S.rows.has(uid) ? [S.rows.get(uid)] : []);
    }
    if (u.pathname === "/rest/v1/rpc/create_progress") { if (S.rows.has(uid)) return json(route, 200, null); S.rows.set(uid, { doc: body.new_doc, rev: 1 }); return json(route, 200, 1); }
    if (u.pathname === "/rest/v1/rpc/save_progress" && ctx.__failSave) return json(route, 503, { message: "injected 503" });
    if (u.pathname === "/rest/v1/rpc/save_progress") { const r = S.rows.get(uid); if (ctx.__conflictOnce && r) { const f = ctx.__conflictOnce; ctx.__conflictOnce = null; r.rev++; await f(); return json(route, 200, null); } if (!r || r.rev !== body.expected_rev) return json(route, 200, null); r.doc = body.new_doc; r.rev++; return json(route, 200, r.rev); }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") { S.rows.delete(uid); return json(route, 200, null); }
    return json(route, 404, { message: "no route" });
  });
}
const xpIn = (email) => Object.values(S.rows.get(S.users.get(email))?.doc.xp ?? {}).reduce((a, b) => a + b, 0);

async function device(name, { guest = null, viewport = { width: 390, height: 844 }, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await fakeSupabase(ctx);
  await ctx.addInitScript(([cfg, g]) => { try { if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (g && !localStorage.getItem("suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem("suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {} }, [{ url: FAKE, anonKey: "pub-key" }, guest]);
  const page = await ctx.newPage();
  if (clock) await page.clock.install(); // 可控时钟：用来把页面时间“快进”到令牌快过期
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { name, ctx, page, errors, shot: (n) => shot(page, `acct-${name}-${n}`) };
}
const toMe = async (d) => { await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="account"]').tap(); await d.page.waitForSelector("[data-account]"); };
async function loginUi(d, email, { choice = null } = {}) {
  await toMe(d);
  await d.page.locator("[data-open-login]").tap();
  await d.page.locator("[data-email]").fill(email);
  await d.shot("1-email");
  await d.page.locator("[data-send-code]").tap();
  await d.page.locator("[data-code]").waitFor();
  await d.shot("2-code");
  await d.page.locator("[data-code]").fill("123456");
  await d.page.locator("[data-verify]").tap();
  if (choice) { await d.page.locator(`[data-choice="${choice}"]`).waitFor(); await d.shot("3-choice"); await d.page.locator(`[data-choice="${choice}"]`).tap(); }
  await d.page.waitForSelector("[data-sync-status]");
}
const earn = (d, id, xp) => d.page.evaluate(([id, xp]) => { const s = window.__app.getState(); s.xp += xp; s.done[id] = true; s.lessonsCompleted++; window.__app.persist(); return s.xp; }, [id, xp]);
const xpOnPage = (d) => d.page.evaluate(() => window.__app.getState().xp);
const syncNow = (d) => d.page.evaluate(() => window.__app.sync.syncNow().then((r) => r.ok));
const statusOf = (d) => d.page.evaluate(() => window.__app.sync.status().status);

const NS = "proj:fake.supabase.test:"; // 登录凭证和账号指针按云端项目加了命名空间
const AUTH = NS + "suipian.auth", SESSION = NS + "suipian.session";
const hasAuth = (page) => page.evaluate((k) => Object.keys(localStorage).includes(k), AUTH); // 用键枚举，不经过 getItem（getItem 可能被故障注入）
const breakAuthWrites = (page) => page.evaluate((k) => { const rm = Storage.prototype.removeItem, st = Storage.prototype.setItem; window.__rm = rm; window.__st = st; Storage.prototype.removeItem = function (key) { if (key === k) throw new Error("denied"); return rm.call(this, key); }; Storage.prototype.setItem = function (key, v) { if (key === k) throw new Error("denied"); return st.call(this, key, v); }; }, AUTH);
const fixAuthWrites = (page) => page.evaluate(() => { Storage.prototype.removeItem = window.__rm; Storage.prototype.setItem = window.__st; });
const openLoginSheet = async (d) => { await toMe(d); await d.page.locator("[data-open-login]").tap(); await d.page.locator("[data-email]").waitFor(); };
const loginMsg = (d) => d.page.locator("[data-login-msg]").innerText();
const closeSheet = async (d) => { await d.page.getByRole("button", { name: "先不登录" }).tap(); };
const toast = (d) => d.page.evaluate(() => document.querySelector(".toast")?.textContent || "");
const uidOf = (d) => d.page.evaluate(() => window.__app.sync.account().userId);
const storeKeys = (page) => page.evaluate(() => Object.keys(localStorage));
const getRaw = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const BAD = "{bad json";
// 登录一个空账号，再在存储里放进“有学习记录的游客记录 + 损坏的导入待办”，刷新页面让它们被读到
async function corruptedDevice(name, email, opts = {}) {
  const d = await device(name, opts);
  await loginUi(d, email);
  const uid = await uidOf(d);
  await d.page.evaluate(([uid, bad, ns]) => {
    const g = { ...window.__app.getState(), onboarded: true, xp: 80, lessonsCompleted: 2, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: "2026-11-05" };
    Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); /* 模拟“带着这份旧存档第一次打开 v4”：v4 键先清掉，旧键才会被迁移读取 */ localStorage.setItem("suipian.progress", JSON.stringify(g));
    localStorage.setItem(ns + "suipian.acct.import." + uid, bad);
  }, [uid, BAD, NS]);
  const reqs = []; d.page.on("request", (r) => { if (r.url().startsWith(FAKE)) reqs.push(r.method() + " " + new URL(r.url()).pathname); });
  await d.page.reload({ waitUntil: "domcontentloaded" });
  await d.page.waitForFunction(() => window.__app && window.__app.sync);
  await toMe(d);
  return { d, uid, reqs, pendKey: NS + "suipian.acct.import." + uid };
}

// 只把 Date 定到“快过期”，不触发任何计时器（fastForward 会让在途请求的超时计时器提前触发）
const jumpClock = async (page) => { const t = await page.evaluate(() => Date.now()); await page.clock.setFixedTime(t + 3_590_000); };
// 时钟被接管后页面里的 rAF / 计时器不再走，waitForFunction 会一直不返回：改成在 Node 一侧轮询
const until = async (page, fn, ms = 20000) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(fn)) return true; await new Promise((r) => setTimeout(r, 150)); } return false; };
const expireAll = () => { S.skew += 3_590_000; // 页面时间被快进了，服务端签发的新令牌按页面时间计到期
   for (const k of S.tokens.keys()) S.expired.add(k); }; // 此刻之前签发的令牌，服务端都当过期
const storedAt = (page) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)).session.accessToken; } catch { return null; } }, AUTH);
const dump = (page) => page.evaluate(() => JSON.stringify(Object.entries(localStorage).sort(([a], [b]) => a.localeCompare(b))));
const bad401 = () => S.log.filter((x) => !x.ok);


try {
  // ---- G14.1 同步期间确认删除：刷新还没返回时在界面上确认删除 → 只发一次刷新，删除用刷新后的令牌发出并成功 ----
  {
    S.skew = 0;
    const email = "g14a@example.com";
    const d = await device("G14", { clock: true });
    await loginUi(d, email);
    await earn(d, "U1L1", 40); await syncNow(d);
    const uid = await uidOf(d);
    await jumpClock(d.page); expireAll(); // 令牌进入刷新窗口（服务端当作已过期）
    S.log.length = 0; S.refreshCount = 0; S.rtReuse = 0;
    const gate = { used: false, entered: defer(), release: defer() }; d.ctx.__refreshGate = gate;
    await d.page.getByRole("button", { name: "立即同步" }).tap();
    await Promise.race([gate.entered.promise, new Promise((_, rj) => setTimeout(() => rj(new Error("刷新门闩未到达")), 15000))]);
    await d.page.locator("[data-delete-account]").tap();
    await d.page.getByRole("button", { name: "永久删除", exact: true }).tap();
    await d.page.waitForTimeout(600); // 让删除走到刷新这一步（此时同步的刷新仍被挂住）
    check("G14 刷新被挂住期间，删除没有另发第二次刷新（含被拒的复用请求）", S.refreshCount + S.rtReuse === 1, `refresh=${S.refreshCount} reuse=${S.rtReuse}`);
    gate.release.resolve();
    const done = await until(d.page, () => window.__app.sync.account() === null);
    await d.page.waitForTimeout(500);
    const dels = S.log.filter((x) => x.p === "/rest/v1/rpc/delete_my_account");
    check("G14 删除完成：账号已退出", done);
    check("G14 刷新令牌只用了一次（没有复用被拒）", S.rtReuse === 0 && S.refreshCount === 1, `reuse=${S.rtReuse} refresh=${S.refreshCount}`);
    check("G14 删除请求发出一次且带着刷新后的有效令牌（云端行已删）", dels.length === 1 && dels[0].ok === true && !S.rows.has(uid), JSON.stringify(dels));
    check("G14 没有任何请求因令牌无效被拒（401）", bad401().length === 0, JSON.stringify(bad401()));
    check("G14 本机登录凭证已清理，页面没有脚本错误", !(await hasAuth(d.page)) && d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }
} catch (e) {
  check("G14 浏览器专项测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally { await browser.close(); srv.closeAllConnections(); srv.close(); }
const bad = results.filter((r) => !r.ok).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
