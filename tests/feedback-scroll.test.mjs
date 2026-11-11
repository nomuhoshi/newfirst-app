// D6（产品官 2026-11-11 19:11 批准）反馈区：答错后显示长的正确答案时，反馈区内部滚动、「继续」贴底始终可操作。
// 覆盖正式版 U3L8（选输出 8–9 行、排序 8 行）、U5L7（填空长程序）、U1L1（普通短反馈）；390×450、390×844，以及 390×300（模拟键盘打开后可视区变矮）。
// 断言：答案可滚动读全；「继续」始终在视口内、没被盖住、能点（点了进入下一题）；滚到底时最后一行不被「继续」遮住；
//       在反馈区上滚动不带动背后题目区和整页（背景不误滚）；短反馈不出现内部滚动。MOBILE_BROWSER=webkit|chromium。
// 运行：npm run build && MOBILE_BROWSER=webkit node tests/feedback-scroll.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/"; // 验已发布的预览产物时：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/u67c/
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = 4401 + (BNAME === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${PFX}`;
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
const TARGETS = ["U1L1", "U3L8", "U5L7"];

for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 450 }, { width: 390, height: 300, kb: true }]) {
  const tag = `${BNAME} ${vp.width}×${vp.height}${vp.kb ? "（模拟键盘打开）" : ""}`;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState);
  let longSeen = 0, shortSeen = 0;
  for (const id of TARGETS) {
    await page.evaluate((d) => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; st.done = d; st.hearts = 5; window.__app.persist(); }, asDone(MAIN.slice(0, MAIN.indexOf(id))));
    await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
    await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
    await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
    const seen = new Set();
    for (let n = 0; n < 16 && (await page.locator("[data-check]").count()); n++) {
      const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
      const wrong = !seen.has(ex.prompt); seen.add(ex.prompt);
      await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
      if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === !wrong)).click();
      else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
      else { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
      await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]"); await page.waitForTimeout(400);
      if (wrong) {
        const q = `${tag} ${id}「${ex.prompt.slice(0, 14)}」(${ex.type})`;
        const m = await page.evaluate(() => {
          const fb = document.querySelector(".feedbar"), c = fb.querySelector("[data-continue]"), vh = innerHeight;
          const lesson = document.querySelector(".lesson"), ls0 = lesson ? lesson.scrollTop : 0;
          const scrollable = fb.scrollHeight > fb.clientHeight + 1;
          const contOk = () => { const r = c.getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return r.top >= 0 && r.bottom <= vh + 1 && r.height >= 44 && !!top && (top === c || c.contains(top)) && !c.disabled; };
          const atTop = contOk();
          fb.scrollTop = fb.scrollHeight;
          const fr = fb.getBoundingClientRect(), cr = c.getBoundingClientRect();
          const items = [...fb.children].filter((x) => x !== c);
          const last = items[items.length - 1].getBoundingClientRect();
          const ans = fb.querySelector(".fb-answer")?.getBoundingClientRect();
          const out = { scrollable, fbH: Math.round(fr.height), vh, atTop, atBottom: contOk(), lastClear: last.bottom <= cr.top + 1, ansReadable: !ans || (ans.top >= fr.top - 1 || scrollable), fbInView: fr.top >= 0 && fr.bottom <= vh + 1, fr: [Math.round(fr.top), Math.round(fr.bottom)], doc: document.documentElement.scrollHeight, ls0 };
          fb.scrollTop = 0; return out;
        });
        // 背景不误滚：在反馈区上滚轮，题目区和整页都不动
        const fbBox = await page.locator(".feedbar").boundingBox();
        await page.mouse.move(fbBox.x + fbBox.width / 2, fbBox.y + Math.min(fbBox.height / 2, 60)); await page.mouse.wheel(0, 800); await page.waitForTimeout(200);
        const bg = await page.evaluate((ls0) => ({ lesson: document.querySelector(".lesson")?.scrollTop ?? 0, win: scrollY, ls0, fbTop: document.querySelector(".feedbar").scrollTop }), m.ls0);
        if (m.scrollable) longSeen++; else shortSeen++;
        check(`${q}：反馈区在视口内（高 ${m.fbH}/${m.vh}${m.scrollable ? "，内部可滚" : ""}），「继续」顶部和滚到底时都可见可点`, m.fbInView && m.atTop && m.atBottom, JSON.stringify(m));
        check(`${q}：滚到底时最后一行不被「继续」遮住，正确答案读得全`, m.lastClear && m.ansReadable, JSON.stringify(m));
        check(`${q}：在反馈区上滚动，背后题目区和整页不动${m.scrollable ? "（反馈区自己滚）" : ""}`, bg.lesson === bg.ls0 && bg.win === 0 && (!m.scrollable || bg.fbTop > 0), JSON.stringify(bg));
      }
      const before = await page.evaluate(() => window.__app.currentEx.prompt);
      await page.locator("[data-continue]").click(); await page.waitForTimeout(150);
      if (wrong) check(`${tag} ${id}：点「继续」后进入下一题`, (await page.locator(".finish").count()) > 0 || (await page.evaluate(() => window.__app.currentEx.prompt)) !== before || (await page.locator("[data-check]").count()) > 0);
    }
    await page.waitForSelector(".finish"); await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  }
  check(`${tag} 覆盖到${vp.height >= 800 ? "短反馈（不出现内部滚动）" : "长反馈（内部滚动）"}`, vp.height >= 800 ? shortSeen > 0 : longSeen > 0, `long=${longSeen} short=${shortSeen}`);
  check(`${tag} 无脚本错误`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} 通过，${fail} 失败`); process.exit(fail ? 1 : 0);
