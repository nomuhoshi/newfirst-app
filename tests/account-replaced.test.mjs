// #11：多标签页同时刷新令牌不会被登出；别的设备“覆盖云端”后，这台设备显示“进度已被替换”提示（只在地图/我的页、只一次、做题中不打断）。
// 真实构建产物 + 浏览器里拦截网络请求的假 Supabase（刷新令牌一次性：用过就作废，和真实服务一样）。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/account-replaced.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { emptyDoc } from "../src/account-data.js";
import { AUTH_KEY } from "../src/sync.js";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4363, BASE = `http://localhost:${PORT}/`;
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
    if (u.pathname === "/auth/v1/token") { const id = S.tokens.get(body.refresh_token); S.refreshCalls = (S.refreshCalls || 0) + 1; if (id) S.tokens.delete(body.refresh_token); return id ? json(route, 200, issue(id, [...S.users].find(([, v]) => v === id)?.[0] || "")) : json(route, 400, { msg: "invalid refresh token" }); }
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
const toData = async (d) => { await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="data"]').tap(); await d.page.waitForSelector("[data-backup]"); };
const toPathTab = async (d) => { await d.page.getByRole("button", { name: "学习" }).tap().catch(async () => { await d.page.evaluate(() => window.__app.renderPath()); }); await d.page.waitForSelector(".pathview"); };
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
const notices = (d) => d.page.locator(".notice");
const REPLACED = /进度已在别的设备上被替换/;
async function overwriteCloud(email, xp = 10) { const r = S.rows.get(S.users.get(email)); const doc = emptyDoc({ gen: (r.doc.gen || 1) + 1, lineage: "L" + (r.rev + 1) }); doc.xp = { devOther: xp }; r.doc = doc; r.rev++; }

