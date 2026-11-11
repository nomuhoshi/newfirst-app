// 反馈区「继续」按钮在 iPhone 上盖住反馈文字（2026-11-12 老大 iPhone Safari 实测失败，诊断用回归测试）。
// 根因：D6 给「继续」加了 position: sticky，且 bottom 取 80px（iOS 浏览器）/ env(safe-area-inset-bottom)（主屏幕 App）。
//       sticky 的参照范围是滚动容器去掉 padding 之后的区域，而 .feedbar 的 padding-bottom 已经留了同样的 80px / 安全区，
//       两份留白叠加，按钮被往上顶，盖住“答对了！”标题和解释文字。D6 的验收都没有带 iPhone 的 UA / 安全区，所以没测到。
// 这里用和真机一致的两个条件复现：① iPhone UA（html 带 ios-browser）② 底部安全区 34px（主屏幕 App；仅 Chromium 能模拟）。
// 覆盖 U1L1（选输出 / 填空 / 排序，短反馈）和 U3L8（长答案，反馈区内部滚动），答对、答错两条路径；Safari：402×659（老大截图里的可视区）和 402×450；主屏幕 App：402×874。
// 断言：「继续」不盖住反馈区里的任何文字（不滚动时；可滚动时滚到底）；按钮在视口内、点得到；按钮底边到反馈区底边的距离 = 反馈区的底部留白（没有多顶上去）。
// 运行：npm run build && MOBILE_BROWSER=webkit|chromium node tests/feedback-ios-sticky.test.mjs
// 验已发布的预览产物：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/d6/ node tests/feedback-ios-sticky.test.mjs
// 试候选修复（不用重新构建）：FIX_CSS='.feedbar > [data-continue], .ios-browser .feedbar > [data-continue] { bottom: 0 !important; }' node tests/feedback-ios-sticky.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/", FIX_CSS = process.env.FIX_CSS || "", SHOT_DIR = process.env.SHOT_DIR || "";
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const engine = BNAME === "webkit" ? webkit : chromium;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
if (SHOT_DIR) mkdirSync(SHOT_DIR, { recursive: true });
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} [${BNAME}] ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, s) => { const u = new URL(q.url, "http://localhost"); if (!u.pathname.startsWith(PFX)) { s.writeHead(404); s.end(); return; } let p = join(DIST, decodeURIComponent(u.pathname.slice(PFX.length))); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}${PFX}`;
let browser;
try { browser = await engine.launch(); } catch (e) { console.log(`环境失败：${BNAME} 起不来：${String(e.message).split("\n")[0]}`); srv.close(); process.exit(2); }
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const course = readJ("course.json");
const MAIN = course.units.filter((u) => u.available && u.file).flatMap((u) => readJ(u.file).lessons.map((l) => l.id));
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
if (FIX_CSS) console.log(`（注入候选修复样式：${FIX_CSS}）`);

for (const mode of ["iPhone Safari（ios-browser，底部留白 80px）", "主屏幕 App（底部安全区 34px）"]) {
  const pwa = mode.startsWith("主屏幕");
  if (pwa && engine !== chromium) { console.log(`（${BNAME} 不能模拟安全区，跳过“${mode}”；这一项只在 Chromium 跑）`); continue; }
  // 主屏幕 App 没有浏览器工具栏，可视区就是整块屏幕（402×874）；竖屏安全区配 450 高的组合真机上不存在，不测
  for (const vp of pwa ? [{ width: 402, height: 874 }] : [{ width: 402, height: 659 }, { width: 402, height: 450 }]) {
    const tag = `${mode} ${vp.width}×${vp.height}`;
    const ctx = await browser.newContext({ viewport: vp, hasTouch: true, isMobile: engine === chromium, userAgent: pwa ? undefined : IPHONE_UA, serviceWorkers: "block" });
    ctx.setDefaultTimeout(30000);
    const page = await ctx.newPage();
    if (pwa) { const cdp = await ctx.newCDPSession(page); await cdp.send("Emulation.setSafeAreaInsetsOverride", { insets: { top: 59, bottom: 34 } }); }
    await page.goto(BASE); await page.waitForFunction(() => window.__app?.getState);
    const env = await page.evaluate(() => { const d = document.createElement("div"); d.style.cssText = "position:fixed;height:env(safe-area-inset-bottom,0px)"; document.body.append(d); const sab = d.getBoundingClientRect().height; d.remove(); return { ios: document.documentElement.classList.contains("ios-browser"), sab }; });
    check(`${tag}：测试条件成立（${pwa ? "底部安全区 = 34px" : "html 带 ios-browser"}）`, pwa ? env.sab === 34 : env.ios, JSON.stringify(env));
    const seenKind = new Set(); let n = 0, scrollSeen = 0;
    for (const id of ["U1L1", "U3L8"]) {
      await page.evaluate((d) => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; st.done = d; st.hearts = 5; window.__app.persist(); }, Object.fromEntries(MAIN.slice(0, MAIN.indexOf(id)).map((k) => [k, true])));
      await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
      if (FIX_CSS) await page.addStyleTag({ content: FIX_CSS });
      await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
      await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
      const seen = new Set();
      for (let i = 0; i < 16 && (await page.locator("[data-check]").count()); i++) {
        const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
        const wrong = !seen.has(ex.prompt); seen.add(ex.prompt); // 每道题第一次故意答错，回到队尾再答对：两条路径都测到
        await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
        if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === !wrong)).click();
        else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, k) => (k === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
        else { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
        await page.locator("[data-check]").click(); await page.waitForSelector("[data-continue]"); await page.waitForTimeout(450);
        const m = await page.evaluate(() => {
          const fb = document.querySelector(".feedbar"), c = fb.querySelector("[data-continue]"), cs = getComputedStyle(fb);
          const kids = [...fb.children].filter((x) => x !== c);
          const box = (el) => { const b = el.getBoundingClientRect(); return [Math.round(b.top), Math.round(b.bottom)]; };
          const cover = () => { const cr = c.getBoundingClientRect(); let worst = 0, who = ""; for (const k of kids) { const b = k.getBoundingClientRect(); const o = Math.min(b.bottom, cr.bottom) - Math.max(b.top, cr.top); if (o > worst) { worst = o; who = (k.className || k.tagName) + "「" + k.textContent.slice(0, 10) + "」"; } } return { px: Math.round(worst), who }; };
          const scrollable = fb.scrollHeight > fb.clientHeight + 1;
          const atRest = { cover: cover(), fb: box(fb), head: box(fb.querySelector(".fb-head")), cont: box(c) };
          fb.scrollTop = fb.scrollHeight;
          const fr = fb.getBoundingClientRect(), cr = c.getBoundingClientRect();
          const hit = document.elementFromPoint(cr.left + cr.width / 2, cr.top + cr.height / 2);
          const end = { cover: cover(), gap: Math.round(fr.bottom - cr.bottom), inView: cr.top >= 0 && cr.bottom <= innerHeight + 1, hit: hit === c || c.contains(hit) };
          fb.scrollTop = 0;
          return { scrollable, padB: Math.round(parseFloat(cs.paddingBottom)), atRest, end };
        });
        const kind = `${ex.type}${wrong ? "答错" : "答对"}`; seenKind.add(kind); n++; if (m.scrollable) scrollSeen++;
        const q = `${tag} ${id} ${kind}「${ex.prompt.slice(0, 12)}」`;
        if (!m.scrollable) check(`${q}：「继续」没有盖住反馈文字`, m.atRest.cover.px <= 1, `盖住 ${m.atRest.cover.who} ${m.atRest.cover.px}px；反馈区 ${m.atRest.fb}，标题 ${m.atRest.head}，继续 ${m.atRest.cont}`);
        check(`${q}：${m.scrollable ? "（内部滚动）滚到底时" : ""}「继续」不盖住最后的内容、在视口内、点得到`, m.end.cover.px <= 1 && m.end.inView && m.end.hit, JSON.stringify(m.end));
        check(`${q}：「继续」下方留白 = 反馈区底部留白 ${m.padB}px（没有被多顶上去）`, Math.abs(m.end.gap - m.padB) <= 1, `实际 ${m.end.gap}px`);
        if (SHOT_DIR && id === "U1L1" && ex.type === "fill") await page.screenshot({ path: join(SHOT_DIR, `${BNAME}-${pwa ? "pwa" : "safari"}-${vp.height}-${wrong ? "wrong" : "right"}${FIX_CSS ? "-fix" : ""}.png`) });
        await page.locator("[data-continue]").click(); await page.waitForTimeout(250);
      }
    }
    check(`${tag}：三种题型、答对答错都测到了（共 ${n} 次反馈，其中内部滚动 ${scrollSeen} 次）`, ["predict", "fill", "order"].every((t) => seenKind.has(t + "答对") && seenKind.has(t + "答错")), [...seenKind].join(" "));
    await ctx.close();
  }
}
await browser.close(); srv.close();
console.log(`\n${BNAME}：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
