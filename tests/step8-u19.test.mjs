// 第 19 单元「栈与队列」（U19L1–U19L6，第二版课程结构阶段三；笔试题面风格；生成脚本 scripts/make-unit19.py）：内容检查 + 真实构建、真实 Pyodide 里逐关答题。
// U19 已接入课程路线（地图上 U18 之后）；这里用测试钩子 window.__app.startLesson(关卡) 直接打开 U19 的每一关，走和点地图节点完全相同的答题页面。
// 运行：npm run build && node tests/step8-u19.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = join(ROOT, "dist");
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const PORT = 4561 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const readJ = (f) => JSON.parse(readFileSync(join(ROOT, "content", f)));
const unitN = readJ("unit19.json");
const course = readJ("course.json");
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };

// ---------- 内容（不开浏览器）----------
const L = unitN.lessons;
const ALL = L.flatMap((l) => l.exercises.map((e, i) => [`${l.id}-Q${i + 1}`, e]));
check("U19：6 关 U19L1–U19L6，每关 4 题，都有讲解、示例代码和概念", L.map((l) => l.id).join() === "U19L1,U19L2,U19L3,U19L4,U19L5,U19L6" && L.every((l) => l.exercises.length === 4 && l.story && l.introCode && l.concept));
check("U19：只用正式应用支持的题型（predict / fill / order）；选改法题每个选项带 program（本单元没有读报错题）", ALL.every(([, e]) => ["predict", "fill", "order"].includes(e.type)) && ALL.some(([, e]) => !e.expectError && (e.options || []).some((o) => o.program)));
check("U19：讲解写短（每关讲解不超过 140 字）", L.every((l) => [...l.story].length <= 140), L.map((l) => `${l.id}:${[...l.story].length}`).join(" "));
check("U19：同一关里没有重复的题（程序 + 题面都不同）", L.every((l) => new Set(l.exercises.map((e) => e.prompt + "\n" + (e.code || e.lines.join("\n")))).size === 4));
check("U19：每道选择题恰好一个正确选项，每个选项都有解释", ALL.filter(([, e]) => e.type === "predict").every(([, e]) => e.options.filter((o) => o.correct).length === 1 && e.options.every((o) => o.why)));
check("U19：填空题每个错误词块都有解释", ALL.filter(([, e]) => e.type === "fill").every(([, e]) => e.tokens.filter((t) => !e.answer.includes(t)).every((t) => e.why[t])));
const cellW = (s) => [...s].reduce((n, ch) => n + (/[\u1100-\u115F\u2E80-\u303E\u3041-\u33FF\u3400-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/.test(ch) ? 2 : 1), 0);
// 行宽（PR #47 的设计规则）：题目代码、按代码排的选项每行 ≤28 格（全角算 2）；按文字排的选项会折行、改法题的选项按 D5 在卡片内横滚（choice-layout 测试验），不受此限；开场示例 ≤22 格。
const shown = ALL.flatMap(([w, e]) => [...(e.type === "fill" ? e.tokens.map((t) => e.code.replace("{0}", t)) : e.type === "order" ? [e.lines.join("\n")] : [e.code]).map((c) => [w, c]), ...(e.optionLayout === "text" || (e.options || []).some((o) => o.program) ? [] : (e.options || []).map((o) => [w + " 选项", o.text]))]);
const wide = shown.flatMap(([w, c]) => c.split("\n").filter((x) => cellW(x) > 28).map((x) => `${w}: ${x}（${cellW(x)}）`));
check("U19：题目代码和按代码排的选项每行不超过 28 格（全角算 2）", wide.length === 0, wide.join(" | "));
check("U19：开场讲解示例每行不超过 28 格（超过 22 格的用宽版“手机”框，下面在浏览器里核对不横向溢出）", L.every((l) => l.introCode.split("\n").every((x) => cellW(x) <= 28)));
const otherIds = ["unit1.json", "unit2.json", "unit3.json", "unit4.json", "unit5.json", "unit6.json", "unit7.json", "unit8.json", "unit9.json", "unit10.json", "unit11.json", "unit12.json", "unit13.json", "unit14.json", "unit15.json", "unit16.json", "unit17.json", "unit18.json"].flatMap((f) => readJ(f).lessons.map((l) => l.id));
check("U19：关卡 id 不和已有单元重复", L.every((l) => !otherIds.includes(l.id)));
check("U19：已接入课程路线（course.json 里 U19 开放并指向 unit19.json），第 20 单元已开放、第 21 单元即将推出", course.units.some((u) => u.id === "U19" && u.available === true && u.file === "unit19.json") && course.units.filter((u) => !u.available).map((u) => u.id).join() === "U21");
check("U19：填空题只有一个可接受答案（界面的填空判分只认 answer）", L.every((l) => l.exercises.every((e) => e.type !== "fill" || !e.answers)));
check("U19：没有代码题 pending（正式构建 codeTasksEnabled 仍为 []），不用 +=、%、lambda、global；题面是笔试风格（不用“点单屏”）", L.every((l) => !l.pending) && !JSON.stringify(unitN).includes("+=") && !/ % /.test(JSON.stringify(unitN)) && !JSON.stringify(unitN).includes("lambda") && !JSON.stringify(unitN).includes("global") && !JSON.stringify(unitN).includes("点单屏"));
const before = readFileSync(join(ROOT, "content/unit19.json"), "utf8");
execFileSync("python3", [join(ROOT, "scripts/make-unit19.py")], { stdio: "pipe" }); // 生成脚本里的断言：每个选项、词块、排序都和真实运行一致
check("U19：content/unit19.json 和生成脚本 scripts/make-unit19.py 的输出一致", readFileSync(join(ROOT, "content/unit19.json"), "utf8") === before);
const py = `
import sys, json
sys.path.insert(0, ${JSON.stringify(join(ROOT, "scripts"))})
from verify import output, fill, order, codetask
d = json.load(open(${JSON.stringify(join(ROOT, "content/unit19.json"))}))
items = [(f"{l['id']}-Q{i}({e['type']})", l, e) for l in d["lessons"] for i, e in enumerate(l["exercises"], 1)]
rs = [output.check(items), fill.check(items), order.check(items), codetask.check(d["lessons"])]
print(json.dumps([[c.name, c.checked, c.fails, c.skipped] for c in rs], ensure_ascii=False))`;
for (const [name, n, fails, skipped] of JSON.parse(execFileSync("python3", ["-c", py], { encoding: "utf8" })))
  check(`U19 真实 Python 验证 · ${name}：${n} 项全部通过、没有跳过`, (n > 0 || name.startsWith("代码题") || (name.startsWith("排序") && !ALL.some(([, e]) => e.type === "order")))  /* U18 没有排序题 */ && fails.length === 0 && skipped.length === 0, [...fails, ...skipped].join(" | "));

// ---------- 真实构建 + 真实 Pyodide：逐关答题 ----------
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
const st = { version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(otherIds.map((k) => [k, true])), lessonsCompleted: otherIds.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } };
await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, JSON.stringify(st));
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(BASE); await page.waitForSelector(".pathview");
check("U1–U18 通关后 U19 的 6 关都在地图上，U19L1 是当前关，U19L2–L6 锁定", (await page.locator('[data-lesson^="U19L"]').count()) === 6 && (await page.locator('[data-lesson="U19L1"]').getAttribute("class")).includes("current") && (await page.locator('.node.locked[data-lesson^="U19L"]').count()) === 5);

