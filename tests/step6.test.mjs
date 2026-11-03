// 随机练习（SPEC §0.3）：题池只含已通关关卡、单元/关卡多选、每轮 5/10/20 题和题池不够的情况、
// 以及一整轮（含答错和重练）前后主线学习数据（XP、红心、连续天数、解锁/完成记录）完全不变。
// 前半部分直接测纯函数（src/practice.js），后半部分用 dist/ 的真实构建产物在桌面 Chromium 里模拟手机。
// 运行：npm run build && node tests/step6.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { ROUND_SIZES, DEFAULT_ROUND, clearedScope, buildPool, drawRound, shuffleExercise, exerciseId } from "../src/practice.js";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const DIST = join(ROOT, "dist");
const course = JSON.parse(readFileSync(join(ROOT, "content/course.json"), "utf8"));
const UNITS = { U1: JSON.parse(readFileSync(join(ROOT, "content/unit1.json"), "utf8")), U2: JSON.parse(readFileSync(join(ROOT, "content/unit2.json"), "utf8")) };
const units = course.units.filter((u) => u.available).map((u) => ({ id: u.id, title: u.title, lessons: UNITS[u.id].lessons }));
const lessonsOf = (uid) => UNITS[uid].lessons.map((l) => l.id);
const countOf = (ids) => ids.reduce((n, id) => n + units.flatMap((u) => u.lessons).find((l) => l.id === id).exercises.length, 0);
const doneMap = (ids) => Object.fromEntries(ids.map((k) => [k, true]));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}
// 可重复的伪随机数
const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };

// ================= 纯函数 =================
{
  check("每轮题数选项是 5 / 10 / 20，默认 10", JSON.stringify(ROUND_SIZES) === "[5,10,20]" && DEFAULT_ROUND === 10);
  check("未通关：没有可选范围，题池为空", clearedScope(units, {}).length === 0 && buildPool(units, {}, lessonsOf("U1")).length === 0);

  const one = buildPool(units, doneMap(["U1L1"]), [...lessonsOf("U1"), ...lessonsOf("U2")]);
  check("只通关一关：即使选中全部关卡，题池也只有 U1L1 的题", one.length === countOf(["U1L1"]) && one.every((p) => p.lessonId === "U1L1"), `${one.length}`);
  const sc1 = clearedScope(units, doneMap(["U1L1"]));
  check("只通关一关：可选范围只有第 1 单元的 U1L1", sc1.length === 1 && sc1[0].lessons.length === 1 && sc1[0].lessons[0].id === "U1L1");

  const cross = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1", "U2L2"];
  const scX = clearedScope(units, doneMap(cross));
  check("跨单元通关：范围包含两个单元，U2 只列已通关的 2 关", scX.length === 2 && scX[1].lessons.map((l) => l.id).join() === "U2L1,U2L2");
  const poolAll = buildPool(units, doneMap(cross), [...lessonsOf("U1"), ...lessonsOf("U2")]);
  check("跨单元通关：全选时题池 = 已通关 8 关的全部题，没有未通关关卡的题", poolAll.length === countOf(cross) && poolAll.every((p) => cross.includes(p.lessonId)), `${poolAll.length}`);
  check("未通关的关卡标记为 false 或缺失都不进题池", buildPool(units, { U1L1: true, U1L2: false }, ["U1L1", "U1L2"]).every((p) => p.lessonId === "U1L1"));

  const multi = buildPool(units, doneMap(cross), ["U1L2", "U2L1"]);
  check("关卡多选：只选 U1L2 + U2L1 时题池只含这两关", multi.length === countOf(["U1L2", "U2L1"]) && new Set(multi.map((p) => p.lessonId)).size === 2 && multi.every((p) => ["U1L2", "U2L1"].includes(p.lessonId)));
  const unitOnly = buildPool(units, doneMap(cross), lessonsOf("U2"));
  check("单元选择：选第 2 单元 = 其中所有已通关关卡（U2L1、U2L2）", unitOnly.length === countOf(["U2L1", "U2L2"]));
  check("取消全部：空范围题池为空", buildPool(units, doneMap(cross), []).length === 0);

  const ids = poolAll.map((p) => p.id);
  check("每道题有稳定唯一 ID（关卡#题号）", new Set(ids).size === ids.length && ids.includes(exerciseId("U1L1", 0)) && ids[0] === "U1L1#0");

  for (const n of [5, 10, 20]) {
    const r = drawRound(poolAll, n, seeded(n));
    check(`每轮 ${n} 题：题池够时正好 ${n} 题，不重复`, r.actual === n && r.items.length === n && !r.short && new Set(r.items.map((x) => x.id)).size === n);
  }
  const small = buildPool(units, doneMap(["U1L1"]), ["U1L1"]);
  for (const n of [5, 10, 20]) {
    const r = drawRound(small, n, seeded(7));
    check(`题池不够：只有 ${small.length} 题时选 ${n} 题，用全部 ${small.length} 题并标记不够`, r.actual === small.length && r.items.length === small.length && r.short === (n > small.length) && r.requested === n && new Set(r.items.map((x) => x.id)).size === small.length);
  }
  check("题池里重复的 ID 也只抽一次", drawRound([...small, ...small], 20).actual === small.length);

  // 打乱后判分和解释跟着选项走
  let okShuffle = true;
  for (const p of poolAll) {
    const s = shuffleExercise(p.ex, seeded(3));
    if (s.type === "predict") {
      const c0 = p.ex.options.find((o) => o.correct); const c1 = s.options.find((o) => o.correct);
      if (c0.text !== c1.text || c0.why !== c1.why || s.options.length !== p.ex.options.length) okShuffle = false;
      for (const o of s.options) { const o0 = p.ex.options.find((x) => x.text === o.text); if (!o0 || o0.why !== o.why || !!o0.correct !== !!o.correct) okShuffle = false; }
    } else if (s.type === "fill") {
      if (JSON.stringify(s.answer) !== JSON.stringify(p.ex.answer) || [...s.tokens].sort().join() !== [...p.ex.tokens].sort().join()) okShuffle = false;
    } else if (JSON.stringify(s.answers) !== JSON.stringify(p.ex.answers) || [...s.shuffled].sort().join() !== [...p.ex.shuffled].sort().join()) okShuffle = false;
  }
  check("打乱题序和选项：正确答案、解释跟着对应选项；填空答案、排序判分规则不变", okShuffle);
  check("打乱不修改原课程数据", (() => { const ex = units[0].lessons[0].exercises[0]; const before = JSON.stringify(ex); shuffleExercise(ex); return JSON.stringify(ex) === before; })());
}

