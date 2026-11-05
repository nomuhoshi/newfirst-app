// 白屏 / 打不开诊断页（access-test.html）：模拟三种故障，确认用户能看到可读的提示，并能复制诊断结果。
//   A 基线：全部通过，Python 真实启动，结论写“全部通过”，复制成功；
//   B 主脚本加载失败（assets/main-*.js 被拦截）→ 该行失败 + 结论说“打开应用会白屏”；
//   C Python 工作线程启动失败（py-worker 文件 / Pyodide 文件被拦截）→ 失败 + 结论说“运行代码会失败”；
//   D 浏览器离线（页面打开后断网）→ 离线提示 + 结论说“没有网络”；
//   E 复制：剪贴板接口不可用、execCommand 也失败时，不能显示“已复制”，要提示长按手动复制；
//   F 测试页自己的脚本出意外（TextDecoder 不存在）→ 仍然出结果、可复制，不会停在“测试中……”。
// 运行：npm run build && MOBILE_BROWSER=chromium|webkit node tests/access-test.test.mjs   （DIST_DIR 可指定别的构建目录）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(process.env.DIST_DIR || new URL("../dist", import.meta.url).pathname);
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip" };
const results = []; const B = process.env.MOBILE_BROWSER || "chromium";
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${B}] ${n}${!ok && d ? "  — " + String(d).slice(0, 300) : ""}`); };
const srv = createServer((q, r) => {
  const u = new URL(q.url, "http://x"); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { r.writeHead(404); r.end("not found"); return; }
  r.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); r.end(readFileSync(p));
});
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const BASE = `http://127.0.0.1:${srv.address().port}/`;
const browserType = B === "webkit" ? webkit : chromium; let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

async function open({ init, block, offlineAfterLoad = false, clipboard = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: B !== "webkit" ? true : undefined, serviceWorkers: "block" });
  if (clipboard && B === "chromium") await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE.slice(0, -1) }).catch(() => {});
  if (init) await ctx.addInitScript(init);
  if (block) await ctx.route((url) => block.test(url.pathname), (r) => r.abort("failed"));
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(BASE + "access-test.html", { waitUntil: "domcontentloaded" });
  if (offlineAfterLoad) await ctx.setOffline(true);
  return { ctx, page, errs };
}
const run = async (page, ms = 120000) => { await page.locator("#go").tap(); await page.waitForFunction(() => !document.querySelector("#done").hidden, null, { timeout: ms }); return { rows: await page.locator("#out .row").allInnerTexts(), verdict: await page.locator("#verdict").innerText().catch(() => ""), report: await page.locator("#report").inputValue() }; };

