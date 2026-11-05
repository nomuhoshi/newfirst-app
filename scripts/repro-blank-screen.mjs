// 复现“主脚本下载成功（HTTP 200），但页面仍白屏”：
//   用本地服务器托管构建产物，把 assets/main-*.js 的响应替换成：
//     1 语法错误（HTTP 200，内容不是合法 JS）
//     2 启动时异常（HTTP 200，真实主程序前面加一句 throw，模块一执行就报错）
//     3 启动时异常（HTTP 200，真实主程序，但初始化完成后异步抛出未捕获的 Promise 拒绝；页面已渲染）
//   对每一种，记录：应用页（index.html）有没有提示、提示写了什么、控制台报什么错；
//   再在同样的条件下打开诊断页（access-test.html）点“开始测试”，记录它怎么报告。
// 用法：npm run build && node scripts/repro-blank-screen.mjs [dist目录] [截图目录]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(process.argv[2] || "dist"); const SHOTS = process.argv[3] ? resolve(process.argv[3]) : null; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip" };
const srv = createServer((q, r) => {
  const u = new URL(q.url, "http://x"); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); r.end("not found"); return; }
  r.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); r.end(readFileSync(p));
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
const mainFile = readdirSync(join(DIST, "assets")).find((f) => /^main-.*\.js$/.test(f)); const realMain = readFileSync(join(DIST, "assets", mainFile), "utf8");
const MAIN_JS = (url) => /\/assets\/main-[^/]+\.js$/.test(url.pathname);
const CASES = [
  ["0 对照：不动手脚", null],
  ["1 语法错误（200）", "const = ;"],
  ["2 启动时异常（200，模块开头 throw）", `throw new Error("模拟：启动时异常");\n` + realMain],
  ["3 启动后异步异常（200，页面已渲染，之后出现未处理的 Promise 拒绝）", realMain + `\nsetTimeout(() => { Promise.reject(new Error("模拟：启动后异步异常")); }, 1500);`],
];
const browser = await chromium.launch(); const out = [];
for (const [name, body] of CASES) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  if (body !== null) await ctx.route(MAIN_JS, (r) => r.fulfill({ status: 200, contentType: "text/javascript; charset=utf-8", body }));
  const res = { name, app: {}, diag: {} };
  // ---- 应用页 ----
  { const page = await ctx.newPage(); const cons = [], perr = []; const t0 = Date.now();
    page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") cons.push(m.type() + ": " + m.text().split("\n")[0].slice(0, 160)); });
    page.on("pageerror", (e) => perr.push(String(e.message).split("\n")[0].slice(0, 160)));
    await page.goto(BASE + "index.html", { waitUntil: "domcontentloaded" });
    const shown = await page.waitForSelector("#load-fallback", { timeout: 12000 }).then(() => Date.now() - t0, () => null);
    await page.waitForTimeout(shown === null ? 3500 : 300);
    res.app = { 兜底提示出现毫秒: shown, 兜底提示文字: shown === null ? null : (await page.locator("#load-fallback").innerText()).replace(/\n+/g, " / ").slice(0, 400), app内容: ((await page.locator("#app").innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 80) || "(空：白屏)", 控制台: cons, pageerror: perr };
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `app-${name.split(" ")[0]}.png`) });
    await page.close(); }
  // ---- 诊断页 ----
  { const page = await ctx.newPage(); await page.goto(BASE + "access-test.html", { waitUntil: "domcontentloaded" });
    await page.locator("#go").tap(); await page.waitForFunction(() => !document.querySelector("#done").hidden, null, { timeout: 120000 });
    const rows = await page.locator("#out .row").allInnerTexts();
    res.diag = { 结论: (await page.locator("#verdict").innerText()).replace(/\n+/g, " "), 主程序行: rows.find((x) => /主程序/.test(x)), "失败行数": rows.filter((x) => x.startsWith("❌")).length };
    if (SHOTS) await page.screenshot({ path: join(SHOTS, `diag-${name.split(" ")[0]}.png`), fullPage: true });
    await page.close(); }
  out.push(res); await ctx.close();
}
await browser.close(); srv.closeAllConnections(); srv.close();
for (const r of out) { console.log("\n=== " + r.name + " ==="); console.log("应用页：" + JSON.stringify(r.app, null, 1)); console.log("诊断页：" + JSON.stringify(r.diag, null, 1)); }
