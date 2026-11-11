// U6 + U7 联合分支：窄屏（390×844、390×450）通关回归，WebKit / Chromium 都跑（MOBILE_BROWSER=webkit|chromium，缺省 chromium）。
// 验三件事：
//  1 长解析可操作：U6L3、U6L6 第 1 题故意答错，解析区在视口内可读全（过长时可滚动到底），「继续」完整在视口内且没被盖住、可点击。
//  2 跨单元解锁：U6L6 通关后 U7L1 变成当前关，U7L2 仍锁定。
//  3 完成记录：打通 U7L1 后 U7L2 解锁，刷新后完成数仍是 41（34 + 6 + 1）。
// 运行：npm run build && MOBILE_BROWSER=webkit node tests/joint-u6-u7.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/"; // 验已发布的预览产物时：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/u67c/
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = 4391 + (BNAME === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${PFX}`;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const prev = ["unit1", "unit2", "unit3", "unit4", "unit5"].flatMap((u) => readJ(`${u}.json`).lessons).map((l) => l.id);
const U6 = readJ("unit6.json").lessons.map((l) => l.id), U7 = readJ("unit7.json").lessons.map((l) => l.id);
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
const seedDone = Object.fromEntries(prev.map((k) => [k, true]));

for (const vp of [{ width: 390, height: 844 }, { width: 390, height: 450 }]) {
  const tag = `${BNAME} ${vp.width}×${vp.height}`;
  const ctx = await browser.newContext({ viewport: vp, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(30000);
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState);
  await page.evaluate((d) => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; st.done = { ...d }; window.__app.persist(); }, seedDone);
  await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  const cls = (id) => page.evaluate((i) => document.querySelector(`[data-lesson="${i}"]`)?.className || "MISSING", id);
  const doneCount = () => page.evaluate(() => Object.keys(window.__app.getState().done).length);

  check(`${tag} 起点：地图 59 个节点（含支线 1 关），U6L1 当前关，U6L2 与 U7L1 锁定`, (await page.locator(".node").count()) === 59 && /current/.test(await cls("U6L1")) && /locked/.test(await cls("U6L2")) && /locked/.test(await cls("U7L1")));

  // 长解析：答错后的反馈区
  async function probe() {
    return page.evaluate(() => {
      const vh = innerHeight, fb = document.querySelector(".feedbar"), c = document.querySelector("[data-continue]");
      const cr = c.getBoundingClientRect(), fr = fb.getBoundingClientRect();
      const top = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
      const ps = [...fb.querySelectorAll("p")]; const sc = fb.scrollHeight > fb.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(fb).overflowY);
      let readable;
      if (sc) { fb.scrollTop = 0; const a = ps[0]?.getBoundingClientRect(); fb.scrollTop = fb.scrollHeight; const l = ps[ps.length - 1]?.getBoundingClientRect(), f2 = fb.getBoundingClientRect(); readable = !!a && !!l && l.bottom <= f2.bottom + 1 && f2.top >= 0; fb.scrollTop = 0; }
      else readable = fr.top >= 0 && fr.bottom <= vh + 1 && fb.scrollHeight <= fb.clientHeight + 1;
      return { text: fb.innerText.replace(/\s+/g, " ").trim(), contInView: cr.top >= 0 && cr.bottom <= vh + 1 && cr.height >= 44, contOnTop: !!top && (top === c || c.contains(top)), readable, scrollable: sc, fbH: Math.round(fr.height), docWide: document.documentElement.scrollWidth > innerWidth + 1 };
    });
  }
  async function playViaMap(id, { wrongFirst }) {
    await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
    await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
    await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
    let n = 0, firstProbe = null;
    while (n++ < 12 && (await page.locator("[data-check]").count())) {
      const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
      const wrong = wrongFirst && n === 1;
      if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === !wrong)).click();
      else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
      else { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
      await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]"); await page.waitForTimeout(350);
      if (wrong) firstProbe = { type: ex.type, ...(await probe()) };
      await page.locator("[data-continue]").click(); await page.waitForTimeout(150);
    }
    await page.waitForSelector(".finish"); const ok = await page.evaluate((i) => !!window.__app.getState().done[i], id);
    await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
    return { ok, firstProbe };
  }

  for (const id of U6) {
    const r = await playViaMap(id, { wrongFirst: true });
    check(`${tag} ${id}：答错一次后重做，通关并记为已完成`, r.ok);
    const p = r.firstProbe;
    if (id === "U6L3" || id === "U6L6") {
      check(`${tag} ${id}：答错后解析读得全（视口内${p?.scrollable ? "可滚动到底" : "完整显示"}），反馈高 ${p?.fbH}px`, !!p && p.readable && !p.docWide && p.text.length > 30, JSON.stringify(p));
      check(`${tag} ${id}：「继续」完整在视口内且没被盖住`, !!p && p.contInView && p.contOnTop, JSON.stringify(p));
    }
    const nxt = id === "U6L6" ? "U7L1" : `U6L${+id[3] + 1}`;
    check(`${tag} ${id} 通关后：${nxt} 成为当前关`, /current/.test(await cls(nxt)), await cls(nxt));
  }
  check(`${tag} U6L6 通关后：U7L2 仍锁定`, /locked/.test(await cls("U7L2")), await cls("U7L2"));
  check(`${tag} U6 通关后完成数 40`, (await doneCount()) === 40, String(await doneCount()));
  const r7 = await playViaMap("U7L1", { wrongFirst: false });
  check(`${tag} 打通 U7L1：记为已完成，U7L2 解锁`, r7.ok && /current/.test(await cls("U7L2")), await cls("U7L2"));
  check(`${tag} 完成数 41`, (await doneCount()) === 41, String(await doneCount()));
  await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  check(`${tag} 刷新后：完成数仍是 41，U7L1 已完成，U7L2 当前关，U7L3 锁定`, (await doneCount()) === 41 && /done/.test(await cls("U7L1")) && /current/.test(await cls("U7L2")) && /locked/.test(await cls("U7L3")), `${await doneCount()} ${await cls("U7L1")} ${await cls("U7L2")} ${await cls("U7L3")}`);
  check(`${tag} 无脚本错误`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} 通过，${fail} 失败`); process.exit(fail ? 1 : 0);
