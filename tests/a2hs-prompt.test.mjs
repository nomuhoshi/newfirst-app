// “添加到主屏幕”引导的浏览器测试：只在 iPhone Safari、完成第 2 关后出现；可关闭；主屏幕 App 里永不显示。
// 运行：npm run build && node tests/a2hs-prompt.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const results = [];
function check(name, ok, detail = "") { results.push({ ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); }
const FIX = readFileSync(new URL("./fixtures/local-v3-progress.json", import.meta.url), "utf8");
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/json", ".wasm": "application/wasm" };
const srv = createServer((req, resp) => {
  const url = new URL(req.url, "http://x/"); let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("nf"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(0, res)); const URLBASE = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
const DAY = 24 * 3600 * 1000;
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1";
const raw = (n) => { const o = JSON.parse(FIX); const ids = Object.keys(o.done).slice(0, n); o.done = Object.fromEntries(ids.map((k) => [k, true])); return JSON.stringify(o); };
async function open({ ua = IPHONE_UA, done = 8, standalone = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block", userAgent: ua });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message))); page.__errors = errors;
  await page.addInitScript(([r, sa]) => {
    if (sa) Object.defineProperty(navigator, "standalone", { value: true, configurable: true });
    if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
    Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("suipian.progress", r);
  }, [raw(done), standalone]);
  await page.goto(URLBASE); await page.waitForSelector(".statsbar", { timeout: 15000 });
  return { ctx, page };
}
const count = (page) => page.locator("[data-a2hs]").count();
try {
  { const { ctx, page } = await open({ done: 2 });
    check("iPhone Safari、已完成 2 关：出现添加到主屏幕引导", (await count(page)) === 1);
    check("引导里有“怎么添加”和“不再提示”，不是弹窗", (await page.locator("[data-a2hs-how]").count()) === 1 && (await page.locator("[data-a2hs-close]").count()) === 1 && (await page.locator(".overlay").count()) === 0);
    check("步骤默认收起，点“怎么添加”展开", (await page.locator("[data-a2hs-steps]").isHidden()) && (await page.locator("[data-a2hs-how]").tap(), await page.locator("[data-a2hs-steps]").isVisible()));
    check("步骤写明分享按钮、添加到主屏幕、记录分开保存", /分享/.test(await page.locator("[data-a2hs-steps]").innerText()) && /添加到主屏幕/.test(await page.locator("[data-a2hs-steps]").innerText()) && /分开保存/.test(await page.locator("[data-a2hs-steps]").innerText()));
    await page.getByRole("button", { name: "我的", exact: true }).tap(); await page.waitForSelector("[data-backup]");
    check("“我的”页不出现这条引导", (await count(page)) === 0);
    await page.getByRole("button", { name: "学习", exact: true }).tap(); await page.waitForSelector(".statsbar");
    await page.locator("[data-a2hs-close]").tap();
    check("点“不再提示”：消失", (await count(page)) === 0);
    await page.reload(); await page.waitForSelector(".statsbar");
    check("刷新后仍不出现", (await count(page)) === 0);
    check("无脚本错误", page.__errors.length === 0, page.__errors.join("; ")); await ctx.close(); }
  { const { ctx, page } = await open({ done: 1 }); check("只完成 1 关：不出现", (await count(page)) === 0); await ctx.close(); }
  { const { ctx, page } = await open({ standalone: true }); check("主屏幕 App 里：永不显示", (await count(page)) === 0); await ctx.close(); }
  { const { ctx, page } = await open({ ua: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36" }); check("非 iPhone：不显示", (await count(page)) === 0); await ctx.close(); }
} finally { await browser.close(); srv.closeAllConnections(); srv.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
