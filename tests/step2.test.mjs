// 多邻国式关卡的自动测试：内容核对 + 做题流程 + XP/红心/连续天数 + 旧记录迁移。
// 桌面 Chromium 模拟手机触摸，不能代替 iPhone 真机。运行：npm run build && node tests/step2.test.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { freshState, regenHearts, loseHeart, bumpStreak, currentStreak, HEARTS_MAX, HEART_REGEN_MS } from "../src/storage.js";

const unit = JSON.parse(readFileSync(new URL("../content/unit1.json", import.meta.url)));
const course = JSON.parse(readFileSync(new URL("../content/course.json", import.meta.url)));
const PORT = 4319;
const BASE = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

// ---------- 内容结构 ----------
const L = unit.lessons;
const allEx = L.flatMap((l) => l.exercises.map((e) => ({ ...e, lesson: l.id })));
check("内容：第 1 单元 6 关，最后一关是单元复习", L.length === 6 && L.at(-1).review === true);
check("内容：每关 3–5 道题，都有故事开场和示例代码", L.every((l) => l.exercises.length >= 3 && l.exercises.length <= 5 && l.story && l.introCode));
check("内容：关卡 id 不重复，且课程路线只有第 1 单元可用", new Set(L.map((l) => l.id)).size === L.length && course.units.filter((u) => u.available).length === 1);
check("内容：全部是点选题（选输出 / 填词块 / 排顺序）", allEx.every((e) => ["predict", "fill", "order"].includes(e.type)));
check("内容：每道选输出题恰好一个正确选项，每个选项都有解释", allEx.filter((e) => e.type === "predict").every((e) => e.options.filter((o) => o.correct).length === 1 && e.options.every((o) => o.why)));
check("内容：填空题的答案都在词块里，错误词块都有解释", allEx.filter((e) => e.type === "fill").every((e) => e.answer.every((a) => e.tokens.includes(a)) && e.tokens.filter((t) => !e.answer.includes(t)).every((t) => e.why[t])));
check("内容：排序题打乱后的顺序不等于答案", allEx.filter((e) => e.type === "order").every((e) => e.shuffled.slice().sort().join() === e.lines.map((_, i) => i).join() && !e.answers.some((a) => a.join() === e.shuffled.join())));
const firstIntro = {};
for (const l of L) for (const e of l.exercises) { if (/ = /.test(e.code || e.lines?.join("\n") || "") && !firstIntro.var) firstIntro.var = l.id; }
check("内容：变量（=）第一次出现在第 2 关「记住顾客」，不早于讲解", firstIntro.var === "U1L2");

