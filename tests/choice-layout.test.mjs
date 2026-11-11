// D5（产品官 2026-11-11 18:07）选项排法验收：含代码或多行输出的题整组单列、保留换行和缩进、过长在选项内横滚；普通文字自然折行。
// 覆盖 U1L1（正式版）以及本分支有的 D1L1、U8L5、U8L2：代码不自动折行、多行输出边界清楚（每个选项独立卡片、渲染行数 = 源码行数）、
// 横滚不引起误选、选中状态和对错反馈正常、整页不横向溢出。390×450、390×844，MOBILE_BROWSER=webkit|chromium。
// 运行：npm run build && MOBILE_BROWSER=webkit node tests/choice-layout.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/"; // 验已发布的预览产物时：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/u67c/
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = 4397 + (BNAME === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${PFX}`;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
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


const ids = (f) => readJ(f).lessons.map((l) => l.id);
const course = readJ("course.json");
const MAIN = course.units.filter((u) => u.available && u.file).flatMap((u) => ids(u.file));
const HAS_SAMPLE = existsSync(join(ROOT, "content", "sample-debug.json"));
// 目标关和到达它要先完成的关（本分支没有的关跳过并打印出来）
const targets = [["U1L1"], ["U8L2"], ["U8L5"], ["D1L1"]].map(([id]) => id).filter((id) => {
  const ok = id.startsWith("D1") ? HAS_SAMPLE : MAIN.includes(id);
  if (!ok) console.log(`⏭️ ${id}：本分支没有这一关（正式版只有 U1L1；D1L1、U8L2、U8L5 在 #59 上验）`);
  return ok;
});
const before = (id) => id.startsWith("D1") ? MAIN.slice(0, MAIN.indexOf(MAIN.filter((x) => x.startsWith("U3")).at(-1)) + 1) : MAIN.slice(0, MAIN.indexOf(id));
const expectLayout = (ex) => ex.optionLayout || (ex.type === "predict" ? "code" : ex.type === "pick" ? (["line", "stdout", "fix"].includes(ex.key) ? "code" : "text") : null);

