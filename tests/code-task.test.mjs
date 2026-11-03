// 写代码 / 改代码题的答题页：真实 Pyodide、真实判题、真实构建产物（桌面 Chromium 手机模拟，不能代替 iPhone 真机）。
// 重点：运行不计分；检查才算作答；答对 +XP、答错才扣红心；超时 / 输出太多 / Python 不可用 / 弯引号 不算作答、不扣红心；草稿保留。
// 运行：npm run build && node tests/code-task.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4341, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

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

const W = (id, over = {}) => ({
  id, version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
  tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }, { name: "0 杯", data: { price: 9, cups: 0 }, expected: "总价 0", hidden: true, note: "杯数是 0 的情况也要对" }],
  hints: ["提示一：用乘法", "提示二：print 里用逗号分开"], reference: 'print("总价", price * cups)',
  mistakes: [{ match: { test: "4 杯", got: "总价 11" }, why: "这里要用乘法 *，不是减法。" }], ...over,
});
const LESSON = (exs, id = "TESTCODE") => ({ id, title: "代码题测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: exs });
const GOOD = 'print("总价", price * cups)', BAD = 'print("总价", price - cups)';

async function open({ init = null, storageSeed = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { ctx, page, errors };
}
async function start(page, exs, opts = {}) {
  await page.evaluate(([l, o]) => window.__app.startLesson(l, o), [LESSON(exs, opts.id), { review: !!opts.review }]);
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForSelector("[data-code-task]");
}
const stat = (page) => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
const setCode = (page, code) => page.evaluate((c) => window.__app.currentArea.setCode(c), code);
const results$ = (page) => page.locator("[data-results]").innerText();
const waitJudged = (page, ms = 60000) => page.waitForFunction(() => { const b = document.querySelector("[data-check]"); return b && b.textContent === "检查" || document.querySelector(".feedbar"); }, null, { timeout: ms });

try {
  { // 页面结构 + 运行（不计分）+ 答对
    const { ctx, page, errors } = await open();
    await start(page, [W("T-W1"), W("T-W2")]);
    const t = await page.locator("#app").innerText();
    check("题面：显示给定变量和公开例子，不显示隐藏测试的期望", /price、cups/.test(t) && /总价 60/.test(t) && !/总价 0\b/.test(t.replace(/总价 60/g, "")), t.slice(0, 160));
    check("内置键盘在页面底部，编辑器可见", (await page.locator("#keyboard .kb-key").count()) > 20 && (await page.locator(".cm-editor").isVisible()));
    check("没写代码前“检查”不可点（初始只有注释的 starter 也算已写，所以先清空）", true);
    await setCode(page, "");
    check("空代码：检查按钮不可点", await page.locator("[data-check]").isDisabled());
    // 内置键盘输入
    await setCode(page, "");
    for (const k of ["p", "r", "i", "n", "t"]) await page.locator(`#keyboard .kb-key[data-key="${k}"]`).tap();
    check("内置键盘能往编辑器里打字", (await page.evaluate(() => window.__app.currentArea.code())) === "print");
    // 运行：不计分
    const before = await stat(page);
    await setCode(page, GOOD);
    await page.locator("[data-run]").tap();
    await page.waitForFunction(() => /运行结果/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const runTxt = await results$(page);
    check("运行：显示真实输出（用第一个公开例子的数据），且标明不判对错", /总价 60/.test(runTxt) && /不判对错/.test(runTxt), runTxt);
    check("运行：不改 XP、不扣红心、没有反馈条", JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0);
    // 检查：答对
    await page.locator("[data-check]").tap();
    await page.locator("[data-check]").tap().catch(() => {}); // 连点
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const after = await stat(page);
    check("答对：XP +10，红心不变，只结算一次（连点也只加一次）", after.xp === before.xp + 10 && after.hearts === before.hearts, JSON.stringify([before, after]));
    check("答对：反馈条显示“答对了”，键盘收起", /答对了/.test(await page.locator(".feedbar").innerText()) && (await page.locator("#keyboard").isHidden()));
    await page.waitForFunction(() => !document.querySelector("[data-continue]").disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    check("答对后继续：进入下一题，编辑器是初始内容（草稿已清）", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("# price"));
    check("整个过程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // 答错：扣心；错误解释；隐藏测试不暴露期望
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, BAD);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad", { timeout: 60000 });
    const after = await stat(page);
    check("答错：红心 -1，XP 不变", after.hearts === before.hearts - 1 && after.xp === before.xp, JSON.stringify([before, after]));
    const r = await results$(page);
    check("答错：公开组给出期望 / 你的输出 / 第一处不同", /期望输出/.test(r) && /你的输出/.test(r) && /总价 11/.test(r) && /第 1 行不同/.test(r), r.slice(0, 200));
    check("答错：针对性解释（mistakes 匹配）", /要用乘法/.test(r));
    check("答错：隐藏组只显示分类提示，不显示期望", /隐藏测试/.test(r) && /杯数是 0/.test(r) && !/总价 0\b/.test(r.replace(/总价 60/g, "")));
    check("答错：反馈条不直接给参考答案", !/print\("总价", price \* cups\)/.test(await page.locator(".feedbar").innerText()));
    await ctx.close();
  }

  { // 复习关：答错不扣心
    const { ctx, page } = await open();
    await start(page, [W("T-W1")], { review: true });
    const before = await stat(page);
    await setCode(page, BAD);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad", { timeout: 60000 });
    check("复习关：代码题答错不扣红心", (await stat(page)).hearts === before.hearts);
    await ctx.close();
  }

  { // 死循环：超时 → 不算作答
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, "while True:\n    pass\n");
    await page.locator("[data-check]").tap();
    await waitJudged(page, 30000);
    const r = await results$(page);
    check("死循环：约 5 秒后停止，提示“不算作答，不扣红心”，没有反馈条", /超过 5 秒/.test(r) && /不扣红心/.test(r) && (await page.locator(".feedbar").count()) === 0, r.slice(0, 160));
    check("死循环：XP 和红心都没变，代码保留，检查按钮恢复可点", JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.evaluate(() => window.__app.currentArea.code())).includes("while True") && !(await page.locator("[data-check]").isDisabled()));
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    check("超时后改对再检查：重启后的 Python 正常，答对 +10", (await stat(page)).xp === before.xp + 10);
    await ctx.close();
  }

  { // 输出太多：不算作答
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, "for i in range(100000):\n    print(i)\n");
    await page.locator("[data-check]").tap();
    await waitJudged(page, 30000);
    const r = await results$(page);
    check("输出太多：提示检查循环或打印次数，不算作答，不扣红心", /检查循环或打印次数/.test(r) && /不扣红心/.test(r) && JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0, r.slice(0, 160));
    await ctx.close();
  }

  { // 弯引号
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, "print(“总价”)");
    await page.locator("[data-check]").tap();
    await waitJudged(page, 30000);
    const r = await results$(page);
    check("弯引号造成的语法错误：提示改成直引号，不算作答，不扣红心", /弯引号/.test(r) && JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0, r.slice(0, 120));
    await ctx.close();
  }

  { // 普通语法错误：算答错
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, "print(");
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad", { timeout: 60000 });
    check("普通语法错误：算答错，红心 -1，显示 SyntaxError 和行号", (await stat(page)).hearts === before.hearts - 1 && /SyntaxError/.test(await results$(page)));
    await ctx.close();
  }

  { // 草稿：保存 / 恢复 / 重新开始
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    await setCode(page, "x = 1  # 我的草稿");
    await page.waitForTimeout(900);
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("suipian.draft.")));
    check("草稿：写入独立的键（suipian.draft.<人>.<题>.v<版本>），不碰学习进度", keys.length === 1 && /\.T-W1\.v1$/.test(keys[0]), JSON.stringify(keys));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await start(page, [W("T-W1")]);
    check("草稿：刷新页面后恢复", (await page.evaluate(() => window.__app.currentArea.code())) === "x = 1  # 我的草稿");
    await start(page, [W("T-W1", { version: 2 })]);
    check("草稿：题目版本变了不会套用旧草稿", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("# price"));
    await page.locator("[data-reset]").tap();
    await page.getByRole("button", { name: "重新开始", exact: true }).last().tap();
    check("重新开始：二次确认后恢复初始代码，草稿被清", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("# price"));
    await ctx.close();
  }

  { // 草稿存不下
    const { ctx, page } = await open({ init: () => { const set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith("suipian.draft.")) throw new Error("QuotaExceeded"); return set.call(this, k, v); }; } });
    await start(page, [W("T-W1")]);
    await setCode(page, "x = 2");
    await page.waitForTimeout(900);
    check("草稿保存失败：可见提示，页面仍可用", /存不下草稿/.test(await page.locator(".ct-savenote").innerText()) && !(await page.locator("[data-check]").isDisabled()));
    await ctx.close();
  }

  { // 提示：两级提示 + 参考解法需要确认
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    await page.locator(".mascot-btn").tap();
    check("提示 1", /提示一/.test(await page.locator(".overlay .hint-text").innerText()));
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await page.locator(".mascot-btn").tap();
    check("提示 2", /提示二/.test(await page.locator(".overlay .hint-text").innerText()));
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await page.locator(".mascot-btn").tap();
    check("第三次：先确认再看参考解法", /要看参考解法吗/.test(await page.locator(".overlay").innerText()));
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    check("参考解法内容正确，并标记已查看", /price \* cups/.test(await page.locator(".overlay .hint-text").innerText()) && (await page.evaluate(() => window.__app.currentArea.viewedSolution())));
    await ctx.close();
  }

  { // Python 不可用：不算作答
    const { ctx, page } = await open({ init: () => { window.Worker = function () { throw new Error("SecurityError: 模拟"); }; } });
    await start(page, [W("T-W1")]);
    const before = await stat(page);
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await waitJudged(page, 40000);
    const r = await results$(page);
    check("Python 不可用：不算作答，不扣红心，没有反馈条，代码保留", /Python 还没准备好/.test(r) && /不算作答/.test(r) && JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0 && (await page.evaluate(() => window.__app.currentArea.code())) === GOOD, r.slice(0, 160));
    check("Python 不可用：状态行显示原因和“重试加载”", (await page.locator("[data-retry-python]").count()) === 1);
    await ctx.close();
  }

  { // 改代码题（modify）：从给定的错误代码开始
    const { ctx, page } = await open();
    await start(page, [W("T-M1", { type: "modify", code: BAD })]);
    check("modify：编辑器里是题目给的初始代码", (await page.evaluate(() => window.__app.currentArea.code())) === BAD);
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    check("modify：改对后通过", true);
    await ctx.close();
  }

  { // input 题 + call 题
    const { ctx, page } = await open();
    const I = { id: "T-I1", version: 1, type: "write", prompt: "读入名字，输出 你好 名字", starter: "", checkMode: "output", tests: [{ name: "小明", stdin: ["小明"], expected: "你好 小明" }, { name: "小红", stdin: ["小红"], expected: "你好 小红" }], hints: [], reference: "" };
    const C = { id: "T-C1", version: 1, type: "write", prompt: "写函数 price(n)，返回 n 杯的总价（每杯 15）", starter: "def price(n):\n    pass\n", checkMode: "call", tests: [{ name: "3 杯", call: { fn: "price", args: [3] }, expectedReturn: 45 }, { name: "0 杯", call: { fn: "price", args: [0] }, expectedReturn: 0 }], hints: [], reference: "" };
    await start(page, [I, C]);
    await setCode(page, 'name = input()\nprint("你好", name)');
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    check("input 题：stdin 逐组传入并通过", true);
    await page.waitForFunction(() => !document.querySelector("[data-continue]").disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await setCode(page, "def price(n):\n    return n * 15\n");
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    check("call 题：按返回值判，通过", true);
    await ctx.close();
  }
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
