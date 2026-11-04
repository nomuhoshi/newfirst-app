// 实验预览：U3 前 2 关接进地图的自动测试（EXP=u3 构建的 dist-exp/；先 npm run build:exp）。
// 覆盖：地图出现 U3 两关、从解锁到通关完整玩一遍、答错时显示真实 Python 输出、XP/红心规则不变、存储隔离。桌面 Chromium 手机模拟，不能代替 iPhone 真机。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";

const DIST = resolve(new URL("../dist-exp", import.meta.url).pathname);
const PORT = 4391, BASE = `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS_DIR; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".wasm": "application/wasm", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist-exp，先运行 npm run build:exp"); process.exit(2); }
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE); let p = join(DIST, decodeURIComponent(url.pathname));
  if (!p.startsWith(DIST)) { resp.writeHead(403).end(); return; }
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { resp.writeHead(404).end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }).end(readFileSync(p));
});
await new Promise((r) => srv.listen(PORT, r));

let browser;
try { browser = await chromium.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.close(); process.exit(2); }



async function answer(page, ok) {
  const e = await page.evaluate(() => window.__app.currentEx);
  if (e.type === "predict") { const i = e.options.findIndex((o) => !!o.correct === ok); await page.locator(".choice").nth(i).tap(); }
  else if (e.type === "fill") {
    for (let i = 0; i < e.answer.length; i++) {
      await page.locator(`[data-slot="${i}"]`).tap();
      const t = ok ? e.answer[i] : e.tokens.find((x) => !e.answer.includes(x));
      await page.locator(`[data-token="${t.replace(/"/g, '\\"')}"]`).first().tap();
    }
  } else { const seq = ok ? e.answers[0] : null; for (const k of seq) await page.locator(`.order-bank [data-line="${k}"]`).tap(); }
  await page.locator("[data-check]").tap(); await page.waitForSelector("[data-continue]:not([disabled])");
  return e;
}

