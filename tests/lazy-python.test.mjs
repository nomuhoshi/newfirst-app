// H：Python（Pyodide，约 13 MB）改为“第一次真正要执行时才加载”。用 dist/ 的真实构建产物，自己起静态服务器并记录每个请求。
//  1. 打开应用（首次、什么都不做）停几秒：没有任何 Python 请求，runner 处于 idle。
//  2. 进“我的”页、地图、打开关卡开场页：仍然没有 Python 请求。
//  3. 答第一题点“检查”：这时才开始请求 Python，并显示真实运行结果（等于正确选项文字）。
//  4. 加载失败 → 提示 + “重试”按钮；恢复后点“重试”能得到真实结果；失败后的重试之外没有多余的自动请求。
//  6. 随机练习（已通关存档 + Python 冷启动，GPT1/产品官 11-16 H 补测）：
//     6a 首次真实运行失败 → 提示 + 重试 → 真实输出 → 继续做完整轮；练习不增加 XP / 红心 / 连续天数 / 完成次数，学习字段精确不变；
//     6b 冷启动还在加载时连续答两题：两次运行请求都排队，加载完成后第二题仍得到真实输出（不能被“运行器忙”误判成 Python 不可用）；
//     6c 加载中退出练习：迟到的结果不会改动路径页，学习字段不变，重进练习后正常出结果。
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

  // ---------- 6 随机练习：已通关存档 + Python 冷启动 ----------
  const CLEARED = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"];
  async function newColdPage() {
    const c = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const p = await c.newPage();
    const t = { ctx: c, page: p, abort: false, errors: [], base: 0, release: () => {} };
    let gateP = Promise.resolve();
    t.hold = () => { gateP = new Promise((res) => { t.release = res; }); };
    p.on("pageerror", (e) => t.errors.push(e.message));
    await p.route(/\/pyodide\//, async (r) => { if (t.abort) return r.abort(); await gateP; return r.continue(); });
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".statsbar, .onboard");
    await p.waitForFunction(() => window.__app?.runner, null, { timeout: 15000 });
    await p.evaluate((cleared) => { const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, done: Object.fromEntries(cleared.map((k) => [k, true])), prefs: { ...s.prefs, sound: false } }); Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", JSON.stringify(s)); }, CLEARED);
    await p.reload(); await p.waitForSelector(".statsbar");
    t.base = hits.length;
    t.py = () => hits.slice(t.base).filter((h) => /\/pyodide\/|py-worker/.test(h)).length;
    return t;
  }
  // 学习字段快照：随机练习不得改变其中任何一项
  const snap = (p) => p.evaluate(() => { const s = window.__app.getState(); return JSON.stringify({ xp: s.xp, hearts: s.hearts, streak: s.streak, lastDay: s.lastDay, lessonsCompleted: s.lessonsCompleted, done: Object.keys(s.done).sort(), run: !!window.__app.getRun() }); });
  // 进入随机练习，范围只选 U1L4 + U1L5（大多是选输出题），直到第一题是选输出题（它的真实输出 = 正确选项文字，可以精确比对）
  async function startPredictFirst(p) {
    for (let n = 0; n < 12; n++) {
      if (!(await p.locator(".practice-setup").count())) { await p.locator("[data-practice-entry]").click(); await p.waitForSelector(".practice-setup"); }
      await p.locator("[data-practice-none]").click();
      for (const l of ["U1L4", "U1L5"]) await p.locator(`[data-practice-lesson="${l}"]`).click();
      await p.locator('[data-practice-size="5"]').click();
      await p.locator("[data-practice-start]").click();
      await p.waitForSelector("[data-check]");
      const ex = await p.evaluate(() => window.__app.currentEx);
      if (ex.type === "predict") return ex;
      await p.locator('button[aria-label="退出练习"]').click(); await p.locator("[data-practice-quit]").click(); await p.waitForSelector(".pathview");
    }
    throw new Error("12 次都没抽到以选输出题开头的一轮");
  }
  async function fillCorrect(p) {
    const ex = await p.evaluate(() => window.__app.currentEx);
    if (ex.type === "predict") await p.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct)).click();
    else if (ex.type === "fill") { for (let k = 0; k < ex.answer.length; k++) { await p.locator(`[data-slot="${k}"]`).click(); await p.evaluate((tk) => [...document.querySelectorAll("[data-token]")].find((b) => b.dataset.token === tk).click(), ex.answer[k]); } }
    else { for (const k of ex.answers[0]) await p.locator(`.order-bank [data-line="${k}"]`).first().click(); }
    return ex;
  }
  const clickCheck = (p) => p.evaluate(() => document.querySelector("[data-check]").click());
  const outDone = (p, timeout = 60000) => p.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return !!t && !/运行中/.test(t); }, null, { timeout });
  const UNAVAILABLE = /没有加载成功|Python运行功能需要联网|不支持运行 Python|不允许启动 Python/;

  { // 6a 首次真实运行失败 → 重试 → 真实输出 → 做完整轮
    const t = await newColdPage(), p = t.page;
    const before = await snap(p);
    t.abort = true;
    const ex = await startPredictFirst(p);
    check("6a 进入随机练习、开始一轮、看到第一题（还没点检查）：没有任何 Python 请求", t.py() === 0, String(t.py()));
    const correctText = ex.options.find((o) => o.correct).text;
    await fillCorrect(p); await clickCheck(p);
    await p.waitForSelector(".feedbar"); await outDone(p, 40000);
    check("6a 点“检查”时才开始请求 Python（这次被拦成失败）", t.py() > 0, String(t.py()));
    const failText = await p.locator(".outpanel pre").innerText();
    check("6a 加载失败：如实提示不可用 + “重试”按钮，不用预设输出冒充；练习照常判分（显示答对了）", (await p.locator("[data-retry-python]").count()) === 1 && !failText.includes(correctText) && UNAVAILABLE.test(failText) && (await p.locator(".feedbar.ok").count()) === 1, failText.slice(0, 80));
    const nFail = t.py(); await p.waitForTimeout(3000);
    check("6a 失败后没有自动反复请求", t.py() === nFail, `${nFail} → ${t.py()}`);
    t.abort = false;
    await p.locator("[data-retry-python]").click();
    await p.waitForFunction((x) => document.querySelector(".outpanel pre")?.textContent.trim() === x, correctText, { timeout: 60000 });
    check("6a 点“重试”：真实输出 = 正确选项文字，重试按钮消失，runner 就绪", (await p.locator("[data-retry-python]").count()) === 0 && (await p.evaluate(() => window.__app.runner.state)) === "ready");
    // 继续做完整轮：每题都应得到真实输出（不是不可用提示）
    let n = 0, allReal = true, realDetail = "";
    await p.locator("[data-continue]:not([disabled])").waitFor(); await p.locator("[data-continue]").click();
    for (; n < 8; n++) {
      await p.waitForSelector("[data-check], .practice-finish");
      if (await p.locator(".practice-finish").count()) break;
      const ex2 = await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar"); await outDone(p);
      const o = (await p.locator(".outpanel pre").innerText()).trim();
      const real = (await p.locator("[data-retry-python]").count()) === 0 && !UNAVAILABLE.test(o) && o.length > 0 && (ex2.type !== "predict" || o === ex2.options.find((x) => x.correct).text.trim());
      if (!real) { allReal = false; realDetail += `${ex2.type}:${o.slice(0, 40)} | `; }
      await p.locator("[data-continue]:not([disabled])").waitFor(); await p.locator("[data-continue]").click();
    }
    await p.waitForSelector(".practice-finish", { timeout: 15000 });
    check("6a 其余题目都得到真实输出（选输出题 = 正确选项文字，其余非空且不是不可用提示）", allReal, realDetail);
    const first = await p.locator("[data-practice-first]").innerText();
    check("6a 结算：全部答对，首次答对 = 题数/题数", /^(\d+)\/\1$/.test(first), first);
    check("6a 随机练习不改变学习字段（XP / 红心 / 连续天数 / 已通关 / 完成次数精确不变）", (await snap(p)) === before, before + " → " + (await snap(p)));
    check("6a 结算后没有残留的练习状态", (await p.evaluate(() => window.__app.getPractice())) === null);
    check("6a 全程没有脚本错误", t.errors.length === 0, t.errors.join(" | "));
    await t.ctx.close();
  }
  { // 6b 冷启动还在加载时连续答两题：第二题不能被“运行器忙”误判成 Python 不可用
    const t = await newColdPage(), p = t.page;
    try {
      t.hold();
      await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      check("6b 第一题检查后：仍在“运行中…”（Python 加载被我们按住）", /运行中/.test(await p.locator(".outpanel pre").innerText()));
      await p.locator("[data-continue]:not([disabled])").waitFor(); await p.locator("[data-continue]").click();
      await p.waitForSelector("[data-check]");
      const ex2 = await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      check("6b 第二题检查后：同样在“运行中…”，两次运行请求都在排队", /运行中/.test(await p.locator(".outpanel pre").innerText()));
      t.release();
      await outDone(p, 90000);
      await p.waitForTimeout(500);
      const o = (await p.locator(".outpanel pre").innerText()).trim();
      const want = ex2.type === "predict" ? ex2.options.find((x) => x.correct).text.trim() : null;
      check("6b 加载完成后第二题得到真实输出：没有“不可用”提示、没有重试按钮" + (want !== null ? "、输出 = 正确选项文字" : ""), (await p.locator("[data-retry-python]").count()) === 0 && !UNAVAILABLE.test(o) && o.length > 0 && (want === null || o === want), `${ex2.type}: ${o.slice(0, 80)}`);
      check("6b runner 回到就绪，没有脚本错误", (await p.evaluate(() => window.__app.runner.state)) === "ready" && t.errors.length === 0, t.errors.join(" | "));
    } finally { t.release(); await t.ctx.close(); }
  }
  { // 6c 加载中退出练习：迟到的结果不抢页面
    const t = await newColdPage(), p = t.page;
    try {
      const before = await snap(p);
      t.hold();
      await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      await p.locator('button[aria-label="退出练习"]').click(); await p.locator("[data-practice-quit]").click(); await p.waitForSelector(".pathview");
      t.release();
      await p.waitForFunction(() => window.__app.runner.state === "ready", null, { timeout: 90000 });
      await p.waitForTimeout(1500);
      check("6c 退出后 Python 才加载完：路径页没有被迟到的结果改动（没有“运行结果”面板，仍在路径页）", (await p.locator(".outpanel").count()) === 0 && (await p.locator(".pathview").count()) === 1);
      check("6c 学习字段不变，没有残留的练习状态，没有脚本错误", (await snap(p)) === before && (await p.evaluate(() => window.__app.getPractice())) === null && t.errors.length === 0, t.errors.join(" | "));
      const ex = await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar"); await outDone(p, 30000);
      const o = (await p.locator(".outpanel pre").innerText()).trim();
      check("6c 重进练习：Python 已就绪，直接得到真实输出", (await p.locator("[data-retry-python]").count()) === 0 && o === ex.options.find((x) => x.correct).text.trim(), o.slice(0, 80));
    } finally { t.release(); await t.ctx.close(); }
  }
} finally { await browser.close(); srv.close(); }
const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
