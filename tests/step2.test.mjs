// 第二步的自动测试：教程式第一课「输出、变量和简单运算」。
// 桌面 Chromium 模拟手机触摸，不能代替 iPhone 真机。运行：npm run build && node tests/step2.test.mjs
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { checkOutput, checkExact } from "../src/checker.js";

const L = JSON.parse(readFileSync(new URL("../content/l01.json", import.meta.url)));
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

const reading = L.pages.filter((p) => p.kind !== "exercise");
const exercises = L.pages.filter((p) => p.kind === "exercise");
const examples = reading.flatMap((p) => p.blocks.filter((b) => b.t === "code"));

// ---------- 内容结构（不需要浏览器） ----------
check("内容：课程路线里第一课可用，且只出现一次", course.lessons.filter((c) => c.id === L.id).length === 1 && course.lessons[0].available);
check("内容：第一课包含 4 段正文和 2 道练习", reading.length === 4 && exercises.length === 2);
check("内容：练习排在相关正文之后（变量讲完才练变量）", L.pages.findIndex((p) => p.id === "X1") > L.pages.findIndex((p) => p.id === "P2") && L.pages.at(-1).id === "X2");
check("内容：每页 id 不重复", new Set(L.pages.map((p) => p.id)).size === L.pages.length);
check("内容：每个例子 id 不重复", new Set(examples.map((b) => b.id)).size === examples.length);
const seen = new Set();
let conceptOrderOk = true;
for (const p of reading) {
  const text = p.blocks.filter((b) => b.t !== "code").map((b) => b.text).join("");
  for (const b of p.blocks) {
    if (b.t === "p" || b.t === "tip") { if (/=/.test(b.text)) seen.add("="); if (/\*/.test(b.text)) seen.add("*"); if (/逗号/.test(b.text)) seen.add(","); }
    if (b.t === "code") {
      if (/ = /.test(b.code) && !seen.has("=")) conceptOrderOk = false;
      if (/\*/.test(b.code) && !seen.has("*")) conceptOrderOk = false;
      if (/print\([^)]*,/.test(b.code) && !seen.has(",")) conceptOrderOk = false;
    }
  }
  void text;
}
check("内容：= 、* 、逗号都在例子用到之前先解释", conceptOrderOk);

