// 上线前端到端测试：用户的关键路径，真实点击（触屏 tap），不直接改状态。
// 按产品优先级：①第一次进入 / 开场介绍 → ②打开课程（关卡地图 → 关卡弹窗 → 开场） → ③运行 Python（答题后“运行结果”是真实 Pyodide 输出）
// → ④答题并保存（XP、红心、通关写进本机记录） → ⑤刷新后状态恢复（不再出开场、XP / 通关 / 解锁保留）。
// 同一套测试跑 WebKit 和 Chromium：MOBILE_BROWSER=webkit|chromium（默认 chromium）。浏览器起不来 → 退出码 2（环境失败，不算通过）。
// 运行：npm run build && npm run test:e2e   （两个内核都跑；也可 npm run test:e2e -- webkit）
// 只读题目数据（window.__app.currentEx）来决定点哪个答案，不改题目、不改判分。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DIST = join(ROOT, "dist");
const ENGINE = process.env.MOBILE_BROWSER || "chromium";
const PORT = ENGINE === "webkit" ? 4372 : 4371, BASE = `http://localhost:${PORT}/`;
const KEY = "suipian.progress";
let playwright;
try { playwright = await import("playwright"); } catch (e) { console.log(`环境失败：无法加载 playwright（${e.message}）`); process.exit(2); }
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
let browser;
try { browser = await playwright[ENGINE].launch(); }
catch (e) { console.log(`环境失败：${ENGINE} 无法启动（${String(e.message).split("\n")[0]}）`); process.exit(2); }

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".zip": "application/zip", ".svg": "image/svg+xml", ".wav": "audio/wav", ".whl": "application/octet-stream" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));

const results = [];
const check = (group, name, ok, detail = "") => { results.push({ group, name, ok: !!ok }); console.log(`${ok ? "✅" : "❌"} [${ENGINE}] [${group}] ${name}${detail ? "  — " + detail : ""}`); };
const device = ENGINE === "webkit" ? playwright.devices["iPhone 13"] : playwright.devices["Pixel 7"];

const ctx = await browser.newContext({ ...device, serviceWorkers: "block" });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.message).split("\n")[0]));
const readState = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k) || "null"), KEY);
const tapText = (sel, text) => page.locator(sel, { hasText: text }).first().tap();

// 按题目数据点出正确答案（predict / fill / order）；wrong=true 时故意答错（选一个错误选项）
async function answer(wrong = false) {
  const ex = await page.evaluate(() => window.__app.currentEx);
  if (ex.type === "predict") {
    const i = ex.options.findIndex((o) => (wrong ? !o.correct : o.correct));
    await page.locator(".choices .choice").nth(i).tap();
  } else if (ex.type === "fill") {
    if (wrong) throw new Error("wrong 只用于 predict");
    const n = (ex.code.match(/\{\d+\}/g) || []).length;
    for (let k = 0; k < n; k++) {
      await page.locator(`[data-slot="${k}"]`).tap();
      await page.locator(`.bank-tokens [data-token=${JSON.stringify(ex.answer[k])}]`).first().tap();
    }
  } else if (ex.type === "order") {
    if (wrong) throw new Error("wrong 只用于 predict");
    for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).first().tap();
  } else throw new Error("不支持的题型 " + ex.type);
  return ex;
}
const checkBtn = () => page.locator("[data-check]");
const contBtn = () => page.locator(".feedbar [data-continue]");
async function submitAndContinue() {
  await checkBtn().tap();
  await page.locator(".feedbar").waitFor();
  await page.waitForFunction(() => !document.querySelector(".feedbar [data-continue]")?.disabled);
}
const outText = () => page.locator(".outpanel pre").textContent();
const waitRun = () => page.waitForFunction(() => { const t = document.querySelector(".outpanel pre")?.textContent || ""; return t && t !== "运行中…"; }, null, { timeout: 90000 });

