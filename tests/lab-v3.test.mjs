// “编程实验室”第三版预览的自动测试（用 LAB=1 构建的 dist-lab/；先运行 npm run build:lab）。
// 覆盖：预览和正式版的存储/缓存隔离、地图三种状态与铜线、答题页三块分区、底部固定栏、按压反馈、对错提示、返回地图、深浅两套配色的文字对比度。
// 桌面 Chromium 的手机模拟，不能代替 iPhone 真机。截图写到 SHOTS_DIR（没设就不存）。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist-lab", import.meta.url).pathname);
const PORT = 4371, BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist-lab，先运行 npm run build:lab"); process.exit(2); }
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE); let p = join(DIST, decodeURIComponent(url.pathname));
  if (!p.startsWith(DIST)) { resp.writeHead(403).end(); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { resp.writeHead(404).end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }).end(readFileSync(p));
});
await new Promise((r) => srv.listen(PORT, r));

let browser;
try { browser = await chromium.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.close(); process.exit(2); }

// 在页面里算文字和背景的对比度（背景透明就往上找父元素）
const contrastOf = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s); if (!el) return null;
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
  const lum = ({ r, g, b }) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  let bg = null; for (let n = el; n && !bg; n = n.parentElement) { const c = parse(getComputedStyle(n).backgroundColor); if (c && c.a > 0.99) bg = c; }
  const fg = parse(getComputedStyle(el).color); if (!fg || !bg) return null;
  const [a, b] = [lum(fg), lum(bg)].sort((x, y) => y - x); return Math.round(((a + 0.05) / (b + 0.05)) * 100) / 100;
}, sel);