try {
  // ============ 一、两个标签页同时刷新令牌 ============
  { 
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    await fakeSupabase(ctx);
    await ctx.addInitScript((cfg) => { try { if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); } catch {} }, { url: FAKE, anonKey: "anon-test" });
    const open = async () => { const p = await ctx.newPage(); const errs = []; p.on("pageerror", (e) => errs.push(String(e.message || e))); await p.goto(BASE, { waitUntil: "domcontentloaded" }); await p.waitForFunction(() => window.__app && window.__app.sync); await p.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); }); return { page: p, errs }; };
    const t1 = await open();
    const d1 = { page: t1.page, shot: async () => {} };
    await loginUi(d1, "tabs@example.com");
    await earn(d1, "U1L1", 30);
    const first = await syncNow(d1);
    const t2 = await open();
    check("同一个账号开第二个标签页：已登录（共用本机存储）", await t2.page.evaluate(() => !!window.__app.sync.account()));
    // 让访问令牌过期，两个标签页同时同步：都需要刷新令牌，但刷新令牌只能用一次
    await t1.page.evaluate((k) => { const key = Object.keys(localStorage).find((x) => x === k || x.endsWith(":" + k)); /* 本机测试的假云端不是正式项目：凭证键带 proj:<主机名>: 前缀 */ const a = JSON.parse(localStorage.getItem(key)); a.session.expiresAt = 1; localStorage.setItem(key, JSON.stringify(a)); }, AUTH_KEY);
    const before = S.refreshCalls || 0;
    const [r1, r2] = await Promise.all([syncNow({ page: t1.page }), syncNow({ page: t2.page })]);
    const still = await Promise.all([t1.page, t2.page].map((p) => p.evaluate(() => !!window.__app.sync.account())));
    check("两个标签页同时刷新令牌：两边都没有被登出，同步都成功", first && r1 && r2 && still[0] && still[1], JSON.stringify({ first, r1, r2, still, refreshCalls: (S.refreshCalls || 0) - before }));
    const st = await Promise.all([t1.page, t2.page].map((p) => p.evaluate(() => window.__app.sync.status().status)));
    check("两个标签页的同步状态都不是“需要重新登录”", st.every((x) => x !== "auth" && x !== "signed-out"), st.join());
    check("两个标签页都没有脚本错误", t1.errs.length === 0 && t2.errs.length === 0, [...t1.errs, ...t2.errs].join(" | "));
    await ctx.close();
  }

  // ============ 二、别的设备覆盖云端：替换提示 ============
  const A = await device("A-phone");
  await loginUi(A, "a@example.com");
  await earn(A, "U1L1", 30); await earn(A, "U1L2", 30);
  check("A 学习后同步到云端（60 XP）", (await syncNow(A)) && xpIn("a@example.com") === 60);
  check("还没有被替换时：地图上没有提示", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 0);

  // 备份区文案：只有真的“已同步”才写“进度已同步到云端”；登录了但还没上传时不能提前宣称已上云；已登录不显示“导入”
  await toData(A);
  const backupSynced = await A.page.locator("[data-backup] p.small").first().innerText();
  check("已同步时：备份区只写“云端状态以“账号”页为准”，不自己宣称已上云，也没有“导入”按钮", /云端状态以“账号”页为准/.test(backupSynced) && !/已同步到云端|已在云端/.test(backupSynced) && (await A.page.locator("[data-import]").count()) === 0 && (await A.page.locator("[data-export]").count()) === 1, backupSynced);
  await A.ctx.setOffline(true); A.ctx.__off = true;
  await earn(A, "U1L4", 30);
  await toPathTab(A); await toData(A);
  const backupPending = await A.page.locator("[data-backup] p.small").first().innerText();
  check("登录了但还有进度没上传（离线）：备份区文案不变，仍不宣称已上云（同步状态只看上方）", /云端状态以“账号”页为准/.test(backupPending) && !/已同步到云端|已在云端/.test(backupPending), backupPending);
  A.ctx.__off = false; await A.ctx.setOffline(false);
  await syncNow(A);
  await toPathTab(A);

  // 1) 在地图页：A 离线多学一关，别的设备覆盖云端，A 联网同步
  await A.ctx.setOffline(true); A.ctx.__off = true;
  await earn(A, "U1L3", 30);
  await overwriteCloud("a@example.com", 10);
  A.ctx.__off = false; await A.ctx.setOffline(false);
  await A.page.evaluate(() => window.__app.renderPath());
  await syncNow(A);
  await A.page.waitForSelector(".notice");
  const t = await A.page.locator(".notice").first().innerText();
  check("地图页：覆盖后同步，显示“进度已在别的设备上被替换”提示", REPLACED.test(t), t);
  check("同步后本机进度换成云端的（XP 10），那一关的进度没有保留", (await xpOnPage(A)) === 10);
  await A.shot("6-replaced-notice-map");
  await A.page.evaluate(() => window.__app.renderPath());
  check("同一页面被刷新（比如又同步了一次）：提示还在，不会一闪而过", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 1);
  await syncNow(A);
  check("之后正常同步：提示仍留在这一页，没有重复出现第二条", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 1);
  await toMe(A);
  check("离开这一页（去“我的”）：不会再在那里重复提示", (await A.page.locator("[data-replaced-notice]").count()) === 0);
  await toPathTab(A);
  check("回到地图：同一次替换不再提示（只提示一次）", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 0);

  // 2) 没有未上传内容时被换代：不提示
  await overwriteCloud("a@example.com", 20);
  await syncNow(A); await A.page.evaluate(() => window.__app.renderPath());
  check("本机没有未上传的学习内容时，换代不提示", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 0 && (await xpOnPage(A)) === 20);

  // 3) 做题中：不打断；回到地图后再提示（一次）
  await A.ctx.setOffline(true); A.ctx.__off = true;
  await earn(A, "U1L1", 30);
  await overwriteCloud("a@example.com", 5);
  await A.page.evaluate(() => window.__app.getState() && null);
  await A.page.locator(".node.current").tap(); await A.page.locator(".overlay .btn3d.primary").tap(); await A.page.waitForSelector(".intro-title");
  await A.page.getByRole("button", { name: "继续", exact: true }).tap(); await A.page.waitForSelector("[data-check]");
  A.ctx.__off = false; await A.ctx.setOffline(false);
  await syncNow(A);
  // toast 只看带“替换”的：登录时的“登录成功，进度已同步”会残留 6 秒，不算
  const inLesson = await A.page.evaluate(() => ({ notice: !!document.querySelector(".notice"), toast: /替换/.test(document.querySelector(".toast")?.textContent || "") ? document.querySelector(".toast").textContent : false, hasCheck: !!document.querySelector("[data-check]") }));
  check("做题中发生替换：不弹提示、不打断做题", !inLesson.notice && !inLesson.toast && inLesson.hasCheck, JSON.stringify(inLesson));
  await A.page.getByRole("button", { name: "退出本关" }).tap(); await A.page.getByRole("button", { name: "退出", exact: true }).tap();
  await A.page.waitForSelector(".pathview");
  check("退出做题回到地图后：显示一次替换提示", REPLACED.test(await A.page.locator(".notice").first().innerText().catch(() => "")));
  await toMe(A); await toPathTab(A);
  check("换页再回来：提示不再出现", (await A.page.locator(".notice", { hasText: "被替换" }).count()) === 0);

  // 4) 在“我的”页
  await A.ctx.setOffline(true); A.ctx.__off = true;
  await earn(A, "U1L2", 30);
  await overwriteCloud("a@example.com", 7);
  await toMe(A); // 先停在“我的”页，再联网：联网后浏览器会自动触发同步，替换提示要出现在当前所在的页面
  A.ctx.__off = false; await A.ctx.setOffline(false);
  await syncNow(A);
  await A.page.waitForSelector("[data-replaced-notice]");
  check("“我的”页：显示替换提示", REPLACED.test(await A.page.locator("[data-replaced-notice]").innerText()));
  await A.shot("7-replaced-notice-me");
  await toPathTab(A); await toMe(A);
  check("“我的”页离开再进入：不再提示", (await A.page.locator("[data-replaced-notice]").count()) === 0);

  // 已登录时不能导入：隐藏按钮之外，读取文件和“确认导入”时都要拦住
  await toPathTab(A); await toData(A);
  const [dl] = await Promise.all([A.page.waitForEvent("download"), A.page.locator("[data-export]").tap()]);
  const saved = join(mkdtempSync(join(tmpdir(), "sp-")), dl.suggestedFilename()); await dl.saveAs(saved);
  await A.page.locator("[data-import-file]").setInputFiles(saved);
  await A.page.waitForFunction(() => /不能导入/.test(document.querySelector("[data-backup-msg]")?.textContent || ""));
  check("已登录：选了文件也不会出现导入确认框，提示要先退出登录", (await A.page.locator("[data-import-confirm]").count()) === 0 && /先退出登录/.test(await A.page.locator("[data-backup-msg]").innerText()));
  // 已经打开的确认框：模拟另一个标签页刚登录（确认框是登录前打开的），点“确认导入”也要被拦住，进度不变
  await A.page.evaluate(() => { const s = window.__app.sync; window.__realAccount = s.account; s.account = () => null; });
  await toPathTab(A); await toData(A);
  await A.page.locator("[data-import-file]").setInputFiles(saved);
  await A.page.waitForSelector("[data-import-confirm]");
  await A.page.evaluate(() => { window.__app.sync.account = window.__realAccount; });
  const xpBeforeImport = await xpOnPage(A);
  await A.page.locator("[data-import-confirm] button", { hasText: "确认导入" }).tap();
  check("确认框打开后才变成已登录：点“确认导入”被拦住，进度不变，确认框收起", (await xpOnPage(A)) === xpBeforeImport && (await A.page.locator("[data-import-confirm]").count()) === 0 && /不能导入/.test(await A.page.locator("[data-backup-msg]").innerText()));
  check("全程没有脚本错误", A.errors.length === 0, A.errors.join(" | "));
} catch (e) { check("流程跑完", false, String(e.message).split("\n").slice(0, 3).join(" ¦ ") + " @ " + String(e.stack).split("\n").find((l) => l.includes("account-replaced.test"))); }
await browser.close(); srv.closeAllConnections?.(); srv.close();
const pass = results.filter((r) => r.ok).length;
console.log(`\n${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
