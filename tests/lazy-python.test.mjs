// H：Python（Pyodide，约 13 MB）改为“第一次真正要执行时才加载”。用 dist/ 的真实构建产物，自己起静态服务器并记录每个请求。
//  1. 打开应用（首次、什么都不做）停几秒：没有任何 Python 请求，runner 处于 idle。
//  2. 进“我的”页、地图、打开关卡开场页：仍然没有 Python 请求。
//  3. 答第一题点“检查”：这时才开始请求 Python，并显示真实运行结果（等于正确选项文字）。
//  4. 加载失败 → 提示 + “重试”按钮；恢复后点“重试”能得到真实结果；失败后的重试之外没有多余的自动请求。
//  6. 随机练习（已通关存档 + Python 冷启动，GPT1/产品官 11-16 H 补测）：
//     6a 首次真实运行失败 → 提示 + 重试 → 真实输出 → 继续做完整轮；练习不增加 XP / 红心 / 连续天数 / 完成次数，学习字段精确不变；
//     6b 冷启动还在加载时连续答两题：两次运行请求都排队，加载完成后第二题仍得到真实输出（不能被“运行器忙”误判成 Python 不可用）；
//     6c 加载中退出练习：迟到的结果不会改动路径页，学习字段不变，重进练习后正常出结果。
//     6d 共享运行器的串行调度（直接调 runForOutput，输出各不相同）：并发请求各得各的结果；加载失败、死循环超时之后，后面的请求仍能正确结束；
//     6e 加载中退出练习且迟到的是失败：路径页不变、无未处理异常。
//     G1 真实资源拦截：路由记录具体 URL 与 abort / hold / continue 命中；检查前零请求、runner idle 且无 worker；退出或放行前先确认请求真的挂在那里。
//     G3 非零已通关夹具（XP / 红心 / 连续天数 / 完成次数 / done / firstXp / 观察器 ok+OK+currentEpoch），T0 夹具、T1 第一题、T2 结算、T3 回到地图 逐项对照内存与持久化。
//     G5 清理保证：每步单独 try/catch、等待关服回调、关闭失败的上下文计数、有错误或残留 = 非零退出，并带一个失败反例校准。
//     6a 整行比较正反校准：诊断里的“在线：是”不会误报，独立成行的预设输出会被拒绝。
// 桌面模拟，不等于 iPhone 真机。运行：npm run build && node tests/lazy-python.test.mjs（MOBILE_BROWSER=chromium|webkit）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import * as pw from "playwright";
import { observeSuipianV4Storage } from "./lib/ledger-observer.mjs";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const BROWSER = process.env.MOBILE_BROWSER || "chromium";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".wasm": "application/wasm", ".zip": "application/zip", ".webmanifest": "application/manifest+json" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

