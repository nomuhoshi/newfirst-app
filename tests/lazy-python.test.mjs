// H：Python（Pyodide，约 13 MB）改为“第一次真正要执行时才加载”。用 dist/ 的真实构建产物，自己起静态服务器并记录每个请求。
//  1. 打开应用（首次、什么都不做）停几秒：没有任何 Python 请求，runner 处于 idle。
//  2. 进“我的”页、地图、打开关卡开场页：仍然没有 Python 请求。
//  3. 答第一题点“检查”：这时才开始请求 Python，并显示真实运行结果（等于正确选项文字）。
//  4. 加载失败 → 提示 + “重试”按钮；恢复后点“重试”能得到真实结果；失败后的重试之外没有多余的自动请求。
// 桌面模拟，不等于 iPhone 真机。运行：npm run build && node tests/lazy-python.test.mjs（MOBILE_BROWSER=chromium|webkit）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pw from "playwright";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const BROWSER = process.env.MOBILE_BROWSER || "chromium";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".zip": "application/zip", ".webmanifest": "application/manifest+json" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

const hits = [];
const srv = createServer((req, resp) => {
  const url = new URL(req.url, "http://x"); hits.push(url.pathname);
  let p = join(DIST, decodeURIComponent(url.pathname)); if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("nf"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); resp.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}/`;
const pyHits = () => hits.filter((h) => /\/pyodide\/|py-worker/.test(h));

const browser = await pw[BROWSER].launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  let abortPy = false;
  await page.route(/\/pyodide\//, (r) => (abortPy ? r.abort() : r.continue()));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".statsbar, .onboard");
  await page.waitForFunction(() => window.__app?.runner, null, { timeout: 15000 });
  await page.waitForTimeout(4000);
  check("1 打开应用并停 4 秒：没有任何 Python 请求（Pyodide / 工作线程脚本）", pyHits().length === 0, pyHits().join(" "));
  check("1b runner 处于 idle，没有创建 Python 线程", (await page.evaluate(() => [window.__app.runner.state, !!window.__app.runner.worker])).join() === "idle,false");

  // 带存档进入地图（跳过开场介绍）
  await page.evaluate(() => { const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, done: Object.fromEntries(["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"].map((k) => [k, true])), prefs: { ...s.prefs, sound: false } }); Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", JSON.stringify(s)); });
  await page.reload(); await page.waitForSelector(".statsbar");
  await page.getByRole("button", { name: "我的" }).tap(); await page.waitForTimeout(500);
  await page.getByRole("button", { name: "学习", exact: true }).tap();
  await page.locator('[data-lesson="U2L1"]').tap();
  await page.waitForTimeout(1500);
  check("2 看地图、“我的”页、打开关卡开场页：仍然没有 Python 请求", pyHits().length === 0, pyHits().join(" "));

  await page.locator(".overlay .btn3d.primary").tap();
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForFunction(() => window.__app.currentEx, null, { timeout: 10000 });
  check("3a 进入第一题、尚未点“检查”：仍然没有 Python 请求", pyHits().length === 0, pyHits().join(" "));
  // 第一题是 predict：点“检查”才会在“运行结果”里真实执行
  const e1 = await page.evaluate(() => window.__app.currentEx);
  abortPy = true; // 先让第一次加载失败，验证提示和重试
  await page.locator(".choice").nth(e1.options.findIndex((o) => !!o.correct)).tap();
  await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar");
  await page.waitForFunction(() => document.querySelector(".outpanel pre")?.textContent && !/运行中/.test(document.querySelector(".outpanel pre").textContent), null, { timeout: 40000 });
  check("3b 点“检查”时才开始请求 Python（这次被拦成失败）", pyHits().length > 0, pyHits().join(" "));
  const failText = await page.locator(".outpanel pre").innerText();
  const correctText = e1.options.find((o) => o.correct).text;
  check("4a 加载失败：如实提示不可用 + “重试”按钮，不用预设输出冒充（选择题照常判分）", (await page.locator("[data-retry-python]").count()) === 1 && !failText.includes(correctText) && /答对了/.test(await page.locator(".feedbar").innerText()), failText);
  const nFail = pyHits().length;
  await page.waitForTimeout(3000);
  check("4b 失败后没有自动反复请求（3 秒内请求数不变）", pyHits().length === nFail, `${nFail} → ${pyHits().length}`);
  abortPy = false;
  await page.locator("[data-retry-python]").tap();
  await page.waitForFunction((t) => document.querySelector(".outpanel pre")?.textContent.trim() === t, correctText, { timeout: 60000 });
  check("4c 点“重试”：加载成功并显示真实运行结果", (await page.locator(".outpanel pre").innerText()).trim() === correctText && (await page.locator("[data-retry-python]").count()) === 0 && pyHits().some((h) => /pyodide\.asm\.wasm$/.test(h)));
  check("4d runner 已就绪", await page.evaluate(() => window.__app.runner.state) === "ready");
  check("5 全程没有脚本错误", errors.length === 0, errors.join(" | "));
  await ctx.close();
} finally { await browser.close(); srv.close(); }
const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
