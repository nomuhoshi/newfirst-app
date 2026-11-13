// 账号登录 / 云端同步的界面：真实构建产物 + 浏览器里拦截网络请求的假 Supabase（两台设备、两个账号、断网重连、游客转存）。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/account-ui.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4362, BASE = `http://localhost:${PORT}/`;
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

try {
  { // 没有云端配置：只显示“暂未开通”
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    await ctx.addInitScript(() => { try { localStorage.setItem("suipian.cloudConfig", JSON.stringify({ url: "", anonKey: "" })); } catch {} }); // 本机测试才生效：模拟“没配置”
    const page = await ctx.newPage(); await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.sync);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="account"]').tap(); await page.waitForSelector("[data-account]");
    check("没有云端配置：显示“云端暂未开通”，没有登录按钮", /云端暂未开通/.test(await page.locator("[data-account]").innerText()) && (await page.locator("[data-open-login]").count()) === 0);
    await ctx.close();
  }

  const A = await device("A-phone");
  await loginUi(A, "a@example.com");
  check("A 邮箱验证码登录成功：我的页显示邮箱和同步状态", /a@example\.com/.test(await A.page.locator("[data-account]").innerText()) && S.rows.size === 1);
  await A.shot("4-me-logged-in");
  await earn(A, "U1L1", 30); await earn(A, "U1L2", 30);
  check("A 学习后同步到云端（60 XP）", (await syncNow(A)) && xpIn("a@example.com") === 60);

  const A2 = await device("A-ipad", { viewport: { width: 820, height: 1180 } });
  await loginUi(A2, "a@example.com");
  await A2.page.getByRole("button", { name: "学习" }).tap();
  check("A 换到 iPad 登录：恢复 60 XP、两个已完成关卡", (await xpOnPage(A2)) === 60 && (await A2.page.locator(".node.done").count()) === 2, String(await xpOnPage(A2)));
  await A2.shot("5-map-restored");

  const B = await device("B-phone");
  await loginUi(B, "b@example.com");
  check("B 登录：看不到 A 的进度（0 XP、没有已完成关卡）", (await xpOnPage(B)) === 0 && Object.keys(await B.page.evaluate(() => window.__app.getState().done)).length === 0);
  await earn(B, "U1L1", 30); await syncNow(B);
  check("B 学习不影响 A 的云端记录", xpIn("a@example.com") === 60 && xpIn("b@example.com") === 30);

  await A.ctx.setOffline(true); A.ctx.__off = true;
  await earn(A, "U1L3", 30);
  check("A 离线学习：本机保存，状态是离线/待上传，不报错", (await syncNow(A)) === false && ["offline", "pending"].includes(await statusOf(A)) && (await xpOnPage(A)) === 90);
  await toMe(A); await A.shot("6-me-offline");
  check("离线时我的页显示“离线/等待上传”提示", /离线|等待上传/.test(await A.page.locator("[data-sync-status]").innerText()));
  await earn(A2, "U1L4", 30); await syncNow(A2);
  await A.ctx.setOffline(false); A.ctx.__off = false;
  await syncNow(A); await syncNow(A2); // 只发生一次真实重连：A 补传，A2 拉到最新（不再多跑一轮绕过）
  check("重连后：云端 120 XP（60 + 离线 30 + iPad 30），两台设备都是 120，没有重复加分", xpIn("a@example.com") === 120 && (await xpOnPage(A)) === 120 && (await xpOnPage(A2)) === 120, `${xpIn("a@example.com")}/${await xpOnPage(A)}/${await xpOnPage(A2)}`);
  for (let i = 0; i < 3; i++) { await syncNow(A); await syncNow(A2); }
  check("反复同步不会多加分", xpIn("a@example.com") === 120);

  await A.page.reload({ waitUntil: "domcontentloaded" }); await A.page.waitForFunction(() => window.__app && window.__app.sync);
  check("刷新页面后仍是登录状态，进度还在（120 XP）", (await A.page.evaluate(() => window.__app.sync.account()?.email)) === "a@example.com" && (await xpOnPage(A)) === 120);

  await toMe(A);
  await A.page.locator("[data-logout]").tap();
  await A.page.locator("[data-open-login]").waitFor();
  check("退出登录：回到未登录，进度回到这台设备的游客记录（0 XP）", (await A.page.evaluate(() => window.__app.sync.account())) === null && (await xpOnPage(A)) === 0);
  await loginUi(A, "a@example.com");
  check("再次登录同一账号：120 XP 完整恢复", (await xpOnPage(A)) === 120);
  await A.page.locator("[data-switch]").tap();
  await A.page.locator("[data-email]").waitFor();
  await A.page.locator("[data-email]").fill("b@example.com"); await A.page.locator("[data-send-code]").tap(); await A.page.locator("[data-code]").fill("123456"); await A.page.locator("[data-verify]").tap();
  await A.page.waitForSelector("[data-sync-status]");
  check("切换到账号 B：显示 B 的 30 XP，不是 A 的", (await xpOnPage(A)) === 30 && /b@example/.test(await A.page.locator("[data-account]").innerText()));

  const E = await device("E-phone");
  await toMe(E); await E.page.locator("[data-open-login]").tap(); await E.page.locator("[data-email]").fill("e@example.com"); await E.page.locator("[data-send-code]").tap();
  await E.page.locator("[data-code]").fill("000000"); await E.page.locator("[data-verify]").tap();
  await E.page.waitForFunction(() => /验证码错误或已过期/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  await E.shot("7-wrong-code");
  check("验证码错误/过期：提示里写明“已过期”，并且还能点“重新发送”", /已过期/.test(await E.page.locator("[data-login-msg]").innerText()) && (await E.page.locator("[data-resend]").count()) === 1);
  check("验证码错误：提示重试，没有登录、没有创建云端数据", (await E.page.evaluate(() => window.__app.sync.account())) === null && !S.users.has("e@example.com"));

  const G = await device("G-phone", { guest: { version: 3, onboarded: true, xp: 40, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-03", done: { U1L1: true, U1L2: true }, lessonsCompleted: 2, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } } });
  check("游客有进度（40 XP）", (await xpOnPage(G)) === 40);
  await loginUi(G, "g@example.com", { choice: "transfer" });
  check("选择转存：账号有 40 XP，页面仍是 40 XP，游客记录清除", xpIn("g@example.com") === 40 && (await xpOnPage(G)) === 40 && (await G.page.evaluate(() => localStorage.getItem("suipian.progress"))) === null);
  check("整个流程没有页面脚本错误", [A, A2, B, E, G].every((d) => d.errors.length === 0), JSON.stringify([A, A2, B, E, G].flatMap((d) => d.errors)));
} catch (e) {
  check("账号界面测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
