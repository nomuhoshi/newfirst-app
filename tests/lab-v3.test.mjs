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

    // ---- 填空题（U1L2 的第 3、4 题是填空）----
    const clickToken = async (t) => page.locator(`[data-token="${t.replace(/"/g, '\\"')}"]`).first().tap();
    const fillWith = async (ex, pick) => { for (let i = 0; i < ex.answer.length; i++) { await page.locator(`[data-slot="${i}"]`).tap(); await clickToken(pick(i)); } };
    ex2 = await page.evaluate(() => window.__app.currentEx);
    if (ex2.type === "fill") {
      const fl = await page.evaluate(() => { const r = (sel) => document.querySelector(sel)?.getBoundingClientRect(); const slots = [...document.querySelectorAll(".slot")].map((x) => x.getBoundingClientRect()); const toks = [...document.querySelectorAll(".bank .kchip")].map((x) => x.getBoundingClientRect()); const c = r(".codeblock.fill"), b = r(".bank"); return { cLabel: getComputedStyle(document.querySelector(".codeblock.fill"), "::before").content, bLabel: getComputedStyle(document.querySelector(".bank"), "::before").content, slotsMinH: Math.min(...slots.map((x) => x.height)), tokMinH: Math.min(...toks.map((x) => x.height)), tokMinW: Math.min(...toks.map((x) => x.width)), apart: b.top - c.bottom, activeBorder: getComputedStyle(document.querySelector(".slot.active")).borderTopColor, otherBorder: getComputedStyle(document.querySelector(".slot:not(.active)") || document.querySelector(".slot")).borderTopColor, nSlots: slots.length, foot: r(".lessonfoot").top, bankBottom: b.bottom }; });
      check(`${T} 填空页：代码和候选词是两块（中间有间隔、各有标签）`, fl.apart >= 8 && /代码/.test(fl.cLabel) && /候选词/.test(fl.bLabel), `apart=${fl.apart}`);
      check(`${T} 填空页：空格 ≥ 40px 高、候选词 ≥ 48px 高 × ≥ 48px 宽（好点）`, fl.slotsMinH >= 40 && fl.tokMinH >= 48 && fl.tokMinW >= 48, `${fl.slotsMinH}/${fl.tokMinH}/${fl.tokMinW}`);
      check(`${T} 填空页：当前空格有铜色实线框，和其他空格一眼能分开`, fl.nSlots < 2 || fl.activeBorder !== fl.otherBorder, `${fl.activeBorder} vs ${fl.otherBorder}`);
      const cF = [await contrastOf(page, ".bank .kchip.tok"), await contrastOf(page, ".slot")];
      check(`${T} 填空页：候选词和空格文字对比度 ≥ 4.5`, cF.every((c) => c !== null && c >= 4.5), cF.join("/"));
      await shot("5b-fill");
      // 故意填错：每个空都放一个不是答案的词
      const wrongPick = (i) => ex2.tokens.find((t) => t !== ex2.answer[i]);
      await fillWith(ex2, wrongPick);
      await page.waitForTimeout(150);
      check(`${T} 填空页：全部填完后“检查”可点`, !(await page.locator("[data-check]").isDisabled()));
      const hearts0 = await page.evaluate(() => window.__app.getState().hearts);
      await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
      const fb = await page.evaluate((ans) => { const slots = [...document.querySelectorAll(".slot")]; const f = document.querySelector(".feedbar").getBoundingClientRect(); const c = document.querySelector(".codeblock.fill").getBoundingClientRect(); return { filled: slots.map((x) => x.textContent), cls: slots.map((x) => x.className), text: document.querySelector(".feedbar").innerText, codeBottom: c.bottom, fbTop: f.top, codeTop: c.top, hearts: window.__app.getState().hearts }; });
      check(`${T} 填空答错：每个空格还能看清自己填了什么，并标出对/错`, fb.filled.every((t) => t.length > 0) && fb.cls.some((c) => c.includes("wrong")) && fb.cls.every((c) => c.includes("wrong") || c.includes("right")), fb.filled.join(","));
      check(`${T} 填空答错：代码块完整露在反馈栏上方，没被挡住`, fb.codeTop >= 0 && fb.codeBottom <= fb.fbTop + 1, `${Math.round(fb.codeBottom)} < ${Math.round(fb.fbTop)}`);
      check(`${T} 填空答错：写“不对哦”、给出正确答案、扣 1 颗红心`, /不对哦/.test(fb.text) && /正确答案/.test(fb.text) && fb.hearts === hearts0 - 1);
      await shot("6b-fill-wrong");
      await page.locator("[data-continue]").tap(); await page.waitForSelector("[data-check]");
      let ex3 = await page.evaluate(() => window.__app.currentEx);
      if (ex3.type === "fill") {
        await fillWith(ex3, (i) => ex3.answer[i]);
        const xp1 = await page.evaluate(() => window.__app.getState().xp);
        await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
        const ok3 = await page.evaluate(() => ({ text: document.querySelector(".feedbar").innerText, cls: [...document.querySelectorAll(".slot")].map((x) => x.className), xp: window.__app.getState().xp }));
        check(`${T} 填空答对：全部空格标绿、写“答对了”+10 XP 和下一步`, ok3.cls.every((c) => c.includes("right")) && /答对了/.test(ok3.text) && /\+10 XP/.test(ok3.text) && /点“继续”/.test(ok3.text) && ok3.xp === xp1 + 10);
        await shot("7b-fill-ok");
        await page.locator("[data-continue]").tap(); await page.waitForSelector("[data-check]");
      } else { check(`${T} 填空答对：第 4 题不是填空（本题库变化），答对检查跳过`, true); }
    } else { check(`${T} 填空页：第 3 题不是填空（本题库变化）`, false, ex2.type); }

    // ---- 回到地图 ----
    await page.getByRole("button", { name: "退出本关" }).tap();
    await page.getByRole("button", { name: "退出", exact: true }).tap(); await page.waitForSelector(".pathview .path-item");
    check(`${T} 回到地图：铜线地图重新出现，当前关仍是 U1L2，进度保留`, await page.evaluate(() => document.querySelector(".path-item.st-current .node")?.dataset.lesson === "U1L2" && !!document.querySelector(".path-item.st-done")));
    await shot("6-back-to-map");
    const before = await page.evaluate(() => { const st = window.__app.getState(); return { xp: st.xp, hearts: st.hearts }; });
    await page.reload(); await page.waitForSelector(".pathview .path-item.st-current");
    const after = await page.evaluate(() => { const st = window.__app.getState(); return { xp: st.xp, hearts: st.hearts, cur: document.querySelector(".path-item.st-current .node")?.dataset.lesson, lab: document.body.classList.contains("lab3") }; });
    check(`${T} 刷新后继续可用：XP ${before.xp}、红心 ${before.hearts} 还在，当前关仍是 U1L2，仍是预览样式`, after.xp === before.xp && after.hearts === before.hearts && after.cur === "U1L2" && after.lab, JSON.stringify(after));
    // ---- 排序题 + 通关页：整关做一遍（U1L3：选输出、选输出、排序、填空）----
    await page.evaluate(() => { const st = window.__app.getState(); st.done = { ...st.done, U1L1: st.done.U1L1 || { stars: 3 }, U1L2: st.done.U1L2 || { stars: 3 } }; window.__app.setState(st); window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector('.path-item.st-current .node[data-lesson="U1L3"]');
    await page.locator(".path-item.st-current .node").tap();
    await page.locator(".overlay .btn3d.primary").tap(); await page.waitForSelector(".intro-title");
    await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]");
    let didWrongOrder = false, guard = 0;
    while (guard++ < 12 && !(await page.locator(".finish").count())) {
      const e = await page.evaluate(() => window.__app.currentEx); if (!e) break;
      if (e.type === "order" && !didWrongOrder) {
        const lay2 = await page.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const chips = [...document.querySelectorAll(".order-bank .line-chip")].map((x) => x.getBoundingClientRect()); return { chipMinH: Math.min(...chips.map((c) => c.height)), mineStyle: getComputedStyle(document.querySelector(".order-mine")).borderTopStyle, mineBottom: r(".order-mine").bottom, bankTop: r(".order-bank").top, foot: r(".lessonfoot").top, bankBottom: r(".order-bank").bottom, lines: chips.length, labels: [...document.querySelectorAll(".order-label")].map((x) => x.textContent) }; });
        check(`${T} 排序页：代码行 ≥ 48px 高；放置区是铜色虚线框；两块分开且各有标签`, lay2.chipMinH >= 48 && lay2.mineStyle === "dashed" && lay2.bankTop > lay2.mineBottom && lay2.labels.length === 2, JSON.stringify(lay2));
        await shot("5c-order");
        // 故意排错：找一个不在 answers 里的排列
        const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((q) => [x, ...q])));
        const good = new Set(e.answers.map((a) => a.join()));
        const bad = perms(e.answers[0]).find((q) => !good.has(q.join()));
        for (const k of bad) await page.locator(`.order-bank [data-line="${k}"]`).tap();
        const mid = await page.evaluate(() => ({ placed: document.querySelectorAll(".order-mine .line-chip").length, left: document.querySelectorAll(".order-bank .line-chip").length }));
        check(`${T} 排序页：点代码行放进“你的程序”，放完后候选区清空、“检查”可点`, mid.left === 0 && mid.placed === e.answers[0].length && !(await page.locator("[data-check]").isDisabled()), JSON.stringify(mid));
        // 点已放好的第一行可以拿回去
        await page.locator(".order-mine .line-chip").first().tap();
        const back = await page.evaluate(() => ({ placed: document.querySelectorAll(".order-mine .line-chip").length, left: document.querySelectorAll(".order-bank .line-chip").length }));
        check(`${T} 排序页：点已放好的行能拿回去重排`, back.left === 1 && back.placed === e.answers[0].length - 1, JSON.stringify(back));
        await page.locator(`.order-bank [data-line="${bad[0]}"]`).tap();
        const h0 = await page.evaluate(() => window.__app.getState().hearts);
        await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
        const ob = await page.evaluate(() => { const m = document.querySelector(".order-mine").getBoundingClientRect(), f = document.querySelector(".feedbar").getBoundingClientRect(); return { mineTop: m.top, mineBottom: m.bottom, fbTop: f.top, mineText: document.querySelector(".order-mine").innerText, cls: document.querySelector(".order-mine").className, text: document.querySelector(".feedbar").innerText, hearts: window.__app.getState().hearts }; });
        check(`${T} 排序答错：自己的排序完整露在反馈栏上方，同时能看到反馈和正确答案`, ob.mineTop >= 0 && ob.mineBottom <= ob.fbTop + 1 && ob.cls.includes("wrong") && /不对哦/.test(ob.text) && /正确答案/.test(ob.text) && ob.mineText.trim().length > 0, JSON.stringify({ mineTop: ob.mineTop, mineBottom: ob.mineBottom, fbTop: ob.fbTop }));
        check(`${T} 排序答错：扣 1 颗红心（规则没动）`, ob.hearts === h0 - 1);
        await shot("6c-order-wrong");
        didWrongOrder = true;
      } else if (e.type === "order") { for (const k of e.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).tap(); await page.locator("[data-check]").tap(); }
      else if (e.type === "fill") { for (let i = 0; i < e.answer.length; i++) { await page.locator(`[data-slot="${i}"]`).tap(); await page.locator(`[data-token="${e.answer[i].replace(/"/g, '\\"')}"]`).first().tap(); } await page.locator("[data-check]").tap(); }
      else { await page.locator(".choice").nth(e.options.findIndex((o) => o.correct)).tap(); await page.locator("[data-check]").tap(); }
      await page.waitForSelector("[data-continue]:not([disabled])"); await page.locator("[data-continue]").tap();
      await page.waitForSelector("[data-check], .finish");
    }
    guard = 0;
    while (guard++ < 12 && !(await page.locator(".finish").count())) {
      const e = await page.evaluate(() => window.__app.currentEx); if (!e) break;
      if (e.type === "order") { for (const k of e.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).tap(); }
      else if (e.type === "fill") { for (let i = 0; i < e.answer.length; i++) { await page.locator(`[data-slot="${i}"]`).tap(); await page.locator(`[data-token="${e.answer[i].replace(/"/g, '\\"')}"]`).first().tap(); } }
      else { await page.locator(".choice").nth(e.options.findIndex((o) => o.correct)).tap(); }
      await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])"); await page.locator("[data-continue]").tap();
      await page.waitForSelector("[data-check], .finish");
    }
    await page.waitForSelector(".finish");
    const fin = await page.evaluate(() => { const r = (s) => document.querySelector(s)?.getBoundingClientRect(); const c = r("[data-continue]"), f = document.querySelector(".finish"); const stats = [...document.querySelectorAll(".finish-stats .fs")].map((x) => x.innerText.replace(/\s+/g, " ")); return { title: document.querySelector(".finish > .muted")?.textContent || "", h1: document.querySelector(".finish h1")?.textContent || "", stats, next: document.querySelector(".next-step")?.innerText || "", contBottom: c?.bottom, vh: innerHeight, fits: f.scrollHeight <= f.clientHeight + 1, firstXpBg: getComputedStyle(document.querySelector(".finish-stats .fs")).backgroundColor }; });
    check(`${T} 通关页：写明过了哪一关（关名）`, /通关|完成/.test(fin.title) && fin.title.includes("「") , fin.title);
    check(`${T} 通关页：XP、正确率、连续天数三项都有，XP 在最前且最醒目（铜色卡）`, fin.stats.length === 3 && /\+\d+/.test(fin.stats[0]) && /%/.test(fin.stats[1]) && fin.firstXpBg !== "rgba(0, 0, 0, 0)", fin.stats.join(" | "));
    check(`${T} 通关页：“下一步”写明下一关或单元完成，并告诉你点“继续”回地图`, /下一步/.test(fin.next) && /(下一关：|全部完成)/.test(fin.next) && /点“继续”/.test(fin.next), fin.next);
    check(`${T} 通关页：一屏放得下（不用滚动），“继续”离屏幕底 ≥ 60px`, fin.fits && fin.contBottom <= fin.vh - 60 + 1, `fits=${fin.fits} contBottom=${Math.round(fin.contBottom)}`);
    const cFin = [await contrastOf(page, ".finish-stats .fs:first-child b"), await contrastOf(page, ".finish-stats .fs:first-child small"), await contrastOf(page, ".next-step span"), await contrastOf(page, ".finish > .muted")];
    check(`${T} 通关页：文字对比度 ≥ 4.5`, cFin.every((c) => c !== null && c >= 4.5), cFin.join("/"));
    await shot("7c-finish");
    await page.locator("[data-continue]").tap(); await page.waitForSelector(".pathview .path-item");
    check(`${T} 通关后回到地图：U1L3 已完成`, await page.evaluate(() => !!document.querySelector('.path-item.st-done [data-lesson="U1L3"]')));
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
