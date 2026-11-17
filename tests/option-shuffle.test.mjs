// 课程里选输出题的选项打乱（以前数据里正确答案都排第一，课程按数据顺序显示）。真实构建，手机视口，用 U1L4（3 道选输出 + 1 道填空）：
//   1. 每次开始一关都重新打乱：多次进入同一关，正确选项出现在不止一个位置（不再总在第一个）；
//   2. 屏幕上选项的顺序 = window.__app.currentEx（实际展示的那道题）的选项顺序，只是同一组选项换了位置（文字、解释、正确标记跟着走）；
//   3. 判分只看选项本身：按“文字”点正确的一定答对、点错误的一定答错，与位置无关；
//   4. 稳定：选中 / 答题 / 看反馈期间选项不换位；答错后这道题排到最后再做时，选项顺序和第一次完全一样。
// 运行：npm run build && node tests/option-shuffle.test.mjs [chromium|webkit]   （也认 MOBILE_BROWSER）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const PORT = 4411 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const unit1 = JSON.parse(readFileSync(join(ROOT, "content/unit1.json")));
const L4 = unit1.lessons.find((l) => l.id === "U1L4");
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = ENGINE === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
ctx.setDefaultTimeout(20000);
const NOW = Date.now();
const seed = { version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: { U1L1: true, U1L2: true, U1L3: true }, lessonsCompleted: 3, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } };
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(seed));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));

const norm = (t) => String(t).replace(/\s+/g, " ").trim();
const domOptions = () => page.locator(".choice").evaluateAll((els) => els.map((e) => (e.innerText || "").replace(/\s+/g, " ").trim()));
const cur = () => page.evaluate(() => window.__app.currentEx);
async function startL4() {
  await page.goto(BASE); await page.waitForSelector(".pathview");
  await page.locator('[data-lesson="U1L4"]').click(); await page.locator(".overlay .btn3d.primary").click();
  await page.getByRole("button", { name: "继续", exact: true }).click(); await page.waitForSelector(".choice");
}

// 1 + 2：多次进入同一关
const positions = []; let domMatchesCurrent = true, samePermutation = true, firstDom = [];
for (let n = 0; n < 12; n++) {
  await startL4();
  const ex = await cur(), dom = await domOptions();
  const data = L4.exercises.find((e) => e.prompt === ex.prompt && JSON.stringify(e.code) === JSON.stringify(ex.code));
  if (!data || ex.type !== "predict") { check("找得到当前题的数据", false, ex.prompt); continue; }
  if (JSON.stringify(dom) !== JSON.stringify(ex.options.map((o) => norm(o.text)))) domMatchesCurrent = false;
  if ([...ex.options].map((o) => o.text).sort().join("\u0001") !== [...data.options].map((o) => o.text).sort().join("\u0001")) samePermutation = false;
  // 每个选项的“是否正确 / 解释”跟着文字走
  for (const o of ex.options) { const d = data.options.find((x) => x.text === o.text); if (!d || !!d.correct !== !!o.correct || d.why !== o.why) samePermutation = false; }
  positions.push(ex.options.findIndex((o) => o.correct));
  if (n === 0) firstDom = dom;
}
check("屏幕上的选项顺序 = 实际展示那道题（currentEx）的选项顺序", domMatchesCurrent);
check("打乱只是换位置：同一组选项，文字、解释、正确标记跟着选项走", samePermutation);
check("多次进入同一关：正确选项出现在不止一个位置，不再总是第一个", new Set(positions).size > 1 && positions.some((i) => i > 0), JSON.stringify(positions));

// 3 + 4：一整关，按文字答题；第一题先故意答错
await startL4();
const seen = new Map(); // prompt+code → 第一次显示时的选项顺序
let wrongPrompt = null, wrongOrder = null, retryOrder = null, steps = 0;
const queueGuard = 12;
while (steps++ < queueGuard) {
  if (await page.locator(".finish").count()) break;
  const ex = await cur(); const key = ex.prompt + "\u0001" + ex.code;
  const data = L4.exercises.find((e) => e.prompt === ex.prompt && JSON.stringify(e.code) === JSON.stringify(ex.code));
  if (ex.type === "predict") {
    const dom0 = await domOptions();
    const rightText = data.options.find((o) => o.correct).text, wrongText = data.options.find((o) => !o.correct).text;
    const willWrong = wrongPrompt === null;
    const textToClick = norm(willWrong ? wrongText : rightText);
    const idx = dom0.findIndex((t) => t === textToClick);
    if (idx < 0) { check("按文字找得到要点的选项", false, textToClick); break; }
    if (seen.has(key)) { retryOrder = dom0; check("答错的题排到最后再做：选项顺序和第一次完全一样（不换位）", JSON.stringify(dom0) === JSON.stringify(seen.get(key)), `${JSON.stringify(seen.get(key))} → ${JSON.stringify(dom0)}`); }
    else seen.set(key, dom0);
    await page.locator(".choice").nth(idx).click();
    check("选中后选项没有换位", JSON.stringify(await domOptions()) === JSON.stringify(dom0));
    await page.locator("[data-check]").click(); await page.waitForSelector(".feedbar");
    const fb = await page.locator(".feedbar").textContent();
    check(`${willWrong ? "点错误选项（按文字）→ 判错" : "点正确选项（按文字）→ 判对"}`, willWrong ? fb.includes("不对哦") : fb.includes("答对了"), fb.slice(0, 40));
    check("看反馈时选项没有换位", JSON.stringify(await domOptions()) === JSON.stringify(dom0));
    if (willWrong) { wrongPrompt = key; wrongOrder = dom0; }
  } else if (ex.type === "fill") {
    for (const t of ex.answer) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
    await page.locator("[data-check]").click(); await page.waitForSelector(".feedbar");
  } else { check("U1L4 只应有选输出题和填空题", false, ex.type); break; }
  await page.locator("[data-continue]:not([disabled])").click();
  await page.waitForSelector("[data-check], .finish");
}
check("答错的那道选输出题确实排到最后又出现了一次", retryOrder !== null && wrongPrompt !== null);
check("整关通关（没有卡住）", (await page.locator(".finish").count()) === 1);
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
