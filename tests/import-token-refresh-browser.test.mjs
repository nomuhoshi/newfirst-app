// 损坏导入待办的恢复入口（真实构建产物 + 假 Supabase 的 HTTP 层）：确认损坏才出现“备份并重新导入”，读取失败只给“重试读取”；
// 备份成功后才移除原待办并重新弹出选择，选“合并”后云端 XP 只加一次；备份写不进去时如实失败、原待办保留、不说恢复成功。
// G-LOGIN-13：游客导入全链路刷新令牌后后续请求用新令牌（真实构建 + 严格令牌的假 Supabase）；跨页取代后不写本机。
// 运行：npm run build:ci && MOBILE_BROWSER=chromium node tests/import-token-refresh-browser.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4369, BASE = `http://localhost:${PORT}/`;
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
const S = { users: new Map(), rows: new Map(), tokens: new Map(), n: 0, expired: new Set(), atOf: new Map(), usedRt: new Set(), rtReuse: 0, log: [], skew: 0 }; // G-LOGIN-13：令牌严格——被标记过期 / 刷新后旧访问令牌立即 401，刷新令牌一次性
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
    if (u.pathname === "/auth/v1/token") { if (S.usedRt.has(body.refresh_token)) { S.rtReuse++; return json(route, 400, { msg: "refresh token already used" }); } ctx.__onRefresh?.(); const id = S.tokens.get(body.refresh_token); if (id) { S.usedRt.add(body.refresh_token); S.expired.add(S.atOf.get(body.refresh_token)); } return id ? json(route, 200, issue(id, [...S.users].find(([, v]) => v === id)?.[0] || "")) : json(route, 400, { msg: "invalid refresh token" }); }
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
  // ---- G13.1 首次登录选择：CAS 冲突 + 验证会话过期 → 局部刷新，后续请求都用新令牌，最终提交的也是新令牌 ----
  {
    S.skew = 0;
    const email = "g13a@example.com";
    const ds = await device("G13seed"); await loginUi(ds, email); await earn(ds, "U1L1", 40); await syncNow(ds); await ds.ctx.close();
    const d = await device("G13login", { clock: true });
    await earn(d, "U1L2", 80);
    await toMe(d); await d.page.locator("[data-open-login]").tap(); await d.page.locator("[data-email]").fill(email);
    await d.page.locator("[data-send-code]").tap(); await d.page.locator("[data-code]").waitFor(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
    await d.page.locator('[data-choice="transfer"]').waitFor();
    S.log.length = 0; let hooked = 0;
    d.ctx.__conflictOnce = async () => { hooked++; await jumpClock(d.page); expireAll(); }; // 别的设备抢先写 + 验证会话进入刷新窗口
    await d.page.locator('[data-choice="transfer"]').tap();
    await until(d.page, () => !document.querySelector("[data-login]") && window.__app.sync.status().status === "synced");
    await d.page.waitForTimeout(500);
    check("G13 首次登录：冲突 + 过期确实发生过一次", hooked === 1);
    check("G13 首次登录：过期之后没有任何请求带着过期令牌（没有 401 / 没有误报重新登录）", bad401().length === 0 && (await statusOf(d)) !== "need-login", JSON.stringify(bad401()));
    check("G13 首次登录：刷新令牌只用了一次，没有复用", S.rtReuse === 0);
    check("G13 首次登录：最终保存的登录令牌是刷新后的（未过期）", !S.expired.has(await storedAt(d.page)));
    check("G13 首次登录：云端 XP = 云端 40 + 游客 80，只加一次", xpIn(email) === 120, String(xpIn(email)));
    check("G13 首次登录：状态已同步，没有页面脚本错误", (await statusOf(d)) === "synced" && d.errors.length === 0, (await statusOf(d)) + JSON.stringify(d.errors));
    await d.ctx.close();
  }
  // ---- G13.2 恢复后重新选择（已登录）：冲突 + 令牌过期 → 刷新后重读 / 保存 / 读回用新令牌，收尾不回写旧令牌 ----
  {
    S.skew = 0;
    const { d, uid } = await corruptedDevice("G13resume", "g13b@example.com", { clock: true });
    await d.page.waitForSelector("[data-recovery]");
    await d.page.locator("[data-quarantine]").tap(); await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForSelector("[data-import-choice]");
    S.log.length = 0; let hooked = 0;
    d.ctx.__conflictOnce = async () => { hooked++; await jumpClock(d.page); expireAll(); };
    await d.page.locator('[data-import-choice] [data-choice="transfer"]').tap();
    await until(d.page, () => !document.querySelector("[data-import-choice]") && window.__app.sync.status().status === "synced");
    await d.page.waitForTimeout(500);
    check("G13 恢复后重新选择：冲突 + 过期确实发生过一次", hooked === 1);
    check("G13 恢复后重新选择：过期之后没有请求带着旧令牌（不误报重新登录）", bad401().length === 0 && (await statusOf(d)) !== "need-login", JSON.stringify(bad401()));
    check("G13 恢复后重新选择：刷新令牌没有复用；存储里是刷新后的令牌", S.rtReuse === 0 && !S.expired.has(await storedAt(d.page)));
    check("G13 恢复后重新选择：云端 XP = 游客的 80（只加一次），状态已同步", xpIn("g13b@example.com") === 80 && (await statusOf(d)) === "synced", String(xpIn("g13b@example.com")));
    check("G13 恢复后重新选择：没有页面脚本错误", d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }
  // ---- G13.3 读回期间另一个标签页退出并换登录 B：本页不写副本、不清游客和待办，共享存储逐字节不变 ----
  // 真实浏览器里另一页的退出会被本页持有的写回锁挡住，“换成另一个账号”的交错造不出来（Node 专项两种模式都覆盖了）；这里只测同号重登。
  for (const who of ["g13c@example.com"]) {
    const { d, uid } = await corruptedDevice("G13tab-" + (who.includes("other") ? "other" : "same"), "g13c@example.com");
    const page2 = await d.ctx.newPage(); await page2.goto(BASE, { waitUntil: "domcontentloaded" }); await page2.waitForFunction(() => window.__app && window.__app.sync && window.__app.sync.account());
    await d.page.waitForSelector("[data-recovery]");
    await d.page.locator("[data-quarantine]").tap(); await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForSelector("[data-import-choice]");
    const gate = { used: false, uid, skip: 1, status: 200, entered: defer(), release: defer(), done: defer() }; d.ctx.__g04Gate = gate;
    await d.page.locator('[data-import-choice] [data-choice="transfer"]').tap();
    await Promise.race([gate.entered.promise, new Promise((_, rj) => setTimeout(() => rj(new Error("读回门闩未到达")), 15000))]);
    await page2.evaluate(async (email) => { const s = window.__app.sync; await s.forceLocalLogout(); const v = await s.verify(email, "123456", window.__app.getState()); return v.ok; }, who);
    const before = await dump(page2), reqs = S.log.length;
    gate.release.resolve(); await gate.done.promise; await d.page.waitForTimeout(600);
    check("G13 跨页取代（" + (who.includes("other") ? "换号" : "同号重登") + "）：本页不写副本、不清游客和待办，存储逐字节不变", (await dump(page2)) === before);
    check("G13 跨页取代：本页不再发请求，已丢弃失权会话", S.log.length === reqs && (await d.page.evaluate(() => window.__app.sync.account())) === null, String(S.log.length - reqs));
    check("G13 跨页取代：没有页面脚本错误", d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }
  // ---- G13.4 同步重试待办（已登录）读回期间另一个标签页退出并换登录：本页不写副本、不清游客和待办 ----
  for (const who of ["g13d@example.com"]) {
    const { d, uid, pendKey } = await corruptedDevice("G13sync-" + (who.includes("other") ? "other" : "same"), "g13d@example.com");
    const page2 = await d.ctx.newPage(); await page2.goto(BASE, { waitUntil: "domcontentloaded" }); await page2.waitForFunction(() => window.__app && window.__app.sync && window.__app.sync.account());
    await d.page.waitForSelector("[data-recovery]");
    await d.page.locator("[data-quarantine]").tap(); await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForSelector("[data-import-choice]");
    d.ctx.__failSave = true; // 第一次选择：保存失败 → 留下健康的导入待办
    await d.page.locator('[data-import-choice] [data-choice="transfer"]').tap();
    await until(d.page, () => !document.querySelector("[data-import-choice]") && window.__app.sync.status().status === "pending");
    d.ctx.__failSave = false;
    const gate = { used: false, uid, skip: 1, status: 200, entered: defer(), release: defer(), done: defer() }; d.ctx.__g04Gate = gate;
    const run = d.page.evaluate(() => window.__app.sync.syncNow({ manual: true }).then((r) => ({ ok: r.ok, stale: !!r.stale })));
    await Promise.race([gate.entered.promise, new Promise((_, rj) => setTimeout(() => rj(new Error("读回门闩未到达")), 15000))]);
    await page2.evaluate(async (email) => { const s = window.__app.sync; await s.forceLocalLogout(); const v = await s.verify(email, "123456", window.__app.getState()); return v.ok; }, who);
    const before = await dump(page2), reqs = S.log.length;
    gate.release.resolve(); await gate.done.promise; await d.page.waitForTimeout(600);
    check("G13 同步重试待办 · 跨页取代（" + (who.includes("other") ? "换号" : "同号重登") + "）：本页不写副本、不清游客和待办，存储逐字节不变", (await dump(page2)) === before);
    check("G13 同步重试待办 · 跨页取代：本页不再发请求，已丢弃失权会话", S.log.length === reqs && (await d.page.evaluate(() => window.__app.sync.account())) === null, String(S.log.length - reqs));
    await d.ctx.close();
  }
} catch (e) {
  check("G13 浏览器专项测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally { await browser.close(); srv.closeAllConnections(); srv.close(); }
const bad = results.filter((r) => !r.ok).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
