// 进度持久化回归（2026-11-12 诊断：老大实测“Safari 关闭标签重开后丢进度”）。只读诊断用，不清存储、不覆盖旧存档。
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
import { encodeCode } from "../src/progress-file.js";
import { DATA_VERSION } from "../src/storage.js";

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

// ---------- A 通关 → 确认已保存 → 关闭 → 重开 ----------
{
  const dir = newDir();
  let ctx = await open(dir), page = await load(ctx);
  await passOnboarding(page);
  await finishLesson(page, "U1L1", { firstWrong: true }); // 故意错一题：红心 4，重开后要核对
  const atFinish = await saved(page); // 结算页刚出现、还没点“继续”：这时记录必须已经写好
  check("A1 结算页出现时本机记录已写入：U1L1 完成、XP > 0、红心 4", !!atFinish?.done?.U1L1 && atFinish.xp > 0 && atFinish.hearts === 4 && atFinish.lessonsCompleted === 1, JSON.stringify(pick(atFinish)));
  const mem = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.getState())));
  check("A2 本机记录和页面里的状态一致", same(atFinish, mem), JSON.stringify([pick(atFinish), pick(mem)]));
  check("A3 没有“无法保存进度”提示、没有脚本错误", !/无法保存进度/.test(await page.locator("body").innerText()) && page.errors.length === 0, page.errors.join("; "));
  await ctx.close(); // 不点结算页的“继续”，直接关掉浏览器（最不利的情况）
  ctx = await open(dir); page = await load(ctx);
  const after = await saved(page), mem2 = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.getState())));
  check("A4 关闭后重开：存储里的关卡 / XP / 红心 / 连续天数 / 完成日期都没变", same(atFinish, after), JSON.stringify([pick(atFinish), pick(after)]));
  check("A5 重开后页面读到的就是这份进度", same(atFinish, mem2), JSON.stringify(pick(mem2)));
  check("A6 重开后直接进地图（不再出开场介绍），U1L1 显示已完成、U1L2 已解锁", (await page.locator(".pathview").count()) === 1 && (await page.locator('[data-lesson="U1L1"].done').count()) === 1 && (await page.locator('[data-lesson="U1L2"].locked').count()) === 0);
  check("A7 重开后没有任何“已从头开始 / 无法识别 / 损坏”提示，没有产生备份记录", !/从头开始|无法识别|损坏/.test(await page.locator("body").innerText()) && (await stashCount(page)) === 0);
  // 再通一关，再关再开（第二轮，确认不是只有第一次能存）
  await finishLesson(page, "U1L2"); const s2 = await saved(page); await ctx.close();
  ctx = await open(dir); page = await load(ctx);
  check("A8 第二关通关后再关闭重开：两关都在，XP 累加", same(s2, await saved(page)) && !!s2.done.U1L2 && s2.xp > atFinish.xp, JSON.stringify(pick(await saved(page))));
  await ctx.close();
}

