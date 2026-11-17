// P0（只读验证）：课程 pending 里的 16 道“写代码 / 改代码题”，真实浏览器 + 真实 Pyodide 逐题验证。不改课程、不改产品代码、不联网（Pyodide 来自 public/pyodide）。
// A 层（判题层，vite 开发服 + 真实 Runner/Worker）：参考答案、起始代码、变化题、示范、数据注入、报错展示；
// B 层（界面层，dist 构建产物 + 真实应用）：把每道题放进临时关卡，真实点“检查”，看 XP / 红心 / 反馈 / 通关流程。
// 运行：npm run build && node tests/code-tasks-pyodide.test.mjs [chromium|webkit]    结果 JSON：OUT=<路径>（默认 /tmp/p0-<引擎>.json）
import { createServer as viteServer } from "vite";
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const bt = ENGINE === "webkit" ? webkit : chromium;
const OUT = process.env.OUT || join(tmpdir(), `p0-${ENGINE}.json`);
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const DIST = join(ROOT, "dist");
const course = JSON.parse(readFileSync(join(ROOT, "content/course.json")));
const TASKS = [];
for (const u of course.units) { if (!u.available) continue; const d = JSON.parse(readFileSync(join(ROOT, "content", u.file))); for (const l of d.lessons) for (const p of l.pending || []) TASKS.push({ lesson: l.id, replaces: p.replaces, task: p.task }); }
if (TASKS.length !== 16) { console.log("题数不是 16：", TASKS.length); process.exit(1); }
const ONLY = (process.env.ONLY || "").split(",").filter(Boolean);
const run = ONLY.length ? TASKS.filter((t) => ONLY.includes(t.task.id)) : TASKS;
const R = { engine: ENGINE, tasks: {}, probes: {}, notes: [] };
const log = (...a) => console.log(...a);
let browser;
try { browser = await bt.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
R.browserVersion = browser.version();
const starterOf = (t) => (t.type === "modify" ? t.code : t.starter);
const pyRepr = (v) => (typeof v === "boolean" ? (v ? "True" : "False") : typeof v === "number" ? String(v) : typeof v === "string" ? "'" + v + "'" : Array.isArray(v) ? "[" + v.map(pyRepr).join(", ") + "]" : String(v));
const pyType = (v) => (typeof v === "boolean" ? "bool" : typeof v === "number" ? (Number.isInteger(v) ? "int" : "float") : typeof v === "string" ? "str" : Array.isArray(v) ? "list" : "?");
const short = (c) => ({ name: c.name, hidden: !!c.hidden, ok: c.ok, kind: c.kind, ms: c.ms, err: c.error ? `${c.error.kind}: ${String(c.error.msg || "").slice(0, 80)}${c.error.line ? " @行" + c.error.line : ""}` : undefined, got: c.stdout !== undefined && !c.ok && !c.hidden ? String(c.stdout).slice(0, 60) : undefined });

// ================= A 层 =================
const vite = await viteServer({ configFile: false, root: ROOT, logLevel: "error", server: { port: 5197, strictPort: true }, worker: { format: "es" } });
await vite.listen();
try {
  const page = await browser.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("http://localhost:5197/tests/judge-browser.html"); await page.waitForFunction(() => window.pageReady);
  const J = (a) => page.evaluate((a) => window.J(a), a);
  const warm = Date.now(); await J({ code: "print(1)", tests: [{ name: "w", expected: "1" }], limits: { readyCapMs: 90000 } }); R.pyodideColdLoadMs = Date.now() - warm; log(`Pyodide 首次加载（含 Worker 启动）≈ ${R.pyodideColdLoadMs} ms`);
  for (const { lesson, task: t } of run) {
    const rec = (R.tasks[t.id] = { lesson, type: t.type, tests: t.tests.length, hidden: t.tests.filter((x) => x.hidden).length, given: t.given });
    const tests = t.tests.map((x) => ({ name: x.name, data: x.data, expected: x.expected, hidden: x.hidden }));
    const go = async (code) => { const t0 = Date.now(); const r = await J({ code, tests, checkMode: t.checkMode || "output", compare: t.compare || "strict" }); return { status: r.status, attempt: r.attempt, settle: r.settle, totalMs: r.totalMs, wallMs: Date.now() - t0, cases: r.cases.map(short) }; };
    rec.reference = await go(t.reference);
    rec.starter = await go(starterOf(t));
    if (t.variation) { const v = t.variation; const vt = v.tests.map((x) => ({ name: x.name, data: x.data, expected: x.expected, hidden: x.hidden })); const g2 = async (code) => { const t0 = Date.now(); const r = await J({ code, tests: vt, checkMode: t.checkMode || "output", compare: "strict" }); return { status: r.status, totalMs: r.totalMs, wallMs: Date.now() - t0, cases: r.cases.map(short) }; }; rec.variation = { solution: await g2(v.solution), starter: await g2(v.starter), parentRefOnVariation: await g2(t.reference) }; }
    else rec.variation = null;
    if (t.worked) { const r = await J({ code: t.worked.code, tests: [{ name: "worked", expected: String(t.worked.output) }] }); rec.worked = { status: r.status, ms: r.totalMs }; }
    // 数据注入探针：每个给定变量在真实 Pyodide 里的类型和 repr，必须和 JSON 值一致
    const probeTests = t.tests.map((x) => ({ name: x.name, data: x.data, expected: Object.keys(x.data || {}).map((k) => `${k}|${pyType(x.data[k])}|${pyRepr(x.data[k])}`).join("\n") }));
    const probeCode = (t.given || []).map((k) => `print("${k}|" + type(${k}).__name__ + "|" + repr(${k}))`).join("\n");
    const pr = await J({ code: probeCode, tests: probeTests });
    rec.injection = { status: pr.status, types: [...new Set(t.tests.flatMap((x) => Object.values(x.data || {}).map(pyType)))], bad: pr.cases.filter((c) => !c.ok).map((c) => ({ name: c.name, got: c.stdout })) };
    log(`A ${t.id}: 参考 ${rec.reference.status}(${rec.reference.totalMs}ms) 起始 ${rec.starter.status}(${rec.starter.totalMs}ms) 变化题 ${rec.variation ? rec.variation.solution.status + "/" + rec.variation.starter.status : "无"} 示范 ${rec.worked?.status} 注入 ${rec.injection.status}`);
  }
  // 报错展示：U5L2 起始代码的 IndexError 经 describeError 的中文
  const u52 = run.find((x) => x.task.id === "U5L2-M1");
  if (u52) {
    R.probes.u5l2 = await page.evaluate(async ([code, tests]) => { const { describeError } = await import("/src/errors.js"); const r = await window.J({ code, tests, checkMode: "output", compare: "strict" }); return r.cases.map((c) => ({ name: c.name, kind: c.kind, error: c.error ? { kind: c.error.kind, msg: c.error.msg, line: c.error.line } : null, zh: c.error ? describeError(c.error) : null })); }, [u52.task.code, u52.task.tests.map((x) => ({ name: x.name, data: x.data, expected: x.expected, hidden: x.hidden }))]);
  }
  R.pageErrorsA = errs;
  await page.close();
} finally { await vite.close(); }

// ================= B 层 =================
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".zip": "application/zip", ".webmanifest": "application/manifest+json" };
const PORT = 4351 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html"); if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: ENGINE === "chromium", serviceWorkers: "block" });
  ctx.setDefaultTimeout(60000);
  const page = await ctx.newPage(); const errs = []; page.on("pageerror", (e) => errs.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  const stat = () => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
  const setCode = (c) => page.evaluate((c) => window.__app.currentArea.setCode(c), c);
  const judged = () => page.waitForFunction(() => { const b = document.querySelector("[data-check]"); return (b && b.textContent === "检查" && !b.disabled) || document.querySelector(".feedbar"); }, null, { timeout: 90000 });
  const clickCheck = async () => { const t0 = Date.now(); await page.locator("[data-check]").tap(); await judged(); return Date.now() - t0; };
  for (const { lesson, task: t } of run) {
    const rec = (R.tasks[t.id] ||= {}); const ui = (rec.ui = {});
    await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
    const L = { id: "P0-" + t.id, title: "P0", concept: "P0", story: "P0", introCode: "print(1)", exercises: [{ ...t }] };
    await page.evaluate((l) => window.__app.startLesson(l, { review: false }), L);
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-code-task]");
    ui.initialCodeOk = (await page.evaluate(() => window.__app.currentArea.code())) === starterOf(t);
    await setCode(starterOf(t)); // 触发 onChange，检查按钮才可点（与 code-task.test.mjs 同法）
    const s0 = await stat();
    ui.starterCheckMs = await clickCheck();
    const fb1 = await page.locator(".feedbar").count();
    ui.starterSettled = fb1 > 0; const s1 = await stat();
    ui.starterHeartsDelta = s1.hearts - s0.hearts; ui.starterXpDelta = s1.xp - s0.xp;
    ui.starterResultText = ((await page.locator("[data-results]").innerText().catch(() => "")) || "").replace(/\s+/g, " ").slice(0, 260);
    ui.starterFeedback = fb1 ? (await page.locator(".feedbar").innerText()).replace(/\s+/g, " ").slice(0, 120) : null;
    if (fb1) { await page.waitForFunction(() => !document.querySelector("[data-continue]").disabled); await page.locator("[data-continue]").tap(); await page.waitForSelector("[data-code-task]"); }
    await setCode(t.reference);
    const s2 = await stat(); ui.refCheckMs = await clickCheck();
    ui.refFeedbackOk = (await page.locator(".feedbar.ok").count()) === 1; const s3 = await stat(); ui.refXpDelta = s3.xp - s2.xp;
    await page.waitForFunction(() => !document.querySelector("[data-continue]").disabled);
    ui.variationUiAfterPass = (await page.locator("[data-variation]").count()) > 0;
    await page.locator("[data-continue]").tap();
    await page.waitForFunction(() => document.querySelector(".finish") || document.querySelector("[data-code-task]"), null, { timeout: 30000 });
    ui.reachedFinish = (await page.locator(".finish").count()) === 1; const s4 = await stat(); ui.totalXpDelta = s4.xp - s0.xp;
    ui.finishText = ui.reachedFinish ? (await page.locator(".finish").innerText()).replace(/\s+/g, " ").slice(0, 80) : (await page.locator("[data-code-task]").count() ? "（又出现一道题：" + ((await page.locator("[data-variation]").count()) ? "变化题" : "原题重做") + "）" : "");
    log(`B ${t.id}: 起始 ${ui.starterSettled ? "判错(红心" + ui.starterHeartsDelta + ")" : "未结算"} ${ui.starterCheckMs}ms；参考 ${ui.refFeedbackOk ? "答对" : "未答对"} ${ui.refCheckMs}ms XP+${ui.refXpDelta}；结尾 ${ui.reachedFinish ? "通关页" : ui.finishText}`);
    if (!ui.reachedFinish) { await page.evaluate(() => window.__app.renderPath()); }
  }
  R.pageErrorsB = errs;
  await ctx.close();
} finally { srv.closeAllConnections?.(); srv.close(); await browser.close(); }
writeFileSync(OUT, JSON.stringify(R, null, 1));
// ---- 判定（P0 验证变成回归测试：任何一项不符合预期 → 退出码 1）----
let bad = 0; const chk = (n, ok, d = "") => { if (!ok) { bad++; log(`❌ ${n}${d ? "  — " + d : ""}`); } };
const EXPECT_HANG = new Set(["U4L6-M1"]);
for (const [id, r] of Object.entries(R.tasks)) {
  if (!r.reference) continue;
  chk(`${id} 参考答案全过`, r.reference.status === "pass" && r.reference.cases.every((c) => c.ok), r.reference.status);
  chk(`${id} 起始代码不能全过`, r.starter.status !== "pass");
  chk(`${id} 起始代码 ${EXPECT_HANG.has(id) ? "必须超时" : "不能超时"}`, EXPECT_HANG.has(id) ? r.starter.status === "timeout" : r.starter.status !== "timeout", r.starter.status);
  if (r.variation) { chk(`${id} 变化题答案全过`, r.variation.solution.status === "pass"); chk(`${id} 变化题起始不能全过`, r.variation.starter.status !== "pass"); chk(`${id} 父题答案过不了变化题`, r.variation.parentRefOnVariation.status !== "pass"); }
  chk(`${id} 示范输出属实`, !r.worked || r.worked.status === "pass");
  chk(`${id} 数据注入类型和值一致`, r.injection.status === "pass" && r.injection.bad.length === 0, JSON.stringify(r.injection.bad));
  const u = r.ui; if (!u) continue;
  chk(`${id} 界面：初始代码正确`, u.initialCodeOk);
  if (EXPECT_HANG.has(id)) chk(`${id} 界面：超时不结算、不扣红心`, !u.starterSettled && u.starterHeartsDelta === 0 && u.starterXpDelta === 0);
  else chk(`${id} 界面：起始代码判错扣 1 颗心`, u.starterSettled && u.starterHeartsDelta === -1 && u.starterXpDelta === 0);
  chk(`${id} 界面：参考答案答对 +10 XP，通关页，总 +20`, u.refFeedbackOk && u.refXpDelta === 10 && u.reachedFinish && u.totalXpDelta === 20);
}
chk("U5L2 报错：IndexError 中文展示", !R.probes.u5l2 || R.probes.u5l2.every((c) => c.error?.kind === "IndexError" && /索引错误/.test(c.zh)));
chk("无页面脚本错误", R.pageErrorsA.length === 0 && R.pageErrorsB.length === 0, JSON.stringify([R.pageErrorsA, R.pageErrorsB]));
log(bad ? `P0 回归：${bad} 项不符合预期` : `P0 回归：${Object.keys(R.tasks).length} 道题全部符合预期`);
process.exit(bad ? 1 : 0);
log("结果已写入", OUT);
