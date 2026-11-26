// 代码题试点（U3L5-M1）：真实构建 + 真实 Pyodide，手机视口。Chromium / WebKit 都跑（MOBILE_BROWSER 或第一个参数）。
// 三份构建：dist（测试专用）和 dist-formal（正式）里代码题必须关闭（课程和以前一样）；dist-code-tasks（CODE_TASKS=U3L5-M1）里 U3L5 第 4 题是改代码题。
// 在试点构建里验证：整关通关（XP / 红心规则不变）、答错重做、“看参考解法 → 变化题”状态机、随机练习题池排除代码题。
// 运行：npm run build:ci && node tests/code-task-pilot-browser.test.mjs [chromium|webkit]
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { join, extname } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const engine = ENGINE === "webkit" ? webkit : chromium;
const PORT0 = 4431 + (ENGINE === "webkit" ? 10 : 0);
const unit3 = JSON.parse(readFileSync(join(ROOT, "content/unit3.json")));
const IDS = JSON.parse(readFileSync(join(ROOT, "scripts/code-task-pilot-ids.json"), "utf8")), IDS_TXT = JSON.stringify(IDS);
// 全部 pending 题（按 ID 取）：unit1–6
const ALL_TASKS = {}; for (let n = 1; n <= 6; n++) for (const l of JSON.parse(readFileSync(join(ROOT, `content/unit${n}.json`))).lessons) for (const p of l.pending || []) ALL_TASKS[p.task.id] = { lesson: l.id, replaces: p.replaces, task: p.task, nEx: l.exercises.length };
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
  // ===== 0. 构建产物层面：试点列表只在 dist-code-tasks 的主脚本里是 [U3L5-M1]；dist / dist-formal 里是空列表 =====
  { const main = (d) => { const dir = join(ROOT, d, "assets"); const f = readdirSync(dir).find((x) => /^main-.*\.js$/.test(x)); return readFileSync(join(dir, f), "utf8"); };
    const RE = /=\[((?:`[^`]+`,?)*)\],[\w$]+=[\w$]+\(\{U1:/;
    const parse = (mm) => (mm ? "[" + (mm[1].match(/`([^`]+)`/g) || []).map((x) => x.slice(1, -1)).join(",") + "]" : null);
    const m = Object.fromEntries(["dist", "dist-formal", "dist-code-tasks"].map((d) => [d, main(d).match(RE)]));
    check("构建产物（主脚本）：dist 里代码题试点列表是空数组 []", parse(m.dist) === "[]", String(parse(m.dist)));
    check("构建产物（主脚本）：dist-formal（正式）里代码题试点列表是空数组 []", parse(m["dist-formal"]) === "[]", String(parse(m["dist-formal"])));
    check(`构建产物（主脚本）：只有 dist-code-tasks 里是试点题列表（${IDS.length} 道）`, parse(m["dist-code-tasks"]) === "[" + IDS.join(",") + "]", String(parse(m["dist-code-tasks"]))); }
  // ===== 1. 开关：普通测试构建和正式构建里代码题关闭 =====
  for (const [name, port] of [["测试构建 dist", PORT0], ["正式构建 dist-formal", PORT0 + 1]]) {
    const { ctx, page, errors } = await openPage(port);
    const r = await page.evaluate(() => ({ en: window.__app.codeTasksEnabled(), l5: window.__app.allLessons().find((x) => x.id === "U3L5") }));
    check(`${name}：代码题试点列表为空，U3L5 的 4 题仍是 选输出/填空/排序/选输出，没有代码题，pending 仍在`, r.en.length === 0 && JSON.stringify(r.l5.exercises.map((e) => e.type)) === JSON.stringify(["predict", "fill", "order", "predict"]) && Array.isArray(r.l5.pending), JSON.stringify([r.en, r.l5.exercises.map((e) => e.type)]));
    const allTypes = await page.evaluate(() => window.__app.allLessons().flatMap((l) => l.exercises.map((e) => e.type)));
    check(`${name}：整个课程里没有任何改代码 / 写代码题（${allTypes.length} 道题，类型只有选输出 / 填空 / 排序）`, allTypes.length > 100 && allTypes.every((t) => ["predict", "fill", "order"].includes(t)), JSON.stringify([...new Set(allTypes)]));
    check(`${name}：无脚本错误`, errors.length === 0, errors.join("|")); await ctx.close();
  }
  // ===== 2. 试点构建：合并结果 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2);
    const r = await page.evaluate((ids) => { const L = window.__app.allLessons(); const l5 = L.find((x) => x.id === "U3L5"); return { en: window.__app.codeTasksEnabled(), types: l5.exercises.map((e) => e.type), id: l5.exercises[3].id, pend: l5.pending ?? null, l6: L.find((x) => x.id === "U1L1").exercises.map((e) => e.type), l6p: L.filter((x) => (x.pending || []).some((pt) => ids.includes(pt.task?.id))).length, rest: L.flatMap((x) => (x.pending || []).map((pt) => pt.task?.id)).filter((id) => !ids.includes(id)) }; }, IDS);
    check("试点构建：启用列表 = 试点清单；U3L5 第 4 题是改代码题 U3L5-M1，前 3 题类型不变，pending 被移出", JSON.stringify(r.en) === IDS_TXT && JSON.stringify(r.types) === JSON.stringify(["predict", "fill", "order", "modify"]) && r.id === "U3L5-M1" && r.pend === null, JSON.stringify(r));
    const nCode = await page.evaluate(() => window.__app.allLessons().flatMap((l) => l.exercises).filter((e) => e.type === "modify" || e.type === "write").map((e) => e.id));
    check(`试点构建：整个课程里恰好 ${IDS.length} 道代码题，就是试点清单里的题`, JSON.stringify([...nCode].sort()) === JSON.stringify([...IDS].sort()), JSON.stringify(nCode));
    check("试点构建：没有代码题的关卡不受影响（U1L1 仍是点选题），试点清单里的 pending 题都已合并，清单里的题没有关卡还留着 pending；不在清单里的 pending 只有 U7L6-M1（U7 接入后新增，不进试点、仍留着）", r.l6.every((t) => ["predict", "fill", "order"].includes(t)) && r.l6p === 0 && JSON.stringify(r.rest) === JSON.stringify(["U7L6-M1"]), JSON.stringify([r.l6, r.l6p, r.rest]));
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

  // ===== 7. 未知题型 / 代码题混进随机练习：绝不进入排序界面（防御性跳过）=====
  { const { ctx, page, errors } = await openPage(PORT0 + 2, [...prev, "U3L5"]);
    const warns = []; page.on("console", (m) => { if (m.type() === "warning" && /随机练习：跳过不支持的题型/.test(m.text())) warns.push(m.text()); });
    await page.waitForSelector("[data-practice-entry]");
    await page.evaluate((task) => { const l5 = window.__app.allLessons().find((x) => x.id === "U3L5"); const mk = (id, ex) => ({ id, lessonId: "U3L5", unitId: "U3", index: 0, ex });
      window.__app.startPractice([mk("X#0", { type: "mystery", prompt: "不认识的题型" }), mk("X#1", { ...task }), mk("U3L5#0", l5.exercises[0])], 3, { selected: ["U3L5"], size: 3 }); }, TASK);
    await page.waitForSelector("[data-check], .practice-finish");
    const seen = [];
    for (let g = 0; g < 6 && (await page.locator("[data-check]").count()); g++) {
      const ex = await cur(page); seen.push(ex.type);
      if ((await page.locator(".order-bank").count()) || (await page.locator("[data-code-task]").count())) seen.push("BAD-UI");
      await answerPlain(page); await page.locator("[data-continue]:not([disabled])").tap(); await page.waitForSelector("[data-check], .practice-finish");
    }
    check("混入未知题型和代码题的练习：它们被跳过（各记一条警告），界面里始终只有点选题，绝没出现排序区 / 代码编辑器", JSON.stringify(seen) === '["predict"]' && warns.length === 2 && warns.some((w) => /mystery/.test(w)) && warns.some((w) => /modify/.test(w)), JSON.stringify([seen, warns]));
    check("混入后练习仍能走到结束页（不卡死）", (await page.locator(".practice-finish").count()) === 1);
    check("混入练习无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }

  // ===== 8. Python 加载失败 / 离线：不算作答、不扣红心；恢复后同一关能做完，XP 精确 =====
  { const { ctx, page, errors } = await openPage(PORT0 + 2);
    let block = true; await page.route("**/pyodide/**", (r) => (block ? r.abort() : r.continue()));
    await startU3L5(page); const s0 = await stat(page);
    for (let guard = 0; guard < 6 && (await cur(page)).type !== "modify"; guard++) { await answerPlain(page); await cont(page); }
    const s1 = await stat(page); check("到达代码题前：3 道点选题答对 +30", s1.xp - s0.xp === 30);
    await setCode(page, TASK.reference); await checkCode(page);
    const s2 = await stat(page); const txt = await page.locator("[data-results]").innerText();
    check("Python 加载失败（pyodide 请求被拦）：检查不算作答，不扣红心，XP 不变，没有反馈条，按钮回到“检查”", JSON.stringify(s2) === JSON.stringify(s1) && (await page.locator(".feedbar").count()) === 0 && (await page.locator("[data-check]").innerText()) === "检查" && /Python|没准备好|不算作答/.test(txt), txt.slice(0, 120));
    check("加载失败时代码保留，提示写明“不算作答、代码已保留、请重试”（红心确实没扣见上一项）", (await page.evaluate(() => window.__app.currentArea.code())) === TASK.reference && /不算作答/.test(txt) && /代码已保留/.test(txt), txt.slice(0, 160));
    await ctx.setOffline(true); await checkCode(page);
    const s3 = await stat(page); check("离线（断网）再检查：同样不算作答、不扣红心", JSON.stringify(s3) === JSON.stringify(s1) && (await page.locator(".feedbar").count()) === 0);
    await ctx.setOffline(false); block = false; await page.waitForTimeout(500);
    await checkCode(page); await page.waitForSelector(".feedbar.ok", { timeout: 90000 });
    const s4 = await stat(page); check("恢复网络后同一题能判对：+10，红心不变", s4.xp - s1.xp === 10 && s4.hearts === s1.hearts, JSON.stringify([s1, s4]));
    await cont(page);
    for (let guard = 0; guard < 4 && !(await page.locator(".finish").count()); guard++) { await answerPlain(page); await cont(page); }
    const s5 = await stat(page); check("真实 U3L5 全关：加载失败一次 + 离线一次之后通关，XP 恰好 +50，红心 5 不变", (await page.locator(".finish").count()) === 1 && s5.xp - s0.xp === 50 && s5.hearts === s0.hearts, JSON.stringify([s0, s5]));
    check("加载失败 / 离线流程无脚本错误", errors.length === 0, errors.join("|")); await ctx.close(); }

  // ===== 9. 试点清单里其余每一道题：真实整关（每题两种走法：A 答错一次再答对；B 看参考解法 → 变化题）=====
  async function walkLesson(lessonId, id, mode) {
    const { task, replaces } = ALL_TASKS[id]; const start = task.type === "modify" ? task.code : task.starter;
    const { ctx, page, errors } = await openPage(PORT0 + 2);
    await page.evaluate((lid) => { const l = window.__app.allLessons().find((x) => x.id === lid); window.__app.startLesson(l); }, lessonId);
    await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]");
    const s0 = await stat(page); const log = { codeAt: -1, codeSeen: 0, wrongHeart: null, varOk: null }; let n = 0, wrongDone = false;
    for (let guard = 0; guard < 12 && !(await page.locator(".finish").count()); guard++) {
      const ex = await cur(page);
      if (ex.type === "modify" || ex.type === "write") {
        log.codeSeen++; if (log.codeAt < 0) log.codeAt = n;
        if (ex.id !== id) { log.other = ex.id; break; }
        if (mode === "T") {
          // 死循环超时题：起始代码必超时。超时那次页面不计入作答（不扣红心、没有反馈条、不加 XP、代码保留），Worker 被终止后能恢复
          const pre = await stat(page); log.tmo = [];
          for (let k = 0; k < 2; k++) {                       // 连续两次超时：每次都要能恢复，不是只恢复一次
            await setCode(page, start); const t0 = Date.now(); await checkCode(page); const ms = Date.now() - t0; const s = await stat(page);
            const txt = await page.locator("[data-results]").innerText();
            log.tmo.push({ ms, same: JSON.stringify(s) === JSON.stringify(pre), noFb: (await page.locator(".feedbar").count()) === 0, btn: (await page.locator("[data-check]").innerText()) === "检查" && !(await page.locator("[data-check]").isDisabled()), msg: /运行时间太长/.test(txt) && /不算作答/.test(txt) && /不扣红心/.test(txt), kept: (await page.evaluate(() => window.__app.currentArea.code())) === start });
          }
          // 用户点“运行”再中途点“停止”：Worker 被终止，页面不卡
          await page.locator("[data-run]").tap(); await page.waitForFunction(() => document.querySelector("[data-run]")?.textContent === "停止", null, { timeout: 20000 }); await page.waitForTimeout(800); await page.locator("[data-run]").tap();
          await page.waitForFunction(() => document.querySelector("[data-run]")?.textContent === "运行" && /已停止/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 30000 });
          const sStop = await stat(page); log.stopSame = JSON.stringify(sStop) === JSON.stringify(pre);
          // 手动停止后立刻：同一页面、同一个 Runner 上跑一段输出可区分的正常代码，必须正常结束并给出这段输出
          await setCode(page, 'print("STOP-OK", 6 * 7)'); const tOk = Date.now();
          await page.locator("[data-run]").tap(); await page.waitForFunction(() => document.querySelector("[data-run]")?.textContent === "运行" && /运行结果/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 30000 });
          log.afterStopMs = Date.now() - tOk; log.afterStopOut = (await page.locator("[data-results] .ct-out").first().innerText()).trim();
          log.afterStopSame = JSON.stringify(await stat(page)) === JSON.stringify(pre);
          await setCode(page, start);
          // 试运行自己撞上 5 秒上限：提示“不影响答题，不扣红心”，随后能恢复
          await page.locator("[data-run]").tap(); await page.waitForFunction(() => document.querySelector("[data-run]")?.textContent === "运行" && /运行超过/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 40000 });
          log.runTimeoutMsg = /不影响答题，也不扣红心/.test(await page.locator("[data-results]").innerText()); log.runSame = JSON.stringify(await stat(page)) === JSON.stringify(pre);
          // 恢复：同一个 Runner 上判参考答案，通过并结算 +10
          await setCode(page, task.reference); const t1 = Date.now(); await checkCode(page); await page.waitForSelector(".feedbar.ok"); log.recoverMs = Date.now() - t1;
          log.runnerState = await page.evaluate(() => window.__app.runner?.state); const s = await stat(page); log.recoverXp = s.xp - pre.xp; log.recoverHearts = s.hearts - pre.hearts;
        } else if (mode === "A" && !wrongDone) { wrongDone = true; const pre = await stat(page); await setCode(page, start); await checkCode(page); await page.waitForSelector(".feedbar.bad"); const s = await stat(page); log.wrongHeart = pre.hearts - s.hearts; log.wrongXp = s.xp - pre.xp; }
        else if (mode === "B") {
          const pre = await stat(page);
          for (let k = 0; k < 2; k++) { await page.evaluate(() => window.__app.currentArea.openHint()); await page.locator(".lsheet button").first().tap(); }
          await page.evaluate(() => window.__app.currentArea.openHint()); await page.getByRole("button", { name: /看参考解法/ }).tap(); await page.waitForFunction(() => /参考解法/.test(document.querySelector(".lsheet")?.innerText || "")); await page.locator(".lsheet button").first().tap();
          await setCode(page, task.reference); await page.locator("[data-check]").tap(); await page.waitForSelector("[data-variation]", { timeout: 90000 });
          const mid = await stat(page); log.midSame = JSON.stringify(mid) === JSON.stringify(pre) && (await page.locator(".feedbar").count()) === 0;
          await setCode(page, task.variation.starter); await checkCode(page); const sv = await stat(page); log.varWrongSame = JSON.stringify(sv) === JSON.stringify(pre) && (await page.locator(".feedbar").count()) === 0;
          await setCode(page, task.variation.solution); await checkCode(page); await page.waitForSelector(".feedbar.ok"); const s = await stat(page); log.varXp = s.xp - pre.xp; log.varHearts = s.hearts - pre.hearts;
        } else { await setCode(page, task.reference); await checkCode(page); await page.waitForSelector(".feedbar.ok"); log.varUi = await page.locator("[data-variation]").count(); }
      } else await answerPlain(page);
      n++; await cont(page);
    }
    const s1 = await stat(page); log.xp = s1.xp - s0.xp; log.hearts = s1.hearts - s0.hearts; log.finish = (await page.locator(".finish").count()) === 1; log.errors = errors.length;
    await ctx.close(); return log;
  }
  for (const id of IDS.filter((x) => x !== "U3L5-M1")) {
    const { lesson, replaces, task, nEx } = ALL_TASKS[id], XP = nEx * 10 + 10; // 每题 +10，通关 +10（U6L8 是 5 题 = 60）
    if (id === "U4L6-M1") {
      const T = await walkLesson(lesson, id, "T");
      // 实际耗时写进日志（供复核）。窗口 [4900, 10000] ms 的依据：判题单组上限 5000 ms（不能更早停）；超时后要终止并重启 Worker（本机实测约 2 秒，见“参考答案恢复检查耗时”），本机实测两次约 6.2 / 6.9 s；上限取 10000 ms = 5 s + 重启 + 约 3 s 的 CI 容差，更久说明卡住了，必须失败
      console.log(`  ⏱ [${ENGINE}] ${id} 超时检查实际耗时：第 1 次 ${T.tmo?.[0]?.ms} ms，第 2 次 ${T.tmo?.[1]?.ms} ms（判题单组上限 5000 ms）`);
      console.log(`  ⏱ [${ENGINE}] ${id} 手动停止后立刻正常运行：输出 ${JSON.stringify(T.afterStopOut)}，耗时 ${T.afterStopMs} ms；参考答案恢复检查耗时 ${T.recoverMs} ms`);
      check(`${id}（${lesson}）死循环超时 ×2：每次都在上限停止（耗时在 4900–10000 ms 内，更久 = 卡住 = 失败），不算作答——红心不变、XP 不变、没有反馈条，按钮回到“检查”，提示写明“不算作答、不扣红心”，代码保留`, T.tmo?.length === 2 && T.tmo.every((x) => x.ms >= 4900 && x.ms <= 10000 && x.same && x.noFb && x.btn && x.msg && x.kept), JSON.stringify(T.tmo));
      check(`${id}（${lesson}）手动“停止”后立刻在同一页面的 Runner 上运行正常代码：正常结束并输出 “STOP-OK 42”，红心 / XP 不变`, T.afterStopOut === "STOP-OK 42" && T.afterStopSame === true && T.afterStopMs < 20000, JSON.stringify([T.afterStopOut, T.afterStopMs, T.afterStopSame]));
      check(`${id}（${lesson}）运行中点“停止”：Worker 被终止、红心 / XP 不变；试运行撞上 5 秒上限：提示“不影响答题，也不扣红心”`, T.stopSame === true && T.runSame === true && T.runTimeoutMsg === true, JSON.stringify([T.stopSame, T.runSame, T.runTimeoutMsg]));
      check(`${id}（${lesson}）Worker 终止后恢复：同一页面判参考答案通过，+10，红心不变，Runner 回到就绪`, T.recoverXp === 10 && T.recoverHearts === 0 && ["ready", "idle"].includes(T.runnerState) && T.recoverMs < 60000, JSON.stringify([T.recoverMs, T.runnerState, T.recoverXp, T.recoverHearts]));
      check(`${id}（${lesson}）超时 + 恢复后通关：第 ${replaces} 题是代码题、只出现 1 次，通关 XP 恰好 +${XP}、红心不变，无脚本错误`, T.codeAt === replaces - 1 && T.codeSeen === 1 && T.finish && T.xp === XP && T.hearts === 0 && T.errors === 0, JSON.stringify([T.codeAt, T.codeSeen, T.finish, T.xp, T.hearts, T.errors]));
      if (task.variation) { const B = await walkLesson(lesson, id, "B"); check(`${id}（${lesson}）真实整关 B：看参考解法 → 变化题 → 通关 XP 恰好 +${XP}、红心不变`, B.codeAt === replaces - 1 && B.midSame && B.varWrongSame && B.varXp === 10 && B.varHearts === 0 && B.finish && B.xp === XP && B.hearts === 0 && B.errors === 0, JSON.stringify(B)); }
      continue;
    }
    const A = await walkLesson(lesson, id, "A");
    check(`${id}（${lesson}）真实整关 A：第 ${replaces} 题是代码题；起始代码答错扣 1 颗心不加 XP，重做答对，通关 XP 恰好 +${XP}、红心 −1`, A.codeAt === replaces - 1 && A.codeSeen === 2 && A.wrongHeart === 1 && A.wrongXp === 0 && A.finish && A.xp === XP && A.hearts === -1 && A.errors === 0 && A.varUi === 0, JSON.stringify(A));
    if (task.variation) {
      const B = await walkLesson(lesson, id, "B");
      check(`${id}（${lesson}）真实整关 B：看参考解法 → 原题通过不结算 → 变化题答错不扣红心 → 变化题答对 +10 → 通关 XP 恰好 +${XP}、红心不变`, B.codeAt === replaces - 1 && B.midSame && B.varWrongSame && B.varXp === 10 && B.varHearts === 0 && B.finish && B.xp === XP && B.hearts === 0 && B.errors === 0, JSON.stringify(B));
    }
  }
} finally { for (const s of servers) { s.closeAllConnections?.(); s.close(); } await browser.close(); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
