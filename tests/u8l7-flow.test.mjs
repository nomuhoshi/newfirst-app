// U8L7「价格计算器」真实运行器流程验收：用临时测试数据把 heldLessons 里的 L7 挂载成一关（不改任何内容文件、不进地图、不进公开预览），
// 走真实编辑器 + 真实 Pyodide + 真实判题界面（call 模式：调用学生写的 bill(...)，比较返回值）。重点：
//  ① 起始代码：函数里是 print → “返回 None”；漏传参数（没有默认值）→ TypeError。两种错误在界面上必须能区分，不能混成同一种
//  ② 只补默认值（仍是 print）→ 八组全是“返回 None”，不再有 TypeError；只改 return（没默认值）→ 三组 TypeError，其余通过
//  ③ 参考解法 / 4 种等价写法 → 八组全部通过，结算 XP；7 种常见错误写法各自被判错；边界写成 > 30 → 恰好“总价正好 30”的两组失败
//  ④ 先 print("调试", end="") 不换行再正确 return → 仍判对（返回值走独立通道，不看标准输出）
//  ⑤ 隐藏用例：题面和失败反馈都不泄露隐藏用例的名字、调用、期望值；参考解法在看过解法之前不出现在页面里
//  ⑥ 草稿：改到一半刷新页面后恢复
//  ⑦ 变化题：看过参考解法 → 原题通过后不结算、进入变化题；变化题通过才结算，XP 只加一次（和没看解法的路径最终 XP 相同）
// 运行：npm run build && node tests/u8l7-flow.test.mjs   （也可以：DIST_DIR=某个构建产物目录 node tests/u8l7-flow.test.mjs）
//       MOBILE_BROWSER=webkit 换 WebKit；SHOW=1 打印实际看到的提示原文；SHOTS_DIR=目录 保存截图；BUILD_SHA=构建提交号（写进日志）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";
const { chromium, webkit } = (() => { try { return createRequire(import.meta.url)("playwright"); } catch { return createRequire("/")("playwright"); } })();

