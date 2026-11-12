// 更新不打断答题（G）：新版 Service Worker 装好后不立刻接管、不强制刷新；旧缓存保留；只在地图 / “我的”页提示，用户点了才更新。
// 覆盖：答题中更新、双标签（一页答题一页更新）、离线继续、延迟加载旧模块（新版服务器已没有旧文件）。桌面 Chromium + dist/ 真实构建产物；不能代替 iPhone 真机。运行：npm run build && node tests/sw-update-safe.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, cpSync, mkdtempSync, writeFileSync, rmSync, readdirSync, mkdirSync, symlinkSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const REPO = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(REPO, "dist");
const OLD_SHA = process.env.OLD_MAIN_SHA || "6f56fb05aeec89d0f2c706aaa2a571bde3e9f5ab"; // 真实旧 main（#79 合并时的正式版）：用它自己的源码重新构建，得到真实的旧版 sw.js 和旧版页面脚本
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

// 用旧 main 的源码真实构建一份旧版产物（不是复制新版 dist 改版本号）
function buildOldMain() {
  const src = join(tmp, "old-src"); mkdirSync(src);
  try { execSync(`git cat-file -e ${OLD_SHA}^{commit}`, { cwd: REPO, stdio: "ignore" }); } catch { execSync(`git fetch --depth=1 origin ${OLD_SHA}`, { cwd: REPO, stdio: "inherit" }); }
  execSync(`git archive ${OLD_SHA} | tar -x -C "${src}"`, { cwd: REPO, shell: "/bin/bash" });
  symlinkSync(join(REPO, "node_modules"), join(src, "node_modules"));
  execSync("node node_modules/vite/bin/vite.js build", { cwd: src, stdio: "pipe" });
  const out = join(src, "dist"); if (!existsSync(join(out, "sw.js"))) throw new Error("旧 main 构建失败：没有 sw.js");
  return out;
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

  // ===== 5. 真实旧 main 升级：旧版 sw.js + 旧版页面 → 本 PR 的新版；不接管、不删旧缓存、跨多个版本后旧页面仍能按需加载旧分块 =====
  {
    const OLD = buildOldMain(); root = OLD;
    const ctx = await newCtx(browser); const A = await open(ctx); const oldCache = (await keys(A))[0];
    await A.locator('[data-lesson="U1L1"]').tap(); await A.locator(".sheet button", { hasText: "开始 +" }).tap(); await A.locator(".lessonfoot .btn3d.primary").tap();
    await A.locator("h2.q").waitFor({ timeout: 15000 });
    await A.evaluate(() => { window.__app.getRun().__mark = "same-run"; window.__noReload = "same-page"; });
    root = DIST; // 换成本 PR 的新版
    await A.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    check("旧 main 升级：新版装好后等待，不接管旧页面（控制页面的仍是旧版缓存）", (await waiting(A)) && (await ctrlCache(A)) === oldCache);
    check("旧 main 升级：答题页没有被刷新，状态在；旧缓存还在", (await A.evaluate(() => window.__noReload)) === "same-page" && (await A.evaluate(() => window.__app.getRun()?.__mark)) === "same-run" && (await keys(A)).includes(oldCache));
    const B = await open(ctx);
    check("旧 main 升级：另一个标签页（加载到新版页面）在地图上看到更新提示", await waitFor(B, () => !!document.querySelector("[data-update-now]")));
    await Promise.all([B.waitForEvent("load"), B.locator("[data-update-now]").tap()]);
    await waitFor(B, () => !!navigator.serviceWorker.controller);
    const newCache = await ctrlCache(B);
    check("旧 main 升级：点“现在更新”后新版接管，新旧两个版本的缓存都保留（没有历史标记也不删）", !!newCache && newCache !== oldCache && (await keys(B)).includes(oldCache) && (await keys(B)).includes(newCache), (await keys(B)).join());
    await A.waitForTimeout(1200);
    check("旧 main 升级：旧页面（答题中）仍没有被刷新", (await A.evaluate(() => window.__noReload)) === "same-page" && (await A.evaluate(() => window.__app.getRun()?.__mark)) === "same-run");
    // 再发布一个新版本并更新：旧页面跨了两个版本，仍要能按需加载旧分块（新版服务器上已没有旧文件名）
    root = makeVersion("v3");
    await B.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await waitFor(B, () => !!document.querySelector("[data-update-now]"), 30000).catch(() => {});
    await B.evaluate(() => window.__app.renderPath());
    if (await B.locator("[data-update-now]").count()) await Promise.all([B.waitForEvent("load"), B.locator("[data-update-now]").tap()]);
    await waitFor(B, () => !!navigator.serviceWorker.controller);
    check("跨多个版本：三个版本的缓存都在", (await keys(B)).length >= 3 && (await keys(B)).includes(oldCache) && (await keys(B)).includes("suipian-v3"), (await keys(B)).join());
    await A.evaluate((l) => window.__app.startLesson(l), LESSON);
    await A.getByRole("button", { name: "继续", exact: true }).tap();
    await A.waitForSelector("[data-code-task], [data-retry-code-task]", { timeout: 25000 });
    check("跨多个版本：旧页面进入代码题，旧分块从旧缓存加载，编辑器正常显示", (await A.locator("[data-code-task]").count()) === 1 && (await A.locator("[data-retry-code-task]").count()) === 0, (await A.locator("#app").innerText()).slice(0, 60));
    check("跨多个版本：旧页面全程没有被刷新", (await A.evaluate(() => window.__noReload)) === "same-page");
    await ctx.close();
  }

  // ===== 6. 保存失败时不更新：有没保存的进度时点“现在更新”，不刷新、不接管、不声称已保存；恢复后再点才更新 =====
  {
    root = DIST;
    const ctx = await newCtx(browser); const P = await open(ctx); const base = (await keys(P))[0];
    root = makeVersion("v2");
    await P.evaluate(async () => { await (await navigator.serviceWorker.getRegistration()).update(); });
    await waiting(P); await P.evaluate(() => window.__app.renderPath());
    await P.evaluate(() => { window.__noReload = "same-page"; const s = window.__app.getState(); s.done.U1L1 = true; s.xp += 20; s.lessonsCompleted += 1; // 一份还没保存的新进度
      window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).includes("suipian.v4.tab.")) throw new DOMException("full", "QuotaExceededError"); return window.__realSet.call(this, k, v); }; });
    await P.locator("[data-update-now]").tap(); await P.waitForTimeout(1500);
    const msg = (await P.locator("[data-update-msg]").innerText().catch(() => "")) || "";
    check("保存失败：没有刷新页面，新版仍在等待（没有接管）", (await P.evaluate(() => window.__noReload)) === "same-page" && (await P.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting)) && (await ctrlCache(P)) === base);
    check("保存失败：提示没保存成功、暂不更新，且不说“已保存”", /没能把进度保存到本机/.test(msg) && /暂不更新/.test(msg) && !/已保存|保存成功|已经保存/.test(msg), msg);
    await P.evaluate(() => { Storage.prototype.setItem = window.__realSet; });
    await Promise.all([P.waitForEvent("load"), P.locator("[data-update-now]").tap()]);
    await waitFor(P, () => !!navigator.serviceWorker.controller);
    const kept = await P.evaluate(() => window.__app.getState().xp);
    check("存储恢复后再点：先补存进度，再更新并刷新，新版接管，进度没丢", (await ctrlCache(P)) === "suipian-v2" && kept >= 20, "xp=" + kept);
    await ctx.close();
  }
} finally { await browser.close(); await stop().catch(() => {}); rmSync(tmp, { recursive: true, force: true }); }
console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
