// 诊断（不进 main）：测正式构建里 Python（Pyodide）什么时候开始请求、请求了什么、有多大——用于 H 的前后对比。
// 口径（产品官 04:57 要求）：请求发起时间用 request 事件；字节数和完成时间用 requestfinished（未完成的请求标明“未完成”，不计入完成字节）。
// 场景 A：带存档（已看过介绍、U1 完成）打开 → 必须断言已到地图（.statsbar），再停 6 秒。
// 场景 B：接着进入第一个关卡并在第一题点“检查” → 记录 Python 请求从何时开始、“运行结果”多久出现真实结果。
// 服务器不压缩；压缩后的传输量只能当 gzip/brotli 估计，不是线上实测。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { chromium } from "playwright";

const DIST = resolve(process.argv[2] || "dist"), LABEL = process.argv[3] || "";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".zip": "application/zip", ".webmanifest": "application/manifest+json" };
const srv = createServer((req, resp) => {
  const u = new URL(req.url, "http://x"); let p = join(DIST, decodeURIComponent(u.pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { resp.writeHead(404); resp.end("nf"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); resp.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}/`;
const kb = (n) => (n / 1024).toFixed(1) + " KB";
const log = (...a) => console.log(...a);
log(`########## ${LABEL} ##########`);
const walk = (d, o = []) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); f.isDirectory() ? walk(p, o) : o.push(p); } return o; };
let pyRaw = 0, pyGz = 0, pyBr = 0;
for (const p of walk(DIST)) { if (!p.slice(DIST.length + 1).startsWith("pyodide/")) continue; const b = readFileSync(p); pyRaw += b.length; pyGz += gzipSync(b).length; pyBr += brotliCompressSync(b).length; }
log(`Pyodide 文件合计 原始 ${kb(pyRaw)} / gzip≈${kb(pyGz)} / brotli≈${kb(pyBr)}（估计）`);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
const page = await ctx.newPage();
const reqs = new Map(); let t0 = Date.now();
const isPy = (u) => /\/pyodide\/|py-worker/.test(u);
page.on("request", (r) => reqs.set(r, { url: new URL(r.url()).pathname, start: Date.now() - t0, end: null, bytes: null }));
page.on("requestfinished", async (r) => { const e = reqs.get(r); if (!e) return; e.end = Date.now() - t0; try { e.bytes = (await (await r.response()).body()).length; } catch { e.bytes = null; } });
page.on("requestfailed", (r) => { const e = reqs.get(r); if (e) { e.end = Date.now() - t0; e.failed = true; } });
const report = (title, fromT = -1) => {
  const py = [...reqs.values()].filter((e) => isPy(e.url) && e.start > fromT);
  log(`\n-- ${title}`);
  log(`   Python 请求 ${py.length} 个；已完成 ${py.filter((e) => e.end !== null).length} 个，字节合计 ${kb(py.reduce((s, e) => s + (e.bytes || 0), 0))}`);
  for (const e of py) log(`   发起 +${String(e.start).padStart(5)}ms  ${e.end === null ? "未完成" : "完成 +" + e.end + "ms"}  ${e.bytes === null ? "—" : kb(e.bytes).padStart(10)}  ${e.url}`);
  if (!py.length) log("   （没有 Python 请求）");
};

// 先在同源页面里放好存档（已看过介绍、U1 全部完成），再冷启动
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => window.__app?.getState, null, { timeout: 15000 });
await page.evaluate(() => { const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, done: Object.fromEntries(["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"].map((k) => [k, true])), prefs: { ...s.prefs, sound: false } }); Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", JSON.stringify(s)); });
await page.goto("about:blank"); reqs.clear(); t0 = Date.now();
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".statsbar", { timeout: 20000 }); // 断言：已经到地图
log(`\n场景 A：带存档打开，已到地图（.statsbar 出现于 +${Date.now() - t0}ms）`);
await page.waitForTimeout(6000);
report("A：到地图后再停 6 秒，累计的 Python 请求");
const aState = await page.evaluate(() => window.__app.runner.state);
log(`   此时 runner.state = ${aState}`);

// 场景 B：进关卡、答第一题、点“检查”
await page.getByRole("button", { name: "学习", exact: true }).tap().catch(() => {});
await page.locator('[data-lesson="U2L1"]').tap();
await page.locator(".overlay .btn3d.primary").tap();
await page.getByRole("button", { name: "继续", exact: true }).tap();
await page.waitForFunction(() => window.__app.currentEx, null, { timeout: 10000 });
const e = await page.evaluate(() => window.__app.currentEx);
await page.locator(".choice").nth(e.options.findIndex((o) => !!o.correct)).tap();
const tCheck = Date.now() - t0; const before = [...reqs.values()].filter((x) => isPy(x.url)).length;
await page.locator("[data-check]").tap();
await page.waitForFunction((t) => document.querySelector(".outpanel pre")?.textContent.trim() === t, e.options.find((o) => o.correct).text, { timeout: 60000 });
const tDone = Date.now() - t0;
log(`\n场景 B：进入第一题并点“检查”`);
log(`   点“检查”前已有 Python 请求 ${before} 个；点“检查”在 +${tCheck}ms，真实运行结果出现在 +${tDone}ms（用时 ${tDone - tCheck}ms，本机无限速、服务器不压缩，不代表手机网速）`);
report("B：点“检查”之后新发起的 Python 请求", tCheck - 1);
await browser.close(); srv.close();