const DIST = resolve(process.env.DIST_DIR || new URL("../dist", import.meta.url).pathname);
const WK = process.env.MOBILE_BROWSER === "webkit";
const PORT = 4361 + (WK ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".txt": "text/plain" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SHOTS = process.env.SHOTS_DIR || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SHOW = !!process.env.SHOW;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${WK ? "webkit" : "chromium"}-u8l7-${name}.png` }); };
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const show = (title, text) => { if (SHOW) console.log(`   ┌ ${title}\n${String(text).split("\n").map((l) => "   │ " + l).join("\n")}\n   └`); };

const unit8 = JSON.parse(readFileSync(new URL("../content/unit8.json", import.meta.url)));
const held = unit8.heldLessons.find((l) => l.id === "U8L7");
const task = held.pending[0].task;
const LESSON = { ...held, pending: undefined, exercises: [...held.exercises.slice(0, held.pending[0].replaces - 1), { ...task }] };
const REF = task.reference;
const T = task.tests;                       // 八组：前 3 组公开，后 5 组隐藏（顺序和界面一致）
const PUBLIC = T.filter((t) => !t.hidden), HIDDEN = T.filter((t) => t.hidden);
const callStr = (t) => `${t.call.fn}(${t.call.args.join(", ")})`;

console.log(`构建：${process.env.BUILD_SHA || (existsSync(join(DIST, "SOURCE_SHA.txt")) ? readFileSync(join(DIST, "SOURCE_SHA.txt"), "utf8").trim() : "未知")}；浏览器：${WK ? "WebKit" : "Chromium"}；构建产物：${DIST}`);

const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const browserType = WK ? webkit : chromium;
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

async function open() {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: !WK, serviceWorkers: "block" });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  return { ctx, page, errors };
}
const mount = async (page) => {
  await page.evaluate((l) => window.__app.startLesson(l, { review: false }), LESSON);
  await page.getByRole("button", { name: "继续", exact: true }).tap(); // 讲解页
};
const stat = (page) => page.evaluate(() => { const s = window.__app.getState(); return { xp: s.xp, hearts: s.hearts }; });
const setCode = (page, code) => page.evaluate((c) => window.__app.currentArea.setCode(c), code);
const draftKeys = (page) => page.evaluate(() => { const ks = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.includes("suipian.draft.")) ks.push(k); } return ks; });
const results$ = (page) => page.locator("[data-results]").innerText();
const appText = (page) => page.locator("#app").innerText();
async function answerFrontToCodeTask(page) {
  for (let i = 0; i < held.pending[0].replaces - 1; i++) { // 前三题（选输出 / 选输出 / 读报错选择）：按正确答案答
    await page.waitForSelector("h2.q");
    const ex = await page.evaluate(() => window.__app.currentEx);
    await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).tap();
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok");
    await page.waitForFunction(() => !document.querySelector("[data-continue]").disabled);
    await page.locator("[data-continue]").tap();
  }
  await page.waitForSelector("[data-code-task]", { timeout: 15000 });
}

const NAMES = T.map((t) => (t.hidden ? "隐藏测试" : t.name));
const parse = (text) => ({ summary: (text.match(/(全部通过 ✓（\d+\/\d+ 组）|还没通过：\d+\/\d+ 组通过)/) || [""])[0], marks: [...text.matchAll(/^(✓ 通过|✗ 未通过)/gm)].map((m) => m[1].startsWith("✓")) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (marks) => marks.map((x, i) => `${x ? "✓" : "✗"}${i + 1}`).join(" ");
const caseTexts = (page) => page.locator("[data-results] .ct-case").allInnerTexts();

// 每次都从全新页面开始（草稿、红心、XP 互不影响）；返回判题界面原文和每组的文字
async function checkOnFreshPage(code, { keepPage = false } = {}) {
  const o = await open();
  await mount(o.page); await answerFrontToCodeTask(o.page);
  await setCode(o.page, code);
  const before = await stat(o.page);
  await o.page.locator("[data-check]").tap();
  await o.page.waitForSelector(".feedbar.ok, .feedbar.bad", { timeout: 90000 });
  const text = await results$(o.page);
  const cases = await caseTexts(o.page);
  const after = await stat(o.page);
  const fb = await o.page.locator(".feedbar").innerText();
  if (!keepPage) await o.ctx.close();
  return { ...o, text, cases, before, after, fb, ...parse(text) };
}
const noLeak = (text) => {
  const bad = [];
  for (const t of HIDDEN) { if (text.includes(t.name)) bad.push("名字：" + t.name); if (text.includes(callStr(t))) bad.push("调用：" + callStr(t)); }
  return bad;
};
const LINE_NO = /第\s*\d+\s*行/;

try {
  { // ① 题面 / 起始代码 / 不泄露
    const { ctx, page, errors } = await open();
    await mount(page);
    await answerFrontToCodeTask(page);
    const intro = await appText(page);
    show("① 代码题页面文字（作答前）", intro);
    check("① 题面写明输入范围（price、cups 都是正整数）和三条规则（总价 = 单价 × 杯数、满 30 减 5、只写单价按 1 杯）", /输入范围/.test(intro) && /price、cups 都是正整数/.test(intro) && /满 30/.test(intro) && /减 5/.test(intro) && /1 杯/.test(intro), intro.slice(0, 200));
    check(`① 页面列出 ${PUBLIC.length} 个公开例子（调用 + 应该返回），格式 bill(8, 3) → 24`, (intro.match(/^例 \d/gm) || []).length === PUBLIC.length && PUBLIC.every((t) => intro.includes("调用：" + callStr(t)) && intro.includes("应该返回：" + JSON.stringify(t.expectedReturn))), intro.slice(0, 300));
    check("① 作答前页面不出现隐藏用例的名字和调用", noLeak(intro).length === 0, noLeak(intro).join(" | "));
    check("① 作答前页面没有完整答案：没有 return amount - 5、没有默认值 cups=1 / cups = 1、没有 amount >= 30 之后的 return", !/return amount\s*-\s*5/.test(intro) && !/cups\s*=\s*1/.test(intro) && !/elif/.test(intro), intro.slice(0, 120));
    const start = await page.evaluate(() => window.__app.currentArea.code());
    check("① 编辑器里是起始代码：已有 total(price, cups)，bill(price, cups) 没有默认值、里面是 print", start === task.code && /def bill\(price, cups\):/.test(start) && /print\(/.test(start) && !/return amount/.test(start));
    const workedCode = await page.locator(".ct-worked-code").textContent().catch(() => "") || ""; // <details> 默认折叠，innerText 取不到，用 textContent
    check("① 讲解例子（pay，满 20 减 3）与本题答案不同：不含 def bill / total(", /def pay/.test(workedCode) && !/def bill/.test(workedCode) && !/total\(/.test(workedCode), workedCode.slice(0, 120));
    await shot(page, "01-start");
    // 运行（试一试）：call 模式下“运行”只执行代码本身，不会调用 bill —— 记录实际提示
    const s0 = await stat(page);
    await page.locator("[data-run]").tap();
    await page.waitForFunction(() => /运行结果|运行没有成功/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 90000 });
    const run = await results$(page);
    show("① 点“运行”（起始代码）", run);
    check("① “运行”不计分：XP、红心不变，没有反馈条", same(await stat(page), s0) && (await page.locator(".feedbar").count()) === 0);
    console.log(`   ℹ️ 记录：“运行”起始代码的实际提示 = ${JSON.stringify(run.replace(/\n/g, " ⏎ ").slice(0, 120))}`);
    check("① 前半段没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // ② 起始代码：返回 None 与漏传参数 TypeError 必须区分
    const r = await checkOnFreshPage(task.code);
    show("② 起始代码点“检查”", r.text);
    check("② 起始代码：0/8 通过，反馈条“不对哦”，红心 -1，XP 不变", r.summary === "还没通过：0/8 组通过" && r.marks.length === 8 && r.marks.every((m) => !m) && /不对哦/.test(r.fb) && r.after.hearts === r.before.hearts - 1 && r.after.xp === r.before.xp, `${r.summary} ${r.fb.replace(/\n/g, " ")}`);
    // 逐组：bill(8,3)/bill(12,3)/bill(10,3)/bill(6,10)/bill(40,1) 传了两个参数 → 函数跑完返回 None；bill(8)/bill(29)/bill(30) 少传 → TypeError
    const wantKind = T.map((t) => (t.call.args.length === 1 ? "TypeError" : "None"));
    wantKind.forEach((k, i) => {
      const c = r.cases[i] || "";
      if (k === "None" && !T[i].hidden) check(`② 公开第 ${i + 1} 组 ${callStr(T[i])}：显示“期望返回 ${T[i].expectedReturn}，你的函数返回 None”，不是 TypeError`, c.includes(`期望返回 ${T[i].expectedReturn}`) && c.includes("你的函数返回 None") && !/TypeError/.test(c), c);
      if (k === "TypeError" && !T[i].hidden) check(`② 公开第 ${i + 1} 组 ${callStr(T[i])}：显示 TypeError（漏传参数），不是“返回 None”，不带学生代码里不存在的行号`, /TypeError/.test(c) && !/你的函数返回/.test(c) && !/期望返回/.test(c) && !LINE_NO.test(c), c);
      if (k === "None" && T[i].hidden) check(`② 隐藏第 ${i + 1} 组：只说“函数的返回值和期望不一致”，不给期望值和实际返回值`, c.includes("函数的返回值和期望不一致") && !/期望返回|你的函数返回/.test(c) && !c.includes(callStr(T[i])) && !c.includes(T[i].name), c);
      if (k === "TypeError" && T[i].hidden) check(`② 隐藏第 ${i + 1} 组：显示 TypeError，不给期望值，不泄露名字和调用`, /TypeError/.test(c) && !/期望返回/.test(c) && !c.includes(callStr(T[i])) && !c.includes(T[i].name) && !LINE_NO.test(c), c);
    });
    const tc = r.cases.filter((_, i) => wantKind[i] === "TypeError").join("\n"), nc = r.cases.filter((_, i) => wantKind[i] === "None").join("\n");
    check("② 两种情况的提示不混：TypeError 组里没有“返回 None”，返回 None 的组里没有 TypeError", !/你的函数返回 None/.test(tc) && !/TypeError/.test(nc));
    check("② 失败反馈里不出现隐藏用例的名字和调用", noLeak(r.text).length === 0, noLeak(r.text).join(" | "));
    const tpl = r.cases[T.findIndex((t) => t.call.args.length === 1 && !t.hidden)] || "";
    console.log(`   ℹ️ 记录：漏传参数的实际提示 = ${JSON.stringify(tpl.replace(/\n/g, " ⏎ ").slice(0, 240))}`);
    console.log(`   ℹ️ 记录：返回 None 的实际提示 = ${JSON.stringify((r.cases[0] || "").replace(/\n/g, " ⏎ ").slice(0, 240))}`);
    check("② 整个流程没有脚本错误", r.errors.length === 0, r.errors.join(" | "));
    await r.ctx.close();
  }

  const FIX_DEFAULT_ONLY = task.code.replace("def bill(price, cups):", "def bill(price, cups=1):");
  const FIX_RETURN_ONLY = task.code.replace("print(amount - 5)", "return amount - 5").replace("print(amount)", "return amount");
  { // ③ 只补默认值（仍是 print）→ 全是返回 None；只改 return（没默认值）→ 漏传参数的三组 TypeError
    const a = await checkOnFreshPage(FIX_DEFAULT_ONLY);
    show("③ 只补了默认值，仍是 print", a.text);
    check("③ 只补默认值：0/8，八组都是“返回 None”类提示，没有任何 TypeError", a.marks.length === 8 && a.marks.every((m) => !m) && !/TypeError/.test(a.text) && a.cases.filter((c) => /你的函数返回 None/.test(c)).length === PUBLIC.length && a.cases.filter((c) => c.includes("函数的返回值和期望不一致")).length === HIDDEN.length, a.cases.join(" | ").slice(0, 300));
    await a.ctx.close();
    const b = await checkOnFreshPage(FIX_RETURN_ONLY);
    show("③ 只改成 return，没补默认值", b.text);
    const wantB = T.map((t) => t.call.args.length !== 1);
    check(`③ 只改 return：逐组 = ${fmt(wantB)}（三个只传一个值的调用 TypeError，其余五组通过）`, same(b.marks, wantB) && b.cases.filter((c) => /TypeError/.test(c)).length === 3 && !/你的函数返回 None/.test(b.text) && /5\/8/.test(b.summary), `${b.summary} ${fmt(b.marks)}`);
    await b.ctx.close();
  }

  { // ④ 参考解法 / 等价写法 / 带 print 的写法
    const ref = await checkOnFreshPage(REF);
    show("④ 参考解法", ref.text);
    check("④ 参考解法：8/8 全部通过，反馈条“答对了”，XP +10，红心不变", ref.summary.includes("8/8") && ref.marks.length === 8 && ref.marks.every(Boolean) && /答对了/.test(ref.fb) && ref.after.xp === ref.before.xp + 10 && ref.after.hearts === ref.before.hearts, `${ref.summary} ${ref.fb.replace(/\n/g, " ")} ${JSON.stringify([ref.before, ref.after])}`);
    check("④ 通过后的界面：公开组显示真实名字，其余显示“隐藏测试”，共 8 组", PUBLIC.every((t) => ref.text.includes(t.name)) && (ref.text.match(/隐藏测试/g) || []).length === HIDDEN.length && ref.cases.length === 8);
    await ref.ctx.close();

    const dbg = REF.replace("    amount = total(price, cups)\n", '    print("调试", end="")\n    amount = total(price, cups)\n');
    const d = await checkOnFreshPage(dbg);
    show("④ 先 print(\"调试\", end=\"\") 再正确 return", d.text);
    check("④ 函数里先 print(\"调试\", end=\"\")（不换行）再正确 return：仍 8/8 判对，XP +10", dbg !== REF && d.summary.includes("8/8") && d.marks.every(Boolean) && d.after.xp === d.before.xp + 10, `${d.summary} ${d.fb.replace(/\n/g, " ")}`);
    await d.ctx.close();
    const d2 = await checkOnFreshPage(REF.replace("    amount = total(price, cups)\n", '    print("@@OK")\n    amount = total(price, cups)\n') + '\nprint("@@OK")\n');
    check("④ 即使打印 @@OK 这种字样（包括函数外）：返回值照常判对（判题不读标准输出）", d2.summary.includes("8/8") && d2.marks.every(Boolean), `${d2.summary}`);
    await d2.ctx.close();

    task.alternatives.forEach(() => {});
    for (let i = 0; i < task.alternatives.length; i++) {
      const r = await checkOnFreshPage(task.alternatives[i]);
      check(`④ 等价写法 ${i + 1}（${i === 0 ? "else" : i === 1 ? "三元表达式或其他" : "其他"}）：8/8 判对`, r.summary.includes("8/8") && r.marks.every(Boolean), `${r.summary} ${fmt(r.marks)}`);
      await r.ctx.close();
    }
  }

  { // ⑤ 常见错误写法 + 边界 > 30
    const gt = REF.replace("amount >= 30", "amount > 30");
    const g = await checkOnFreshPage(gt);
    show("⑤ 边界写成 > 30", g.text);
    const wantG = T.map((t) => !(t.call.args.length === 2 ? t.call.args[0] * t.call.args[1] === 30 : t.call.args[0] === 30));
    check(`⑤ 边界写成 > 30：逐组 = ${fmt(wantG)}（只有总价正好 30 元的两组失败），红心 -1`, gt !== REF && same(g.marks, wantG) && wantG.filter((x) => !x).length === 2 && g.after.hearts === g.before.hearts - 1 && /不对哦/.test(g.fb), `${g.summary} ${fmt(g.marks)}`);
    const hiddenFail = g.cases.filter((c, i) => !g.marks[i]);
    check("⑤ 边界失败的两组都是隐藏用例：只说“返回值和期望不一致”，不泄露期望值和调用", hiddenFail.length === 2 && hiddenFail.every((c) => c.includes("函数的返回值和期望不一致") && !/期望返回|你的函数返回/.test(c)) && noLeak(g.text).length === 0, hiddenFail.join(" | "));
    await g.ctx.close();
    for (let i = 0; i < task.wrongAnswers.length; i++) {
      const w = task.wrongAnswers[i];
      const r = await checkOnFreshPage(w.code);
      check(`⑤ 错误写法 ${i + 1}（${w.why.slice(0, 22)}…）：不是 8/8，反馈“不对哦”，红心 -1，XP 不变，不泄露隐藏用例`, !r.summary.includes("8/8") && r.marks.some((m) => !m) && /不对哦/.test(r.fb) && r.after.hearts === r.before.hearts - 1 && r.after.xp === r.before.xp && noLeak(r.text).length === 0, `${r.summary} ${fmt(r.marks)} | ${r.fb.replace(/\n/g, " ").slice(0, 60)}`);
      console.log(`   ℹ️ 记录：错误写法 ${i + 1} → ${r.summary} ${fmt(r.marks)}`);
      await r.ctx.close();
    }
  }

  { // ⑥ 草稿
    const { ctx, page } = await open();
    await mount(page); await answerFrontToCodeTask(page);
    const draft = task.code.replace("def bill(price, cups):", "def bill(price, cups=1):  # 我改到一半");
    await setCode(page, draft);
    await page.waitForTimeout(900);
    const keys = await draftKeys(page);
    check("⑥ 草稿写进独立的键（…draft.<人>.U8L7-M1.v1），不碰学习进度", keys.length === 1 && /U8L7-M1\.v1$/.test(keys[0]), JSON.stringify(keys));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await mount(page); await answerFrontToCodeTask(page);
    check("⑥ 刷新后重新进入：编辑器恢复修改中的代码", (await page.evaluate(() => window.__app.currentArea.code())) === draft);
    await ctx.close();
  }

  // ⑦ 结算与变化题：两条路径的最终 XP 必须相同（变化题不重复加 XP）
  const finish = async (page) => {
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForSelector(".finish", { timeout: 20000 });
    return { stat: await stat(page), text: (await page.locator(".finish").innerText()).replace(/\s+/g, " ").slice(0, 200) };
  };
  let xpA;
  { // 路径 A：没看参考解法，一次通过
    const { ctx, page, errors } = await open();
    await mount(page); await answerFrontToCodeTask(page);
    const s0 = await stat(page);
    await setCode(page, REF);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 90000 });
    const sOk = await stat(page);
    const fin = await finish(page);
    xpA = fin.stat.xp - s0.xp; // 从“前三题答完、开始写代码”算起，本关代码题到通关一共加的 XP
    show("⑦ 路径 A 通关页", fin.text);
    check("⑦ 路径 A（没看参考解法）：直接结算，不出变化题，答对当下 XP +10", sOk.xp === s0.xp + 10 && !(await page.evaluate(() => !!(window.__app.currentArea && window.__app.currentArea.isVariation && window.__app.currentArea.isVariation()))), JSON.stringify([s0, sOk]));
    console.log(`   ℹ️ 记录：路径 A 本关合计 XP +${xpA}（${fin.text}）`);
    check("⑦ 路径 A 没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // 路径 B：看参考解法 → 原题通过后进入变化题 → 变化题通过才结算
    const V = task.variation;
    const { ctx, page, errors } = await open();
    await mount(page); await answerFrontToCodeTask(page);
    const hints = [];
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); hints.push(await page.locator(".overlay").innerText()); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    show("⑦ 第 1 级提示", hints[0]); show("⑦ 第 2 级提示", hints[1]); show("⑦ 第 3 次点小码（参考解法确认）", hints[2]);
    check("⑦ 第 1、2 级提示不含完整答案（没有 return amount - 5、没有 cups=1 的代码），第 3 次才问“看参考解法”", hints.slice(0, 2).every((h) => h.includes(task.hints[hints.indexOf(h)].slice(0, 12)) && !/return amount\s*-\s*5/.test(h) && !/cups\s*=\s*1/.test(h)) && /看参考解法/.test(hints[2]) && !/def bill\(price, cups=1\)/.test(hints[2]), hints.join(" || ").slice(0, 300));
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    const refShown = await page.locator(".overlay").innerText();
    check("⑦ 点“看参考解法”之后才展示参考解法（def bill(price, cups=1)）", /def bill\(price, cups=1\)/.test(refShown), refShown.slice(0, 160));
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, REF);
    const s0 = await stat(page);
    await page.locator("[data-check]").tap();
    await page.waitForSelector("[data-variation]", { timeout: 90000 });
    const vtext = await page.locator("[data-variation]").innerText();
    show("⑦ 变化题提示", vtext);
    check("⑦ 看过参考解法后原题通过：不结算，进入变化题", /变化题/.test(vtext) && /不多加 XP/.test(vtext) && (await page.evaluate(() => window.__app.currentArea.isVariation())), vtext);
    check("⑦ 进入变化题时 XP、红心不变", same(await stat(page), s0));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    const vintro = await appText(page);
    check("⑦ 变化题页面：题面写明满 60 减 12，公开例子 2 个，不泄露隐藏用例（总价正好 60 / 59 / 杯数多）", /满 60/.test(vintro) && V.tests.filter((t) => !t.hidden).every((t) => vintro.includes("调用：" + callStr(t))) && V.tests.filter((t) => t.hidden).every((t) => !vintro.includes(t.name) && !vintro.includes(callStr(t))), vintro.slice(0, 200));
    await setCode(page, REF); // 父题答案直接交：满 60 的隐藏用例会失败
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => /未通过/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 90000 });
    const vbad = await results$(page);
    show("⑦ 变化题：交原题答案", vbad);
    const pv = parse(vbad);
    check("⑦ 变化题交原题答案：不是全过，未通过的是隐藏用例（只说返回值不一致、不泄露期望值），红心和 XP 不变", !pv.summary.includes("5/5") && pv.marks.some((m) => !m) && V.tests.every((t, i) => !pv.marks[i] ? t.hidden : true) && !/期望返回 (48|88)/.test(vbad) && same(await stat(page), s0), `${pv.summary} ${fmt(pv.marks)}`);
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await setCode(page, V.solution);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 90000 });
    const vok = await results$(page);
    show("⑦ 变化题：正确答案", vok);
    const s1 = await stat(page);
    check("⑦ 变化题正确答案：5/5 组通过", /5\/5/.test(vok) && parse(vok).marks.length === 5 && parse(vok).marks.every(Boolean), vok.slice(0, 200));
    check("⑦ 变化题通过后才结算原题奖励：XP 只 +10（一次），红心不变", s1.xp === s0.xp + 10 && s1.hearts === s0.hearts, JSON.stringify([s0, s1]));
    const fin = await finish(page);
    const xpB = fin.stat.xp - s0.xp; // 同样从“前三题答完、开始写代码”算起
    show("⑦ 路径 B 通关页", fin.text);
    console.log(`   ℹ️ 记录：路径 A 本关代码题到通关共 XP +${xpA}；路径 B（看了参考解法、做了变化题）共 XP +${xpB}`);
    check("⑦ 变化题不重复加 XP：看参考解法 + 变化题的路径，通关总 XP 与没看解法的路径相同", xpB === xpA && xpA > 0, `A=+${xpA} B=+${xpB}`);
    check("⑦ 路径 B 没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