// ---------- 判分逻辑 ----------
const x2 = exercises.find((e) => e.id === "X2");
check("判分：输出对但没存变量，先提示 price = 35", /price = 35/.test(checkOutput(x2.check, "总价 140\n", 'print("总价", 140)').message));
check("判分：存了变量但没用乘法，提示 price * count", /price \* count/.test(checkOutput(x2.check, "总价 140\n", 'price = 35\ncount = 4\nprint("总价", 140)').message));
check("判分：正确写法通过", checkOutput(x2.check, "总价 140\n", "price = 35\ncount = 4\nprint(\"总价\", price * count)").pass);
check("判分：另一种正确写法（先算 total）也通过", checkOutput(x2.check, "总价 140\n", "price = 35\ncount = 4\ntotal = count * price\nprint(\"总价\", total)").pass);
check("判分：输出不对时仍先说明输出问题", /第 1 行应该是「总价 140」/.test(checkExact("总价140\n", "总价 140").message));

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE);
  await page.waitForFunction(() => window.__app?.runner?.state === "ready", null, { timeout: 60000 });

  // ---------- 内容核对：每个例子、每个参考答案都真实运行 ----------
  const runPy = (code) => page.evaluate((c) => new Promise((resolve) => {
    const r = window.__app.runner;
    let out = "";
    const po = r.onOutput, ps = r.onStatus;
    r.onOutput = (t) => { out += t; };
    r.onStatus = (s, info) => { if (s === "done") { r.onOutput = po; r.onStatus = ps; ps(s, info); resolve({ out, error: info.error }); } };
    r.run(c);
  }), code);
  for (const b of examples) {
    const r = await runPy(b.code);
    check(`内容：例子 ${b.id} 显示的运行结果与真实运行一致`, !r.error && checkExact(r.out, b.output).pass, JSON.stringify(r.out));
  }
  for (const ex of exercises) {
    const r = await runPy(ex.solution);
    check(`内容：${ex.id} 参考答案能通过判分`, !r.error && checkOutput(ex.check, r.out, ex.solution).pass, JSON.stringify(r.out));
    check(`内容：${ex.id} 最后一级提示就是参考答案`, ex.hints.at(-1).includes(ex.solution.split("\n")[0]));
  }

  // ---------- 学习流程 ----------
  const text = () => page.locator("#app").innerText();
  const tapText = (t) => page.getByRole("button", { name: t, exact: true }).first().tap();
  const setDoc = (t) => page.evaluate((t) => { const v = window.__app.view; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t }, selection: { anchor: t.length } }); }, t);
  const doc = () => page.evaluate(() => window.__app.view.state.doc.toString());
  const feedback = () => page.locator(".feedback").first().innerText();
  const key = (k) => page.locator(`.kb-key[data-key=${JSON.stringify(k)}]`).first();
  const checkAndWait = async () => {
    await page.locator("#check").tap();
    await page.waitForFunction(() => { const f = document.querySelector(".feedback"); return f && f.textContent.trim().length > 0; }, null, { timeout: 20000 });
    return feedback();
  };
  const runAndWait = async () => {
    await page.locator("#run").tap();
    await page.waitForFunction(() => /运行成功|运行出错|已停止/.test(document.getElementById("status")?.textContent || ""), null, { timeout: 20000 });
    return page.locator("#output").innerText();
  };

  check("首页：显示第一课和课程路线", /输出、变量和简单运算/.test(await text()) && (await page.locator(".roadmap li").count()) === course.lessons.length);
  check("首页：后续课程标为即将推出，不能误点进去", /即将推出/.test(await text()) && (await page.locator(".roadmap button").count()) === 0);
  await tapText("开始学习");

  // 正文 1：print
  check("第 1 页：print 讲解 + 例子 + 运行结果", /让程序显示内容/.test(await text()) && (await page.locator(".example").count()) === 1);
  check("正文页没有键盘，阅读区干净", (await page.locator("#keyboard").count()) === 0);
  await page.getByRole("button", { name: "查看 print 的词义" }).first().tap();
  check("词义卡可选打开：有音标和用途", /\/prɪnt\//.test(await page.locator(".overlay").innerText()));
  await page.locator(".overlay [data-close]").tap();

  // 试一试：改例子并运行
  await page.getByRole("button", { name: "修改并运行这个例子" }).first().tap();
  check("试一试：打开全屏代码区，内容是例子代码", (await page.locator(".overlay.full").count()) === 1 && (await doc()) === examples[0].code);
  let out = await runAndWait();
  check("试一试：直接运行得到例子的结果", out.trim() === examples[0].output);
  await setDoc('print("我改过了")');
  out = await runAndWait();
  check("试一试：改了以后运行得到新结果", out.trim() === "我改过了");
  await key("{backspace}").tap();
  check("试一试：可以用内置键盘编辑", (await doc()).length === 'print("我改过了")'.length - 1);
  await tapText("恢复原样");
  check("试一试：恢复原样", (await doc()) === examples[0].code);
  await setDoc('print("再改一次")');
  await page.waitForTimeout(400);
  await tapText("返回教程");
  check("返回教程：回到原来的正文页", /让程序显示内容/.test(await text()) && (await page.locator(".overlay").count()) === 0);
  check("改过的例子标注“有改动”，教程里的原例子不变", /有改动/.test(await text()) && (await page.locator(".example pre.code").first().innerText()) === examples[0].code);

  // 可以直接往下读
  await tapText("Next");
  check("第 2 页：变量", /变量：给值起个名字/.test(await text()) && (await page.locator(".example").count()) === 3);
  check("变量页解释了 = 的意思和不加引号", /把右边的值存进左边的名字/.test(await text()) && /没有引号/.test(await text()));
  await tapText("Next");

  // 练习 1：可以跳过
  check("第 3 页：小练习，按钮是“跳过”", /小练习：用变量/.test(await text()) && (await page.locator("[data-next]").innerText()) === "跳过");
  await setDoc('print("东京")');
  let fb = await checkAndWait();
  check("练习 1：输出对但没用变量，提示用 city", /city = "东京"/.test(fb), fb.slice(0, 50));
  await setDoc('city = "东京"\nprint("city")');
  fb = await checkAndWait();
  check("练习 1：把变量名加了引号，说明输出不对", /第 1 行应该是「东京」/.test(fb), fb.slice(0, 50));
  await setDoc('city = "东京"\nprint(City)');
  fb = await checkAndWait();
  check("练习 1：大小写写错，提示检查拼写和大小写", /大小写/.test(fb), fb.slice(0, 60));
  await tapText("跳过");
  check("跳过练习后继续往下学", /简单运算/.test(await text()));
  await tapText("Back");
  check("回到练习，草稿还在", (await doc()) === 'city = "东京"\nprint(City)');
  await setDoc('city = "东京"\nprint(city)');
  fb = await checkAndWait();
  check("练习 1 通过，按钮变成 Next", /✓ 通过/.test(fb) && (await page.locator("[data-next]").innerText()) === "Next");
  await tapText("Next");

  // 正文 3、4
  check("第 4 页：简单运算，例子含 / 的小数说明", /简单运算/.test(await text()) && /4\.0/.test(await text()));
  await page.getByRole("button", { name: "修改并运行这个例子" }).nth(3).tap();
  await setDoc("price = 120\ncount = 5\ntotal = price * count\nprint(total)");
  out = await runAndWait();
  check("试一试：改变量值，结果跟着变", out.trim() === "600");
  await tapText("返回教程");
  await tapText("Next");
  check("第 5 页：一次输出多个值", /一次输出多个值/.test(await text()));

  // 中途离开再回来
  await page.reload();
  await page.waitForFunction(() => document.querySelector("#app")?.innerText.includes("继续学习"));
  check("重新打开：首页显示继续学习和位置", /继续学习/.test(await text()) && /学到 5\/6/.test(await text()));
  await tapText("继续学习");
  check("重新打开：回到第 5 页", /一次输出多个值/.test(await text()));
  await tapText("Next");

  // 综合练习
  check("第 6 页：综合练习", /综合练习：算总价/.test(await text()));
  await setDoc('print("总价" + 140)');
  fb = await checkAndWait();
  check("综合练习：文字 + 数字报错，解释用逗号", /逗号/.test(fb), fb.slice(0, 60));
  await setDoc('price = 35\ncount = 4\nprint("总价", 140)');
  fb = await checkAndWait();
  check("综合练习：没用乘法算，提示 price * count", /price \* count/.test(fb), fb.slice(0, 60));
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: /^Hint/ }).first().tap();
  check("三级提示：最后显示参考答案", /参考答案/.test(await text()));
  await setDoc('price = 35\ncount = 4\nprint("总价", price * count)');
  fb = await checkAndWait();
  check("综合练习通过", /✓ 通过/.test(fb));
  await tapText("Next");

  check("完成页：学完第一课", /学完了：输出、变量和简单运算/.test(await text()));
  check("完成页：两道练习都显示完成，标注看过答案", (await page.locator(".summary li").count()) === 2 && /看过答案/.test(await text()) && !/跳过了/.test(await text()));
  check("完成页：告诉下一课是什么", /下一课「文字（字符串）与长度」/.test(await text()));
  await tapText("回到首页");
  check("首页：第一课显示已学完，没有重复课程", /已学完/.test(await text()) && (await page.locator(".lesson-card").count()) === 1);

  // 键盘固定（练习页）
  await tapText("再学一遍");
  await tapText("Next"); await tapText("Next"); // 到练习 1
  const kbPos = () => page.evaluate(() => Math.round(document.getElementById("keyboard").getBoundingClientRect().bottom));
  const before = await kbPos();
  await page.mouse.wheel(0, 600);
  await page.evaluate(() => window.scrollTo(0, 500));
  await page.waitForTimeout(200);
  check("练习页键盘固定在底部，页面滚动时不移动", before === (await kbPos()) && (await page.evaluate(() => window.scrollY)) === 0, `bottom=${before}`);

  // 宽度
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    check(`${w}px 宽度无横向溢出`, !(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)));
  }
  await page.setViewportSize({ width: 390, height: 844 });

  // 清除记录
  await page.locator(".top-back").tap();
  await tapText("清除学习记录"); await tapText("取消");
  check("清除记录：取消后不变", /已学完|学到/.test(await text()));
  await tapText("清除学习记录"); await tapText("确定清除");
  check("清除记录：确认后回到未开始", /开始学习/.test(await text()) && /未开始/.test(await text()));

  // 旧版（v1）进度：提示更新，不沿用旧完成状态，不出现旧课程
  const p4 = await ctx.newPage();
  await p4.addInitScript(() => {
    if (sessionStorage.getItem("seeded")) return;
    sessionStorage.setItem("seeded", "1");
    localStorage.setItem("suipian.progress", JSON.stringify({ version: 1, lesson: "N01", step: 8, started: true, done: { E1: true, E2: true, E3: true, T1: true, N01: true }, drafts: { T1: { code: "print(1)", anchor: 0, head: 0 } }, installTipClosed: true }));
  });
  await p4.goto(BASE);
  const t4 = await p4.locator("#app").innerText();
  check("旧进度：提示课程已更新", /课程已更新为新版教程/.test(t4));
  check("旧进度：第一课显示未开始，不沿用旧完成状态", /未开始/.test(t4) && /开始学习/.test(t4) && !/已学完/.test(t4));
  check("旧进度：首页没有旧的 N01 课程", !/N01/.test(t4) && !/输出与执行顺序/.test(t4));
  const st4 = await p4.evaluate(() => window.__app.getState());
  check("旧进度：旧草稿和完成记录已清掉，保留“已关闭安装提示”", Object.keys(st4.drafts).length === 0 && Object.keys(st4.exDone).length === 0 && st4.installTipClosed === true && st4.version === 2);
  await p4.reload();
  check("旧进度：迁移后再打开不再重复提示", !/课程已更新/.test(await p4.locator("#app").innerText()));
  await p4.close();

  // 存储不可用 / 记录损坏
  const p2 = await ctx.newPage();
  await p2.addInitScript(() => { Storage.prototype.setItem = () => { throw new Error("quota"); }; });
  await p2.goto(BASE);
  await p2.getByRole("button", { name: "开始学习" }).tap();
  check("存储写入失败：提示无法保存，页面不白屏", /无法保存进度/.test(await p2.locator(".toast").innerText().catch(() => "")) && /让程序显示内容/.test(await p2.locator("#app").innerText()));
  await p2.close();
  const p3 = await ctx.newPage();
  await p3.addInitScript(() => { try { localStorage.setItem("suipian.progress", "{坏掉的数据"); } catch {} });
  await p3.goto(BASE);
  check("记录损坏：提示并从头开始，不白屏", /记录损坏/.test(await p3.locator("#app").innerText()) && /开始学习/.test(await p3.locator("#app").innerText()));
  await p3.close();

  // 截图
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.screenshot({ path: "tests/shot-home.png" });
  await tapText("开始学习"); await tapText("Next");
  await page.screenshot({ path: "tests/shot-card2.png" });
  await page.getByRole("button", { name: "修改并运行这个例子" }).first().tap();
  await page.locator("#run").tap(); await page.waitForTimeout(800);
  await page.screenshot({ path: "tests/shot-choice.png" });
  await tapText("返回教程"); await tapText("Next");
  await page.screenshot({ path: "tests/shot-code.png" });

  check("页面无脚本错误", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
