// 账号发布开关关闭时的正式构建（2026-11-11 产品官 5 号：先发布 U1–U5 游客版，账号等 SMTP 验收后开放）。
// 用 CI 的正式构建产物 dist/ 验证：
//  1. 看不到任何登录 / 注册 / 验证码入口（我的页、地图页、开场介绍最后一屏），点不出验证码流程；
//  2. 不发任何请求到 Supabase；
//  3. 本机已有的正式版登录凭证、账号副本、游客记录逐字不变（不清除、不改写），刷新后也不变；
//  4. 游客学习的本地进度能保存，刷新后保留。
// 运行：npm run build && MOBILE_BROWSER=chromium|webkit node tests/accounts-off.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${BNAME}] ${n}${!ok && d ? "  — " + d : ""}`); };
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, s) => { let p = decodeURIComponent(new URL(q.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
  const f = resolve(join(DIST, p)); if (!f.startsWith(DIST + sep) || !existsSync(f) || statSync(f).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(f)); });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}/`;
let browser;
try { browser = await (BNAME === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log(`环境失败：${BNAME} 起不来：${String(e.message).split("\n")[0]}`); srv.close(); process.exit(2); }

const NOW = Date.now();
const KEEP = {  // 假设这台设备以前在正式版登录过：这些键必须逐字保留
  "suipian.auth": JSON.stringify({ session: { accessToken: "prod-at-keep", refreshToken: "prod-rt-keep", expiresAt: NOW + 3600_000, userId: "prodUser1", email: "prod@example.com" } }),
  "suipian.session": "prodUser1",
  "suipian.acct.prodUser1": JSON.stringify({ doc: { schema: 1, gen: 1, lineage: "L-prod", xp: { prodDevice1: 40 }, runs: { prodDevice1: 2 }, done: { U1L1: "2026-11-01" }, days: ["2026-11-01"], hearts: { n: 4, msToNext: 0 }, prefs: {}, imported: {}, updatedAt: NOW }, rev: 3, dirty: {} }),
  "suipian.device": "prodDevice1",
};
const LOGIN_TEXT = /登录|注册|验证码/;

async function run(label, seed) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block" });
  const supa = []; ctx.on("request", (r) => { if (/supabase\.(co|in)/i.test(r.url())) supa.push(r.url()); });
  if (seed) await ctx.addInitScript((kv) => { if (!sessionStorage.getItem("seeded")) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, seed);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState); await page.waitForTimeout(400);
  return { ctx, page, supa, errors };
}
const raw = (page) => page.evaluate((keys) => Object.fromEntries(keys.map((k) => [k, localStorage.getItem(k)])), Object.keys(KEEP));

// A 新用户（没有任何记录）：开场介绍最后一屏、地图页、我的页都没有登录入口
{
  const { ctx, page, supa, errors } = await run("new");
  const onboardText = [];
  for (let i = 0; i < 8; i++) {   // 一屏一屏翻到开场介绍最后一屏
    onboardText.push(await page.locator("#app").innerText());
    if (!(await page.locator(".onboard").count())) break;
    check(`A0 开场介绍第 ${i + 1} 屏：没有“已有账号？登录”按钮`, (await page.locator("[data-onboard-login]").count()) === 0);
    const next = page.locator(".onboard .btn3d.primary").first();
    await next.click().catch(() => {}); await page.waitForTimeout(150);
  }
  check("A1 开场介绍每一屏都没有“登录 / 注册 / 验证码”字样", onboardText.every((t) => !LOGIN_TEXT.test(t)), onboardText.find((t) => LOGIN_TEXT.test(t))?.slice(0, 120));
  await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); }); await page.reload(); await page.waitForSelector(".pathview");
  check("A2 地图页：没有登录入口", (await page.locator("[data-login], [data-open-login]").count()) === 0 && !/登录 \/ 注册/.test(await page.locator(".pathview").innerText()));
  await page.getByRole("button", { name: "我的" }).click(); await page.locator('[data-me-menu="account"]').click(); await page.waitForTimeout(300);
  const me = await page.locator("#app").innerText();
  check("A3 我的页：显示“云端暂未开通”，没有登录 / 注册按钮", /云端暂未开通/.test(me) && (await page.locator("[data-open-login], [data-login]").count()) === 0, me.slice(0, 200));
  check("A4 页面里找不到验证码输入框和“发送验证码”按钮", (await page.locator('input[type="email"], [data-send], [data-verify]').count()) === 0);
  check("A5 没有任何请求发到 Supabase", supa.length === 0, supa.join(" "));
  check("A6 没有脚本错误", errors.length === 0, errors.join("; "));
  await ctx.close();
}
// B 以前在正式版登录过的设备：凭证和账号副本逐字不变，不发请求；本地进度能保存并在刷新后保留
{
  const { ctx, page, supa, errors } = await run("returning", KEEP);
  check("B1 打开后：登录凭证、账号副本、设备号逐字不变", JSON.stringify(await raw(page)) === JSON.stringify(KEEP));
  const xp0 = await page.evaluate(() => window.__app.getState().xp);
  await page.evaluate(() => { const s = window.__app.getState(); s.xp += 5; s.done = { ...s.done, U1L2: true }; window.__app.persist(); });
  await page.reload(); await page.waitForFunction(() => window.__app?.getState); await page.waitForTimeout(300);
  const after = await page.evaluate(() => ({ xp: window.__app.getState().xp, u12: !!window.__app.getState().done.U1L2 }));
  check("B2 本地进度能保存：加 5 XP、完成一关后刷新，仍在", after.xp === xp0 + 5 && after.u12, JSON.stringify({ xp0, after }));
  const now = await raw(page);
  check("B3 刷新后：登录凭证、设备号仍逐字不变（不清除登录会话）", now["suipian.auth"] === KEEP["suipian.auth"] && now["suipian.session"] === KEEP["suipian.session"] && now["suipian.device"] === KEEP["suipian.device"]);
  check("B4 账号副本仍在（没有被删除）", !!now["suipian.acct.prodUser1"]);
  check("B5 没有任何请求发到 Supabase（云端数据不会被读写）", supa.length === 0, supa.join(" "));
  check("B6 没有脚本错误", errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
const failed = results.filter((r) => !r).length; console.log(`\n共 ${results.length} 项，失败 ${failed} 项`); process.exit(failed ? 1 : 0);
