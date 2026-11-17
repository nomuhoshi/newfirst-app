// 代码题试点（U3L5-M1）：真实构建 + 真实 Pyodide，手机视口。Chromium / WebKit 都跑（MOBILE_BROWSER 或第一个参数）。
// 三份构建：dist（测试专用）和 dist-formal（正式）里代码题必须关闭（课程和以前一样）；dist-code-tasks（CODE_TASKS=U3L5-M1）里 U3L5 第 4 题是改代码题。
// 在试点构建里验证：整关通关（XP / 红心规则不变）、答错重做、“看参考解法 → 变化题”状态机、随机练习题池排除代码题。
// 运行：npm run build:ci && node tests/code-task-pilot-browser.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const engine = ENGINE === "webkit" ? webkit : chromium;
const PORT0 = 4431 + (ENGINE === "webkit" ? 10 : 0);
const unit3 = JSON.parse(readFileSync(join(ROOT, "content/unit3.json")));
const L5 = unit3.lessons.find((l) => l.id === "U3L5"), TASK = L5.pending[0].task;
const prev = [...JSON.parse(readFileSync(join(ROOT, "content/unit1.json"))).lessons, ...JSON.parse(readFileSync(join(ROOT, "content/unit2.json"))).lessons, ...unit3.lessons.slice(0, 4)].map((l) => l.id);
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const serve = (dir, port) => new Promise((r) => { const s = createServer((q, res) => { const u = new URL(q.url, "http://x/"); let p = join(ROOT, dir, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(join(ROOT, dir)) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); res.end(readFileSync(p)); }); s.listen(port, () => r(s)); });
const servers = [await serve("dist", PORT0), await serve("dist-formal", PORT0 + 1), await serve("dist-code-tasks", PORT0 + 2)];
let browser;
try { browser = await engine.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
const NOW = Date.now();
const seed = (done) => JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: Object.fromEntries(done.map((k) => [k, true])), lessonsCompleted: done.length, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
async function openPage(port, done = prev) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: ENGINE === "chromium", hasTouch: true, serviceWorkers: "block" });
  ctx.setDefaultTimeout(60000);
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); localStorage.setItem("suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, seed(done));
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
  return { ctx, page, errors };
}
const stat = (page) => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
const cur = (page) => page.evaluate(() => window.__app.currentEx);
const setCode = (page, c) => page.evaluate((c) => window.__app.currentArea.setCode(c), c);
const judged = (page) => page.waitForFunction(() => { const b = document.querySelector("[data-check]"); return (b && b.textContent === "检查" && !b.disabled) || document.querySelector(".feedbar"); }, null, { timeout: 90000 });
async function startU3L5(page) {
  await page.evaluate(() => { const l = window.__app.allLessons().find((x) => x.id === "U3L5"); window.__app.startLesson(l); });
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForSelector("[data-check]");
}
const cont = async (page) => { await page.waitForFunction(() => { const b = document.querySelector("[data-continue]"); return b && !b.disabled; }); await page.locator("[data-continue]").tap(); await page.waitForFunction(() => document.querySelector(".finish") || document.querySelector("[data-check]")); };
// 答一道点选题（按文字 / 行号，与位置无关）；wrong=true 时故意答错
async function answerPlain(page, wrong = false) {
  const ex = await cur(page);
  if (ex.type === "predict") { const i = ex.options.findIndex((o) => !!o.correct === !wrong); await page.locator(".choice").nth(i).tap(); }
  else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, k) => (k === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) ?? a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).tap(); }
  else if (ex.type === "order") { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).tap(); }
  await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar");
  return ex.type;
}
async function checkCode(page) { await page.locator("[data-check]").tap(); await judged(page); }

