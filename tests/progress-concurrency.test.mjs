// （并发测试由 progress-persistence 的文件头改造）进度持久化回归（2026-11-12 诊断：老大实测“Safari 关闭标签重开后丢进度”）。只读诊断用，不清存储、不覆盖旧存档。
// A 真实点击通关 U1L1 → 确认本机记录已写入 → 关闭整个浏览器上下文（同一个用户数据目录）→ 重新打开 → 核对关卡、XP、红心、连续天数、地图状态；
// B 旧版本存档原文（a1ecfd7 = 11-03 正式版；cfb368a / fcac0a5 = 11-11 正式版）放进存储后用当前构建打开：进度原样保留、没有“已从头开始”提示、没有被空记录覆盖；
// C 旧标签页不能覆盖新进度：标签页 1 停在地图（内存里是旧状态）→ 标签页 2 通关并关闭 → 标签页 1 回到前台 / 继续操作 → 本机记录仍是通关后的进度，且标签页 1 显示的是新进度；
// D 做到一半关闭：已得的 XP、已扣的红心都在；这一关不算完成（现状如此，记录在案）；
// E Service Worker 安装 / 接管前后，本机记录逐字不变。
// 运行：npm run build && MOBILE_BROWSER=chromium|webkit node tests/progress-persistence.test.mjs
// 验已发布的预览产物：DIST_DIR=<目录> PREVIEW_PREFIX=/newfirst-app-preview/d6/ PREVIEW_ID=d6 node tests/progress-persistence.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";

const ROOT = fileURLToPath(new URL("..", import.meta.url)), DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/";
const PID = process.env.PREVIEW_ID ?? (PFX !== "/" ? PFX.split("/").filter(Boolean).pop() : ""); // 测试入口的存储键前缀（正式构建为空）
const RAWKEY = (PID ? PID + ":" : "") + "suipian.progress";
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const engine = BNAME === "webkit" ? webkit : chromium;
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} [${BNAME}] ${n}${ok || !d ? "" : "  — " + d}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".zip": "application/zip", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json", ".txt": "text/plain" };
const srv = createServer((q, s) => { const u = new URL(q.url, "http://localhost"); if (!u.pathname.startsWith(PFX)) { s.writeHead(404); s.end(); return; } let p = join(DIST, decodeURIComponent(u.pathname.slice(PFX.length))); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(0, r));
const BASE = `http://localhost:${srv.address().port}${PFX}`;
const dirs = [];
const newDir = () => { const d = mkdtempSync(join(tmpdir(), "suipian-persist-")); dirs.push(d); return d; };
const OPTS = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === chromium };
// 同一个用户数据目录 = 同一个浏览器的本机存储；关掉再开，等于用户关闭浏览器 / 标签页后重新打开
async function open(dir, extra = {}) {
  let ctx;
  try { ctx = await engine.launchPersistentContext(dir, { ...OPTS, serviceWorkers: "block", ...extra }); }
  catch (e) { console.log(`环境失败：${BNAME} 起不来：${String(e.message).split("\n")[0]}`); srv.close(); process.exit(2); }
  ctx.setDefaultTimeout(30000);
  return ctx;
}
async function load(ctx, { wait = true } = {}) {
  const page = await ctx.newPage(); page.errors = []; page.on("pageerror", (e) => page.errors.push(e.message));
  await page.goto(BASE); if (wait) await page.waitForFunction(() => window.__app?.getState);
  return page;
}
const rawOf = (page) => page.evaluate(() => localStorage.getItem("suipian.progress")); // 测试入口里 localStorage 已带前缀
const saved = async (page) => JSON.parse((await rawOf(page)) || "null");
const stashCount = (page) => page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) if ((localStorage.key(i) || "").startsWith("suipian.progress.unreadable.")) n++; return n; });
async function passOnboarding(page) {
  for (let i = 0; i < 6 && (await page.locator(".onboard").count()); i++) { await page.locator(".onboard .btn3d.primary").click(); await page.waitForTimeout(120); }
  await page.waitForSelector(".pathview");
}
async function startLesson(page, id) {
  await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded(); await page.locator(`[data-lesson="${id}"]`).click();
  await page.locator(".overlay .btn3d.primary").click(); await page.locator(".lessonfoot .btn3d.primary").click(); await page.waitForSelector("[data-check]");
}
async function answer(page, right = true) {
  const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
  if (ex.type === "predict" || ex.type === "pick") await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct === right)).click();
  else if (ex.type === "fill") { const toks = right ? ex.answer : ex.answer.map((a, i) => (i === 0 ? ex.tokens.find((t) => !ex.answer.includes(t)) || a : a)); for (const t of toks) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click(); }
  else { const seq = right ? ex.answers[0] : [...ex.answers[0]].reverse(); for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).click(); }
  await page.locator("[data-check]").click(); await page.waitForSelector(".feedbar [data-continue]:not([disabled])");
}
const next = async (page) => { await page.locator(".feedbar [data-continue]").click(); await page.waitForTimeout(200); };
async function finishLesson(page, id, { firstWrong = false } = {}) {
  await startLesson(page, id);
  for (let n = 0; n < 20 && !(await page.locator(".finish").count()); n++) { await answer(page, !(firstWrong && n === 0)); await next(page); }
  await page.waitForSelector(".finish");
}
const pick = (s) => s && { done: Object.keys(s.done || {}).sort().join(","), xp: s.xp, hearts: s.hearts, streak: s.streak, lastDay: s.lastDay, lessonsCompleted: s.lessonsCompleted, onboarded: s.onboarded, doneOn: JSON.stringify(s.doneOn || {}) };
const same = (a, b) => JSON.stringify(pick(a)) === JSON.stringify(pick(b));


