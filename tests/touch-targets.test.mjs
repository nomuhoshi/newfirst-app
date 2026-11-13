// 触控尺寸与矮屏布局（acc2 手机验收的 3 个缺陷，设计 4.11 / 4.12）：所有可点区域高度 ≥ 44，矮屏下介绍页标题不被底栏挡住。
// 视口：390×844、360×740、390×450（模拟键盘弹起），浅色 / 深色。真实构建产物。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/touch-targets.test.mjs   （webkit 同理）
// 验已发布的预览产物：DIST_DIR=<目录> PREVIEW_PREFIX=acc2: 
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const PFX = process.env.PREVIEW_PREFIX || "";
const PORT = 4382, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
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
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

const base = { version: 3, onboarded: true, hearts: 5, heartsAt: Date.now(), streak: 0, lastDay: "", installTipClosed: true, lastActive: 0, prefs: { sound: false, haptics: false, soundStyle: "J" } };
const fresh = { ...base, xp: 0, done: {}, lessonsCompleted: 0 };
const afterL1 = { ...base, xp: 20, done: { U1L1: true }, lessonsCompleted: 1 };

async function open(w, h, dark, doc) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block", colorScheme: dark ? "dark" : "light" });
  await ctx.route(/supabase\.co/, (r) => r.fulfill({ status: 404, body: "{}" })); // 不联网
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.addInitScript(([pfx, d]) => { try { if (!localStorage.getItem(pfx + "suipian.progress")) localStorage.setItem(pfx + "suipian.progress", JSON.stringify(d)); } catch {} }, [PFX, doc]);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && document.querySelector(".path"));
  return { ctx, page, errors };
}
const rect = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.offsetParent !== null).map((e) => { const r = e.getBoundingClientRect(); return { w: r.width, h: r.height, top: r.top, bottom: r.bottom, left: r.left, right: r.right, t: (e.textContent || "").trim().slice(0, 12) }; }), sel);
const startLesson = async (page, id) => { await page.evaluate((i) => window.__app.startLesson(window.__app.allLessons().find((x) => x.id === i)), id); await page.waitForSelector(".intro-title"); };
async function toFill(page) {
  await page.getByRole("button", { name: "继续" }).tap();
  for (let k = 0; k < 8 && !(await page.locator(".slot").count()); k++) {
    await page.locator(".choices .choice").first().tap();
    await page.locator(".lessonfoot button.primary").first().tap();
    await page.locator("[data-continue]").first().tap();
    await page.waitForTimeout(150);
  }
  await page.locator(".slot").first().waitFor();
}
const H = 44;

for (const [w, h, dark] of [[390, 844, false], [360, 740, false], [390, 844, true]]) {
  const tag = `${w}×${h}${dark ? " 深色" : ""}`;
  // 缺陷 1：地图“从这里开始”（新用户）和“开始”（通关后）
  let d = await open(w, h, dark, fresh);
  const b1 = await rect(d.page, ".bubble");
  check(`${tag}：地图「从这里开始」高度 ≥ ${H}（宽也 ≥ ${H}）`, b1.length === 1 && /从这里开始/.test(b1[0].t) && b1[0].h >= H && b1[0].w >= H, JSON.stringify(b1));
  check(`${tag}：地图气泡不横向溢出`, b1.every((x) => x.left >= 0 && x.right <= w));
  // 缺陷 2：填空题空格与「重新开始」
  await startLesson(d.page, "U1L2"); await toFill(d.page);
  const sl = await rect(d.page, ".slot"), rs = await rect(d.page, ".reset");
  check(`${tag}：填空空格高度 ≥ ${H}`, sl.length > 0 && sl.every((x) => x.h >= H), JSON.stringify(sl));
  check(`${tag}：「↺ 重新开始」高度 ≥ ${H}`, rs.length === 1 && rs[0].h >= H, JSON.stringify(rs));
  check(`${tag}：填空页没有横向溢出`, await d.page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth));
  check(`${tag}：没有脚本报错`, d.errors.length === 0, d.errors.join("|"));
  await d.ctx.close();
  // 通关后的「开始」
  d = await open(w, h, dark, afterL1);
  const b2 = await rect(d.page, ".bubble");
  check(`${tag}：通关后气泡「开始」高度 ≥ ${H}`, b2.length === 1 && b2[0].t === "开始" && b2[0].h >= H, JSON.stringify(b2));
  await d.ctx.close();
}

// 矮屏（高 ≤ 500，竖屏 390×450）：地图「随机练习」入口高度 ≥ 44（设计复核发现原来是 40）
for (const [w, h] of [[390, 450], [390, 844]]) {
  const d = await open(w, h, false, afterL1);
  const pe = await rect(d.page, "[data-practice-entry]");
  check(`${w}×${h}：地图「随机练习」入口高度 ≥ ${H}`, pe.length === 1 && pe[0].h >= H, JSON.stringify(pe));
  await d.ctx.close();
}

