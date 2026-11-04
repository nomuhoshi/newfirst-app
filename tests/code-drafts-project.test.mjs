// 真实浏览器里验证：同一个浏览器、同一个入口，连到两个不同的测试项目，用户编号相同、题目相同，写代码题的草稿不会串。
// 做法：同一页面里先后切换“连接的项目”（localhost 允许用 suipian.cloudConfig 覆盖），每个项目写自己的草稿，再切回来读。
// 运行：npm run build && node tests/code-drafts-project.test.mjs（MOBILE_BROWSER=webkit 用 WebKit）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4347, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
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

const PROD = "aqlcunkmggzzvyavlkjg.supabase.co", A = "aaaaaaaa.supabase.co", B = "bbbbbbbb.supabase.co";
const UID = "u-same-1";
const W = (id) => ({ id, version: 1, type: "write", prompt: "输出：总价 <价格×杯数>", given: ["price", "cups"], starter: "# price 和 cups 已准备好\n", checkMode: "output",
  tests: [{ name: "4 杯", data: { price: 15, cups: 4 }, expected: "总价 60" }], hints: ["提示一"], reference: 'print("总价", price * cups)', mistakes: [] });
const LESSON = (exs) => ({ id: "TESTCODE", title: "代码题测试", concept: "测试", story: "测试", introCode: "print(1)", exercises: exs });
const cfg = (host) => JSON.stringify({ url: `https://${host}`, anonKey: "sb_publishable_test" });

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.route(/supabase\.co/, (r) => r.abort()); // 不真连云端
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  const boot = async () => {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState);
    await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  };
  const useProject = async (host) => { await page.evaluate((c) => localStorage.setItem("suipian.cloudConfig", c), host ? cfg(host) : ""); if (!host) await page.evaluate(() => localStorage.removeItem("suipian.cloudConfig")); await boot(); };
  const write = async (code) => {
    await page.evaluate((l) => window.__app.startLesson(l, {}), LESSON([W("T-W1")]));
    await page.getByRole("button", { name: "继续", exact: true }).tap();
    await page.waitForSelector("[data-code-task]", { timeout: 15000 });
    return page.evaluate(async (c) => { if (c !== null) window.__app.currentArea.setCode(c); return window.__app.currentArea.code(); }, code);
  };
  const read = async () => { await page.waitForTimeout(900); return page.evaluate(() => Object.fromEntries(Object.keys(localStorage).filter((k) => k.startsWith("suipian.draft.")).map((k) => [k, JSON.parse(localStorage.getItem(k)).code]))); };

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  // 同一个浏览器里同时有：正式项目的当前账号、A 项目的当前账号、B 项目的当前账号，用户编号相同
  await page.evaluate(([uid, a, b]) => {
    localStorage.setItem("suipian.session", uid);
    localStorage.setItem(`proj:${a}:suipian.session`, uid);
    localStorage.setItem(`proj:${b}:suipian.session`, uid);
  }, [UID, A, B]);

  await useProject(null); // 云端关闭 / 正式项目键
  await write("PROD = 1");
  let d = await read();
  check("正式（云端关闭）：草稿用原来的键 suipian.draft.<uid>.T-W1.v1", Object.keys(d).length === 1 && d[`suipian.draft.${UID}.T-W1.v1`] === "PROD = 1", JSON.stringify(d));

  await useProject(A);
  const initA = await write(null);
  check("连到项目 A（同一用户编号、同一道题）：看不到正式项目的草稿", initA.startsWith("# price"), JSON.stringify(initA.slice(0, 30)));
  await write("A_CODE = 1");
  d = await read();
  check("项目 A 写草稿：多出一个带 proj:A 的新键，正式项目的草稿原样", Object.keys(d).length === 2 && d[`suipian.draft.${UID}.T-W1.v1`] === "PROD = 1" && d[`suipian.draft.proj:${A}:${UID}.T-W1.v1`] === "A_CODE = 1", JSON.stringify(d));

  await useProject(B);
  const initB = await write(null);
  check("连到项目 B（同一用户编号、同一道题）：看不到正式项目和 A 的草稿", initB.startsWith("# price"), JSON.stringify(initB.slice(0, 30)));
  await write("B_CODE = 1");
  d = await read();
  check("项目 B 写草稿：三份各是各的", Object.keys(d).length === 3 && d[`suipian.draft.proj:${B}:${UID}.T-W1.v1`] === "B_CODE = 1" && d[`suipian.draft.proj:${A}:${UID}.T-W1.v1`] === "A_CODE = 1" && d[`suipian.draft.${UID}.T-W1.v1`] === "PROD = 1", JSON.stringify(d));

  await useProject(A);
  check("切回项目 A：恢复的是 A 自己的草稿", (await write(null)) === "A_CODE = 1");
  await useProject(null);
  check("切回正式（云端关闭）：恢复的是正式的草稿", (await write(null)) === "PROD = 1");
  await useProject(B);
  check("切回项目 B：恢复的是 B 自己的草稿", (await write(null)) === "B_CODE = 1");
  check("全程没有页面脚本错误", errors.length === 0, errors.join("|"));
  await ctx.close();
} catch (e) { console.log("❌ 测试异常：" + (e.stack || e)); results.push(false); }
await browser.close(); srv.closeAllConnections(); srv.close();
const pass = results.filter(Boolean).length;
console.log(`\n草稿按项目分开（浏览器）：${pass}/${results.length} 通过`); process.exit(pass === results.length ? 0 : 1);