for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 450 }]) {
  const tag = `${BNAME} ${vp.width}×${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState);
  for (const id of targets) {
    await page.evaluate((d) => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; st.done = d; st.hearts = 5; window.__app.persist(); }, asDone(before(id)));
    await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
    await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
    await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
    const seen = new Set(); let optionQs = 0, overflowSeen = 0, n = 0;
    while (n++ < 16 && (await page.locator("[data-check]").count())) {
      const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
      const first = !seen.has(ex.prompt); seen.add(ex.prompt);
      await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
      const want = expectLayout(ex);
      if (want && first) {
        optionQs++;
        const q = `${tag} ${id}「${ex.prompt.slice(0, 16)}」`;
        const m = await page.evaluate(() => {
          const box = document.querySelector(".choices"), cs = [...box.querySelectorAll(".choice")], br = box.getBoundingClientRect();
          return { layout: box.dataset.layout, docWide: document.documentElement.scrollWidth > innerWidth + 1,
            singleCol: cs.every((c) => { const r = c.getBoundingClientRect(); return Math.abs(r.left - br.left) < 1.5 && Math.abs(r.width - br.width) < 1.5; }),
            stacked: cs.every((c, i) => i === 0 || c.getBoundingClientRect().top >= cs[i - 1].getBoundingClientRect().bottom - 0.5),
            opts: cs.map((c) => { const p = c.querySelector("pre"), sc = c.querySelector(".opt-scroll"), lh = parseFloat(getComputedStyle(p).lineHeight);
              return { ws: getComputedStyle(p).whiteSpace, lines: Math.round(p.getBoundingClientRect().height / lh), src: p.textContent.split("\n").length,
                inBox: c.getBoundingClientRect().right <= br.right + 0.5, overflow: !!sc && sc.scrollWidth > sc.clientWidth + 1, scrollable: !!sc && /(auto|scroll)/.test(getComputedStyle(sc).overflowX) }; }) };
        });
        if (want === "code") {
          check(`${q}：代码排法单列、上下排开`, m.layout === "code" && m.singleCol && m.stacked, JSON.stringify(m).slice(0, 300));
          check(`${q}：代码不自动折行（white-space: pre，渲染行数 = 源码行数）、多行输出各在自己的卡片里`, m.opts.every((o) => o.ws === "pre" && o.lines === o.src), JSON.stringify(m.opts));
          check(`${q}：长选项在卡片内横滚，卡片不超出、整页不横向溢出`, m.opts.every((o) => o.inBox && o.scrollable) && !m.docWide, JSON.stringify(m));
          const k = m.opts.findIndex((o) => o.overflow);
          if (k >= 0) {
            overflowSeen++;
            const el = page.locator(".choice").nth(k), sc = el.locator(".opt-scroll"); await sc.scrollIntoViewIfNeeded(); const b = await sc.boundingBox();
            await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await page.mouse.wheel(120, 0); await page.waitForTimeout(150);
            let left = await sc.evaluate((e) => e.scrollLeft);
            if (engine === chromium) { // 真实触摸横扫（CDP）：手指从右往左划
              await sc.evaluate((e) => { e.scrollLeft = 0; });
              const cdp = await ctx.newCDPSession(page), y = b.y + b.height / 2, pts = [b.x + b.width - 10, b.x + b.width - 60, b.x + b.width - 120, b.x + 20];
              await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: pts[0], y }] });
              for (const x of pts.slice(1)) { await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y }] }); await page.waitForTimeout(30); }
              await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await page.waitForTimeout(300);
              left = await sc.evaluate((e) => e.scrollLeft);
            }
            const sel = await page.locator(".choice.sel").count(), ready = await page.locator("[data-check]").isEnabled();
            check(`${q}：横滚长选项能看到后半段，且没有选中任何选项、「检查」仍不可点`, left > 0 && sel === 0 && !ready, `scrollLeft=${left} sel=${sel} ready=${ready}`);
          }
        } else {
          check(`${q}：文字排法（自然折行）`, m.layout === "text" && m.opts.every((o) => o.ws === "pre-wrap") && !m.docWide, JSON.stringify(m).slice(0, 300));
        }
        // 先选错：选中态、对错标记、反馈
        const wrongI = ex.options.findIndex((o) => !o.correct), rightI = ex.options.findIndex((o) => o.correct);
        await page.locator(".choice").nth(wrongI).click();
        const selOk = await page.evaluate((i) => [...document.querySelectorAll(".choice")].map((c, k) => c.classList.contains("sel") === (k === i)).every(Boolean), wrongI);
        await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]");
        const marks = await page.evaluate(([w, r]) => { const cs = document.querySelectorAll(".choice"); return cs[w].classList.contains("wrong") && cs[r].classList.contains("right") && !!document.querySelector(".feedbar")?.innerText.trim(); }, [wrongI, rightI]);
        check(`${q}：只选中点的那一个；检查后选错的标红、正确的标绿、有反馈`, selOk && marks);
        await page.locator("[data-continue]").click(); await page.waitForTimeout(120);
        continue;
      }
      if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).click();
      else if (ex.type === "fill") { for (const t of ex.answer) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
      else { for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
      await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]");
      if (ex.type === "predict" || ex.type === "pick") check(`${tag} ${id}「${ex.prompt.slice(0, 16)}」重做：选对后标绿`, await page.locator(".choice.right.sel, .choice.sel.right").count() === 1);
      await page.locator("[data-continue]").click(); await page.waitForTimeout(120);
    }
    await page.waitForSelector(".finish");
    check(`${tag} ${id}：通关（含 ${optionQs} 道选项题）`, optionQs > 0 && (await page.evaluate((i) => !!window.__app.getState().done[i], id)));
    if (id === "U8L5") check(`${tag} ${id}：至少有一道题的长选项需要横滚（横滚检查确实跑到了）`, overflowSeen > 0);
    await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  }
  check(`${tag} 无脚本错误`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} 通过，${fail} 失败`); process.exit(fail ? 1 : 0);
