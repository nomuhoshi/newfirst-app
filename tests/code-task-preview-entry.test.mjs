// P3 真机验收入口（独立测试入口）的构建配方与实际表现：按 .github/workflows/code-task-preview.yml 里同样的环境变量构建（PREVIEW_ID + CSP_TEST_ORIGIN=1 + CODE_TASKS_TEST_BUILD=1 + 全部 16 道），
// 放在 /newfirst-app-preview/p3-code/ 子路径下提供（和线上预览仓库一样的路径形态），然后：
//   1. 主脚本里的试点列表 = scripts/code-task-pilot-ids.json 全部 16 道；sw.js 缓存前缀 = p3-code-suipian-；产物里没有任何密钥字样；构建日志写明“云端：关闭”；
//   2. 浏览器里：启用列表 16 道、课程里恰好 16 道代码题；本地存储真实键全部带 “p3-code:” 前缀（和正式站同域名下不会读写正式进度）；“我的”页能看到测试入口信息（编号和源码提交号）；
//   3. 按验收文档（docs/60-…）的步骤、用分关进度码（docs/p3-progress-codes.txt）真实走一遍“首次作答”：地图里只有第一个没完成的关可首次作答，已完成的关是“复习”（答错不扣红心）——
//      A（U3L5、U3L6 没完成）：自带键盘输入 / 试运行 / “重新开始”恢复初始代码；U3L5 代码题先答错（扣 1 心）→ 继续 → 改对；U3L6 看解法 → 变化题（不结算、变化题答错不扣红心、答对只加一次）；
//      B（U4L6）：超时不算作答、不扣红心，之后能继续；C（U5L2）：IndexError 中文报错；D（U5L5）：没有变式题；
//   4. 草稿：写一半的代码刷新后还在；累计记录（XP、红心、已完成关卡）刷新后不变、刷新不加分；重新进入关卡从第 1 题开始；
//   5. 工作流里的“检查产物”片段（密钥字样）命中时必须真的让步骤失败（不是 `! grep`）。
// 运行：node tests/code-task-preview-entry.test.mjs [chromium|webkit]
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const engine = ENGINE === "webkit" ? webkit : chromium;
const OUT = join(ROOT, "iso-p3"), ID = "p3-code", SHA = "94a67e8c1edee0b2d05831640db24a4a166ab3aa", SUB = `/newfirst-app-preview/${ID}/`;
const CODES_TXT = readFileSync(join(ROOT, "docs/p3-progress-codes.txt"), "utf8");
const codeOf = (k) => { const m = CODES_TXT.match(new RegExp(`## 进度码 ${k}（[^\\n]*\\n(SPC1\\.[A-Za-z0-9+/=_-]+)`)); return m ? m[1] : null; };
const IDS = JSON.parse(readFileSync(join(ROOT, "scripts/code-task-pilot-ids.json"), "utf8"));
const TASKS = {}; for (let n = 1; n <= 6; n++) for (const l of JSON.parse(readFileSync(join(ROOT, `content/unit${n}.json`))).lessons) for (const p of l.pending || []) TASKS[p.task.id] = { lesson: l.id, task: p.task };
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
rmSync(OUT, { recursive: true, force: true });
const b = spawnSync("npx", ["vite", "build", "--outDir", "iso-p3"], { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PREVIEW_ID: ID, SOURCE_SHA: SHA, CSP_TEST_ORIGIN: "1", CODE_TASKS_TEST_BUILD: "1", CODE_TASKS: IDS.join(",") } });
const log = (b.stdout || "") + (b.stderr || "");
let srv, browser;
try {
  check("按预览入口配方构建成功", b.status === 0, log.slice(-300));
  check("构建日志：测试入口 p3-code、云端关闭、源码提交 = 指定 SHA、试点题清单写全 16 道", log.includes(`测试入口 ${ID} | 云端：关闭`) && log.includes(`源码提交：${SHA}`) && log.includes("代码题试点：" + IDS.join("、") + "（仅测试构建"), (log.match(/\[构建\][^\n]*/g) || []).join(" | ").slice(0, 300));
  const assets = readdirSync(join(OUT, "assets")), mainF = assets.find((x) => /^main-.*\.js$/.test(x)), mainJs = readFileSync(join(OUT, "assets", mainF), "utf8");
  const m = mainJs.match(/=\[((?:`[^`]+`,?)*)\],[\w$]+=[\w$]+\(\{U1:/), got = m ? (m[1].match(/`([^`]+)`/g) || []).map((x) => x.slice(1, -1)) : null;
  check("主脚本里的试点列表 = 清单全部 16 道", !!got && got.length === 16 && JSON.stringify(got) === JSON.stringify(IDS), JSON.stringify(got));
  check("sw.js 缓存前缀 = p3-code-suipian-，主脚本含指定源码提交号，产物里没有密钥字样", readFileSync(join(OUT, "sw.js"), "utf8").includes(`PREFIX = "${ID}-suipian-"`) && mainJs.includes(SHA) && !/sb_secret_[A-Za-z0-9]|service_role/.test(mainJs));
  const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
  const PORT = 4501 + (ENGINE === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}${SUB}`;
  srv = createServer((q, res) => { const u = new URL(q.url, "http://x/"); if (!u.pathname.startsWith(SUB)) { res.writeHead(404); res.end(); return; } let p = join(OUT, decodeURIComponent(u.pathname.slice(SUB.length))); if (u.pathname.endsWith("/")) p = join(p, "index.html");
    if (!p.startsWith(OUT) || !existsSync(p) || statSync(p).isDirectory()) { res.writeHead(404); res.end(); return; } res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); res.end(readFileSync(p)); });
  await new Promise((r) => srv.listen(PORT, r));
  try { browser = await engine.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: ENGINE === "chromium", hasTouch: true, serviceWorkers: "block" }); ctx.setDefaultTimeout(60000);
  const NOW = Date.now(), seed = JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: NOW, streak: 0, lastDay: null, done: {}, lessonsCompleted: 0, installTipClosed: true, lastActive: NOW, prefs: { sound: false, haptics: false, soundStyle: "J" } });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("p3-code:suipian.progress", s); sessionStorage.setItem("seeded", "1"); } }, seed); // 真实键带前缀（预览入口的存储包装在应用脚本里才生效，这里直接写真实键）
  const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e))); const csp = []; page.on("console", (m2) => { if (/Content Security Policy|Refused to/.test(m2.text())) csp.push(m2.text().slice(0, 160)); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
  const r = await page.evaluate(() => ({ en: window.__app.codeTasksEnabled(), code: window.__app.allLessons().flatMap((l) => l.exercises).filter((e) => e.type === "modify" || e.type === "write").map((e) => e.id) }));
  check("入口里的启用列表 = 清单 16 道，课程里恰好这 16 道代码题", JSON.stringify(r.en) === JSON.stringify(IDS) && JSON.stringify([...r.code].sort()) === JSON.stringify([...IDS].sort()) && r.code.length === 16, JSON.stringify(r));
  const st = await ctx.storageState(); const keys = st.origins.flatMap((o) => o.localStorage.map((k) => k.name));
  check("本地存储真实键全部带 “p3-code:” 前缀（不会读写正式站的进度）", keys.length > 0 && keys.every((k) => k.startsWith(ID + ":")), JSON.stringify(keys));
  const stat = () => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts, done: Object.keys(s.done).length }; });
  const toMe = async (sec) => { await page.getByRole("button", { name: "我的" }).tap(); await page.locator(`[data-me-menu="${sec}"]`).tap(); };
  const importCode = async (k, expectDone) => { // 文档里的做法：先清除（只清测试入口自己的记录），再粘贴进度码
    await page.evaluate(() => window.__app.renderPath()); await toMe("data"); await page.waitForSelector("[data-backup]");
    if ((await stat()).done > 0) { await page.getByRole("button", { name: "清除学习记录" }).tap(); await page.getByRole("button", { name: "确定清除" }).tap(); await page.waitForFunction(() => Object.keys(window.__app.getState().done).length === 0); await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="data"]').tap(); await page.waitForSelector("[data-backup]"); }
    const c = codeOf(k); if (!c) throw new Error("找不到进度码 " + k);
    await page.locator("[data-code-paste]").tap(); await page.locator("[data-code-in]").fill(c.match(/.{1,60}/g).join("\n")); await page.locator("[data-code-read]").tap(); await page.waitForSelector("[data-import-confirm]", { timeout: 8000 }).catch(async (e) => { console.log("导入提示：", await page.locator("[data-backup-msg]").innerText()); throw e; });
    const cf = await page.locator("[data-import-confirm]").innerText(); await page.getByRole("button", { name: "确认导入" }).tap(); await page.waitForFunction((n) => Object.keys(window.__app.getState().done).length === n, expectDone);
    return cf; };
  const cfA = await importCode("A", 41);
  check("进度码 A 能在界面里读取并导入：41 关已完成，红心 5；地图上第一个没完成的关是 U3L5", /41 个已完成关卡/.test(cfA) && (await stat()).hearts === 5 && (await page.evaluate(() => window.__app.allLessons().find((l) => !window.__app.getState().done[l.id]).id)) === "U3L5", cfA.replace(/\s+/g, " ").slice(0, 100));
  await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="account"]').tap(); await page.waitForSelector("[data-preview-info]");
  const meTxt = await page.locator("[data-preview-info]").innerText();
  check("“我的 → 账号”页的测试入口信息：编号 p3-code、源码提交 94a67e8c…、云端关闭", meTxt.includes(ID) && meTxt.includes(SHA.slice(0, 7)), meTxt.replace(/\s+/g, " ").slice(0, 240));
  const start = async (lid) => { await page.evaluate(() => window.__app.renderPath()); await page.locator(`[data-lesson="${lid}"]`).tap(); await page.locator(".overlay .btn3d.primary").tap(); await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]"); };
  const cur = () => page.evaluate(() => window.__app.currentEx);
  const plain = async (wrong = false) => { const ex = await cur(); if (ex.type === "predict") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === !wrong)).tap(); else if (ex.type === "fill") { const toks = wrong ? ex.answer.map((a, k) => (k === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) ?? a : a)) : ex.answer; for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).tap(); } else if (ex.type === "order") { const seq = wrong ? [...ex.answers[0]].reverse() : ex.answers[0]; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).tap(); } await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar"); };
  const next = async () => { await page.locator("[data-continue]:not([disabled])").tap(); await page.waitForFunction(() => document.querySelector("[data-check]") || document.querySelector(".finish")); };
  const gotoCode = async (id) => { for (let g = 0; g < 8; g++) { if ((await cur()).id === id) return; await plain(); await next(); } };
  const setCode = (c) => page.evaluate((c) => window.__app.currentArea.setCode(c), c);
  const code = () => page.evaluate(() => window.__app.currentArea.code());
  const judged = () => page.waitForFunction(() => { const x = document.querySelector("[data-check]"); return (x && x.textContent === "检查" && !x.disabled) || document.querySelector(".feedbar"); }, null, { timeout: 90000 });

  // ---- A：P3-02 / P3-03 / P3-06 ----
  await start("U3L5"); const a0 = await stat();
  await plain(true); const a1 = await stat();
  check("首次作答：普通题答错扣 1 颗心、XP 不变（说明这一关不是“复习”）", a1.hearts === a0.hearts - 1 && a1.xp === a0.xp, JSON.stringify([a0, a1]));
  await next(); await gotoCode("U3L5-M1"); const T5 = TASKS["U3L5-M1"].task, ini = await code();
  check("U3L5 第 4 题的初始代码就是题目给的错误代码", ini === T5.code);
  await setCode(""); for (const k of ["p", "r", "i", "n", "t"]) await page.locator(`#keyboard .kb-key[data-key="${k}"]`).tap();
  check("P3-02 自带键盘能往编辑器里打字", (await code()) === "print");
  const preRunBase = await stat(); await setCode('print("总价", 3 * 5)'); await page.locator("[data-run]").tap(); await page.waitForFunction(() => /运行结果/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 90000 });
  const preRun = await stat();
  check("P3-02 “运行”显示真实输出 总价 15，不判对错、不扣红心、不加 XP", /总价 15/.test(await page.locator("[data-results]").innerText()) && JSON.stringify(preRun) === JSON.stringify(preRunBase));
  await page.locator("[data-reset]").tap(); await page.getByRole("button", { name: "重新开始" }).last().tap();
  check("P3-02 点“重新开始”后编辑器恢复成题目给的初始代码", (await code()) === ini);
  const a1b = await stat(); await setCode(ini); await page.locator("[data-check]").tap(); await judged(); await page.waitForSelector(".feedbar.bad"); const a2 = await stat();
  check("P3-03 初始（错误）代码直接“检查”：不对哦，红心再 −1，XP 不变", a2.hearts === a1b.hearts - 1 && a2.xp === a1b.xp, JSON.stringify([a1b, a2]));
  await next(); let codeAgain = false;
  for (let g = 0; g < 8 && !(await page.locator(".finish").count()); g++) { const ex = await cur(); if (ex.id === "U3L5-M1") { codeAgain = true; await setCode(T5.reference); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 90000 }); } else await plain(); await next(); }
  const a3 = await stat();
  check("P3-03 答错的题排到最后：先重做第 1 题，最后回到这道代码题（codeAgain），改对后答对，整关通关；本关 XP = 4 题 ×10 + 通关 10 = +50，红心共 −2", codeAgain && (await page.locator(".finish").count()) === 1 && a3.xp - a0.xp === 50 && a3.hearts === a0.hearts - 2, JSON.stringify([a0, a3]));
  // U3L6 变式（此时 U3L6 是第一个没完成的关）
  await page.getByRole("button", { name: "继续", exact: true }).tap().catch(() => {}); await page.evaluate(() => window.__app.renderPath());
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await start("U3L6"); const b0 = await stat(); await gotoCode("U3L6-M1"); const T6 = TASKS["U3L6-M1"].task; const b1 = await stat();
  for (let k = 0; k < 2; k++) { await page.evaluate(() => window.__app.currentArea.openHint()); await page.locator(".lsheet button").first().tap(); }
  await page.evaluate(() => window.__app.currentArea.openHint()); await page.getByRole("button", { name: /看参考解法/ }).tap(); await page.waitForFunction(() => /参考解法/.test(document.querySelector(".lsheet")?.innerText || "")); await page.locator(".lsheet button").first().tap();
  await setCode(T6.reference); await page.locator("[data-check]").tap(); await page.waitForSelector("[data-variation]", { timeout: 90000 });
  check("P3-06 看过解法后原题通过：不结算（XP、红心不变，没有反馈条），出现“变化题”", JSON.stringify(await stat()) === JSON.stringify(b1) && (await page.locator(".feedbar").count()) === 0);
  await setCode(T6.variation.starter); await page.locator("[data-check]").tap(); await judged();
  check("P3-06 变化题答错：红心不变、不结算，提示“变化题：不扣红心”", JSON.stringify(await stat()) === JSON.stringify(b1) && /变化题：不扣红心/.test(await page.locator("[data-results]").innerText()));
  await setCode(T6.variation.solution); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 90000 }); const b2 = await stat();
  check("P3-06 变化题答对：结算一次，+10，红心不变", b2.xp - b1.xp === 10 && b2.hearts === b1.hearts);
  await next(); for (let g = 0; g < 6 && !(await page.locator(".finish").count()); g++) { await plain(); await next(); }
  check("P3-06 整关通关：本关 XP 恰好 +50（不因看解法多加）", (await stat()).xp - b0.xp === 50);

  // ---- B：P3-04（U4L6 超时）----
  await importCode("B", 42); await start("U4L6"); await gotoCode("U4L6-M1"); const c0 = await stat(); const T46 = TASKS["U4L6-M1"].task;
  await setCode(T46.code); const t0 = Date.now(); await page.locator("[data-check]").tap(); await judged(); const ms = Date.now() - t0;
  console.log(`  ⏱ [${ENGINE}] U4L6-M1 超时检查实际耗时 ${ms} ms`);
  check("P3-04 首次作答：超时停止（4.9–10 秒内），不算作答——红心 / XP 不变、没有反馈条，提示“不算作答”", ms >= 4900 && ms <= 10000 && JSON.stringify(await stat()) === JSON.stringify(c0) && (await page.locator(".feedbar").count()) === 0 && /不算作答/.test(await page.locator("[data-results]").innerText()), String(ms));
  await setCode(T46.reference); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 90000 }); const c1 = await stat();
  check("P3-04 超时之后同一页面继续判参考答案通过：+10，红心不变", c1.xp - c0.xp === 10 && c1.hearts === c0.hearts);
  // ---- C：P3-05（U5L2 报错）----
  await importCode("C", 42); await start("U5L2"); await gotoCode("U5L2-M1"); const d0 = await stat(); await setCode(TASKS["U5L2-M1"].task.code); await page.locator("[data-check]").tap(); await judged();
  const t52 = await page.locator("[data-results]").innerText();
  check("P3-05 起始代码：显示“IndexError（第 N 行）”和中文“索引错误：取的位置超出了列表的范围”；首次作答答错扣 1 颗心", /IndexError（第 \d+ 行）/.test(t52) && /索引错误：取的位置超出了列表的范围/.test(t52) && (await stat()).hearts === d0.hearts - 1, t52.replace(/\s+/g, " ").slice(0, 160));
  // ---- D：P3-07（U5L5 没有变式）----
  await importCode("D", 42); await start("U5L5"); const e00 = await stat(); await gotoCode("U5L5-W1"); const e0 = await stat();
  await setCode(TASKS["U5L5-W1"].task.reference); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 90000 });
  check("P3-07 没有变式题：答对后直接结算 +10，没有“变化题”界面", (await stat()).xp - e0.xp === 10 && (await page.locator("[data-variation]").count()) === 0);
  await next(); for (let g = 0; g < 6 && !(await page.locator(".finish").count()); g++) { await plain(); await next(); }
  check("P3-07 整关通关 XP 恰好 +50", (await page.locator(".finish").count()) === 1 && (await stat()).xp - e00.xp === 50);

  // ---- P3-08：草稿恢复 / 累计记录 / 刷新不加分 / 重新进入从第 1 题开始（用 C 再来一次 U5L2）----
  await importCode("C", 42); await start("U5L2"); await gotoCode("U5L2-M1"); const half = 'print("第一单", cups[0])  # 写了一半';
  await setCode(half); await page.evaluate(() => window.dispatchEvent(new Event("pagehide"))); await page.waitForTimeout(400);
  const g0 = await stat(); await page.reload({ waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState); const g1 = await stat();
  check("P3-08 刷新页面：累计记录（XP、红心、已完成关卡数）不变，刷新本身不加分", JSON.stringify(g0) === JSON.stringify(g1), JSON.stringify([g0, g1]));
  await start("U5L2"); const first = await cur();
  check("P3-08 重新进入这一关：从第 1 题重新开始（不是回到代码题）", first.type !== "modify" && first.type !== "write", first.type);
  await gotoCode("U5L2-M1"); check("P3-08 走到同一道代码题：写了一半的草稿还在", (await code()) === half, await code());
  check("入口页面没有脚本错误；CSP 没有拦截应用自己的资源", errors.length === 0 && csp.length === 0, JSON.stringify([errors, csp]));
  await ctx.close();

  // ---- 工作流里的“检查产物”片段：命中禁止字样必须真的失败 ----
  const wf = readFileSync(join(ROOT, ".github/workflows/code-task-preview.yml"), "utf8"), line = wf.split("\n").find((l) => l.includes("产物里出现了密钥字样"));
  const sh = (file) => spawnSync("bash", ["-ec", line.trim().replace("dist/assets/main-*.js", file) + "\necho PASSED-ALL"], { encoding: "utf8" });
  const tmp = join(ROOT, "iso-p3", "wf-bad.js"), ok = join(ROOT, "iso-p3", "wf-ok.js");
  writeFileSync(tmp, "var x = 'service_role';"); writeFileSync(ok, "var x = 1;");
  const rb = sh(tmp), ro = sh(ok);
  check("工作流“检查产物”：产物里出现 service_role 时步骤真的失败（退出码非 0，不会走到后面）", !!line && rb.status !== 0 && !rb.stdout.includes("PASSED-ALL"), JSON.stringify([rb.status, rb.stdout]));
  check("工作流“检查产物”：干净产物通过", ro.status === 0 && ro.stdout.includes("PASSED-ALL"));
  check("工作流里不再有会被 set -e 忽略的 `! grep` 写法", !/^\s*!\s*grep/m.test(wf));
} finally { srv?.closeAllConnections?.(); srv?.close(); await browser?.close(); rmSync(OUT, { recursive: true, force: true }); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
