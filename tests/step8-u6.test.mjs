// 第 6 单元（U6L1–U6L9，含 11 道“读报错”题）：真实构建 + 真实 Pyodide，在手机视口里按正确答案通关，并每关先答错一次。
// 运行：npm run build && node tests/step8-u6.test.mjs [chromium|webkit]   （也认 MOBILE_BROWSER=webkit|chromium）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const PORT = 4391 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const unitN = JSON.parse(readFileSync(join(ROOT, "content/unit6.json")));
const prev = [...JSON.parse(readFileSync(join(ROOT, "content/unit1.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit2.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit3.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit4.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit5.json"))).lessons].map((l) => l.id);
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".wav": "audio/wav" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const engine = ENGINE === "webkit" ? webkit : chromium;
const browser = await engine.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 760 }, isMobile: engine === chromium, hasTouch: true, serviceWorkers: "block" });
ctx.setDefaultTimeout(20000);
const NOW = Date.now();
const st = (done) => ({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); /* 模拟带着旧存档第一次打开 v4 */ localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st(prev)));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE); await page.waitForSelector(".pathview");

check("U1–U5 通关后 U6L1 是当前关，U6L2–L9 锁定（共 9 关，每关 5 题）", unitN.lessons.length === 9 && unitN.lessons.every((l) => l.exercises.length === 5) && await page.evaluate(() => document.querySelector('[data-lesson="U6L1"]')?.classList.contains("current") && ["U6L2", "U6L3", "U6L4", "U6L5", "U6L6", "U6L7", "U6L8", "U6L9"].every((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("locked"))));
check("第 7 单元仍显示即将推出", (await page.locator(".unit.locked").count()) === 1);

const predictPos = []; // 每道选输出题里正确选项显示在第几个（数据里都在第 0 个；打乱后不能全在第 0 个）
async function answer(ex, right) {
  if (ex.type === "predict") {
    const cur = await page.evaluate(() => window.__app.currentEx); // 选项在课程里会打乱：按屏幕上实际显示的顺序点，不能用数据里的顺序
    const i = right ? cur.options.findIndex((o) => o.correct) : cur.options.findIndex((o) => !o.correct);
    if (right) predictPos.push(cur.options.findIndex((o) => o.correct));
    const same = [...cur.options].map((o) => o.text).sort().join("\u0001") === [...ex.options].map((o) => o.text).sort().join("\u0001");
    if (!same) check("选项打乱后仍是同一组选项（只换位置）", false, ex.prompt.slice(0, 30));
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
  // 偶数位的关（L1、L3、L5、L7、L9）从头到尾全部答对，奇数位的关先故意答错一次：两种走法每关都应该拿到 60 XP（5 次答对 × 10 + 通关 10）
  const allRight = unitN.lessons.indexOf(l) % 2 === 0;
  const xp0 = await page.evaluate(() => window.__app.getState().xp);
  await page.locator(`[data-lesson="${l.id}"]`).click();
  const startLabel = (await page.locator(".overlay .btn3d.primary").textContent()).trim();
  check(`${l.id}：开始按钮写明 +60 XP（5 题 × 10 + 通关 10）`, startLabel.includes("+60 XP"), startLabel);
  await page.locator(".overlay .btn3d.primary").click();
  await page.getByRole("button", { name: "继续", exact: true }).click(); // 讲解页
  const queue = [...l.exercises]; let wrongDone = allRight, steps = 0, outs = [];
  while (queue.length && steps++ < 12) {
    const q = await page.locator("h2.q").textContent();
    const ex = l.exercises.find((e) => e.prompt === q && (e.type !== "predict" || true));
    const cand = l.exercises.filter((e) => e.prompt === q);
    let exm = cand.length === 1 ? cand[0] : null;
    if (!exm) { const code = await page.locator(".lesson pre, .lesson .code").first().textContent().catch(() => ""); exm = cand.find((e) => code.includes(e.code.split("\n").pop().slice(0, 12))) || cand[0]; }
    const right = wrongDone; // 每关第一题先故意答错一次（含选择题），之后全部答对
    await answer(exm, right);
    if (l.id === "U6L4" && exm.type === "order" && right) await page.screenshot({ path: join(process.env.SHOT_DIR || "/tmp", `u6l4-order-${process.argv[2] || "chromium"}.png`) }).catch(() => {});
    await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar");
    if (exm.type !== "predict") { await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 60000 }).catch(() => {}); outs.push([exm, right, await page.locator(".outpanel pre").textContent().catch(() => "")]); }
    const fb = await page.locator(".feedbar").textContent();
    if (!right) { wrongDone = true; check(`${l.id}：答错一次显示“不对哦”和解释`, fb.includes("不对哦"), fb.slice(0, 80)); }
    else { check(`${l.id}：${exm.type} 正确答案判为答对`, fb.includes("答对了"), fb.slice(0, 120)); queue.splice(queue.indexOf(exm), 1); }
    await page.locator("[data-continue]:not([disabled])").click();
    await page.waitForSelector("[data-check], .finish").catch(async (e) => { console.log("STUCK", (await page.locator("#app").innerText()).slice(0, 400)); throw e; });
  }
  for (const [ex, right, out] of outs) if (right) check(`${l.id}：${ex.type} 真实运行结果与 expected 一致`, out.includes(ex.expected.split("\n")[0]), out.slice(0, 80));
  await page.waitForSelector(".finish");
  const finishXp = (await page.locator(".fs", { hasText: "本关 XP" }).locator("b").first().textContent()).trim();
  const xpGain = (await page.evaluate(() => window.__app.getState().xp)) - xp0;
  check(`${l.id}：${allRight ? "全程答对" : "答错一次后答对"}，本关得到恰好 60 XP（结算页显示 +60，存档 XP 增加 60）`, finishXp === "+60" && xpGain === 60, `结算页 ${finishXp}，存档增加 ${xpGain}`);
  if (allRight) check(`${l.id}：全程答对恰好 5 步、没有扣红心`, steps === 5 && (await page.evaluate(() => window.__app.getState().hearts)) === 5, `步数 ${steps}`);
  if (l.id === "U6L4") await page.screenshot({ path: join(process.env.SHOT_DIR || "/tmp", `u6-finish-${process.argv[2] || "chromium"}.png`) }).catch(() => {});
  await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
  check(`${l.id}：通关后标记完成`, await page.evaluate((id) => document.querySelector(`[data-lesson="${id}"]`)?.classList.contains("done"), l.id));
}
check("选输出题的正确选项不是全部排在第一个（课程里选项已打乱，U6 共 26 道，答对时记录位置）", predictPos.length === 26 && predictPos.some((i) => i > 0), JSON.stringify(predictPos));
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