// ---------- 纯逻辑：红心、连续天数 ----------
{
  const s = freshState(); const t0 = 1_000_000_000_000;
  s.heartsAt = t0; loseHeart(s, t0); loseHeart(s, t0);
  check("红心：答错两次剩 3 颗", s.hearts === 3);
  regenHearts(s, t0 + HEART_REGEN_MS - 1);
  check("红心：不到 30 分钟不恢复", s.hearts === 3);
  regenHearts(s, t0 + HEART_REGEN_MS * 2 + 5);
  check("红心：60 分钟后恢复 2 颗", s.hearts === 5);
  regenHearts(s, t0 + HEART_REGEN_MS * 50);
  check("红心：最多 5 颗", s.hearts === HEARTS_MAX);
  const st = freshState();
  bumpStreak(st, new Date(2026, 10, 1, 9)); check("连续天数：第一天 = 1", st.streak === 1);
  bumpStreak(st, new Date(2026, 10, 1, 22)); check("连续天数：同一天多次完成不重复加", st.streak === 1);
  bumpStreak(st, new Date(2026, 10, 2, 8)); check("连续天数：第二天 = 2", st.streak === 2);
  check("连续天数：隔了两天没学，显示 0", currentStreak(st, new Date(2026, 10, 5)) === 0);
  bumpStreak(st, new Date(2026, 10, 5)); check("连续天数：断了之后重新从 1 开始", st.streak === 1);
  const st2 = freshState(); bumpStreak(st2, new Date(2026, 11, 31)); bumpStreak(st2, new Date(2027, 0, 1));
  check("连续天数：跨年也算连续", st2.streak === 2);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__app?.runner?.state === "ready", null, { timeout: 60000 });

  // ---------- 内容核对：真实运行 ----------
  const runPy = (code) => page.evaluate((c) => new Promise((resolve) => {
    const r = window.__app.runner; let out = "";
    const po = r.onOutput, ps = r.onStatus;
    r.onOutput = (t) => { out += t; };
    r.onStatus = (s, info) => { if (s === "done") { r.onOutput = po; r.onStatus = ps; ps(s, info); resolve(info.error ? "ERR:" + info.error.kind : out.replace(/\n$/, "")); } };
    r.run(c);
  }), code);
  const perms = (n) => n <= 1 ? [[0]] : perms(n - 1).flatMap((p) => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)]));
  let contentOk = 0;
  for (const e of allEx) {
    if (e.type === "predict") {
      const out = await runPy(e.code);
      const ok = e.options.every((o) => (o.text === out) === !!o.correct);
      check(`内容：${e.lesson} 选输出题与真实运行一致`, ok, ok ? "" : JSON.stringify(out));
      contentOk += ok;
    } else if (e.type === "fill") {
      const fillCode = (toks) => toks.reduce((c, t, i) => c.replace(`{${i}}`, t), e.code);
      const out = await runPy(fillCode(e.answer));
      let ok = out === e.expected;
      for (const t of e.tokens.filter((x) => !e.answer.includes(x))) {
        const o = await runPy(fillCode([t]));
        // 错误词块：要么输出不同/出错，要么解释里明确说明“也能显示但不对”
        if (o === e.expected && !/也能显示/.test(e.why[t])) ok = false;
      }
      check(`内容：${e.lesson} 填空题答案运行得到要求的输出`, ok, ok ? "" : JSON.stringify(out));
    } else {
      const answerTexts = e.answers.map((a) => a.map((k) => e.lines[k]).join("\n"));
      let ok = true;
      for (const p of perms(e.lines.length)) {
        const code = p.map((k) => e.lines[k]).join("\n");
        const out = await runPy(code);
        if ((out === e.expected) !== answerTexts.includes(code)) ok = false;
      }
      check(`内容：${e.lesson} 排序题只有列出的顺序能得到要求的输出`, ok);
    }
  }

  // ---------- 流程 ----------
  const text = () => page.locator("#app").innerText();
  const tapBtn = (name) => page.getByRole("button", { name, exact: true }).first().tap();
  const ex = () => page.evaluate(() => window.__app.currentEx);
  const st = () => page.evaluate(() => window.__app.getState());
  async function answer(correct = true) {
    const e = await ex();
    if (e.type === "predict") {
      const i = e.options.findIndex((o) => !!o.correct === correct);
      await page.locator(".choice").nth(i).tap();
    } else if (e.type === "fill") {
      const toks = correct ? e.answer : [e.tokens.find((t) => !e.answer.includes(t) && !(e.initial || []).includes(t)) ?? e.tokens.find((t) => !e.answer.includes(t))];
      for (const t of toks) await page.locator(`[data-token=${JSON.stringify(t)}]`).tap();
    } else {
      const order = correct ? e.answers[0] : [...e.answers[0]].reverse();
      for (const k of order) await page.locator(`.order-bank [data-line="${k}"]`).first().tap();
    }
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar");
    return page.locator(".feedbar").innerText();
  }
  const cont = async () => { await page.locator("[data-continue]").tap(); };
  async function playLesson({ wrongFirst = 0 } = {}) {
    await page.waitForSelector(".intro-title");
    await tapBtn("继续");
    let wrongs = wrongFirst; let n = 0;
    while (await page.locator("[data-check]").count()) {
      const fb = await answer(wrongs-- <= 0);
      await cont(); n++;
      if (n > 30) throw new Error("做题循环过多");
      if (/红心用完了/.test(fb)) return fb;
    }
  }

  // 开场
  check("首次打开：显示小码开场介绍", /你好，我是小码/.test(await text()));
  await tapBtn("继续"); await tapBtn("继续");
  check("开场第 3 屏：说明卡住可以点小码", /卡住了就点我/.test(await text()));
  await tapBtn("开始学习");
  check("关卡地图：显示单元、XP、红心、连续天数", /奶茶店点单屏/.test(await text()) && (await page.locator(".statsbar").innerText()).includes("5"));
  check("关卡地图：第 1 关是当前关，其余锁住", (await page.locator(".node.current").count()) === 1 && (await page.locator(".node.locked").count()) === 5);
  check("关卡地图：后面的单元显示即将推出", /即将推出/.test(await text()));
  await page.locator('[data-lesson="U1L3"]').tap();
  await page.waitForSelector(".overlay");
  check("点锁住的关卡：提示先完成前面的", /先完成前面的关卡/.test(await page.locator(".overlay").innerText()));
  await tapBtn("知道了");

  // 第 1 关
  await page.locator('[data-lesson="U1L1"]').tap();
  await page.waitForSelector(".overlay");
  check("关卡弹窗：显示故事和可得 XP", /奶茶店/.test(await page.locator(".overlay").innerText()) && /\+50 XP/.test(await page.locator(".overlay").innerText()));
  await page.locator(".overlay .btn3d.primary").tap();
  check("开场卡：故事 + 示例代码 + 标题", /让屏幕说话/.test(await text()) && (await page.locator(".intro-screen .codeblock").count()) === 1);
  await tapBtn("继续");
  check("第 1 题：检查按钮在选择前不可用", await page.locator("[data-check]").isDisabled());
  // 小码提示
  await page.getByRole("button", { name: "让小码给个提示" }).tap();
  await page.waitForSelector(".overlay");
  const hint1 = await page.locator(".overlay").innerText();
  await tapBtn("好的");
  check("点小码：给出提示或答案", /小码提示|答案是/.test(hint1));
  // 答错
  let fb = await answer(false);
  let s = await st();
  check("答错：显示原因和正确答案", /不对哦/.test(fb) && /正确答案/.test(fb));
  check("答错：扣 1 颗红心", s.hearts === 4 && /剩 4 颗/.test(fb));
  check("答错：运行结果面板显示真实输出", await page.locator(".outpanel[open]").count() === 1);
  await page.waitForFunction(() => /欢迎光临/.test(document.querySelector(".outpanel pre")?.textContent || ""), null, { timeout: 15000 });
  check("运行结果是 Python 真实运行出来的", (await page.locator(".outpanel pre").innerText()).trim() === "欢迎光临！");
  await cont();
  // 做完剩下的（包括回炉的错题）
  let seen = 0;
  while (await page.locator("[data-check]").count()) {
    const e = await ex();
    if (e.type === "fill") {
      // 填空交互：⌫、重新开始
      await page.locator(`[data-token=${JSON.stringify(e.tokens[1])}]`).tap();
      await page.getByRole("button", { name: "清空当前空格" }).tap();
      check("填空：⌫ 清空当前空格", (await page.locator('[data-slot="0"]').innerText()).trim() === "");
    }
    if (e.type === "order") {
      await page.locator(".order-bank .line-chip").first().tap();
      await page.locator(".order-mine .line-chip").first().tap();
      check("排序：点已放好的行可以退回", (await page.locator(".order-mine .line-chip").count()) === 0);
      await page.locator(".order-bank .line-chip").first().tap();
      await page.getByRole("button", { name: "↺ 重新开始" }).tap();
      check("排序：重新开始清空", (await page.locator(".order-mine .line-chip").count()) === 0);
    }
    fb = await answer(true);
    check(`答对（${e.type}）：+10 XP`, /答对了/.test(fb) && /\+10 XP/.test(fb));
    await cont();
    if (++seen > 10) break;
  }
  check("错题回炉：答错的第 1 题在最后又出现了一次", seen === 4);
  check("通关页：完成、本关 XP、连续天数", /完成！/.test(await text()) && /\+50/.test(await text()) && /🔥 1/.test(await text()));
  check("通关页：提示今天学习完成", /今天的学习完成了/.test(await text()));
  s = await st();
  check("记录：XP 50、第 1 关完成、连续 1 天", s.xp === 50 && s.done.U1L1 && s.streak === 1);
  await cont();
  check("回到地图：第 1 关打勾，第 2 关成为当前关", (await page.locator('[data-lesson="U1L1"]').getAttribute("class")).includes("done") && (await page.locator('[data-lesson="U1L2"]').getAttribute("class")).includes("current"));

  // 重新打开，记录还在
  await page.reload();
  await page.waitForSelector(".statsbar");
  check("重新打开：直接进地图，XP 和进度都在", (await page.locator(".statsbar").innerText()).includes("50") && (await page.locator(".node.done").count()) === 1);

  // 修程序题：初始带错词，没改前不能检查
  await page.locator('[data-lesson="U1L2"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  await tapBtn("继续");
  while (true) {
    const e = await ex();
    if (e.type === "fill" && e.initial) {
      check("修程序题：初始空格里是错的词", (await page.locator('[data-slot="0"]').innerText()).trim() === e.initial[0]);
      check("修程序题：还没改就不能检查", await page.locator("[data-check]").isDisabled());
      fb = await answer(false);
      check("修程序题：选错时解释原因（引号/大小写）", /引号|大小写/.test(fb), fb.slice(0, 60));
      await cont();
      break;
    }
    await answer(true); await cont();
  }
  // 退出确认
  await page.getByRole("button", { name: "退出本关" }).tap();
  await tapBtn("继续学习");
  check("退出确认：选继续学习，留在本关", (await page.locator("[data-check]").count()) === 1);
  await page.getByRole("button", { name: "退出本关" }).tap();
  await tapBtn("退出");
  check("退出确认：选退出，回到地图，本关仍未完成", /奶茶店点单屏/.test(await text()) && !(await st()).done.U1L2);

  // 红心用完
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 0; s.heartsAt = Date.now(); window.__app.persist(); window.__app.renderPath(); });
  await page.locator('[data-lesson="U1L2"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  await page.waitForFunction(() => /红心用完了/.test(document.body.innerText));
  check("红心为 0：不能开始新关卡，提示等待或复习", /每 30 分钟恢复 1 颗/.test(await page.locator(".overlay").innerText()));
  await page.locator(".overlay .btn3d.primary").tap(); // 复习「让屏幕说话」
  await page.waitForSelector(".intro-title");
  check("复习模式：不显示红心，显示护盾", /复习/.test(await text()) && (await page.locator(".lessonbar").innerText()).includes("🛡"));
  await tapBtn("继续");
  fb = await answer(false);
  check("复习模式：答错不扣红心", (await st()).hearts === 0 && !/❤️ -1/.test(fb));
  await cont();
  while (await page.locator("[data-check]").count()) { await answer(true); await cont(); }
  check("复习完成：恢复 1 颗红心", /恢复 1 颗红心/.test(await text()) && (await st()).hearts === 1);
  check("复习：每题 +5 XP", (await st()).xp > 50);
  await cont();

  // 中途红心用完
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 1; window.__app.persist(); window.__app.renderPath(); });
  await page.locator('[data-lesson="U1L2"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  await tapBtn("继续");
  fb = await answer(false);
  check("最后一颗红心答错：按钮变成“红心用完了”", /红心用完了/.test(fb));
  await cont();
  check("红心用完：回到地图并提示复习", /红心用完了/.test(await page.locator(".overlay").innerText()));
  await tapBtn("稍后再来");

  // 我的
  await page.getByRole("button", { name: "我的" }).tap();
  check("我的：显示 XP、连续天数、完成关卡、红心和规则", /经验值/.test(await text()) && /已完成关卡/.test(await text()) && /每 30 分钟恢复/.test(await text()));
  await tapBtn("清除学习记录"); await tapBtn("取消");
  check("清除记录：取消不变", (await st()).xp > 0);
  await tapBtn("清除学习记录"); await tapBtn("确定清除");
  check("清除记录：XP 和进度清零", (await st()).xp === 0 && Object.keys((await st()).done).length === 0);
  await page.getByRole("button", { name: "学习", exact: true }).tap();

  // 宽度
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    check(`${w}px：地图无横向溢出`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // 旧版（第 2 版教程）记录迁移
  const p4 = await ctx.newPage();
  await p4.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
    localStorage.setItem("suipian.progress", JSON.stringify({ version: 2, lesson: "L01", page: 6, started: true, lessonDone: { L01: true }, exDone: { X1: true, X2: true }, drafts: { P1a: { code: "x" } }, installTipClosed: true }));
  });
  await p4.goto(BASE);
  await p4.getByRole("button", { name: "继续", exact: true }).tap(); await p4.getByRole("button", { name: "继续", exact: true }).tap(); await p4.getByRole("button", { name: "开始学习" }).tap();
  const t4 = await p4.locator("#app").innerText();
  const s4 = await p4.evaluate(() => window.__app.getState());
  check("旧版记录：提示改版，不沿用旧完成状态", /课程改版为关卡模式/.test(t4) && Object.keys(s4.done).length === 0 && s4.xp === 0 && s4.version === 3);
  check("旧版记录：没有旧课程出现", !/L01|输出、变量和简单运算」/.test(t4) && (await p4.locator(".node.done").count()) === 0);
  await p4.close();

  // 存储不可用 / 损坏
  const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p2 = await ctx2.newPage();
  await p2.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("quota"); }; });
  await p2.goto(BASE);
  await p2.getByRole("button", { name: "继续", exact: true }).tap(); await p2.getByRole("button", { name: "继续", exact: true }).tap(); await p2.getByRole("button", { name: "开始学习" }).tap();
  check("存储写入失败：提示无法保存，页面仍可用", /无法保存进度/.test(await p2.locator(".toast").innerText().catch(() => "")) && /奶茶店/.test(await p2.locator("#app").innerText()));
  await p2.close();
  const ctx3 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const p3 = await ctx3.newPage();
  await p3.addInitScript(() => { try { localStorage.setItem("suipian.progress", "{坏掉的数据"); } catch {} });
  await p3.goto(BASE);
  check("记录损坏：从头开始，不白屏", /你好，我是小码/.test(await p3.locator("#app").innerText()));
  await p3.close();

  check("页面无脚本错误", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
