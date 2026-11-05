// 白屏兜底提示的分类（index.html 里的内联脚本）：在 Chromium 和 WebKit 上都跑（step4 只跑 Chromium）。
//   主脚本 200 但有语法错误 / 启动时异常 → “页面脚本出错，应用未能启动”，错误详情在下方文字框里可复制；
//   在微信里 → “换个浏览器打开”排第一；
//   脚本块下载失败（确认是资源加载失败）→ 仍是“页面没有正常加载”+ 网络建议在前，没有错误文字框；
//   页面已渲染后的异步异常 → 不出现兜底提示。
// 运行：npm run build && MOBILE_BROWSER=chromium|webkit node tests/blank-screen-fallback.test.mjs   （DIST_DIR 可指定别的构建目录）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(process.env.DIST_DIR || new URL("../dist", import.meta.url).pathname);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip" };
const results = []; const B = process.env.MOBILE_BROWSER || "chromium";
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${B}] ${n}${d ? "  — " + String(d).replace(/\n+/g, " / ").slice(0, 260) : ""}`); };
const srv = createServer((q, r) => {
  const u = new URL(q.url, "http://x"); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); r.end("not found"); return; }
  r.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); r.end(readFileSync(p));
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
let browser; try { browser = await (B === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1";
const WECHAT_UA = IPHONE_UA + " MicroMessenger/8.0.50(0x18003237) NetType/WIFI Language/zh_CN";
const MAIN_JS = /\/assets\/main-[^/]*\.js$/;
const real = readFileSync(join(DIST, "assets", readdirSync(join(DIST, "assets")).find((f) => /^main-.*\.js$/.test(f))), "utf8");
async function open({ ua = IPHONE_UA, route } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, hasTouch: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => { window.__fallbackMs = 1500; });
  const page = await ctx.newPage(); if (route) await route(page);
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); return { ctx, page };
}
const serve = (body) => (pg) => pg.route(MAIN_JS, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body }));

try {
  for (const [name, body, errRe] of [["语法错误", "const = ;", /SyntaxError|Unexpected|syntax/i], ["启动时异常", `throw new Error("模拟：启动时异常");\n` + real, /模拟：启动时异常/]]) {
    const { ctx, page } = await open({ route: serve(body) });
    const shown = await page.waitForSelector("#load-fallback", { timeout: 12000 }).then(() => true, () => false);
    const txt = shown ? await page.locator("#load-fallback").innerText() : "";
    check(`主脚本${name}（200）：标题是“页面脚本出错，应用未能启动”`, /页面脚本出错，应用未能启动/.test(txt) && !/页面没有正常加载/.test(txt), txt.slice(0, 60));
    const detail = shown && (await page.locator("#load-fallback-detail").count()) ? await page.locator("#load-fallback-detail").inputValue() : "";
    check(`主脚本${name}（200）：详情文字框里有这个引擎报的错误、环境和网址（记录原文）`, errRe.test(detail) && /环境：/.test(detail) && /网址：http/.test(detail), detail);
    const g = shown ? await page.evaluate(() => { const r = (id) => document.getElementById(id).getBoundingClientRect(); return { rb: r("load-fallback-reload").bottom, dt: r("load-fallback-detail").top, vh: innerHeight }; }) : null;
    check(`主脚本${name}（200）：“重新加载”在首屏内，详情文字框在它下面`, g && g.dt > g.rb && g.rb <= g.vh, JSON.stringify(g));
    if (shown) { await page.locator("#load-fallback-copy").click(); await page.waitForTimeout(400); }
    check(`主脚本${name}（200）：点“复制错误信息”后如实反馈（已复制 / 提示长按）`, shown && /已复制|长按/.test(await page.locator("#load-fallback-copy").innerText()));
    await ctx.close();
  }
  { const { ctx, page } = await open({ ua: WECHAT_UA, route: serve("const = ;") });
    await page.waitForSelector("#load-fallback", { timeout: 12000 }).catch(() => {});
    const first = (await page.locator("#load-fallback li").count()) ? await page.locator("#load-fallback li").first().innerText() : "";
    check("在微信里脚本出错：第一条是“换个浏览器打开”", /换个浏览器打开/.test(first) && /微信/.test(first), first); await ctx.close(); }
  { const { ctx, page } = await open({ route: (pg) => pg.route(/\/assets\/errors-[^/]*\.js$/, (r) => r.abort("failed")) });
    const shown = await page.waitForSelector("#load-fallback", { timeout: 12000 }).then(() => true, () => false);
    const txt = shown ? await page.locator("#load-fallback").innerText() : "";
    check("脚本块下载失败：仍显示“页面没有正常加载”，网络建议在前，没有错误文字框", /页面没有正常加载/.test(txt) && txt.indexOf("网络不稳定") < txt.indexOf("微信或 QQ") && (await page.locator("#load-fallback-detail").count()) === 0, txt);
    await ctx.close(); }
  { const { ctx, page } = await open({ route: serve(real + `\nsetTimeout(() => { Promise.reject(new Error("模拟：启动后异步异常")); }, 800);`) });
    await page.waitForSelector("#app *", { timeout: 12000 }); await page.waitForTimeout(4000);
    check("页面已渲染后的异步异常：不出现兜底提示，页面照常显示", (await page.locator("#load-fallback").count()) === 0 && /小码/.test(await page.locator("#app").innerText())); await ctx.close(); }
} catch (e) { console.log("❌ 测试异常：" + (e.stack || e)); results.push(false); }
await browser.close(); srv.closeAllConnections(); srv.close();
const pass = results.filter(Boolean).length; console.log(`\n白屏兜底提示：${pass}/${results.length} 通过`); process.exit(pass === results.length ? 0 : 1);
