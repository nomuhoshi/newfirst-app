// 更新不打断答题（G）：新版 Service Worker 装好后不立刻接管、不强制刷新；旧缓存保留；只在地图 / “我的”页提示，用户点了才更新。
// 覆盖：答题中更新、双标签（一页答题一页更新）、离线继续、延迟加载旧模块（新版服务器已没有旧文件）。桌面 Chromium + dist/ 真实构建产物；不能代替 iPhone 真机。运行：npm run build && node tests/sw-update-safe.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, cpSync, mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4337, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
let fail = 0; const check = (n, ok, d = "") => { if (!ok) fail++; console.log(`${ok ? "✅" : "❌"} ${n}${d ? "  — " + d : ""}`); };
const LESSON = { id: "E2E-CODE", title: "代码题加载测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: [
  { id: "E2E-W1", version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
    tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }], hints: ["用乘法", "print 里用逗号"], reference: 'print("总价", price * cups)' }] };
let root = DIST, srv = null;
const start = () => new Promise((res) => { srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE); let p = join(root, decodeURIComponent(url.pathname)); if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); resp.end(readFileSync(p));
}).listen(PORT, res); });
const stop = () => new Promise((res) => { srv.closeAllConnections(); srv.close(() => res()); });
const tmp = mkdtempSync(join(tmpdir(), "suipian-sw-"));
// 复制 dist 当作新版本：sw.js 版本号换掉、页面和入口脚本加标记；dropChunks：把按需加载的代码题分块从“新版服务器”和它的预缓存清单里去掉（模拟新版文件名变了，旧文件已不在服务器上）
function makeVersion(name, { dropChunks = false } = {}) {
  const dir = join(tmp, name); cpSync(DIST, dir, { recursive: true });
  const sw = join(dir, "sw.js"); let swSrc = readFileSync(sw, "utf8").replace(/const VERSION = "[^"]*";/, `const VERSION = "${name}";`);
  if (dropChunks) for (const f of readdirSync(join(dir, "assets")).filter((f) => /^(code-task|keyboard)-/.test(f))) { rmSync(join(dir, "assets", f)); swSrc = swSrc.replace(new RegExp(`\\s*"\\./assets/${f.replace(".", "\\.")}",?`), ""); }
  writeFileSync(sw, swSrc);
  const mainJs = readdirSync(join(dir, "assets")).find((f) => /^main-.*\.js$/.test(f));
  writeFileSync(join(dir, "assets", mainJs), readFileSync(join(dir, "assets", mainJs), "utf8") + `\n;window.__marker="${name}";\n`);
  return dir;
}
const keys = (pg) => pg.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("suipian-")).sort());
const waitFor = async (pg, fn, ms = 20000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await pg.evaluate(fn).catch(() => false)) return true; await pg.waitForTimeout(250); } return false; };
const ctrlCache = (pg) => pg.evaluate(() => new Promise((res) => { navigator.serviceWorker.addEventListener("message", (e) => e.data?.type === "version" && res(e.data.cache)); navigator.serviceWorker.controller.postMessage({ type: "version" }); setTimeout(() => res(null), 4000); }));
const open = async (ctx) => { const p = await ctx.newPage(); p.errors = []; p.on("pageerror", (e) => p.errors.push(String(e.message).split("\n")[0])); await p.goto(BASE); await p.waitForFunction(() => window.__app?.getState); await p.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 }); await p.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); }); return p; };
const waiting = (pg) => waitFor(pg, async () => !!(await navigator.serviceWorker.getRegistration())?.waiting);
const newCtx = (browser) => browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

