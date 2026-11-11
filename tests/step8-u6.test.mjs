// 第 6 单元（U6L1–U6L6 可玩；U6L6-M1 代码题待开放）：真实构建 + 真实 Pyodide，在手机视口里按正确答案通关，并各答错一次。
// 运行：npm run build && node tests/step8-u6.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const PORT = 4385 + (process.argv[2] === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const unitN = JSON.parse(readFileSync(join(ROOT, "content/unit6.json")));
const prev = ["unit1", "unit2", "unit3", "unit4", "unit5"].flatMap((u) => JSON.parse(readFileSync(join(ROOT, `content/${u}.json`))).lessons).map((l) => l.id);
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

check("U1–U5 通关后 U6L1 是当前关，U6L2–U6L6 锁定（共 6 关可玩；U6L6-M1 代码题待开放）", unitN.lessons.length === 6 && unitN.lessons.some((l) => l.id === "U6L6") && unitN.lessons.find((l) => l.id === "U6L6").pending?.[0]?.task?.id === "U6L6-M1" && !(unitN.heldLessons || []).length && await page.evaluate(() => document.querySelector('[data-lesson="U6L1"]')?.classList.contains("current") && ["U6L2", "U6L3", "U6L4", "U6L5", "U6L6"].every((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("locked"))));
check("只有第 8 单元（函数）显示即将推出", (await page.locator(".unit.locked").count()) === 1);

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
  const queue = [...l.exercises]; const wrongTypes = new Set(); let wrongDone = false, steps = 0, outs = [];
  while (queue.length && steps++ < 12) {
    const q = await page.locator("h2.q").textContent();
    const ex = l.exercises.find((e) => e.prompt === q && (e.type !== "predict" || true));
    const cand = l.exercises.filter((e) => e.prompt === q);
    let exm = cand.length === 1 ? cand[0] : null;
    if (!exm) { const code = await page.locator(".lesson pre, .lesson .code").first().textContent().catch(() => ""); exm = cand.find((e) => code.includes(e.code.split("\n").pop().slice(0, 12))) || cand[0]; }
    const first = !wrongTypes.has(exm.type);
    const right = exm.type === "predict" || !first ? true : false; // 选输出题总答对；读报错题、填空、排序每种各先答错一次
    if (!right) wrongTypes.add(exm.type);
    if (exm.trace) check(`${l.id}：${exm.type} 题显示真实报错`, (await page.locator(".trace-pre").textContent()).trim() === exm.trace.trim());
    await answer(exm, right);
        await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar");
    if (exm.type !== "predict" && exm.type !== "pick") { await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 60000 }).catch(() => {}); outs.push([exm, right, await page.locator(".outpanel pre").textContent().catch(() => "")]); }
    const fb = await page.locator(".feedbar").textContent();
    if (!right) { wrongDone = true; check(`${l.id}：${exm.type} 答错显示“不对哦”和解释`, fb.includes("不对哦"), fb.slice(0, 80)); }
    else { check(`${l.id}：${exm.type} 正确答案判为答对`, fb.includes("答对了"), fb.slice(0, 120)); queue.splice(queue.indexOf(exm), 1); }
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
