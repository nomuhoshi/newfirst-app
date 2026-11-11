// 损坏导入待办的恢复入口（真实构建产物 + 假 Supabase 的 HTTP 层）：确认损坏才出现“备份并重新导入”，读取失败只给“重试读取”；
// 备份成功后才移除原待办并重新弹出选择，选“合并”后云端 XP 只加一次；备份写不进去时如实失败、原待办保留、不说恢复成功。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/pending-quarantine-ui.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4367, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = "https://fake.supabase.test";
const results = [];
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
const S = { users: new Map(), rows: new Map(), tokens: new Map(), n: 0 };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: body === undefined ? "" : JSON.stringify(body) });
async function fakeSupabase(ctx) {
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (ctx.__off) return route.abort("internetdisconnected"); // Chromium 的 setOffline 拦不住 route 接管的请求，这里自己断
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const uid = S.tokens.get((req.headers().authorization || "").replace("Bearer ", ""));
    const issue = (id, email) => { const at = "at-" + ++S.n, rt = "rt-" + S.n; S.tokens.set(at, id); S.tokens.set(rt, id); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email } }; };
    if (u.pathname === "/auth/v1/otp") return json(route, 200, {});
    if (u.pathname === "/auth/v1/verify") { if (body.token !== "123456") return json(route, 403, { msg: "Token has expired or is invalid" }); if (!S.users.has(body.email)) S.users.set(body.email, "u" + S.users.size + "xxxxxxxx"); return json(route, 200, issue(S.users.get(body.email), body.email)); }
    if (u.pathname === "/auth/v1/token") { const id = S.tokens.get(body.refresh_token); return id ? json(route, 200, issue(id, [...S.users].find(([, v]) => v === id)?.[0] || "")) : json(route, 400, { msg: "invalid refresh token" }); }
    if (u.pathname === "/auth/v1/logout") return json(route, 204);
    if (!uid) return json(route, 401, { message: "JWT expired" });
    if (u.pathname === "/rest/v1/progress") return json(route, 200, S.rows.has(uid) ? [S.rows.get(uid)] : []);
    if (u.pathname === "/rest/v1/rpc/create_progress") { if (S.rows.has(uid)) return json(route, 200, null); S.rows.set(uid, { doc: body.new_doc, rev: 1 }); return json(route, 200, 1); }
    if (u.pathname === "/rest/v1/rpc/save_progress") { const r = S.rows.get(uid); if (!r || r.rev !== body.expected_rev) return json(route, 200, null); r.doc = body.new_doc; r.rev++; return json(route, 200, r.rev); }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") { S.rows.delete(uid); return json(route, 200, null); }
    return json(route, 404, { message: "no route" });
  });
}
const xpIn = (email) => Object.values(S.rows.get(S.users.get(email))?.doc.xp ?? {}).reduce((a, b) => a + b, 0);