try {
  { // A 基线
    const { ctx, page, errs } = await open();
    const r = await run(page);
    check("A 基线：网站文件、主程序、Python 启动都是 ✅，没有 ❌", r.rows.length >= 6 && r.rows.every((x) => !x.startsWith("❌")) && r.rows.some((x) => /Python 启动/.test(x) && x.startsWith("✅")), r.rows.join(" | "));
    check("A 基线：结论写“全部通过”，报告里带结论和环境信息", /全部通过/.test(r.verdict) && /结论/.test(r.report) && /浏览器：/.test(r.report), r.verdict);
    await page.locator("#copy").tap(); await page.waitForTimeout(400);
    const cp = await page.locator("#copy").innerText();
    const clip = B === "chromium" ? await page.evaluate(() => navigator.clipboard.readText()).catch(() => null) : null;
    check("A 复制：点“复制结果”后按钮显示“已复制”" + (clip !== null ? "，剪贴板里就是报告全文" : ""), /已复制/.test(cp) && (clip === null || clip === r.report), cp);
    check("A 基线：页面没有脚本报错", errs.length === 0, errs.join("|")); await ctx.close();
  }
  { // B 主脚本加载失败
    const { ctx, page } = await open({ block: /\/assets\/main-[^/]+\.js$/ });
    const r = await run(page);
    const row = r.rows.find((x) => /主程序/.test(x));
    check("B 主脚本加载失败：有一行 ❌ 写明“主程序”和文件名，带可读的网络说明", row && row.startsWith("❌") && /assets\/main-/.test(row) && /没有网络|被拦截|域名/.test(row), r.rows.join(" | "));
    check("B 主脚本加载失败：结论说“主程序没能下载：打开应用会白屏”，报告里也有", /主程序没能下载/.test(r.verdict) && /失败 主程序/.test(r.report), r.verdict);
    await page.locator("#copy").tap(); await page.waitForTimeout(300);
    check("B 主脚本加载失败：仍然能复制结果", /已复制/.test(await page.locator("#copy").innerText()) || B !== "chromium"); await ctx.close();
  }
  { // C Python 工作线程启动失败：两种——工作线程文件拦截 / Pyodide 大文件拦截
    for (const [name, block] of [["工作线程文件被拦截", /\/assets\/py-worker-[^/]+\.js$/], ["Pyodide 的 wasm 被拦截", /\/pyodide\/pyodide\.asm\.wasm$/]]) {
      const { ctx, page } = await open({ block });
      const r = await run(page);
      const row = r.rows.find((x) => /Python/.test(x) && x.startsWith("❌"));
      check(`C Python 启动失败（${name}）：有一行 ❌ 说明 Python 没启动起来`, !!row, r.rows.join(" | "));
      check(`C Python 启动失败（${name}）：结论说“Python 没能启动……运行代码会失败”，报告里也有`, /Python 没能启动/.test(r.verdict) && /失败 .*Python/.test(r.report), r.verdict);
      check(`C Python 启动失败（${name}）：网站文件和主程序仍是 ✅（只有 Python 那里失败，定位准确）`, r.rows.filter((x) => /^(✅|❌) (网站文件|主程序)/.test(x)).every((x) => x.startsWith("✅")), r.rows.join(" | ")); await ctx.close();
    }
    { // 不支持模块工作线程（微信 / QQ 内置浏览器偶尔）
      const { ctx, page } = await open({ init: () => { window.Worker = function () { throw new TypeError("module workers are not supported"); }; } });
      const r = await run(page, 60000);
      check("C Python 启动失败（浏览器不能创建工作线程）：写明“不能创建模块工作线程”，选择题仍可用的说明", r.rows.some((x) => x.startsWith("❌") && /不能创建模块工作线程/.test(x) && /选择题仍可用/.test(x)), r.rows.join(" | ")); await ctx.close();
    }
  }
  { // D 离线（页面已打开后断网）
    const { ctx, page } = await open({ offlineAfterLoad: true });
    const r = await run(page, 60000);
    check("D 离线：所有检查都是 ❌，并且有一行说明“浏览器当前离线”", r.rows.every((x) => !x.startsWith("✅")) && r.rows.some((x) => /离线/.test(x)), r.rows.join(" | "));
    check("D 离线：结论说“没有网络连接（离线）”和“所有检查都失败”", /没有网络连接（离线）/.test(r.verdict) && /所有检查都失败/.test(r.verdict), r.verdict);
    check("D 离线：失败的行带人话说明（请求没能发出去 / 没有网络），不是只有 TypeError", r.rows.filter((x) => /^❌ 网站文件/.test(x)).length >= 4 && r.rows.filter((x) => /^❌ 网站文件/.test(x)).every((x) => /请求没能发出去|没有网络/.test(x)), r.rows.join(" | "));
    check("D 离线：报告可复制（文字框里有内容）", /离线/.test(r.report) && r.report.length > 100); await ctx.close();
  }
  { // E 复制：剪贴板接口不可用、execCommand 失败 → 不能假装成功
    const { ctx, page } = await open({ clipboard: false, init: () => { Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }); document.execCommand = () => false; } });
    await run(page, 120000); await page.locator("#copy").tap(); await page.waitForTimeout(300);
    const t = await page.locator("#copy").innerText();
    check("E 复制失败时：按钮不显示“已复制”，而是提示长按文字框手动复制", !/已复制/.test(t) && /长按/.test(t), t);
    check("E 复制失败时：文字框里仍有完整报告可手动复制", (await page.locator("#report").inputValue()).length > 100); await ctx.close();
  }
  { // F 测试页自己脚本出意外：TextDecoder 不存在
    const { ctx, page } = await open({ init: () => { delete window.TextDecoder; } });
    let finished = true; let r = null;
    try { r = await run(page, 60000); } catch { finished = false; }
    check("F 测试页脚本出意外（没有 TextDecoder）：仍然出结果，不会一直停在“测试中……”", finished && r && r.report.length > 50, finished ? "" : "按钮一直停在：" + (await page.locator("#go").innerText()));
    check("F 测试页脚本出意外：结果里有一条说明（失败 / 页面脚本报错），能复制", finished && /失败|页面脚本报错|测试页自己出错/.test(r?.report || ""), r?.report); await ctx.close();
  }
} catch (e) { console.log("❌ 测试异常：" + (e.stack || e)); results.push(false); }
await browser.close(); srv.closeAllConnections(); srv.close();
const pass = results.filter(Boolean).length; console.log(`\n访问诊断页：${pass}/${results.length} 通过`); process.exit(pass === results.length ? 0 : 1);
