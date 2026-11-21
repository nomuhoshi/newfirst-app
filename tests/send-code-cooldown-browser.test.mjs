// G-LOGIN-06 真实浏览器专项（Chromium / WebKit）：真实登录弹窗里的发送 / 重发 / 换邮箱 / 重开，倒计时准确，没有服务器原文，没有意外的页面错误。
// 构建产物 + 浏览器内拦截网络请求的假 Supabase（不发往任何真实服务器）。运行：npm run build:ci && MOBILE_BROWSER=chromium node tests/send-code-cooldown-browser.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const PORT = 4397, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = "https://fake.supabase.test", CAN = "CANARY_RAW_SERVER_TEXT";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build:ci"); process.exit(2); }
const srv = createServer((req, resp) => {
  const url = new URL(req.url, BASE);
  let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("not found"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(PORT, res));
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
let browser;
try { browser = await (BNAME === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body, headers = {}) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });
// 跨域时浏览器只在服务器声明 expose-headers 时才让页面读到 Retry-After：假服务器显式声明
let n429 = 0; // 本场景里假服务器故意返回的 429 次数：浏览器会为每个失败响应记一条“Failed to load resource … 429”，这是预期的，只按次数放行
const limited = (r, code, msg, sec) => (n429++, json(r, 429, { code: 429, error_code: code, msg: CAN + " " + msg }, sec == null ? {} : { "retry-after": String(sec), "access-control-expose-headers": "retry-after" }));
const INTERVAL = "For security purposes, you can only request this after 40 seconds.";

async function device(otp) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const hits = { otp: 0 };
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/otp") { hits.otp++; return otp(route, hits.otp); }
    return json(route, 404, { message: "no route" });
  });
  const guest = { version: 3, onboarded: true, xp: 50, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-03", done: { U1L1: true }, lessonsCompleted: 1, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } };
  await ctx.addInitScript(([cfg, g]) => {
    try { if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (!localStorage.getItem("suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem("suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {}
    // 可拨快的时钟：页面里所有 Date.now 加上 window.__skew（毫秒），用来在真实浏览器里“等到”冷却到期而不真等
    const rn = Date.now.bind(Date); window.__skew = 0; Date.now = () => rn() + window.__skew;
  }, [{ url: FAKE, anonKey: "pub-key" }, guest]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  const consoleErrors = []; page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  const d = { ctx, page, hits, errors, consoleErrors };
  d.openLogin = async (email = "t@example.com") => {
    if (!(await page.locator("[data-open-login]").count())) { await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="account"]').tap(); await page.waitForSelector("[data-account]"); }
    await page.locator("[data-open-login]").tap();
    await page.locator("[data-email]").fill(email);
  };
  await d.openLogin();
  return d;
}
const T = (page, sel) => page.locator(sel).innerText().catch(() => "");
const secondsIn = (t) => { const m = /(\d+) 秒/.exec(t); return m ? Number(m[1]) : -1; };
const noRaw = async (page) => !(await page.evaluate(() => document.body.innerText)).includes(CAN);
const waitMsg = async (d, re) => { try { await d.page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-login-msg]")?.textContent || ""), re.source, { timeout: 15000 }); } catch { throw new Error(`等不到提示 ${re}；当前=「${await T(d.page, "[data-login-msg]")}」`); } };
const sendTap = (d) => d.page.locator("[data-send-code]").tap();
// 页面报错：放行 WebKit 的 viewport interactive-widget 警告，以及“与故意返回的 429 一一对应、数量不超过”的资源加载提示；其余 console.error / pageerror 一律算意外
const unexpected = (d) => {
  const rest = d.consoleErrors.filter((t) => !/interactive-widget/.test(t));
  const is429 = (t) => /Failed to load resource.*\b429\b/.test(t);
  const extra429 = Math.max(0, rest.filter(is429).length - n429);
  return [...d.errors, ...rest.filter((t) => !is429(t)), ...(extra429 ? [`多出 ${extra429} 条 429 资源错误（假服务器只返回了 ${n429} 次）`] : [])];
};
async function scenario(name, otp, fn) {
  n429 = 0;
  const d = await device(otp);
  try { await fn(d); } catch (e) { check(`${name}：场景执行出错`, false, String(e.message || e).split("\n")[0]); }
  finally { check(`${name}：没有意外的浏览器错误`, unexpected(d).length === 0, unexpected(d).join(" | ")); await d.ctx.close(); }
}

// ① 发送被限流（Retry-After 120）→ 倒计时准确；强行点击不加请求；换邮箱不解锁也不重新计满；重开弹窗再点发送，仍用原截止时间
await scenario("发送限流 120 秒：倒计时 / 强行点击 / 换邮箱 / 重开弹窗", (r) => limited(r, "over_email_send_rate_limit", INTERVAL, 120), async (d) => {
  await sendTap(d);
  await waitMsg(d, /这个邮箱请求验证码太频繁/);
  const b0 = await T(d.page, "[data-send-code]");
  check("首次：按钮禁用，倒计时约 120 秒（不是 60 / 300 秒）；文案是邮箱请求间隔、不说“刚发过”；没有服务器原文", (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(b0) >= 115 && secondsIn(b0) <= 120 && !/刚刚已经发过|还能用/.test(await T(d.page, "[data-login-msg]")) && (await noRaw(d.page)), b0);
  await d.page.locator("[data-send-code]").evaluate((b) => b.click());
  await d.page.locator("[data-send-code]").evaluate((b) => b.click());
  await d.page.waitForTimeout(2200);
  const b1 = await T(d.page, "[data-send-code]");
  check("强行点击禁用按钮 2 次：服务器仍只收到 1 次；倒计时只往下走（约 2 秒后 ≤118，没有重新计满）", d.hits.otp === 1 && secondsIn(b1) <= 118 && secondsIn(b1) > 100, `${d.hits.otp} ${b1}`);
  await d.page.locator("[data-email]").fill("other@example.com");
  const b2 = await T(d.page, "[data-send-code]");
  check("换邮箱：同一个门禁，仍被锁住，倒计时不重置", (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(b2) > 100 && secondsIn(b2) <= secondsIn(b1) + 0, b2);
  // 重开弹窗：弹窗是全新的，按钮可点；点发送被同步层在本地挡住（不发请求），显示原截止时间
  await d.page.getByRole("button", { name: "先不登录" }).tap();
  await d.page.waitForTimeout(300);
  await d.openLogin("third@example.com");
  await sendTap(d);
  await waitMsg(d, /还在等待中/);
  const b3 = await T(d.page, "[data-send-code]"), m3 = await T(d.page, "[data-login-msg]");
  check("重开弹窗后点发送：本地挡住（服务器仍 1 次）；提示是中性等待（不说服务器拒绝 / 已发邮件）；按钮倒计时沿用原截止时间（≤约 115 秒，不是重新 120 / 300）", d.hits.otp === 1 && (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(b3) > 90 && secondsIn(b3) <= secondsIn(b2) && !/服务器|邮件服务|额度|发过/.test(m3) && (await noRaw(d.page)), `${d.hits.otp} ${b3} | ${m3}`);
  // 拨快时钟越过截止时间：按钮恢复；再点发送只发 1 次真实请求
  await d.page.evaluate(() => { window.__skew = 125000; });
  await d.page.waitForFunction(() => /^发送验证码$/.test(document.querySelector("[data-send-code]")?.textContent || ""), null, { timeout: 5000 });
  await sendTap(d);
  await d.page.waitForFunction(() => /这个邮箱请求验证码太频繁/.test(document.querySelector("[data-login-msg]")?.textContent || ""), null, { timeout: 5000 });
  check("到期后：按钮恢复，点一次只多 1 次真实请求（共 2 次），随后又按新的 120 秒锁住", d.hits.otp === 2 && (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(await T(d.page, "[data-send-code]")) > 100, `${d.hits.otp}`);
});

// ② 请求限流 + 长等待：中性文案，约 2 小时，不截成一小时
await scenario("请求限流 7200 秒：中性文案，不截成一小时", (r) => limited(r, "over_request_rate_limit", "Request rate limit reached", 7200), async (d) => {
  await sendTap(d);
  await waitMsg(d, /请求太频繁了，暂时发不出验证码/);
  const m = await T(d.page, "[data-login-msg]"), b = await T(d.page, "[data-send-code]");
  check("文案 / 按钮都是约 2 小时；不说“验证码刚发过”、不说邮件额度；没有“我已收到”入口；没有服务器原文", /约 2 小时/.test(m) && /^约 2 小时后可再发$/.test(b) && !/发过|邮件服务|额度|还能用/.test(m) && (await d.page.locator("[data-enter-code]").count()) === 0 && (await noRaw(d.page)), m + " | " + b);
});

// ③ 邮件服务限流（email rate limit exceeded）+ 等待头：S3，不变 S2，不重新生成 5 分钟
await scenario("邮件服务限流 + 等待头 600 秒：S3，倒计时约 10 分钟", (r) => limited(r, "over_email_send_rate_limit", "email rate limit exceeded", 600), async (d) => {
  await sendTap(d);
  await waitMsg(d, /邮件服务暂时限流/);
  const b = await T(d.page, "[data-send-code]");
  check("按钮约 10 分钟（不是 5 分钟）；没有“我已收到”入口；没有服务器原文", /^约 10 分钟后可再发$/.test(b) && (await d.page.locator("[data-enter-code]").count()) === 0 && (await noRaw(d.page)), b);
});

// ④ 重发：先成功，等 60 秒（拨快时钟）后重发被限流 7200 秒 → 重发按钮写约 2 小时，强行点击不发请求
await scenario("重发被限流：重发按钮倒计时 / 不重复请求", (r, n) => (n === 1 ? json(r, 200, {}) : limited(r, "over_request_rate_limit", "Request rate limit reached", 7200)), async (d) => {
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor();
  check("首次发送成功：进入验证码页，重发按钮有 60 秒内的倒计时", (await d.page.locator("[data-resend]").isDisabled()) && secondsIn(await T(d.page, "[data-resend]")) > 0);
  await d.page.evaluate(() => { window.__skew = 61000; });
  await d.page.waitForFunction(() => /^重新发送$/.test(document.querySelector("[data-resend]")?.textContent || ""), null, { timeout: 5000 });
  await d.page.locator("[data-resend]").tap();
  await waitMsg(d, /请求太频繁了，暂时发不出验证码/);
  const r1 = await T(d.page, "[data-resend]");
  await d.page.locator("[data-resend]").evaluate((b) => b.click());
  await d.page.waitForTimeout(300);
  check("重发被限流：重发按钮禁用，写约 2 小时（不是“7200 秒”也不是 60 秒）；强行点击不再发请求（共 2 次）；没有服务器原文", (await d.page.locator("[data-resend]").isDisabled()) && /约 2 小时/.test(r1) && d.hits.otp === 2 && (await noRaw(d.page)), `${r1} ${d.hits.otp}`);
});

await browser.close(); srv.closeAllConnections(); srv.close();
const bad = results.filter((v) => !v).length;
console.log(`\n${BNAME}：${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
