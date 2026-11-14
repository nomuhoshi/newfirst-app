// 游客后台恢复专项（A 补充缺口，不重复 progress-persistence / progress-concurrency 已有用例）：
// 1. [SYNTHETIC_EVENT] 切后台期间内存中存在未落盘增量，派发 visibilitychange(visible) 后刷入本机存储且不重复计分；
// 2. [SYNTHETIC_EVENT] 拦截 storage/visibilitychange/focus/pageshow 模拟 bfcache 冻结期，先证明页面仍持旧状态，再单独放行 pageshow(persisted=true) 恢复合并与清除隔离；
// 3. [REAL_BROWSER_NAVIGATION] 真实导航离开页面后再通过浏览器历史后退（page.goBack）恢复，状态与存储一致；
// 4. [REAL_BROWSER_NAVIGATION] 多标签页通过真实 bringToFront() 切回前台并继续学习，精确校准单课 XP 与 runs 无重复累加；
// 5. [REAL_DEVICE_UNVERIFIED] 明确登记 iPhone 真机 Safari / 主屏幕 App 杀进程恢复未在本 CI 执行。
// 运行：npm run build && MOBILE_BROWSER=chromium|webkit node tests/progress-background-recovery.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/";
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const engine = BNAME === "webkit" ? webkit : chromium;

if (!existsSync(join(DIST, "index.html"))) {
  console.log(`环境失败：${BNAME} 缺少 dist/index.html，请先运行 npm run build`);
  process.exit(2);
}

let pass = 0, fail = 0;
const evidenceLog = [];
const check = (category, name, ok, detail = "") => {
  ok ? pass++ : fail++;
  evidenceLog.push({ category, name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} [${BNAME}] [${category}] ${name}${ok || !detail ? "" : "  — " + detail}`);
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
};

const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (!u.pathname.startsWith(PFX)) { res.writeHead(404); res.end(); return; }
  let p = join(DIST, decodeURIComponent(u.pathname.slice(PFX.length)));
  if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${srv.address().port}${PFX}`;

const dirs = [];
const activeContexts = new Set();
const newDir = () => { const d = mkdtempSync(join(tmpdir(), "suipian-bg-recovery-")); dirs.push(d); return d; };
const OPTS = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === chromium };

async function openCtx(dir) {
  try {
    const ctx = await engine.launchPersistentContext(dir, { ...OPTS, serviceWorkers: "block" });
    ctx.setDefaultTimeout(30000);
    activeContexts.add(ctx);
    return ctx;
  } catch (e) {
    console.log(`环境失败：${BNAME} 启动失败：${String(e.message).split("\n")[0]}`);
    await new Promise((r) => srv.close(r));
    for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
    process.exit(2);
  }
}

async function closeCtx(ctx) {
  if (!ctx) return;
  activeContexts.delete(ctx);
  await ctx.close().catch(() => {});
}

async function openApp(ctx) {
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__app?.getState);
  return page;
}

async function passOnboarding(page) {
  for (let i = 0; i < 6 && (await page.locator(".onboard").count()); i++) {
    await page.locator(".onboard .btn3d.primary").click();
    await page.waitForTimeout(100);
  }
  await page.waitForSelector(".pathview");
}

