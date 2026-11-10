// 第 7 单元「字典」（U7L1–U7L6）：内容检查 + 真实构建、真实 Pyodide 里逐关答题。
// U7 还没挂进 content/course.json（U6 在另一个分支写，U7 要等 U6 上线后再开放），app 的地图上看不到它；
// 这里用测试钩子 window.__app.startLesson(关卡) 直接打开 U7 的每一关，走和正式关卡完全相同的答题页面。
// 运行：npm run build && node tests/step8-u7.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const PORT = 4381 + (process.argv[2] === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const unitN = readJ("unit7.json");
const course = readJ("course.json");
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };

// ---------- 内容（不开浏览器）----------
const L = unitN.lessons;
check("U7：6 关 U7L1–U7L6，每关 4 题，都有讲解、示例代码和概念", L.map((l) => l.id).join() === "U7L1,U7L2,U7L3,U7L4,U7L5,U7L6" && L.every((l) => l.exercises.length === 4 && l.story && l.introCode && l.concept && l.title));
check("U7：只用已有题型（predict / fill / order）", L.every((l) => l.exercises.every((e) => ["predict", "fill", "order"].includes(e.type))));
check("U7：讲解写短（每关讲解不超过 140 字）", L.every((l) => [...l.story].length <= 140), L.map((l) => `${l.id}:${[...l.story].length}`).join(" "));
check("U7：同一关里没有重复的题（程序 + 题面都不同）", L.every((l) => new Set(l.exercises.map((e) => e.prompt + "\n" + (e.code || e.lines.join("\n")))).size === 4));
check("U7：每道选输出题恰好一个正确选项，每个选项都有解释", L.every((l) => l.exercises.filter((e) => e.type === "predict").every((e) => e.options.filter((o) => o.correct).length === 1 && e.options.every((o) => o.why))));
check("U7：填空题每个错误词块都有解释", L.every((l) => l.exercises.filter((e) => e.type === "fill").every((e) => e.tokens.filter((t) => !e.answer.includes(t)).every((t) => e.why[t]))));
const otherIds = ["unit1.json", "unit2.json", "unit3.json", "unit4.json", "unit5.json"].flatMap((f) => readJ(f).lessons.map((l) => l.id));
check("U7：关卡 id 不和已有单元重复", L.every((l) => !otherIds.includes(l.id)));
check("U7：还没开放（course.json 里没有指向 unit7.json 的单元；U7 最多是“即将推出”占位），不改现有地图", !course.units.some((u) => u.file === "unit7.json" || (u.id === "U7" && u.available)));
check("U7L6：项目代码题只记在 pending（待代码题运行器），不进题目", L[5].pending?.[0]?.task?.id === "U7L6-M1" && L.slice(0, 5).every((l) => !l.pending));
const before = readFileSync(join(ROOT, "content/unit7.json"), "utf8");
execFileSync("python3", [join(ROOT, "scripts/make-unit7.py")], { stdio: "pipe" }); // 生成脚本里的断言：题面写的每个输出、行号、错误类型都和真实运行一致
check("U7：content/unit7.json 和生成脚本 scripts/make-unit7.py 的输出一致", readFileSync(join(ROOT, "content/unit7.json"), "utf8") === before);
const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(join(ROOT, "scripts"))})
from verify import output, fill, order, codetask
d = json.load(open(${JSON.stringify(join(ROOT, "content/unit7.json"))}))
items = [(f"{l['id']}-Q{i}({e['type']})", l, e) for l in d["lessons"] for i, e in enumerate(l["exercises"], 1)]
rs = [output.check(items), fill.check(items), order.check(items), codetask.check(d["lessons"])]
print(json.dumps([[c.name, c.checked, c.fails, c.skipped] for c in rs], ensure_ascii=False))`;
for (const [name, n, fails, skipped] of JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" })))
  check(`U7 真实 Python 验证 · ${name}：${n} 项全部通过、没有跳过`, n > 0 && fails.length === 0 && skipped.length === 0, [...fails, ...skipped].join(" | "));

// ---------- 真实构建 + 真实 Pyodide：逐关答题 ----------
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
const st = { version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(otherIds.map((k) => [k, true])), lessonsCompleted: otherIds.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } };
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE); await page.waitForSelector(".pathview");
check("地图不变：U7 不出现在地图上", (await page.locator('[data-lesson^="U7"]').count()) === 0);

async function answer(ex, right) {
  if (ex.type === "predict") {
    const i = right ? ex.options.findIndex((o) => o.correct) : ex.options.findIndex((o) => !o.correct);
    await page.locator(".choice").nth(i).click();
  } else if (ex.type === "fill") {
    const toks = right ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => t !== a) : a));
    for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
  } else {
    const seq = right ? ex.answers[0] : [...ex.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click();
  }
}
for (const l of L) {
  // 每关故意答错一次会扣 1 颗红心；每关开始前补满（只改测试状态，不改红心规则）
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await page.evaluate((lesson) => window.__app.startLesson(lesson), l);
  await page.getByRole("button", { name: "继续", exact: true }).click(); // 讲解页
  let wrongDone = false, steps = 0; const outs = [];
  while (steps++ < 12) {
    if (await page.locator(".finish").count()) break;
    const exm = await page.evaluate(() => window.__app.currentEx);
    check(`${l.id}：题面显示正确`, (await page.locator("h2.q").textContent()) === exm.prompt);
    const right = wrongDone || exm.type === "predict";
    await answer(exm, right);
    await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar");
    if (exm.type !== "predict") { await page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent; return t && !/运行中/.test(t); }, null, { timeout: 60000 }).catch(() => {}); outs.push([exm, right, await page.locator(".outpanel pre").textContent().catch(() => "")]); }
    const fb = await page.locator(".feedbar").textContent();
    if (!right) { wrongDone = true; check(`${l.id}：答错一次显示“不对哦”和解释`, fb.includes("不对哦"), fb.slice(0, 80)); }
    else check(`${l.id}：${exm.type} 正确答案判为答对`, fb.includes("答对了"), fb.slice(0, 120));
    await page.locator("[data-continue]:not([disabled])").click();
    await page.waitForSelector("[data-check], .finish");
  }
  for (const [ex, right, out] of outs) if (right) check(`${l.id}：${ex.type} 真实运行结果与 expected 一致`, out.includes(ex.expected.split("\n")[0]), out.slice(0, 80));
  await page.waitForSelector(".finish");
  check(`${l.id}：走完 4 题到结算页，记为完成`, await page.evaluate((id) => window.__app.getState().done[id] === true, l.id));
  await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
}
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
