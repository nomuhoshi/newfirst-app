// 多邻国式关卡的自动测试：内容核对 + 做题流程 + XP/红心/连续天数 + 旧记录迁移。
// 桌面 Chromium 模拟手机触摸，不能代替 iPhone 真机。运行：npm run build && node tests/step2.test.mjs
import { startDistServer } from "./helpers/dist-server.mjs";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { freshState, regenHearts, loseHeart, bumpStreak, currentStreak, HEARTS_MAX, HEART_REGEN_MS } from "../src/storage.js";

const css = readFileSync(new URL("../src/game.css", import.meta.url), "utf8");
const unit = JSON.parse(readFileSync(new URL("../content/unit1.json", import.meta.url)));
const unit2 = JSON.parse(readFileSync(new URL("../content/unit2.json", import.meta.url)));
const words = JSON.parse(readFileSync(new URL("../content/words.json", import.meta.url)));
const course = JSON.parse(readFileSync(new URL("../content/course.json", import.meta.url)));
const server = await startDistServer(); // 进程内静态服务器、随机端口、就绪才返回；用完 server.close()（不再留下 vite preview 进程）
const BASE = server.base;

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

// ---------- 内容结构 ----------
const L = unit.lessons;
const L2 = unit2.lessons;
const L3 = JSON.parse(readFileSync(new URL("../content/unit3.json", import.meta.url))).lessons;
// 全部关卡（第 1、2 单元）的题目；下面的通用内容检查对两个单元一起做
const allEx = [...L, ...L2].flatMap((l) => l.exercises.map((e) => ({ ...e, lesson: l.id })));
check("内容：第 1 单元 6 关，最后一关是单元复习", L.length === 6 && L.at(-1).review === true);
check("内容：每关 3–5 道题，都有故事开场和示例代码", L.every((l) => l.exercises.length >= 3 && l.exercises.length <= 5 && l.story && l.introCode));
check("内容：关卡 id 不重复，课程路线第 1–7 单元可用，第 8 单元（函数）即将推出", new Set([...L, ...L2, ...L3].map((l) => l.id)).size === L.length + L2.length + L3.length && course.units.filter((u) => u.available).map((u) => u.id).join() === "U1,U2,U3,U4,U5,U6,U7" && course.units.filter((u) => !u.available).map((u) => u.id).join() === "U8");
check("第 3 单元：U3L1–U3L8 每关 4 题，课程文件指向 unit3.json", L3.map((l) => l.id).join() === "U3L1,U3L2,U3L3,U3L4,U3L5,U3L6,U3L7,U3L8" && L3.every((l) => l.exercises.length === 4 && l.story && l.introCode && l.concept) && course.units[2].file === "unit3.json");
check("第 3 单元：改一改/写一写只记在 pending（待代码题运行器），不进题目", L3.filter((l) => l.pending).map((l) => l.id).join() === "U3L5,U3L6,U3L7,U3L8" && L3.every((l) => (l.pending || []).every((p) => ["modify", "write"].includes(p.type))));
check("第 3 单元：只用已有题型（predict / fill / order）", L3.every((l) => l.exercises.every((e) => ["predict", "fill", "order"].includes(e.type))));
{
  const t = (l) => l.exercises.map((e) => e.type).join();
  check("第 2 单元：5 关、每关 4 题、共 20 题，最后一关是单元复习", L2.length === 5 && L2.every((l) => l.exercises.length === 4) && L2.flatMap((l) => l.exercises).length === 20 && L2.at(-1).review === true && L2.slice(0, 4).every((l) => !l.review));
  check("第 2 单元：关卡 id 和标题按规格，课程文件指向 unit2.json", L2.map((l) => l.id).join() === "U2L1,U2L2,U2L3,U2L4,U2L5" && L2.map((l) => l.title).join() === "保存饮品名,拼出菜单文字,名字有多长,空格也算一个,菜单标签" && course.units[1].file === "unit2.json");
  check("第 2 单元：题型分布（第 1–4 关：预测×2、填空、排序；第 5 关：预测、填空、排序、预测）", L2.slice(0, 4).every((l) => [...l.exercises.map((e) => e.type)].sort().join() === "fill,order,predict,predict") && t(L2[4]) === "predict,fill,order,predict");
  const codeOf = (e) => e.code || e.lines.join("\n");
  const all2 = L2.flatMap((l) => l.exercises).map(codeOf).join("\n") + L2.map((l) => l.introCode).join("\n");
  check("第 2 单元：不出现还没教的东西（索引、切片、str()、格式化字符串、换行转义、input()、类型名）", !/\[|\]|\bstr\(|\bf"|\\n|\binput\(|\btype\(|\bint\(|\bfloat\(/.test(all2), all2.match(/\[|\]|\bstr\(|\bf"|\\n|\binput\(|\btype\(|\bint\(|\bfloat\(/)?.[0]);
  check("第 2 单元：不含 emoji / 组合字符（len 只数普通中英文和数字）", !/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u200D\uFE0F\u0300-\u036F]/u.test(JSON.stringify(unit2)));
  check("第 2 单元：所有关卡都有故事、概念和示例代码", L2.every((l) => l.story && l.concept && l.introCode));
  check("第 2 单元：len 在第 3 关第一次出现，+ 拼接字符串在第 2 关第一次出现，不早于讲解", (() => { const first = (re) => L2.find((l) => re.test([l.introCode, ...l.exercises.map((e) => e.code || e.lines.join("\n"))].join("\n")))?.id; return first(/len\(/) === "U2L3" && first(/"\s*\+\s*"|\w\s\+\s"|"\s\+\s\w/) === "U2L2"; })());
  check("词义卡：新增 string 和 len（带美式音标和来源），没有加入 str", words.string?.ipa === "/strɪŋ/" && words.len?.full === "length" && words.len?.ipa === "/leŋθ/" && words.string?.source && words.len?.source && !("str" in words) && words.print?.ipa === "/prɪnt/");
}
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
  check("关卡地图：第 1 关是当前关，其余锁住（地图上共 46 关：第 1 单元 6 关 + 第 2 单元 5 关 + 第 3 单元 8 关 + 第 4 单元 8 关 + 第 5 单元 7 关 + 第 6 单元 6 关 + 第 7 单元 6 关）", (await page.locator(".node.current").count()) === 1 && (await page.locator('[data-lesson="U1L1"]').getAttribute("class")).includes("current") && (await page.locator(".node.locked").count()) === 45);
  check("关卡地图：第 8 单元（函数）显示即将推出", /第 8 单元 · 即将推出/.test(await text()));
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
  check("通关页：完成、本关 XP、连续天数", /完成！/.test(await text()) && /\+50/.test(await text()) && (await page.locator(".fs").nth(2).innerText()).includes("1"));
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
  check("复习模式：不显示红心，显示护盾", /复习/.test(await text()) && (await page.locator(".lessonbar .shield").count()) === 1);
  await tapBtn("继续");
  fb = await answer(false);
  check("复习模式：答错不扣红心", (await st()).hearts === 0 && !/红心 -1/.test(fb));
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


  // ---------- 手感：时间线、重复提交、旧回调、音效、振动、减少动态效果 ----------
  // 游戏按钮现在是真正的 click（iOS 只承认 click / touchend 能解锁声音），测试里用 click 事件模拟
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; s.heartsAt = Date.now(); window.__app.persist(); window.__app.renderPath(); });
  await page.locator('[data-lesson="U1L1"]').tap(); await page.locator(".overlay .btn3d.primary").tap();
  await tapBtn("继续");
  await page.waitForSelector("[data-check]");
  // 选一个选项，量“检查”到出结果、到可继续的毫秒数
  const pickCorrect = async () => {
    const e = await ex();
    if (e.type === "predict") await page.locator(".choice").nth(e.options.findIndex((o) => o.correct)).tap();
    else if (e.type === "fill") for (const t of e.answer) await page.locator(`[data-token=${JSON.stringify(t)}]`).tap();
    else for (const k of e.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).first().tap();
  };
  await pickCorrect();
  const tl = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now(); const r = {};
    const xp0 = window.__app.getState().xp;
    const btn = document.querySelector("[data-check]");
    for (let i = 0; i < 3; i++) btn.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); // 连点三次
    r.labelAtOnce = btn.textContent; r.disabledAtOnce = btn.disabled;
    const tick = () => {
      const fb = document.querySelector(".feedbar");
      if (fb && r.reveal == null) { r.reveal = performance.now() - t0; r.contDisabledAtReveal = fb.querySelector("[data-continue]").disabled; }
      const c = fb?.querySelector("[data-continue]");
      if (c && !c.disabled && r.cont == null) { r.cont = performance.now() - t0; r.xpGain = window.__app.getState().xp - xp0; return resolve(r); }
      if (performance.now() - t0 > 3000) return resolve(r);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  check("手感：点检查后立刻锁定并显示“检查中”", tl.labelAtOnce === "检查中" && tl.disabledAtOnce === true);
  check("手感：结果不是瞬间出现，约 120ms 后揭示", tl.reveal >= 100 && tl.reveal < 600, `${Math.round(tl.reveal)}ms`);
  check("手感：揭示时“继续”还不能点，约 280ms 才可用", tl.contDisabledAtReveal === true && tl.cont >= 250 && tl.cont < 900, `${Math.round(tl.cont)}ms`);
  check("重复提交：连点三次检查只计一次分（+10 XP）", tl.xpGain === 10, `xpGain=${tl.xpGain}`);
  const fx = await page.evaluate(() => window.__app.feel.log.slice());
  check("音效：答对播放“答对”音，选择时有点选 / 放入音", fx.includes("correct") && (fx.includes("select") || fx.includes("place")), fx.join(","));
  // 快速连点“继续”只前进一题
  const r0 = await page.evaluate(() => window.__app.renders);
  await page.evaluate(() => { const c = document.querySelector("[data-continue]"); for (let i = 0; i < 3; i++) c.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); });
  await page.waitForSelector("[data-check], .finish");
  check("快速继续：连点三次“继续”只前进一题", (await page.evaluate(() => window.__app.renders)) - r0 === 1);
  // 离题后旧回调：点检查后立刻回到地图，120ms 后不能冒出反馈条
  await pickCorrect();
  await page.evaluate(() => { document.querySelector("[data-check]").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })); window.__app.renderPath(); });
  await page.waitForTimeout(700);
  check("离题后旧回调：回到地图后不会冒出反馈条", (await page.locator(".feedbar").count()) === 0 && /奶茶店点单屏/.test(await text()));
  // 回到这一关，把这一关做完，保证后面的测试状态干净
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); window.__app.renderPath(); });
  await page.locator(".node.current").tap(); await page.locator(".overlay .btn3d.primary").tap();
  await tapBtn("继续");
  while (await page.locator("[data-check]").count()) { await answer(true); await cont(); }
  await cont();

  // 减少动态效果：揭示后“继续”马上可用，动画关闭
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); window.__app.renderPath(); });
  await page.locator(".node.current").tap(); await page.locator(".overlay .btn3d.primary").tap();
  await tapBtn("继续");
  await pickCorrect();
  const rm = await page.evaluate(() => new Promise((resolve) => {
    const t0 = performance.now();
    document.querySelector("[data-check]").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    const tick = () => {
      const fb = document.querySelector(".feedbar");
      if (fb) { const c = fb.querySelector("[data-continue]"); return setTimeout(() => resolve({ reveal: performance.now() - t0, contEnabled: !c.disabled, anim: getComputedStyle(fb).animationName }), 30); }
      if (performance.now() - t0 > 2000) return resolve({});
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  check("减少动态效果：约 120ms 后直接给出完整结果并可继续，动画关闭", rm.reveal >= 100 && rm.contEnabled === true && rm.anim === "none", JSON.stringify(rm));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await cont();
  await page.getByRole("button", { name: "退出本关" }).tap(); await tapBtn("退出");

  // 设置：音效 / 振动开关保存在本机，刷新后仍在，且不影响学习进度
  await page.getByRole("button", { name: "我的" }).tap();
  check("我的：有音效和振动开关", (await page.locator(".switch").count()) === 2);
  await page.locator('[data-pref="sound"]').tap();
  check("音效开关：关闭后保存在记录里", (await st()).prefs.sound === false && (await page.locator('[data-pref="sound"]').getAttribute("aria-checked")) === "false");
  const xpBefore = (await st()).xp;
  await page.reload(); await page.waitForSelector(".statsbar");
  await page.getByRole("button", { name: "我的" }).tap();
  check("刷新后：音效开关保持关闭，XP 不变", (await st()).prefs.sound === false && (await st()).xp === xpBefore && (await page.locator('[data-pref="sound"]').getAttribute("aria-checked")) === "false");
  await page.evaluate(() => window.__app.feel.log.length = 0);
  await page.evaluate(() => { const s = window.__app.getState(); s.prefs.sound = true; window.__app.setState(s); window.__app.persist(); });

  // 旧 v3 记录（没有 prefs）：保留全部进度，只补默认偏好
  const p5 = await ctx.newPage();
  await p5.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return; sessionStorage.setItem("seeded", "1");
    localStorage.setItem("suipian.progress", JSON.stringify({ version: 3, onboarded: true, xp: 130, hearts: 3, heartsAt: Date.now(), streak: 4, lastDay: "2026-11-01", done: { U1L1: true, U1L2: true }, lessonsCompleted: 2, installTipClosed: true, lastActive: 1 }));
  });
  await p5.goto(BASE); await p5.waitForSelector(".statsbar");
  const s5 = await p5.evaluate(() => window.__app.getState());
  check("v3 升级：学习记录全部保留，只补上偏好默认值", s5.xp === 130 && s5.streak === 4 && s5.done.U1L1 && s5.done.U1L2 && s5.lessonsCompleted === 2 && s5.prefs.sound === true && s5.prefs.haptics === true && s5.version === 3);
  check("v3 升级：没有出现改版提示", !/课程改版|无法识别/.test(await p5.locator("#app").innerText()));
  await p5.close();

  // 振动：支持时只在“检查”请求一次；不支持时不报错
  const pv = await ctx.newPage();
  const verrs = []; pv.on("pageerror", (e) => verrs.push(e.message));
  await pv.addInitScript(() => { window.__vib = []; navigator.vibrate = (n) => { window.__vib.push(n); return true; }; });
  await pv.goto(BASE); await pv.waitForSelector(".statsbar");
  await pv.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.hearts = 5; window.__app.persist(); window.__app.renderPath(); });
  await pv.locator(".node.current").tap(); await pv.locator(".overlay .btn3d.primary").tap();
  await pv.getByRole("button", { name: "继续", exact: true }).tap();
  await pv.locator(".choice").first().tap();
  check("振动：只选择答案时不振动", (await pv.evaluate(() => window.__vib.length)) === 0);
  await pv.locator("[data-check]").tap();
  check("振动：点检查请求一次 12ms 短振", JSON.stringify(await pv.evaluate(() => window.__vib)) === "[12]");
  await pv.close();
  const pn = await ctx.newPage();
  const nerrs = []; pn.on("pageerror", (e) => nerrs.push(e.message));
  await pn.addInitScript(() => {
    Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true });
    window.AudioContext = undefined; window.webkitAudioContext = undefined;
  });
  await pn.goto(BASE); await pn.waitForSelector(".statsbar");
  await pn.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await pn.locator(".node.current").tap(); await pn.locator(".overlay .btn3d.primary").tap();
  await pn.getByRole("button", { name: "继续", exact: true }).tap();
  await pn.locator(".choice").first().tap(); await pn.locator("[data-check]").tap();
  await pn.waitForSelector(".feedbar");
  await pn.locator("[data-continue]").tap();
  await pn.getByRole("button", { name: "我的" }).tap().catch(() => {});
  check("无声音 / 无振动环境：学习照常进行，没有脚本错误", nerrs.length === 0 && (await pn.locator(".feedbar, .lesson, .view").count()) > 0, nerrs.join("|"));
  await pn.close();
  const pa = await ctx.newPage();
  const aerrs = []; pa.on("pageerror", (e) => aerrs.push(e.message));
  await pa.addInitScript(() => { window.AudioContext = function () { throw new Error("audio blocked"); }; window.webkitAudioContext = undefined; });
  await pa.goto(BASE); await pa.waitForSelector(".statsbar");
  await pa.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await pa.locator(".node.current").tap(); await pa.locator(".overlay .btn3d.primary").tap();
  await pa.getByRole("button", { name: "继续", exact: true }).tap();
  await pa.locator(".choice").first().tap(); await pa.locator("[data-check]").tap(); await pa.waitForSelector(".feedbar");
  check("音频创建失败：学习照常进行，没有脚本错误", aerrs.length === 0, aerrs.join("|"));
  await pa.close();

  // 配色对比度（读取 game.css 里的浅色 / 深色色值）
  const hexOf = (block) => Object.fromEntries([...block.matchAll(/--g-([\w-]+):\s*(#[0-9A-Fa-f]{6})/g)].map((m) => [m[1], m[2]]));
  const [lightPart, darkPart] = css.split("@media (prefers-color-scheme: dark)");
  const light = hexOf(lightPart); const dark = { ...light, ...hexOf(darkPart.split("@media (prefers-reduced-motion")[0]) };
  const lum = (hx) => { const c = [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const pairs = [["fg", "bg"], ["fg", "card"], ["muted", "bg"], ["muted", "card"], ["on-primary", "primary"], ["primary", "bg"], ["ok", "ok-bg"], ["bad", "bad-bg"], ["on-ok", "ok"], ["on-copper", "copper"], ["copper", "card"], ["bad", "bg"], ["code-fg", "code-bg"], ["tk-str", "code-bg"], ["tk-num", "code-bg"], ["tk-fn", "code-bg"], ["tk-op", "code-bg"], ["code-dim", "code-bg"], ["chip-fg", "chip"]];
  for (const [name, pal] of [["浅色", light], ["深色", dark]]) {
    const bad = pairs.filter(([a, b]) => ratio(pal[a], pal[b]) < 4.5).map(([a, b]) => `${a}/${b}=${ratio(pal[a], pal[b]).toFixed(2)}`);
    check(`配色对比度：${name}主要文字组合都 ≥ 4.5:1`, bad.length === 0, bad.join(" "));
  }
  for (const [name, pal] of [["浅色", light], ["深色", dark]]) { const r = ratio(pal.trace, pal.bg); check(`电路线：${name}对比度低但可见（1.3–2.6:1，不盖过节点）`, r >= 1.3 && r <= 2.6, r.toFixed(2)); }
  check("配色对比度：主按钮文字浅色 ≈ 8.8、深色 ≈ 9.4", Math.abs(ratio(light["on-primary"], light.primary) - 8.77) < 0.2 && Math.abs(ratio(dark["on-primary"], dark.primary) - 9.4) < 0.3);


  // ---------- 第二轮：iPhone 音频解锁、试听按钮、六边形节点、流动电路背景 ----------
  const opaque = (page2, sel) => page2.evaluate((q) => [...document.querySelectorAll(q)].every((el) => /^rgb\(/.test(getComputedStyle(el).backgroundColor)), sel);

  // 六边形电路节点
  await page.evaluate(() => window.__app.renderPath());
  const want = { U1L1: "check", U1L2: "play" };
  const icons = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll(".node")].map((n) => [n.dataset.lesson, n.querySelector(".hexnode").dataset.icon + "|" + n.className])));
  check("节点：46 个六边形节点（七个单元），每个都是 6 个顶点", (await page.locator(".node .hex-body").count()) === 46 && (await page.evaluate(() => [...document.querySelectorAll(".hex-body")].every((p) => p.getAttribute("points").trim().split(/\s+/).length === 6))));
  check("节点：已完成对勾、当前播放、未解锁锁、复习关回转箭头", icons.U1L1.startsWith("check|") && icons.U1L2.startsWith("play|") && icons.U1L3.startsWith("lock|") && icons.U1L6.startsWith("review|"), JSON.stringify(icons));
  check("节点：没有折角、厚底座、立体圆盘", await page.evaluate(() => [...document.querySelectorAll(".node")].every((n) => { const c = getComputedStyle(n); return getComputedStyle(n, "::after").content === "none" && c.boxShadow === "none" && c.backgroundColor === "rgba(0, 0, 0, 0)" && c.borderRadius === "0px"; })));
  check("节点：点击区域不小于 44px，仍带文字标签和关卡编号", await page.evaluate(() => [...document.querySelectorAll(".node")].every((n) => { const r = n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }) && document.querySelectorAll(".node-label").length === 46 && document.querySelectorAll("[data-lesson]").length === 46));
  check("节点：未解锁的复习关带小锁角标", (await page.locator('[data-lesson="U1L6"] .hex-badge').count()) === 1);
  // 复习关成为当前关时显示回转箭头
  await page.evaluate(() => { const s = window.__app.getState(); for (const k of ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5"]) s.done[k] = true; window.__app.renderPath(); });
  check("节点：复习关解锁后仍是回转箭头，并带当前关描边", (await page.locator('[data-lesson="U1L6"]').getAttribute("class")).includes("current") && (await page.locator('[data-lesson="U1L6"] .hexnode').getAttribute("data-icon")) === "review" && (await page.locator('[data-lesson="U1L6"] .hex-ring').count()) === 1);
  await page.evaluate(() => { const s = window.__app.getState(); s.done = { U1L1: true }; window.__app.renderPath(); });

  // 电路背景
  await page.evaluate(() => window.__app.renderPath());
  check("电路：地图页有稀疏电路背景", (await page.locator(".circuit-bg.full").count()) === 1 && (await page.locator(".circuit-bg .trace").count()) <= 8);
  const measureCircuit = (pg) => pg.evaluate(() => {
    const svg = document.querySelector(".circuit-bg.full"); const [, , W, H] = svg.getAttribute("viewBox").split(" ").map(Number);
    const traces = [...svg.querySelectorAll(".trace")];
    const sides = new Set(); let branches = 0; let centerHit = 0; let outside = 0;
    for (const t of traces) {
      const d = t.getAttribute("d"); const m = d.match(/^M(-?[\d.]+) (-?[\d.]+)/);
      const x = +m[1], y = +m[2];
      if (x <= 0) sides.add("左"); else if (x >= W) sides.add("右"); else if (y <= 0) sides.add("上"); else sides.add("下");
      if ((d.match(/M/g) || []).length > 1) branches++;
      const len = t.getTotalLength();
      for (let i = 0; i <= 80; i++) { const p = t.getPointAtLength((len * i) / 80); if (p.x > W * 0.36 && p.x < W * 0.64 && p.y > H * 0.18 && p.y < H * 0.85) centerHit++; if (p.x < -1 || p.x > W + 1 || p.y < -1 || p.y > H + 1) outside++; }
    }
    return { W, H, n: traces.length, sides: [...sides], branches, pads: svg.querySelectorAll(".pad").length, pulses: svg.querySelectorAll(".pulse").length, centerHit, outside };
  });
  const dense = await measureCircuit(page);
  check("电路：第一屏有 5–7 条独立路径，从至少 3 个方向进入", dense.n >= 5 && dense.n <= 7 && dense.sides.length >= 3, JSON.stringify(dense));
  check("电路：有分支和焊点（至少 3 条带分支，焊点不少于 8 个，不密集）", dense.branches >= 3 && dense.pads >= 8 && dense.pads <= 16, JSON.stringify(dense));
  check("电路：3–4 个缓慢光点", dense.pulses >= 3 && dense.pulses <= 4);
  check("电路：中间区域（文字和节点所在）留空，路径都在屏幕内", dense.centerHit === 0 && dense.outside === 0, JSON.stringify(dense));
  // 窗口形状不同（比如 iPad 的小窗口 425×390）时，电路按实际大小重新生成，仍然看得到、仍然留空
  await page.setViewportSize({ width: 425, height: 390 });
  await page.waitForTimeout(300);
  const small = await measureCircuit(page);
  check("电路：窗口变成 425×390（iPad 小窗口）后按新尺寸重新生成，仍有 5–7 条路径、3 个以上方向、中间留空", small.W === 425 && small.H === 390 && small.n >= 5 && small.n <= 7 && small.sides.length >= 3 && small.centerHit === 0 && small.outside === 0 && small.branches >= 3, JSON.stringify(small));
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(300);
  const wide = await measureCircuit(page);
  check("电路：横屏 844×390 也能生成并留空", wide.W === 844 && wide.n >= 5 && wide.centerHit === 0 && wide.outside === 0, JSON.stringify(wide));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const cb = await page.evaluate(() => {
    const g = document.querySelector(".circuit-bg"); const c = getComputedStyle(g);
    const pulses = [...document.querySelectorAll(".circuit-bg .pulse")].map((p) => ({ n: getComputedStyle(p).animationName, d: parseFloat(getComputedStyle(p).animationDuration) }));
    let hit = false;
    for (let y = 10; y < innerHeight; y += 47) for (let x = 5; x < innerWidth; x += 31) if (document.elementsFromPoint(x, y)[0]?.closest(".circuit-bg")) hit = true;
    return { pe: c.pointerEvents, pos: c.position, pulses, hit };
  });
  check("电路：只有少量光点，每次流动 8–12 秒", cb.pulses.length >= 2 && cb.pulses.length <= 4 && cb.pulses.every((p) => p.n === "flow" && p.d >= 8 && p.d <= 12), JSON.stringify(cb.pulses));
  check("电路：不拦截点击和滚动（pointer-events: none，任何位置的最上层都不是电路）", cb.pe === "none" && cb.pos === "fixed" && !cb.hit);
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  check("电路：切到后台时暂停动画", await page.evaluate(() => document.documentElement.classList.contains("bg-paused") && getComputedStyle(document.querySelector(".circuit-bg .pulse")).animationPlayState === "paused"));
  await page.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); });
  check("电路：回到前台恢复动画", await page.evaluate(() => !document.documentElement.classList.contains("bg-paused")));
  await page.emulateMedia({ reducedMotion: "reduce" });
  check("电路：减少动态效果时光点隐藏、线条静止", await page.evaluate(() => [...document.querySelectorAll(".circuit-bg .pulse")].every((p) => getComputedStyle(p).display === "none") && getComputedStyle(document.querySelector(".hex-ring") || document.body).animationName === "none"));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.locator(".node.current").tap(); await page.locator(".overlay .btn3d.primary").tap();
  check("电路：关卡开场页有电路，正文在不透明面板上", (await page.locator(".circuit-bg.full").count()) === 1 && await opaque(page, ".intro-panel, .intro-screen"));
  await tapBtn("继续"); await page.waitForSelector("[data-check]");
  const edgeHit = await page.evaluate(() => { let hit = false; for (let y = 10; y < innerHeight; y += 47) for (let x = 3; x < innerWidth; x += 29) if (document.elementsFromPoint(x, y)[0]?.closest(".circuit-bg")) hit = true; return hit; });
  check("电路：答题页只有边缘电路，题目、选项和代码都在不透明面板上", (await page.locator(".circuit-bg.edge").count()) === 1 && (await page.locator(".circuit-bg .pulse").count()) <= 2 && await opaque(page, ".codeblock, .choice, .order-mine, .slot") && !edgeHit);
  // 电路不挡滚动：做题页内容区仍可滚动
  check("电路：内容区的滚动不受影响", await page.evaluate(() => { const m = document.querySelector(".lesson"); m.scrollTop = 5; return getComputedStyle(m).overflowY === "auto"; }));
  await page.getByRole("button", { name: "退出本关" }).tap(); await tapBtn("退出");

  // iPhone 式音频解锁：假 AudioContext 只在 touchend / click / keydown 里 resume 才会 running（pointerdown 不算）
  const fakeAudio = () => {
    window.__ac = { created: 0, osc: 0, resumeEvents: [], inst: null };
    window.AudioContext = class {
      constructor() { this.state = "suspended"; this.currentTime = 0; this.sampleRate = 48000; this.destination = {}; window.__ac.created++; window.__ac.inst = this; }
      resume() { const t = window.event?.type; window.__ac.resumeEvents.push(t); if (["touchend", "click", "keydown"].includes(t)) this.state = "running"; return Promise.resolve(); }
      suspend() { this.state = "suspended"; return Promise.resolve(); }
      createGain() { return { gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} }, connect(n) { return n; } }; }
      createBiquadFilter() { return { type: "", frequency: { value: 0 }, Q: { value: 0 }, connect(n) { return n; } }; }
      createOscillator() { window.__ac.osc++; return { type: "", frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(n) { return n; }, start() {}, stop() {} }; }
      createBuffer(ch, len, sr) { const d = new Float32Array(len || 1); return { sampleRate: sr, length: len, getChannelData() { return d; } }; }
      createBufferSource() { window.__ac.src = (window.__ac.src || 0) + 1; return { connect(n) { return n; }, start() {}, stop() {} }; }
    };
  };
  const pi = await ctx.newPage();
  const ierrs = []; pi.on("pageerror", (e) => ierrs.push(e.message));
  await pi.addInitScript(fakeAudio);
  await pi.goto(BASE); await pi.waitForSelector(".statsbar, .onboard");
  await pi.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.hearts = 5; window.__app.persist(); window.__app.renderPath(); });
  await pi.locator(".node.current").tap();
  check("音频解锁：第一次触摸（touchend / click）就让 AudioContext 进入 running", (await pi.evaluate(() => window.__ac.inst?.state)) === "running", JSON.stringify(await pi.evaluate(() => window.__ac.resumeEvents)));
  await pi.locator(".overlay .btn3d.primary").tap(); await pi.getByRole("button", { name: "继续", exact: true }).tap(); await pi.waitForSelector("[data-check]");
  const o0 = await pi.evaluate(() => window.__ac.osc);
  await pi.locator(".choice").first().tap();
  check("音频解锁：点选题目时真的合成了声音（振荡器被创建）", (await pi.evaluate(() => window.__ac.osc)) > o0);
  const o1 = await pi.evaluate(() => window.__ac.osc);
  await pi.locator("[data-check]").tap(); await pi.waitForSelector(".feedbar"); await pi.waitForTimeout(100);
  check("音频解锁：120ms 后的结果音在 running 状态下播放（至少两个音）", (await pi.evaluate(() => window.__ac.osc)) - o1 >= 2);
  // 试听按钮
  await pi.locator("[data-continue]").tap(); await pi.getByRole("button", { name: "退出本关" }).tap(); await pi.getByRole("button", { name: "退出", exact: true }).tap();
  await pi.getByRole("button", { name: "我的" }).tap();
  const o2 = await pi.evaluate(() => window.__ac.osc);
  await pi.locator('[data-selftest="sound"]').tap(); await pi.waitForTimeout(150);
  const diagTxt = await pi.locator('[aria-label="诊断信息"]').innerText();
  check("试听按钮：点击后播放答对音（两个音），诊断里显示 AudioContext 状态和播放次数", (await pi.evaluate(() => window.__ac.osc)) - o2 >= 2 && /AudioContext：running/.test(diagTxt) && /已播放 [1-9]/.test(diagTxt) && /已播放答对音/.test(diagTxt), diagTxt.replace(/\n/g, " | "));
  check("诊断：显示版本、运行方式、振动接口、最近错误", /版本：/.test(diagTxt) && /运行方式：/.test(diagTxt) && /网页振动接口：/.test(diagTxt) && /最近错误：/.test(diagTxt));
  // 关闭音效后：普通点选没有声音，试听仍然能响
  await pi.locator('[data-pref="sound"]').tap();
  const o3 = await pi.evaluate(() => window.__ac.osc);
  await pi.getByRole("button", { name: "学习", exact: true }).tap(); await pi.locator(".node.current").tap(); await pi.locator(".overlay .btn3d.primary").tap(); await pi.getByRole("button", { name: "继续", exact: true }).tap(); await pi.waitForSelector("[data-check]");
  await pi.locator(".choice").first().tap(); await pi.waitForTimeout(100);
  check("音效开关关闭后：点选不再出声", (await pi.evaluate(() => window.__ac.osc)) === o3);
  await pi.getByRole("button", { name: "退出本关" }).tap(); await pi.getByRole("button", { name: "退出", exact: true }).tap();
  await pi.getByRole("button", { name: "我的" }).tap();
  await pi.locator('[data-selftest="sound"]').tap(); await pi.waitForTimeout(150);
  check("音效开关关闭后：试听按钮仍然能播放（用来区分“关了”和“坏了”）", (await pi.evaluate(() => window.__ac.osc)) - o3 >= 2);
  check("音频：整个过程没有脚本错误", ierrs.length === 0, ierrs.join("|"));
  await pi.close();
  // 假 AudioContext 只在 pointerdown 里 resume 成功时（对应第一版的错误做法）会一直 suspended——确认现在的代码不依赖 pointerdown
  const pj = await ctx.newPage();
  await pj.addInitScript(fakeAudio);
  await pj.goto(BASE); await pj.waitForSelector(".statsbar, .onboard");
  await pj.evaluate(() => { document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true })); });
  check("音频：只有 pointerdown 时不会创建也不会解锁音频（iOS 不承认它）", (await pj.evaluate(() => window.__ac.inst?.state ?? "none")) !== "running");
  await pj.evaluate(() => { document.dispatchEvent(new Event("touchend", { bubbles: true })); });
  check("音频：随后的 touchend 能解锁", (await pj.evaluate(() => window.__ac.inst?.state)) === "running");
  await pj.close();
  // 振动自测按钮：没有接口时不报错，有接口时请求一次 12ms
  const pk = await ctx.newPage();
  await pk.addInitScript(() => { window.__vib = []; navigator.vibrate = (n) => { window.__vib.push(n); return true; }; });
  await pk.goto(BASE); await pk.waitForSelector(".statsbar, .onboard");
  await pk.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await pk.getByRole("button", { name: "我的" }).tap();
  await pk.locator('[data-selftest="haptic"]').tap();
  check("试振动按钮：有接口时请求一次 12ms，并显示结果", JSON.stringify(await pk.evaluate(() => window.__vib)) === "[12]" && /已请求 12ms 振动/.test(await pk.locator('[aria-label="诊断信息"]').innerText()));
  check("振动开关：始终可以点（不再因为接口检测而被禁用）", await pk.locator('[data-pref="haptics"]').isEnabled());
  await pk.close();
  const pm = await ctx.newPage();
  await pm.addInitScript(() => { Object.defineProperty(navigator, "vibrate", { value: undefined, configurable: true }); });
  await pm.goto(BASE); await pm.waitForSelector(".statsbar, .onboard");
  await pm.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await pm.getByRole("button", { name: "我的" }).tap();
  // 第五轮 GPT 决定（取代第三轮的“始终显示”）：没有 navigator.vibrate 时用功能检测隐藏无效的振动开关和测试，只显示说明
  check("振动功能检测：没有接口时不显示振动开关、“试振动”按钮和振动测试，显示“此设备暂不支持网页触感反馈。”，诊断仍说明没有接口", (await pm.locator('[data-pref="haptics"]').count()) === 0 && (await pm.locator('[data-selftest="haptic"]').count()) === 0 && (await pm.locator("[data-haptic]").count()) === 0 && (await pm.locator("[data-no-haptics]").count()) === 1 && /此设备暂不支持网页触感反馈。/.test(await pm.locator("#app").innerText()) && /网页振动接口：没有/.test(await pm.locator('[aria-label="诊断信息"]').innerText()));
  check("振动功能检测：没有接口时音效开关仍在，答题照常（“检查”不报错）", (await pm.locator('[data-pref="sound"]').count()) === 1 && await pm.evaluate(() => { try { window.__app.feel.haptic(); return true; } catch { return false; } }));
  check("文案：不再写“iPhone 都是这样/一定没有振动”", !/iPhone 都是这样|一定没有振动/.test(await pm.locator("#app").innerText()));
  await pm.close();


  // ---------- 第三轮 P0：音频兼容性测试（iPhone 仍无声，先查原因） ----------
  {
    const wav = readFileSync(new URL("../public/sfx/test-beep.wav", import.meta.url));
    check("音频文件：test-beep.wav 是有效的 WAV（RIFF/WAVE），小于 30KB", wav.slice(0, 4).toString() === "RIFF" && wav.slice(8, 12).toString() === "WAVE" && wav.length < 30000, `${wav.length} 字节`);
    const pl = await ctx.newPage();
    const lerrs = []; pl.on("pageerror", (e) => lerrs.push(e.message));
    await pl.addInitScript(fakeAudio);
    await pl.goto(BASE); await pl.waitForSelector(".statsbar, .onboard");
    await pl.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await pl.getByRole("button", { name: "我的" }).tap();
    check("音频测试：“我的”页有 A / B / C 三个测试按钮和结果区", (await pl.locator("[data-audiotest]").count()) === 3 && (await pl.locator('[aria-label="音频测试结果"]').count()) === 1);
    const sync = await pl.evaluate(() => {
      const b = document.querySelector('[data-audiotest="webaudio"]'); const o0 = window.__ac.osc; const c0 = window.__ac.created;
      b.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return { osc: window.__ac.osc - o0, created: window.__ac.created - c0, state: window.__ac.inst.state };
    });
    check("测试 A：点击时同步新建 AudioContext 并发声（振荡器在同一个事件里就被启动，不等 Promise）", sync.osc === 1 && sync.created === 1 && sync.state === "running", JSON.stringify(sync));
    await pl.waitForTimeout(500);
    const res = await pl.locator('[aria-label="音频测试结果"]').innerText();
    check("测试 A：结果显示运行方式、音频会话、创建时状态、0.4 秒后状态和时钟", /运行方式：/.test(res) && /音频会话：/.test(res) && /\[A\] 点击内已发出声音指令；创建时 state=suspended/.test(res) && /\[A\] 0\.4 秒后 state=running/.test(res), res.replace(/\n/g, " | "));
    const syncC = await pl.evaluate(() => { const b = document.querySelector('[data-audiotest="playback"]'); const o0 = window.__ac.osc; b.dispatchEvent(new MouseEvent("click", { bubbles: true })); return window.__ac.osc - o0; });
    check("测试 C：同样在点击内同步发声", syncC === 1);
    await pl.locator('[data-audiotest="file"]').tap();
    await pl.waitForFunction(() => /\[B\] audio\.play\(\) (成功|失败)/.test(document.querySelector('[aria-label="音频测试结果"]').textContent), null, { timeout: 8000 }).catch(() => {});
    const res2 = await pl.locator('[aria-label="音频测试结果"]').innerText();
    check("测试 B：本地文件网络读取 200，并显示加载结果", /\[文件\] 网络读取 200，\d+ 字节/.test(res2) && /\[文件\] 加载成功/.test(res2), res2.replace(/\n/g, " | "));
    check("测试 B：点击后显示 readyState，并报告 audio.play() 成功或失败（含具体错误）", /\[B\] 点击：readyState=\d/.test(res2) && /\[B\] audio\.play\(\) (成功|失败：\w+：)/.test(res2), res2.replace(/\n/g, " | "));
    check("音频测试：整个过程没有脚本错误", lerrs.length === 0, lerrs.join("|"));
    await pl.close();
  }


  // ---------- 第三轮：正式关卡的声音（游戏按钮改为真正的 click）和振动测试 ----------
  {
    const pf = await ctx.newPage();
    const ferrs = []; pf.on("pageerror", (e) => ferrs.push(e.message));
    await pf.addInitScript(fakeAudio);
    await pf.goto(BASE); await pf.waitForSelector(".statsbar, .onboard");
    await pf.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.hearts = 5; s.prefs.sound = true; window.__app.setState(s); window.__app.persist(); window.__app.renderPath(); });
    // 游戏按钮只响应 click：只有 pointerdown 时不会触发（否则声音会发生在 iOS 不承认的操作里）
    await pf.locator(".node.current").tap(); await pf.locator(".overlay .btn3d.primary").tap(); await pf.getByRole("button", { name: "继续", exact: true }).tap(); await pf.waitForSelector("[data-check]");
    await pf.evaluate(() => document.querySelector(".choice").dispatchEvent(new PointerEvent("pointerdown", { button: 0, bubbles: true, cancelable: true })));
    check("游戏按钮：只有 pointerdown 不会触发选择（必须是真正的 click）", (await pf.locator(".choice.sel").count()) === 0);
    // 完整做一题：声音全部发生在 click 之后，且 AudioContext 已 running
    const f0 = await pf.evaluate(() => window.__ac.osc);
    await pf.locator(".choice").first().tap();
    const f0b = await pf.evaluate(() => ({ osc: window.__ac.osc, st: window.__ac.inst?.state, ev: window.__ac.resumeEvents, log: window.__app.feel.log.slice(-4) }));
    check("正式关卡：点选时合成了声音，AudioContext 是 running", f0b.osc > f0 && f0b.st === "running", JSON.stringify({ f0, ...f0b }));
    const f1 = await pf.evaluate(() => window.__ac.osc);
    await pf.locator("[data-check]").tap(); await pf.waitForSelector(".feedbar"); await pf.waitForTimeout(80);
    check("正式关卡：检查后 120ms 的结果音在 running 状态下播放", (await pf.evaluate(() => window.__ac.osc)) - f1 >= 2);
    // 回到“我的”：正式音效试听、诊断
    await pf.locator("[data-continue]").tap(); await pf.getByRole("button", { name: "退出本关" }).tap(); await pf.getByRole("button", { name: "退出", exact: true }).tap();
    await pf.getByRole("button", { name: "我的" }).tap();
    check("我的：有 6 个正式音效试听按钮", (await pf.locator("[data-sound]").count()) === 6);
    const f2 = await pf.evaluate(() => window.__ac.osc);
    await pf.locator('[data-sound="correct"]').tap(); await pf.waitForTimeout(100);
    const fd = await pf.locator('[aria-label="诊断信息"]').innerText();
    check("正式音效试听：点“答对”播放两个音，并报告已播放", (await pf.evaluate(() => window.__ac.osc)) - f2 >= 2 && /正式音效「答对」：已播放/.test(fd), fd.replace(/\n/g, " | "));
    check("诊断：显示解锁尝试次数和状态变化", /解锁尝试 \d+ 次/.test(fd) && /状态变化：.*创建:suspended/.test(fd), fd.replace(/\n/g, " | "));
    // 振动测试：四种独立控件，只记录点击，不宣布成功
    check("振动测试：四种控件（普通按钮、原生开关、选项、检查按钮样式）都在", (await pf.locator("[data-haptic]").count()) === 5 && (await pf.locator('input[switch][data-haptic="switch"]').count()) === 1 && (await pf.locator('input[switch][data-haptic="check-label"]').count()) === 1);
    await pf.locator('[data-haptic="button"]').tap(); await pf.locator('[data-haptic="choice"]').tap();
    await pf.locator('[data-haptic="switch"]').tap(); await pf.locator('[data-haptic="check-label"]').tap({ force: true });
    const hl = await pf.locator('[aria-label="振动测试结果"]').innerText();
    check("振动测试：四种控件的点击都被记录，并标注“等待 iPhone 真机确认”（不凭接口返回值宣布成功）", /1 普通按钮：点了 1 次/.test(hl) && /2 原生开关：点了 1 次/.test(hl) && /3 选项样式：点了 1 次/.test(hl) && /4 检查按钮样式：点了 1 次/.test(hl) && /等待 iPhone 真机确认/.test(hl) && !/振动成功/.test(hl), hl.replace(/\n/g, " | "));
    check("正式关卡声音：整个过程没有脚本错误", ferrs.length === 0, ferrs.join("|"));
    await pf.close();
  }


  // ---------- 按键音效：J 默认，A–J 可选，选中的风格用在答题里 ----------
  {
    const EVS = ["select", "place", "undo", "correct", "wrong", "finish"];
    const pk2 = await ctx.newPage();
    const kerrs = []; pk2.on("pageerror", (e) => kerrs.push(e.message));
    await pk2.addInitScript(fakeAudio);
    await pk2.goto(BASE); await pk2.waitForSelector(".statsbar, .onboard");
    // 旧 v3 记录（没有 soundStyle，带着试听阶段的 keySound）：默认 J，学习进度保留
    await pk2.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.xp = 77; delete s.prefs.soundStyle; s.prefs.keySound = "B"; s.prefs.sound = true; localStorage.setItem("suipian.progress", JSON.stringify(s)); });
    await pk2.reload(); await pk2.waitForSelector(".statsbar");
    check("按键音效：旧记录没有这一项时默认 J，进度保留，旧试听字段被丢弃", await pk2.evaluate(() => { const s = window.__app.getState(); return s.prefs.soundStyle === "J" && s.xp === 77 && !("keySound" in s.prefs); }));
    await pk2.getByRole("button", { name: "我的" }).tap();
    check("按键音效：A–J 十个按钮，J 高亮并标“默认”，状态写明当前是 J", (await pk2.locator("[data-keysound]").count()) === 10 && (await pk2.evaluate(() => [...document.querySelectorAll("[data-keysound]")].map((b) => b.dataset.keysound).join(""))) === "ABCDEFGHIJ" && (await pk2.locator('[data-keysound="J"]').getAttribute("aria-pressed")) === "true" && (await pk2.locator(".keybtn.sel").count()) === 1 && /当前按键音效：J 极简 Tap（默认）/.test(await pk2.locator(".keylab-status").innerText()));
    // 实测每个风格的六种声音
    const meas = await pk2.evaluate(async (evs) => { const k = await window.__app.keysounds(); const out = {}; for (const { id } of k.KEY_SOUNDS) { out[id] = {}; for (const e of evs) out[id][e] = await k.measureKey(id, e); } return out; }, EVS);
    const ids = Object.keys(meas);
    check("按键音效：十个风格的“点选”都是 40–100 毫秒", ids.every((i) => meas[i].select.ms >= 40 && meas[i].select.ms <= 100), ids.map((i) => `${i}${meas[i].select.ms}`).join(" "));
    check("按键音效：60 种声音都有声、有限、不削波", ids.every((i) => EVS.every((e) => meas[i][e].rms > 0.005 && Number.isFinite(meas[i][e].rms) && meas[i][e].peak > 0.05 && meas[i][e].peak < 0.95)), ids.flatMap((i) => EVS.filter((e) => !(meas[i][e].rms > 0.005 && meas[i][e].peak < 0.95)).map((e) => `${i}.${e}:${meas[i][e].peak.toFixed(2)}`)).join(" "));
    const spread = (e) => { const d = ids.map((i) => 20 * Math.log10(meas[i][e].rms)); return Math.max(...d) - Math.min(...d); };
    check("按键音效：同一种声音在十个风格之间响度接近（点选 ≤ 1dB，其余 ≤ 2.5dB）", spread("select") <= 1 && EVS.every((e) => spread(e) <= 2.5), EVS.map((e) => `${e}${spread(e).toFixed(1)}`).join(" "));
    const within = ids.every((i) => { const d = ["select", "place", "undo"].map((e) => 20 * Math.log10(meas[i][e].rms)); return Math.max(...d) - Math.min(...d) <= 3; });
    check("按键音效：同一风格里点选、放入、撤销响度接近（≤ 3dB），像同一把键盘", within);
    check("按键音效：答对、答错、过关比点选长，过关最长", ids.every((i) => meas[i].correct.ms > meas[i].select.ms && meas[i].wrong.ms > meas[i].select.ms && meas[i].finish.ms > meas[i].correct.ms), ids.map((i) => `${i}:${meas[i].select.ms}/${meas[i].correct.ms}/${meas[i].finish.ms}`).join(" "));
    check("按键音效：十个风格互不相同", new Set(ids.map((i) => `${meas[i].select.ms}-${meas[i].select.peak.toFixed(3)}`)).size === 10);
    // 选 B：高亮、保存、立刻用于游戏
    await pk2.locator('[data-keysound="B"]').tap();
    check("按键音效：点 B 后高亮、保存到本机，feel 也换成 B", (await pk2.locator('[data-keysound="B"]').getAttribute("aria-pressed")) === "true" && (await pk2.locator(".keybtn.sel").count()) === 1 && (await pk2.evaluate(() => window.__app.getState().prefs.soundStyle)) === "B" && (await pk2.evaluate(() => window.__app.feel.currentStyle())) === "B" && /当前按键音效：B 奶油矮轴/.test(await pk2.locator(".keylab-status").innerText()) && !/默认/.test(await pk2.locator(".keylab-status").innerText()));
    // 答题时用的是当前风格：把 renderEvent 记下来看用的是哪个风格
    await pk2.evaluate(() => { window.__styleLog = []; const f = window.__app.feel; const orig = f.playStyle; window.__origPlay = f.play; });
    const st0 = await pk2.evaluate(() => window.__ac.src || 0);
    await pk2.evaluate(() => window.__app.feel.play("select"));
    const st1 = await pk2.evaluate(() => window.__ac.src || 0);
    check("按键音效：答题声音（feel.play）真的用风格合成（噪声“嗒”+“笃”），不再是旧的纯音", st1 > st0);
    const burst = await pk2.evaluate(() => { const f = window.__app.feel; let m = 0; for (let i = 0; i < 80; i++) { f.playStyle("A", "finish"); m = Math.max(m, f.activeCount()); } return m; });
    check("按键音效：连续快速触发 80 次“过关”，同时发声不超过 3 个", burst <= 3, `max=${burst}`);
    await pk2.locator('[data-keysound="A"]').tap();
    await pk2.reload(); await pk2.waitForSelector(".statsbar");
    await pk2.getByRole("button", { name: "我的" }).tap();
    check("按键音效：刷新后选择仍在（A 是最后一次点的）", (await pk2.evaluate(() => window.__app.getState().prefs.soundStyle)) === "A" && (await pk2.locator('[data-keysound="A"]').getAttribute("aria-pressed")) === "true" && (await pk2.evaluate(() => window.__app.feel.currentStyle())) === "A");
    // 坏数据：不认识的风格回到 J
    await pk2.evaluate(() => { const s = JSON.parse(localStorage.getItem("suipian.progress")); s.prefs.soundStyle = "Z"; localStorage.setItem("suipian.progress", JSON.stringify(s)); });
    await pk2.reload(); await pk2.waitForSelector(".statsbar");
    check("按键音效：存档里的风格不认识时回到 J", (await pk2.evaluate(() => window.__app.getState().prefs.soundStyle)) === "J" && (await pk2.evaluate(() => window.__app.feel.currentStyle())) === "J");
    // 在关卡里：选 D 后做一题，点选/检查都用 D（日志里是 select/correct 等事件名），流程不变
    await pk2.evaluate(() => { const s = window.__app.getState(); s.prefs.soundStyle = "D"; s.prefs.sound = true; s.hearts = 5; window.__app.setState(s); window.__app.persist(); window.__app.renderPath(); });
    await pk2.locator(".node.current").tap(); await pk2.locator(".overlay .btn3d.primary").tap(); await pk2.getByRole("button", { name: "继续", exact: true }).tap(); await pk2.waitForSelector("[data-check]");
    const a0 = await pk2.evaluate(() => window.__ac.osc);
    await pk2.locator(".choice").first().tap();
    check("按键音效：关卡里选 D，点选发出声音且 AudioContext 在 running", (await pk2.evaluate(() => window.__ac.osc)) > a0 && (await pk2.evaluate(() => window.__ac.inst.state)) === "running");
    await pk2.locator("[data-check]").tap(); await pk2.waitForSelector(".feedbar");
    check("按键音效：检查后有答对/答错音，且仍是 D", (await pk2.evaluate(() => window.__app.feel.log.some((n) => n === "correct" || n === "wrong"))) && (await pk2.evaluate(() => window.__app.feel.currentStyle())) === "D");
    check("按键音效：没有脚本错误", kerrs.length === 0, kerrs.join("|"));
    await pk2.close();
  }

  // ---------- 第 2 单元：解锁、通关、保存 ----------
  {
    const pu = await ctx.newPage();
    const uerrs = []; pu.on("pageerror", (e) => uerrs.push(e.message));
    await pu.goto(BASE); await pu.waitForSelector(".statsbar, .onboard");
    const seed = (done, extra = {}) => pu.evaluate(([d, x]) => { const s = window.__app.getState(); Object.assign(s, { onboarded: true, hearts: 5, done: Object.fromEntries(d.map((k) => [k, true])), prefs: { ...s.prefs, sound: false } }, x); localStorage.setItem("suipian.progress", JSON.stringify(s)); }, [done, extra]);
    const U1 = ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"];
    const cls = (id) => pu.locator(`[data-lesson="${id}"]`).getAttribute("class");
    // 1) 第 1 单元只完成 5 关：第 2 单元全部锁着
    await seed(U1.slice(0, 5)); await pu.reload(); await pu.waitForSelector(".statsbar");
    check("第 2 单元：第 1 单元没通关时，U2L1 是锁定状态", (await cls("U2L1")).includes("locked") && (await cls("U1L6")).includes("current"));
    await pu.locator('[data-lesson="U2L1"]').tap();
    check("第 2 单元：点锁定的 U2L1 提示先完成前面的关卡", /先完成前面的关卡/.test(await pu.locator(".overlay").innerText()));
    await pu.getByRole("button", { name: "知道了", exact: true }).tap();
    // 2) 已完成第 1 单元的旧用户（带 XP、连续天数）：刷新后自动看到 U2L1 为当前关，进度不清空
    await seed(U1, { xp: 330, streak: 3, lastDay: "2026-11-01", lessonsCompleted: 6 }); await pu.reload(); await pu.waitForSelector(".statsbar");
    const mapText = await pu.locator("#app").innerText();
    check("第 2 单元：第 1 单元通关后，U2L1 自动成为当前关，其余 4 关锁定", (await cls("U2L1")).includes("current") && ["U2L2", "U2L3", "U2L4", "U2L5"].every(async () => true) && (await Promise.all(["U2L2", "U2L3", "U2L4", "U2L5"].map(cls))).every((c) => c.includes("locked")));
    check("第 2 单元：旧记录不清空（XP、连续天数、第 1 单元完成状态都在）", await pu.evaluate(() => { const s = window.__app.getState(); return s.xp === 330 && s.streak === 3 && ["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6"].every((k) => s.done[k]); }));
    check("地图：第 2 单元标题“文字与长度”，第 1 单元显示“已完成”，只有第 8 单元显示“即将推出”", /文字与长度/.test(mapText) && /第 1 单元 · 已完成/.test(mapText) && !/第 2 单元 · 已完成/.test(mapText) && (mapText.match(/即将推出/g) || []).length === 1 && !/第 3 单元 · 即将推出/.test(mapText) && !/第 2 单元 · 即将推出/.test(mapText));
    // 3) 通关 5 关：每关 4 题全对，XP = 4×10 + 10，逐关解锁
    const startL = async (id) => { await pu.locator(`[data-lesson="${id}"]`).tap(); await pu.locator(".overlay .btn3d.primary").tap(); await pu.waitForSelector(".intro-title"); };
    const playU = async (wrongFirst = 0) => {
      await pu.getByRole("button", { name: "继续", exact: true }).tap();
      let wrongs = wrongFirst, n = 0;
      while (await pu.locator("[data-check]").count()) {
        const e = await pu.evaluate(() => window.__app.currentEx); const correct = wrongs-- <= 0;
        if (e.type === "predict") await pu.locator(".choice").nth(e.options.findIndex((o) => !!o.correct === correct)).tap();
        else if (e.type === "fill") { const toks = correct ? e.answer : [e.tokens.find((t) => !e.answer.includes(t) && !(e.initial || []).includes(t)) ?? e.tokens.find((t) => !e.answer.includes(t))]; for (const t of toks) await pu.locator(`[data-token=${JSON.stringify(t)}]`).tap(); }
        else for (const k of correct ? e.answers[0] : [...e.answers[0]].reverse()) await pu.locator(`.order-bank [data-line="${k}"]`).first().tap();
        await pu.locator("[data-check]").tap(); await pu.waitForSelector(".feedbar");
        await pu.locator("[data-continue]").tap();
        if (++n > 30) throw new Error("第 2 单元做题循环过多");
      }
    };
    let xp0 = 330;
    for (const [i, id] of ["U2L1", "U2L2", "U2L3", "U2L4", "U2L5"].entries()) {
      await startL(id);
      check(`第 2 单元：${id} 的开场介绍显示标题和示例代码`, (await pu.locator(".intro-title").innerText()) === L2[i].title && (await pu.locator(".intro-screen").innerText()).replace(/\s|\d+(?=\D)/g, "").length > 5);
      await playU(id === "U2L3" ? 1 : 0); // U2L3 故意答错一次：红心 -1，错题回炉后仍能通关
      await pu.waitForSelector(".finish");
      const s = await pu.evaluate(() => window.__app.getState());
      const wrongExtra = id === "U2L3" ? 1 : 0;
      check(`第 2 单元：${id} 通关，完成状态已保存，XP 按 4×10+10 增加`, s.done[id] === true && s.xp - xp0 === 50 && s.hearts === 5 - wrongExtra, `xp+${s.xp - xp0} hearts=${s.hearts}`);
      xp0 = s.xp;
      await pu.locator("[data-continue]").tap(); await pu.waitForSelector(".pathview");
      if (i < 4) check(`第 2 单元：${id} 通关后下一关成为当前关`, (await cls(id)).includes("done") && (await cls(L2[i + 1].id)).includes("current"));
      if (id === "U2L3") await pu.evaluate(() => { const s = window.__app.getState(); s.hearts = 5; window.__app.persist(); });
    }
    const doneText = await pu.locator("#app").innerText();
    check("第 2 单元：全部通关后显示“已完成”，U3L1 成为当前关，只有第 8 单元“即将推出”", /第 2 单元 · 已完成/.test(doneText) && (doneText.match(/即将推出/g) || []).length === 1 && !/第 3 单元 · 即将推出/.test(doneText) && (await cls("U3L1")).includes("current"));
    await pu.reload(); await pu.waitForSelector(".statsbar");
    const afterReload = await pu.evaluate(() => window.__app.getState());
    check("第 2 单元：刷新后 5 关完成状态和 XP 仍在", ["U2L1", "U2L2", "U2L3", "U2L4", "U2L5"].every((k) => afterReload.done[k]) && afterReload.xp === xp0 && /第 2 单元 · 已完成/.test(await pu.locator("#app").innerText()));
    // 4) 复习已完成的关卡
    await pu.locator('[data-lesson="U2L5"]').tap();
    check("第 2 单元：已完成的 U2L5 可以复习（不扣红心）", /复习（不扣红心/.test(await pu.locator(".overlay").innerText()));
    await pu.getByRole("button", { name: "关闭", exact: true }).tap();
    // 5) 小屏幕上代码块和选项不横向溢出
    await pu.setViewportSize({ width: 320, height: 640 });
    await seed(U1); await pu.reload(); await pu.waitForSelector(".statsbar");
    await seed([...U1, "U2L1", "U2L2", "U2L3"]); await pu.reload(); await pu.waitForSelector(".statsbar"); await startL("U2L4"); await pu.getByRole("button", { name: "继续", exact: true }).tap(); await pu.waitForSelector("[data-check]");
    check("第 2 单元：320px 宽度下做题页没有横向溢出", !(await pu.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
    check("第 2 单元：整个过程没有脚本错误", uerrs.length === 0, uerrs.join("|"));
    await pu.close();
  }

  // 宽度
  for (const w of [320, 360, 390, 430]) {
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
  await server.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
