// 弹窗键盘可用性：打开后焦点进入弹窗、Tab 不跑出弹窗、Esc 关闭并把焦点还给打开它的按钮。
// 桌面 Chromium 模拟外接键盘，不代表 VoiceOver 实测。运行：npm run build && node tests/a11y-sheet.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
const DIST = resolve(new URL("../dist", import.meta.url).pathname), PORT = 4341, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const results = []; const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? "  — " + d : ""}`); };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: "block" });
await ctx.addInitScript(() => localStorage.setItem("suipian.progress", JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: Date.now(), streak: 0, lastDay: null, done: {}, lessonsCompleted: 0, installTipClosed: true, lastActive: Date.now(), prefs: { sound: false, haptics: false, soundStyle: "J" } })));
const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
await page.goto(BASE); await page.waitForSelector(".pathview");
await page.locator('[data-lesson="U1L1"]').focus(); await page.keyboard.press("Enter"); await page.waitForSelector(".overlay");
const inside = () => page.evaluate(() => !!document.querySelector(".overlay")?.contains(document.activeElement));
check("打开弹窗后焦点在弹窗内", await inside());
check("弹窗有 aria-labelledby 指向标题", await page.evaluate(() => { const o = document.querySelector(".overlay"); const id = o.getAttribute("aria-labelledby"); return !!id && !!document.getElementById(id)?.textContent; }));
let ok = true; for (let i = 0; i < 8; i++) { await page.keyboard.press(i % 3 ? "Tab" : "Shift+Tab"); ok &&= await inside(); }
check("Tab / Shift+Tab 焦点不跑出弹窗", ok);
await page.keyboard.press("Escape");
check("Esc 关闭弹窗", !(await page.locator(".overlay").count()));
check("关闭后焦点回到关卡按钮", await page.evaluate(() => document.activeElement?.dataset?.lesson === "U1L1"));
check("没有脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${results.length} 项，失败 ${results.filter((x) => !x).length} 项`); if (results.includes(false)) process.exit(1);