// ================= 真实页面 =================
const PORT = 4335;
const BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".wav": "audio/wav", ".zip": "application/zip", ".txt": "text/plain" };
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const browser = await chromium.launch();
const KEY = "suipian.progress";

async function openPage(seedState, viewport = { width: 390, height: 844 }) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  if (seedState) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem(k, v); sessionStorage.setItem("seeded", "1"); } }, [KEY, JSON.stringify(seedState)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE);
  await page.waitForSelector(".pathview, .onboard");
  return { ctx, page, errors };
}
const baseState = (done, extra = {}) => ({
  version: 3, onboarded: true, xp: 130, hearts: 3, heartsAt: Date.now() - 5 * 60 * 1000, streak: 4, lastDay: "2026-11-02",
  done: doneMap(done), lessonsCompleted: done.length + 2, installTipClosed: true, lastActive: Date.now(),
  prefs: { sound: false, haptics: false, soundStyle: "J" }, ...extra,
});
const mainline = (s) => JSON.stringify({ xp: s.xp, hearts: s.hearts, heartsAt: s.heartsAt, streak: s.streak, lastDay: s.lastDay, done: s.done, lessonsCompleted: s.lessonsCompleted });

// 答当前这道题：correct=true 答对，false 答错
async function answer(page, correct) {
  const ex = await page.evaluate(() => window.__app.currentEx);
  if (ex.type === "predict") {
    const idx = ex.options.findIndex((o) => !!o.correct === correct);
    await page.locator(".choice").nth(idx).click();
  } else if (ex.type === "fill") {
    const want = [...ex.answer];
    if (!correct) want[0] = ex.tokens.find((t) => t !== ex.answer[0]);
    for (let k = 0; k < want.length; k++) {
      await page.locator(`[data-slot="${k}"]`).click();
      await page.evaluate((t) => [...document.querySelectorAll("[data-token]")].find((b) => b.dataset.token === t).click(), want[k]);
    }
  } else {
    const texts = ex.answers.map((a) => a.join());
    let order = ex.answers[0];
    if (!correct) {
      const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
      order = perms(ex.answers[0]).find((p) => !texts.includes(p.join()) && !ex.answers.some((a) => a.map((k) => ex.lines[k]).join("\n") === p.map((k) => ex.lines[k]).join("\n")));
    }
    for (const k of order) await page.locator(`.order-bank [data-line="${k}"]`).first().click();
  }
  await page.evaluate(() => { const b = document.querySelector("[data-check]"); b.click(); b.click(); }); // 连点检查只算一次
  await page.locator("[data-continue]:not([disabled])").waitFor();
  return ex.type;
}

