// WebKit（Safari 内核）手机模拟测试。是 Playwright WebKit 的视口 / 触屏模拟，不等于旧版 iOS 真机、微信内置浏览器或 iPad 真机；
// 不测试 VoiceOver。运行：npm run build && npm run test:webkit
// 只覆盖四件事：①普通关、复习关、开场介绍的主按钮可达且真实点击成功；②随机练习入口与当前关互不遮挡；
// ③弹窗焦点进入、循环、关闭后返回；④Python Worker 故障后仍能继续学习。
// 所有组都必须运行，不再按源码标记跳过：依赖的功能（#7/#12/#13/#14）不在当前分支 → 该组直接失败。
// 依赖还没合并时，请在集成分支 test/webkit-integration 上看完整结果。
// 同一套测试跑 WebKit 和 Chromium 两个内核：MOBILE_BROWSER=webkit|chromium（默认 webkit）。
// 浏览器无法启动 / 没装 → 打印“环境失败”并以退出码 2 结束（不是跳过、不是通过）；功能缺失是测试失败（退出码 1）。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(ROOT, "dist");
const PORT = 4361, BASE = `http://localhost:${PORT}/`;
const src = (f) => readFileSync(join(ROOT, "src", f), "utf8");
const APP = src("app.js"), CSS = src("game.css");
// 功能标记：只用来在失败时说明缺了哪个依赖 PR，不再用来跳过
const HAS = {
  landscape: [/\.finish,\s*\.onboard\s*\{[^}]*overflow-y:\s*auto/.test(CSS), "#13 横屏修复"],
  practice: [/practice-entry-wrap/.test(APP), "#12 随机练习"],
  sheetFocus: [/function focusables/.test(APP), "#14 弹窗焦点"],
  workerTimeout: [/pythonUnavailableText/.test(APP), "#7 Worker 超时处理"],
};
const ENGINE = process.env.MOBILE_BROWSER || "webkit";
if (!["webkit", "chromium"].includes(ENGINE)) { console.log(`环境失败：未知 MOBILE_BROWSER=${ENGINE}`); process.exit(2); }
const NAME = ENGINE === "webkit" ? "WebKit" : "Chromium";
let playwright;
try { playwright = await import("playwright"); } catch (e) { console.log(`环境失败：无法加载 playwright（${e.message}）`); process.exit(2); }
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const { devices } = playwright;
let browser;
try { browser = await playwright[ENGINE].launch(); }
catch (e) { console.log(`环境失败：${NAME} 无法启动（${String(e.message).split("\n")[0]}）。请运行 npx playwright install --with-deps ${ENGINE}`); if (process.env.GITHUB_ACTIONS) console.log(`::error title=环境失败::${NAME} 无法启动`); process.exit(2); }

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".wav": "audio/wav" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, status: ok ? "PASS" : "FAIL" }); console.log(`${ok ? "✅" : "❌"} [${group}] ${name}${detail ? "  — " + detail : ""}`); };
const need = (group, key) => { const [ok, pr] = HAS[key]; if (!ok) check(group, `依赖功能存在（${pr}）`, false, `当前分支缺少 ${pr}，本组按失败计（完整结果见集成分支 test/webkit-integration）`); };