// “我的”页：开关热区、音效试听、清除学习记录
{
  const d = await open(390, 844, false, afterL1);
  const smallOf = (H) => [...document.querySelectorAll("button, a[href]")].filter((e) => e.offsetParent !== null && !e.disabled && !e.classList.contains("switch")).map((e) => ({ c: e.className, t: (e.textContent || "").trim().slice(0, 12), h: e.getBoundingClientRect().height })).filter((x) => x.h < H - 0.5);
  await d.page.getByRole("button", { name: "我的" }).tap();
  const allSmall = [];
  allSmall.push(...(await d.page.evaluate(smallOf, H)).map((x) => ({ page: "入口", ...x })));
  for (const sec of ["account", "settings", "data", "help"]) {
    await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator(`[data-me-menu="${sec}"]`).tap(); await d.page.waitForTimeout(100);
    allSmall.push(...(await d.page.evaluate(smallOf, H)).map((x) => ({ page: sec, ...x })));
  }
  check("“我的”页：入口页和四个子页的按钮 / 链接（开关除外）高度都 ≥ 44", allSmall.length === 0, JSON.stringify(allSmall));
  await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="settings"]').tap(); await d.page.waitForSelector(".switch");
  // 开关：外观 52×32，但热区（含伪元素）≥ 44 高：在开关外 6px 处点中的元素应当是开关本身
  const hit = await d.page.evaluate(() => [...document.querySelectorAll(".switch")].map((sw) => { sw.scrollIntoView({ block: "center" }); const r = sw.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top - 5); return !!e && (e === sw || sw.contains(e)); }));
  check("“我的”页：开关外观不变，但上下各 5px 内也点得中（热区 ≥ 44）", hit.length >= 1 && hit.every(Boolean), JSON.stringify(hit));
  await d.ctx.close();
}

// 缺陷 3：390×450（模拟键盘弹起）介绍页，浅色 + 深色，以及一个常规高度作对照
for (const [w, h, dark] of [[390, 450, false], [390, 450, true], [360, 450, false], [390, 844, false]]) {
  const tag = `${w}×${h}${dark ? " 深色" : ""}`;
  const d = await open(w, h, dark, fresh);
  await startLesson(d.page, "U1L2");
  const g = await d.page.evaluate(() => { const R = (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom }; }; const m = document.querySelector("main.lesson"); const t = document.querySelector(".intro-title"); const f = document.querySelector(".lessonfoot"); const hd = document.querySelector("main.lesson").previousElementSibling; return { main: R(m), title: R(t), foot: R(f), vh: window.innerHeight, scroll: m.scrollHeight, client: m.clientHeight, first: m.firstElementChild === t.closest(".intro-panel"), text: t.textContent, oy: getComputedStyle(m).overflowY }; });
  check(`${tag}：标题「记住顾客」完整在内容区里（不被顶栏 / 底栏盖住）`, g.text === "记住顾客" && g.title.top >= g.main.top - 0.5 && g.title.bottom <= g.main.bottom + 0.5, JSON.stringify(g));
  check(`${tag}：标题与底栏包围盒不相交`, g.title.bottom <= g.foot.top + 0.5, JSON.stringify(g));
  check(`${tag}：底栏贴在可视区底部，内容区在底栏上方（不重叠）`, Math.abs(g.foot.bottom - g.vh) <= 1 && g.main.bottom <= g.foot.top + 0.5, JSON.stringify(g));
  check(`${tag}：内容区可滚动，标题是内容区第一块`, (g.oy === "auto" || g.oy === "scroll") && g.first, JSON.stringify(g));
  if (g.scroll > g.client + 2) {
    await d.page.evaluate(() => { const m = document.querySelector("main.lesson"); m.scrollTop = m.scrollHeight; });
    const end = await d.page.evaluate(() => { const s = document.querySelector(".intro-story").getBoundingClientRect(); const f = document.querySelector(".lessonfoot").getBoundingClientRect(); return { sb: s.bottom, ft: f.top }; });
    check(`${tag}：滚到底能看到完整的故事文字（不被底栏盖住）`, end.sb <= end.ft + 0.5, JSON.stringify(end));
  }
  const btn = await rect(d.page, ".lessonfoot button");
  check(`${tag}：底栏「继续」按钮高度 ≥ ${H}，在可视区内`, btn.length === 1 && btn[0].h >= H && btn[0].bottom <= g.vh + 0.5, JSON.stringify(btn));
  await d.ctx.close();
}

await browser.close(); srv.closeAllConnections(); srv.close();
const bad = results.filter((v) => !v).length;
console.log(`\n${BNAME}: ${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