try {
  { // 未通关：入口禁用 + 友好提示
    const { ctx, page, errors } = await openPage(baseState([], { xp: 0, lessonsCompleted: 0 }));
    const entry = page.locator("[data-practice-entry]");
    check("未通关：地图顶部有“随机练习”入口，标注“无奖励，自由练习”", (await entry.count()) === 1 && /无奖励，自由练习/.test(await entry.innerText()));
    check("未通关：入口禁用，显示“完成第一关后可开始刷题”", (await entry.isDisabled()) && /完成第一关后可开始刷题/.test(await page.locator("#app").innerText()));
    check("未通关：没有脚本错误", errors.length === 0, errors.join("|"));
    await ctx.close();
  }

  { // 跨单元通关：范围选择、题数、整轮不改变主线数据
    const cross = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1"];
    const seed = baseState(cross);
    const { ctx, page, errors } = await openPage(seed);
    const rawBefore = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const memBefore = mainline(await page.evaluate(() => window.__app.getState()));
    await page.locator("[data-practice-entry]").click();
    await page.waitForSelector(".practice-setup");
    check("范围页：默认“全部已学”，列出 7 个已通关关卡，没有未通关的 U2L2", (await page.locator("[data-practice-lesson]").count()) === 7 && (await page.locator('[data-practice-lesson][aria-pressed="true"]').count()) === 7 && (await page.locator('[data-practice-lesson="U2L2"]').count()) === 0);
    check("范围页：默认 10 题", (await page.locator('[data-practice-size="10"]').getAttribute("aria-pressed")) === "true" && /本轮 10 道题/.test(await page.locator("[data-practice-info]").innerText()));
    await page.locator("[data-practice-none]").click();
    check("取消全部：空范围不能开始", await page.locator("[data-practice-start]").isDisabled());
    await page.locator('[data-practice-unit="U2"]').click();
    const info1 = await page.locator("[data-practice-info]").innerText();
    check("选中第 2 单元 = 选中其中已通关的 U2L1；题池不够 10 题时开始前显示实际题数", (await page.locator('[data-practice-lesson][aria-pressed="true"]').count()) === 1 && /只有 4 道题.*用全部 4 道/.test(info1), info1);
    await page.locator('[data-practice-lesson="U1L3"]').click();
    await page.locator('[data-practice-size="5"]').click();
    check("关卡多选：U2L1 + U1L3，选 5 题时本轮 5 题", /本轮 5 道题（已选范围共 8 道）/.test(await page.locator("[data-practice-info]").innerText()));
    await page.locator('[data-practice-size="20"]').click();
    check("选 20 题：题池 8 道时显示用全部 8 道", /只有 8 道题，不够 20 道，本轮用全部 8 道/.test(await page.locator("[data-practice-info]").innerText()));
    await page.locator("[data-practice-start]").click();
    const pr = await page.evaluate(() => { const p = window.__app.getPractice(); return { total: p.total, ids: p.items.map((x) => x.id) }; });
    check("开始后本轮 8 题、不重复、只来自 U2L1 和 U1L3", pr.total === 8 && new Set(pr.ids).size === 8 && pr.ids.every((id) => /^(U2L1|U1L3)#/.test(id)), pr.ids.join());

    // 答完整轮：前 3 题答错（其中 1 题重练答对、其余重练仍错），其余答对；连点检查/继续
    const types = new Set();
    let n = 0;
    const wrongFirst = new Set();
    while (await page.locator("[data-check]").count()) {
      const cur = await page.evaluate(() => window.__app.currentPracticeItem);
      const wrong = cur.retry ? cur.id !== [...wrongFirst][0] : n < 3;
      if (!cur.retry && wrong) wrongFirst.add(cur.id);
      types.add(await answer(page, !wrong));
      await page.evaluate(() => { const b = document.querySelector("[data-continue]"); b.click(); b.click(); }); // 连点继续
      await page.waitForSelector("[data-check], .practice-finish");
      n++;
      if (n > 40) break;
    }
    await page.waitForSelector(".practice-finish");
    check("整轮完成：共 8 + 3 次作答（每道错题只重练一次），连点继续不跳题", n === 11, `${n}`);
    check("三种题型都出现并能完成（选输出、填空、排序）", types.size === 3, [...types].join());
    check("结算分开显示首次答对 5/8、重练答对 1/3", (await page.locator("[data-practice-first]").innerText()) === "5/8" && (await page.locator("[data-practice-retry]").innerText()) === "1/3");
    const rawAfter = await page.evaluate((k) => localStorage.getItem(k), KEY);
    const memAfter = mainline(await page.evaluate(() => window.__app.getState()));
    check("整轮（含答错）后：本机记录原样不变（XP、红心、连续天数、解锁/完成记录）", rawAfter === rawBefore);
    check("整轮（含答错）后：内存里的 XP、红心、连续天数、完成记录也不变", memAfter === memBefore, memAfter);
    const s = await page.evaluate(() => window.__app.getState());
    check("XP 仍是 130，红心仍是 3，连续天数仍是 4，完成关卡仍是 7 关", s.xp === 130 && s.hearts === 3 && s.streak === 4 && Object.keys(s.done).length === 7 && s.lessonsCompleted === 9);
    await page.locator("[data-continue]").click();
    await page.waitForSelector(".pathview");
    check("回到地图：当前关卡仍是 U2L2（解锁没有推进或倒退）", (await page.locator(".node.current").getAttribute("data-lesson")) === "U2L2");

    // 中途退出 + 刷新
    await page.locator("[data-practice-entry]").click();
    await page.locator('[data-practice-size="5"]').click();
    await page.locator("[data-practice-start]").click();
    await answer(page, false);
    await page.locator("[data-continue]").click();
    await page.getByRole("button", { name: "退出练习" }).click();
    check("中途退出提示“本轮练习位置不保存”", /本轮练习位置不保存/.test(await page.locator(".overlay").innerText()));
    await page.locator("[data-practice-quit]").click();
    await page.waitForSelector(".pathview");
    check("中途退出后：本机记录不变", (await page.evaluate((k) => localStorage.getItem(k), KEY)) === rawBefore);
    await page.locator("[data-practice-entry]").click();
    await page.locator("[data-practice-start]").click();
    await answer(page, false);
    await page.reload();
    await page.waitForSelector(".pathview");
    const afterReload = await page.evaluate(() => window.__app.getState());
    check("练习中刷新后：回到地图，XP、红心、连续天数、完成记录不变", mainline(afterReload) === memBefore && !(await page.evaluate(() => window.__app.getPractice())));
    check("全过程没有脚本错误", errors.length === 0, errors.join("|"));
    await ctx.close();
  }

  { // 红心为 0 也能练习，且不恢复红心；横屏 iPad 无横向溢出
    const seed = baseState(["U1L1"], { hearts: 0 });
    const { ctx, page, errors } = await openPage(seed, { width: 1024, height: 768 });
    const before = await page.evaluate((k) => localStorage.getItem(k), KEY);
    await page.locator("[data-practice-entry]").click();
    check("只通关一关：范围只有 U1L1", (await page.locator("[data-practice-lesson]").count()) === 1);
    check("iPad 横屏：范围页没有横向溢出", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    await page.locator('[data-practice-size="5"]').click();
    check("题池 4 题时选 5 题：开始前说明只用 4 道", /只有 4 道题，不够 5 道，本轮用全部 4 道/.test(await page.locator("[data-practice-info]").innerText()));
    await page.locator("[data-practice-start]").click();
    let n = 0;
    while (await page.locator("[data-check]").count()) { await answer(page, false); await page.locator("[data-continue]").click(); await page.waitForSelector("[data-check], .practice-finish"); if (++n > 20) break; }
    await page.waitForSelector(".practice-finish");
    check("红心为 0 也能刷完（全错 4 题 + 重练 4 次），不扣也不恢复红心", n === 8 && (await page.evaluate(() => window.__app.getState().hearts)) === 0 && (await page.evaluate((k) => localStorage.getItem(k), KEY)) === before);
    check("结算显示“题目不够 5 道，本轮用了全部 4 道”", /题目不够 5 道，本轮用了全部 4 道/.test(await page.locator("#app").innerText()));
    check("iPad 横屏：没有脚本错误", errors.length === 0, errors.join("|"));
    await ctx.close();
  }

  { // iPhone 竖屏小屏：范围页无横向溢出
    const { ctx, page } = await openPage(baseState(["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1", "U2L2", "U2L3", "U2L4", "U2L5"]), { width: 360, height: 740 });
    await page.locator("[data-practice-entry]").click();
    check("360 宽竖屏：范围页没有横向溢出，11 关全部可选", (await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)) && (await page.locator("[data-practice-lesson]").count()) === 11);
    await ctx.close();
  }
} finally {
  await browser.close();
  srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