try {
  // ---------- ① 第一次进入：开场介绍 ----------
  const G1 = "①第一次进入";
  await page.goto(BASE);
  await page.locator(".onboard").waitFor({ timeout: 15000 });
  check(G1, "全新用户先看到开场介绍", await page.locator(".onboard h1").textContent() === "你好，我是小码！");
  check(G1, "加载兜底提示没有出现", (await page.locator("#load-fallback").count()) === 0);
  await page.locator(".onboard .btn3d.primary").tap();
  await page.locator(".onboard .btn3d.primary").tap();
  check(G1, "第三页按钮是“开始学习”", (await page.locator(".onboard .btn3d.primary").textContent()) === "开始学习");
  await page.locator(".onboard .btn3d.primary").tap();
  await page.locator(".pathview").waitFor();
  const s0 = await readState();
  check(G1, "点“开始学习”后进入关卡地图，并记下已看过开场", !!s0?.onboarded, `xp=${s0?.xp} hearts=${s0?.hearts}`);
  check(G1, "第一关是当前关、显示“从这里开始”", (await page.locator('[data-lesson="U1L1"].current').count()) === 1 && (await page.locator(".bubble").first().textContent()) === "从这里开始");
  check(G1, "第二关未解锁", (await page.locator('[data-lesson="U1L2"].locked').count()) === 1);

  // ---------- ② 打开课程 ----------
  const G2 = "②打开课程";
  await page.locator('[data-lesson="U1L2"]').tap();
  check(G2, "点未解锁关卡：提示先完成前面的关卡，不能开始", await page.locator(".sheet", { hasText: "先完成前面的关卡" }).count() === 1);
  await tapText(".sheet button", "知道了");
  await page.locator(".sheet").waitFor({ state: "detached" });
  await page.locator('[data-lesson="U1L1"]').tap();
  const startBtn = page.locator(".sheet button", { hasText: "开始 +" });
  check(G2, "点当前关：弹出关卡说明和“开始”按钮", (await startBtn.count()) === 1, await startBtn.textContent());
  await startBtn.tap();
  await page.locator(".intro-screen").waitFor();
  check(G2, "进入关卡开场（故事 + 示例代码）", (await page.locator(".intro-title").textContent()).length > 0);
  await page.locator(".lessonfoot .btn3d.primary").tap();
  await page.locator("h2.q").waitFor();
  check(G2, "进入第 1 题，“检查”在作答前不可点", await checkBtn().isDisabled());

  // ---------- ③ 运行 Python + ④ 答题并保存 ----------
  const G3 = "③运行 Python", G4 = "④答题并保存";
  // 第 1 题故意答错一次（检查扣红心、错题回到最后）
  let ex = await page.evaluate(() => window.__app.currentEx);
  const firstPrompt = ex.prompt;
  if (ex.type === "predict") {
    await answer(true);
    check(G4, "选好答案后“检查”可点", !(await checkBtn().isDisabled()));
    await submitAndContinue();
    check(G4, "答错：显示“不对哦”和正确答案", (await page.locator(".feedbar.bad").count()) === 1 && (await page.locator(".fb-answer").count()) === 1);
    const sw = await readState();
    check(G4, "答错：红心 -1 并立即写进本机记录", sw.hearts === 4, `hearts=${sw.hearts}`);
    await waitRun();
    const out = await outText();
    const want = ex.options.find((o) => o.correct).text;
    check(G3, "答题后“运行结果”是真实 Python 输出（与正确选项一致）", out.trim() === want.trim(), JSON.stringify(out.slice(0, 60)));
    await contBtn().tap();
  }
  let answered = 0, xpSeen = [];
  for (let guard = 0; guard < 12; guard++) {
    if (await page.locator(".finish").count()) break;
    await page.locator("h2.q").waitFor();
    ex = await answer(false);
    await submitAndContinue();
    const ok = (await page.locator(".feedbar.ok").count()) === 1;
    answered++;
    const st = await readState();
    xpSeen.push(st.xp);
    if (!ok) { check(G4, `第 ${answered} 次作答按题目答案点选应判对`, false, ex.prompt); }
    if (answered === 1 || ex.type !== "predict") {
      await waitRun();
      const out = await outText();
      const good = !/没有加载成功|离线|错误/.test(out) && out !== "运行中…";
      check(G3, `${ex.type} 题：运行结果来自真实 Python`, good, JSON.stringify(out.slice(0, 60)));
    }
    await contBtn().tap();
  }
  check(G4, "全部题答完进入通关页", (await page.locator(".finish").count()) === 1, `作答 ${answered} 次`);
  check(G4, "答错的第 1 题在最后再出现一次", answered === 4 || ex.prompt === firstPrompt, `最后一题：${ex.prompt.slice(0, 30)}`);
  check(G4, "每答对一题 XP 立即写进本机记录（递增）", xpSeen.every((v, i) => i === 0 || v > xpSeen[i - 1]), xpSeen.join(","));
  const sf = await readState();
  check(G4, "通关后记录：第一关完成、XP = 4×10 + 通关 10 = 50、连续 1 天", sf.done.U1L1 === true && sf.xp === 50 && sf.lessonsCompleted === 1, `xp=${sf.xp} done=${Object.keys(sf.done)} streak=${sf.streak}`);
  await page.locator(".finish [data-continue]").tap();
  await page.locator(".pathview").waitFor();
  check(G4, "回到地图：第一关已完成，第二关解锁为当前关", (await page.locator('[data-lesson="U1L1"].done').count()) === 1 && (await page.locator('[data-lesson="U1L2"].current').count()) === 1);
  const statXp = await page.locator(".statsbar .xp").textContent();
  check(G4, "顶部 XP 显示 50", statXp.trim() === "50", statXp);

  // ---------- ⑤ 刷新后状态恢复 ----------
  const G5 = "⑤刷新恢复";
  await page.reload();
  await page.locator(".pathview, .onboard").first().waitFor();
  check(G5, "刷新后不再显示开场介绍，直接进地图", (await page.locator(".onboard").count()) === 0 && (await page.locator(".pathview").count()) === 1);
  check(G5, "刷新后第一关仍是已完成、第二关是当前关", (await page.locator('[data-lesson="U1L1"].done').count()) === 1 && (await page.locator('[data-lesson="U1L2"].current').count()) === 1);
  check(G5, "刷新后 XP、红心保留", (await page.locator(".statsbar .xp").textContent()).trim() === "50" && (await page.locator(".statsbar .hearts").textContent()).trim() === "4");
  // 关卡中途刷新：答题位置按设计不保存（docs：“恢复到第几题”是后续功能），但已得 XP 保留、回到地图、不会崩
  await page.locator('[data-lesson="U1L2"]').tap();
  await page.locator(".sheet button", { hasText: "开始 +" }).tap();
  await page.locator(".lessonfoot .btn3d.primary").tap();
  await page.locator("h2.q").waitFor();
  await answer(false); await submitAndContinue();
  const mid = await readState();
  await page.reload();
  await page.locator(".pathview").waitFor();
  const after = await readState();
  check(G5, "关卡中途刷新：回到地图，已得 XP 保留", after.xp === mid.xp && mid.xp === 60, `xp ${mid.xp} → ${after.xp}`);
  check(G5, "关卡中途刷新：这一关没有被误记为完成", !after.done.U1L2 && (await page.locator('[data-lesson="U1L2"].current').count()) === 1);

  check("全程", "没有未捕获的页面错误", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  check("全程", "脚本异常（记为失败）", false, String(e.message).split("\n")[0]);
  await page.screenshot({ path: join(ROOT, `tests/e2e/failure-${ENGINE}.png`) }).catch(() => {});
} finally {
  await browser.close(); srv.close();
}
const fails = results.filter((r) => !r.ok).length;
console.log(`== e2e ${ENGINE}: ${results.length - fails}/${results.length} 通过`);
process.exit(fails ? 1 : 0);