// ---------- B 旧版本存档升级 ----------
{
  const NOW = Date.now();
  const FIX = {
    "a1ecfd7（11-03 正式版，没有 doneOn）": { version: 3, onboarded: true, xp: 130, hearts: 3, heartsAt: NOW - 60_000, streak: 2, lastDay: "2026-11-10", done: { U1L1: true, U1L2: true, U1L3: true }, lessonsCompleted: 4, installTipClosed: false, lastActive: NOW - 60_000, prefs: { sound: true, haptics: false, soundStyle: "C" } },
    "更早的 v3（没有 prefs）": { version: 3, onboarded: true, xp: 50, hearts: 5, heartsAt: NOW - 60_000, streak: 1, lastDay: "2026-11-02", done: { U1L1: true }, lessonsCompleted: 1, installTipClosed: true, lastActive: NOW - 60_000 },
    "cfb368a / fcac0a5（11-11 正式版，有 doneOn）": { version: 3, onboarded: true, xp: 260, hearts: 4, heartsAt: NOW - 60_000, streak: 3, lastDay: "2026-11-11", done: { U1L1: true, U1L2: true, U1L3: true, U1L4: true }, doneOn: { U1L1: "2026-11-09", U1L2: "2026-11-10", U1L3: "2026-11-11", U1L4: "2026-11-11" }, lessonsCompleted: 5, installTipClosed: false, lastActive: NOW - 60_000, prefs: { sound: false, haptics: true, soundStyle: "J" } },
  };
  for (const [name, rec] of Object.entries(FIX)) {
    const dir = newDir(); let ctx = await open(dir);
    const seedPage = await ctx.newPage(); await seedPage.goto(BASE + "robots.txt"); // 同源、不加载应用：只把旧存档原文放进存储
    await seedPage.evaluate(([k, v]) => localStorage.setItem(k, v), [RAWKEY, JSON.stringify(rec)]); await seedPage.close();
    let page = await load(ctx);
    const mem = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.getState())));
    check(`B ${name}：打开后关卡 / XP / 红心 / 连续天数原样保留`, same({ ...rec, doneOn: rec.doneOn || {} }, mem), JSON.stringify(pick(mem)));
    check(`B ${name}：没有“已从头开始”一类提示，没有备份记录，直接进地图`, !/从头开始|无法识别|损坏|不再使用/.test(await page.locator("body").innerText()) && (await stashCount(page)) === 0 && (await page.locator(".pathview").count()) === 1);
    check(`B ${name}：打开这一下不改写存储里的学习内容`, same({ ...rec, doneOn: rec.doneOn || {} }, { doneOn: {}, ...(await saved(page)) }), await rawOf(page));
    const nextId = await page.evaluate(() => window.__app.allLessons().find((l) => !window.__app.getState().done[l.id]).id); // 第一个还没完成的关卡
    await finishLesson(page, nextId); const s = await saved(page); await ctx.close();
    ctx = await open(dir); page = await load(ctx);
    const again = await saved(page);
    check(`B ${name}：在旧存档上再通一关 → 关闭重开，旧关卡和新关卡都在，XP 只增不减`, same(s, again) && Object.keys(rec.done).every((k) => again.done[k]) && again.xp > rec.xp, JSON.stringify(pick(again)));
    await ctx.close();
  }
}

// ---------- C 旧标签页不能覆盖新进度 ----------
{
  const dir = newDir(); const ctx = await open(dir);
  const tab1 = await load(ctx); await passOnboarding(tab1); // 标签页 1：停在地图，内存里是“还没通关”的状态
  const tab2 = await load(ctx); await tab2.waitForSelector(".pathview");
  await finishLesson(tab2, "U1L1"); const want = await saved(tab2);
  check("C0 标签页 2 通关后记录已写入", !!want?.done?.U1L1 && want.xp > 0, JSON.stringify(pick(want)));
  await tab2.close();
  // 标签页 1 回到前台（iPhone 上：关掉当前标签后点回旧标签、从后台切回 Safari）
  await tab1.bringToFront(); await tab1.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); await tab1.waitForTimeout(300);
  const afterVisible = await saved(tab1);
  check("C1 旧标签页回到前台后：本机记录仍是通关后的进度（没有被旧状态覆盖）", same(want, afterVisible), JSON.stringify({ want: pick(want), got: pick(afterVisible) }));
  check("C2 旧标签页回到前台后：页面显示的也是新进度（U1L1 已完成）", (await tab1.locator('[data-lesson="U1L1"].done').count()) === 1);
  // 旧标签页继续操作（切换音效开关也会整份保存）
  await tab1.getByRole("button", { name: "我的" }).click(); await tab1.waitForTimeout(200);
  await tab1.locator('[data-pref="sound"]').scrollIntoViewIfNeeded(); await tab1.locator('[data-pref="sound"]').click(); await tab1.waitForTimeout(200);
  const afterPref = await saved(tab1);
  check("C3 旧标签页里改一个设置后：通关进度仍在", !!afterPref?.done?.U1L1 && afterPref.xp >= want.xp, JSON.stringify(pick(afterPref)));
  const fresh = await load(ctx);
  check("C4 再开一个新标签页：看到的是通关后的进度", !!(await fresh.evaluate(() => window.__app.getState().done.U1L1)));
  await ctx.close();
}

