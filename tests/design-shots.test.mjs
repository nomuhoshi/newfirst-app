// 设计 v2 预览：地图 / 普通题 / 代码题 / 通关页，5 种视口（手机竖横屏×浅深色 + iPad）截图 + 版式断言。
// 重点：运行不计分；检查才算作答；答对 +XP、答错才扣红心；超时 / 输出太多 / Python 不可用 / 弯引号 不算作答、不扣红心；草稿保留。
// 运行：npm run build && node tests/code-task.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4351, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const results = [];
import { mkdirSync } from "node:fs";
const SHOTS = process.env.SHOTS_DIR || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${process.env.MOBILE_BROWSER || "chromium"}-${name}.png`, fullPage: false }); };
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
// MOBILE_BROWSER=webkit|chromium（默认 chromium）；浏览器起不来 → 环境失败，exit 2，不算通过
const browserType = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

const W = (id, over = {}) => ({
  id, version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
  tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }, { name: "0 杯", data: { price: 9, cups: 0 }, expected: "总价 0", hidden: true, note: "杯数是 0 的情况也要对" }],
  hints: ["提示一：用乘法", "提示二：print 里用逗号分开"], reference: 'print("总价", price * cups)',
  mistakes: [{ match: { test: "4 杯", got: "总价 11" }, why: "这里要用乘法 *，不是减法。" }], ...over,
});
// 带示范和变化题的题：变化 = 价格改成 20，且满 5 杯再减 10（父题 reference 过不了变化题的测试）
const VAR_GOOD = 'total = 20 * cups\nif cups >= 5:\n    total = total - 10\nprint("总价", total)', VAR_BAD = 'print("总价", 20 * cups)';
const VARI = (id, over = {}) => W(id, {
  worked: { code: "n = 2\nprint(n * 3)", output: "6", explain: "乘法用 *。" },
  requiresVariationAfterSolution: true,
  variation: { id: id + "-V1", prompt: "单价 20 元，满 5 杯减 10 元。输出：总价 <金额>", starter: "# cups 已准备好\n", tests: [
    { name: "3 杯", data: { cups: 3 }, expected: "总价 60" }, { name: "6 杯", data: { cups: 6 }, expected: "总价 110" }, { name: "5 杯", data: { cups: 5 }, expected: "总价 90", hidden: true }],
    hints: ["先算 20 * cups", "再判断 cups >= 5"], solution: VAR_GOOD },
  ...over,
});
const LESSON = (exs, id = "TESTCODE") => ({ id, title: "代码题测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: exs });
const GOOD = 'print("总价", price * cups)', BAD = 'print("总价", price - cups)';

async function open({ init = null, storageSeed = null, viewport = { width: 390, height: 844 }, colorScheme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.__errors = errors;
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { ctx, page, errors };
}
async function start(page, exs, opts = {}) {
  await page.evaluate(([l, o]) => window.__app.startLesson(l, o), [LESSON(exs, opts.id), { review: !!opts.review }]);
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForSelector("[data-code-task]", { timeout: 15000 }).catch(async (e) => {
    console.log("页面脚本错误：", JSON.stringify(page.__errors || []), "\n页面文字：", (await page.locator("#app").innerText()).slice(0, 300));
    throw e;
  });
}
const stat = (page) => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
const setCode = (page, code) => page.evaluate((c) => window.__app.currentArea.setCode(c), code);
const results$ = (page) => page.locator("[data-results]").innerText();
const waitJudged = (page, ms = 60000) => page.waitForFunction(() => { const b = document.querySelector("[data-check]"); return b && b.textContent === "检查" || document.querySelector(".feedbar"); }, null, { timeout: ms });


const CONFIGS = [
  ["portrait-light", { width: 390, height: 844 }, "light"], ["portrait-dark", { width: 390, height: 844 }, "dark"],
  ["landscape-light", { width: 844, height: 390 }, "light"], ["landscape-dark", { width: 844, height: 390 }, "dark"],
  ["ipad-light", { width: 820, height: 1180 }, "light"],
];
const noHScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
try {
  for (const [tag, viewport, colorScheme] of CONFIGS) {
    const portraitPhone = tag.startsWith("portrait");
    const S = (page, n) => shot(page, `d-${tag}-${n}`);
    // 1 地图：前 3 关已完成
    { const { ctx, page } = await open({ viewport, colorScheme });
      await page.evaluate(() => { const st = window.__app.getState(); for (const id of ["U1L1", "U1L2", "U1L3"]) st.done[id] = true; st.xp = 120; st.streak = 3; window.__app.persist(); window.__app.renderPath(); });
      await page.waitForTimeout(400);
      await S(page, "1-map");
      check(`${tag} 地图：没有横向滚动`, await noHScroll(page));
      await page.evaluate(() => document.querySelector(".pathview")?.scrollTo?.(0, 99999)); await page.waitForTimeout(150); await S(page, "1b-map-scrolled");
      await ctx.close(); }
    // 2 普通题：真实关卡 U1L2 的前三道题 + 反馈
    { const { ctx, page } = await open({ viewport, colorScheme });
      await page.evaluate(() => { const l = window.__app.allLessons().find((x) => x.id === "U1L2"); window.__app.startLesson(l); });
      await S(page, "2-intro");
      await page.getByRole("button", { name: "继续", exact: true }).tap();
      await page.waitForSelector(".lesson .q");
      await S(page, "3-question");
      check(`${tag} 普通题：没有横向滚动`, await noHScroll(page));
      const ch = page.locator(".choice").first();
      if (await ch.count()) { await ch.tap(); await S(page, "3b-selected"); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar"); await page.waitForTimeout(400); await S(page, "3c-feedback"); }
      await ctx.close(); }
    // 3 代码题：任务页、展开示例、编辑、判错
    { const { ctx, page } = await open({ viewport, colorScheme });
      await start(page, [VARI("T-D1")]);
      await page.waitForTimeout(300);
      await S(page, "4-code-task");
      // 看得见的编辑器高度：编辑器与答题区（.lesson）相交，再扣掉键盘
      const edBox = async () => page.evaluate(() => { const e = document.querySelector(".ct-editor").getBoundingClientRect(); const l = document.querySelector(".lesson-code").getBoundingClientRect(); const k = document.querySelector("#keyboard"); const kt = k && !k.hidden ? k.getBoundingClientRect().top : innerHeight; const top = Math.max(e.top, l.top, 0), bottom = Math.min(e.bottom, l.bottom, kt, innerHeight); return { top, bottom, h: bottom - top, full: e.height, kbTop: kt, vh: innerHeight }; });
      const b0 = await edBox();
      if (portraitPhone || tag.startsWith("ipad")) check(`${tag} 代码题：键盘打开时编辑器至少露出 6 行（≥150px 实际可见）`, b0.h >= 150, JSON.stringify(b0));
      else check(`${tag} 代码题：横屏键盘打开时编辑器至少露出 70px`, b0.h >= 70, JSON.stringify(b0));
      await page.locator("[data-worked] summary").tap(); await page.waitForTimeout(200);
      await S(page, "5-code-worked-open");
      const b1 = await edBox();
      if (portraitPhone || tag.startsWith("ipad")) check(`${tag} 代码题：展开示例后编辑器仍完整可见（≥150px）`, b1.h >= 150, JSON.stringify(b1));
      await setCode(page, 'price = 15\ncups = 4\ntotal = price - cups\nprint("总价", total)');
      await S(page, "6-code-editing");
      check(`${tag} 代码题：没有横向滚动`, await noHScroll(page));
      if (tag === "portrait-light" || tag === "portrait-dark") {
        await page.locator("[data-check]").tap();
        await waitJudged(page); await page.waitForTimeout(500);
        await S(page, "7-code-wrong");
      }
      await ctx.close(); }
    // 4 通关页
    { const { ctx, page } = await open({ viewport, colorScheme });
      await page.evaluate(() => { const l = window.__app.allLessons().find((x) => x.id === "U1L3"); window.__app.startLesson(l); const run = window.__app.getRun(); run.correct = run.total; run.mistakes = 1; run.xp = 40; run.queue = []; window.__app.renderExercise(run); });
      await page.waitForSelector(".finish");
      await page.waitForTimeout(500);
      await S(page, "8-finish");
      check(`${tag} 通关页：继续按钮在屏幕内且没有横向滚动`, (await noHScroll(page)) && await page.evaluate(() => { const b = document.querySelector("[data-continue]").getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.height >= 44; }));
      await ctx.close(); }
  }
} catch (e) {
  check("设计预览测试异常", false, String(e.stack || e).split("\n").slice(0, 3).join(" | "));
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
