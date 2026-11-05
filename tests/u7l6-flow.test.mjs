// U7L6「库存小程序」本地验收：用临时测试数据把 heldLessons 里的 L6 挂载成一关（不改任何内容文件、不进地图），
// 走真实编辑器 + 真实 Pyodide + 真实判题界面。确认：① 题面写明输入范围和三条规则；② 字典 stock 被注入成真正的 dict；
// ③ 五条路径（成交 / 正好卖完 / 不存在 / 库存不足 / 库存为 0）各自被单独判对错；④ 每个测试从独立的初始库存开始，前一组扣库存不影响后一组；
// ⑤ 参考解法全部通过，结算 XP；⑥ 变化题。
// 运行：npm run build && node tests/u7l6-flow.test.mjs        （也可以：DIST_DIR=某个构建产物目录 node tests/u7l6-flow.test.mjs）
//       MOBILE_BROWSER=webkit 换 WebKit；SHOTS_DIR=目录 保存截图；SHOW=1 打印实际看到的提示原文
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { createRequire } from "node:module";
const { chromium, webkit } = (() => { try { return createRequire(import.meta.url)("playwright"); } catch { return createRequire("/")("playwright"); } })();

const DIST = resolve(process.env.DIST_DIR || new URL("../dist", import.meta.url).pathname);
const PORT = 4351 + (process.env.MOBILE_BROWSER === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SHOTS = process.env.SHOTS_DIR || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SHOW = !!process.env.SHOW;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${process.env.MOBILE_BROWSER || "chromium"}-u7l6-${name}.png` }); };
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const show = (title, text) => { if (SHOW) console.log(`   ┌ ${title}\n${String(text).split("\n").map((l) => "   │ " + l).join("\n")}\n   └`); };

const unit7 = JSON.parse(readFileSync(new URL("../content/unit7.json", import.meta.url)));
const held = unit7.heldLessons.find((l) => l.id === "U7L6");
const task = held.pending[0].task;
// 临时测试数据：L6 的前三题 + 把待开放的代码题放在第 4 题（replaces: 4）
const LESSON = { ...held, pending: undefined, exercises: [...held.exercises.slice(0, held.pending[0].replaces - 1), { ...task }] };
const REF = task.reference;

const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const browserType = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

async function open(ctx0) {
  const ctx = ctx0 || await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
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
async function answerPicksToCodeTask(page) {
  for (let i = 0; i < 3; i++) { // 前三题：读报错选择题，按正确答案答
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


const NAMES = ["3 杯奶茶（成交）", "8 杯果茶（库存不足）", "咖啡（不存在）", "正好卖完", "库存已经是 0", "换表：不存在", "换表：成交"]; // 和 task.tests 的顺序一致；隐藏测试在界面里只显示“隐藏测试”，按顺序对应
const parse = (text) => ({ summary: (text.match(/(全部通过 ✓（\d+\/7 组）|还没通过：\d+\/7 组通过)/) || [""])[0], marks: [...text.matchAll(/^(✓ 通过|✗ 未通过)/gm)].map((m) => m[1].startsWith("✓")) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (marks) => marks.map((x, i) => `${x ? "✓" : "✗"}${NAMES[i]}`).join(" ");

// 每次都从全新页面开始（草稿、红心、XP 互不影响），走真实编辑器 + Pyodide，返回判题界面原文
async function checkOnFreshPage(code, { keepPage = false } = {}) {
  const o = await open();
  await mount(o.page); await answerPicksToCodeTask(o.page);
  await setCode(o.page, code);
  const before = await stat(o.page);
  await o.page.locator("[data-check]").tap();
  await o.page.waitForSelector(".feedbar.ok, .feedbar.bad", { timeout: 60000 });
  const text = await results$(o.page);
  const after = await stat(o.page);
  const fb = await o.page.locator(".feedbar").innerText();
  if (!keepPage) await o.ctx.close();
  return { ...o, text, before, after, fb, ...parse(text) };
}

try {
  { // ① 题面 + 运行起始程序
    const { ctx, page, errors } = await open();
    await mount(page);
    await answerPicksToCodeTask(page);
    const intro = await page.locator("#app").innerText();
    show("① 代码题页面文字", intro);
    check("① 题面写明输入范围：cups 是正整数、stock 里的库存是非负整数（可以是 0）", /输入范围/.test(intro) && /cups 是正整数/.test(intro) && /非负整数/.test(intro) && /可以是 0/.test(intro), intro.slice(0, 260));
    check("① 题面写明三条规则（不存在 / 库存不足 / 成交，正好卖完也算成交）和“最后都 print(stock)”", /① 饮品不存在/.test(intro) && /② 库存不足/.test(intro) && /③ 其余情况/.test(intro) && /正好卖完，剩 0 杯，也算成交/.test(intro) && /print\(stock\)/.test(intro));
    check("① 页面列出 3 个公开例子，库存表是字典写法 {\"奶茶\":12,\"果茶\":5}", (intro.match(/^例 \d/gm) || []).length === 3 && /stock = \{"奶茶":12,"果茶":5\}/.test(intro));
    check("① 编辑器里是起始程序（stock[name] = stock[name] - cups …）", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("stock[name] = stock[name] - cups"));
    await shot(page, "01-start");
    const s0 = await stat(page);
    await page.locator("[data-run]").tap();
    await page.waitForFunction(() => /成交|Error|错误/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const run = await results$(page);
    show("① 运行起始程序（按第 1 个例子）", run);
    check("① 运行起始程序：字典已注入，输出 成交，剩 9 杯 和 {'奶茶': 9, '果茶': 5}", /成交，剩 9 杯/.test(run) && /\{'奶茶': 9, '果茶': 5\}/.test(run), run);
    check("① 运行不计分：XP、红心不变，没有反馈条", same(await stat(page), s0) && (await page.locator(".feedbar").count()) === 0);
    check("① 前半段没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // ② 字典注入：stock 是真正的 dict，name 是 str，cups 是 int；打印后清零，三组公开例子仍各自看到完整的初始库存
    const r = await checkOnFreshPage('print(type(stock).__name__, type(name).__name__, type(cups).__name__)\nprint(stock)\nstock["奶茶"] = 0\nstock["果茶"] = 0\n');
    show("② 打印类型、再把库存清零", r.text);
    check("② 三个公开例子里都看到 “dict str int”（stock 是字典，name 是文字，cups 是整数）", (r.text.match(/dict str int/g) || []).length >= 3, r.text.slice(0, 300));
    const inits = (r.text.match(/你的输出\ndict str int\n\{'奶茶': 12, '果茶': 5\}/g) || []).length;
    check("② 每个公开例子打印出的都是完整的初始库存 {'奶茶': 12, '果茶': 5}（前一个例子把库存清零也没有影响后一个）", inits === 3, `匹配 ${inits} 次`);
  }

  { // ③ 五条路径：各用一个“只会其中几条路径”的程序，看判题界面是否把每条路径分开判对错
    const REF = task.reference;
    const ref = await checkOnFreshPage(REF);
    show("③ 参考解法", ref.text);
    check("③ 参考解法：7/7 全部通过，反馈条“答对了”，XP +10，红心不变", ref.summary.includes("7/7") && ref.marks.length === 7 && ref.marks.every(Boolean) && /答对了/.test(ref.fb) && ref.after.xp === ref.before.xp + 10 && ref.after.hearts === ref.before.hearts, ref.summary + JSON.stringify([ref.before, ref.after]));
    check("③ 公开例子显示真实名字，其余 4 个显示“隐藏测试”（共 7 组）", /通过 3 杯奶茶，够/.test(ref.text) && /通过 8 杯果茶，库存不足/.test(ref.text) && /通过 咖啡，不存在/.test(ref.text) && (ref.text.match(/隐藏测试/g) || []).length === 4);

    const CASES = [
      ["只会“成交”（起始程序）", task.code, [true, false, false, true, false, false, true], "库存不足、不存在两条路径都不对；成交（含正好卖完、换表）通过"],
      ["缺“库存不足”分支（只有 不存在 + 成交）", 'if name not in stock:\n    print("没有这个饮品")\nelse:\n    stock[name] = stock[name] - cups\n    print("成交，剩", stock[name], "杯")\nprint(stock)\n', [true, false, true, true, false, true, true], "库存不足、库存为 0 不对；其余通过"],
      ["缺“不存在”分支（只有 库存不足 + 成交）", 'if cups > stock[name]:\n    print("库存不足")\nelse:\n    stock[name] = stock[name] - cups\n    print("成交，剩", stock[name], "杯")\nprint(stock)\n', [true, true, false, true, true, false, true], "两个不存在用例报 KeyError；其余通过"],
      ["边界写成 >=（正好卖完被当成库存不足）", task.wrongAnswers[0].code, [true, true, true, false, true, true, true], "只有“正好卖完”不对"],
      ["顺序反了（先比较 stock[name] 再问有没有）", task.wrongAnswers[1].code, [true, true, false, true, true, false, true], "不存在用例 KeyError"],
      ["用 .get(name, 0)，不存在被当成库存不足", task.wrongAnswers[2].code, [true, true, false, true, true, false, true], "不存在用例输出“库存不足”"],
      ["忘了最后的 print(stock)", REF.replace(/\nprint\(stock\)\n$/, "\n"), [false, false, false, false, false, false, false], "每条路径都少一行"],
    ];
    for (const [title, code, want, note] of CASES) {
      const r = await checkOnFreshPage(code);
      show(`③ ${title}`, r.text);
      check(`③ ${title}：逐组结果 = ${fmt(want)}`, same(r.marks, want) && r.after.hearts === r.before.hearts - 1 && /不对哦/.test(r.fb), `${r.summary} ${fmt(r.marks)} | ${r.fb.replace(/\n/g, " ")}`);
    }
    // 五条路径对应：成交=第 1 组；正好卖完=第 4 组；不存在=第 3、6 组；库存不足=第 2 组；库存为 0=第 5 组。上面 7 种程序让它们分别单独通过 / 失败。
  }

  { // ④ 每个测试从独立的初始库存开始
    const A = await checkOnFreshPage(task.reference + "stock.clear()\n");
    check("④ 参考解法后面再 stock.clear()：仍然 7/7（每组都拿到自己的完整初始库存，前一组的扣减 / 清空不会带到后一组）", A.summary.includes("7/7"), A.summary + fmt(A.marks));
    check("④ “正好卖完”期望奶茶还是 12：说明第 1 组把奶茶扣到 9 之后，第 4 组仍从 12 开始", task.tests[3].expected.includes("'奶茶': 12") && task.tests[0].expected.includes("'奶茶': 9") && A.summary.includes("7/7"));
    // 同一页：先交一个会扣库存的错误程序，再交正确的——上一次检查不能留下任何状态
    const o = await checkOnFreshPage(task.code, { keepPage: true });
    check("④ 同一页第一次检查（起始程序，会扣库存，3/7）", o.summary.includes("3/7"), o.summary);
    await o.page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await o.page.locator("[data-continue]").tap();
    await o.page.waitForSelector("[data-code-task]");
    await setCode(o.page, task.reference);
    await o.page.locator("[data-check]").tap();
    await o.page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const t2 = await results$(o.page);
    check("④ 同一页第二次检查（参考解法）：7/7 通过，上一次扣过库存不影响这一次", parse(t2).summary.includes("7/7"), parse(t2).summary);
    check("④ 整个流程没有脚本错误", o.errors.length === 0, o.errors.join(" | "));
    await o.ctx.close();
  }

  { // ⑤ 通关结算（没看参考解法）
    const { ctx, page, errors } = await open();
    await mount(page); await answerPicksToCodeTask(page);
    const s0 = await stat(page);
    await setCode(page, task.reference);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForTimeout(800);
    const end = await page.evaluate(() => ({ variation: !!(window.__app.currentArea && window.__app.currentArea.isVariation && window.__app.currentArea.isVariation()), text: document.querySelector("#app").innerText.slice(0, 160) }));
    const s1 = await stat(page);
    show("⑤ 通过后继续", JSON.stringify(end));
    check("⑤ 没看参考解法就答对：直接结算过关，不出变化题，本关 XP +50", end.variation === false && /通关/.test(end.text) && /\+50/.test(end.text) && s1.xp >= s0.xp + 10, JSON.stringify([end, s0, s1]));
    check("⑤ 结算流程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // ⑥ 草稿
    const { ctx, page } = await open();
    await mount(page); await answerPicksToCodeTask(page);
    const draft = 'if name not in stock:\n    print("没有这个饮品")  # 我改到一半\n';
    await setCode(page, draft);
    await page.waitForTimeout(900);
    const keys = await draftKeys(page);
    check("⑥ 草稿写进独立的键（…draft.<人>.U7L6-M1.v1），不碰学习进度", keys.length === 1 && /U7L6-M1\.v1$/.test(keys[0]), JSON.stringify(keys));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await mount(page); await answerPicksToCodeTask(page);
    check("⑥ 刷新后重新进入：编辑器恢复修改中的代码", (await page.evaluate(() => window.__app.currentArea.code())) === draft);
    await ctx.close();
  }

  { // ⑦ 看参考解法后 → 变化题（库存不足，还差 N 杯）
    const V = task.variation;
    const { ctx, page, errors } = await open();
    await mount(page); await answerPicksToCodeTask(page);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, task.reference);
    const s0 = await stat(page);
    await page.locator("[data-check]").tap();
    await page.waitForSelector("[data-variation]", { timeout: 60000 });
    const vtext = await page.locator("[data-variation]").innerText();
    show("⑦ 变化题提示", vtext);
    check("⑦ 看过参考解法后原题通过：不结算，进入变化题（库存不足，还差 N 杯）", /变化题/.test(vtext) && /还差 N 杯/.test(vtext) && (await page.evaluate(() => window.__app.currentArea.isVariation())), vtext);
    check("⑦ 进入变化题时 XP、红心不变", same(await stat(page), s0));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await setCode(page, task.reference); // 原题答案直接交：库存不足时不会写“还差 N 杯”
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => /未通过/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const vbad = await results$(page);
    show("⑦ 变化题：交原题答案", vbad);
    check("⑦ 变化题交原题答案：指出 8 杯果茶期望“库存不足，还差 3 杯”，红心不变", /8 杯果茶/.test(vbad) && /库存不足，还差 3 杯/.test(vbad) && (await stat(page)).hearts === s0.hearts, vbad.slice(0, 300));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await setCode(page, V.solution);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const vok = await results$(page);
    show("⑦ 变化题：正确答案", vok);
    const s1 = await stat(page);
    check("⑦ 变化题正确答案：5/5 组通过（含 差 8 杯、正好卖完、不存在）", /5\/5/.test(vok) && parse(vok).marks.length === 5 && parse(vok).marks.every(Boolean), vok.slice(0, 200));
    check("⑦ 变化题通过后才结算原题奖励（XP +10 一次），红心不变", s1.xp === s0.xp + 10 && s1.hearts === s0.hearts, JSON.stringify([s0, s1]));
    check("⑦ 变化题流程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
  { // ⑧ 变化题走完整个关卡：XP 只结算一次（结算在变化题通过时，不在原题通过时；通过后再点“检查”不重复结算；最后总 XP 和没看参考解法的正常通关一样）
    const VCODE = task.variation.solution;
    const normal = await (async () => {
      const { ctx, page } = await open(); await mount(page); await answerPicksToCodeTask(page);
      const a = await stat(page); await setCode(page, task.reference); await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
      const b = await stat(page); await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled); await page.locator("[data-continue]").tap(); await page.waitForTimeout(1200);
      const c = await stat(page); const text = await page.locator("#app").innerText(); await ctx.close(); return { a, b, c, text };
    })();
    const { ctx, page, errors } = await open(); await mount(page); await answerPicksToCodeTask(page);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, task.reference); const v0 = await stat(page);
    await page.locator("[data-check]").tap(); await page.waitForSelector("[data-variation]", { timeout: 60000 });
    const v1 = await stat(page);
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {}); if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]"); await setCode(page, VCODE);
    await page.locator("[data-check]").tap(); await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const v2 = await stat(page);
    await page.locator("[data-check]").tap({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(800); // 通过后再点“检查”（如果按钮还在）
    const v3 = await stat(page);
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled); await page.locator("[data-continue]").tap(); await page.waitForTimeout(1200);
    const v4 = await stat(page); const vtext = await page.locator("#app").innerText();
    show("⑧ 正常通关结束页", normal.text); show("⑧ 变化题通关结束页", vtext);
    check("⑧ 正常通关：XP 依次 +0 → +10（答对）→ +20（通关），本关显示 +50", normal.b.xp === normal.a.xp + 10 && normal.c.xp === normal.a.xp + 20 && /本关 XP/.test(normal.text) && /\+50/.test(normal.text), JSON.stringify([normal.a, normal.b, normal.c]));
    check("⑧ 变化题：原题通过时 XP 不变（0），变化题通过时才 +10（只这一次）", v1.xp === v0.xp && v2.xp === v0.xp + 10, JSON.stringify([v0, v1, v2]));
    check("⑧ 变化题通过后再点“检查”：XP 不再增加", v3.xp === v2.xp, JSON.stringify([v2, v3]));
    check("⑧ 变化题走完整关：最终 XP 和正常通关一样（总共 +20，不是 +30），本关显示 +50、红心不变", v4.xp === v0.xp + 20 && v4.xp - v0.xp === normal.c.xp - normal.a.xp && /本关 XP/.test(vtext) && /\+50/.test(vtext) && v4.hearts === v0.hearts, JSON.stringify([v0, v4, vtext.slice(0, 80)]));
    check("⑧ 结算流程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
