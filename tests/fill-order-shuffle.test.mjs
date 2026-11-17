// 闯关和随机练习里填空词块、排序题初始排列的打乱。真实构建，手机视口；闯关用 U1L3（选输出 ×2 + 排序 + 填空），练习用 U1L1、L2、L3、L6 的 16 道题（少于 20，选 20 题时全部抽到，结果不靠运气）。
//   1. 屏幕上的词块 / 代码行顺序 = window.__app.currentEx（实际展示那道题）的顺序；
//   2. 多次进入同一关：填空的正确词块、排序题的初始排列不再固定（不总是同一个位置 / 同一个排列）；排序题初始排列绝不是正确答案；
//   3. 稳定：选词块 / 点行 / 看反馈期间不换位；答错后这道题排到最后再做时，顺序和第一次完全一样；
//   4. 判分只看词块文字 / 行文字：按文字答对 → 判对并拿 XP（一关 4 题 ×10 + 通关 10 = 50），答错再答对同样；
//   5. 随机练习路径：同样的检查，整轮不改 XP。
// 运行：npm run build && node tests/option-shuffle.test.mjs [chromium|webkit]   （也认 MOBILE_BROWSER）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const PORT = 4421 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;

let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = ENGINE === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const NOW = Date.now();
const mkSeed = (done) => JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
async function openPage(done) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(20000);
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, mkSeed(done));
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  return { ctx, page, errors };
}
const q = (t) => t.replace(/"/g, '\\"');
const lineText = (ex, k) => ex.lines[k];
const isOrderCorrect = (ex, seq) => ex.answers.some((a) => a.map((k) => lineText(ex, k)).join("\n") === seq.map((k) => lineText(ex, k)).join("\n"));
const domTokens = (page) => page.locator(".bank-tokens .tok").evaluateAll((els) => els.map((e) => e.dataset.token));
const domLines = (page) => page.locator(".order-bank [data-line]").evaluateAll((els) => els.map((e) => Number(e.dataset.line)));
const cur = (page) => page.evaluate(() => window.__app.currentEx);

// 在当前题上作答（按文字 / 按行号，与位置无关）。返回 {type, before}：before = 作答前屏幕上的顺序
async function answerCurrent(page, correct, seen, key, label) {
  const ex = await cur(page);
  let before = null;
  if (ex.type === "predict") {
    const idx = ex.options.findIndex((o) => !!o.correct === correct); await page.locator(".choice").nth(idx).click();
  } else if (ex.type === "fill") {
    before = await domTokens(page);
    check(`${label}：填空词块的屏幕顺序 = currentEx.tokens`, JSON.stringify(before) === JSON.stringify(ex.tokens), JSON.stringify([before, ex.tokens]));
    if (seen.has(key)) check(`${label}：答错后重做同一道填空题，词块顺序和第一次完全一样`, JSON.stringify(seen.get(key)) === JSON.stringify(before), JSON.stringify([seen.get(key), before]));
    else seen.set(key, before);
    const toks = correct ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t) && !(ex.initial || []).includes(t)) ?? ex.tokens.find((t) => !ex.answer.includes(t)) : a));
    for (const t of toks) await page.locator(`.kchip.tok[data-token="${q(t)}"]`).click();
    check(`${label}：选词块期间顺序没有变化`, JSON.stringify(await domTokens(page)) === JSON.stringify(before));
  } else if (ex.type === "order") {
    before = await domLines(page);
    check(`${label}：排序题行的屏幕顺序 = currentEx.shuffled`, JSON.stringify(before) === JSON.stringify(ex.shuffled), JSON.stringify([before, ex.shuffled]));
    check(`${label}：排序题初始排列不是正确答案`, !isOrderCorrect(ex, before), JSON.stringify(before));
    if (seen.has(key)) check(`${label}：答错后重做同一道排序题，初始排列和第一次完全一样`, JSON.stringify(seen.get(key)) === JSON.stringify(before), JSON.stringify([seen.get(key), before]));
    else seen.set(key, before);
    const seq = correct ? ex.answers[0] : [...ex.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click();
  }
  await page.locator("[data-check]").click(); await page.waitForSelector(".feedbar");
  if (ex.type === "fill" || ex.type === "order") { const fb = await page.locator(".feedbar").textContent(); check(`${label}：按${ex.type === "fill" ? "词块文字" : "行号"}${correct ? "答对 → 判对" : "答错 → 判错"}`, correct ? fb.includes("答对了") : fb.includes("不对哦"), fb.slice(0, 30)); }
  return { type: ex.type, before, ex };
}

