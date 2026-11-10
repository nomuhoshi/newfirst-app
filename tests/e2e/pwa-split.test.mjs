// 上线前检查：PWA 清单 / 图标 / 离线缓存，以及代码题模块（CodeMirror）按需加载。
// MOBILE_BROWSER=webkit|chromium（默认 chromium）。Service Worker 相关的几项只在 Chromium 上检查（Playwright WebKit 对 SW 支持不完整）。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(ROOT, "dist");
const ENGINE = process.env.MOBILE_BROWSER || "chromium";
const PORT = ENGINE === "webkit" ? 4374 : 4373, BASE = `http://localhost:${PORT}/`;
let playwright;
try { playwright = await import("playwright"); } catch (e) { console.log(`环境失败：无法加载 playwright（${e.message}）`); process.exit(2); }
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
let browser;
try { browser = await playwright[ENGINE].launch(); } catch (e) { console.log(`环境失败：${ENGINE} 无法启动（${String(e.message).split("\n")[0]}）`); process.exit(2); }

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".txt": "text/plain" };
let offline = false, failChunks = false; // failChunks：模拟代码题分块下载失败（服务器返回 503；不用 page.route，WebKit 下拦截结果会被缓存）
const srv = createServer((q, s) => { if (offline) { q.socket.destroy(); return; } if (failChunks && /\/assets\/(code-task|keyboard)-.*\.js$/.test(q.url)) { s.writeHead(503, { "cache-control": "no-store" }); s.end(); return; } const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const results = [];
const check = (g, name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${ENGINE}] [${g}] ${name}${detail ? "  — " + detail : ""}`); };

// ---------- 构建产物（不需要浏览器） ----------
{
  const G = "构建";
  const app = readFileSync(join(ROOT, "src/app.js"), "utf8"), ct = readFileSync(join(ROOT, "src/code-task.js"), "utf8");
  const a = /const CODE_TYPES = (\[[^\]]*\])/.exec(app)?.[1], b = /export const CODE_TYPES = (\[[^\]]*\])/.exec(ct)?.[1];
  check(G, "app.js 的 CODE_TYPES 与 code-task.js 一致（判断“是不是代码题”不需要先加载编辑器）", a && a === b, `${a} / ${b}`);
  const html = readFileSync(join(DIST, "index.html"), "utf8");
  const assets = readdirSync(join(DIST, "assets"));
  const cmChunk = assets.find((f) => f.endsWith(".js") && /EditorView|@codemirror|cm-content/.test(readFileSync(join(DIST, "assets", f), "utf8")) && !/^main-/.test(f));
  check(G, "CodeMirror 在单独的分块里，不在首页入口脚本中", !!cmChunk && !assets.filter((f) => /^main-.*\.js$/.test(f)).some((f) => /cm-content/.test(readFileSync(join(DIST, "assets", f), "utf8"))), cmChunk);
  check(G, "index.html 不预加载 CodeMirror 分块", !html.includes(cmChunk));
  const sw = readFileSync(join(DIST, "sw.js"), "utf8");
  check(G, "离线预缓存清单包含按需加载的代码题分块和 maskable 图标", sw.includes(cmChunk) && sw.includes("icon-maskable-192.png") && sw.includes("icon-maskable-512.png"));
  const m = JSON.parse(readFileSync(join(DIST, "manifest.webmanifest"), "utf8"));
  const icon = (size, purpose) => m.icons.find((i) => i.sizes === size && (i.purpose || "any").split(" ").includes(purpose));
  check(G, "manifest：name / short_name / start_url / scope / display / 主题色 / 背景色齐全", m.name && m.short_name && m.start_url === "./" && m.scope === "./" && m.display === "standalone" && /^#[0-9A-F]{6}$/i.test(m.theme_color) && /^#[0-9A-F]{6}$/i.test(m.background_color) && m.id);
  check(G, "manifest：192 / 512 普通图标 + 192 / 512 maskable 图标", icon("192x192", "any") && icon("512x512", "any") && icon("192x192", "maskable") && icon("512x512", "maskable"));
  check(G, "index.html 有 apple-touch-icon、manifest 链接", /rel="apple-touch-icon" href="\.\/icon-180\.png"/.test(html) && /rel="manifest"/.test(html));
  const png = (f) => { const b = readFileSync(join(DIST, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)].join("x"); };
  const sizes = { "icon-180.png": "180x180", "icon-192.png": "192x192", "icon-512.png": "512x512", "icon-maskable-192.png": "192x192", "icon-maskable-512.png": "512x512" };
  check(G, "图标文件存在且像素尺寸与声明一致", Object.entries(sizes).every(([f, s]) => existsSync(join(DIST, f)) && png(f) === s), Object.keys(sizes).map((f) => existsSync(join(DIST, f)) ? png(f) : "缺").join(" "));
  check(G, "有 robots.txt（不会被单页回退成 HTML）", existsSync(join(DIST, "robots.txt")) && /User-agent/.test(readFileSync(join(DIST, "robots.txt"), "utf8")));
}

const device = ENGINE === "webkit" ? playwright.devices["iPhone 13"] : playwright.devices["Pixel 7"];
const LESSON = { id: "E2E-CODE", title: "代码题加载测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: [
  { id: "E2E-W1", version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
    tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }], hints: ["用乘法", "print 里用逗号"], reference: 'print("总价", price * cups)' }] };
try {
  // ---------- 首屏不加载编辑器；进入代码题时再加载 ----------
  {
    const G = "按需加载";
    const ctx = await browser.newContext({ ...device, serviceWorkers: "block" });
    const page = await ctx.newPage();
    const errors = []; page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]));
    const reqs = []; page.on("request", (r) => reqs.push(new URL(r.url()).pathname));
    await ctx.addInitScript(() => localStorage.setItem("suipian.progress", JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: Date.now(), streak: 0, lastDay: null, done: {}, lessonsCompleted: 0, installTipClosed: true, lastActive: Date.now(), prefs: { sound: false, haptics: false, soundStyle: "J" } })));
    await page.goto(BASE);
    await page.locator(".pathview").waitFor();
    await page.waitForTimeout(1500);
    const before = reqs.filter((p) => /\/assets\/(keyboard|code-task)-/.test(p));
    check(G, "打开地图时没有下载代码题 / 编辑器分块", before.length === 0, before.join(" "));
    await page.locator('[data-lesson="U1L1"]').tap();
    await page.locator(".sheet button", { hasText: "开始 +" }).tap();
    await page.locator(".lessonfoot .btn3d.primary").tap();
    await page.locator("h2.q").waitFor();
    check(G, "普通点选题关卡也不下载编辑器分块", reqs.filter((p) => /\/assets\/(keyboard|code-task)-/.test(p)).length === 0);
    await page.evaluate(() => window.__app.renderPath());
    await page.evaluate((l) => window.__app.startLesson(l), LESSON);
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-code-task]", { timeout: 15000 });
    check(G, "进入代码题：编辑器按需加载并正常显示", (await page.locator(".cm-editor").count()) === 1 && reqs.some((p) => /\/assets\/code-task-/.test(p)));
    check(G, "没有未捕获的页面错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  // ---------- 加载失败时如实提示并可重试 ----------
  {
    const G = "加载失败";
    const ctx = await browser.newContext({ ...device, serviceWorkers: "block" });
    const page = await ctx.newPage();
    failChunks = true;
    await page.goto(BASE);
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.evaluate((l) => window.__app.startLesson(l), LESSON);
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-retry-code-task]", { timeout: 15000 });
    check(G, "代码题分块下载失败：显示说明和“重试”，不白屏", /没有加载成功/.test(await page.locator(".lesson").innerText()));
    failChunks = false;
    const xp0 = await page.evaluate(() => window.__app.getState().xp);
    await page.locator("[data-retry-code-task]").tap();
    await page.locator("[data-code-task], .pathview").first().waitFor({ timeout: 15000 });
    const inPage = (await page.locator("[data-code-task]").count()) === 1;
    check(G, "恢复后点“重试”：本页直接显示代码题，或重新加载回到地图（记录保留）", inPage || (await page.evaluate(() => window.__app.getState().xp)) === xp0, inPage ? "本页重试成功" : "重新加载了页面");
    if (!inPage) {
      await page.evaluate((l) => window.__app.startLesson(l), LESSON);
      await page.getByRole("button", { name: "继续", exact: true }).tap();
      await page.waitForSelector("[data-code-task], [data-retry-code-task]", { timeout: 15000 }).catch(() => {});
      const shown = (await page.locator("[data-code-task]").count()) === 1;
      if (ENGINE === "webkit") {
        // 已知限制：Playwright WebKit 在同一个浏览器会话里记住失败的模块下载，刷新后也不再请求（见 PR 说明）。
        // 这里只要求不白屏、不卡死：要么显示代码题，要么仍显示“重试”说明。
        check(G, "WebKit：重新加载后再进代码题不白屏（显示代码题或“重试”说明）", shown || (await page.locator("[data-retry-code-task]").count()) === 1, shown ? "已显示代码题" : "仍显示重试（已知 WebKit 会话缓存限制）");
      } else check(G, "重新加载后再进代码题：正常显示", shown, (await page.locator("#app").innerText()).slice(0, 80).replace(/\s+/g, " "));
    }
    await ctx.close();
  }
  // ---------- 离线：Service Worker 预缓存后，断网也能进入代码题 ----------
  if (ENGINE === "chromium") {
    const G = "离线";
    const ctx = await browser.newContext({ ...device });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 20000 });
    await page.waitForFunction(async () => { const k = await caches.keys(); if (!k.length) return false; const c = await caches.open(k[0]); return (await c.keys()).some((r) => /icon-maskable-512/.test(r.url)); }, null, { timeout: 20000 });
    check(G, "Service Worker 接管页面并缓存了 maskable 图标", true);
    offline = true; await ctx.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => window.__app && window.__app.getState, null, { timeout: 15000 });
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.evaluate((l) => window.__app.startLesson(l), LESSON);
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-code-task]", { timeout: 15000 }).catch(() => {});
    check(G, "断网后仍能打开代码题（编辑器分块来自离线缓存）", (await page.locator(".cm-editor").count()) === 1);
    offline = false;
    await ctx.close();
  }
} catch (e) {
  check("全程", "脚本异常（记为失败）", false, String(e.message).split("\n")[0]);
} finally { await browser.close(); srv.closeAllConnections?.(); srv.close(); }
const fails = results.filter((x) => !x).length;
console.log(`== pwa-split ${ENGINE}: ${results.length - fails}/${results.length} 通过`);
process.exit(fails ? 1 : 0);
