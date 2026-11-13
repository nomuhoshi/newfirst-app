// 退出后“清理本机残留登录凭证”入口的浏览器级测试（真实构建产物 + 假 Supabase）：清理失败如实报告、读取失败不当成“没有凭证”、别的标签页的登录凭证不被删。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/account-cleanup-ui.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4366, BASE = `http://localhost:${PORT}/`;
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

const NS = "proj:fake.supabase.test:"; // 登录凭证和账号指针按云端项目加了命名空间
const AUTH = NS + "suipian.auth", SESSION = NS + "suipian.session";
const hasAuth = (page) => page.evaluate((k) => Object.keys(localStorage).includes(k), AUTH); // 用键枚举，不经过 getItem（getItem 可能被故障注入）
const breakAuthWrites = (page) => page.evaluate((k) => { const rm = Storage.prototype.removeItem, st = Storage.prototype.setItem; window.__rm = rm; window.__st = st; Storage.prototype.removeItem = function (key) { if (key === k) throw new Error("denied"); return rm.call(this, key); }; Storage.prototype.setItem = function (key, v) { if (key === k) throw new Error("denied"); return st.call(this, key, v); }; }, AUTH);
const fixAuthWrites = (page) => page.evaluate(() => { Storage.prototype.removeItem = window.__rm; Storage.prototype.setItem = window.__st; });
const openLoginSheet = async (d) => { await toMe(d); await d.page.locator("[data-open-login]").tap(); await d.page.locator("[data-email]").waitFor(); };
const loginMsg = (d) => d.page.locator("[data-login-msg]").innerText();
const closeSheet = async (d) => { await d.page.getByRole("button", { name: "先不登录" }).tap(); };

try {
  // ---- U.1 退出时云端已撤销、凭证清不掉：入口出现；存储仍坏时点清理 → 如实失败，入口保留，凭证还在；修好后再点 → 成功 ----
  {
    const A = await device("U1");
    await loginUi(A, "u1@example.com");
    await breakAuthWrites(A.page);
    await A.page.locator("[data-logout]").tap();
    await A.page.waitForFunction(() => window.__app.sync.account() === null);
    check("U.1 退出后残留标记成立，凭证确实还在存储里", (await A.page.evaluate(() => window.__app.sync.hasLeftoverAuth())) === true && (await hasAuth(A.page)) === true);
    await openLoginSheet(A);
    check("U.1 登录弹窗出现“清理本机残留的登录凭证”入口", (await A.page.locator("[data-clean-auth]").count()) === 1);
    await A.page.locator("[data-clean-auth]").tap();
    await A.page.waitForFunction(() => document.querySelector("[data-login-msg]")?.textContent.trim().length > 0);
    const m1 = await loginMsg(A);
    check("U.1 存储仍坏：提示没清掉，没有说“已清理”，入口保留，凭证还在", /没清掉|还是没/.test(m1) && !/已清理/.test(m1) && (await A.page.locator("[data-clean-auth]").count()) === 1 && (await hasAuth(A.page)) === true, m1);
    await fixAuthWrites(A.page);
    await A.page.locator("[data-clean-auth]").tap();
    await A.page.waitForFunction(() => /已清理/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
    check("U.1 修好后再点：提示已清理，入口消失，凭证已从存储里删除（读回确认）", (await A.page.locator("[data-clean-auth]").count()) === 0 && (await hasAuth(A.page)) === false);
    check("U.1 全程没有页面脚本错误", A.errors.length === 0, JSON.stringify(A.errors));
    await A.ctx.close();
  }

  // ---- U.2 页面重开后凭证读取失败：不是“没有凭证”——入口仍出现，点击如实报告“无法读取”，不说已清理，凭证不动 ----
  {
    const A = await device("U2");
    await loginUi(A, "u2@example.com");
    await A.page.evaluate((k) => localStorage.removeItem(k), SESSION); // 模拟上次退出后的残留：有凭证、没有账号指针
    await A.ctx.addInitScript((k) => { const g = Storage.prototype.getItem; Storage.prototype.getItem = function (key) { if (key === k) throw new Error("read denied"); return g.call(this, key); }; }, AUTH);
    await A.page.reload({ waitUntil: "domcontentloaded" });
    await A.page.waitForFunction(() => window.__app && window.__app.sync);
    check("U.2 重开后读不出凭证：没有登录（内存里没有账号）", (await A.page.evaluate(() => window.__app.sync.account())) === null);
    await openLoginSheet(A);
    check("U.2 读取失败时入口仍然出现（无法排除残留）", (await A.page.locator("[data-clean-auth]").count()) === 1);
    await A.page.locator("[data-clean-auth]").tap();
    await A.page.waitForFunction(() => document.querySelector("[data-login-msg]")?.textContent.trim().length > 0);
    const m2 = await loginMsg(A);
    check("U.2 点击：提示无法读取 / 无法确认，没有说“已清理”，入口保留，凭证没动", /无法/.test(m2) && !/已清理/.test(m2) && (await A.page.locator("[data-clean-auth]").count()) === 1 && (await hasAuth(A.page)) === true, m2);
    check("U.2 没有页面脚本错误", A.errors.length === 0, JSON.stringify(A.errors));
    await A.ctx.close();
  }

  // ---- U.3 别的标签页有有效登录：这个标签页看不到入口，直接调用也不能删它的凭证；没有残留时也没有入口 ----
  {
    const A = await device("U3"); // 页面 1：先保持游客
    const page2 = await A.ctx.newPage();
    await page2.goto(BASE, { waitUntil: "domcontentloaded" });
    await page2.waitForFunction(() => window.__app && window.__app.sync);
    await openLoginSheet(A);
    check("U.3 没有任何残留时，登录弹窗没有清理入口", (await A.page.locator("[data-clean-auth]").count()) === 0);
    await closeSheet(A);
    // 页面 2 登录（同一份 localStorage）
    const d2 = { page: page2, shot: async () => {} };
    await loginUi(d2, "u3@example.com");
    const authBefore = await page2.evaluate((k) => localStorage.getItem(k), AUTH);
    await openLoginSheet(A);
    check("U.3 另一个标签页已登录：本标签页登录弹窗没有清理入口", (await A.page.locator("[data-clean-auth]").count()) === 0);
    const r = await A.page.evaluate(() => window.__app.sync.retryAuthCleanup());
    check("U.3 直接调用 retryAuthCleanup：拒绝（logged-in），不是 ok", r.ok === false && r.kind === "logged-in", JSON.stringify(r));
    check("U.3 另一个标签页的凭证原样，仍能同步", (await page2.evaluate((k) => localStorage.getItem(k), AUTH)) === authBefore && (await page2.evaluate(() => window.__app.sync.syncNow().then((x) => x.ok))) === true);
    check("U.3 没有页面脚本错误", A.errors.length === 0, JSON.stringify(A.errors));
    await A.ctx.close();
  }
} catch (e) {
  check("清理入口界面测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
