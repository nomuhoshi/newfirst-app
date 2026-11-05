// U6L6「修好收银程序」本地验收：用临时测试数据把 heldLessons 里的 L6 挂载成一关（不改任何内容文件、不进地图），
// 走真实编辑器 + 真实 Pyodide + 真实判题界面。确认：① 起始代码显示可读的 TypeError；② 修完类型错误但仍写 > 5 时，
// 正好 5 杯的用例清楚指出金额差异；③ 改成 >= 5 后通过；④ 修改中的草稿刷新后保留。
// 运行：npm run build && node tests/u6l6-flow.test.mjs        （也可以：DIST_DIR=某个构建产物目录 node tests/u6l6-flow.test.mjs）
//       MOBILE_BROWSER=webkit 换 WebKit；SHOTS_DIR=目录 保存截图；SHOW=1 打印实际看到的提示原文
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(process.env.DIST_DIR || new URL("../dist", import.meta.url).pathname);
const PORT = 4347 + (process.env.MOBILE_BROWSER === "webkit" ? 1 : 0), BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".mp3": "audio/mpeg", ".ogg": "audio/ogg", ".wav": "audio/wav" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const SHOTS = process.env.SHOTS_DIR || ""; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const SHOW = !!process.env.SHOW;
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${process.env.MOBILE_BROWSER || "chromium"}-u6l6-${name}.png` }); };
const results = [];
const check = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const show = (title, text) => { if (SHOW) console.log(`   ┌ ${title}\n${String(text).split("\n").map((l) => "   │ " + l).join("\n")}\n   └`); };

const unit6 = JSON.parse(readFileSync(new URL("../content/unit6.json", import.meta.url)));
const held = unit6.heldLessons.find((l) => l.id === "U6L6");
const task = held.pending[0].task;
// 临时测试数据：L6 的前三题 + 把待开放的代码题放在第 4 题（replaces: 4）
const LESSON = { ...held, pending: undefined, exercises: [...held.exercises.slice(0, held.pending[0].replaces - 1), { ...task }] };
const FIX_TYPES_KEEP_GT = 'total = int(price) * int(cups)\nif int(cups) > 5:\n    total = total - 5\nprint("应付：" + str(total))\n';
const FIX_ALL = task.reference;

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

try {
  { // ① 起始代码 ② 只改类型、仍写 > 5 ③ 改成 >= 5
    const { ctx, page, errors } = await open();
    await mount(page);
    check("L6 前三题（读报错选择题）按示例顺序可以答完，进入代码题", await (async () => { await answerPicksToCodeTask(page); return true; })());
    const intro = await page.locator("#app").innerText();
    show("代码题页面文字", intro);
    check("题面写明 price、cups 是表示整数的文字，并要求一处一处改", /表示整数的文字/.test(intro) && /一处一处改好/.test(intro), intro.slice(0, 200));
    check("编辑器里是起始代码（total = price * cups …）", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("total = price * cups"));
    await shot(page, "01-start");

    // ① 运行起始代码：可读的 TypeError
    const s0 = await stat(page);
    await page.locator("[data-run]").tap();
    await page.waitForFunction(() => /运行结果|TypeError|错误/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const run1 = await results$(page);
    show("① 运行起始代码看到的提示", run1);
    check("① 起始代码运行：显示 TypeError、第 1 行和 Python 的原信息", /TypeError/.test(run1) && /第 1 行/.test(run1) && /can't multiply sequence by non-int of type 'str'/.test(run1), run1);
    check("① 起始代码运行：有一句中文解释（文字和数字不能放在一起用）", /类型错误/.test(run1) && /文字和数字/.test(run1), run1);
    check("① 运行不计分：XP 和红心不变，没有反馈条", JSON.stringify(await stat(page)) === JSON.stringify(s0) && (await page.locator(".feedbar").count()) === 0);
    await shot(page, "02-typeerror");

    // 检查起始代码：同样的 TypeError，答错
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad, .feedbar.ok", { timeout: 60000 });
    const chk1 = await results$(page);
    show("① 检查起始代码看到的提示", chk1);
    check("① 检查起始代码：判为答错并显示同一个 TypeError（不是“没有输出”之类）", (await page.locator(".feedbar.bad").count()) === 1 && /TypeError/.test(chk1), chk1.slice(0, 200));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");

    // ② 只修类型错误，仍写 > 5：正好 5 杯算出 50，应该是 45
    await setCode(page, FIX_TYPES_KEEP_GT);
    const s1 = await stat(page);
    await page.locator("[data-run]").tap();
    await page.waitForFunction(() => /应付：/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const run2 = await results$(page);
    show("② 修完类型错误（仍是 > 5）后运行第一个公开例子（3 杯）", run2);
    check("② 修完类型错误后运行：不再报错，3 杯显示 应付：36", /应付：36/.test(run2) && !/TypeError/.test(run2), run2);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.bad", { timeout: 60000 });
    const chk2 = await results$(page);
    show("② 检查：修完类型错误但仍写 > 5", chk2);
    check("② 判为答错，红心 -1", (await stat(page)).hearts === s1.hearts - 1, JSON.stringify([s1, await stat(page)]));
    check("② 3 杯用例通过（能运行）、「正好 5 杯」用例未通过", /3 杯/.test(chk2) && /正好 5 杯/.test(chk2), chk2.slice(0, 300));
    check("② 清楚指出金额差异：期望 应付：45，你的 应付：50，第 1 行不同", /期望输出/.test(chk2) && /应付：45/.test(chk2) && /你的输出/.test(chk2) && /应付：50/.test(chk2) && /第 1 行不同/.test(chk2), chk2);
    check("② 隐藏用例只给分类提示，不泄露期望金额", /隐藏测试/.test(chk2) && !/应付：43/.test(chk2) && !/应付：36\b[\s\S]*隐藏/.test(""), chk2.slice(-200));
    await shot(page, "03-boundary-wrong");
    check("② 反馈条不直接给出参考答案", !/>= 5/.test(await page.locator(".feedbar").innerText()));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");

    // ③ 改成 >= 5
    await setCode(page, FIX_ALL);
    const s2 = await stat(page);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const s3 = await stat(page);
    const chk3 = await results$(page);
    show("③ 改成 >= 5 后检查", chk3);
    check("③ 改成 >= 5：判为答对，XP +10，红心不变", s3.xp === s2.xp + 10 && s3.hearts === s2.hearts, JSON.stringify([s2, s3]));
    check("③ 所有公开和隐藏用例通过（没有“未通过”）", !/未通过/.test(chk3), chk3.slice(0, 300));
    check("③ 反馈条显示“答对了”", /答对了/.test(await page.locator(".feedbar").innerText()));
    await shot(page, "04-passed");
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled);
    await page.locator("[data-continue]").tap();
    await page.waitForTimeout(800);
    const afterPass = await page.evaluate(() => ({ variation: !!(window.__app.currentArea && window.__app.currentArea.isVariation && window.__app.currentArea.isVariation()), text: document.querySelector("#app").innerText.slice(0, 160) }));
    show("通过后继续", JSON.stringify(afterPass));
    check("没看参考解法就答对：直接结算过关（不出变化题），本关 XP +50", afterPass.variation === false && /通关/.test(afterPass.text) && /\+50/.test(afterPass.text), JSON.stringify(afterPass));
    check("整个流程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }

  { // ④ 草稿：修改中刷新后保留
    const { ctx, page } = await open();
    await mount(page);
    await answerPicksToCodeTask(page);
    const draft = 'total = int(price) * int(cups)\nif int(cups) > 5:  # 我改到一半\n';
    await setCode(page, draft);
    await page.waitForTimeout(900); // 草稿是延迟保存的
    const keys = await draftKeys(page);
    show("草稿键", keys.join("\n"));
    check("④ 草稿写进独立的键（…draft.<人>.U6L6-M1.v1），不碰学习进度", keys.length === 1 && /U6L6-M1\.v1$/.test(keys[0]), JSON.stringify(keys));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    await mount(page);
    await answerPicksToCodeTask(page);
    const restored = await page.evaluate(() => window.__app.currentArea.code());
    check("④ 刷新后重新进入这一关：编辑器恢复修改中的代码", restored === draft, JSON.stringify(restored));
    await shot(page, "05-draft-restored");
    await page.locator("[data-reset]").tap();
    await page.getByRole("button", { name: "重新开始", exact: true }).last().tap();
    check("④ 「重新开始」二次确认后回到起始代码，草稿被清", (await page.evaluate(() => window.__app.currentArea.code())).startsWith("total = price * cups") && (await draftKeys(page)).length === 0);
    await ctx.close();
  }

  { // ⑤ 看过参考解法再通过：进入变化题（不多加 XP、答错不扣红心）
    const { ctx, page, errors } = await open();
    await mount(page);
    await answerPicksToCodeTask(page);
    for (let i = 0; i < 3; i++) { await page.locator(".mascot-btn").tap(); if (i < 2) await page.locator(".overlay").getByRole("button", { name: "好的" }).tap(); }
    await page.locator(".overlay").getByRole("button", { name: "看参考解法" }).tap();
    await page.locator(".overlay").getByRole("button", { name: "好的" }).tap();
    await setCode(page, FIX_ALL);
    const s0 = await stat(page);
    await page.locator("[data-check]").tap();
    await page.waitForSelector("[data-variation]", { timeout: 60000 });
    const vtext = await page.locator("[data-variation]").innerText();
    show("⑤ 看过参考解法后通过原题，看到的提示", vtext);
    check("⑤ 看过参考解法后原题通过：不结算，进入变化题（满 4 杯减 3 元）", /变化题/.test(vtext) && /满 4 杯/.test(vtext) && (await page.evaluate(() => window.__app.currentArea.isVariation())), vtext);
    check("⑤ 进入变化题时 XP、红心不变", JSON.stringify(await stat(page)) === JSON.stringify(s0), JSON.stringify([s0, await stat(page)]));
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await shot(page, "06-variation");
    // 变化题先写错（仍是 >= 5 的界线）：不扣红心
    await setCode(page, FIX_ALL.replace(/total = total - 5/, "total = total - 3"));
    await page.locator("[data-check]").tap();
    await page.waitForFunction(() => /未通过/.test(document.querySelector("[data-results]")?.textContent || ""), null, { timeout: 60000 });
    const vbad = await results$(page);
    show("⑤ 变化题：界线写成 5（应是 4）", vbad);
    check("⑤ 变化题写错：指出 4 杯用例的金额差异，红心不变", /未通过/.test(vbad) && /4 杯/.test(vbad) && (await stat(page)).hearts === s0.hearts, vbad.slice(0, 300));
    const vokCode = 'total = int(price) * int(cups)\nif int(cups) >= 4:\n    total = total - 3\nprint("应付：" + str(total))\n';
    await page.waitForFunction(() => !document.querySelector("[data-continue]")?.disabled).catch(() => {});
    if (await page.locator("[data-continue]").count()) await page.locator("[data-continue]").tap();
    await page.waitForSelector("[data-code-task]");
    await setCode(page, vokCode);
    await page.locator("[data-check]").tap();
    await page.waitForSelector(".feedbar.ok", { timeout: 60000 });
    const s1 = await stat(page);
    check("⑤ 变化题通过后才结算原题奖励（XP +10 一次）", s1.xp === s0.xp + 10 && s1.hearts === s0.hearts, JSON.stringify([s0, s1]));
    check("⑤ 变化题流程没有脚本错误", errors.length === 0, errors.join(" | "));
    await ctx.close();
  }
} finally {
  await browser.close(); srv.closeAllConnections(); srv.close();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
