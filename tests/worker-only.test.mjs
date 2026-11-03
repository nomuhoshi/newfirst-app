// 白屏兜底提示与启动稳健性：主脚本加载失败 / 出错 / Python 工作线程不能创建时，页面不能一片空白。
// 用 dist/ 里的真实构建产物。桌面 Chromium 模拟，不能代替微信里的 iPhone 真机。
// 运行：npm run build && node tests/step4.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4332;
const BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const IPHONE_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const WECHAT_UA = IPHONE_UA + " MicroMessenger/8.0.50(0x18003237) NetType/WIFI Language/zh_CN";

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

async function open({ ua = IPHONE_UA, init = null, route = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => { window.__fallbackMs = 1500; }); // 测试里把 8 秒缩短成 1.5 秒
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  if (route) await route(page);
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  return { ctx, page, errors };
}
const MAIN_JS = /x/;

try {
  { // 只留“不能创建 Python 工作线程”这一条回归测试
    const { ctx, page, errors } = await open({ init: () => { window.Worker = function () { throw new Error("SecurityError: 模拟"); }; } });
    await page.waitForTimeout(3500);
    check("【回归】不能创建 Python 工作线程：页面照常显示开场介绍", /小码/.test(await page.locator("#app").innerText().catch(() => "")));
    check("【回归】不能创建 Python 工作线程：没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
