// 14 天导出提醒的浏览器测试：只在地图页出现、不打断答题、可稍后、导出后重新计时。
// 运行：npm run build && node tests/export-reminder.test.mjs
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
// 每个场景一个全新环境：带 8 个已完成关卡的旧存档，首次使用时间设成 ageDays 天前
async function open(ageDays, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block", acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message))); page.__errors = errors;
  await page.addInitScript(([raw, first, extra]) => {
    if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
    Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k));
    localStorage.setItem("suipian.progress", raw);
    if (first) localStorage.setItem("suipian.meta.backupBase", String(first));
    for (const [k, v] of Object.entries(extra)) localStorage.setItem(k, String(v));
  }, [FIX, Date.now() - ageDays * DAY, extra]);
  await page.goto(URLBASE); await page.waitForSelector(".statsbar", { timeout: 15000 });
  return { ctx, page };
}
const count = (page) => page.locator("[data-export-reminder]").count();
try {
  { // 升级用户：没有起点，启动时以本次升级为基准，不按安装时间推算
    const { ctx, page } = await open(0);
    check("升级用户（有进度、没有备份起点）：不立刻提醒", (await count(page)) === 0);
    const base = Number(await page.evaluate(() => localStorage.getItem("suipian.meta.backupBase")));
    check("启动时以本次打开为基准建立起点", Math.abs(base - Date.now()) < 60000);
    await ctx.close();
  }
  { // 满 14 天：地图页出现，“我的”页不出现
    const { ctx, page } = await open(15);
    check("满 14 天：地图页出现导出提醒，有“导出进度”和“稍后”", (await count(page)) === 1 && (await page.locator("[data-export-now]").count()) === 1 && (await page.locator("[data-export-later]").count()) === 1);
    check("提醒不承诺永久不丢", !/永久|一定不会丢|不会丢失/.test(await page.locator("[data-export-reminder]").innerText()));
    check("提醒是页面里的一条提示：没有弹窗遮罩", (await page.locator(".overlay").count()) === 0);
    await page.getByRole("button", { name: "我的", exact: true }).tap(); await page.waitForSelector("[data-backup]");
    check("“我的”页不出现提醒", (await count(page)) === 0);
    await page.getByRole("button", { name: "学习", exact: true }).tap(); await page.waitForSelector(".statsbar");
    check("回到地图页又出现", (await count(page)) === 1);
    await page.locator('[data-lesson="U1L1"]').tap(); await page.waitForSelector(".overlay");
    await page.locator(".overlay .btn3d.primary").tap(); await page.waitForTimeout(400);
    check("进入关卡后没有提醒（不打断答题）", (await count(page)) === 0);
    check("无脚本错误", page.__errors.length === 0, page.__errors.join("; "));
    await ctx.close();
  }
  { // 没满 14 天：不出现
    const { ctx, page } = await open(5);
    check("不满 14 天：不出现", (await count(page)) === 0); await ctx.close();
  }
  { // 稍后：当前消失，刷新后 3 天内不再出现
    const { ctx, page } = await open(15);
    await page.locator("[data-export-later]").tap();
    check("点“稍后”：提示消失", (await count(page)) === 0);
    await page.reload(); await page.waitForSelector(".statsbar");
    check("刷新后仍不出现（3 天内）", (await count(page)) === 0);
    const snooze = Number(await page.evaluate(() => localStorage.getItem("suipian.meta.exportSnooze")));
    check("稍后记录约 3 天", Math.abs(snooze - Date.now() - 3 * DAY) < 60000);
    await ctx.close();
  }
  { // 稍后已过期：再次提醒
    const { ctx, page } = await open(20, { "suipian.meta.exportSnooze": Date.now() - 1000 });
    check("稍后过期后再次出现", (await count(page)) === 1); await ctx.close();
  }
  { // 导出：下载只是请求；用户点“我已保存好”才重新计时
    const { ctx, page } = await open(15);
    const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("[data-export-now]").tap()]);
    check("点“导出进度”：下载进度文件", /^suipian-progress-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()));
    check("下载后先让用户确认文件在不在，不宣称已备份成功", (await page.locator("[data-export-confirm]").count()) === 1 && !/已备份|备份成功/.test(await page.locator("[data-export-reminder]").innerText()));
    check("确认之前不记导出时间（不重置 14 天）", (await page.evaluate(() => localStorage.getItem("suipian.meta.lastExport"))) === null);
    await page.reload(); await page.waitForSelector(".statsbar");
    check("没确认就刷新：提醒仍然在", (await count(page)) === 1);
    await page.locator("[data-export-now]").tap().catch(() => {});
    await page.locator("[data-export-saved]").tap();
    check("点“我已保存好”：提示消失", (await count(page)) === 0);
    const last = Number(await page.evaluate(() => localStorage.getItem("suipian.meta.lastExport")));
    check("此时才记录导出时间（重新计时）", Math.abs(last - Date.now()) < 60000);
    await page.reload(); await page.waitForSelector(".statsbar");
    check("刷新后不再出现", (await count(page)) === 0); await ctx.close();
  }
  { // 确认写入失败：不显示成功，确认区保留
    const { ctx, page } = await open(15);
    await Promise.all([page.waitForEvent("download"), page.locator("[data-export-now]").tap()]);
    await page.evaluate(() => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === "suipian.meta.lastExport") throw new DOMException("full", "QuotaExceededError"); return real.call(this, k, v); }; });
    await page.locator("[data-export-saved]").tap();
    check("确认写入失败：提示“提醒时间未更新”，确认区还在，不说“14 天后再提醒”", /提醒时间未更新/.test(await page.locator("[data-export-confirm]").innerText()) && (await count(page)) === 1 && !/14 天后再提醒/.test(await page.locator("body").innerText()));
    check("确认写入失败时没有记录导出时间", (await page.evaluate(() => localStorage.getItem("suipian.meta.lastExport"))) === null);
    await ctx.close();
  }
  { // 稍后写入失败
    const { ctx, page } = await open(15);
    await page.evaluate(() => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k) === "suipian.meta.exportSnooze") throw new DOMException("full", "QuotaExceededError"); return real.call(this, k, v); }; });
    await page.locator("[data-export-later]").tap();
    check("稍后写入失败：提示记不住", /记不住/.test(await page.locator(".toast").innerText()));
    await ctx.close();
  }
  { // 导出过的人再隔 14 天又提醒
    const { ctx, page } = await open(40, { "suipian.meta.lastExport": Date.now() - 15 * DAY });
    check("上次导出已 15 天：提醒", (await count(page)) === 1); await ctx.close();
  }
  { // 刚用不久但导出过：不提醒
    const { ctx, page } = await open(40, { "suipian.meta.lastExport": Date.now() - 2 * DAY });
    check("上次导出仅 2 天：不提醒", (await count(page)) === 0); await ctx.close();
  }
} finally { await browser.close(); srv.closeAllConnections(); srv.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