// ---------- D 做到一半关闭 ----------
{
  const dir = newDir(); let ctx = await open(dir), page = await load(ctx); await passOnboarding(page);
  await startLesson(page, "U1L1"); await answer(page, true); await next(page); await answer(page, false);
  const mid = await saved(page); await ctx.close();
  ctx = await open(dir); page = await load(ctx);
  const after = await saved(page);
  check("D1 做到一半关闭重开：已得的 XP、已扣的红心都在", same(mid, after) && after.xp === 10 && after.hearts === 4, JSON.stringify(pick(after)));
  check("D2 （现状）这一关没到结算页，不算完成", !after.done.U1L1);
  await ctx.close();
}

// ---------- E Service Worker 安装 / 接管不动本机记录 ----------
{
  const dir = newDir(); let ctx = await open(dir, { serviceWorkers: "allow" }), page = await load(ctx); await passOnboarding(page);
  await finishLesson(page, "U1L1"); const before = await rawOf(page);
  const swOk = await page.evaluate(() => navigator.serviceWorker ? Promise.race([navigator.serviceWorker.ready.then(() => true), new Promise((r) => setTimeout(() => r(false), 15000))]) : false);
  await page.reload(); await page.waitForFunction(() => window.__app?.getState); await page.waitForTimeout(500);
  const mid = await saved(page);
  check(`E1 Service Worker ${swOk ? "安装并接管后" : "（这个内核没装上，只验刷新）"}刷新：进度不变`, same(JSON.parse(before), mid), JSON.stringify(pick(mid)));
  await ctx.close(); ctx = await open(dir, { serviceWorkers: "allow" }); page = await load(ctx);
  check("E2 带着 Service Worker 关闭重开：进度不变", same(JSON.parse(before), await saved(page)));
  await ctx.close();
}

// ---------- F 真实通关后导入进度码：逐关首次完成日期取较早（doneOn） ----------
{
  const dir = newDir(); const ctx = await open(dir), page = await load(ctx); await passOnboarding(page);
  await finishLesson(page, "U1L1");
  const st0 = await page.evaluate(() => { const x = window.__app.getState(); return { xp: x.xp, runs: x.lessonsCompleted, d: x.doneOn?.U1L1, last: x.lastDay, hearts: x.hearts, prefs: x.prefs }; });
  check("F1 真实通关后 doneOn.U1L1 恰好等于当天学习日（lastDay）", /^\d{4}-\d{2}-\d{2}$/.test(st0.d || "") && st0.d === st0.last, JSON.stringify(st0));
  const mk = (day, xp) => encodeCode({ version: DATA_VERSION, xp, lessonsCompleted: 1, streak: 1, lastDay: day, done: { U1L1: true }, doneOn: { U1L1: day } });
  await page.reload(); await page.waitForFunction(() => window.__app?.getState); await page.waitForSelector(".pathview"); // 结算页没有底部导航，回到地图
  const paste = async (code) => {
    await page.getByRole("button", { name: "我的", exact: true }).click(); await page.waitForSelector("[data-backup]");
    await page.locator("[data-code-paste]").click(); await page.locator("[data-code-in]").fill(code); await page.locator("[data-code-read]").click();
    await page.waitForSelector("[data-import-confirm]"); await page.getByRole("button", { name: "确认导入" }).click(); await page.waitForTimeout(300);
    return page.evaluate(() => { const x = window.__app.getState(); return { xp: x.xp, runs: x.lessonsCompleted, d: x.doneOn?.U1L1, hearts: x.hearts, prefs: x.prefs, done: Object.keys(x.done) }; });
  };
  const a = await paste(mk("2020-01-01", 5));
  check("F2 导入更早日期的旧码：同一关取较早日期；XP、次数、红心、偏好不变", a.d === "2020-01-01" && a.xp === st0.xp && a.runs === st0.runs && a.hearts === st0.hearts && JSON.stringify(a.prefs) === JSON.stringify(st0.prefs), JSON.stringify(a));
  const b = await paste(mk("2099-12-31", 99999));
  check("F3 再导入更晚日期的码：日期仍是较早的（XP 取较大属于既定规则）", b.d === "2020-01-01" && b.done.join() === "U1L1", JSON.stringify(b));
  await page.reload(); await page.waitForFunction(() => window.__app?.getState);
  const c = await page.evaluate(() => window.__app.getState().doneOn?.U1L1);
  check("F4 刷新重开后日期仍是较早的", c === "2020-01-01", String(c));
  await ctx.close();
}

