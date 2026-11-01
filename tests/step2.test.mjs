// 第二步的自动测试：N01 一节课从头学到尾。桌面 Chromium 模拟手机触摸，不能代替 iPhone 真机。
// 运行：npm run build && node tests/step2.test.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { checkOutput, checkExact, checkSelfIntro } from "../src/checker.js";

const lesson = JSON.parse(readFileSync(new URL("../content/n01.json", import.meta.url)));
const PORT = 4319;
const BASE = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

// ---------- 判分逻辑（纯函数，不需要浏览器） ----------
check("判分：完全一致通过", checkExact("Hi\n", "Hi").pass);
check("判分：没有输出时提示用 print", /没有输出/.test(checkExact("", "Hi").message));
check("判分：顺序反了时说明执行顺序", /顺序不对/.test(checkExact("b\na\n", "a\nb").message));
check("判分：少一行时说明行数", /应该输出 2 行/.test(checkExact("a\n", "a\nb").message));
check("判分：指出具体哪一行不对", /第 2 行应该是「b」/.test(checkExact("a\nc\n", "a\nb").message));
check("判分：不删除行内空格", !checkExact("H i\n", "Hi").pass && /空格/.test(checkExact("H i\n", "Hi").message));
const order = ["name", "hobby", "intro"];
check("小任务：正确的自我介绍通过", checkSelfIntro("小红\n爱好：跑步\n我是小红。\n", order).pass);
check("小任务：英文冒号也接受", checkSelfIntro("Tom\n爱好:游泳\n你好\n", order).pass);
check("小任务：行数不对", /正好输出 3 行/.test(checkSelfIntro("a\nb\n", order).message));
check("小任务：爱好位置不对时说明顺序", /应该在第 2 行/.test(checkSelfIntro("爱好：画画\n小明\n你好\n", order).message));
check("小任务：缺少「爱好：」", /要以「爱好：」开头/.test(checkSelfIntro("小明\n画画\n你好\n", order).message));
check("小任务：变化题要求爱好在第 1 行", checkSelfIntro("爱好：画画\n小明\n你好\n", ["hobby", "name", "intro"]).pass);

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__app?.runner?.state === "ready", null, { timeout: 60000 });

  // ---------- 内容校验：每个例子、答案都真实运行一遍 ----------
  const runPy = (code) => page.evaluate((c) => new Promise((resolve) => {
    const r = window.__app.runner;
    let out = "";
    const po = r.onOutput, ps = r.onStatus;
    r.onOutput = (t) => { out += t; };
    r.onStatus = (s, info) => { if (s === "done") { r.onOutput = po; r.onStatus = ps; ps(s, info); resolve({ out, error: info.error }); } };
    r.run(c);
  }), code);
  for (const c of lesson.cards) {
    const r = await runPy(c.example.code);
    check(`内容：讲解卡「${c.title}」的运行结果与实际一致`, !r.error && checkExact(r.out, c.example.output).pass, JSON.stringify(r.out));
  }
  const e1 = lesson.exercises[0];
  const r1 = await runPy(e1.code);
  check("内容：E1 正确选项与实际输出一致", checkExact(r1.out, e1.options.find((o) => o.correct).text).pass);
  check("内容：E1 每个错误选项都与实际输出不同", e1.options.filter((o) => !o.correct).every((o) => !checkExact(r1.out, o.text).pass));
  for (const ex of [...lesson.exercises.slice(1), lesson.task, lesson.taskVariant]) {
    const r = await runPy(ex.solution);
    check(`内容：${ex.id} 参考答案能通过判分`, !r.error && checkOutput(ex.check, r.out).pass, JSON.stringify(r.out));
    check(`内容：${ex.id} 第 3 级提示就是参考答案`, ex.hints[2].includes(ex.solution.split("\n")[0]));
  }
  if (lesson.exercises[1].initialCode) {
    const r = await runPy(lesson.exercises[1].initialCode);
    check("内容：E2 初始代码本身不能直接通过", !checkOutput(lesson.exercises[1].check, r.out || "").pass);
  }

  // ---------- 学习流程 ----------
  const text = () => page.locator("#app").innerText();
  const tapText = (t) => page.getByRole("button", { name: t, exact: true }).first().tap();
  const key = (k) => page.locator(`.kb-key[data-key=${JSON.stringify(k)}]`).first();
  const setDoc = (t) => page.evaluate((t) => { const v = window.__app.view; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t }, selection: { anchor: t.length } }); }, t);
  const doc = () => page.evaluate(() => window.__app.view.state.doc.toString());
  const feedback = () => page.locator(".feedback").first().innerText();
  const checkAndWait = async () => {
    await page.locator("#check").tap();
    await page.waitForFunction(() => { const f = document.querySelector(".feedback"); return f && f.textContent.trim().length > 0; }, null, { timeout: 20000 });
    return feedback();
  };

  check("首页：显示课程和开始按钮", /输出与执行顺序/.test(await text()) && /开始学习/.test(await text()));
  await tapText("开始学习");
  check("讲解 1/3：输出是什么", /讲解 1\/3/.test(await text()) && /输出是什么/.test(await text()));
  check("讲解卡：代码和运行结果紧挨着显示", (await page.locator(".example pre.code").count()) === 1 && (await page.locator(".example pre.result").count()) === 1);
  await page.getByRole("button", { name: "查看 print 的词义" }).first().tap();
  const wordText = await page.locator(".overlay").innerText();
  check("词义卡：有音标、意思和用途", /\/prɪnt\//.test(wordText) && /打印/.test(wordText) && /在 Python 里/.test(wordText));
  await page.locator(".overlay [data-close]").tap();
  check("词义卡可以关闭", (await page.locator(".overlay").count()) === 0);
  await tapText("Next");
  check("讲解 2/3：解释括号和引号", /括号/.test(await text()) && /引号/.test(await text()));
  await tapText("Next");
  check("讲解 3/3：执行顺序", /从上往下/.test(await text()));
  await tapText("Next");

  // E1 选择题
  check("练习 1/3：选择题", /练习 1\/3/.test(await text()));
  check("选择题未答对前 Next 不可用", await page.getByRole("button", { name: "Next" }).isDisabled());
  await page.locator(".option").nth(1).tap(); // 选错：顺序反了
  let fb = await feedback();
  check("选错：解释具体原因（顺序）", /✗/.test(fb) && /从上往下/.test(fb), fb.slice(0, 40));
  await page.locator(".option").nth(3).tap(); // 选错：把代码当输出
  fb = await feedback();
  check("选错：解释 print 和引号不会显示", /不会显示/.test(fb));
  await page.locator(".option").nth(0).tap();
  fb = await feedback();
  check("选对：显示正确并可以继续", /✓/.test(fb) && !(await page.getByRole("button", { name: "Next" }).isDisabled()));
  await tapText("Next");

  // E2 补全代码
  check("练习 2/3：补全代码，初始为 print()", /练习 2\/3/.test(await text()) && (await doc()) === "print()");
  const kbPos = async () => page.evaluate(() => Math.round(document.getElementById("keyboard").getBoundingClientRect().bottom));
  const before = await kbPos();
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(200);
  check("键盘固定在屏幕底部，页面滚动时不移动", before === (await kbPos()) && before >= 800 && (await page.evaluate(() => window.scrollY)) === 0, `bottom=${before}`);
  check("光标在括号里面", await page.evaluate(() => window.__app.view.state.selection.main.head === 6));
  await setDoc("print(Hi)");
  fb = await checkAndWait();
  check("忘了引号：解释要用引号包起来", /✗/.test(fb) && /引号/.test(fb), fb.slice(0, 60));
  await setDoc("print(“Hi”)");
  fb = await checkAndWait();
  check("中文引号：提示要用英文半角符号", /中文符号/.test(fb), fb.slice(0, 60));
  await setDoc("print()");
  await page.evaluate(() => { const v = window.__app.view; v.dispatch({ selection: { anchor: 6 } }); });
  for (const k of ['"', "{shift}", "h", "i"]) await key(k).tap();
  check("用内置键盘补全为 print(\"Hi\")", (await doc()) === 'print("Hi")', await doc());
  // 查看讲解后回来，代码保留
  await tapText("查看讲解");
  check("练习中可以打开讲解", /执行顺序是什么/.test(await page.locator(".overlay").innerText()));
  await page.locator(".overlay [data-close]").tap();
  check("关闭讲解后代码保留", (await doc()) === 'print("Hi")');
  fb = await checkAndWait();
  check("E2 通过", /✓ 通过/.test(fb), fb.slice(0, 30));
  await tapText("Next");

  // E3 修改代码（中文）
  check("练习 3/3：初始代码是 Hello/World", /练习 3\/3/.test(await text()) && (await doc()) === 'print("Hello")\nprint("World")');
  await setDoc('print("一行一行执行")\nprint("我在学编程")');
  fb = await checkAndWait();
  check("E3 顺序反了：说明执行顺序", /顺序不对/.test(fb), fb.slice(0, 40));
  await setDoc('print("我在学编程")\nprint("一行一行执行")');
  fb = await checkAndWait();
  check("E3 通过", /✓ 通过/.test(fb));

  // 中途离开再回来：位置和草稿都保留
  await tapText("Next");
  check("进入小任务，编辑区为空", /小任务/.test(await text()) && (await doc()) === "");
  await setDoc('print("小明")\nprint("爱好：画画")');
  await page.waitForTimeout(500); // 草稿防抖保存
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#app")?.innerText.includes("继续学习"));
  check("重新打开：首页显示继续学习和当前位置", /继续学习/.test(await text()) && /小任务/.test(await text()));
  await tapText("继续学习");
  await page.waitForFunction(() => window.__app?.runner?.state === "ready", null, { timeout: 60000 });
  check("重新打开：小任务草稿还在", (await doc()) === 'print("小明")\nprint("爱好：画画")', JSON.stringify(await doc()));

  fb = await checkAndWait();
  check("小任务只写两行：说明需要 3 行", /正好输出 3 行/.test(fb), fb.slice(0, 40));
  await setDoc('print("小明")\nprint("爱好：画画")\nprint("我是小明，正在学 Python。")');
  fb = await checkAndWait();
  check("小任务通过（没看答案）", /✓ 通过/.test(fb) && !/再做一个小变化/.test(fb));
  await tapText("Next");
  check("没看答案：直接到完成页，不需要变化题", /N01 完成/.test(await text()));
  check("完成页列出已完成的题目", (await page.locator(".summary li").count()) === 4);
  check("完成页记录第一次答错的题", /第一次答错/.test(await text()));
  check("完成页给出添加到主屏幕的说明", /添加到主屏幕/.test(await text()));

  // 看过答案 → 需要变化题
  await tapText("Back");
  await page.waitForFunction(() => !!window.__app.view);
  await page.evaluate(() => { const st = window.__app.getState(); delete st.done.T1; });
  await tapText("Back"); await tapText("Next"); // 重新进入小任务页
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Hint/ }).first().tap();
  check("三级提示：最后一级显示参考答案", /参考答案/.test(await text()));
  fb = await checkAndWait();
  check("看过答案后通过：要求再做一个变化", /再做一个小变化/.test(fb), fb.slice(0, 50));
  await tapText("Next");
  check("进入变化题，并从上一题代码开始", /小任务 · 变化/.test(await text()) && (await doc()).startsWith('print("小明")'));
  await page.evaluate(() => { const v = window.__app.view; const t = 'print("爱好：画画")\nprint("小明")\nprint("我是小明，正在学 Python。")'; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t } }); });
  fb = await checkAndWait();
  check("变化题通过", /✓ 通过/.test(fb));
  await tapText("Next");
  check("完成页标注看过答案", /看过答案/.test(await text()));

  // 宽度检查
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    const over = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    check(`完成页 ${w}px 无横向溢出`, !over);
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // 清除记录：取消不变，确定后回到初始
  await tapText("回到首页");
  await tapText("清除学习记录");
  await tapText("取消");
  check("清除记录：取消后记录不变", /已完成/.test(await text()));
  await tapText("清除学习记录");
  await tapText("确定清除");
  check("清除记录：确认后回到未开始", /未开始/.test(await text()) && /开始学习/.test(await text()));

  // 存储不可用：给出提示，页面仍可用
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("quota"); }; });
  await p2.goto(BASE);
  await p2.getByRole("button", { name: "开始学习" }).tap();
  const toast = await p2.locator(".toast").innerText().catch(() => "");
  check("存储写入失败：显示无法保存的提示，页面不白屏", /无法保存进度/.test(toast) && /讲解 1\/3/.test(await p2.locator("#app").innerText()));
  await p2.close();

  // 记录损坏：安全恢复
  const p3 = await ctx.newPage();
  await p3.addInitScript(() => { try { localStorage.setItem("suipian.progress", "{坏掉的数据"); } catch {} });
  await p3.goto(BASE);
  check("记录损坏：提示并从头开始，不白屏", /记录损坏/.test(await p3.locator("#app").innerText()) && /开始学习/.test(await p3.locator("#app").innerText()));
  await p3.close();

  // 截图（每种页面一张，方便人工看）
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: "tests/shot-home.png" });
  await tapText("开始学习"); await tapText("Next");
  await page.screenshot({ path: "tests/shot-card2.png", fullPage: true });
  await tapText("Next"); await tapText("Next");
  await page.screenshot({ path: "tests/shot-choice.png", fullPage: true });
  await page.locator(".option").nth(0).tap(); await tapText("Next");
  await page.screenshot({ path: "tests/shot-code.png" });

  check("页面无脚本错误", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
