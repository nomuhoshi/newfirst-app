// U9 小项目联合预览（候选，不合入正式版）：叠在 #59 上。390×844、390×450，WebKit / Chromium（MOBILE_BROWSER=webkit|chromium）。
// 验：U8 全部完成后 U9 逐关解锁；6 关 24 题每题先答错一次：解析读得全、「继续」可点；题目长代码不折行（整块横滚）、代码选项不折行；
//     L6 Q4（14 行完整程序）在 390×450 下代码能滚到最后一行；整页不横向溢出；刷新后完成数 58。
// 运行：npm run build && MOBILE_BROWSER=webkit node tests/joint-u9.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/"; // 验已发布的预览产物时：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/u67c/
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = 4399 + (BNAME === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${PFX}`;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const ids = (u) => readJ(`${u}.json`).lessons.map((l) => l.id);
const U1to7 = ["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7"].flatMap(ids), U1to3 = ["unit1", "unit2", "unit3"].flatMap(ids);
const U8 = ids("unit8"), U9 = ids("unit9");
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); if (!u.pathname.startsWith(PFX)) { s.writeHead(404); s.end(); return; } let p = join(DIST, decodeURIComponent(u.pathname.slice(PFX.length))); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = BNAME === "webkit" ? webkit : chromium;
let browser;
try { browser = await engine.launch(); } catch (e) { console.log(`环境失败：${BNAME} 起不来：${String(e.message).split("\n")[0]}`); srv.close(); process.exit(2); }
const asDone = (a) => Object.fromEntries(a.map((k) => [k, true]));


for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 450 }]) {
  const tag = `${BNAME} ${vp.width}×${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState);
  async function seed(done) {
    await page.evaluate((d) => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; st.done = { ...d }; st.hearts = 5; window.__app.persist(); }, done);
    await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  }
  const cls = (id) => page.evaluate((i) => document.querySelector(`[data-lesson="${i}"]`)?.className || "MISSING", id);
  const done = () => page.evaluate(() => window.__app.getState().done);
  const mapText = () => page.locator(".pathview").innerText();
  const doneStat = async () => { await page.getByRole("button", { name: "我的", exact: true }).click(); const t = await page.locator("main").innerText(); await page.getByRole("button", { name: "学习", exact: true }).click(); await page.waitForSelector(".pathview"); return (t.match(/(\d+)\/(\d+)\s*已完成关卡/) || [])[0] || t.slice(0, 200); };

  // 读得全：反馈区、代码块不自动折行（横向滚动保留缩进）、整页不横滚、「继续」可点
  async function probe() {
    return page.evaluate(() => {
      const vh = innerHeight, fb = document.querySelector(".feedbar"), c = document.querySelector("[data-continue]");
      const cr = c.getBoundingClientRect(), fr = fb.getBoundingClientRect();
      const top = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const ps = [...fb.querySelectorAll("p")]; const sc = fb.scrollHeight > fb.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(fb).overflowY);
      let readable;
      if (sc) { fb.scrollTop = 0; const a = ps[0]?.getBoundingClientRect(); fb.scrollTop = fb.scrollHeight; const l = ps[ps.length - 1]?.getBoundingClientRect(), f2 = fb.getBoundingClientRect(); readable = !!a && !!l && l.bottom <= f2.bottom + 1 && f2.top >= 0; fb.scrollTop = 0; }
      else readable = fr.top >= 0 && fr.bottom <= vh + 1 && fb.scrollHeight <= fb.clientHeight + 1;
      // 题目代码块：每行 white-space: pre、整块可横滚（不自动折行）；选项里的代码：渲染行数 = 源码行数（没有被折成两行）
      const cbs = [...document.querySelectorAll(".codeblock")];
      const cbOk = cbs.every((b) => /(auto|scroll)/.test(getComputedStyle(b).overflowX) && [...b.querySelectorAll(".cl")].every((l) => getComputedStyle(l).whiteSpace === "pre"));
      // 文字包围盒高度：原样式 vs 强制 white-space: pre；变矮了说明原样式下有行被折开
      const textH = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect().height; };
      const wrapped = [...document.querySelectorAll(".choices.code .choice pre")].filter((p) => { const h0 = textH(p), old = p.style.whiteSpace; p.style.whiteSpace = "pre"; const h1 = textH(p); p.style.whiteSpace = old; return h0 > h1 + 2; }).map((p) => p.textContent.slice(0, 40));
      const codeOk = cbOk && wrapped.length === 0; // D5=A：代码 / 多行输出选项不许折行（文字选项允许自然折行）
      return { text: fb.innerText.replace(/\s+/g, " ").trim().slice(0, 80), contInView: cr.top >= 0 && cr.bottom <= vh + 1 && cr.height >= 44, contOnTop: !!top && (top === c || c.contains(top)), readable, scrollable: sc, codeOk, cbOk, wrapped, docWide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
  }
  // 每道题第一次都故意答错，量一次反馈区，再按正确答案重做
  async function playViaMap(id) {
    await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
    await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
    await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
    let n = 0; const seen = new Set(), probes = [];
    while (n++ < 16 && (await page.locator("[data-check]").count())) {
      const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
      const wrong = !seen.has(ex.prompt); seen.add(ex.prompt);
      if (wrong) await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
      if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === !wrong)).click();
      else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
      else { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
      await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]"); await page.waitForTimeout(300);
      if (wrong) probes.push({ q: ex.prompt.slice(0, 24), type: ex.type, ...(await probe()) });
      await page.locator("[data-continue]").click(); await page.waitForTimeout(120);
    }
    await page.waitForSelector(".finish"); const ok = await page.evaluate((i) => !!window.__app.getState().done[i], id);
    await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
    return { ok, probes };
  }
  const probeChecks = (id, probes) => {
    const bad = probes.filter((p) => !(p.readable && p.contInView && p.contOnTop && p.codeOk && !p.docWide));
    check(`${tag} ${id}：${probes.length} 题答错后解析读得全、题目代码和代码选项都不折行（可横滚）、页面不横滚、「继续」可点`, probes.length > 0 && bad.length === 0, JSON.stringify(bad[0] || probes));
  };

  // ── U9 六关 ──
  await seed(asDone([...U1to7, ...U8]));
  check(`${tag} U9：U8 全部完成后 U9L1 是当前关，U9L2 锁定`, /current/.test(await cls("U9L1")) && /locked/.test(await cls("U9L2")));
  // 最长的题（14 行）：题目代码块每一行都能看到（块内可纵向 / 页面可滚到），且整块横滚不折行
  const longest = readJ("unit9.json").lessons.flatMap((l) => l.exercises.map((e, i) => ({ id: l.id, i, n: (e.code || "").split("\n").length }))).sort((a, b) => b.n - a.n)[0];
  for (const [i, id] of U9.entries()) {
    const r = await playViaMap(id);
    check(`${tag} ${id}：通关并记为已完成`, r.ok);
    probeChecks(id, r.probes);
    if (U9[i + 1]) check(`${tag} ${id} 通关后：${U9[i + 1]} 成为当前关`, /current/.test(await cls(U9[i + 1])), await cls(U9[i + 1]));
  }
  // 单独再看最长题：复习进入，翻到那一题，逐行可见
  check(`${tag} 最长题是 ${longest.id} 第 ${longest.i + 1} 题，${longest.n} 行`, longest.n >= 14, JSON.stringify(longest));
  await page.locator(`[data-lesson="${longest.id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${longest.id}"]`).click();
  await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
  let found = null;
  for (let n = 0; n < 8 && (await page.locator("[data-check]").count()); n++) {
    const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
    if ((ex.code || "").split("\n").length === longest.n && !found) {
      found = await page.evaluate(async () => {
        const cb = document.querySelector(".codeblock"), lines = [...cb.querySelectorAll(".cl")], out = [];
        for (const l of lines) { l.scrollIntoView({ block: "nearest" }); await new Promise((r) => requestAnimationFrame(r)); const r = l.getBoundingClientRect(); out.push(r.top >= 0 && r.bottom <= innerHeight + 1 && getComputedStyle(l).whiteSpace === "pre" && Math.round(r.height) <= 40); }
        const c = document.querySelector("[data-check]"); c.scrollIntoView({ block: "nearest" });
        return { lines: lines.length, allVisible: out.every(Boolean), oneRowEach: out.length, docWide: document.documentElement.scrollWidth > innerWidth + 1, cbScroll: /(auto|scroll)/.test(getComputedStyle(cb).overflowX) };
      });
    }
    if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).click();
    else if (ex.type === "fill") { for (const t of ex.answer) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
    else { for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
    await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]"); await page.locator("[data-continue]").click(); await page.waitForTimeout(120);
  }
  await page.waitForSelector(".finish"); await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  check(`${tag} ${longest.id} 第 ${longest.i + 1} 题（${longest.n} 行）：每一行都能滚到视口内、每行一行不折、代码块可横滚、整页不横滚`, !!found && found.lines === longest.n && found.allVisible && found.cbScroll && !found.docWide, JSON.stringify(found));
  await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  const d = await done();
  check(`${tag} 刷新后：U9 六关都已完成，主线完成数 58/58`, U9.every((x) => d[x]) && /58\/58/.test(await doneStat()), `${Object.keys(d).length} ${await doneStat()}`);
  check(`${tag} 无脚本错误`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} 通过，${fail} 失败`); process.exit(fail ? 1 : 0);
