// U8 + 样板关（D1）联合分支：窄屏 390×844、390×450，WebKit / Chromium（MOBILE_BROWSER=webkit|chromium）。
// 验：样板关入口 U3 全 8 关完成才解锁、锁定时只说明前置、解锁后不抢主线当前关、通关刷新保持、不计入主线完成数；
//     U8 六关逐关通关解锁、每题答错后解析读得全、代码块不自动折行（窄屏横滚）、「继续」可点、刷新后完成数 52。
// 运行：npm run build && MOBILE_BROWSER=webkit node tests/joint-u8-sample.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/"; // 验已发布的预览产物时：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/u67c/
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const PORT = 4395 + (BNAME === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${PFX}`;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const ids = (u) => readJ(`${u}.json`).lessons.map((l) => l.id);
const U1to7 = ["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7"].flatMap(ids), U1to3 = ["unit1", "unit2", "unit3"].flatMap(ids);
const U8 = ids("unit8"), D1 = ids("sample-debug");
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
      const wrapped = [...document.querySelectorAll(".choice pre")].filter((p) => { const h0 = textH(p), old = p.style.whiteSpace; p.style.whiteSpace = "pre"; const h1 = textH(p); p.style.whiteSpace = old; return h0 > h1 + 2; }).map((p) => p.textContent.slice(0, 40));
      const codeOk = cbOk && wrapped.length === 0;
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
    check(`${tag} ${id}：${probes.length} 题答错后解析读得全、代码不折行（可横滚）、页面不横滚、「继续」可点`, probes.length > 0 && bad.length === 0, JSON.stringify(bad[0] || probes));
  };

  // ── 样板关入口：锁定 ──
  await seed(asDone(U1to3.filter((x) => x !== "U3L8")));
  check(`${tag} 支线：U3 差 1 关时 D1L1 锁定，地图写“完成第 3 单元后解锁”`, /side-locked/.test(await cls("D1L1")) && /支线 · 完成第 3 单元后解锁/.test(await mapText()) && /current/.test(await cls("U3L8")), await cls("D1L1"));
  await page.locator('[data-lesson="D1L1"]').scrollIntoViewIfNeeded(); await page.locator('[data-lesson="D1L1"]').click();
  const lockMsg = await page.locator(".overlay").innerText();
  check(`${tag} 支线：锁定时点开只说明前置条件，没有“开始”`, /先完成「比较与判断」单元的全部关卡/.test(lockMsg) && !/开始 \+/.test(lockMsg), lockMsg.slice(0, 120));
  await page.locator(".overlay .btn3d").first().click();

  // ── 解锁 ──
  await seed(asDone(U1to3));
  check(`${tag} 支线：U3 全 8 关完成后 D1L1 解锁；主线当前关仍是 U4L1，且只有一个主线当前关`, /side-current/.test(await cls("D1L1")) && /current/.test(await cls("U4L1")) && (await page.locator(".node.current").count()) === 1, `${await cls("D1L1")} ${await cls("U4L1")}`);
  check(`${tag} 支线：地图自动滚到主线当前关 U4L1`, await page.evaluate(() => { const v = document.querySelector(".pathview").getBoundingClientRect(), n = document.querySelector('[data-lesson="U4L1"]').getBoundingClientRect(); return n.top >= v.top && n.bottom <= v.bottom; }));
  const statBefore = await doneStat();
  const rd = await playViaMap("D1L1");
  check(`${tag} D1L1：通关并记为已完成`, rd.ok);
  probeChecks("D1L1", rd.probes);
  check(`${tag} D1L1 通关后：主线不变（U4L1 仍是当前关），“已完成关卡”统计不计支线`, /current/.test(await cls("U4L1")) && (await doneStat()) === statBefore, `${statBefore} → ${await doneStat()}`);
  await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  check(`${tag} 刷新后：D1L1 仍已完成，支线显示“已完成”`, /side-done/.test(await cls("D1L1")) && /支线 · 已完成/.test(await mapText()) && (await done()).D1L1 === true, await cls("D1L1"));

  // ── U8 六关 ──
  await seed(asDone(U1to7));
  check(`${tag} U8：U7 全部完成后 U8L1 是当前关，U8L2 锁定；第 9 单元即将推出`, /current/.test(await cls("U8L1")) && /locked/.test(await cls("U8L2")) && /第 9 单元 · 即将推出/.test(await mapText()));
  for (const [i, id] of U8.entries()) {
    const r = await playViaMap(id);
    check(`${tag} ${id}：通关并记为已完成`, r.ok);
    probeChecks(id, r.probes);
    if (U8[i + 1]) check(`${tag} ${id} 通关后：${U8[i + 1]} 成为当前关`, /current/.test(await cls(U8[i + 1])), await cls(U8[i + 1]));
  }
  await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
  const d = await done();
  check(`${tag} 刷新后：U8 六关都已完成，完成数 52（U1–U7 46 + U8 6）`, U8.every((x) => d[x]) && Object.keys(d).length === 52 && /52\/52/.test(await doneStat()), `${Object.keys(d).length} ${await doneStat()}`);
  check(`${tag} 无脚本错误`, errors.length === 0, errors.join("; "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${pass} 通过，${fail} 失败`); process.exit(fail ? 1 : 0);
