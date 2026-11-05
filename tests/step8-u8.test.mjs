// 第 8 单元（U8L1–U8L2 可玩，从地图进入；每道题先答错一次再答对）：真实构建 + 真实 Pyodide，在手机视口里按正确答案通关，并各答错一次。
// 运行：npm run build && node tests/step8-u8.test.mjs [chromium|webkit]（也认 MOBILE_BROWSER=webkit，npm run test:mobile 会在两个内核各跑一遍）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname, DIST = join(ROOT, "dist");
const PORT = 4405 + ((process.argv[2] || process.env.MOBILE_BROWSER) === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const unitN = JSON.parse(readFileSync(join(ROOT, "content/unit8.json")));
const document_has_held = (u) => u.lessons.some((l) => (u.heldLessons || []).some((h) => h.id === l.id));
const prev = ["unit1", "unit2", "unit3", "unit4", "unit5", "unit6", "unit7"].flatMap((u) => JSON.parse(readFileSync(join(ROOT, `content/${u}.json`))).lessons).map((l) => l.id);
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wav": "audio/wav" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = (process.argv[2] || process.env.MOBILE_BROWSER) === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
ctx.setDefaultTimeout(20000);
const NOW = Date.now();
const st = (done) => ({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st(prev)));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE); await page.waitForSelector(".pathview");

check("U1–U7 通关后 U8L1 是当前关，U8L2 锁定（共 2 关可玩，没有待开放的关）", unitN.lessons.length === 2 && (unitN.heldLessons || []).length === 0 && await page.evaluate(() => document.querySelector('[data-lesson="U8L1"]')?.classList.contains("current") && document.querySelector('[data-lesson="U8L2"]')?.classList.contains("locked")));
check("第 9 单元（毕业小项目）仍显示即将推出", (await page.locator(".unit.locked").count()) === 1);

async function answer(ex, right) {
  if (ex.type === "predict" || ex.type === "pick") {
    const i = right ? ex.options.findIndex((o) => o.correct) : ex.options.findIndex((o) => !o.correct);
    await page.locator(".choice").nth(i).click();
  } else if (ex.type === "fill") {
    const toks = right ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => t !== a) : a)); // 答错：每个空都填，第一个空换成错误词块
    for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
  } else {
    const seq = right ? ex.answers[0] : [...ex.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click();
  }
}
for (const l of unitN.lessons) {
  // 每关故意答错一次会扣 1 颗红心；多关会扣光，所以每关开始前补满（只改测试状态，不改红心规则）
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await page.locator(`[data-lesson="${l.id}"]`).click(); await page.locator(".overlay .btn3d.primary").click();
  await page.getByRole("button", { name: "继续", exact: true }).click(); // 讲解页
  const queue = [...l.exercises]; const wrongSeen = new Set(); let wrongDone = false, steps = 0, outs = [];
  while (queue.length && steps++ < 24) {
    await page.waitForSelector("h2.q");
    const cur = await page.evaluate(() => window.__app.currentEx);
    const exm = l.exercises.find((e) => e.type === cur.type && e.prompt === cur.prompt && (e.code || "") === (cur.code || "") && JSON.stringify(e.lines || null) === JSON.stringify(cur.lines || null) && JSON.stringify((e.options || []).map((o) => o.text)) === JSON.stringify((cur.options || []).map((o) => o.text)));
    if (!exm) throw new Error("找不到当前题：" + JSON.stringify(cur).slice(0, 200));
    const idx = l.exercises.indexOf(exm);
    const right = wrongSeen.has(idx); // 每道题：第一次故意答错，第二次答对
    if (!right) wrongSeen.add(idx);
    if (exm.type === "pick" && exm.options.length === 3 && !right) { // 三选项读报错题：小屏（320 宽）排版
      await page.setViewportSize({ width: 320, height: 700 });
      const lay = await page.evaluate(() => { const cs = [...document.querySelectorAll(".choice")]; return { n: cs.length, pageOverflow: document.documentElement.scrollWidth > window.innerWidth, inside: cs.every((c) => { const r = c.getBoundingClientRect(); return r.left >= 0 && r.right <= window.innerWidth; }), clipped: cs.some((c) => c.scrollWidth > c.clientWidth + 1), minH: Math.min(...cs.map((c) => c.getBoundingClientRect().height)), minW: Math.min(...cs.map((c) => c.getBoundingClientRect().width)), texts: cs.map((c) => c.textContent.trim()) }; });
      check(`${l.id}：三选项读报错题在 320 宽下：3 个选项都在屏幕内、文字没被截断、页面不横向溢出、每个选项不小于 44px 高`, lay.n === 3 && !lay.pageOverflow && lay.inside && !lay.clipped && lay.minH >= 44, JSON.stringify(lay));
      await page.screenshot({ path: (process.env.SHOTS_DIR || "/tmp") + "/u8-pick3-320.png" }).catch(() => {});
      await page.setViewportSize({ width: 390, height: 760 });
    }
    if (exm.trace) check(`${l.id}：${exm.type} 题显示真实报错`, (await page.locator(".trace-pre").textContent()).trim() === exm.trace.trim());
    await answer(exm, right);
        await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar");
    if (exm.type !== "predict" && exm.type !== "pick") { await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 60000 }).catch(() => {}); outs.push([exm, right, await page.locator(".outpanel pre").textContent().catch(() => "")]); }
    const fb = await page.locator(".feedbar").textContent();
    if (!right) { wrongDone = true; check(`${l.id}-Q${idx + 1}：${exm.type} 先答错显示“不对哦”和解释`, fb.includes("不对哦"), fb.slice(0, 80)); }
    else { check(`${l.id}-Q${idx + 1}：${exm.type} 再答对判为答对`, fb.includes("答对了"), fb.slice(0, 120)); queue.splice(queue.indexOf(exm), 1); }
    await page.locator("[data-continue]:not([disabled])").click();
    await page.waitForSelector("[data-check], .finish").catch(async (e) => { await page.screenshot({ path: "/workspace/u3p2/shots/stuck.png" }); console.log("STUCK", (await page.locator("#app").innerText()).slice(0, 400)); throw e; });
  }
  for (const [ex, right, out] of outs) if (right) check(`${l.id}：${ex.type} 真实运行结果与 expected 一致`, out.includes(ex.expected.split("\n")[0]), out.slice(0, 80));
  await page.waitForSelector(".finish");
  await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  check(`${l.id}：通关后标记完成`, await page.evaluate((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("done"), l.id));
}
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