// 存储 v4 里没有单一的“进度键”：用任意一个页面合并后的内存记录（先读一遍存储）作为“新打开的页面看到的进度”
const merged = (page) => page.evaluate(() => { window.__app.syncFromStorage(); const s = window.__app.getState(); return { done: s.done, xp: s.xp, lessonsCompleted: s.lessonsCompleted, hearts: s.hearts, streak: s.streak, lastDay: s.lastDay, onboarded: s.onboarded, doneOn: s.doneOn }; });
const savedMerged = merged;

// ---------- 通关 → 保存 → 关闭浏览器 → 重开：关卡、XP、红心、连续天数都在 ----------
{
  const dir = newDir(); let ctx = await open(dir); let p = await load(ctx);
  await passOnboarding(p); await finishLesson(p, "U1L1", { firstWrong: true });
  const before = pick(await merged(p));
  check("通关后内存记录：1 关、XP > 0", before.done === "U1L1" && before.xp > 0, JSON.stringify(before));
  await ctx.close(); ctx = await open(dir); p = await load(ctx);
  const after = pick(await merged(p));
  check("关闭重开：关卡、XP、红心、连续天数、完成次数都在", JSON.stringify(after) === JSON.stringify(before), JSON.stringify([before, after]));
  check("重开后没有再出现开场介绍", (await p.locator(".onboard").count()) === 0 && (await p.locator(".pathview").count()) === 1);
  await p.reload(); await p.waitForFunction(() => window.__app?.getState);
  check("再刷新一次仍一致（刷新不重复计分）", JSON.stringify(pick(await merged(p))) === JSON.stringify(before));
  await ctx.close();
}
// ---------- 旧版本存档（v3 单键）升级：原样保留，旧键不被改动，重复打开不加分 ----------
{
  const dir = newDir(); const legacy = JSON.stringify({ version: 3, onboarded: true, xp: 130, hearts: 4, heartsAt: Date.now(), streak: 3, lastDay: "2026-11-10", done: { U1L1: true, U1L2: true }, doneOn: {}, lessonsCompleted: 5, installTipClosed: false, lastActive: 1, prefs: { sound: true, haptics: true, soundStyle: "J" } });
  let ctx = await open(dir); await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k) && !Object.keys(localStorage).some((x) => x.includes("suipian.v4."))) localStorage.setItem(k, v); }, [RAWKEY, legacy]);
  let p = await load(ctx); const a = await merged(p);
  check("旧存档升级：XP 130、2 关、次数 5、连续 3、红心 4", a.xp === 130 && Object.keys(a.done).length === 2 && a.lessonsCompleted === 5 && a.streak === 3 && a.hearts === 4, JSON.stringify(a));
  check("旧存档升级：没有出现开场介绍，没有“已从头开始”提示", (await p.locator(".onboard").count()) === 0 && !(await p.locator(".toast").count()));
  check("旧键原样保留（迁移只读）", (await p.evaluate((k) => localStorage.getItem(k), RAWKEY)) === legacy);
  await ctx.close(); ctx = await open(dir); p = await load(ctx); await p.reload(); await p.waitForFunction(() => window.__app?.getState);
  const b = await merged(p); check("关闭重开 + 刷新后仍是 130 / 5，不重复加分", b.xp === 130 && b.lessonsCompleted === 5, JSON.stringify(b));
  // 第二类升级：已经有 v4 之后（更新 / 刷新），旧代码页面后来写旧键，不能覆盖 v4 存档，也不会被自动迁入
  await p.evaluate((k) => localStorage.setItem(k, JSON.stringify({ version: 3, onboarded: true, xp: 9999, hearts: 1, heartsAt: 1, streak: 9, lastDay: "2026-11-11", done: { U1L9: true }, doneOn: {}, lessonsCompleted: 77, installTipClosed: false, lastActive: 5, prefs: { sound: true, haptics: true, soundStyle: "J" } })), RAWKEY);
  await p.reload(); await p.waitForFunction(() => window.__app?.getState);
  const c = await merged(p); check("已有 v4 后旧键被旧代码改写：v4 存档不变（130 / 5 / 2 关），旧键内容不被迁入", c.xp === 130 && c.lessonsCompleted === 5 && Object.keys(c.done).length === 2 && !c.done.U1L9, JSON.stringify(c));
  await p.evaluate(() => { window.__app.persist(); }); await p.reload(); await p.waitForFunction(() => window.__app?.getState);
  const d2 = await merged(p); check("之后保存、再刷新，仍不受旧键影响", d2.xp === 130 && d2.lessonsCompleted === 5, JSON.stringify(d2));
  await ctx.close();
}
// ---------- 通过真实页面按钮清除（生产清除路径）：旧页面、刷新、关闭重开都不复活 ----------
{
  const dir = newDir(); let ctx = await open(dir); const p1 = await load(ctx); await passOnboarding(p1); await finishLesson(p1, "U1L1");
  await p1.locator(".finish .btn3d.primary").click().catch(() => {}); // 回到地图（按钮文字不同则忽略）
  const p2 = await load(ctx); const before = await merged(p2);
  check("清除前：第二个页面看到 U1L1 已完成", before.done.U1L1 === true && before.xp > 0, JSON.stringify(before));
  await p2.getByRole("button", { name: "我的" }).click(); await p2.getByRole("button", { name: "清除学习记录" }).click(); await p2.getByRole("button", { name: "确定清除" }).click();
  await p2.waitForFunction(() => Object.keys(window.__app.getState().done).length === 0);
  const afterClear = await merged(p2); check("真实按钮清除后：本页进度为空", afterClear.xp === 0 && Object.keys(afterClear.done).length === 0, JSON.stringify(afterClear));
  // 旧页面（p1 内存里还是清除前的进度）：保存 / 回前台 / 再合并，都不复活
  await p1.evaluate(() => { window.__app.persist(); window.__app.syncFromStorage(); });
  const old1 = await merged(p1); check("旧页面保存 / 回前台后：仍是清除后的空记录（不复活）", old1.xp === 0 && Object.keys(old1.done).length === 0, JSON.stringify(old1));
  await p1.reload(); await p1.waitForFunction(() => window.__app?.getState);
  const r1 = await merged(p1); check("旧页面刷新后：仍为空", r1.xp === 0 && Object.keys(r1.done).length === 0, JSON.stringify(r1));
  await ctx.close(); ctx = await open(dir); const p3 = await load(ctx);
  const r3 = await merged(p3); check("关闭浏览器重开后：仍为空，没有回到开场介绍", r3.xp === 0 && Object.keys(r3.done).length === 0 && (await p3.locator(".onboard").count()) === 0, JSON.stringify(r3));
  await ctx.close();
}

