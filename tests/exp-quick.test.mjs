// 实验预览“闪电 5 题”的自动测试（用 EXP=quick 构建的 dist-exp/；先运行 npm run build:exp）。
// 桌面 Chromium 的手机模拟，不能代替 iPhone 真机。截图写到 SHOTS_DIR（没设就不存）。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist-exp", import.meta.url).pathname);
const PORT = 4381, BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist-exp，先运行 npm run build:exp"); process.exit(2); }
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE); let p = join(DIST, decodeURIComponent(url.pathname));
  if (!p.startsWith(DIST)) { resp.writeHead(403).end(); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { resp.writeHead(404).end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }).end(readFileSync(p));
});
await new Promise((r) => srv.listen(PORT, r));

let browser;
try { browser = await chromium.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.close(); process.exit(2); }



// 自动答一道题（对或错）
async function answer(page, ok) {
  const e = await page.evaluate(() => window.__app.currentEx);
  if (e.type === "predict") { const i = e.options.findIndex((o) => !!o.correct === ok); await page.locator(".choice").nth(i).tap(); }
  else if (e.type === "fill") {
    for (let i = 0; i < e.answer.length; i++) {
      await page.locator(`[data-slot="${i}"]`).tap();
      const t = ok || i > 0 ? e.answer[i] : e.tokens.find((x) => x !== e.answer[0]);
      await page.locator(`[data-token="${t.replace(/"/g, '\\"')}"]`).first().tap();
    }
  } else {
    const seq = ok ? e.answers[0] : [...e.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).tap();
  }
  await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
  const right = await page.evaluate(() => document.querySelector(".feedbar").classList.contains("ok"));
  await page.locator("[data-continue]").tap();
  return right;
}

for (const vp of [{ w: 390, h: 844, tag: "iPhone15" }, { w: 375, h: 667, tag: "iPhoneSE" }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block",
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `exp-quick-${vp.tag}-${name}.png`) }); };
  const T = `[${vp.tag}]`;
  try {
    await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
    // 新用户：没有通关的关卡时按钮不可点
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector("[data-quick-entry]");
    check(`${T} 没有通关的关卡时“闪电 5 题”不可点`, await page.locator("[data-quick-entry]").isDisabled());
    await page.evaluate(() => { const st = window.__app.getState(); st.done = { U1L1: true, U1L2: true, U1L3: true }; st.xp = 120; window.__app.persist(); window.__app.renderPath(); });
    await page.waitForSelector("[data-quick-entry]:not([disabled])");
    const keys = await page.evaluate(() => { const f = document.createElement("iframe"); document.body.append(f); const ls = f.contentWindow.localStorage; const ks = []; for (let i = 0; i < ls.length; i++) ks.push(ls.key(i)); f.remove(); return ks; });
    check(`${T} 存储隔离：真实 localStorage 里只有 exp-quick: 前缀的键`, keys.length > 0 && keys.every((k) => k.startsWith("exp-quick:")), keys.join(","));
    const btn = await page.evaluate(() => { const r = document.querySelector("[data-quick-entry]").getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight }; });
    check(`${T} 地图一打开就能看到“闪电 5 题”（首屏内、≥40px 高）`, btn.top >= 0 && btn.bottom <= btn.vh && btn.h >= 40, JSON.stringify(btn));
    await shot("1-map");
    const before = await page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts, done: JSON.stringify(s.done), streak: JSON.stringify(s.streak ?? null) }; });

    // 第 1 轮：一键开练 → 前 2 题故意答错
    await page.locator("[data-quick-entry]").tap(); await page.waitForSelector("[data-check]");
    check(`${T} 点一下直接进题（不经过选范围页面）`, !(await page.locator(".practice-setup").count()) && (await page.evaluate(() => window.__app.getPractice()?.total)) === 5);
    await shot("2-question");
    const firstIds = [];
    let n = 0, guard = 0;
    while (guard++ < 15 && !(await page.locator(".practice-finish").count())) {
      const it = await page.evaluate(() => window.__app.currentPracticeItem);
      const wantOk = !(n < 2 && !it.retry);
      if (!it.retry) { firstIds.push(it.id); n++; }
      await answer(page, wantOk);
      await page.waitForSelector("[data-check], .practice-finish");
    }
    const missed1 = await page.evaluate(() => JSON.parse(localStorage.getItem("suipian.missed") || "[]"));
    check(`${T} 第 1 轮：5 道题不重复`, new Set(firstIds).size === 5, firstIds.join(","));
    check(`${T} 答错又在重练里答对的题会移出错题本（本轮故意答错的 2 道重练答对 → 错题本为空）`, missed1.length === 0, missed1.join(","));
    const fin = await page.evaluate(() => document.querySelector("[data-missed-left]")?.textContent || "");
    check(`${T} 结束页写明错题本还剩几道`, /错题本里还剩 0 道/.test(fin), fin);
    await shot("3-finish");

    // 人为放进 2 道错题，再来一轮：这 2 道必须出现
    const pool = await page.evaluate(() => window.__app.getState() && null);
    await page.evaluate(() => localStorage.setItem("suipian.missed", JSON.stringify(["U1L2#0", "U1L3#2"])));
    await page.locator("[data-practice-again]").tap(); await page.waitForSelector("[data-check]");
    const ids2 = await page.evaluate(() => window.__app.getPractice().items.map((x) => x.id));
    check(`${T} “再来一轮”也是一键开练，并优先抽错题本里的题`, ids2.length === 5 && ids2.includes("U1L2#0") && ids2.includes("U1L3#2"), ids2.join(","));
    guard = 0;
    while (guard++ < 15 && !(await page.locator(".practice-finish").count())) { await answer(page, true); await page.waitForSelector("[data-check], .practice-finish"); }
    const fin2 = await page.evaluate(() => document.querySelector("[data-missed-left]")?.textContent || "");
    check(`${T} 第 2 轮全对：错题本清空，并说明本轮有 2 道旧错题`, /还剩 0 道/.test(fin2) && /2 道是之前错过的/.test(fin2), fin2);

    // 规则不变：XP、红心、通关记录、连续天数都不动
    const after = await page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts, done: JSON.stringify(s.done), streak: JSON.stringify(s.streak ?? null) }; });
    check(`${T} 闪电 5 题不改 XP、红心、通关记录、连续天数`, JSON.stringify(after) === JSON.stringify(before), JSON.stringify({ before, after }));
    await page.locator(".practice-finish [data-continue]").tap(); await page.waitForSelector(".pathview");
    check(`${T} 全程没有页面脚本错误`, errors.length === 0, errors.join(" | "));
  } catch (e) { check(`${T} 流程跑完`, false, String(e.message).split("\n")[0]); }
  await ctx.close();
}
await browser.close(); srv.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
