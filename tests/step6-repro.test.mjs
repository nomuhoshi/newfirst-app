// 临时复现脚本：只跑“随机练习 → 第一题答错”这一段，重复很多次，失败时把现场（题目、按钮状态、DOM）打出来。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DIST = join(ROOT, "dist");
const doneMap = (ids) => Object.fromEntries(ids.map((k) => [k, true]));
const PORT = 4335;
const BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".wav": "audio/wav", ".zip": "application/zip", ".txt": "text/plain" };
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
const KEY = "suipian.progress";

const IPHONE_SAFARI_UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
async function openPage(seedState, vp = { width: 390, height: 844 }) {
  const { safari, ...viewport } = vp; // safari: 用 iPhone Safari 的 UA，应用会加 ios-browser 类（底栏更高）
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, serviceWorkers: "block", ...(safari ? { userAgent: IPHONE_SAFARI_UA } : {}) });
  if (seedState) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, [KEY, JSON.stringify(seedState)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE);
  await page.waitForSelector(".pathview, .onboard");
  return { ctx, page, errors };
}
const baseState = (done, extra = {}) => ({
  version: 3, onboarded: true, xp: 130, hearts: 3, heartsAt: Date.now() - 5 * 60 * 1000, streak: 4, lastDay: "2026-11-02",
  done: doneMap(done), lessonsCompleted: done.length + 2, installTipClosed: true, lastActive: Date.now(),
  prefs: { sound: false, haptics: false, soundStyle: "J" }, ...extra,
});


const N = Number(process.env.TRIALS || 80);
const fails = [], seen = {};
async function answerWrong(page) {
  const ex = await page.evaluate(() => window.__app.currentEx);
  const cur = await page.evaluate(() => window.__app.currentPracticeItem);
  const rec = { id: cur.id, type: ex.type };
  const t0 = Date.now();
  if (ex.type === "predict") {
    const idx = ex.options.findIndex((o) => !o.correct);
    await page.locator(".choice").nth(idx).click();
  } else if (ex.type === "fill") {
    const want = [...ex.answer]; want[0] = ex.tokens.find((t) => t !== ex.answer[0]);
    for (let k = 0; k < want.length; k++) {
      await page.locator(`[data-slot="${k}"]`).click();
      await page.evaluate((t) => [...document.querySelectorAll("[data-token]")].find((b) => b.dataset.token === t).click(), want[k]);
    }
  } else {
    const texts = ex.answers.map((a) => a.join());
    const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
    const order = perms(ex.answers[0]).find((p) => !texts.includes(p.join()) && !ex.answers.some((a) => a.map((k) => ex.lines[k]).join("\n") === p.map((k) => ex.lines[k]).join("\n")));
    rec.order = order;
    for (const k of order) await page.locator(`.order-bank [data-line="${k}"]`).first().click();
  }
  const pre = await page.evaluate(() => { const b = document.querySelector("[data-check]"); return { checkDisabled: b?.disabled, checkText: b?.textContent }; });
  rec.pre = pre;
  await page.evaluate(() => { const b = document.querySelector("[data-check]"); b.click(); b.click(); });
  try { await page.locator("[data-continue]:not([disabled])").waitFor({ timeout: 8000 }); rec.ok = true; }
  catch { rec.ok = false; rec.dom = await page.evaluate(() => ({ foot: document.querySelector(".lessonfoot, .feedbar")?.outerHTML.slice(0, 400), check: document.querySelector("[data-check]")?.outerHTML.slice(0, 200), body: document.querySelector("#app").innerText.slice(0, 400) })); rec.ex = ex; }
  rec.ms = Date.now() - t0;
  return rec;
}
for (let t = 0; t < N; t++) {
  const { ctx, page, errors } = await openPage(baseState(["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1"]));
  try {
    await page.locator("[data-practice-entry]").click();
    await page.locator("[data-practice-none]").click();
    await page.locator('[data-practice-unit="U2"]').click();
    await page.locator('[data-practice-lesson="U1L3"]').click();
    await page.locator('[data-practice-size="5"]').click();
    await page.locator("[data-practice-start]").click();
    const rec = await answerWrong(page);
    rec.errors = errors;
    seen[rec.id] = seen[rec.id] || { n: 0, fail: 0 }; seen[rec.id].n++;
    if (!rec.ok) { seen[rec.id].fail++; fails.push(rec); console.log("❌ 失败现场", JSON.stringify(rec)); }
  } catch (e) { console.log("❌ 脚本异常", String(e.message).split("\n")[0]); fails.push({ err: String(e.message) }); }
  await ctx.close();
}
console.log("按题统计（出现次数/失败次数）：", JSON.stringify(seen));
console.log(`共 ${N} 次，失败 ${fails.length} 次`);
await browser.close(); srv.close();
process.exit(0);
