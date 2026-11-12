// 诊断（不进 main）：测正式构建里 Python（Pyodide）什么时候开始请求、请求了什么、有多大。
// 方法：用 dist/ 起静态服务器（不压缩），用 Chromium 手机视口冷启动，记录每个响应的字节数和相对导航开始的时间；
// 另外对 dist 里的 pyodide 文件算 gzip / brotli 大小（线上是 GitHub Pages，压缩后的传输量只能当估计，不是实测）。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { gzipSync, brotliCompressSync } from "node:zlib";
import { chromium } from "playwright";

const DIST = resolve(process.argv[2] || "dist");
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".zip": "application/zip", ".webmanifest": "application/manifest+json", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const srv = createServer((req, resp) => {
  const u = new URL(req.url, "http://x"); let p = join(DIST, decodeURIComponent(u.pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { resp.writeHead(404); resp.end("nf"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); resp.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}/`;
const kb = (n) => (n / 1024).toFixed(1) + " KB";
const log = (...a) => console.log(...a);

// 1) dist 里的文件大小
log("== dist 文件大小（原始 / gzip / brotli，估计压缩后传输量） ==");
const walk = (d, o = []) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); f.isDirectory() ? walk(p, o) : o.push(p); } return o; };
let pyRaw = 0, pyGz = 0, pyBr = 0, appRaw = 0, appGz = 0;
for (const p of walk(DIST).sort()) {
  const rel = p.slice(DIST.length + 1), b = readFileSync(p), isPy = rel.startsWith("pyodide/");
  const gz = gzipSync(b).length, br = brotliCompressSync(b).length;
  if (isPy) { pyRaw += b.length; pyGz += gz; pyBr += br; log(`  ${rel.padEnd(36)} ${kb(b.length).padStart(12)} ${kb(gz).padStart(12)} ${kb(br).padStart(12)}`); }
  else if (/\.(js|css|html)$/.test(rel) && !rel.startsWith("sfx/")) { appRaw += b.length; appGz += gz; }
}
log(`  pyodide 合计 原始 ${kb(pyRaw)} / gzip ${kb(pyGz)} / brotli ${kb(pyBr)}`);
log(`  应用自身 js+css+html 合计 原始 ${kb(appRaw)} / gzip ${kb(appGz)}`);

// 2) 冷启动请求时间线
const browser = await chromium.launch();
async function scenario(name, { seed, steps, settleMs = 8000 }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const rows = []; const t0 = { v: Date.now() };
  page.on("response", async (r) => { try { const b = await r.body(); rows.push({ t: Date.now() - t0.v, url: new URL(r.url()).pathname, status: r.status(), bytes: b.length }); } catch { rows.push({ t: Date.now() - t0.v, url: new URL(r.url()).pathname, status: r.status(), bytes: -1 }); } });
  if (seed) await ctx.addInitScript(seed);
  t0.v = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(settleMs);
  if (steps) await steps(page, rows, t0);
  log(`\n== 场景：${name} ==`);
  const py = rows.filter((r) => r.url.includes("/pyodide/") || /py-worker/.test(r.url));
  const other = rows.filter((r) => !py.includes(r));
  log(`  非 Python 请求 ${other.length} 个，合计 ${kb(other.reduce((s, r) => s + Math.max(r.bytes, 0), 0))}`);
  log(`  Python 相关请求 ${py.length} 个，合计 ${kb(py.reduce((s, r) => s + Math.max(r.bytes, 0), 0))}：`);
  for (const r of py) log(`    +${String(r.t).padStart(5)}ms  ${r.status}  ${kb(r.bytes).padStart(11)}  ${r.url}`);
  const first = py[0]; log(`  首个 Python 请求出现在打开后 ${first ? first.t + " ms" : "（没有）"}；最后一个在 ${py.length ? py[py.length - 1].t + " ms" : "—"}`);
  await ctx.close();
}
const seedOnboarded = () => { try { /* 不预置存档：测的是真实首次打开 */ } catch {} };
await scenario("首次打开（无存档，什么都不点，停 8 秒）", { seed: seedOnboarded });
await scenario("首次打开 + 点“开始”进入地图（不进任何关卡），再停 8 秒", {
  steps: async (page) => { for (const name of ["开始", "开始学习", "继续", "好的"]) { const b = page.getByRole("button", { name }).first(); if (await b.count()) { await b.tap().catch(() => {}); await page.waitForTimeout(500); } } await page.waitForTimeout(8000); },
});
await browser.close(); srv.close();