// ---------- G 真实学习：首次有效进度保存成功才建立 14 天起点；保存失败不建立 ----------
{
  const dir = newDir(); const ctx = await open(dir), page = await load(ctx); await passOnboarding(page);
  const b0 = await page.evaluate(() => localStorage.getItem("suipian.meta.backupBase"));
  check("G1 还没有学习进度：没有 14 天起点", b0 === null, String(b0));
  await finishLesson(page, "U1L1");
  const b1 = Number(await page.evaluate(() => localStorage.getItem("suipian.meta.backupBase")));
  check("G2 真实通关并保存成功后：建立起点（约等于现在）", Math.abs(b1 - Date.now()) < 5 * 60 * 1000, String(b1));
  await ctx.close();
  const dir2 = newDir(); const ctx2 = await open(dir2);
  await ctx2.addInitScript(() => { const real = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).includes("suipian.v4.tab.")) throw new DOMException("full", "QuotaExceededError"); return real.call(this, k, v); }; });
  const page2 = await load(ctx2); await passOnboarding(page2);
  await finishLesson(page2, "U1L1");
  const b2 = await page2.evaluate(() => localStorage.getItem("suipian.meta.backupBase"));
  check("G3 保存一直失败（账本写不进去）：通关了也不建立起点", b2 === null, String(b2));
  await ctx2.close();
}

// ---------- H 无变化不新增账本：真实通关后反复刷新 / 切前台，账本键数不增；真实学习才增加且进度完整 ----------
{
  const tabKeys = (pg) => pg.evaluate(() => { const a = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i) || ""; if (k.startsWith("suipian.v4.tab.")) a.push(k); } return a.length; });
  const dir = newDir(); const ctx = await open(dir); let page = await load(ctx); await passOnboarding(page);
  await finishLesson(page, "U1L1"); const want = await saved(page);
  page = await load(ctx); await page.waitForSelector(".pathview"); const k1 = await tabKeys(page);
  for (let i = 0; i < 4; i++) { await page.reload(); await page.waitForFunction(() => window.__app?.getState); await page.waitForSelector(".pathview"); await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange"))); }
  const k2 = await tabKeys(page);
  check("H1 通关后反复刷新 4 次并触发回前台：账本键数不增加", k2 === k1, `${k1} → ${k2}`);
  const now = await saved(page);
  check("H2 无变化期间进度完整（XP、关卡、次数不变）", now && now.xp === want.xp && now.lessonsCompleted === want.lessonsCompleted && !!now.done?.U1L1, JSON.stringify(now));
  await finishLesson(page, "U1L2"); const k3 = await tabKeys(page); const s3 = await saved(page);
  check("H3 真实学习仍正常保存（新关卡、XP 增加）", !!s3?.done?.U1L2 && s3.xp > want.xp && k3 >= k2, `keys ${k2}→${k3} xp ${want.xp}→${s3?.xp}`);
  await ctx.close();
}

srv.close(); for (const d of dirs) { try { rmSync(d, { recursive: true, force: true }); } catch { /* 临时目录，删不掉不影响结果 */ } }
console.log(`\n${BNAME}：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