await start();
const browser = await chromium.launch();
try {
  // ===== 1. 答题中更新：不接管、不刷新、不弹提示 =====
  {
    const ctx = await newCtx(browser); const A = await open(ctx); const orig = (await keys(A))[0];
    await A.locator('[data-lesson="U1L1"]').tap(); await A.locator(".sheet button", { hasText: "开始 +" }).tap(); await A.locator(".lessonfoot .btn3d.primary").tap();
    await A.locator("h2.q").waitFor({ timeout: 15000 });
    await A.evaluate(() => { window.__app.getRun().__mark = "same-run"; window.__noReload = "same-page"; });
    root = makeVersion("v2");
    await A.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    check("答题中：新版已装好并在等待（waiting）", await waiting(A));
    check("答题中：页面没有被刷新，这一关的状态还在", (await A.evaluate(() => window.__noReload)) === "same-page" && (await A.evaluate(() => window.__app.getRun()?.__mark)) === "same-run" && (await A.locator("h2.q").count()) === 1);
    check("答题中：新版没有接管（控制页面的仍是旧版缓存），旧缓存还在", (await ctrlCache(A)) === orig && (await keys(A)).includes(orig));
    check("答题中：不弹“有新版本”提示", (await A.locator("[data-update]").count()) === 0);

    // ===== 2. 双标签：另一页在地图上点“现在更新”，答题页不被刷新 =====
    const B = await open(ctx);
    check("另一个标签页在地图上看到“有新版本”提示", await waitFor(B, () => !!document.querySelector("[data-update-now]")) );
    await Promise.all([B.waitForEvent("load"), B.locator("[data-update-now]").tap()]);
    check("点“现在更新”后，这个标签页由新版接管", await waitFor(B, () => !!navigator.serviceWorker.controller) && (await ctrlCache(B)) === "suipian-v2");
    await A.waitForTimeout(1500);
    check("双标签：答题页没有被刷新，关内状态保留", (await A.evaluate(() => window.__noReload)) === "same-page" && (await A.evaluate(() => window.__app.getRun()?.__mark)) === "same-run" && (await A.locator("h2.q").count()) === 1);
    check("双标签：答题页只提示（toast），不弹更新框", (await A.locator("[data-update-now]").count()) === 0);
    check("更新后：保留了上一版缓存，新版缓存也在", (await keys(A)).join() === [orig, "suipian-v2"].sort().join(), (await keys(A)).join());

    // ===== 3. 离线继续：断网后答题页还能退出到地图、刷新后打开新版 =====
    await stop();
    await A.getByRole("button", { name: "退出本关" }).tap(); await A.getByRole("button", { name: "退出", exact: true }).tap();
    await A.waitForSelector(".pathview", { timeout: 10000 });
    check("离线：答题页断网后仍能退出到地图（没有被刷新）", (await A.evaluate(() => window.__noReload)) === "same-page");
    await A.reload(); await A.waitForSelector(".statsbar", { timeout: 15000 });
    check("离线：刷新后打开的是新版（缓存）", (await A.evaluate(() => window.__marker)) === "v2");
    await start();
    check("整个过程没有脚本错误", A.errors.length === 0 && B.errors.length === 0, [...A.errors, ...B.errors].join(" | "));
    await ctx.close();
  }

  // ===== 4. 延迟加载旧模块：新版服务器已经没有旧分块，旧页面按需加载时从保留的旧缓存里取 =====
  {
    root = DIST;
    const ctx = await newCtx(browser); const C = await open(ctx); const orig = (await keys(C))[0];
    const reqs = []; C.on("request", (r) => reqs.push(new URL(r.url()).pathname));
    root = makeVersion("v2", { dropChunks: true });
    await C.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    check("延迟加载：新版（已去掉旧分块）装好并等待", await waiting(C));
    const D = await open(ctx);
    await waitFor(D, () => !!document.querySelector("[data-update-now]"));
    await Promise.all([D.waitForEvent("load"), D.locator("[data-update-now]").tap()]);
    await waitFor(D, () => !!navigator.serviceWorker.controller);
    check("延迟加载：旧页面（C）此时尚未加载代码题分块，新版服务器上已没有旧分块", !reqs.some((p) => /\/assets\/code-task-/.test(p)) && !readdirSync(join(root, "assets")).some((f) => /^code-task-/.test(f)));
    await C.evaluate((l) => window.__app.startLesson(l), LESSON);
    await C.getByRole("button", { name: "继续", exact: true }).tap();
    await C.waitForSelector("[data-code-task], [data-retry-code-task]", { timeout: 20000 });
    check("延迟加载：旧页面进入代码题，从保留的旧缓存取到旧分块，编辑器正常显示", (await C.locator("[data-code-task]").count()) === 1 && (await C.locator("[data-retry-code-task]").count()) === 0, (await C.locator("#app").innerText()).slice(0, 60));
    check("延迟加载：没有强制刷新", (await keys(C)).includes(orig));
    await ctx.close();
  }
} finally { await browser.close(); await stop().catch(() => {}); rmSync(tmp, { recursive: true, force: true }); }
console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
