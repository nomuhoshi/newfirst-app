// AUTH-MAIL-01 任务四：登录失败界面的真实浏览器验收（真实构建产物 + 浏览器里拦截网络请求的假 Supabase）。
// 320px 宽手机视口；覆盖：各类失败的文案 / 诊断行 / 50 XP 提示 / 冷却倒计时 / 超时后先查邮箱 / 断网不冷却 / 本机进度逐字节不变 / 页面不横向溢出。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/auth-errors-ui.test.mjs   （MOBILE_BROWSER=webkit 跑 WebKit）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";

const DIST = resolve(new URL("../dist", import.meta.url).pathname);
const PORT = 4381, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = "https://fake.supabase.test";
const CAN = "CANARY_RAW_SERVER_TEXT";
const XP50 = "你的 50 XP 还在这台设备上，没有受影响。";
const results = [];
const SHOTS = process.env.SHOTS_DIR || "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
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
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
let browser;
try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body, headers = {}) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });

// otp / verify 各自的应答由场景决定：函数 (route) => ...
async function device({ xp = 50, otp, verify } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 640 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const hits = { otp: 0, verify: 0 };
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/otp") { hits.otp++; return otp(route); }
    if (u.pathname === "/auth/v1/verify") { hits.verify++; return (verify || ((r) => json(r, 403, { msg: "Token has expired or is invalid" })))(route); }
    return json(route, 404, { message: "no route" });
  });
  const guest = { version: 3, onboarded: true, xp, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-03", done: xp > 0 ? { U1L1: true } : {}, lessonsCompleted: xp > 0 ? 1 : 0, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } };
  await ctx.addInitScript(([cfg, g]) => { try { if (!localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (!localStorage.getItem("suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem("suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {} }, [{ url: FAKE, anonKey: "pub-key" }, guest]);
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  await page.getByRole("button", { name: "我的" }).tap();
  await page.waitForSelector("[data-account]");
  await page.locator("[data-open-login]").tap();
  await page.locator("[data-email]").fill("t@example.com");
  return { ctx, page, hits, errors };
}
const dump = (page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const T = (page, sel) => page.locator(sel).innerText().catch(() => "");
const shot = async (d, name) => { if (SHOTS) await d.page.screenshot({ path: `${SHOTS}/${BNAME}-${name}.png` }); };
// 页面没有横向溢出，登录面板里的关键元素都在 0–320px 之内
async function layoutOk(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    if (document.documentElement.scrollWidth > W) bad.push("页面横向溢出 " + document.documentElement.scrollWidth);
    for (const sel of ["[data-login]", "[data-login-msg]", "[data-login-diag]", "[data-login-xp]", "[data-send-code]", "[data-resend]", "[data-code]", "[data-email]", "[data-verify]"]) {
      const el = document.querySelector(sel); if (!el || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (r.left < -0.5 || r.right > W + 0.5) bad.push(`${sel} 越界 ${Math.round(r.left)}–${Math.round(r.right)}`);
      if (el.scrollWidth > el.clientWidth + 1 && getComputedStyle(el).overflowX !== "visible") bad.push(`${sel} 内容被裁`);
    }
    return bad;
  });
}
const noRaw = async (page) => !(await page.evaluate(() => document.body.innerText)).includes(CAN);
const secondsIn = (t) => { const m = /(\d+) 秒/.exec(t); return m ? Number(m[1]) : -1; };

async function scenario(name, opts, fn) {
  const d = await device(opts);
  try { await fn(d); } catch (e) { check(`${name}：场景执行出错`, false, String(e.message || e).split("\n")[0]); }
  finally { check(`${name}：页面没有脚本报错`, d.errors.length === 0, d.errors.join(" | ")); await d.ctx.close(); }
}
const sendTap = (d) => d.page.locator("[data-send-code]").tap();

// ---------- 发送失败各类 ----------
await scenario("500 服务器发信失败", { otp: (r) => json(r, 500, { code: 500, error_code: "unexpected_failure", msg: CAN + " Error sending magic link email" }) }, async (d) => {
  const before = await dump(d.page);
  await sendTap(d);
  await d.page.waitForFunction(() => /服务器这边出了问题/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("500：中文说明，不说成额度用完", /服务器这边出了问题/.test(await T(d.page, "[data-login-msg]")) && !/额度|配额|次数/.test(await T(d.page, "[data-login-msg]")));
  check("500：诊断行 HTTP 500 · unexpected_failure", (await T(d.page, "[data-login-diag]")) === "诊断：HTTP 500 · unexpected_failure", await T(d.page, "[data-login-diag]"));
  check("500：显示固定的 50 XP 安全句子", (await T(d.page, "[data-login-xp]")) === XP50, await T(d.page, "[data-login-xp]"));
  check("500：页面上没有服务器原文", await noRaw(d.page));
  const btn = await T(d.page, "[data-send-code]");
  check("500：发送按钮进入 30 秒内的冷却倒计时并禁用", (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(btn) > 0 && secondsIn(btn) <= 30, btn);
  check("失败后本机存储逐字节不变（游客进度、配置都在）", (await dump(d.page)) === before);
  check("本机 XP 仍是 50", (await d.page.evaluate(() => window.__app.getState().xp)) === 50);
  const bad = await layoutOk(d.page); check("500：320px 布局无溢出", bad.length === 0, bad.join("; ")); await shot(d, "500");
});
await scenario("429 邮件次数上限（服务器给了 40 秒）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " For security purposes, you can only request this after 40 seconds." }) }, async (d) => {
  await sendTap(d);
  await d.page.waitForFunction(() => /暂时用完/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  const btn = await T(d.page, "[data-send-code]");
  check("429：冷却取服务器给的真实数字（约 41 秒）", secondsIn(btn) >= 36 && secondsIn(btn) <= 41, btn);
  check("429：诊断行 HTTP 429 · over_email_send_rate_limit，XP 句子在", (await T(d.page, "[data-login-diag]")) === "诊断：HTTP 429 · over_email_send_rate_limit" && (await T(d.page, "[data-login-xp]")) === XP50);
  await d.page.locator("[data-send-code]").evaluate((b) => b.click()); // 强制点禁用的按钮：不能再发请求
  await d.page.waitForTimeout(300);
  check("冷却期间强行点击不会再发请求（服务器只收到 1 次）", d.hits.otp === 1, String(d.hits.otp));
  check("429：页面上没有服务器原文", await noRaw(d.page));
  const bad = await layoutOk(d.page); check("429：320px 布局无溢出", bad.length === 0, bad.join("; ")); await shot(d, "429");
});
await scenario("邮箱无资格（400 email_address_not_authorized）", { otp: (r) => json(r, 400, { code: 400, error_code: "email_address_not_authorized", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await d.page.waitForFunction(() => /收不到验证码/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("无资格：独立文案、诊断行、XP 句子", (await T(d.page, "[data-login-diag]")) === "诊断：HTTP 400 · email_address_not_authorized" && (await T(d.page, "[data-login-xp]")) === XP50);
  check("无资格：不冷却，按钮可再点（换邮箱后马上能试）", !(await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-send-code]")) === "发送验证码");
  check("无资格：页面上没有服务器原文", await noRaw(d.page));
  const bad = await layoutOk(d.page); check("无资格：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("断网", { otp: (r) => r.abort("internetdisconnected") }, async (d) => {
  await sendTap(d);
  await d.page.waitForFunction(() => /没有网络/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("断网：留在填邮箱这一步，不跳去输验证码", (await d.page.locator("[data-email]").count()) === 1 && (await d.page.locator("[data-code]").count()) === 0);
  check("断网：不冷却；诊断行“网络不通”；XP 句子在", !(await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-login-diag]")) === "诊断：网络不通" && (await T(d.page, "[data-login-xp]")) === XP50);
});
await scenario("请求超时（服务器一直不回）", { otp: () => new Promise(() => {}) }, async (d) => {
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor({ timeout: 25000 });
  const m = await T(d.page, "[data-login-msg]");
  check("超时：跳到输验证码这一步，文案要求先查邮箱（含垃圾邮件）", /先去邮箱/.test(m) && /垃圾邮件/.test(m), m);
  check("超时：诊断行“请求超时”，XP 句子在", (await T(d.page, "[data-login-diag]")) === "诊断：请求超时" && (await T(d.page, "[data-login-xp]")) === XP50);
  const rs = await T(d.page, "[data-resend]");
  check("超时：“重新发送”被冷却（约 60 秒）锁住，避免马上重复发送", (await d.page.locator("[data-resend]").isDisabled()) && secondsIn(rs) > 50 && secondsIn(rs) <= 60, rs);
  check("超时：服务器只收到 1 次 otp 请求", d.hits.otp === 1, String(d.hits.otp));
  const bad = await layoutOk(d.page); check("超时：320px 布局无溢出（最长的一条文案）", bad.length === 0, bad.join("; ")); await shot(d, "timeout");
});

// ---------- 输验证码失败 ----------
await scenario("验证码错误（403）", { otp: (r) => json(r, 200, {}), verify: (r) => json(r, 403, { code: 403, error_code: "otp_expired", msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const before = await dump(d.page);
  await d.page.locator("[data-code]").fill("000000"); await d.page.locator("[data-verify]").tap();
  await d.page.waitForFunction(() => /验证码错误或已过期/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("验证码错：原文案、诊断行 HTTP 403 · otp_expired、XP 句子", (await T(d.page, "[data-login-diag]")) === "诊断：HTTP 403 · otp_expired" && (await T(d.page, "[data-login-xp]")) === XP50);
  check("验证码错：页面上没有服务器原文；游客进度逐字节不变", (await noRaw(d.page)) && (await dump(d.page)) === before);
  check("验证码错：还能点“重新发送”所在的这一步（输入框还在）", (await d.page.locator("[data-code]").count()) === 1);
  const bad = await layoutOk(d.page); check("验证码错：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("输验证码时服务器 500", { otp: (r) => json(r, 200, {}), verify: (r) => json(r, 500, { code: 500, msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await d.page.waitForFunction(() => /没能完成登录/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("验证 500：不说成验证码错；诊断行 HTTP 500；XP 句子；无原文", !/验证码错误/.test(await T(d.page, "[data-login-msg]")) && (await T(d.page, "[data-login-diag]")) === "诊断：HTTP 500" && (await T(d.page, "[data-login-xp]")) === XP50 && (await noRaw(d.page)));
});

// ---------- XP 为 0 ----------
await scenario("没有 XP 时不显示安全句子", { xp: 0, otp: (r) => json(r, 500, { error_code: "unexpected_failure", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await d.page.waitForFunction(() => /服务器这边出了问题/.test(document.querySelector("[data-login-msg]")?.textContent || ""));
  check("XP=0：安全句子不出现（元素不可见）", !(await d.page.locator("[data-login-xp]").isVisible()) && !(await d.page.evaluate(() => document.body.innerText)).includes("XP 还在这台设备上"));
});

// ---------- 成功路径不受影响 ----------
await scenario("发送成功仍进入输验证码，60 秒后才能重发", { otp: (r) => json(r, 200, {}) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const rs = await T(d.page, "[data-resend]");
  check("成功：进入输验证码步骤；“重新发送”有 60 秒内的倒计时；没有诊断行 / XP 句子", (await d.page.locator("[data-resend]").isDisabled()) && secondsIn(rs) > 0 && secondsIn(rs) <= 60 && (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === "", rs);
});

await browser.close(); srv.closeAllConnections(); srv.close();
const bad = results.filter((v) => !v).length;
console.log(`\n${BNAME}: ${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
