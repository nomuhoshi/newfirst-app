// 白屏兜底提示与启动稳健性：主脚本加载失败 / 出错 / Python 工作线程不能创建时，页面不能一片空白。
// 用 dist/ 里的真实构建产物。桌面 Chromium 模拟，不能代替微信里的 iPhone 真机。
// 运行：npm run build && node tests/step4.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
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

async function open({ ua = IPHONE_UA, init = null, route = null, clock = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: ua, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.addInitScript(() => { window.__fallbackMs = 1500; }); // 测试里把 8 秒缩短成 1.5 秒
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  if (route) await route(page);
  if (clock) await page.clock.install(); // 可控时钟：用来“快进”超时，不依赖应用内部接口
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  return { ctx, page, errors };
}
const MAIN_JS = /\/assets\/main-[^/]*\.js$/;

try {
  check("构建产物里有兜底提示脚本（没被打包工具去掉）", /load-fallback/.test(readFileSync(join(DIST, "index.html"), "utf8")));

  { // 正常加载：不出现提示
    const { ctx, page, errors } = await open();
    await page.waitForTimeout(3500);
    check("正常加载：页面显示开场介绍", /小码/.test(await page.locator("#app").innerText()));
    check("正常加载：兜底提示不出现", (await page.locator("#load-fallback").count()) === 0);
    check("正常加载：没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // 主脚本加载失败（网络断了）
    let blocked = true;
    const { ctx, page } = await open({ route: (pg) => pg.route(MAIN_JS, (r) => (blocked ? r.abort() : r.continue())) });
    await page.waitForSelector("#load-fallback", { timeout: 8000 });
    const txt = await page.locator("#load-fallback").innerText();
    check("主脚本加载失败：显示“页面没有正常加载”", /页面没有正常加载/.test(txt));
    check("主脚本加载失败：非微信时，“网络不稳定”排在“微信或 QQ”前面", txt.indexOf("网络不稳定") >= 0 && txt.indexOf("网络不稳定") < txt.indexOf("微信或 QQ"), txt.replace(/\n+/g, " / ").slice(0, 120));
    check("主脚本加载失败：有“重新加载”按钮", (await page.locator("#load-fallback-reload").count()) === 1);
    check("主脚本加载失败：显示给开发者的信息（含 iOS 版本）", /给开发者的信息/.test(txt) && /iOS 16\.6/.test(txt));
    { // 回归（助手复测 dc08c92）：提示必须铺满可视区域，按钮不用滚动就能点到，且没有被别的元素盖住
      const g = await page.evaluate(() => {
        const r = (el) => el.getBoundingClientRect();
        const box = r(document.getElementById("load-fallback")), btn = r(document.getElementById("load-fallback-reload"));
        const cx = btn.left + btn.width / 2, cy = btn.top + btn.height / 2;
        return { vw: innerWidth, vh: innerHeight, box: [box.left, box.top, box.right, box.bottom], btn: [btn.left, btn.top, btn.right, btn.bottom], pos: getComputedStyle(document.getElementById("load-fallback")).position, top: document.elementFromPoint(cx, cy)?.id, sy: scrollY };
      });
      check("兜底提示：position:fixed 铺满视口", g.pos === "fixed" && g.box[0] <= 0 && g.box[1] <= 0 && g.box[2] >= g.vw && g.box[3] >= g.vh, JSON.stringify(g));
      check("兜底提示：“重新加载”按钮在视口内、无需滚动、没被盖住", g.btn[1] >= 0 && g.btn[3] <= g.vh && g.btn[0] >= 0 && g.btn[2] <= g.vw && g.top === "load-fallback-reload" && g.sy === 0, JSON.stringify(g));
    }
    blocked = false;
    await page.locator("#load-fallback-reload").click();
    await page.waitForSelector("#app *", { timeout: 8000 });
    await page.waitForTimeout(1200);
    check("恢复网络后点“重新加载”：页面正常出现，提示消失", /小码/.test(await page.locator("#app").innerText()) && (await page.locator("#load-fallback").count()) === 0);
    await ctx.close();
  }

  { // 在微信里：微信提示排第一
    const { ctx, page } = await open({ ua: WECHAT_UA, route: (pg) => pg.route(MAIN_JS, (r) => r.abort()) });
    await page.waitForSelector("#load-fallback", { timeout: 8000 });
    const first = await page.locator("#load-fallback li").first().innerText();
    const txt = await page.locator("#load-fallback").innerText();
    check("在微信里：第一条原因是“在浏览器打开”", /微信/.test(first) && /在浏览器打开/.test(first), first);
    check("在微信里：给开发者的信息标明微信", /微信\/QQ/.test(txt));
    await ctx.close();
  }

  { // 主脚本有语法错误 / 运行报错
    const { ctx, page } = await open({ route: (pg) => pg.route(MAIN_JS, (r) => r.fulfill({ status: 200, contentType: "text/javascript", body: "const = ;" })) });
    await page.waitForSelector("#load-fallback", { timeout: 8000 });
    check("主脚本语法错误（模拟浏览器不认识新语法）：显示兜底提示", /页面没有正常加载/.test(await page.locator("#load-fallback").innerText()));
    await ctx.close();
  }

  { // 不能创建 Python 工作线程：页面照样出现
    const { ctx, page, errors } = await open({ init: () => { window.Worker = function () { throw new Error("SecurityError: 模拟——这个环境不允许创建模块工作线程"); }; } });
    await page.waitForTimeout(3500);
    check("不能创建 Python 工作线程：页面照常显示开场介绍", /小码/.test(await page.locator("#app").innerText()));
    check("不能创建 Python 工作线程：兜底提示不出现，没有脚本错误", (await page.locator("#load-fallback").count()) === 0 && errors.length === 0, errors.join(" | "));
    // 直接标记“看过开场”并显示地图（和其他测试一样用 window.__app 钩子）
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    check("不能创建 Python 工作线程：能走到关卡地图", (await page.locator(".pathview").count()) === 1, (await page.locator("#app").innerText()).slice(0, 60));
    await ctx.close();
  }
  { // 回归（助手复测 dc08c92）：不能创建 Worker 时，答题后“运行中…”必须结束并给出失败提示，地图、答题、继续按钮照常
    const { ctx, page, errors } = await open({ init: () => { window.Worker = function () { throw new Error("SecurityError: 模拟"); }; } });
    await page.waitForSelector("#app *");
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector('[data-lesson="U1L1"]');
    await page.locator('[data-lesson="U1L1"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForFunction(() => window.__app.currentEx, null, { timeout: 5000 });
    const e = await page.evaluate(() => window.__app.currentEx);
    check("Worker 失败：能进入答题", !!e && e.type === "predict", e && e.type); // U1L1 第一题是选输出题
    await page.locator(".choice").nth(e.options.findIndex((o) => !!o.correct)).tap();
    await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar");
    await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 8000 });
    const t = await page.locator(".outpanel pre").innerText();
    check("Worker 失败：“运行中…”在几秒内结束，写明环境不允许启动 Python 线程", /不允许启动 Python 运行线程/.test(t), t.slice(0, 60));
    check("Worker 失败：有“重试”按钮", (await page.locator("[data-retry-python]").count()) === 1);
    const cont = page.locator("[data-continue]");
    await page.waitForFunction(() => { const b = document.querySelector("[data-continue]"); return b && !b.disabled; }, null, { timeout: 3000 }).catch(() => {});
    check("Worker 失败：“继续”按钮可点", (await cont.count()) === 1 && (await cont.isEnabled()));
    await page.locator("[data-retry-python]").tap();
    await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 8000 });
    check("Worker 失败：点“重试”后仍然会结束，不会卡在“运行中…”", /不允许启动 Python 运行线程/.test(await page.locator(".outpanel pre").innerText()));
    await cont.tap();
    check("Worker 失败：点“继续”后进入下一题", (await page.locator(".feedbar").count()) === 0);
    check("Worker 失败：整个过程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // 加载一直没有结果（Worker 创建了但永远不回应）：到时间也要结束“运行中…”
    // 不改应用内部的超时设置（旧版本没有 __app.LIMITS），而是用浏览器可控时钟快进 40 秒（> 加载上限 30 秒 + 2 秒）。
    // 这样在没有超时处理的旧代码上，失败原因就是“一直显示运行中…”，而不是接口缺失。
    const { ctx, page, errors } = await open({ clock: true, init: () => { window.Worker = function () { this.postMessage = () => {}; this.terminate = () => {}; }; } });
    await page.waitForSelector("#app *");
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.locator('[data-lesson="U1L1"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForFunction(() => window.__app.currentEx);
    const e = await page.evaluate(() => window.__app.currentEx);
    await page.locator(".choice").nth(e.options.findIndex((o) => !!o.correct)).tap();
    await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar");
    await page.clock.runFor(40000);
    const ended = await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 5000 }).then(() => true, () => false);
    check("Worker 一直不回应：快进 40 秒后“运行中…”已结束", ended, ended ? "" : (await page.locator(".outpanel pre").innerText()).slice(0, 60));
    check("Worker 一直不回应：超时后给出重试", (await page.locator("[data-retry-python]").count()) === 1);
    await page.waitForFunction(() => { const b = document.querySelector("[data-continue]"); return b && !b.disabled; }, null, { timeout: 3000 }).catch(() => {});
    await page.locator("[data-continue]").tap().catch(() => {});
    check("Worker 一直不回应：点“继续”后进入下一题", (await page.locator(".feedbar").count()) === 0);
    check("Worker 一直不回应：没有脚本错误（不依赖 __app.LIMITS）", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // 访问测试页：未配置 Supabase 时只测网站文件，并明确说明
    const { ctx, page, errors } = await open();
    await page.goto(BASE + "access-test.html", { waitUntil: "domcontentloaded" });
    await page.locator("#go").click();
    await page.waitForSelector("#done:not([hidden])", { timeout: 30000 });
    const rep = await page.locator("#report").inputValue();
    check("访问测试页：网站文件逐项给出结果（首页、图标、主程序都通过）", /通过 网站文件 index\.html/.test(rep) && /通过 网站文件 icon-192\.png/.test(rep) && /通过 主程序 assets\//.test(rep), rep.split("\n").filter((l) => /^(通过|失败)/.test(l)).join(" | ").slice(0, 200));
    check("访问测试页：Supabase 未配置时明确写出，不假装通过", /跳过 Supabase 未配置/.test(rep) && !/通过 Supabase/.test(rep));
    check("访问测试页：结果里有时区、浏览器和是否在微信里", /时区：/.test(rep) && /浏览器：/.test(rep) && /在微信\/QQ 里打开：否/.test(rep));
    check("访问测试页：没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // 构建产物的语法：应用自己的脚本不使用 es2020 之后才有的语法（启发式检查，不能代替旧版 iOS 真机；Pyodide 是预编译文件，不检查）
    const files = [];
    const walk = (d) => { for (const f of readdirSync(d, { withFileTypes: true })) { const p = join(d, f.name); if (f.isDirectory()) { if (f.name !== "pyodide") walk(p); } else if (/\.m?js$/.test(f.name)) files.push(p); } };
    walk(DIST);
    const rules = [
      ["类私有成员（this.#x）", /\bthis\.#[A-Za-z_$]/],
      ["类静态初始化块（static {）", /\bstatic\s*\{/],
      ["逻辑赋值（??= ||= &&=）", /(\?\?|\|\||&&)=[^=]/],
      ["顶层 await（行首顶格的 await）", /^await\s/m],
    ];
    const bad = [];
    for (const f of files) { const txt = readFileSync(f, "utf8"); for (const [n, re] of rules) if (re.test(txt)) bad.push(`${f.slice(DIST.length + 1)}：${n}`); }
    check(`构建产物（${files.length} 个脚本，含 Worker 和 sw.js）没有 es2020 之后的语法`, files.length > 3 && bad.length === 0, bad.join(" | "));
  }

  { // Python 不可用时的提示：区分离线 / 缺少功能 / 不能创建线程 / 原因未确认
    const hasText = async (page) => page.evaluate(() => window.__app.pythonUnavailableText());
    { // 原因未确认：Python 资源加载失败，但网络在线
      const { ctx, page } = await open({ route: (pg) => pg.route(/\/pyodide\//, (r) => r.abort()) });
      await page.waitForFunction(() => window.__app.runner.state === "loadError", null, { timeout: 20000 });
      const t = await hasText(page);
      check("Python 加载失败（在线、原因未确认）：写明“原因未确认”并附诊断信息，不断定是网络问题", /原因未确认/.test(t) && /诊断：/.test(t) && /可能是网络、浏览器版本/.test(t) && /iOS 16\.6/.test(t), t.replace(/\n/g, " / ").slice(0, 200));
      await ctx.close();
    }
    { // iPhone 系统低于 16.4：确定的不兼容，写出具体版本
      const OLD = "Mozilla/5.0 (iPhone; CPU iPhone OS 15_8 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
      const { ctx, page } = await open({ ua: OLD, route: (pg) => pg.route(/\/pyodide\//, (r) => r.abort()) });
      await page.waitForFunction(() => window.__app.runner.state === "loadError", null, { timeout: 20000 });
      const t = await hasText(page);
      check("iPhone 系统 15.8（低于 16.4）：写出具体版本和所需的 16.4，不说成网络问题", /iOS 15\.8/.test(t) && /16\.4/.test(t) && !/原因未确认/.test(t) && !/Python运行功能需要联网后加载/.test(t), t.slice(0, 90));
      await ctx.close();
    }
    { // 不能创建 Python 线程
      const { ctx, page } = await open({ init: () => { window.Worker = function () { throw new Error("SecurityError: 模拟"); }; } });
      await page.waitForFunction(() => window.__app.runner.state === "loadError", null, { timeout: 5000 });
      const t = await hasText(page);
      check("不能创建 Python 线程：明确说是环境不允许，并建议在浏览器打开", /不允许启动 Python 运行线程/.test(t) && /在浏览器打开/.test(t) && !/Python运行功能需要联网后加载/.test(t), t.slice(0, 80));
      await ctx.close();
    }
    { // 浏览器缺少 WebAssembly
      const { ctx, page } = await open({ init: () => { window.WebAssembly = undefined; } });
      const t = await hasText(page);
      check("浏览器没有 WebAssembly：明确写出缺少什么，不说成网络问题", /缺少：WebAssembly/.test(t) && !/Python运行功能需要联网后加载/.test(t), t.slice(0, 80));
      await ctx.close();
    }
    { // 离线
      const { ctx, page } = await open();
      await page.waitForTimeout(500);
      await ctx.setOffline(true);
      const t = await hasText(page);
      check("离线：仍然写“你现在离线。Python运行功能需要联网后加载”", /^你现在离线。Python运行功能需要联网后加载/.test(t), t.slice(0, 60));
      await ctx.close();
    }
  }

  { // 离线提示文字在深色输出面板上的对比度
    const lum = ([r, g, b]) => { const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    const rgb = (str) => str.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    for (const scheme of ["light", "dark"]) {
      const { ctx, page } = await open();
      await page.emulateMedia({ colorScheme: scheme });
      await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
      await page.evaluate(() => { document.body.insertAdjacentHTML("beforeend", '<details class="outpanel" open id="t-panel"><summary>运行结果</summary><pre class="out offline" id="t-pre">你现在离线。</pre></details>'); });
      const c = await page.evaluate(() => { const cs = getComputedStyle(document.getElementById("t-pre")); return { color: cs.color, bg: cs.backgroundColor }; });
      const r = ratio(rgb(c.color), rgb(c.bg));
      check(`离线提示文字对比度 ≥ 4.5（${scheme === "light" ? "浅色" : "深色"}主题）`, r >= 4.5, `${c.color} on ${c.bg} = ${r.toFixed(1)}:1`);
      await ctx.close();
    }
  }

  { // iPhone Safari 浏览器模式下的底栏留白：竖屏保留 70px，手机横屏缩小
    const { ctx, page } = await open();
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector(".tabbar");
    const pad = () => page.evaluate(() => getComputedStyle(document.querySelector(".tabbar")).paddingBottom);
    const cls = await page.evaluate(() => document.documentElement.classList.contains("ios-browser"));
    const portrait = await pad();
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(200);
    const landscape = await pad();
    check("iPhone Safari 浏览器模式：竖屏底栏留白仍是 70px", cls && portrait === "70px", `class=${cls} 竖屏=${portrait}`);
    check("iPhone Safari 浏览器模式：手机横屏底栏留白缩小（≤ 30px），仍不为 0", parseFloat(landscape) <= 30 && parseFloat(landscape) >= 20, `横屏=${landscape}`);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(200);
    check("横屏回到竖屏后，底栏留白恢复 70px", (await pad()) === "70px");
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