const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true, serviceWorkers: "block",
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" });
const page = await ctx.newPage();
const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `exp-u3-${name}.png`) }); };
try {
  await page.goto(BASE, { waitUntil: "domcontentloaded" }); await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; st.hearts = 5; st.xp = 300; st.done = Object.fromEntries(["U1L1", "U1L2", "U1L3", "U1L4", "U1L5", "U1L6", "U2L1", "U2L2", "U2L3", "U2L4", "U2L5"].map((k) => [k, true])); window.__app.persist(); window.__app.renderPath(); });
  await page.waitForSelector(".pathview .node");
  const keys = await page.evaluate(() => { const f = document.createElement("iframe"); document.body.append(f); const ls = f.contentWindow.localStorage; const ks = []; for (let i = 0; i < ls.length; i++) ks.push(ls.key(i)); f.remove(); return ks; });
  check("存储隔离：真实 localStorage 里只有 exp-u3: 前缀的键", keys.length > 0 && keys.every((k) => k.startsWith("exp-u3:")), keys.join(","));
  const map = await page.evaluate(() => ({ text: document.querySelector(".pathview").innerText, cur: document.querySelector(".node.current")?.dataset.lesson, nodes: [...document.querySelectorAll(".node")].map((n) => n.dataset.lesson).filter((x) => /^U3/.test(x)) }));
  check("地图出现「比较与判断」单元，当前关是 U3L1，U3 只有 2 关", /比较与判断/.test(map.text) && map.cur === "U3L1" && map.nodes.join() === "U3L1,U3L2", JSON.stringify({ cur: map.cur, nodes: map.nodes }));
  await page.locator(".node.current").scrollIntoViewIfNeeded(); await shot("1-map");

  // ---- 第 1 关：第一题故意答错 ----
  await page.locator(".node.current").tap(); await page.locator(".overlay .btn3d.primary").tap(); await page.waitForSelector(".intro-title");
  const intro = await page.evaluate(() => document.querySelector(".intro-title")?.textContent + "|" + document.body.innerText);
  check("第 1 关开场：显示关名和故事", /够不够送小料/.test(intro) && /True/.test(intro));
  await shot("2-intro");
  await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]");
  await shot("3-question");
  const h0 = await page.evaluate(() => window.__app.getState().hearts);
  const e0 = await answer(page, false);
  const bad = await page.evaluate(() => ({ cls: document.querySelector(".feedbar").className, text: document.querySelector(".feedbar").innerText, hearts: window.__app.getState().hearts }));
  check("答错：扣 1 颗红心，反馈里有这个错误选项的解释", bad.cls.includes("bad") && bad.hearts === h0 - 1 && /不是 False|比较/.test(bad.text), bad.text.replace(/\s+/g, " ").slice(0, 80));
  await page.waitForFunction(() => /^(True|False)\s*$/.test((document.querySelector(".outpanel pre")?.textContent || "").trim()), null, { timeout: 90000 });
  const realOut = await page.evaluate(() => document.querySelector(".outpanel pre").textContent.trim());
  check("答错后“运行结果”是真实 Python 的输出（与期望一致）", realOut === "True", realOut);
  await shot("4-wrong");
  await page.locator("[data-continue]").tap();
  // ---- 剩下的全部答对（含答错那题的重练）----
  let guard = 0;
  while (guard++ < 10 && !(await page.locator(".finish").count())) { await page.waitForSelector("[data-check], .finish"); if (await page.locator(".finish").count()) break; await answer(page, true); await page.locator("[data-continue]").tap(); }
  await page.waitForSelector(".finish");
  const f1 = await page.evaluate(() => ({ text: document.querySelector(".finish").innerText.replace(/\s+/g, " "), xp: window.__app.getState().xp }));
  check("第 1 关通关：写明通关，XP = 300 + 4×10（答对）+ 10（通关）= 350", /通关/.test(f1.text) && f1.xp === 350, `${f1.xp} ${f1.text.slice(0, 60)}`);
  await shot("5-finish");
  await page.locator("[data-continue]").tap(); await page.waitForSelector(".pathview .node");
  check("通关后回到地图，当前关变成 U3L2", await page.evaluate(() => document.querySelector(".node.current")?.dataset.lesson === "U3L2"));

  // ---- 第 2 关：全对 ----
  await page.locator(".node.current").tap(); await page.locator(".overlay .btn3d.primary").tap(); await page.waitForSelector(".intro-title");
  await page.getByRole("button", { name: "继续", exact: true }).tap(); await page.waitForSelector("[data-check]");
  const seen = [];
  guard = 0;
  while (guard++ < 10 && !(await page.locator(".finish").count())) { await page.waitForSelector("[data-check], .finish"); if (await page.locator(".finish").count()) break; seen.push((await answer(page, true)).type); await page.locator("[data-continue]").tap(); }
  await page.waitForSelector(".finish");
  check("第 2 关：4 题题型 选输出、选输出、填空、选输出，全对通关", seen.join() === "predict,predict,fill,predict", seen.join());
  const f2 = await page.evaluate(() => ({ xp: window.__app.getState().xp, hearts: window.__app.getState().hearts, done: Object.keys(window.__app.getState().done).filter((k) => k.startsWith("U3")) }));
  check("规则没动：XP = 350 + 4×10 + 10 = 400；红心 4（只错过 1 次）；U3L1、U3L2 已完成", f2.xp === 400 && f2.hearts === 4 && f2.done.sort().join() === "U3L1,U3L2", JSON.stringify(f2));
  await page.locator("[data-continue]").tap(); await page.waitForSelector(".pathview .node");
  check("全程没有页面脚本错误", errors.length === 0, errors.join(" | "));
} catch (e) { await shot("FAIL"); check("流程跑完", false, String(e.message).split("\n").slice(0, 3).join(" ¦ ") + " @ " + String(e.stack).split("\n").find((l) => l.includes("exp-u3.test"))); }
await ctx.close(); await browser.close(); srv.close();
const pass = results.filter(Boolean).length;
console.log(`\n${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
