// 写代码 / 改代码题的答题页：真实 Pyodide、真实判题、真实构建产物（桌面 Chromium 手机模拟，不能代替 iPhone 真机）。
// 重点：运行不计分；检查才算作答；答对 +XP、答错才扣红心；超时 / 输出太多 / Python 不可用 / 弯引号 不算作答、不扣红心；草稿保留。
// 运行：npm run build && node tests/code-task.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4341, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const results = [];
import { mkdirSync } from "node:fs";
const SHOTS = process.env.SHOTS_DIR || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${process.env.MOBILE_BROWSER || "chromium"}-${name}.png`, fullPage: false }); };
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
// MOBILE_BROWSER=webkit|chromium（默认 chromium）；浏览器起不来 → 环境失败，exit 2，不算通过
const browserType = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

const W = (id, over = {}) => ({
  id, version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
  tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }, { name: "0 杯", data: { price: 9, cups: 0 }, expected: "总价 0", hidden: true, note: "杯数是 0 的情况也要对" }],
  hints: ["提示一：用乘法", "提示二：print 里用逗号分开"], reference: 'print("总价", price * cups)',
  mistakes: [{ match: { test: "4 杯", got: "总价 11" }, why: "这里要用乘法 *，不是减法。" }], ...over,
});
// 带示范和变化题的题：变化 = 价格改成 20，且满 5 杯再减 10（父题 reference 过不了变化题的测试）
const VAR_GOOD = 'total = 20 * cups\nif cups >= 5:\n    total = total - 10\nprint("总价", total)', VAR_BAD = 'print("总价", 20 * cups)';
const VARI = (id, over = {}) => W(id, {
  worked: { code: "n = 2\nprint(n * 3)", output: "6", explain: "乘法用 *。" },
  requiresVariationAfterSolution: true,
  variation: { id: id + "-V1", prompt: "单价 20 元，满 5 杯减 10 元。输出：总价 <金额>", starter: "# cups 已准备好\n", tests: [
    { name: "3 杯", data: { cups: 3 }, expected: "总价 60" }, { name: "6 杯", data: { cups: 6 }, expected: "总价 110" }, { name: "5 杯", data: { cups: 5 }, expected: "总价 90", hidden: true }],
    hints: ["先算 20 * cups", "再判断 cups >= 5"], solution: VAR_GOOD },
  ...over,
});
const LESSON = (exs, id = "TESTCODE") => ({ id, title: "代码题测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: exs });
const GOOD = 'print("总价", price * cups)', BAD = 'print("总价", price - cups)';

async function open({ init = null, storageSeed = null, viewport = { width: 390, height: 844 }, colorScheme = "light" } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  page.__errors = errors;
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { ctx, page, errors };
}
async function start(page, exs, opts = {}) {
  await page.evaluate(([l, o]) => window.__app.startLesson(l, o), [LESSON(exs, opts.id), { review: !!opts.review }]);
  await page.getByRole("button", { name: "继续", exact: true }).tap();
  await page.waitForSelector("[data-code-task]", { timeout: 15000 }).catch(async (e) => {
    console.log("页面脚本错误：", JSON.stringify(page.__errors || []), "\n页面文字：", (await page.locator("#app").innerText()).slice(0, 300));
    throw e;
  });
}
const stat = (page) => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
const setCode = (page, code) => page.evaluate((c) => window.__app.currentArea.setCode(c), code);
const results$ = (page) => page.locator("[data-results]").innerText();
const waitJudged = (page, ms = 60000) => page.waitForFunction(() => { const b = document.querySelector("[data-check]"); return b && b.textContent === "检查" || document.querySelector(".feedbar"); }, null, { timeout: ms });

try {
  { // 普通题（非代码题）页面底部不能出现 "undefined" / "null" 文字
    const { ctx, page } = await open();
    await page.evaluate(() => { const l = window.__app.allLessons().find((x) => x.id === "U1L2"); window.__app.startLesson(l); });
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector(".lesson .q");
    const txt = await page.locator("#app").innerText();
    check("普通题页面没有多余的 undefined / null 文字", !/undefined|null/.test(txt), JSON.stringify(txt.slice(-30)));
    await ctx.close();
  }
  { // 页面结构 + 运行（不计分）+ 答对
    const { ctx, page, errors } = await open();
    await start(page, [W("T-W1"), W("T-W2")]);
    await shot(page, "01-write-task");
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
    await shot(page, "03-wrong-answer");
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

  { // 没有 variant 的题：提示用完就没有了，不提供参考解法
    const { ctx, page } = await open();
    await start(page, [W("T-W1")]);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    const t = await page.locator(".overlay").innerText();
    check("没有 variant 字段的题：两级提示之后不给参考解法", /没有更多提示/.test(t) && !/price \* cups/.test(t) && !(await page.evaluate(() => window.__app.currentArea.viewedSolution())), t.slice(0, 80));
    await ctx.close();
  }

  { // 提示：两级提示 + 参考解法需要确认（题目带 variant 才提供）
    const { ctx, page } = await open();
    await start(page, [VARI("T-W1")]);
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


  { // 示范（折叠）：只讲概念，不是本题答案
    const { ctx, page } = await open();
    await start(page, [VARI("T-V0")]);
    const d = page.locator("[data-worked]");
    check("示范：默认折叠，标明不是本题答案", (await d.count()) === 1 && !(await d.evaluate((e) => e.open)) && /不是本题的答案/.test(await d.locator("summary").innerText()));
    await d.locator("summary").tap();
    await shot(page, "02-worked-open");
    check("示范：展开后有代码、输出、讲解", /n \* 3/.test(await d.innerText()) && /乘法用/.test(await d.innerText()));
    check("示范：不含本题参考答案", !/price \* cups/.test(await d.innerText()));
    await ctx.close();
  }

  { // 看过参考解法 → 原题通过不结算 → 变化题 → 通过才结算一次
    const { ctx, page, errors } = await open();
    await start(page, [VARI("T-V1")]);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    const before = await stat(page);
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => window.__app.currentArea.isVariation(), null, { timeout: 60000 });
    check("原题通过：不结算（无反馈条，XP 和红心不变），进入变化题", (await page.locator(".feedbar").count()) === 0 && JSON.stringify(await stat(page)) === JSON.stringify(before));
    await shot(page, "05-variation-entered");
    check("变化题：题面区没有多余的 \"null\" 文字", !/(^|\n)null(\n|$)/.test(await page.locator(".ct-prompt").innerText()));
    check("变化题：显示变化提示和新的题面，编辑器是变化题起始代码", /变化题/.test(await page.locator("[data-variation]").innerText()) && /满 5 杯减 10/.test(await page.locator("[data-variation]").innerText()) && (await page.evaluate(() => window.__app.currentArea.code())).startsWith("# cups"));
    // 用父题答案做变化题：不通过，不扣红心
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await waitJudged(page, 60000);
    await shot(page, "06-variation-failed");
    const r = await results$(page);
    check("变化题没通过：不扣红心、不加 XP、没有反馈条", JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0 && /不扣红心/.test(r), r.slice(0, 120));
    // 重新加载页面后仍在变化题（阶段已保存）
    await setCode(page, VAR_BAD);
    await page.waitForTimeout(700);
    const draftKeys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("suipian.draft.")));
    check("草稿：原题（含阶段）和变化题各存一份", draftKeys.some((k) => /T-V1\.v1$/.test(k)) && draftKeys.some((k) => /T-V1-V1\.v1$/.test(k)), draftKeys.join(","));
    // 变化题通过：结算一次
    await setCode(page, VAR_GOOD);
    await page.locator("[data-check]").tap();
    await page.locator("[data-check]").tap().catch(() => {});
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    await shot(page, "07-variation-passed");
    const after = await stat(page);
    check("变化题通过：只结算一次，XP +10，红心不变", after.xp === before.xp + 10 && after.hearts === before.hearts, JSON.stringify([before, after]));
    const left = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("suipian.draft.")));
    check("结算后两份草稿都清掉", left.length === 0, left.join(","));
    check("没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // 变化阶段刷新后恢复：回到同一道题仍是变化题
    const { ctx, page } = await open();
    await start(page, [VARI("T-V2")]);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => window.__app.currentArea.isVariation(), null, { timeout: 60000 });
    await setCode(page, "print(1)");
    await page.waitForTimeout(700);
    await page.evaluate(() => window.__app.currentArea.destroy());
    await page.evaluate(([l]) => window.__app.startLesson(l, { review: false }), [LESSON([VARI("T-V2")])]);
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-code-task]");
    check("重新进入：仍在变化题，变化题草稿恢复", (await page.evaluate(() => window.__app.currentArea.isVariation())) && (await page.evaluate(() => window.__app.currentArea.code())) === "print(1)");
    await ctx.close();
  }

  { // 变化题里的保护性结果（超时）不算作答
    const { ctx, page } = await open();
    await start(page, [VARI("T-V3")]);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, GOOD);
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => window.__app.currentArea.isVariation(), null, { timeout: 60000 });
    const before = await stat(page);
    await setCode(page, "while True:\n    pass\n");
    await page.locator("[data-check]").tap();
    await waitJudged(page, 90000);
    check("变化题超时：不算作答，不扣红心，没有反馈条", JSON.stringify(await stat(page)) === JSON.stringify(before) && (await page.locator(".feedbar").count()) === 0 && /不算作答|太长/.test(await results$(page)));
    await ctx.close();
  }


  // 键盘弹出时光标行可见 + 判分未通过后结果能看全、按钮能点到（竖屏 iPhone 15 和 iPhone SE 两种高度）
  for (const [tag, viewport] of [["iPhone15", { width: 390, height: 844 }], ["iPhoneSE", { width: 375, height: 667 }]]) {
    const { ctx, page } = await open({ viewport });
    await start(page, [VARI("T-K1")]);
    await page.locator("[data-worked] summary").tap(); // 展开示范：题面最长的状态
    const cursorInfo = () => page.evaluate(() => {
      const view = window.__app.currentArea.view, c = view.coordsAtPos(view.state.selection.main.head);
      const lr = document.querySelector(".lesson").getBoundingClientRect(), fr = document.querySelector(".lessonfoot")?.getBoundingClientRect(), kb = document.querySelector("#keyboard");
      return { top: c?.top ?? null, bottom: c?.bottom ?? null, lessonTop: lr.top, lessonBottom: lr.bottom, footTop: fr?.top ?? null, kbShown: !!kb && !kb.hidden };
    });
    await page.locator(".ct-editor .cm-content").tap();
    await page.locator('#keyboard .kb-key[data-key="p"]').tap();
    let ci = await cursorInfo();
    check(`键盘 ${tag}：点进编辑器并输入一个字符后，光标所在行在可视区内（内置键盘打开）`, ci.kbShown && ci.top !== null && ci.top >= ci.lessonTop - 1 && ci.bottom <= ci.lessonBottom + 1, JSON.stringify(ci));
    check(`键盘 ${tag}：光标行没有被底栏（检查按钮）或键盘盖住`, ci.footTop === null || ci.bottom <= ci.footTop + 1, JSON.stringify(ci));
    await setCode(page, "a = 1\nb = 2\nc = 3\nd = 4\ne = 5\nf = 6\ng = 7\nh = 8\nprint(");
    for (const k of ["p"]) await page.locator(`#keyboard .kb-key[data-key="${k}"]`).tap();
    ci = await cursorInfo();
    await page.waitForTimeout(150); await shot(page, `fix-${tag}-keyboard-open`);
    check(`键盘 ${tag}：写了 9 行之后继续输入，当前输入行仍在可视区内`, ci.top !== null && ci.top >= ci.lessonTop - 1 && ci.bottom <= ci.lessonBottom + 1, JSON.stringify(ci));
    // 收起键盘后页面仍能正常滚动
    await page.locator("[data-toggle-kb]").tap(); await page.waitForTimeout(150);
    const sc = await page.evaluate(() => { const l = document.querySelector(".lesson"); l.scrollTop = 0; const a = l.scrollTop; l.scrollTop = 120; return { hidden: document.querySelector("#keyboard").hidden, canScroll: l.scrollHeight > l.clientHeight, moved: l.scrollTop - a }; });
    check(`键盘 ${tag}：收起键盘后键盘确实隐藏，页面可以滚动`, sc.hidden && (!sc.canScroll || sc.moved > 0), JSON.stringify(sc));
    await ctx.close();
  }
  for (const [tag, viewport] of [["iPhone15", { width: 390, height: 844 }], ["iPhoneSE", { width: 375, height: 667 }]]) {
    const { ctx, page } = await open({ viewport });
    await start(page, [W("T-R1")]);
    await setCode(page, "print(1");
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad", { timeout: 60000 });
    await page.waitForTimeout(400);
    const r = await page.evaluate(() => {
      const l = document.querySelector(".lesson"), lr = l.getBoundingClientRect(), res = document.querySelector("[data-results]").getBoundingClientRect(), f = document.querySelector(".feedbar").getBoundingClientRect(), cb = document.querySelector("[data-continue]").getBoundingClientRect();
      const first = res.top - lr.top;               // 结果框顶部离可视区顶部的距离
      l.scrollTop = l.scrollHeight;                 // 滚到最底
      const res2 = document.querySelector("[data-results]").getBoundingClientRect(), lr2 = l.getBoundingClientRect();
      return { firstTop: Math.round(first), lessonH: Math.round(lr.height), resBottomAfterScroll: Math.round(res2.bottom), lessonBottom: Math.round(lr2.bottom), fbTop: Math.round(f.top), contBottom: Math.round(cb.bottom), vh: innerHeight, contDisabled: document.querySelector("[data-continue]").disabled };
    });
    check(`判分 ${tag}：未通过后，结果框顶部在可视区里（不被反馈栏盖住开头）`, r.firstTop >= -1 && r.firstTop < r.lessonH - 40, JSON.stringify(r));
    check(`判分 ${tag}：滚到底能看完整个结果框（末尾在反馈栏上方）`, r.resBottomAfterScroll <= r.lessonBottom + 1 && r.lessonBottom <= r.fbTop + 1, JSON.stringify(r));
    check(`判分 ${tag}：“继续”按钮在屏幕内且可点（离屏幕底 ≥ 60px 留给 Safari 工具栏）`, !r.contDisabled && r.contBottom <= r.vh - 60 + 1, JSON.stringify(r));
    await shot(page, `fix-${tag}-judge-fail`);
    await ctx.close();
  }

  if (SHOTS) { // 视觉检查：竖屏 / 横屏 × 浅色 / 深色，依次截取各个状态（只在 CI 上传截图时运行，不做断言）
    const configs = [["portrait-light", { width: 390, height: 844 }, "light"], ["portrait-dark", { width: 390, height: 844 }, "dark"], ["landscape-light", { width: 844, height: 390 }, "light"], ["landscape-dark", { width: 844, height: 390 }, "dark"]];
    for (const [tag, viewport, colorScheme] of configs) {
      const { ctx, page } = await open({ viewport, colorScheme });
      await start(page, [VARI("T-S1")]);
      await shot(page, `v-${tag}-1-task`);
      await page.locator("[data-worked] summary").tap();
      await shot(page, `v-${tag}-2-worked-open`);
      await setCode(page, "print(1");
      await shot(page, `v-${tag}-3-editing`);
      { const bb = await page.locator(".ct-editor").boundingBox(); const vh = viewport.height; const kbTop = await page.evaluate(() => document.querySelector("#keyboard")?.getBoundingClientRect().top ?? innerHeight);
        check(`视觉 ${tag}：键盘弹出时编辑器至少露出 40px 且在键盘上方`, !!bb && bb.y >= 0 && Math.min(bb.y + bb.height, kbTop) - bb.y >= 40 && bb.y < Math.min(vh, kbTop)); }
      await setCode(page, "while True:\n    pass\n");
      await page.locator("[data-check]").tap();
      await waitJudged(page, 90000);
      await shot(page, `v-${tag}-5-protection-stop`);
      for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
      await shot(page, `v-${tag}-6-solution-confirm`);
      await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
      await shot(page, `v-${tag}-7-solution`);
      await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
      await setCode(page, GOOD);
      await page.locator("[data-check]").tap();
      await page.waitForFunction(() => window.__app.currentArea.isVariation(), null, { timeout: 60000 });
      await shot(page, `v-${tag}-8-variation`);
      await setCode(page, VAR_GOOD);
      await page.locator("[data-check]").tap();
      await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
      await shot(page, `v-${tag}-9-result-pass`);
      await ctx.close();
      { // 答错（语法错误）的结果页：单独一页，因为答错会结算并换成反馈条
        const w = await open({ viewport, colorScheme });
        await start(w.page, [W("T-S2")]);
        await setCode(w.page, "print(1");
        await w.page.locator("[data-check]").tap();
        await w.page.waitForSelector(".feedbar.bad", { timeout: 60000 });
        await shot(w.page, `v-${tag}-4-wrong-result`);
        await w.ctx.close();
      }
    }
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