try {
  // ===== 1. 开关：普通测试构建和正式构建里代码题关闭 =====
  for (const [name, port] of [["测试构建 dist", PORT0], ["正式构建 dist-formal", PORT0 + 1]]) {
    const { ctx, page, errors } = await openPage(port);
    const r = await page.evaluate(() => ({ en: window.__app.codeTasksEnabled(), l5: window.__app.allLessons().find((x) => x.id === "U3L5") }));
    check(`${name}：代码题试点列表为空，U3L5 的 4 题仍是 选输出/填空/排序/选输出，没有代码题，pending 仍在`, r.en.length === 0 && JSON.stringify(r.l5.exercises.map((e) => e.type)) === JSON.stringify(["predict", "fill", "order", "predict"]) && Array.isArray(r.l5.pending), JSON.stringify([r.en, r.l5.exercises.map((e) => e.type)]));
    check(`${name}：无脚本错误`, errors.length === 0, errors.join("|")); await ctx.close();
  }
  // ===== 2. 试点构建：合并结果 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2);
    const r = await page.evaluate(() => { const L = window.__app.allLessons(); const l5 = L.find((x) => x.id === "U3L5"); return { en: window.__app.codeTasksEnabled(), types: l5.exercises.map((e) => e.type), id: l5.exercises[3].id, pend: l5.pending ?? null, l6: L.find((x) => x.id === "U3L6").exercises.map((e) => e.type), l6p: (L.find((x) => x.id === "U3L6").pending || []).length }; });
    check("试点构建：启用列表是 [U3L5-M1]；U3L5 第 4 题是改代码题 U3L5-M1，前 3 题类型不变，pending 被移出", JSON.stringify(r.en) === '["U3L5-M1"]' && JSON.stringify(r.types) === JSON.stringify(["predict", "fill", "order", "modify"]) && r.id === "U3L5-M1" && r.pend === null, JSON.stringify(r));
    check("试点构建：其它关卡不受影响（U3L6 仍是 4 道点选题，pending 还在）", r.l6.every((t) => ["predict", "fill", "order"].includes(t)) && r.l6p === 1, JSON.stringify(r.l6));
    await ctx.close(); if (errors.length) check("试点构建初始页面无脚本错误", false, errors.join("|")); }

  // ===== 3. 整关：全部答对 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2); await startU3L5(page);
    const s0 = await stat(page); let sawCode = false;
    for (let guard = 0; guard < 8 && !(await page.locator(".finish").count()); guard++) {
      const ex = await cur(page);
      if (ex.type === "modify") {
        sawCode = true;
        check("代码题界面：显示编辑器、内置键盘、已给变量 total，初始代码是题目给的错误代码", (await page.locator(".cm-editor").isVisible()) && /total/.test(await page.locator("[data-code-task]").innerText()) && (await page.evaluate(() => window.__app.currentArea.code())) === TASK.code);
        await setCode(page, TASK.code); const b = await stat(page);
        await page.locator("[data-run]").tap(); await page.waitForFunction(() => /运行结果/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 90000 });
        check("“运行”只试一试：不改 XP、不扣红心、没有反馈条", JSON.stringify(await stat(page)) === JSON.stringify(b) && (await page.locator(".feedbar").count()) === 0);
        await setCode(page, TASK.reference); await checkCode(page); await page.waitForSelector(".feedbar.ok");
      } else await answerPlain(page);
      await cont(page);
    }
    const s1 = await stat(page);
    check("整关通关：经过了代码题；XP 恰好 +50（4 题 ×10 + 通关 10），红心不变", sawCode && (await page.locator(".finish").count()) === 1 && s1.xp - s0.xp === 50 && s1.hearts === s0.hearts, JSON.stringify([s0, s1, sawCode]));
    check("整关无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }

  // ===== 4. 答错再重做：扣 1 颗心，这道题排到最后再做，XP 仍是 50 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2); await startU3L5(page);
    const s0 = await stat(page); let wrongDone = false, seenCode = 0;
    for (let guard = 0; guard < 10 && !(await page.locator(".finish").count()); guard++) {
      const ex = await cur(page);
      if (ex.type === "modify") {
        seenCode++;
        if (!wrongDone) { wrongDone = true; const pre = await stat(page); await setCode(page, TASK.code); await checkCode(page); await page.waitForSelector(".feedbar.bad"); const s = await stat(page);
          check("代码题答错（起始代码）：扣 1 颗心，XP 不变，反馈“不对哦”", s.hearts === pre.hearts - 1 && s.xp === pre.xp && /不对哦/.test(await page.locator(".feedbar").innerText()), JSON.stringify([pre, s])); }
        else { await setCode(page, TASK.reference); await checkCode(page); await page.waitForSelector(".feedbar.ok"); }
      } else await answerPlain(page);
      await cont(page);
    }
    const s1 = await stat(page);
    check("答错的代码题排到最后再做一次（共出现 2 次）并答对；最终 XP +50，红心 −1", seenCode === 2 && s1.xp - s0.xp === 50 && s1.hearts === s0.hearts - 1, JSON.stringify([seenCode, s0, s1]));
    check("答错重做无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }

  // ===== 5. “看参考解法 → 变化题”状态机 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2); await startU3L5(page);
    const s0 = await stat(page);
    for (let guard = 0; guard < 8 && (await cur(page)).type !== "modify"; guard++) { await answerPlain(page); await cont(page); }
    const s1 = await stat(page); check("到达代码题前：3 道点选题答对 +30", s1.xp - s0.xp === 30);
    const openHint = async () => { await page.evaluate(() => window.__app.currentArea.openHint()); };
    await openHint(); check("第 1 次提示：显示“提示 1/2”", /提示 1\/2/.test(await page.locator(".lsheet").innerText())); await page.locator(".lsheet button").first().tap();
    await openHint(); check("第 2 次提示：显示“提示 2/2”", /提示 2\/2/.test(await page.locator(".lsheet").innerText())); await page.locator(".lsheet button").first().tap();
    await openHint(); check("第 3 次：询问是否看参考解法，并写明之后要再做变化题", /要看参考解法吗/.test(await page.locator(".lsheet").innerText()) && /变化/.test(await page.locator(".lsheet").innerText()));
    await page.getByRole("button", { name: /看参考解法/ }).tap(); await page.waitForFunction(() => /参考解法/.test(document.querySelector(".lsheet")?.innerText || ""));
    check("看参考解法：显示题目的 reference 代码", (await page.locator(".lsheet .hint-text").innerText()).includes("print") && (await page.evaluate(() => window.__app.currentArea.viewedSolution())) === true);
    await page.locator(".lsheet button").first().tap();
    await setCode(page, TASK.reference); await page.locator("[data-check]").tap(); await page.waitForSelector("[data-variation]", { timeout: 90000 });
    const s2 = await stat(page);
    check("看过解法后原题通过：不结算（XP / 红心不变，没有反馈条），进入变化题界面", JSON.stringify(s2) === JSON.stringify(s1) && (await page.locator(".feedbar").count()) === 0 && (await page.evaluate(() => window.__app.currentArea.phase())) === "variation" && /变化题/.test(await page.locator("[data-variation]").innerText()));
    await setCode(page, TASK.variation.starter); await checkCode(page);
    const s3 = await stat(page);
    check("变化题答错：不扣红心、不结算，提示“不扣红心，可以继续改”", JSON.stringify(s3) === JSON.stringify(s1) && (await page.locator(".feedbar").count()) === 0 && /变化题：不扣红心/.test(await page.locator("[data-results]").innerText()), await page.locator("[data-results]").innerText());
    await setCode(page, TASK.variation.solution); await checkCode(page); await page.waitForSelector(".feedbar.ok");
    const s4 = await stat(page);
    check("变化题答对：结算一次，原题奖励 +10（不重复加），红心不变", s4.xp - s1.xp === 10 && s4.hearts === s1.hearts, JSON.stringify([s1, s4]));
    await cont(page);
    for (let guard = 0; guard < 6 && !(await page.locator(".finish").count()); guard++) { await answerPlain(page); await cont(page); }
    const s5 = await stat(page);
    check("整关通关：看过解法再做变化题，总 XP 仍是 +50（不多不少）", (await page.locator(".finish").count()) === 1 && s5.xp - s0.xp === 50, JSON.stringify([s0, s5]));
    check("变化题流程无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }

  // ===== 6. 随机练习：题池排除代码题 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2, [...prev, "U3L5"]);
    await page.waitForSelector("[data-practice-entry]"); await page.locator("[data-practice-entry]").tap(); await page.waitForSelector(".practice-setup");
    await page.locator("[data-practice-none]").tap(); await page.locator('[data-practice-lesson="U3L5"]').tap();
    const info = await page.locator("[data-practice-info]").innerText();
    check("练习范围页：U3L5 只算 3 道题（不含代码题）", /3 道题/.test(info) && !/4 道题/.test(info), info);
    await page.locator("[data-practice-start]").tap(); await page.waitForSelector("[data-check]");
    const pr = await page.evaluate(() => { const p = window.__app.getPractice(); return { total: p.total, ids: p.items.map((x) => x.id), types: p.items.map((x) => x.ex.type) }; });
    check("练习题池：U3L5 的 3 道点选题，不含代码题（#3 即第 4 题）", pr.total === 3 && !pr.ids.includes("U3L5#3") && pr.types.every((t) => ["predict", "fill", "order"].includes(t)), JSON.stringify(pr));
    const x0 = await stat(page); const types = [];
    for (let g = 0; g < 8 && (await page.locator("[data-check]").count()); g++) { types.push(await answerPlain(page)); await page.locator("[data-continue]:not([disabled])").tap(); await page.waitForSelector("[data-check], .practice-finish"); }
    check("练习整轮只出点选题、不增加 XP、没有代码题界面", types.length === 3 && (await page.locator("[data-code-task]").count()) === 0 && (await stat(page)).xp === x0.xp, JSON.stringify(types));
    check("练习路径无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }
} finally { for (const s of servers) { s.closeAllConnections?.(); s.close(); } await browser.close(); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
