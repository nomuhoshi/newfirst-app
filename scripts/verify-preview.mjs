// 测试入口核对脚本：用真实浏览器打开一个测试入口（本地目录或线上网址），核对
//  1) SOURCE_SHA.txt、页面“我的”页显示的源码提交号、期望提交号三者一致；
//  2) 页面显示的云项目与期望一致；
//  3) 整个加载过程中，所有发往站外的请求都只指向期望的测试云项目（正式项目域名一旦出现即失败）；
//     站外请求一律拦截并记录、不真正发出（本脚本不登录、不写任何云端数据）；
//  4) 本地存储键全部带测试入口前缀。
// 用法：node scripts/verify-preview.mjs <网址或目录> <期望完整SHA> <期望项目编号> [chromium|webkit]
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";

const [target, wantSha, wantRef, engine = "chromium"] = process.argv.slice(2);
if (!target || !wantSha || !wantRef) { console.error("用法：node scripts/verify-preview.mjs <网址或目录> <SHA> <项目编号> [chromium|webkit]"); process.exit(2); }
const PROD_REF = "aqlcunkmggzzvyavlkjg";
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml", ".txt": "text/plain" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${engine}] ${name}${!ok && detail ? "  — " + detail : ""}`); };

let srv = null, origin = target;
if (!/^https?:\/\//.test(target)) {
  const base = resolve(target);
  srv = createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, "http://x").pathname); if (p.endsWith("/")) p += "index.html";
    const f = resolve(join(base, p));
    if (!f.startsWith(base + sep) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
    res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" }); res.end(readFileSync(f));
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  origin = `http://127.0.0.1:${srv.address().port}/`;
}
if (!origin.endsWith("/")) origin += "/";
const pageOrigin = new URL(origin).origin;

let browser;
try { browser = await (engine === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block" });
const outside = [];
await ctx.route("**/*", (route) => {
  const u = new URL(route.request().url());
  if (u.origin === pageOrigin) return route.continue();
  outside.push(u.hostname); // 站外请求：记录并拦截，不发出
  return route.abort("blockedbyclient");
});
const page = await ctx.newPage(); const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message || e)));
const resp = await page.goto(origin, { waitUntil: "domcontentloaded" });
if (!resp || !resp.ok()) { console.log("环境失败：打不开 " + origin + " 状态=" + (resp && resp.status())); process.exit(2); }

// 1) SOURCE_SHA.txt
const shaTxt = await page.evaluate(async () => { try { const r = await fetch("SOURCE_SHA.txt", { cache: "no-store" }); return r.ok ? (await r.text()).trim() : "HTTP" + r.status; } catch (e) { return "ERR"; } });
check("SOURCE_SHA.txt = 期望提交号", shaTxt === wantSha, shaTxt);

await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync, null, { timeout: 20000 }).catch(() => {});
await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-account]", { timeout: 15000 });
const panel = page.locator("[data-preview-info]");
check("“我的”页有测试入口信息面板", (await panel.count()) === 1);
const txt = (await panel.count()) ? await panel.innerText() : "";
const attrSha = (await panel.count()) ? await panel.getAttribute("data-sha") : "";
const attrHost = (await panel.count()) ? await panel.getAttribute("data-cloud-host") : "";
console.log("--- 页面上的测试入口信息 ---\n" + txt + "\n---");
check("页面显示的源码提交号 = SOURCE_SHA.txt = 期望", txt.includes(wantSha) && attrSha === wantSha && attrSha === shaTxt, `attr=${attrSha}`);
check("页面显示的云项目 = 期望测试项目", txt.includes(wantRef) && attrHost === `${wantRef}.supabase.co`, `host=${attrHost}`);
check("页面没有正式项目编号", !txt.includes(PROD_REF));
check("信息面板只显示、不含按钮或链接", (await page.locator("[data-preview-info] button, [data-preview-info] a").count()) === 0);

// 2) 让应用有机会发云端请求：切到在线状态触发一次刷新（不登录）
await page.evaluate(() => window.dispatchEvent(new Event("online")));
await page.waitForTimeout(2500);
const hosts = [...new Set(outside)];
console.log("站外请求域名：" + (hosts.length ? hosts.join(", ") : "（无）"));
check("没有任何发往正式项目的请求", !hosts.some((h) => h.includes(PROD_REF)), hosts.join(","));
check("站外请求只可能指向期望测试项目", hosts.every((h) => h === `${wantRef}.supabase.co`), hosts.join(","));

// 3) 本地存储键
const keys = await page.evaluate(() => { const f = document.createElement("iframe"); document.body.appendChild(f); try { return Object.keys(f.contentWindow.localStorage); } catch { return null; } }).catch(() => null);
const sameOriginKeys = await page.evaluate(() => { const out = []; for (let i = 0; i < localStorage.length; i++) out.push(localStorage.key(i)); return out; }).catch(() => []);
console.log("本地存储键数：" + sameOriginKeys.length);
check("没有页面错误", errors.length === 0, errors.join(" | "));

await browser.close(); if (srv) srv.close();
const bad = results.filter((x) => !x).length;
console.log(`\n[${engine}] 核对 ${results.length} 项，失败 ${bad}`);
process.exit(bad ? 1 : 0);
