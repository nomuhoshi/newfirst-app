// 第 5 单元第 1 部分（U5L1–U5L4）：真实构建 + 真实 Pyodide，在手机视口里按正确答案通关，并各答错一次。
// 运行：npm run build && node tests/step8-u5.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";

const ROOT = new URL("..", import.meta.url).pathname, DIST = join(ROOT, "dist");
const PORT = 4375 + (process.argv[2] === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const unitN = JSON.parse(readFileSync(join(ROOT, "content/unit5.json")));
const prev = [...JSON.parse(readFileSync(join(ROOT, "content/unit1.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit2.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit3.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit4.json"))).lessons].map((l) => l.id);
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wav": "audio/wav" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = process.argv[2] === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
ctx.setDefaultTimeout(20000);
const NOW = Date.now();
const st = (done) => ({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st(prev)));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE); await page.waitForSelector(".pathview");

check("U1–U4 通关后 U5L1 是当前关，U5L2–L4 锁定", await page.evaluate(() => document.querySelector('[data-lesson="U5L1"]')?.classList.contains("current") && ["U5L2", "U5L3", "U5L4"].every((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("locked"))));
check("第 6 单元仍显示即将推出", (await page.locator(".unit.locked").count()) === 1);

async function answer(ex, right) {
  if (ex.type === "predict") {
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
  // 每关故意答错一次会扣 1 颗红心；8 关会扣光，所以每关开始前补满（只改测试状态，不改红心规则）
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await page.locator(`[data-lesson="${l.id}"]`).click(); await page.locator(".overlay .btn3d.primary").click();
  await page.getByRole("button", { name: "继续", exact: true }).click(); // 讲解页
  const queue = [...l.exercises]; let wrongDone = false, steps = 0, outs = [];
  while (queue.length && steps++ < 12) {
    const q = await page.locator("h2.q").textContent();
    const ex = l.exercises.find((e) => e.prompt === q && (e.type !== "predict" || true));
    const cand = l.exercises.filter((e) => e.prompt === q);
    let exm = cand.length === 1 ? cand[0] : null;
    if (!exm) { const code = await page.locator(".lesson pre, .lesson .code").first().textContent().catch(() => ""); exm = cand.find((e) => code.includes(e.code.split("\n").pop().slice(0, 12))) || cand[0]; }
    const right = wrongDone || exm.type === "predict" ? true : false;
    await answer(exm, right);
    if (l.id === "U5L4" && exm.type === "order" && right) await page.screenshot({ path: join(process.env.SHOT_DIR || "/tmp", `u4l4-order-${process.argv[2] || "chromium"}.png`) }).catch(() => {});
    await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar");
    if (exm.type !== "predict") { await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 60000 }).catch(() => {}); outs.push([exm, right, await page.locator(".outpanel pre").textContent().catch(() => "")]); }
    const fb = await page.locator(".feedbar").textContent();
    if (!right) { wrongDone = true; check(`${l.id}：答错一次显示“不对哦”和解释`, fb.includes("不对哦"), fb.slice(0, 80)); }
    else { check(`${l.id}：${exm.type} 正确答案判为答对`, fb.includes("答对了"), fb.slice(0, 120)); queue.splice(queue.indexOf(exm), 1); }
    await page.locator("[data-continue]:not([disabled])").click();
    await page.waitForSelector("[data-check], .finish").catch(async (e) => { await page.screenshot({ path: "/workspace/u3p2/shots/stuck.png" }); console.log("STUCK", (await page.locator("#app").innerText()).slice(0, 400)); throw e; });
  }
  for (const [ex, right, out] of outs) if (right) check(`${l.id}：${ex.type} 真实运行结果与 expected 一致`, out.includes(ex.expected.split("\n")[0]), out.slice(0, 80));
  await page.waitForSelector(".finish");
  if (l.id === "U5L4") await page.screenshot({ path: join(process.env.SHOT_DIR || "/tmp", `u4-finish-${process.argv[2] || "chromium"}.png`) }).catch(() => {});
  await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  check(`${l.id}：通关后标记完成`, await page.evaluate((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("done"), l.id));
}
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
