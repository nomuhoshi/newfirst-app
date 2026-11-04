// 横屏矮屏回归测试：开场介绍、关卡结算、复习结算的底部按钮在 iPhone 横屏（734×343、568×320）下
// 要么直接在屏幕内，要么在“用户能滑动的容器”里滚到底后出现在屏幕内并且没被别的元素盖住。
// 不依赖 Playwright 的 tap() 自动滚动（它能滚动 overflow:hidden 的容器，手指不能）。
// 用 dist/ 的真实构建产物，桌面 Chromium 模拟（iOS UA，使 Safari 底部留白规则生效），不能代替真机。
// 运行：npm run build && node tests/step7.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4337;
const BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".wav": "audio/wav", ".zip": "application/zip", ".txt": "text/plain" };
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const browser = await chromium.launch();

// 按钮能不能被用户点到：先看是否直接在屏幕内且在最上层；不在的话，找用户能滑动的祖先（overflow auto/scroll 且内容超出），
// 把它滚到能露出按钮的位置再看一次。返回 { ok, how, detail }。
const reach = (loc) => loc.evaluate((b) => {
  const onTop = () => { const r = b.getBoundingClientRect(); const inside = r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight + 0.5 && r.right <= window.innerWidth + 0.5;
    const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { ok: inside && !!t && (t === b || b.contains(t)), r }; };
  const first = onTop();
  if (first.ok) return { ok: true, how: "直接可见", detail: `bottom=${Math.round(first.r.bottom)} vh=${window.innerHeight}` };
  for (let e = b.parentElement; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (/(auto|scroll)/.test(cs.overflowY) && e.scrollHeight > e.clientHeight + 1) {
      e.scrollTop += b.getBoundingClientRect().bottom - e.getBoundingClientRect().bottom + 4;
      const again = onTop();
      return { ok: again.ok, how: "滑动后可见", detail: `容器 ${e.className || e.tagName} bottom=${Math.round(again.r.bottom)} vh=${window.innerHeight}` };
    }
  }
  return { ok: false, how: "到不了", detail: `bottom=${Math.round(first.r.bottom)} vh=${window.innerHeight}，没有可滑动的祖先` };
});

async function answerAll(page) {
  let n = 0;
  while (await page.locator("[data-check]").count()) {
    const ex = await page.evaluate(() => window.__app.currentEx);
    if (ex.type === "predict") await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).evaluate((b) => b.click());
    else if (ex.type === "fill") for (let k = 0; k < ex.answer.length; k++) {
      await page.locator(`[data-slot="${k}"]`).evaluate((b) => b.click());
      await page.evaluate((t) => [...document.querySelectorAll("[data-token]")].find((b) => b.dataset.token === t).click(), ex.answer[k]);
    } else for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).first().evaluate((b) => b.click());
    await page.locator("[data-check]").evaluate((b) => b.click());
    await page.locator("[data-continue]:not([disabled])").waitFor();
    await page.locator("[data-continue]").evaluate((b) => b.click());
    await page.waitForSelector("[data-check], .finish");
    if (++n > 12) break;
  }
  await page.waitForSelector(".finish");
}

try {
  for (const vp of [{ width: 734, height: 343, name: "iPhone 15 横屏 734×343" }, { width: 568, height: 320, name: "iPhone SE 横屏 568×320" }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, userAgent: IPHONE_UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.goto(BASE);
    await page.waitForSelector(".onboard");
    // 开场介绍三屏
    for (let i = 0; i < 3; i++) {
      const b = page.locator(".onboard .btn3d:not([data-onboard-login])");
      const r = await reach(b);
      check(`${vp.name}：开场介绍第 ${i + 1} 屏按钮能点到（${r.how}）`, r.ok, r.detail);
      await b.evaluate((x) => x.click());
    }
    await page.waitForSelector(".pathview");
    await page.evaluate(() => { const s = window.__app.getState(); s.prefs.sound = false; window.__app.persist(); });
    // 正常关卡结算
    await page.locator('[data-lesson="U1L1"]').evaluate((b) => b.click());
    await page.locator(".overlay .btn3d.primary").evaluate((b) => b.click());
    await page.getByRole("button", { name: "继续", exact: true }).evaluate((b) => b.click());
    await answerAll(page);
    let r = await reach(page.locator(".finish [data-continue]"));
    check(`${vp.name}：关卡结算页“继续”能点到（${r.how}）`, r.ok, r.detail);
    await page.locator(".finish [data-continue]").evaluate((b) => b.click());
    await page.waitForSelector(".pathview");
    // 复习结算（多一行“恢复红心”提示，更高）
    await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 3; window.__app.persist(); window.__app.renderPath(); });
    await page.locator('[data-lesson="U1L1"]').evaluate((b) => b.click());
    await page.locator(".overlay .btn3d.primary").evaluate((b) => b.click());
    await page.getByRole("button", { name: "继续", exact: true }).evaluate((b) => b.click());
    await answerAll(page);
    r = await reach(page.locator(".finish [data-continue]"));
    check(`${vp.name}：复习结算页“继续”能点到（${r.how}）`, r.ok, r.detail);
    check(`${vp.name}：结算页没有横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    check(`${vp.name}：没有脚本错误`, errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // 竖屏不受影响：结算页按钮不滚动就可见
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: IPHONE_UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const page = await ctx.newPage();
    await page.goto(BASE); await page.waitForSelector(".onboard");
    for (let i = 0; i < 3; i++) await page.locator(".onboard .btn3d:not([data-onboard-login])").evaluate((x) => x.click());
    await page.locator('[data-lesson="U1L1"]').evaluate((b) => b.click());
    await page.locator(".overlay .btn3d.primary").evaluate((b) => b.click());
    await page.getByRole("button", { name: "继续", exact: true }).evaluate((b) => b.click());
    await answerAll(page);
    const r = await reach(page.locator(".finish [data-continue]"));
    check("竖屏 390×844：关卡结算页“继续”不滚动就可见", r.ok && r.how === "直接可见", r.detail);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