// ---------- 真实并发：同一浏览器存储下的两个页面，同时在各自的渲染进程里循环写入 ----------
const S = (page, fn, arg) => page.evaluate(fn, arg);
const lessonsOf = (pre, n) => Array.from({ length: n }, (_, i) => `${pre}${i + 1}`);
// 页面内循环：每个关卡 = 加首次通关奖励 60、完成次数 +1、标记完成、保存；偶尔 syncFromStorage（相当于回前台 / storage 事件）
const work = (ids) => (ids) => { const a = window.__app, s = a.getState(); for (const id of ids) { a.addXp(60, id, true); s.done[id] = true; a.addRun(); a.persist(); if (Math.random() < 0.3) a.syncFromStorage(); } return ids.length; };
async function settle(...pages) { for (let r = 0; r < 3; r++) for (const p of pages) { await S(p, () => { window.__app.syncFromStorage(); window.__app.persist(); }); } }
for (const round of [1, 2, 3]) {
  const dir = newDir(); const ctx = await open(dir);
  const p1 = await load(ctx), p2 = await load(ctx);
  await passOnboarding(p1); await S(p2, () => window.__app.syncFromStorage());
  const only1 = lessonsOf("X", 25), only2 = lessonsOf("Y", 25), shared = lessonsOf("Z", 10);
  await Promise.all([S(p1, work(), [...only1, ...shared]), S(p2, work(), [...only2, ...shared.slice().reverse()])]);
  await settle(p1, p2);
  const st = await merged(p1), n = only1.length + only2.length + shared.length;
  check(`并发${round}：同时完成不同关卡 + 同一关，关卡不丢（${n} 关）`, Object.keys(st.done).length === n, `实际 ${Object.keys(st.done).length}`);
  check(`并发${round}：XP = 每关只算一次首次奖励（${n * 60}）`, st.xp === n * 60, `实际 ${st.xp}`);
  check(`并发${round}：完成次数 = 实际完成次数（${n + shared.length}，同一关两个页面各完成一次）`, st.lessonsCompleted === n + shared.length, `实际 ${st.lessonsCompleted}`);
  const s1 = await S(p1, () => { const s = window.__app.getState(); return [s.xp, Object.keys(s.done).length]; }), s2 = await S(p2, () => { const s = window.__app.getState(); return [s.xp, Object.keys(s.done).length]; });
  check(`并发${round}：两个页面内存里的进度和存储一致`, s1[0] === st.xp && s2[0] === st.xp && s1[1] === n && s2[1] === n, JSON.stringify([s1, s2, st.xp]));
  await ctx.close();
}
// ---------- 保存与清除交错 ----------
{
  const dir = newDir(); const ctx = await open(dir);
  const p1 = await load(ctx), p2 = await load(ctx);
  await passOnboarding(p1);
  await S(p2, () => window.__app.syncFromStorage());
  const old = lessonsOf("O", 20);
  await S(p1, work(), old); await S(p2, () => window.__app.syncFromStorage());
  // p1 内存里还留着旧关卡 O1–O20（上面已做完）；p1 继续做新关卡 P 并保存，同时 p2 清除。O 只存在于 p1 的旧内存里，所以无论清除落在哪一刻，O 都不应该复活（以前循环里又重做一遍 O，清除先落地时这些 O 是清除之后的真实新进度，结果取决于时机）
  const [, ] = await Promise.all([S(p1, work(), lessonsOf("P", 20)), S(p2, () => window.__app.clearProgress())]);
  await settle(p1, p2);
  const st = await merged(p1);
  check("清除交错：清除之前的旧关卡（O 系列）没有复活", !Object.keys(st.done).some((k) => k.startsWith("O")), Object.keys(st.done).join(","));
  const a = await S(p1, () => { const s = window.__app.getState(); return [s.xp, Object.keys(s.done).length]; }), b = await S(p2, () => { const s = window.__app.getState(); return [s.xp, Object.keys(s.done).length]; });
  check("清除交错：两个页面和存储最终一致", a[0] === st.xp && b[0] === st.xp && a[1] === Object.keys(st.done).length && b[1] === a[1], JSON.stringify([a, b, st.xp]));
  // 清除后，旧页面再做题、刷新，不复活
  await S(p1, work(), ["Q1", "Q2"]); await settle(p1, p2);
  await p1.reload(); await p1.waitForFunction(() => window.__app?.getState);
  const after = await merged(p1);
  check("清除后再做题、刷新：只有清除后做的关卡，没有 O 系列", !Object.keys(after.done).some((k) => k.startsWith("O")) && after.done.Q1 && after.done.Q2, Object.keys(after.done).join(","));
  await ctx.close();
}
for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch {} }
srv.close();
console.log(`\n${BNAME}：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