async function device(name, { guest = null, viewport = { width: 390, height: 844 } } = {}) {
  const ctx = await browser.newContext({ viewport, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await fakeSupabase(ctx);
  await ctx.addInitScript(([cfg, g]) => { try { if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (g && !localStorage.getItem("suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem("suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {} }, [{ url: FAKE, anonKey: "pub-key" }, guest]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { name, ctx, page, errors, shot: (n) => shot(page, `acct-${name}-${n}`) };
}
const toMe = async (d) => { await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.waitForSelector("[data-account]"); };
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
async function corruptedDevice(name, email) {
  const d = await device(name);
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

try {
  // ---- Q.1 确认损坏：入口出现；点“备份并重新导入”→ 确认 → 备份 → 重新弹出选择 → 合并后云端 XP 只加一次 ----
  {
    const { d, uid, reqs, pendKey } = await corruptedDevice("Q1", "q1@example.com");
    await d.page.waitForSelector("[data-recovery]");
    check("Q.1 确认损坏时显示“备份并重新导入”", (await d.page.locator('[data-recovery="corrupt"] [data-quarantine]').count()) === 1);
    check("Q.1 同时不显示“重试读取”", (await d.page.locator("[data-pending-retry]").count()) === 0);
    check("Q.1 状态文案说明同步已锁定", /损坏/.test(await d.page.locator("[data-sync-status]").innerText()));
    await d.shot("1-locked");
    await d.page.locator("[data-sync-now]").tap();
    await d.page.waitForTimeout(300);
    check("Q.1 锁定时“立即同步”不联网，云端 XP 仍是 0", reqs.filter((r) => r.includes("/rest/")).length === 0 && xpIn("q1@example.com") === 0, JSON.stringify(reqs));
    const guestBefore = await getRaw(d.page, "suipian.progress"), acctBefore = await getRaw(d.page, NS + "suipian.acct." + uid), authBefore = await getRaw(d.page, AUTH);
    reqs.length = 0;
    await d.page.locator("[data-quarantine]").tap();
    await d.page.getByRole("button", { name: "备份并继续" }).waitFor();
    await d.shot("2-confirm");
    await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForSelector("[data-import-choice]");
    await d.shot("3-choice");
    check("Q.1 备份已落盘：原文逐字一致", (await storeKeys(d.page)).some((k) => k.startsWith(NS + "suipian.acct.quarantine." + uid + ".")) && (await d.page.evaluate(([ns, uid]) => { const k = Object.keys(localStorage).find((x) => x.startsWith(ns + "suipian.acct.quarantine." + uid + ".")); return JSON.parse(localStorage.getItem(k)).raw; }, [NS, uid])) === BAD);
    check("Q.1 原待办已移除；游客记录 / 账号副本 / 登录凭证原样", (await getRaw(d.page, pendKey)) === null && (await getRaw(d.page, "suipian.progress")) === guestBefore && (await getRaw(d.page, NS + "suipian.acct." + uid)) === acctBefore && (await getRaw(d.page, AUTH)) === authBefore);
    check("Q.1 隔离本身没有云端请求；之后只读了一次云端（核对）", reqs.every((r) => r.startsWith("GET ")) && reqs.length >= 1, JSON.stringify(reqs));
    check("Q.1 重新弹出选择（不是静默跳过）", (await d.page.locator('[data-import-choice] [data-choice="transfer"]').count()) === 1);
    await d.page.locator('[data-import-choice] [data-choice="transfer"]').tap();
    await d.page.waitForFunction(() => !document.querySelector("[data-import-choice]"));
    check("Q.1 合并后云端 XP = 游客的 80（只加一次）", xpIn("q1@example.com") === 80, String(xpIn("q1@example.com")));
    await syncNow(d); await syncNow(d);
    check("Q.1 再同步两次 XP 不变（没有重复加分）", xpIn("q1@example.com") === 80);
    await toMe(d);
    check("Q.1 恢复入口消失，没有残留待办", (await d.page.locator("[data-recovery]").count()) === 0 && (await getRaw(d.page, pendKey)) === null);
    check("Q.1 没有页面脚本错误", d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }

  // ---- Q.2 读取失败：只给“重试读取”，绝不给隔离；点了之后什么都没被删 ----
  {
    const { d, uid, pendKey } = await corruptedDevice("Q2", "q2@example.com");
    await d.page.evaluate((k) => { const g = Storage.prototype.getItem; window.__gi = g; Storage.prototype.getItem = function (key) { if (key === k) throw new Error("storage read failure"); return g.call(this, key); }; }, pendKey);
    await d.page.getByRole("button", { name: "学习" }).tap().catch(() => {});
    await toMe(d);
    await d.page.waitForSelector("[data-recovery]");
    check("Q.2 读取失败时显示“重试读取”，不显示“备份并重新导入”", (await d.page.locator('[data-recovery="read-failed"] [data-pending-retry]').count()) === 1 && (await d.page.locator("[data-quarantine]").count()) === 0);
    await d.page.locator("[data-pending-retry]").tap();
    await d.page.waitForTimeout(300);
    const direct = await d.page.evaluate(() => window.__app.sync.quarantinePendingImport());
    check("Q.2 直接调用也被拒（read-failed），没有备份、原待办还在", direct.ok === false && direct.kind === "read-failed" && !(await storeKeys(d.page)).some((k) => k.includes("suipian.acct.quarantine.")));
    await d.page.evaluate(() => { Storage.prototype.getItem = window.__gi; });
    check("Q.2 恢复读取后原待办原文仍在", (await getRaw(d.page, pendKey)) === BAD);
    check("Q.2 没有页面脚本错误", d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }

  // ---- Q.3 备份写不进去：如实失败，原待办保留，不说恢复成功，入口还在，游客 / 账号副本不动 ----
  {
    const { d, uid, pendKey } = await corruptedDevice("Q3", "q3@example.com");
    const guestBefore = await getRaw(d.page, "suipian.progress");
    await d.page.evaluate(() => { const s = Storage.prototype.setItem; window.__si = s; Storage.prototype.setItem = function (k, v) { if (String(k).includes("suipian.acct.quarantine.")) throw new DOMException("quota", "QuotaExceededError"); return s.call(this, k, v); }; });
    await d.page.locator("[data-quarantine]").tap();
    await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForFunction(() => /没有动|没能备份/.test(document.querySelector(".toast")?.textContent || ""));
    const t = await toast(d);
    await d.shot("4-backup-failed");
    check("Q.3 提示如实说明没备份、没动待办，不含“已备份并移除 / 已恢复”", /没能备份|没有动/.test(t) && !/已备份并移除|已恢复|恢复成功/.test(t), t);
    check("Q.3 原待办原文保留，入口仍在，没有弹出选择", (await getRaw(d.page, pendKey)) === BAD && (await d.page.locator('[data-recovery="corrupt"]').count()) === 1 && (await d.page.locator("[data-import-choice]").count()) === 0);
    check("Q.3 游客记录原样，云端 XP 仍是 0", (await getRaw(d.page, "suipian.progress")) === guestBefore && xpIn("q3@example.com") === 0);
    await d.page.evaluate(() => { Storage.prototype.setItem = window.__si; });
    await d.page.locator("[data-quarantine]").tap();
    await d.page.getByRole("button", { name: "备份并继续" }).tap();
    await d.page.waitForSelector("[data-import-choice]");
    check("Q.3 存储恢复后再点一次成功（失败没有留下半截状态）", (await getRaw(d.page, pendKey)) === null);
    check("Q.3 没有页面脚本错误", d.errors.length === 0, JSON.stringify(d.errors));
    await d.ctx.close();
  }
} catch (e) {
  check("恢复入口界面测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