async function startLesson(page, id) {
  await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-lesson="${id}"]`).click();
  await page.locator(".overlay .btn3d.primary").click();
  await page.locator(".lessonfoot .btn3d.primary").click();
  await page.waitForSelector("[data-check]");
}

async function answer(page, right = true) {
  const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
  if (ex.type === "predict" || ex.type === "pick") {
    await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === right)).click();
  } else if (ex.type === "fill") {
    const toks = right ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a));
    for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
  } else {
    const seq = right ? ex.answers[0] : [...ex.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click();
  }
  await page.locator("[data-check]").click();
  await page.waitForSelector(".feedbar [data-continue]:not([disabled])");
}

async function finishLesson(page, id) {
  await startLesson(page, id);
  for (let n = 0; n < 20 && !(await page.locator(".finish").count()); n++) {
    await answer(page, true);
    await page.locator(".feedbar [data-continue]").click();
    await page.waitForTimeout(150);
  }
  await page.waitForSelector(".finish");
}

const readSnap = (page) => page.evaluate(() => {
  const s = window.__app.getState();
  const xpText = document.querySelector(".statsbar .xp")?.textContent?.trim() || "";
  return {
    xp: s.xp,
    runs: s.lessonsCompleted,
    done: Object.keys(s.done || {}).sort(),
    xpText,
  };
});

try {
  // ---------- 1. [SYNTHETIC_EVENT] 切后台期间未落盘内存增量，恢复可见时落盘且不重复计分 ----------
  {
    const ctx = await openCtx(newDir());
    const p = await openApp(ctx);
    await passOnboarding(p);

    const memBefore = await p.evaluate(() => {
      const real = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (String(k).includes("suipian.v4.tab.")) throw new DOMException("transient full", "QuotaExceededError");
        return real.call(this, k, v);
      };
      const s = window.__app.getState();
      window.__app.addXp(30, "U1L1", true);
      s.done.U1L1 = true;
      window.__app.addRun();
      const savedOk = window.__app.persist();
      Storage.prototype.setItem = real;
      return { savedOk, xp: s.xp, runs: s.lessonsCompleted };
    });
    check("SYNTHETIC_EVENT", "R1 前置：临时写入失败后内存增量保留且 persist 返回 false", memBefore.savedOk === false && memBefore.xp === 30, JSON.stringify(memBefore));

    await p.evaluate(() => {
      Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await p.waitForTimeout(150);

    const fresh = await openApp(ctx);
    const fromDisk = await readSnap(fresh);
    const fromCur = await readSnap(p);
    check("SYNTHETIC_EVENT", "R2 恢复可见后未保存增量已落盘，新开页与当前页 XP/关卡完全一致且无重复累加", fromDisk.xp === 30 && fromDisk.runs === 1 && fromDisk.done.join(",") === "U1L1" && fromCur.xp === 30 && fromCur.xpText === "30", JSON.stringify({ fromDisk, fromCur }));
    await closeCtx(ctx);
  }

  // ---------- 2. [SYNTHETIC_EVENT] 冻结 storage/visibilitychange/focus/pageshow 模拟 bfcache 恢复合并与清除隔离 ----------
  {
    const ctx = await openCtx(newDir());
    const tab1 = await openApp(ctx);
    await passOnboarding(tab1);

    // 捕获阶段拦截所有被动/可见性同步事件（storage / visibilitychange / focus / pageshow），仅放行显式加入 __allowedSyncEvents 的目标事件
    await tab1.evaluate(() => {
      window.__allowedSyncEvents = new Set();
      const guard = (e) => {
        if (!window.__allowedSyncEvents.has(e.type)) {
          e.stopImmediatePropagation();
        }
      };
      window.addEventListener("storage", guard, true);
      document.addEventListener("visibilitychange", guard, true);
      window.addEventListener("focus", guard, true);
      window.addEventListener("pageshow", guard, true);
    });

    const tab2 = await openApp(ctx);
    await tab2.waitForSelector(".pathview");
    await finishLesson(tab2, "U1L1");
    const expected = await readSnap(tab2);
    await tab2.close();
    await tab1.waitForTimeout(150);

    // 必须先证明 pageshow 之前 tab1 确实持有旧状态（排除 storage 与关闭标签引发的 visibilitychange/focus 提前同步）
    const staleBeforeR3 = await readSnap(tab1);
    check("SYNTHETIC_EVENT", "R3 前置：bfcache 冻结期间未触发 storage/visibilitychange/focus 同步，tab1 仍持有旧状态（xp=0）", staleBeforeR3.xp === 0 && staleBeforeR3.runs === 0 && staleBeforeR3.done.length === 0, JSON.stringify(staleBeforeR3));

    // 仅放行 pageshow 并派发 persisted=true（storage/visibilitychange/focus 仍保持冻结）
    await tab1.evaluate(() => {
      window.__allowedSyncEvents.add("pageshow");
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
    });
    await tab1.waitForTimeout(200);
    const afterBfcache = await readSnap(tab1);
    const u1DoneRendered = await tab1.locator('[data-lesson="U1L1"].done').count();
    check("SYNTHETIC_EVENT", "R3 单独放行 pageshow(persisted=true) 恢复后合并另一页通关进度，内存与状态栏 XP 一致", afterBfcache.xp === expected.xp && afterBfcache.runs === expected.runs && afterBfcache.done.join(",") === "U1L1" && afterBfcache.xpText === String(expected.xp) && u1DoneRendered === 1, JSON.stringify(afterBfcache));

    // 重新清空放行集合（再次冻结 storage / visibilitychange / focus / pageshow），另一标签页执行清除
    await tab1.evaluate(() => { window.__allowedSyncEvents.clear(); });
    const tab3 = await openApp(ctx);
    await tab3.waitForSelector(".pathview");
    await tab3.evaluate(() => window.__app.clearProgress());
    await tab3.close();
    await tab1.waitForTimeout(150);

    // 必须先证明 pageshow 之前 tab1 仍持有旧代进度
    const staleBeforeR4 = await readSnap(tab1);
    check("SYNTHETIC_EVENT", "R4 前置：bfcache 冻结期间清除后，tab1 在 pageshow 前仍持有旧代进度", staleBeforeR4.xp === expected.xp && staleBeforeR4.done.join(",") === "U1L1", JSON.stringify(staleBeforeR4));

    await tab1.evaluate(() => {
      window.__allowedSyncEvents.add("pageshow");
      window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
      window.__app.persist();
    });
    await tab1.waitForTimeout(200);
    const afterClearBfcache = await readSnap(tab1);
    check("SYNTHETIC_EVENT", "R4 清除后单独放行 pageshow(persisted=true) 恢复不会让旧代进度复活", afterClearBfcache.xp === 0 && afterClearBfcache.runs === 0 && afterClearBfcache.done.length === 0 && afterClearBfcache.xpText === "0", JSON.stringify(afterClearBfcache));
    await closeCtx(ctx);
  }

  // ---------- 3. [REAL_BROWSER_NAVIGATION] 真实导航离开再 browser.goBack() 后退恢复 ----------
  {
    const ctx = await openCtx(newDir());
    const navTab = await openApp(ctx);
    await passOnboarding(navTab);

    await navTab.goto(BASE + "privacy.html");
    await navTab.waitForLoadState("domcontentloaded");

    const workerTab = await openApp(ctx);
    await workerTab.waitForSelector(".pathview");
    await finishLesson(workerTab, "U1L1");
    const expected = await readSnap(workerTab);
    await workerTab.close();

    await navTab.goBack();
    await navTab.waitForFunction(() => window.__app?.getState);
    await navTab.waitForSelector(".pathview");
    const restored = await readSnap(navTab);
    check("REAL_BROWSER_NAVIGATION", "R5 真实导航离开并 goBack() 返回后，内存进度、持久化进度与页面 XP 一致", restored.xp === expected.xp && restored.runs === expected.runs && restored.done.join(",") === "U1L1" && restored.xpText === String(expected.xp), JSON.stringify(restored));
    await closeCtx(ctx);
  }

  // ---------- 4. [REAL_BROWSER_NAVIGATION] 多标签真实 bringToFront() 切回前台并继续通关（顺序解锁校准 U1L1->U1L2 精确 XP 与 runs 校验） ----------
  {
    // 基线仅开放首个未完成关卡：校准时先完成 U1L1 记录 XP，再完成已解锁的 U1L2，以前后差值作为 U1L2 单课增量
    const baselineCtx = await openCtx(newDir());
    const basePage = await openApp(baselineCtx);
    await passOnboarding(basePage);
    await finishLesson(basePage, "U1L1");
    const afterBaseU1 = await readSnap(basePage);
    await finishLesson(basePage, "U1L2");
    const afterBaseU2 = await readSnap(basePage);
    const u2SingleXp = afterBaseU2.xp - afterBaseU1.xp;
    await closeCtx(baselineCtx);
    check("REAL_BROWSER_NAVIGATION", "R6 校准前置：顺序完成 U1L1->U1L2 测得 U1L2 单课精确增量 > 0", afterBaseU1.runs === 1 && afterBaseU2.runs === 2 && u2SingleXp > 0, JSON.stringify({ afterBaseU1, afterBaseU2, u2SingleXp }));

    const ctx = await openCtx(newDir());
    const oldTab = await openApp(ctx);
    await passOnboarding(oldTab);

    const activeTab = await openApp(ctx);
    await activeTab.waitForSelector(".pathview");
    await activeTab.bringToFront();
    await finishLesson(activeTab, "U1L1");
    const u1Single = await readSnap(activeTab);
    await activeTab.close();

    // 真实切回旧标签页前台，确认已同步 U1L1 单课分值与 runs=1
    await oldTab.bringToFront();
    await oldTab.waitForTimeout(150);
    const syncedBeforeU2 = await readSnap(oldTab);
    check("REAL_BROWSER_NAVIGATION", "R6 前置：oldTab 切回前台已同步 U1L1 精确分值且 runs=1", syncedBeforeU2.xp === u1Single.xp && syncedBeforeU2.runs === 1 && syncedBeforeU2.done.join(",") === "U1L1", JSON.stringify({ u1Single, syncedBeforeU2 }));

    // 继续完成 U1L2，校验精确总 XP = u1Single.xp + u2SingleXp 且 runs = 2
    await finishLesson(oldTab, "U1L2");
    const afterU2 = await readSnap(oldTab);
    const verifyTab = await openApp(ctx);
    const persistedU2 = await readSnap(verifyTab);
    const expectedTotalXp = u1Single.xp + u2SingleXp;
    check("REAL_BROWSER_NAVIGATION", "R6 旧标签真实切回前台并继续通关 U1L2：精确 XP=单课之和、runs=2、无重复累加", afterU2.done.join(",") === "U1L1,U1L2" && persistedU2.done.join(",") === "U1L1,U1L2" && afterU2.xp === expectedTotalXp && persistedU2.xp === expectedTotalXp && afterU2.runs === 2 && persistedU2.runs === 2, JSON.stringify({ u1Single, u2SingleXp, expectedTotalXp, afterU2, persistedU2 }));
    await closeCtx(ctx);
  }

  // ---------- 5. [REAL_DEVICE_UNVERIFIED] 真机证据边界声明 ----------
  console.log("BACKGROUND_RECOVERY_EVIDENCE", JSON.stringify({
    browser: BNAME,
    syntheticEventChecks: evidenceLog.filter((x) => x.category === "SYNTHETIC_EVENT").length,
    realNavigationChecks: evidenceLog.filter((x) => x.category === "REAL_BROWSER_NAVIGATION").length,
    realDeviceEvidence: "REAL_DEVICE_UNVERIFIED (iPhone Safari / Home Screen App process kill & restore requires real hardware)",
  }));
} finally {
  for (const ctx of [...activeContexts]) {
    await closeCtx(ctx);
  }
  await new Promise((r) => srv.close(r));
  for (const d of dirs) {
    try { rmSync(d, { recursive: true, force: true }); } catch {}
  }
}

console.log(`\n[${BNAME}] 后台恢复专项：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