// ===== 闯关路径：U1L3，多次进入 =====
{
  const { ctx, page, errors } = await openPage(["U1L1", "U1L2"]);
  const fillPos = [], orderInit = [];
  for (let run = 0; run < 10; run++) {
    if (run > 0) await page.evaluate(() => sessionStorage.removeItem("seeded")); // 下一次进入重新种入“U1L3 未通关”的存档，每次都是首次通关（XP 口径一致）
    await page.goto(BASE); await page.waitForSelector(".pathview");
    await page.locator('[data-lesson="U1L3"]').click(); await page.locator(".overlay .btn3d.primary").click();
    await page.getByRole("button", { name: "继续", exact: true }).click(); await page.waitForSelector("[data-check]");
    const xp0 = await page.evaluate(() => window.__app.getState().xp);
    const seen = new Map(); let wrongDone = new Set(); let steps = 0;
    while (steps++ < 12 && !(await page.locator(".finish").count())) {
      const ex = await cur(page); const key = ex.prompt + "\u0001" + (ex.code || "");
      const wantWrong = run === 0 && (ex.type === "fill" || ex.type === "order") && !wrongDone.has(key);
      if (wantWrong) wrongDone.add(key);
      const r = await answerCurrent(page, !wantWrong, seen, key, `闯关第 ${run + 1} 次进入 ${ex.type}`);
      if (r.type === "fill") fillPos.push(r.before.indexOf(r.ex.answer[0]));
      if (r.type === "order" && !seen.has("order-recorded-" + run)) { orderInit.push(JSON.stringify(r.before)); seen.set("order-recorded-" + run, 1); }
      await page.locator("[data-continue]:not([disabled])").click(); await page.waitForSelector("[data-check], .finish");
    }
    check(`闯关第 ${run + 1} 次进入：整关通关，XP 增加 50（4 题 ×10 + 通关 10；${run === 0 ? "填空 / 排序先答错一次" : "全答对"}）`, (await page.locator(".finish").count()) === 1 && (await page.evaluate(() => window.__app.getState().xp)) - xp0 === 50, `xp ${xp0}→${await page.evaluate(() => window.__app.getState().xp)}`);
  }
  check("多次进入同一关：填空的正确词块出现在不止一个位置", new Set(fillPos).size > 1, JSON.stringify(fillPos));
  check("多次进入同一关：排序题的初始排列不止一种", new Set(orderInit).size > 1, JSON.stringify(orderInit));
  check("闯关路径无脚本错误", errors.length === 0, errors.join(" | "));
  await ctx.close();
}

// ===== 随机练习路径：U1L1/L2/L3/L6 =====
{
  const done = ["U1L1", "U1L2", "U1L3", "U1L6"]; // 共 16 题（< 20）：选 20 题时全部抽到，其中填空 5 题、排序 3 题，每次运行都一样（不靠运气）
  const { ctx, page, errors } = await openPage(done);
  await page.goto(BASE); await page.waitForSelector(".pathview");
  const xp0 = await page.evaluate(() => window.__app.getState().xp);
  await page.locator("[data-practice-entry]").click(); await page.waitForSelector(".practice-setup");
  await page.locator('[data-practice-size="20"]').click(); await page.locator("[data-practice-start]").click();
  await page.waitForSelector("[data-check]");
  const practiceTotal = await page.evaluate(() => window.__app.getPractice().total);
  const seen = new Map(), wrongDone = new Set(); let n = 0, fills = 0, orders = 0;
  while (await page.locator("[data-check]").count()) {
    const item = await page.evaluate(() => window.__app.currentPracticeItem); const ex = await cur(page);
    const wantWrong = !item.retry && (ex.type === "fill" || ex.type === "order") && !wrongDone.has(item.id) && wrongDone.size < 3;
    if (wantWrong) wrongDone.add(item.id);
    const r = await answerCurrent(page, !wantWrong, seen, item.id, `练习 ${item.id}${item.retry ? "（重做）" : ""}`);
    if (r.type === "fill") fills++; if (r.type === "order") orders++;
    await page.locator("[data-continue]:not([disabled])").click();
    try { await page.waitForSelector("[data-check], .practice-finish"); } catch (e) { console.log("DEBUG", n, JSON.stringify(item), await page.evaluate(() => document.body.innerText.slice(0, 300))); throw e; } if (++n > 60) break;
  }
  await page.waitForSelector(".practice-finish");
  check(`练习轮：16 题全部抽到，首轮填空 5 题、排序 3 题都做了逐题检查（含答错重做共 填空 ${fills} 次、排序 ${orders} 次）`, practiceTotal === 16 && fills >= 5 && orders >= 3, `total=${practiceTotal} ${fills}/${orders}`);
  check("练习轮：整轮不改 XP", (await page.evaluate(() => window.__app.getState().xp)) === xp0);
  check("练习路径无脚本错误", errors.length === 0, errors.join(" | "));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
