// 第五轮后的自动测试：离线（Service Worker）、版本更新与旧缓存清理、Python 离线提示、振动功能检测、
// 减少动态效果、退出关卡后的状态。用 dist/ 里的真实构建产物，自己起一个可以随时“断网”“换版本”的小服务器。
// 桌面 Chromium 模拟，不能代替 iPhone 真机。运行：npm run build && node tests/step3.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, cpSync, mkdtempSync, writeFileSync, rmSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4331;
const BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".wav": "audio/wav", ".txt": "text/plain", ".zip": "application/zip" };

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

// ---------- 可控的小服务器：换根目录 = 换版本；stop() = 断网；delayMs = 网络很慢 ----------
let root = DIST, delayMs = 0, srv = null;
const hits = [];
function start() {
  return new Promise((res) => {
    srv = createServer((req, resp) => {
      const go = () => {
        const url = new URL(req.url, BASE);
        hits.push(url.pathname);
        let p = join(root, decodeURIComponent(url.pathname));
        if (url.pathname.endsWith("/")) p = join(p, "index.html");
        if (!p.startsWith(root) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
        resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
        resp.end(readFileSync(p));
      };
      if (delayMs && !req.url.includes("sw.js")) setTimeout(go, delayMs); else go();
    }).listen(PORT, res);
  });
}
function stop() { return new Promise((res) => { srv.closeAllConnections(); srv.close(() => res()); }); }

// 复制一份 dist 当作“新版本”：sw.js 版本号换掉，页面和脚本里加标记
const tmp = mkdtempSync(join(tmpdir(), "suipian-"));
function makeVersion(name, { dropCss = false } = {}) {
  const dir = join(tmp, name);
  cpSync(DIST, dir, { recursive: true });
  const sw = join(dir, "sw.js");
  writeFileSync(sw, readFileSync(sw, "utf8").replace(/const VERSION = "[^"]*";/, `const VERSION = "${name}";`));
  writeFileSync(join(dir, "index.html"), readFileSync(join(dir, "index.html"), "utf8") + `\n<!-- MARKER-${name} -->\n`);
  const mainJs = readdirSync(join(dir, "assets")).find((f) => /^main-.*\.js$/.test(f));
  writeFileSync(join(dir, "assets", mainJs), readFileSync(join(dir, "assets", mainJs), "utf8") + `\n;window.__marker="${name}";\n`);
  if (dropCss) rmSync(join(dir, "assets", readdirSync(join(dir, "assets")).find((f) => /^main-.*\.css$/.test(f))));
  return dir;
}

await start();
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  const text = () => page.locator("#app").innerText();
  const seed = (done, extra = {}) => page.evaluate(([d, x]) => { const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, done: Object.fromEntries(d.map((k) => [k, true])), prefs: { ...s.prefs, sound: false } }, x); Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); /* 模拟“带着这份旧存档第一次打开 v4”：v4 键先清掉，旧键才会被迁移读取 */ localStorage.setItem("suipian.progress", JSON.stringify(s)); }, [done, extra]);
  const cacheKeys = () => page.evaluate(async () => (await caches.keys()).sort());
  const waitKeys = async (pred, ms = 15000) => { const t = Date.now(); let k = []; while (Date.now() - t < ms) { k = await cacheKeys(); if (pred(k)) return k; await page.waitForTimeout(300); } return k; };
  const U1 = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"];

  // ===== 1. 第一次联网打开：注册 Service Worker，缓存应用外壳 =====
  await page.goto(BASE);
  await page.waitForSelector(".statsbar, .onboard");
  await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
  const keysA = await waitKeys((k) => k.length >= 1);
  check("离线：联网打开一次后 Service Worker 接管页面，缓存名带版本号（suipian-<版本>）", keysA.length === 1 && /^suipian-\d{4}-\d{2}-\d{2}T/.test(keysA[0]), keysA.join());
  const cached = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); return (await c.keys()).map((r) => new URL(r.url).pathname.replace(/^\/+/, "")); });
  const has = (re) => cached.some((u) => re.test(u));
  check("离线：缓存了应用外壳（首页、JS、CSS、Python 工作线程脚本、图标、manifest）", has(/^$/) && has(/^index\.html$/) && has(/^assets\/main-.*\.js$/) && has(/^assets\/main-.*\.css$/) && has(/^assets\/py-worker-.*\.js$/) && has(/^icon-180\.png$/) && has(/^icon-192\.png$/) && has(/^icon-512\.png$/) && has(/^manifest\.webmanifest$/), cached.join(" "));
  check("离线：没有缓存大型 Pyodide、测试音频和技术验证页", !cached.some((u) => /pyodide|sfx|lab/.test(u)), cached.join(" "));
  const mainText = await page.evaluate(async () => { const c = await caches.open((await caches.keys())[0]); const k = (await c.keys()).find((r) => /assets\/main-.*\.js$/.test(r.url)); return (await c.match(k)).text(); });
  check("离线：课程内容（course / unit1 / unit2 / words）已经打包进缓存的 JS", ["奶茶店点单屏", "文字与长度", "保存饮品名", "菜单标签", "/leŋθ/"].every((w) => mainText.includes(w)));
  check("离线：“我的”页诊断里能看到应用版本、缓存版本和离线支持状态", await (async () => {
    await seed(U1); await page.reload(); await page.waitForSelector(".statsbar");
    await page.getByRole("button", { name: "我的" }).tap();
    const d = await page.locator('[aria-label="诊断信息"]').innerText();
    return /应用版本：\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/.test(d) && /缓存版本：\d{4}-\d{2}-\d{2}T/.test(d) && /离线支持：已启用/.test(d);
  })());
  check("“我的”页的版本行和复制诊断里的版本行完全一致（构建时间 + 7 位提交号）", await (async () => {
    const d = (await page.locator('[aria-label="诊断信息"]').innerText()).split("\n")[0].trim();
    const v = (await page.locator("[data-app-version]").innerText()).trim();
    return d === v && /^应用版本：\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC（提交 ([0-9a-f]{7}|未知)）$/.test(v);
  })());
  await page.getByRole("button", { name: "学习", exact: true }).tap();

  // ===== 2. 断网：地图、第 1/2 单元、“我的”页都能打开；刷新不白屏 =====
  await stop();
  await page.reload();
  await page.waitForSelector(".statsbar", { timeout: 15000 });
  const offMap = await text();
  check("离线：断网后刷新不白屏，地图显示两个单元", /奶茶店点单屏/.test(offMap) && /文字与长度/.test(offMap) && /第 1 单元 · 已完成/.test(offMap));
  await page.goto(BASE + "?from=home-screen");
  await page.waitForSelector(".statsbar", { timeout: 15000 });
  check("离线：带查询参数的地址（从主屏幕打开）也能打开", /文字与长度/.test(await text()));
  await page.getByRole("button", { name: "我的" }).tap();
  check("离线：“我的”页能打开", /我的学习/.test(await text()) && /离线支持：已启用/.test(await page.locator('[aria-label="诊断信息"]').innerText()));
  await page.getByRole("button", { name: "学习", exact: true }).tap();
  // 开始 U1 复习，确认第 1 单元内容离线可用
  await page.locator('[data-lesson="U1L1"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  check("离线：能打开第 1 单元的关卡（复习）", /让屏幕说话/.test(await page.locator(".intro-title").innerText()));
  await page.getByRole("button", { name: "退出本关" }).tap(); await page.getByRole("button", { name: "退出", exact: true }).tap();
  // 第 2 单元整关离线做完
  await page.locator('[data-lesson="U2L1"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  check("离线：能打开第 2 单元的关卡", /保存饮品名/.test(await page.locator(".intro-title").innerText()));
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  const answerCur = async (correct = true) => {
    const e = await page.evaluate(() => window.__app.currentEx);
    if (e.type === "predict") await page.locator(".choice").nth(e.options.findIndex((o) => !!o.correct === correct)).tap();
    else if (e.type === "fill") { const toks = correct ? e.answer : [e.tokens.find((t) => !e.answer.includes(t) && !(e.initial || []).includes(t)) ?? e.tokens.find((t) => !e.answer.includes(t))]; for (const t of toks) await page.locator(`[data-token=${JSON.stringify(t)}]`).tap(); }
    else for (const k of correct ? e.answers[0] : [...e.answers[0]].reverse()) await page.locator(`.order-bank [data-line="${k}"]`).first().tap();
    await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar");
    return e;
  };
  // 第 1 题（选输出）：离线时“运行结果”必须如实说明 Python 需要联网，且有重试按钮，不能出现预设输出
  const q1 = await answerCur(true);
  await page.waitForFunction(() => document.querySelector(".outpanel pre")?.textContent && !/运行中/.test(document.querySelector(".outpanel pre").textContent), null, { timeout: 20000 });
  const offPre = await page.locator(".outpanel pre").innerText();
  const correctText = q1.options.find((o) => o.correct).text;
  check("离线：运行结果面板准确提示“Python运行功能需要联网后加载”，并保留“重试”按钮", /Python运行功能需要联网后加载/.test(offPre) && (await page.locator("[data-retry-python]").count()) === 1, offPre);
  check("离线：不用预设输出冒充 Python 真实执行（面板里没有这道题的输出文字）", offPre.trim() !== correctText && !offPre.includes(correctText) , offPre);
  check("离线：Python 不可用时选择题照常判分、加 XP", await page.evaluate(() => window.__app.getState().xp) >= 10 && /答对了/.test(await page.locator(".feedbar").innerText()));

  // ===== 3. 恢复网络：Python 重试能真正运行；换成新版本，自动获取并清理旧缓存 =====
  root = makeVersion("v2");
  await start();
  await page.evaluate(async () => { await caches.open("suipian-old-decoy"); await caches.open("other-app-cache"); }); // 一个旧的本应用缓存，一个别的应用的缓存
  await page.locator("[data-retry-python]").tap();
  await page.waitForFunction((t) => document.querySelector(".outpanel pre")?.textContent.trim() === t, correctText, { timeout: 60000 });
  check("恢复网络后点“重试”：Python 加载成功，显示真实运行结果", (await page.locator(".outpanel pre").innerText()).trim() === correctText && (await page.locator("[data-retry-python]").count()) === 0);
  await page.locator("[data-continue]").tap();
  // 刷新 → 联网优先拿到新版本
  await page.reload();
  await page.waitForSelector(".statsbar", { timeout: 15000 });
  const mk = await page.evaluate(() => window.__marker);
  check("更新：恢复网络后刷新，拿到的是新版本的页面和脚本（联网优先）", mk === "v2" && (await page.evaluate(async () => (await (await fetch(location.href)).text()).includes("MARKER-v2"))), String(mk));
  // 新版装好后不立刻接管：旧缓存还在，等地图上用户点“现在更新”才激活（旧机制是装好即接管、立刻删旧缓存）
  const acceptUpdate = async () => { await page.waitForSelector("[data-update-now]", { timeout: 20000 }); await Promise.all([page.waitForEvent("load"), page.locator("[data-update-now]").tap()]); await page.waitForSelector(".statsbar", { timeout: 15000 }); };
  const keysB0 = await waitKeys((k) => k.includes("suipian-v2"));
  check("更新：新版装好后不立刻接管——旧缓存仍在，地图上出现“有新版本”提示", keysB0.includes("suipian-v2") && keysA.every((k) => keysB0.includes(k)) && keysB0.includes("suipian-old-decoy") && (await page.locator("[data-update-now]").count()) === 1, keysB0.join());
  await acceptUpdate();
  const keysB = await waitKeys((k) => k.includes("suipian-v2"));
  check("更新：用户点“现在更新”后新版激活：不删除任何历史版本缓存（旧页面可能还要按需加载旧文件），别的应用的缓存不动", keysB.includes("suipian-v2") && keysA.every((k) => keysB.includes(k)) && keysB.includes("suipian-old-decoy") && keysB.includes("other-app-cache"), keysB.join());
  const cachedB = await page.evaluate(async () => { const c = await caches.open("suipian-v2"); return (await c.keys()).map((r) => r.url); });
  check("缓存：用过 Python 之后，Pyodide 文件仍然没有进入缓存", cachedB.length > 5 && !cachedB.some((u) => /pyodide/.test(u)) && !cachedB.some((u) => /sfx/.test(u)));
  // 新版再次断网也能打开（缓存已换成新版）
  await stop();
  await page.reload(); await page.waitForSelector(".statsbar", { timeout: 15000 });
  check("更新：换成新版本后再断网，打开的是新版本的缓存", (await page.evaluate(() => window.__marker)) === "v2");
  await start();

  // ===== 4. 新版本缺文件：安装失败，旧缓存和旧版本继续可用 =====
  root = makeVersion("v3-broken", { dropCss: true });
  await page.reload(); await page.waitForSelector(".statsbar");
  await page.waitForTimeout(2500);
  const keysC = await cacheKeys();
  check("更新：新版本缺文件时安装失败，不会留下缺文件的半个缓存，旧缓存继续可用", keysC.includes("suipian-v2") && !keysC.includes("suipian-v3-broken"), keysC.join());
  root = makeVersion("v4");
  await page.reload(); await page.waitForSelector(".statsbar");
  await acceptUpdate();
  const keysD = await waitKeys((k) => k.includes("suipian-v4"));
  check("更新：之后发布完整的新版本，仍能正常升级；历史版本缓存都保留", keysD.includes("suipian-v4") && keysD.includes("suipian-v2") && keysA.every((k) => keysD.includes(k)) && (await page.evaluate(() => window.__marker)) === "v4", keysD.join());

  // ===== 5. 网络很慢：不要让人干等，先用缓存 =====
  delayMs = 8000;
  const t0 = Date.now();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".statsbar", { timeout: 15000 });
  const took = Date.now() - t0;
  check("离线：网络很慢（每个响应要 8 秒）时先等 4 秒再改用缓存，页面照常打开（脚本和样式不会各等 4 秒累加）", took < 7000 && /文字与长度/.test(await text()), `${took}ms`);
  delayMs = 0;
  check("离线：整个过程没有脚本错误", errors.length === 0, errors.join(" | "));
  await page.close();

  // ===== 6. 减少动态效果：按下不位移，只有即时描边；不减少时仍是下移 1px =====
  await stop(); root = DIST; await start();
  for (const reduce of [true, false]) {
    const c2 = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: reduce ? "reduce" : "no-preference" });
    const p = await c2.newPage();
    await p.goto(BASE); await p.waitForSelector(".onboard");
    const b = p.locator(".btn3d.primary").first();
    const box = await b.boundingBox();
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down();
    await p.waitForTimeout(250); // 等按下的过渡动画走完
    const st = await b.evaluate((el) => { const c = getComputedStyle(el); return { transform: c.transform, outline: c.outlineStyle, w: c.outlineWidth }; });
    await p.mouse.move(5, 5); await p.mouse.up();
    if (reduce) check("减少动态效果：按钮按下时不位移，只有即时描边高亮", (st.transform === "none" || st.transform === "matrix(1, 0, 0, 1, 0, 0)") && st.outline === "solid" && parseFloat(st.w) >= 2, JSON.stringify(st));
    else check("没有开启减少动态效果：按钮按下仍下移 1px，没有描边", st.transform === "matrix(1, 0, 0, 1, 0, 1)" && st.outline === "none", JSON.stringify(st));
    await c2.close();
  }

  // ===== 7. 退出关卡：状态处理 =====
  {
    // 这一节只测“退出关卡”的状态，和前六组的离线／换版本无关：用全新的浏览器上下文，不继承前面留下的 Service Worker、缓存和本地存储
    // （2026-11-13：main 在这一节的真实刷新处出现过一次 30 秒 load 超时，原因未确认；隔离是 GPT1 提出的最小修复，断言一条没放宽）
    const ctx7 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    const pe = await ctx7.newPage();
    const eerrs = []; pe.on("pageerror", (e) => eerrs.push(e.message));
    const netFails = []; pe.on("requestfailed", (r) => netFails.push(`${r.url().replace(BASE, "/")} ${r.failure()?.errorText || ""}`));
    await pe.goto(BASE); await pe.waitForSelector(".statsbar, .onboard");
    await pe.evaluate(() => { window.__app.clearProgress(); const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, xp: 0, streak: 0, lastDay: null, lessonsCompleted: 0, done: {}, prefs: { ...s.prefs, sound: false } }); window.__app.setState(s); window.__app.persist(); window.__app.renderPath(); });
    const startL1 = async () => { await pe.locator('[data-lesson="U1L1"]').tap(); await pe.locator(".overlay .btn3d.primary").tap(); await pe.waitForSelector(".intro-title"); await pe.getByRole("button", { name: "继续", exact: true }).tap(); await pe.waitForSelector("[data-check]"); };
    const ans = async (correct) => { const e = await pe.evaluate(() => window.__app.currentEx); if (e.type === "predict") await pe.locator(".choice").nth(e.options.findIndex((o) => !!o.correct === correct)).tap(); else if (e.type === "fill") { const toks = correct ? e.answer : [e.tokens.find((t) => !e.answer.includes(t))]; for (const t of toks) await pe.locator(`[data-token=${JSON.stringify(t)}]`).tap(); } await pe.locator("[data-check]").tap(); await pe.waitForSelector(".feedbar"); await pe.locator("[data-continue]").tap(); await pe.waitForSelector("[data-check]"); };
    await startL1();
    await ans(true);   // 第 1 题对：+10 XP
    await ans(false);  // 第 2 题错：-1 红心，这题放到最后
    const mid = await pe.evaluate(() => { const r = window.__app.getRun(); return { q: r.queue.length, mistakes: r.mistakes, xp: window.__app.getState().xp, hearts: window.__app.getState().hearts }; });
    await pe.getByRole("button", { name: "退出本关" }).tap();
    check("退出关卡：确认框明确写“本关答题位置不会保存”，并说明 XP 和红心保留", /本关答题位置不会保存/.test(await pe.locator(".overlay").innerText()) && /已得的 XP 和已扣的红心会保留/.test(await pe.locator(".overlay").innerText()));
    await pe.getByRole("button", { name: "退出", exact: true }).tap(); await pe.waitForSelector(".pathview");
    const after = await pe.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts, done: s.done, lc: s.lessonsCompleted, streak: s.streak, run: window.__app.getRun() }; });
    check("退出关卡：已得 XP（+10）和已扣红心（-1）保留，关卡没有被记为完成，连续天数和完成次数不变", mid.xp === 10 && mid.hearts === 4 && after.xp === 10 && after.hearts === 4 && !after.done.U1L1 && after.lc === 0 && after.streak === 0 && after.run === null, JSON.stringify({ mid, after }));
    // 仍然是真实刷新；不等完整 load 事件（Pyodide 等大文件不属于这条断言），改为等页面文档加载完成 + 应用就绪 + 地图出现
    try { await pe.reload({ waitUntil: "domcontentloaded" }); await pe.waitForFunction(() => window.__app?.getState, null, { timeout: 15000 }); await pe.waitForSelector(".statsbar", { timeout: 15000 }); }
    catch (e) { throw new Error(`${e.message.split("\n")[0]} | 页面错误：${eerrs.join(";") || "无"} | 失败请求：${netFails.join(";") || "无"} | SW 接管：${await pe.evaluate(() => !!navigator.serviceWorker?.controller).catch(() => "读取失败")}`); }
    check("退出关卡：刷新后 XP 和红心仍是退出时的值", (await pe.evaluate(() => { const s = window.__app.getState(); return s.xp === 10 && s.hearts === 4 && !s.done.U1L1; })));
    await startL1();
    const re = await pe.evaluate(() => { const r = window.__app.getRun(); return { q: r.queue.join(), mistakes: r.mistakes, correct: r.correct, xp: r.xp, first: window.__app.currentEx.prompt }; });
    const l1 = JSON.parse(readFileSync(new URL("../content/unit1.json", import.meta.url))).lessons[0];
    check("退出关卡：重新进入从第 1 题开始，错题记录、答对数和本关 XP 都是全新的（不带上次的状态）", re.q === "0,1,2,3" && re.mistakes === 0 && re.correct === 0 && re.xp === 0 && re.first === l1.exercises[0].prompt, JSON.stringify(re));
    for (let i = 0; i < 3; i++) await ans(true);
    await pe.evaluate(() => {}); // 最后一题单独做，进入结算
    const e4 = await pe.evaluate(() => window.__app.currentEx); // 排序题
    for (const k of e4.answers[0]) await pe.locator(`.order-bank [data-line="${k}"]`).first().tap();
    await pe.locator("[data-check]").tap(); await pe.waitForSelector(".feedbar"); await pe.locator("[data-continue]").tap(); await pe.waitForSelector(".finish");
    const fin = await pe.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, done: !!s.done.U1L1, lc: s.lessonsCompleted, streak: s.streak, hearts: s.hearts }; });
    check("退出关卡：重新通关一次只算一次完成：XP = 之前的 10 + 4×10 + 通关 10 = 60，完成次数 1，连续天数 1，红心仍是 4", fin.xp === 60 && fin.done && fin.lc === 1 && fin.streak === 1 && fin.hearts === 4, JSON.stringify(fin));
    await pe.locator("[data-continue]").tap(); await pe.waitForSelector(".pathview");
    // 点“检查”后马上退出：延迟的反馈回调不会在别的页面上出错，也不会重复计分
    await pe.evaluate(() => { window.__app.clearProgress(); window.__app.renderPath(); });
    await startL1();
    const ex0 = await pe.evaluate(() => window.__app.currentEx);
    await pe.locator(".choice").nth(ex0.options.findIndex((o) => o.correct)).tap();
    await pe.locator("[data-check]").tap();
    await pe.getByRole("button", { name: "退出本关" }).tap(); await pe.getByRole("button", { name: "退出", exact: true }).tap();
    await pe.waitForTimeout(700);
    check("退出关卡：点“检查”后立刻退出，XP 只加一次（+10），回到地图，没有脚本错误", (await pe.evaluate(() => window.__app.getState().xp)) === 10 && (await pe.locator(".pathview").count()) === 1 && eerrs.length === 0, eerrs.join("|"));
    await pe.close(); await ctx7.close();
  }
} finally {
  await browser.close();
  try { await stop(); } catch { /* 已经停了 */ }
  rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