for (const scheme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, colorScheme: scheme, serviceWorkers: "block",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `lab3-${scheme}-${name}.png`) }); };
  const T = `[${scheme}]`;
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; st.done = { U1L1: true }; st.xp = 40; window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector(".pathview .path-item");

    // ---- 隔离 ----
    check(`${T} 预览标记：body 有 lab3，页面里有“实验室预览”提示（在页面流里，不是浮层）`, await page.evaluate(() => document.body.classList.contains("lab3") && !!document.querySelector(".lab-tag") && getComputedStyle(document.querySelector(".lab-tag")).position === "static"));
    const keys = await page.evaluate(() => { const f = document.createElement("iframe"); document.body.append(f); const ls = f.contentWindow.localStorage; const ks = []; for (let i = 0; i < ls.length; i++) ks.push(ls.key(i)); f.remove(); return ks; });
    check(`${T} 存储隔离：真实 localStorage 里只有 lab3: 前缀的键，没有正式版的 suipian.* 键`, keys.length > 0 && keys.every((k) => k.startsWith("lab3:")) && keys.some((k) => k === "lab3:suipian.progress"), keys.join(","));

    // ---- 地图 ----
    const rows = await page.evaluate(() => [...document.querySelectorAll(".unit:not(.locked) .path-item")].slice(0, 6).map((li) => {
      const r = li.getBoundingClientRect(), cs = getComputedStyle(li), b = getComputedStyle(li, "::before"), a = getComputedStyle(li, "::after");
      return { cls: li.className, h: Math.round(r.height), border: cs.borderTopColor, bw: cs.borderTopWidth, sub: li.querySelector(".row-sub")?.textContent || "", beforeBg: b.backgroundColor, beforeImg: b.backgroundImage, afterBg: a.backgroundColor, afterImg: a.backgroundImage, beforeDisp: b.display };
    }));
    const done = rows.find((r) => r.cls.includes("st-done")), cur = rows.find((r) => r.cls.includes("st-current")), locked = rows.filter((r) => r.cls.includes("st-locked"));
    check(`${T} 地图：同时有 已完成/当前/未解锁 三种行，且当前只有一个`, !!done && !!cur && locked.length >= 1 && rows.filter((r) => r.cls.includes("st-current")).length === 1);
    check(`${T} 地图：每行用文字写明状态（已完成 / 当前 / 未解锁），不只靠颜色`, done?.sub.startsWith("已完成") && cur?.sub.startsWith("当前") && locked.every((r) => r.sub.startsWith("未解锁")));
    check(`${T} 地图：当前行最醒目——最高、带 2px 铜边框`, cur && rows.every((r) => r === cur || cur.h > r.h) && cur.bw === "2px" && cur.border !== "rgba(0, 0, 0, 0)");
    check(`${T} 地图：铜线——已完成行是实线，未解锁行是虚线（渐变），第一行上半段不画`, done && done.afterBg !== "rgba(0, 0, 0, 0)" && locked[0].beforeImg.includes("gradient") && rows[0].beforeDisp === "none", `${done?.afterBg} / ${locked[0]?.beforeImg?.slice(0, 40)}`);
    check(`${T} 地图：当前行有可点的“开始”，整行节点点得到（≥44px）`, await page.evaluate(() => { const n = document.querySelector(".path-item.st-current .node").getBoundingClientRect(), b = document.querySelector(".path-item.st-current .bubble").getBoundingClientRect(); return n.width >= 44 && n.height >= 44 && b.height >= 32; }));
    const cMap = [await contrastOf(page, ".path-item.st-current .node-label"), await contrastOf(page, ".path-item.st-locked .row-sub"), await contrastOf(page, ".path-item.st-done .row-sub"), await contrastOf(page, ".path-item.st-current .bubble")];
    check(`${T} 地图：主要文字对比度 ≥ 4.5`, cMap.every((c) => c !== null && c >= 4.5), cMap.join("/"));
    check(`${T} 地图：无横向滚动`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    await shot("1-map");

    // ---- 进题（U1L2 第一题是“选输出”）----
    await page.locator(".path-item.st-current .node").tap();
    await page.locator(".overlay .btn3d.primary").tap(); await page.waitForSelector(".intro-title");
    await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]");
    const ex = await page.evaluate(() => window.__app.currentEx);
    check(`${T} 进入的是“选输出”题`, ex.type === "predict");
    const lay = await page.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const q = r(".q"), c = r(".codeblock"), o = r(".choices"), f = r(".lessonfoot"); return { q, c, o, f, vh: window.innerHeight, foot: f && { top: f.top, bottom: f.bottom }, checkH: r("[data-check]")?.height, checkBottom: r("[data-check]")?.bottom, qLabel: getComputedStyle(document.querySelector(".q"), "::before").content, cLabel: getComputedStyle(document.querySelector(".codeblock"), "::before").content, oLabel: getComputedStyle(document.querySelector(".choices"), "::before").content, optBefore: getComputedStyle(document.querySelector(".choice"), "::before").content }; });
    check(`${T} 答题页：题干、代码、选项三块自上而下分开，各有小标签`, lay.q.bottom <= lay.c.top + 1 && lay.c.bottom <= lay.o.top + 1 && /题干/.test(lay.qLabel) && /代码/.test(lay.cLabel) && /选项/.test(lay.oLabel) && /counter\(opt/.test(lay.optBefore));
    check(`${T} 答题页：底部栏固定在屏幕底部、检查按钮 ≥ 48px 高、按钮离屏幕底 ≥ 60px（Safari 工具栏）`, Math.abs(lay.f.bottom - lay.vh) <= 1 && lay.checkH >= 48 && lay.vh - lay.checkBottom >= 60, `bottom=${lay.f.bottom}/${lay.vh} h=${lay.checkH}`);
    check(`${T} 答题页：选项点得到（每个 ≥ 48px 高）`, await page.evaluate(() => [...document.querySelectorAll(".choice")].every((x) => x.getBoundingClientRect().height >= 48)));
    check(`${T} 答题页：没选之前“检查”不可点`, await page.locator("[data-check]").isDisabled());
    const cQ = [await contrastOf(page, ".q"), await contrastOf(page, ".choice pre"), await contrastOf(page, ".codeblock")];
    check(`${T} 答题页：文字对比度 ≥ 4.5`, cQ.every((c) => c !== null && c >= 4.5), cQ.join("/"));
    await shot("2-question");

    const correctIdx = ex.options.findIndex((o) => o.correct), wrongIdx = ex.options.findIndex((o) => !o.correct);
    await page.locator(".choice").nth(wrongIdx).tap(); await page.waitForTimeout(250); // 等边框颜色过渡结束
    check(`${T} 选中后：检查可点，选项有铜色选中态`, !(await page.locator("[data-check]").isDisabled()) && await page.evaluate(() => getComputedStyle(document.querySelector(".choice.sel")).borderTopColor !== getComputedStyle(document.querySelector(".choice:not(.sel)")).borderTopColor));
    // 按压反馈：按住时按钮缩小
    const box = await page.locator("[data-check]").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    let pressed = "none"; for (let i = 0; i < 10 && (pressed === "none" || pressed === "matrix(1, 0, 0, 1, 0, 0)"); i++) { await page.waitForTimeout(100); pressed = await page.evaluate(() => getComputedStyle(document.querySelector("[data-check]")).transform); } // 轮询：等 :active 和 transform 过渡
    await page.mouse.move(box.x + box.width / 2, box.y - 60); await page.mouse.up(); // 先移出按钮再松开，不触发点击
    check(`${T} 按压反馈：按住“检查”时按钮变形（缩小）`, pressed !== "none" && pressed !== "matrix(1, 0, 0, 1, 0, 0)", pressed);
    await shot("3-selected");

    // ---- 答错 ----
    const heartsBefore = await page.evaluate(() => window.__app.getState().hearts), xpBefore = await page.evaluate(() => window.__app.getState().xp);
    await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
    const bad = await page.evaluate(() => ({ cls: document.querySelector(".feedbar").className, text: document.querySelector(".feedbar").innerText, ans: document.querySelector(".fb-answer")?.innerText || "", st: window.__app.getState() }));
    check(`${T} 答错：写“不对哦”、说明原因、给出正确答案、说明红心和稍后重做`, bad.cls.includes("bad") && /不对哦/.test(bad.text) && bad.ans.includes(ex.options[correctIdx].text.split("\n")[0]) && /稍后再做一次/.test(bad.text));
    check(`${T} 答错：扣 1 颗红心、XP 不变（规则没动）`, bad.st.hearts === heartsBefore - 1 && bad.st.xp === xpBefore, `${heartsBefore}→${bad.st.hearts}`);
    const cFb = [await contrastOf(page, ".feedbar .fb-head b"), await contrastOf(page, ".feedbar p"), await contrastOf(page, "[data-continue]")];
    check(`${T} 答错：反馈文字和“继续”按钮对比度 ≥ 4.5`, cFb.every((c) => c !== null && c >= 4.5), cFb.join("/"));
    const vis = await page.evaluate(() => { const fb = document.querySelector(".feedbar").getBoundingClientRect(); return { fbTop: fb.top, chBottoms: [...document.querySelectorAll(".choice")].map((c) => Math.round(c.getBoundingClientRect().bottom)), contBottom: document.querySelector("[data-continue]").getBoundingClientRect().bottom, vh: window.innerHeight, ios: document.documentElement.classList.contains("ios-browser") || document.body.classList.contains("ios-browser") || !!document.querySelector(".ios-browser") }; });
    check(`${T} 答错：反馈栏没有挡住任何选项（三个选项都在反馈栏上方）`, vis.chBottoms.every((b) => b <= vis.fbTop + 1), `${vis.chBottoms.join(",")} < ${Math.round(vis.fbTop)}`);
    check(`${T} 答错：“继续”按钮离屏幕底部 ≥ 60px（让出 Safari 工具栏的位置）`, vis.vh - vis.contBottom >= 60, `${Math.round(vis.vh - vis.contBottom)}px`);
    await shot("4-wrong");
    await page.locator("[data-continue]").tap(); await page.waitForSelector("[data-check]");

    // ---- 答对（下一题可能是别的题型，所以用现有逻辑：predict 直接选对；其他题型用 hint 之外的方式不做，改看第二道 predict）----
    let ex2 = await page.evaluate(() => window.__app.currentEx);
    check(`${T} 点“继续”后进入下一题（答题页重新出现）`, !!ex2);
    if (ex2.type === "predict") {
      const ci = ex2.options.findIndex((o) => o.correct); await page.locator(".choice").nth(ci).tap();
      const xp0 = await page.evaluate(() => window.__app.getState().xp);
      await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
      const ok = await page.evaluate(() => ({ cls: document.querySelector(".feedbar").className, text: document.querySelector(".feedbar").innerText, xp: window.__app.getState().xp }));
      check(`${T} 答对：写“答对了！”、显示 +XP，并告诉你下一步点“继续”`, ok.cls.includes("ok") && /答对了/.test(ok.text) && /\+10 XP/.test(ok.text) && /点“继续”做下一题/.test(ok.text) && ok.xp === xp0 + 10);
      await shot("5-correct");
      await page.locator("[data-continue]").tap(); await page.waitForSelector("[data-check]");
    } else { check(`${T} 答对：第二题不是选输出，答对检查改由第 1 题的反馈区块覆盖`, true); }

    // ---- 回到地图 ----
    await page.getByRole("button", { name: "退出本关" }).tap();
    await page.getByRole("button", { name: "退出", exact: true }).tap(); await page.waitForSelector(".pathview .path-item");
    check(`${T} 回到地图：铜线地图重新出现，当前关仍是 U1L2，进度保留`, await page.evaluate(() => document.querySelector(".path-item.st-current .node")?.dataset.lesson === "U1L2" && !!document.querySelector(".path-item.st-done")));
    await shot("6-back-to-map");
    const before = await page.evaluate(() => { const st = window.__app.getState(); return { xp: st.xp, hearts: st.hearts }; });
    await page.reload(); await page.waitForSelector(".pathview .path-item.st-current");
    const after = await page.evaluate(() => { const st = window.__app.getState(); return { xp: st.xp, hearts: st.hearts, cur: document.querySelector(".path-item.st-current .node")?.dataset.lesson, lab: document.body.classList.contains("lab3") }; });
    check(`${T} 刷新后继续可用：XP ${before.xp}、红心 ${before.hearts} 还在，当前关仍是 U1L2，仍是预览样式`, after.xp === before.xp && after.hearts === before.hearts && after.cur === "U1L2" && after.lab, JSON.stringify(after));
    check(`${T} 全程没有页面脚本错误`, errors.length === 0, errors.join(" | "));
  } catch (e) {
    check(`${T} 场景异常`, false, String(e.message).split("\n").slice(0, 3).join(" ")); await shot("error").catch(() => {});
  }
  await ctx.close();
}
{ // ---- 离线缓存隔离：预览的 Service Worker 只建 lab3-suipian- 前缀的缓存，不动正式版的 suipian- 缓存 ----
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "allow" });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "manifest.webmanifest"); // 同源但不是应用页，不会注册 SW：先放一个“正式版”的假缓存
    await page.evaluate(async () => { await (await caches.open("suipian-prod-decoy")).put("/x", new Response("prod")); });
    await page.goto(BASE); await page.waitForSelector(".statsbar, .onboard");
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 30000 });
    await page.waitForFunction(async () => (await caches.keys()).some((k) => k.startsWith("lab3-suipian-")), null, { timeout: 20000 });
    await page.waitForTimeout(1500);
    const keys = await page.evaluate(() => caches.keys());
    check("离线缓存隔离：预览只建了 lab3-suipian-* 缓存，没有新增 suipian-* 缓存", keys.some((k) => k.startsWith("lab3-suipian-")) && keys.filter((k) => k.startsWith("suipian-")).every((k) => k === "suipian-prod-decoy"), keys.join(","));
    check("离线缓存隔离：正式版的 suipian- 缓存（这里用假的代替）没有被预览的 SW 清理掉", keys.includes("suipian-prod-decoy"));
    check("离线缓存隔离：SW 的缓存清理前缀是 lab3-suipian-，不是 suipian-", (await page.evaluate(async () => (await (await fetch("./sw.js")).text()).includes('const PREFIX = "lab3-suipian-"'))));
  } catch (e) { check("离线缓存隔离：场景异常", false, String(e.message).split("\n")[0]); }
  await ctx.close();
}
await browser.close(); srv.close();
const bad = results.filter((x) => !x).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
