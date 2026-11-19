// iPhone Safari（带地址栏、非主屏幕 App）里的代码题版面：底栏 + 内置键盘不能把题面 / 编辑器挤没，检查的状态和结果必须看得见。
// 起因：P3 真机测试里点「检查」后只看到「检查」按钮和键盘，编辑器、“Python 加载中”和判题结果都在屏幕外，看上去像卡在“检查中”。
// 原因（本机复现）：html.ios-browser 给底栏留 80px、给键盘又留 76px 的底部安全空隙，加起来把 .lesson 挤到 28px（iPhone SE 内容区）。
// 真实构建产物 dist + 真实 Pyodide + 真实 CodeMirror；Chromium 手机模拟 / WebKit。不能代替 iPhone 真机。
// 运行：npm run build && node tests/code-task-ios-layout.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const engine = ENGINE === "webkit" ? webkit : chromium;
const PORT = 4351 + (ENGINE === "webkit" ? 10 : 0);
const NEED_PY = process.env.SKIP_PYODIDE !== "1"; // 本机没有 Pyodide 时可以设 SKIP_PYODIDE=1，只跑版面部分（CI 不设）
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".webmanifest": "application/manifest+json", ".zip": "application/zip" };
let pass = 0, fail = 0;
const check = (name, ok, detail = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok || !detail ? "" : "  — " + detail}`); };

// 真实的 U3L5 改代码题（P3 真机卡住的那道）
const TASK = JSON.parse(readFileSync(join(ROOT, "content/unit3.json"), "utf8")).lessons.find((l) => l.id === "U3L5").pending[0].task;
const LESSON = { id: "IOSLAYOUT", title: "版面测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: [TASK] };

const srv = createServer((req, resp) => {
  const url = new URL(req.url, "http://x/");
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((r) => srv.listen(PORT, r));
let browser;
try { browser = await engine.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, userAgent: UA, hasTouch: true, isMobile: ENGINE === "chromium", serviceWorkers: "block" });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await page.evaluate((l) => window.__app.startLesson(l), LESSON);
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForSelector("[data-code-task]");
  return { ctx, page, errors };
}
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, w: r.width }; }, sel);
const footPad = (page) => page.evaluate(() => parseFloat(getComputedStyle(document.querySelector(".lessonfoot")).paddingBottom));

try {
  for (const [name, w, h, minLesson] of [["iPhone Safari 内容区 390×664", 390, 664, 190], ["iPhone SE Safari 内容区 375×553", 375, 553, 85]]) {
    const { ctx, page, errors } = await open({ width: w, height: h });
    check(`${name}：识别为 iPhone Safari（html.ios-browser）`, await page.evaluate(() => document.documentElement.classList.contains("ios-browser")));
    check(`${name}：内置键盘显示着`, await page.evaluate(() => { const k = document.querySelector("#keyboard"); return !!k && !k.hidden && k.getBoundingClientRect().height > 100; }));
    const pad = await footPad(page);
    check(`${name}：键盘显示时，底栏不再重复留 80px 底部空隙（实际 ${pad}px，应 ≤ 20）`, pad <= 20, String(pad));
    const L = await box(page, "main.lesson");
    check(`${name}：题面 / 编辑器所在区域高度 ≥ ${minLesson}px（实际 ${Math.round(L.h)}px；修复前 iPhone SE 只有 28px）`, L.h >= minLesson, String(L.h));
    // 能把编辑器滚到可视区里，并且完整露出来
    await page.evaluate(() => { const sc = document.querySelector("main.lesson"), ed = document.querySelector(".ct-editor"); sc.scrollTop += ed.getBoundingClientRect().bottom - sc.getBoundingClientRect().bottom + 12; });
    const L2 = await box(page, "main.lesson"), E = await box(page, ".ct-editor");
    check(`${name}：滚一下就能看到编辑器的上半部分（至少 60px）`, E.bottom <= L2.bottom + 1 && Math.min(E.bottom, L2.bottom) - Math.max(E.top, L2.top) >= 60, JSON.stringify({ L2, E }));
    const C = await box(page, "[data-check]");
    check(`${name}：「检查」按钮完整在屏幕里，没被键盘盖住`, C.top >= 0 && C.bottom <= h && C.bottom <= (await box(page, "#keyboard")).top + 1, JSON.stringify(C));
    // 收起键盘后，底栏是页面最底下的一块，要把 iPhone Safari 的底部安全空隙还给它
    await page.locator("[data-toggle-kb]").tap();
    const pad2 = await footPad(page);
    check(`${name}：收起键盘后，底栏恢复 iPhone Safari 的底部安全空隙（实际 ${pad2}px，应 ≥ 76）`, pad2 >= 76, String(pad2));
    await page.locator("[data-toggle-kb]").tap();
    check(`${name}：再展开键盘，底栏又变回紧凑`, (await footPad(page)) <= 20);
    check(`${name}：无脚本错误`, errors.length === 0, errors.join("|"));
    await ctx.close();
  }

  // ===== Python 还没加载好时点「检查」：要明说在等 Python，并且这条提示滚进可视区；加载好后自动继续判题 =====
  if (NEED_PY) {
    const { ctx, page, errors } = await open({ width: 375, height: 553 });
    await page.waitForFunction(() => window.__app.runner.state === "ready", null, { timeout: 120000 });
    await page.evaluate(() => { window.__app.runner.state = "loading"; }); // 假装还在加载（真实线程其实已就绪）
    const before = await page.evaluate(() => ({ h: window.__app.getState().hearts, xp: window.__app.getState().xp }));
    // 改代码题一开始「检查」是灰的，改动一下代码才可点：这里只加一行注释，程序仍然是错的（else 后面有条件）
    await page.evaluate((c) => window.__app.currentArea.setCode(c), TASK.code + "# 动过\n");
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => /Python 加载中/.test(document.querySelector("[data-results]").innerText));
    const vis = await page.evaluate(() => { const sc = document.querySelector("main.lesson").getBoundingClientRect(), r = document.querySelector("[data-results]").getBoundingClientRect(); return { top: r.top - sc.top, scBottom: sc.bottom - sc.top, rTop: r.top, rBottom: r.bottom, scTop: sc.top, scB: sc.bottom }; });
    check("等 Python 时：提示的顶部在可视区里（用户看得到“Python 加载中…”）", vis.rTop >= vis.scTop - 1 && vis.rTop < vis.scB - 24, JSON.stringify(vis));
    check("等 Python 时：「检查」按钮显示“检查中…”且不可重复点", await page.evaluate(() => { const b = document.querySelector("[data-check]"); return b.textContent === "检查中…" && b.disabled; }));
    await page.evaluate(() => { window.__app.runner.state = "ready"; });
    await page.waitForSelector(".feedbar", { timeout: 60000 });
    const after = await page.evaluate(() => ({ h: window.__app.getState().hearts, xp: window.__app.getState().xp }));
    check("Python 就绪后自动判题：原代码是错的 → 扣 1 颗红心，不加 XP", after.h === before.h - 1 && after.xp === before.xp, JSON.stringify({ before, after }));
    const K = await page.evaluate(() => { const b = document.querySelector("[data-continue]"), r = b.getBoundingClientRect(), el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { top: r.top, bottom: r.bottom, vh: innerHeight, hit: !!el && (el === b || b.contains(el)) }; });
    check("判完后「继续」按钮在屏幕里，点得到（没被别的东西盖住）", K.top >= 0 && K.bottom <= K.vh && K.hit, JSON.stringify(K));
    check("无脚本错误", errors.length === 0, errors.join("|"));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
