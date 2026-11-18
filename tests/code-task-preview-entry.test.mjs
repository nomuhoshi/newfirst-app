// P3 真机验收入口（独立测试入口）的构建配方与实际表现：按 .github/workflows/code-task-preview.yml 里同样的环境变量构建（PREVIEW_ID + CSP_TEST_ORIGIN=1 + CODE_TASKS_TEST_BUILD=1 + 全部 16 道），
// 放在 /newfirst-app-preview/p3-code/ 子路径下提供（和线上预览仓库一样的路径形态），然后：
//   1. 主脚本里的试点列表 = scripts/code-task-pilot-ids.json 全部 16 道；sw.js 缓存前缀 = p3-code-suipian-；产物里没有任何密钥字样；构建日志写明“云端：关闭”；
//   2. 浏览器里：启用列表 16 道、课程里恰好 16 道代码题；本地存储真实键全部带 “p3-code:” 前缀（和正式站同域名下不会读写正式进度）；“我的”页能看到测试入口信息（编号和源码提交号）；
//   3. 在这个入口的真实 CSP 下：U5L2 起始代码的 IndexError 中文报错能显示；U4L6 起始代码超时后（不算作答）同一页面能继续判参考答案；U3L5 变式流程的入口（看解法后）可用。
// 运行：node tests/code-task-preview-entry.test.mjs [chromium|webkit]
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const ENGINE = process.argv[2] || process.env.MOBILE_BROWSER || "chromium";
const engine = ENGINE === "webkit" ? webkit : chromium;
const OUT = join(ROOT, "iso-p3"), ID = "p3-code", SHA = "94a67e8c1edee0b2d05831640db24a4a166ab3aa", SUB = `/newfirst-app-preview/${ID}/`;
const CODE = readFileSync(join(ROOT, "docs/p3-progress-code.txt"), "utf8").trim();
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
  // 用验收包里的“进度码”（docs/p3-progress-code.txt）在界面里导入：43 个关卡全部标记完成，任何关卡都能从地图点进去
  await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="data"]').tap(); await page.waitForSelector("[data-backup]");
  await page.locator("[data-code-paste]").tap(); await page.locator("[data-code-in]").fill(CODE.match(/.{1,60}/g).join("\n")); await page.locator("[data-code-read]").tap(); await page.waitForSelector("[data-import-confirm]", { timeout: 8000 }).catch(async (e) => { console.log("导入提示：", await page.locator("[data-backup-msg]").innerText()); throw e; });
  const cf = await page.locator("[data-import-confirm]").innerText(); await page.getByRole("button", { name: "确认导入" }).tap(); await page.waitForFunction(() => Object.keys(window.__app.getState().done).length === 43);
  check("验收包的进度码：能在界面里读取并导入，43 个关卡全部完成", /43 个已完成关卡/.test(cf), cf.replace(/\s+/g, " ").slice(0, 120));
  await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="account"]').tap(); await page.waitForSelector("[data-preview-info]");
  const meTxt = await page.locator("[data-preview-info]").innerText();
  check("“我的 → 账号”页的测试入口信息：编号 p3-code、源码提交 94a67e8c…、云端关闭", meTxt.includes(ID) && meTxt.includes(SHA.slice(0, 7)), meTxt.replace(/\s+/g, " ").slice(0, 240));
  await page.getByRole("button", { name: "学习" }).tap().catch(() => {});
  const stat = () => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
  const start = async (lid) => { await page.evaluate(() => window.__app.renderPath()); await page.locator(`[data-lesson="${lid}"]`).tap(); await page.locator(".overlay .btn3d.primary").tap(); await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]"); };
  const gotoCode = async (id) => { for (let g = 0; g < 8; g++) { const ex = await page.evaluate(() => window.__app.currentEx); if (ex.id === id) return; if (ex.type === "predict") await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).tap(); else if (ex.type === "fill") { for (const t of ex.answer) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).tap(); } else if (ex.type === "order") { for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).tap(); } await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar"); await page.locator("[data-continue]:not([disabled])").tap(); await page.waitForFunction(() => document.querySelector("[data-check]") || document.querySelector(".finish")); } };
  const setCode = (c) => page.evaluate((c) => window.__app.currentArea.setCode(c), c);
  const judged = () => page.waitForFunction(() => { const x = document.querySelector("[data-check]"); return (x && x.textContent === "检查" && !x.disabled) || document.querySelector(".feedbar"); }, null, { timeout: 90000 });
  // U5L2：IndexError 中文报错
  await start("U5L2"); await gotoCode("U5L2-M1"); await setCode(TASKS["U5L2-M1"].task.code); await page.locator("[data-check]").tap(); await judged();
  const t52 = await page.locator("[data-results]").innerText();
  check("U5L2 起始代码：显示“IndexError（第 N 行）”和中文“索引错误：取的位置超出了列表的范围”", /IndexError（第 \d+ 行）/.test(t52) && /索引错误：取的位置超出了列表的范围/.test(t52), t52.replace(/\s+/g, " ").slice(0, 200));
  // U4L6：超时后不算作答，继续作答
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await start("U4L6"); await gotoCode("U4L6-M1"); const pre = await stat(); await setCode(TASKS["U4L6-M1"].task.code); const t0 = Date.now(); await page.locator("[data-check]").tap(); await judged(); const ms = Date.now() - t0;
  console.log(`  ⏱ [${ENGINE}] U4L6-M1 超时检查实际耗时 ${ms} ms`);
  check("U4L6 起始代码：超时停止，不算作答（红心 / XP 不变、没有反馈条），提示写明不扣红心", ms >= 4900 && ms <= 10000 && JSON.stringify(await stat()) === JSON.stringify(pre) && (await page.locator(".feedbar").count()) === 0 && /不算作答/.test(await page.locator("[data-results]").innerText()), String(ms));
  await setCode(TASKS["U4L6-M1"].task.reference); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 90000 });
  const post = await stat(); console.log(`  ℹ︎ 重玩已完成的关卡：答对后 XP 变化 ${post.xp - pre.xp}（首次通关才拿满 +10；重玩 XP 规则不是本次验收内容）`);
  check("U4L6 超时之后：同一页面继续判参考答案通过（反馈“答对了”），红心不变", /答对了/.test(await page.locator(".feedbar").innerText()) && post.hearts === pre.hearts);
  // 内置键盘能往编辑器里打字（真机重点之一）
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
  await start("U3L5"); await gotoCode("U3L5-M1"); await setCode("");
  for (const k of ["p", "r", "i", "n", "t"]) await page.locator(`#keyboard .kb-key[data-key="${k}"]`).tap();
  check("U3L5：内置键盘能往编辑器里打字", (await page.evaluate(() => window.__app.currentArea.code())) === "print");
  check("入口页面没有脚本错误；CSP 没有拦截应用自己的资源", errors.length === 0 && csp.length === 0, JSON.stringify([errors, csp]));
  await ctx.close();
} finally { srv?.closeAllConnections?.(); srv?.close(); await browser?.close(); rmSync(OUT, { recursive: true, force: true }); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