// G5：清理保证。每一步单独 try/catch，一步失败不影响后面的清理；失败和残留都记下来，最后非零退出。
function makeCleanup() {
  const c = { opened: new Set(), failed: [], errors: [] };
  c.track = (ctx) => { c.opened.add(ctx); return ctx; };
  c.closeCtx = async (ctx) => { try { await ctx.close(); c.opened.delete(ctx); } catch (e) { c.failed.push(String(e?.message || e).slice(0, 120)); } };
  c.steps = async (steps) => { for (const [name, fn] of steps) { try { await fn(); } catch (e) { c.errors.push(name + "：" + String(e?.message || e).slice(0, 120)); } } };
  c.residue = () => c.opened.size;
  return c;
}
const CL = makeCleanup();
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
  const ctx = CL.track(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" }));
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
  await CL.closeCtx(ctx);

  // ---------- 6 随机练习：已通关存档 + Python 冷启动 ----------
  const CLEARED = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"];
  async function newColdPage() {
    const c = CL.track(await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" }));
    const p = await c.newPage();
    const t = { ctx: c, page: p, abort: false, abortAfterGate: false, errors: [], base: 0, release: () => {} };
    let gateP = Promise.resolve();
    t.hold = () => { gateP = new Promise((res) => { t.release = res; }); };
    p.on("pageerror", (e) => t.errors.push(e.message));
    t.rl = []; // G1：每个 Pyodide 资源请求的具体 URL 和处理结果：arrive（到达）/ abort（立刻拦）/ abort-late（挂起后放行时拦）/ continue（放行）
    await p.route(/\/pyodide\//, async (r) => {
      const u = new URL(r.request().url()).pathname;
      if (t.abort) { t.rl.push({ u, a: "abort" }); return r.abort(); }
      t.rl.push({ u, a: "arrive" });
      await gateP;
      if (t.abortAfterGate) { t.rl.push({ u, a: "abort-late" }); return r.abort(); }
      t.rl.push({ u, a: "continue" }); return r.continue();
    });
    t.cnt = (a, re = /./) => t.rl.filter((x) => x.a === a && re.test(x.u)).length;
    t.pending = () => t.cnt("arrive") - t.cnt("abort-late") - t.cnt("continue");
    t.urls = (a) => [...new Set(t.rl.filter((x) => x.a === a).map((x) => x.u.split("/").pop()))].join(",");
    t.waitPending = async () => { for (let i = 0; i < 200; i++) { if (t.pending() > 0) return true; await new Promise((r) => setTimeout(r, 50)); } return false; };
    await p.goto(BASE, { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".statsbar, .onboard");
    await p.waitForFunction(() => window.__app?.runner, null, { timeout: 15000 });
    // G3：非零已通关夹具（XP / 红心 / 连续天数 / 完成次数 / 完成日期 / 首次通关 XP 都不为零），先写旧版记录，加载后再用应用自己的接口补上首次通关 XP 并保存，再重载确认读得回来
    await p.evaluate((cleared) => {
      const s = window.__app.getState(); const d = new Date(); const pad = (n) => String(n).padStart(2, "0"); const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      Object.assign(s, { onboarded: true, xp: 360, hearts: 3, heartsAt: Date.now(), streak: 3, lastDay: today, lessonsCompleted: 6, done: Object.fromEntries(cleared.map((k) => [k, true])), doneOn: Object.fromEntries(cleared.map((k) => [k, today])), prefs: { ...s.prefs, sound: false } });
      Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", JSON.stringify(s));
    }, CLEARED);
    await p.reload(); await p.waitForSelector(".statsbar");
    await p.evaluate(() => { window.__app.addXp(40, "U1L1", true); window.__app.addXp(40, "U1L2", true); window.__app.persist(); });
    await p.reload(); await p.waitForSelector(".statsbar");
    t.base = hits.length;
    t.py = () => hits.slice(t.base).filter((h) => /\/pyodide\/|py-worker/.test(h)).length;
    return t;
  }
  // 学习字段快照（G3）：内存里的学习字段 + 持久化（独立观察器读 localStorage）。随机练习不得改变其中任何一项。
  // 读取失败（观察器 ok !== true / status !== "OK"）时快照里带 "READ_FAIL"，后面的检查会因此失败，不会拿两个 undefined 比。
  const OBS = `(${observeSuipianV4Storage.toString()})(window.localStorage)`;
  const snapObj = async (p) => {
    const o = await p.evaluate(OBS); // 字符串表达式：由 Playwright 直接求值，不受页面 CSP 对 eval 的限制
    const mem = await p.evaluate(() => {
      const s = window.__app.getState();
      return { xp: s.xp, hearts: s.hearts, streak: s.streak, lastDay: s.lastDay, lessonsCompleted: s.lessonsCompleted, done: Object.fromEntries(Object.keys(s.done).sort().map((k) => [k, s.done[k]])), doneOn: Object.fromEntries(Object.keys(s.doneOn || {}).sort().map((k) => [k, s.doneOn[k]])), run: !!window.__app.getRun() };
    });
    return { mem, disk: o && o.ok === true && o.status === "OK" ? { currentEpoch: o.currentEpoch, xp: o.xp, runs: o.runs, done: o.done, firstXpByLesson: o.firstXpByLesson } : "READ_FAIL:" + JSON.stringify(o && { ok: o.ok, status: o.status }) };
  };
  const snap = async (p) => JSON.stringify(await snapObj(p));
  // 夹具有效性：必须是非零、读得回的存档，否则“前后相等”什么也证明不了
  const fixtureOk = (j) => { const o = JSON.parse(j); return typeof o.disk === "object" && o.mem.xp > 0 && o.mem.hearts === 3 && o.mem.streak > 0 && !!o.mem.lastDay && o.mem.lessonsCompleted > 0 && Object.keys(o.mem.done).length === 6 && Object.keys(o.mem.doneOn).length === 6 && o.disk.xp > 0 && o.disk.runs > 0 && o.disk.done.length === 6 && Object.keys(o.disk.firstXpByLesson).length >= 2 && typeof o.disk.currentEpoch === "string" && o.disk.currentEpoch.length > 0; };
  // 6a 整行比较：用“整行等于正确选项文字”判断是否拿预设输出冒充（选项可能很短，诊断行里本来就有“在线：是”）
  const looksPresetOutput = (text, correct) => text.split("\n").some((l) => l.trim() === String(correct).trim());
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
    check("6a T0 夹具有效：XP / 红心 / 连续天数 / 完成次数 / 完成日期非零，持久化读得回（观察器 ok、status=OK、currentEpoch、firstXpByLesson、done 共 6 关）", fixtureOk(before), before);
    check("6a G1 检查之前：runner 是 idle，没有创建 Python 线程，没有任何 Pyodide 资源请求", (await p.evaluate(() => [window.__app.runner.state, !!window.__app.runner.worker].join())) === "idle,false" && t.rl.length === 0 && t.py() === 0, JSON.stringify(t.rl));
    t.abort = true;
    const ex = await startPredictFirst(p);
    check("6a T1 进入练习看到第一题后：内存与持久化与 T0 逐项相同", (await snap(p)) === before);
    check("6a 进入随机练习、开始一轮、看到第一题（还没点检查）：没有任何 Python 请求", t.py() === 0, String(t.py()));
    const correctText = ex.options.find((o) => o.correct).text;
    await fillCorrect(p); await clickCheck(p);
    await p.waitForSelector(".feedbar"); await outDone(p, 40000);
    check("6a 点“检查”时才开始请求 Python（这次被拦成失败）", t.py() > 0, String(t.py()));
    const failText = await p.locator(".outpanel pre").innerText();
    // 注意：选项文字可能很短（如“是”“0”），而不可用提示的诊断行里本来就有“在线：是”之类的字，所以不能用“包含”判断；
    // 用“整行等于正确选项文字”判断是否拿预设输出冒充（第一次 CI 的 6a 失败就是这个原因的嫌疑，日志已保留，见 PR 说明）。
    const retryN = await p.locator("[data-retry-python]").count(), okN = await p.locator(".feedbar.ok").count();
    const passedOff = looksPresetOutput(failText, correctText);
    check("6a 加载失败：如实提示不可用（不是预设输出冒充）", UNAVAILABLE.test(failText) && !passedOff, `correct=${JSON.stringify(correctText)} text=${failText.slice(0, 80)}`);
    check("6a 加载失败：出现“重试”按钮，练习照常判分（显示答对了）", retryN === 1 && okN === 1, `retry=${retryN} feedbar.ok=${okN}`);
    check("6a G1 真实拦截命中：被 abort 的 Pyodide 资源 ≥ 1（具体文件见明细），没有放行过的资源", t.cnt("abort", /\/pyodide\//) >= 1 && t.cnt("continue") === 0, `abort=${t.cnt("abort")} [${t.urls("abort")}] continue=${t.cnt("continue")}`);
    const nFail = t.py(); await p.waitForTimeout(3000);
    check("6a 失败后没有自动反复请求", t.py() === nFail, `${nFail} → ${t.py()}`);
    t.abort = false;
    await p.locator("[data-retry-python]").click();
    await p.waitForFunction((x) => document.querySelector(".outpanel pre")?.textContent.trim() === x, correctText, { timeout: 60000 });
    check("6a 点“重试”：真实输出 = 正确选项文字，重试按钮消失，runner 就绪", (await p.locator("[data-retry-python]").count()) === 0 && (await p.evaluate(() => window.__app.runner.state)) === "ready");
    check("6a G1 重试放行：pyodide.asm.wasm 真的被放行加载", t.cnt("continue", /pyodide\.asm\.wasm$/) >= 1 && t.pending() === 0, `continue=${t.cnt("continue")} [${t.urls("continue")}]`);
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
    check("6a 结算：本夹具 5 题全部答对，首次答对恰好 5/5，共做了 5 题（第 1 题 + 后续 4 题）", first.trim() === "5/5" && n === 4, `${first} n=${n}`);
    check("6a T2 结算页：内存与持久化（XP / 红心 / 连续天数 / 完成次数 / done / 完成日期 / firstXp / 观察器 epoch）与 T0 逐项相同", (await snap(p)) === before, before + " → " + (await snap(p)));
    check("6a 结算后没有残留的练习状态", (await p.evaluate(() => window.__app.getPractice())) === null);
    await p.locator(".practice-finish [data-continue]").click(); await p.waitForSelector(".pathview");
    check("6a T3 手动点“回到地图”后：内存与持久化仍与 T0 逐项相同，回到路径页", (await snap(p)) === before && (await p.locator(".pathview").count()) === 1, before + " → " + (await snap(p)));
    check("6a 全程没有脚本错误", t.errors.length === 0, t.errors.join(" | "));
    await CL.closeCtx(t.ctx);
  }
  { // 6b 冷启动还在加载时连续答两题：第二题不能被“运行器忙”误判成 Python 不可用
    const t = await newColdPage(), p = t.page;
    try {
      t.hold();
      await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      check("6b 第一题检查后：仍在“运行中…”，且 Pyodide 资源请求确实挂在那里（G1）", /运行中/.test(await p.locator(".outpanel pre").innerText()) && (await t.waitPending()), `pending=${t.pending()}`);
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
      check("6b runner 回到就绪，没有脚本错误，共享监听集合已空，被挂起的请求都已放行", (await p.evaluate(() => window.__app.runner.state)) === "ready" && t.errors.length === 0 && (await p.evaluate(() => window.__app.listenerCount())) === 0 && t.pending() === 0, `${t.errors.join(" | ")} listeners=${await p.evaluate(() => window.__app.listenerCount())} pending=${t.pending()}`);
    } finally { t.release(); await CL.closeCtx(t.ctx); }
  }
  { // 6c 加载中退出练习：迟到的结果不抢页面
    const t = await newColdPage(), p = t.page;
    try {
      const before = await snap(p);
      t.hold();
      await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      check("6c G1 退出之前：Pyodide 请求确实挂起（arrive 未放行）", await t.waitPending(), `pending=${t.pending()}`);
      await p.locator('button[aria-label="退出练习"]').click(); await p.locator("[data-practice-quit]").click(); await p.waitForSelector(".pathview");
      t.release();
      await p.waitForFunction(() => window.__app.runner.state === "ready", null, { timeout: 90000 });
      check("6c G1 放行后：被挂起的请求都以 continue 结束", t.pending() === 0 && t.cnt("continue") >= 1, `continue=${t.cnt("continue")}`);
      await p.waitForTimeout(1500);
      check("6c 退出后 Python 才加载完：路径页没有被迟到的结果改动（没有“运行结果”面板，仍在路径页）", (await p.locator(".outpanel").count()) === 0 && (await p.locator(".pathview").count()) === 1);
      check("6c 学习字段不变，没有残留的练习状态，没有脚本错误", (await snap(p)) === before && (await p.evaluate(() => window.__app.getPractice())) === null && t.errors.length === 0, t.errors.join(" | "));
      const ex = await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar"); await outDone(p, 30000);
      const o = (await p.locator(".outpanel pre").innerText()).trim();
      check("6c 重进练习：Python 已就绪，直接得到真实输出", (await p.locator("[data-retry-python]").count()) === 0 && o === ex.options.find((x) => x.correct).text.trim(), o.slice(0, 80));
    } finally { t.release(); await CL.closeCtx(t.ctx); }
  }

  { // 6d 共享运行器的串行调度：直接调 runForOutput，三个输出各不相同
    const t = await newColdPage(), p = t.page;
    try {
      const callTwo = () => p.evaluate(() => { window.__q = [window.__app.runForOutput('print("AAA-1")'), window.__app.runForOutput('print("BBB-2")')]; return true; });
      const results = () => p.evaluate(async () => { const cap = new Promise((r) => setTimeout(() => r("TIMEOUT"), 90000)); return Promise.race([Promise.all(window.__q), cap]); });
      t.hold(); await callTwo();
      check("6d 冷启动时并发两个请求（Python 被按住）：runner 在加载中", (await p.evaluate(() => window.__app.runner.state)) === "loading");
      t.release();
      const r1 = await results();
      check("6d 放行后两个请求各得各的结果：A → AAA-1，B → BBB-2（没有被“运行器忙”误判，也没有串号）", Array.isArray(r1) && r1[0]?.out === "AAA-1\n" && r1[1]?.out === "BBB-2\n" && !r1[0]?.error && !r1[1]?.error, JSON.stringify(r1));
      // 加载失败：两个并发请求都如实失败（null），不卡住；恢复后下一个请求正常
      const t2 = await newColdPage(), p2 = t2.page;
      try {
        t2.abort = true;
        await p2.evaluate(() => { window.__q = [window.__app.runForOutput('print("F1")'), window.__app.runForOutput('print("F2")')]; return true; });
        const rf = await p2.evaluate(async () => { const cap = new Promise((r) => setTimeout(() => r("TIMEOUT"), 90000)); return Promise.race([Promise.all(window.__q), cap]); });
        check("6d 加载被拦：两个并发请求都如实失败（null），没有卡住", Array.isArray(rf) && rf[0] === null && rf[1] === null, JSON.stringify(rf));
        t2.abort = false;
        const ok3 = await p2.evaluate(async () => { const cap = new Promise((r) => setTimeout(() => r("TIMEOUT"), 90000)); return Promise.race([window.__app.runForOutput('print("CCC-3")'), cap]); });
        check("6d 失败之后恢复：下一个请求得到真实输出 CCC-3", ok3?.out === "CCC-3\n", JSON.stringify(ok3));
        // 死循环超时之后：排在后面的请求仍能结束并得到自己的输出
        const loop = await p2.evaluate(async () => { window.__q = [window.__app.runForOutput("while True:\n    pass"), window.__app.runForOutput('print("EEE-5")')]; const cap = new Promise((r) => setTimeout(() => r("TIMEOUT"), 90000)); return Promise.race([Promise.all(window.__q), cap]); });
        check("6d 第一个请求死循环被超时停止（Stopped），排队的第二个请求仍得到 EEE-5", Array.isArray(loop) && loop[0]?.error?.kind === "Stopped" && loop[1]?.out === "EEE-5\n", JSON.stringify(loop));
        check("6d 全程没有未处理的脚本错误", t.errors.length === 0 && t2.errors.length === 0, t.errors.concat(t2.errors).join(" | "));
      } finally { t2.release(); await CL.closeCtx(t2.ctx); }
    } finally { t.release(); await CL.closeCtx(t.ctx); }
  }
  { // 6e 加载中退出练习，迟到的是“失败”：路径页不变、无未处理异常
    const t = await newColdPage(), p = t.page;
    try {
      const before = await snap(p);
      t.hold(); t.abortAfterGate = true;
      await startPredictFirst(p);
      await fillCorrect(p); await clickCheck(p);
      await p.waitForSelector(".feedbar");
      check("6e 请求已挂起（Python 被按住）：运行中…，runner 在 loading，Pyodide 请求确实挂起（G1）", /运行中/.test(await p.locator(".outpanel pre").innerText()) && (await p.evaluate(() => window.__app.runner.state)) === "loading" && (await t.waitPending()), `pending=${t.pending()}`);
      await p.locator('button[aria-label="退出练习"]').click(); await p.locator("[data-practice-quit]").click(); await p.waitForSelector(".pathview");
      t.release();
      await p.waitForFunction(() => window.__app.runner.state === "loadError", null, { timeout: 60000 });
      await p.waitForTimeout(1500);
      check("6e 迟到的失败没有改动路径页：没有“运行结果”面板、没有“重试”按钮、仍在路径页", (await p.locator(".outpanel").count()) === 0 && (await p.locator("[data-retry-python]").count()) === 0 && (await p.locator(".pathview").count()) === 1);
      check("6e G1 迟到的失败确实发生：被挂起的请求在放行时以 abort-late 结束", t.cnt("abort-late") >= 1 && t.pending() === 0, `abort-late=${t.cnt("abort-late")} [${t.urls("abort-late")}]`);
      check("6e 学习字段（内存 + 持久化）不变，没有残留练习状态，没有脚本错误，共享监听集合已空", (await snap(p)) === before && (await p.evaluate(() => window.__app.getPractice())) === null && t.errors.length === 0 && (await p.evaluate(() => window.__app.listenerCount())) === 0, t.errors.join(" | "));
    } finally { t.release(); await CL.closeCtx(t.ctx); }
  }
  { // 校准：6a 整行比较、G3 夹具有效性、G5 清理——证明这些判断能分出对错
    const diag = "Python 运行环境没有加载成功，原因未确认。\n诊断：fake；在线：是";
    check("校准 6a：诊断行里的“在线：是”不会被误判成预设输出（正确选项“是”）", looksPresetOutput(diag, "是") === false);
    check("校准 6a：独立成行的预设输出会被检出（正确选项“是”）", looksPresetOutput(diag + "\n是", "是") === true);
    check("校准 6a：整段输出恰好等于正确选项会被检出", looksPresetOutput("杯数 4", "杯数 4") === true);
    const good = JSON.stringify({ mem: { xp: 360, hearts: 3, streak: 3, lastDay: "2026-11-16", lessonsCompleted: 6, done: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 }, doneOn: { a: 1, b: 1, c: 1, d: 1, e: 1, f: 1 } }, disk: { currentEpoch: "m0", xp: 360, runs: 6, done: ["a", "b", "c", "d", "e", "f"], firstXpByLesson: { U1L1: 40, U1L2: 40 } } });
    check("校准 G3：合格的非零夹具通过 fixtureOk", fixtureOk(good) === true);
    check("校准 G3：读取失败（READ_FAIL）的快照不能通过", fixtureOk(JSON.stringify({ ...JSON.parse(good), disk: "READ_FAIL:{}" })) === false);
    check("校准 G3：XP 为零的夹具不能通过", fixtureOk(JSON.stringify({ ...JSON.parse(good), mem: { ...JSON.parse(good).mem, xp: 0 } })) === false);
    const C2 = makeCleanup(); const order = [];
    await C2.steps([["a", async () => order.push("a")], ["b-失败", async () => { throw new Error("boom"); }], ["c", async () => order.push("c")]]);
    check("校准 G5：中间一步失败，后面的清理步骤仍然执行，错误被记录", order.join() === "a,c" && C2.errors.length === 1 && /b-失败/.test(C2.errors[0]), JSON.stringify(C2.errors));
    const fakeCtx = { close: async () => { throw new Error("close failed"); } }; C2.track(fakeCtx); await C2.closeCtx(fakeCtx);
    check("校准 G5：关闭失败的上下文被记入 failed 并算作残留", C2.failed.length === 1 && C2.residue() === 1);
  }
} finally {
  // G5：每一步单独 try/catch；先关上下文，再关浏览器，最后等服务器的关闭回调；任何错误或残留 = 非零退出
  await CL.steps([
    ["关闭仍打开的上下文", async () => { for (const c of [...CL.opened]) await CL.closeCtx(c); }],
    ["关闭浏览器", async () => { await browser.close(); }],
    ["关闭服务器并等回调", async () => { srv.closeAllConnections?.(); await new Promise((res, rej) => { const t = setTimeout(() => rej(new Error("服务器 5 秒内没有关闭")), 5000); srv.close((e) => { clearTimeout(t); e ? rej(e) : res(); }); }); }],
  ]);
}
const cleanBad = CL.errors.length + CL.failed.length + CL.residue();
if (cleanBad) console.log("❌ 清理失败 / 残留：" + JSON.stringify({ errors: CL.errors, failedClose: CL.failed, residue: CL.residue() }));
const bad = results.filter((x) => !x).length + cleanBad;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