const NOW = Date.UTC(2026, 10, 3, 3, 0, 0);
const L = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1", "U2L2", "U2L3", "U2L4", "U2L5"];
const state = (done = [], over = {}) => ({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" }, ...over });
const STANDALONE = () => { Object.defineProperty(navigator, "standalone", { get: () => true }); const mm = window.matchMedia.bind(window);
  window.matchMedia = (q) => /display-mode:\s*standalone/.test(q) ? { matches: true, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : mm(q); };

const OPEN = [];
// 每个场景单独兜底：脚本异常记为失败，关掉页面，继续下一个场景
async function guard(G, fn) {
  try { await fn(); } catch (e) { check(G, "场景异常（记为失败）", false, String(e.message).split("\n")[0]); }
  finally { for (const c of OPEN.splice(0)) await c.close().catch(() => {}); }
}
async function open({ device, viewport, st, standalone = false, init = null, clock = false }) {
  const ctx = await browser.newContext({ ...devices[device], ...(viewport ? { viewport } : {}), serviceWorkers: "block" });
  OPEN.push(ctx); ctx.setDefaultTimeout(8000);
  if (standalone) await ctx.addInitScript(STANDALONE);
  await ctx.addInitScript(([v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("suipian.progress", v); sessionStorage.setItem("seeded", "1"); } }, [JSON.stringify(st)]);
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  if (clock) await page.clock.install({ time: NOW });
  await page.goto(BASE); await page.waitForSelector(st.onboarded ? ".pathview" : ".onboard");
  return { ctx, page, errors };
}
// 按钮必须用户能拿到：已在视口内，或者某个用户能滑动的祖先（overflow auto/scroll 且内容超出）滑动后露出。
// 不用 scrollIntoView：它能滚动 overflow:hidden 的容器，用户却滑不动，会掩盖“按钮被挤出屏幕”的问题。
// 露出后检查完整在视口内、中心点最上层是它自己，再用 Playwright 真实点击（会再次检查命中）。
async function reachAndClick(page, loc) {
  await loc.waitFor();
  const v = await loc.evaluate((b) => {
    const st = () => { const r = b.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { ok: r.top >= -0.5 && r.bottom <= window.innerHeight + 0.5 && !!t && (t === b || b.contains(t)), rect: `top=${Math.round(r.top)} bottom=${Math.round(r.bottom)} vh=${window.innerHeight}` }; };
    let a = st(); if (a.ok) return a;
    for (let e = b.parentElement; e; e = e.parentElement) {
      const cs = getComputedStyle(e), scroller = e === document.scrollingElement || e === document.body;
      const can = scroller ? cs.overflowY !== "hidden" && document.documentElement.scrollHeight > window.innerHeight + 1 : /(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1;
      if (!can) continue;
      const box = scroller ? { top: 0, bottom: window.innerHeight } : e.getBoundingClientRect(), r = b.getBoundingClientRect();
      (scroller ? document.scrollingElement : e).scrollTop += r.bottom > box.bottom ? r.bottom - box.bottom + 4 : r.top - box.top - 4;
      a = st(); if (a.ok) return a;
    }
    return { ok: false, rect: a.rect + "（没有用户可滑动的容器能露出它）" };
  });
  if (!v.ok) return v;
  try { await loc.click({ timeout: 4000 }); return v; } catch (e) { return { ok: false, rect: String(e.message).split("\n")[0] }; }
}
async function answerCorrect(page) {
  const ex = await page.evaluate(() => window.__app.currentEx);
  if (ex.type === "predict") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct)).click();
  else if (ex.type === "fill") for (let k = 0; k < ex.answer.length; k++) { await page.locator(`[data-slot="${k}"]`).click(); await page.locator(`[data-token=${JSON.stringify(ex.answer[k])}]`).first().click(); }
  else for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).first().click();
}
async function playToFinish(page) {
  const intro = page.getByRole("button", { name: "继续", exact: true });
  if (!(await reachAndClick(page, intro)).ok) return { ok: false, rect: "开场“继续”不可达" };
  for (let n = 0; n < 12 && await page.locator("[data-check]").count(); n++) {
    await answerCorrect(page);
    let v = await reachAndClick(page, page.locator("[data-check]")); if (!v.ok) return { ok: false, rect: `第${n + 1}题“检查” ${v.rect}` };
    v = await reachAndClick(page, page.locator("[data-continue]:not([disabled])")); if (!v.ok) return { ok: false, rect: `第${n + 1}题“继续” ${v.rect}` };
    await page.waitForSelector("[data-check], .finish");
  }
  await page.waitForSelector(".finish");
  return reachAndClick(page, page.locator(".finish [data-continue]"));
}

const PROFILES = [
  { tag: "Safari 竖屏 iPhone 15", device: "iPhone 15", landscape: false },
  { tag: "Safari 横屏 iPhone 15", device: "iPhone 15 landscape", landscape: true },
  { tag: "主屏幕 横屏 852x393", device: "iPhone 15 landscape", viewport: { width: 852, height: 393 }, standalone: true, landscape: true },
  { tag: "Safari 横屏 iPhone SE", device: "iPhone SE landscape", landscape: true },
];
try {
  // ① 主按钮
  for (const p of PROFILES) {
    const G = "主按钮 " + p.tag;
    if (p.landscape) need(G, "landscape");
    await guard(G, async () => {
    const { ctx, page, errors } = await open({ ...p, st: state([], { onboarded: false }) });
    let ok = true, why = "";
    for (let i = 0; i < 3 && ok; i++) { const v = await reachAndClick(page, page.locator(".onboard .btn3d")); ok = v.ok; why = `第${i + 1}屏 ${v.rect}`; }
    check(G, "开场介绍 3 屏按钮可达并真实点击", ok && await page.waitForSelector(".pathview", { timeout: 4000 }).then(() => true, () => false), ok ? "" : why);
    await page.locator('[data-lesson="U1L1"]').click(); await page.locator(".overlay .btn3d.primary").click();
    let v = await playToFinish(page); check(G, "普通关：每题“检查”“继续”和结算页“继续”可达并真实点击", v.ok && await page.waitForSelector(".pathview", { timeout: 4000 }).then(() => true, () => false), v.rect);
    await page.locator('[data-lesson="U1L1"]').click(); await page.locator(".overlay .btn3d.primary").click();
    v = await playToFinish(page); check(G, "复习关：结算页“继续”可达并真实点击，回到地图", v.ok && await page.waitForSelector(".pathview", { timeout: 4000 }).then(() => true, () => false), v.rect);
    check(G, "无脚本错误", errors.length === 0, errors.join(" | "));
    });
  }
  // ② 随机练习入口与当前关
  need("练习入口/当前关", "practice");
  for (const vp of [{ width: 734, height: 343 }, { width: 667, height: 375 }, { width: 568, height: 320 }, { width: 393, height: 659 }]) for (const n of [1, 8]) {
    const G = `练习入口/当前关 ${vp.width}x${vp.height}`;
    await guard(G, async () => {
    const { ctx, page } = await open({ device: "iPhone 15", viewport: vp, st: state(L.slice(0, n)) });
    await page.waitForSelector(".node.current"); await page.waitForTimeout(400);
    const bad = await page.evaluate(() => { if (!document.querySelector(".practice-entry-wrap")) return ["没有随机练习入口"]; const view = document.querySelector(".pathview"), node = view.querySelector(".node.current"), ent = view.querySelector(".practice-entry-wrap").getBoundingClientRect();
      const hit = (e) => { const r = e.getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t === e || e.contains(t); };
      const out = []; for (const [k, e] of [["气泡", node.parentElement.querySelector(".bubble")], ["节点", node], ["关名", node.parentElement.querySelector(".node-label")]]) { if (!e) continue; const r = e.getBoundingClientRect(); if (r.top < ent.bottom - 0.5) out.push(`${k}被入口挡住`); if (!hit(e)) out.push(`${k}中心被盖住`); }
      if (!hit(view.querySelector("[data-practice-entry]"))) out.push("入口被盖住"); return out; });
    check(G, `通关 ${n} 关：入口与当前关（气泡/节点/关名）互不遮挡`, bad.length === 0, bad.join("；"));
    // #12 + #14 组合：真实点击，不看高度
    let v = await reachAndClick(page, page.locator("[data-practice-entry]"));
    const setupOpen = v.ok && await page.waitForSelector("[data-practice-start]", { timeout: 3000 }).then(() => true, () => false);
    check(G, `通关 ${n} 关：真实点击随机练习入口打开设置`, setupOpen, v.rect);
    if (setupOpen) {
      // 随机练习设置（#12）是整页，不是弹层：确认没有遮罩，并且底部“学习”标签真实点击后回到地图
      check(G, `通关 ${n} 关：练习设置是整页（没有弹层遮罩）`, await page.evaluate(() => !document.querySelector(".overlay")));
      const back = await reachAndClick(page, page.getByRole("button", { name: "学习", exact: true }));
      check(G, `通关 ${n} 关：真实点击底部“学习”标签回到地图`, back.ok && await page.waitForSelector(".pathview .node.current", { timeout: 3000 }).then(() => true, () => false), back.rect);
    }
    for (const [k, sel] of [["气泡", ".node.current ~ .bubble, .bubble"], ["节点", ".node.current"]]) {
      if (k === "气泡" && !(await page.locator(".bubble").count())) continue;
      v = await reachAndClick(page, page.locator(sel).first());
      const opened = v.ok && await page.waitForSelector(".overlay .btn3d.primary", { timeout: 3000 }).then(() => true, () => false);
      check(G, `通关 ${n} 关：真实点击当前关${k}打开弹窗`, opened, v.rect);
      if (!opened) continue;
      if (k === "节点") {
        v = await reachAndClick(page, page.locator(".overlay .btn3d.primary"));
        check(G, `通关 ${n} 关：弹窗主按钮可达并真实点击，进入关卡`, v.ok && await page.waitForSelector("[data-check], .lesson, .card", { timeout: 4000 }).then(() => true, () => false), v.rect);
      } else { await page.keyboard.press("Escape"); await page.waitForSelector(".overlay", { state: "detached", timeout: 3000 }).catch(() => {}); }
    }
    });
  }
  // ③ 弹窗焦点
  need("弹窗焦点", "sheetFocus");
  await guard("弹窗焦点", async () => { const G = "弹窗焦点";
    const { ctx, page, errors } = await open({ device: "iPhone 15", viewport: { width: 820, height: 1180 }, st: state() });
    const inside = () => page.evaluate(() => !!document.querySelector(".overlay")?.contains(document.activeElement));
    await page.locator('[data-lesson="U1L1"]').focus(); await page.keyboard.press("Enter"); await page.waitForSelector(".overlay");
    check(G, "键盘打开后焦点进入弹窗", await inside());
    let ok = true; for (let i = 0; i < 6; i++) { await page.keyboard.press(i % 2 ? "Shift+Tab" : "Tab"); ok = ok && await inside(); }
    check(G, "Tab / Shift+Tab 在弹窗内循环", ok);
    await page.keyboard.press("Escape");
    check(G, "Esc 关闭，焦点回到打开它的关卡按钮", (await page.locator(".overlay").count()) === 0 && await page.evaluate(() => document.activeElement?.dataset?.lesson === "U1L1"));
    check(G, "无脚本错误", errors.length === 0, errors.join(" | ")); });
  // ④ Worker 故障
  need("Worker 故障", "workerTimeout");
  for (const [kind, init] of [["创建失败", () => { window.Worker = function () { throw new Error("Worker blocked"); }; }], ["创建后不响应", () => { window.Worker = function () { this.postMessage = () => {}; this.terminate = () => {}; }; }]]) {
    const G = "Worker " + kind;
    await guard(G, async () => {
    const { ctx, page, errors } = await open({ device: "iPhone 15", st: state(), init, clock: true });
    await page.locator('[data-lesson="U1L1"]').click(); await page.locator(".overlay .btn3d.primary").click();
    await page.getByRole("button", { name: "继续", exact: true }).click();
    await answerCorrect(page); await page.locator("[data-check]").click(); await page.waitForSelector(".feedbar");
    await page.clock.runFor(40000);
    const ended = await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 5000 }).then(() => true, () => false);
    check(G, "等待结束（不再显示“运行中…”）", ended);
    const v = await reachAndClick(page, page.locator("[data-continue]:not([disabled])"));
    check(G, "点“继续”进入下一题", v.ok && (await page.waitForSelector("[data-check]", { timeout: 3000 }).then(() => true, () => false)), v.rect);
    check(G, "无脚本错误", errors.length === 0, errors.join(" | ")); });
  }
} catch (e) {
  check("运行", "测试脚本异常", false, String(e.message).split("\n")[0]);
} finally { await browser.close(); srv.close(); }
const c = (s) => results.filter((r) => r.status === s).length;
console.log(`\n${NAME} 手机模拟：通过 ${c("PASS")}，失败 ${c("FAIL")}`);
process.exit(c("FAIL") ? 1 : 0);