async function answer(ex, right) {
  if (ex.type === "predict") {
    const i = right ? ex.options.findIndex((o) => o.correct) : ex.options.findIndex((o) => !o.correct);
    await page.locator(".choice").nth(i).click();
  } else if (ex.type === "fill") {
    const okFirst = (ex.answers || [ex.answer]).map((x) => x[0]); // 故意答错时，第一个空换成任何可接受答案都不是的词块（有的题接受两个答案）
    const toks = right ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !okFirst.includes(t)) : a));
    for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
  } else {
    const seq = right ? ex.answers[0] : [...ex.answers[0]].reverse();
    for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click();
  }
}
let layoutSeen = 0;
for (const l of L) {
  // 每关故意答错一次会扣 1 颗红心；每关开始前补满（只改测试状态，不改红心规则）
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  const xp0 = await page.evaluate(() => window.__app.getState().xp);
  await page.evaluate((lesson) => window.__app.startLesson(lesson), l);
  { const ib = await page.evaluate(() => { const c = document.querySelector(".intro-screen .codeblock"); return { cls: c.className, fits: c.scrollWidth <= c.clientWidth + 1, inScreen: c.getBoundingClientRect().right <= innerWidth + 0.5, noHScroll: document.documentElement.scrollWidth <= innerWidth }; });
    const wantWide = l.introCode.split("\n").some((x) => cellW(x) > 22);
    check(`${l.id}：开场示例${wantWide ? "用宽版“手机”框" : "用普通“手机”框"}，代码不横向溢出、整页不横滚`, /\bwide\b/.test(ib.cls) === wantWide && ib.fits && ib.inScreen && ib.noHScroll, JSON.stringify(ib)); }
  await page.getByRole("button", { name: "继续", exact: true }).click(); // 讲解页
  let wrongDone = false, steps = 0; const outs = [];
  while (steps++ < 12) {
    if (await page.locator(".finish").count()) break;
    const exm = await page.evaluate(() => window.__app.currentEx);
    check(`${l.id}：题面显示正确`, (await page.locator("h2.q").textContent()) === exm.prompt);
    if (exm.optionLayout === "text") { // 中文说明选项：单列折行，整页不横滚（390 宽）
      const lay = await page.evaluate(() => { const c = document.querySelector(".choices"); const xs = [...c.querySelectorAll(".choice")].map((b) => b.getBoundingClientRect()); return { cls: c.className, oneCol: xs.every((r) => Math.abs(r.left - xs[0].left) < 1), noHScroll: document.documentElement.scrollWidth <= innerWidth }; });
      layoutSeen++; check(`${l.id}：中文说明选项单列折行、整页不横滚`, /\bwide\b/.test(lay.cls) && lay.oneCol && lay.noHScroll, JSON.stringify(lay));
    }
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
  const xpGain = (await page.evaluate(() => window.__app.getState().xp)) - xp0;
  check(`${l.id}：本关得到恰好 50 XP（4 题 × 10 + 通关 10；答错一次不影响）`, xpGain === 50, `增加 ${xpGain}`);
  check(`${l.id}：走完 4 题到结算页，记为完成`, await page.evaluate((id) => window.__app.getState().done[id] === true, l.id));
  await page.locator(".finish [data-continue]").click(); await page.waitForSelector(".pathview");
}
check("无脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
