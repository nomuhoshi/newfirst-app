// AUTH-MAIL-01/02：登录失败界面的真实浏览器验收（真实构建产物 + 浏览器里拦截网络请求的假 Supabase）。
// 320px 宽手机视口；覆盖：各类失败的文案 / 诊断行 / 50 XP 提示 / 冷却倒计时 / 超时后先查邮箱 / 断网不冷却 / 本机进度逐字节不变 / 页面不横向溢出。
// 运行：npm run build && MOBILE_BROWSER=chromium node tests/auth-errors-ui.test.mjs   （MOBILE_BROWSER=webkit 跑 WebKit）
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium, webkit } from "playwright";
import { fileURLToPath } from "node:url";

// 默认测试普通构建（云配置由测试注入到 localStorage，请求发往假地址）。
// 验收已发布的预览产物时：DIST_DIR=<preview-dist 目录> FAKE_URL=https://<测试项目>.supabase.co PREVIEW_PREFIX=acc2: EXPECT_SHA=<提交号>；
// 此时请求仍被浏览器内拦截，不会真的发往任何服务器；多一条“版本 / 云项目 / 只访问测试项目”的核对。
const DIST = resolve(process.env.DIST_DIR || fileURLToPath(new URL("../dist", import.meta.url)));
const PFX = process.env.PREVIEW_PREFIX || "";
const EXPECT_SHA = process.env.EXPECT_SHA || "";
const PORT = 4381, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = process.env.FAKE_URL || "https://fake.supabase.test";
const CAN = "CANARY_RAW_SERVER_TEXT";
const XP50 = "你的 50 XP 还在这台设备上，没有受影响。";
const XPSYNC = "你的 50 XP 仍在这台设备上，云端同步未完成。";
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

// 每个场景的假服务器应答由场景决定：函数 (route) => ...。progress 相关的路由默认返回“云端没有进度”。
async function device({ xp = 50, otp, verify, progress, getProgress, online = true, fakeVv = false, nav = "login" } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const hits = { otp: 0, verify: 0, create: 0, save: 0, get: 0 };
  const rows = { n: 0 };
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/otp") { hits.otp++; return (otp || ((r) => json(r, 200, {})))(route); }
    if (u.pathname === "/auth/v1/verify") { hits.verify++; return (verify || ((r) => json(r, 403, { msg: "Token has expired or is invalid" })))(route); }
    if (u.pathname === "/rest/v1/progress") { hits.get++; return (getProgress || ((r) => json(r, 200, [])))(route, hits.get); }
    if (u.pathname === "/rest/v1/rpc/create_progress") { hits.create++; return (progress || ((r) => json(r, 200, 1)))(route); }
    if (u.pathname === "/rest/v1/rpc/save_progress") { hits.save++; return json(route, 200, null); }
    if (u.pathname === "/auth/v1/logout") return json(route, 204);
    return json(route, 404, { message: "no route" });
  });
  const guest = { version: 3, onboarded: true, xp, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-03", done: xp > 0 ? { U1L1: true } : {}, lessonsCompleted: xp > 0 ? 1 : 0, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } };
  await ctx.addInitScript(([cfg, g, onl, fake, pfx]) => {
    try { if (!pfx && !localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (!localStorage.getItem(pfx + "suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem(pfx + "suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {}
    if (!onl) Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
    if (fake) { // 模拟 iOS：键盘弹出时可视视口变矮，但布局视口不变
      const vv = new EventTarget();
      Object.defineProperties(vv, { height: { get: () => window.__vvh ?? window.innerHeight }, width: { get: () => window.innerWidth }, offsetTop: { value: 0 }, offsetLeft: { value: 0 }, scale: { value: 1 } });
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    }
  }, [{ url: FAKE, anonKey: "pub-key" }, guest, online, fakeVv, PFX]);
  const page = await ctx.newPage();
  const hosts = new Set(); page.on("request", (rq) => { try { hosts.add(new URL(rq.url()).host); } catch {} });
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
  if (nav === "login") {
    await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="account"]').tap();
    await page.waitForSelector("[data-account]");
    await page.locator("[data-open-login]").tap();
    await page.locator("[data-email]").fill("t@example.com");
  }
  return { ctx, page, hits, errors, hosts };
}
const dump = (page) => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map((k) => [k, localStorage.getItem(k)])));
const T = (page, sel) => page.locator(sel).innerText().catch(() => "");
const shot = async (d, name) => { if (SHOTS) await d.page.screenshot({ path: `${SHOTS}/${BNAME}-${name}.png` }); };
// 页面没有横向溢出，登录面板里的关键元素都在 0–320px 之内
async function layoutOk(page) {
  return page.evaluate(() => {
    const W = document.documentElement.clientWidth, bad = [];
    if (document.documentElement.scrollWidth > W) bad.push("页面横向溢出 " + document.documentElement.scrollWidth);
    for (const sel of ["[data-login]", "[data-login-msg]", "[data-login-diag]", "[data-login-xp]", "[data-send-code]", "[data-resend]", "[data-code]", "[data-email]", "[data-verify]", "[data-enter-code]"]) {
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
const waitMsg = async (d, re, timeout = 15000) => {
  try { await d.page.waitForFunction((src) => new RegExp(src).test(document.querySelector("[data-login-msg]")?.textContent || ""), re.source, { timeout }); }
  catch { throw new Error(`等不到提示 ${re}；当前提示=「${await d.page.evaluate(() => document.querySelector("[data-login-msg]")?.textContent ?? "(没有提示框)")}」 登录框${(await d.page.locator("[data-login]").count()) ? "在" : "已关闭"}`); }
};

async function scenario(name, opts, fn) {
  const d = await device(opts);
  try { await fn(d); } catch (e) { check(`${name}：场景执行出错`, false, String(e.message || e).split("\n")[0]); }
  finally { check(`${name}：页面没有脚本报错`, d.errors.length === 0, d.errors.join(" | ")); await d.ctx.close(); }
}
const sendTap = (d) => d.page.locator("[data-send-code]").tap();
const body = (d) => d.page.evaluate(() => document.body.innerText);

// ---------- 发送失败各类（S1a–S6）----------
await scenario("S4 服务器发信失败（500）", { otp: (r) => json(r, 500, { code: 500, error_code: "unexpected_failure", msg: CAN + " Error sending magic link email" }) }, async (d) => {
  const before = await dump(d.page);
  await sendTap(d);
  await waitMsg(d, /邮件服务暂时出问题/);
  check("S4：中文说明，不说成额度用完", !/额度|配额|次数/.test(await T(d.page, "[data-login-msg]")));
  check("S4：诊断行“诊断：500 · unexpected_failure”", (await T(d.page, "[data-login-diag]")) === "诊断：500 · unexpected_failure", await T(d.page, "[data-login-diag]"));
  check("S4：显示固定的 50 XP 句子", (await T(d.page, "[data-login-xp]")) === XP50, await T(d.page, "[data-login-xp]"));
  check("S4：页面上没有服务器原文", await noRaw(d.page));
  const btn = await T(d.page, "[data-send-code]");
  check("S4：发送按钮禁用，写“30 秒后可再试”", (await d.page.locator("[data-send-code]").isDisabled()) && btn === "30 秒后可再试", btn);
  check("失败后本机存储逐字节不变（游客进度、配置都在）", (await dump(d.page)) === before);
  check("本机 XP 仍是 50", (await d.page.evaluate(() => window.__app.getState().xp)) === 50);
  const colors = await d.page.evaluate(() => { const c = (s) => getComputedStyle(document.querySelector(s)).color; return { msg: c("[data-login-msg]"), xp: c("[data-login-xp]"), diag: c("[data-login-diag]") }; });
  check("颜色层级：L1 红色，进度行和诊断行灰色且互不相同于 L1（规范 §2.1）", colors.msg !== colors.xp && colors.xp === colors.diag, JSON.stringify(colors));
  const bad = await layoutOk(d.page); check("S4：320px 布局无溢出", bad.length === 0, bad.join("; ")); await shot(d, "S4");
});
await scenario("S2 刚发过（服务器给了 40 秒）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " For security purposes, you can only request this after 40 seconds." }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /刚刚已经发过验证码/);
  const btn = await T(d.page, "[data-send-code]");
  check("S2：冷却取服务器给的真实数字（约 41 秒），按钮写“N 秒后可再发”", secondsIn(btn) >= 36 && secondsIn(btn) <= 41 && /秒后可再发/.test(btn), btn);
  check("S2：文案写出 40 秒；没有诊断行；XP 句子在", /40 秒/.test(await T(d.page, "[data-login-msg]")) && (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === XP50);
  await d.page.locator("[data-send-code]").evaluate((b) => b.click()); // 强制点禁用的按钮：不能再发请求
  await d.page.waitForTimeout(300);
  check("冷却期间强行点击不会再发请求（服务器只收到 1 次）", d.hits.otp === 1, String(d.hits.otp));
  check("S2：出现次按钮「我已收到，去输入验证码」", (await d.page.locator("[data-enter-code]").count()) === 1);
  check("S2：页面上没有服务器原文", await noRaw(d.page));
  const bad = await layoutOk(d.page); check("S2：320px 布局无溢出", bad.length === 0, bad.join("; ")); await shot(d, "S2");
  await d.page.locator("[data-enter-code]").tap();
  await d.page.locator("[data-code]").waitFor();
  check("点「我已收到」：进入输验证码页，没有再发请求", d.hits.otp === 1);
});
await scenario("S3 邮件配额（429 没有秒数）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /登录邮件发得太多/);
  check("S3：按钮禁用，写“约 5 分钟后可再试”；无诊断行；无次按钮", (await T(d.page, "[data-send-code]")) === "约 5 分钟后可再试" && (await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-login-diag]")) === "" && (await d.page.locator("[data-enter-code]").count()) === 0);
});
await scenario("S5 邮箱无资格（400 email_address_not_authorized）", { otp: (r) => json(r, 400, { code: 400, error_code: "email_address_not_authorized", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /暂时收不到登录验证码|不在测试名单里/); // 测试入口（有 PREVIEW_ID 的构建）用 S5t 变体
  check("S5：独立文案、诊断行、XP 句子", (await T(d.page, "[data-login-diag]")) === "诊断：400 · email_address_not_authorized" && (await T(d.page, "[data-login-xp]")) === XP50);
  check("S5：不冷却，按钮可再点（换邮箱后马上能试）", !(await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-send-code]")) === "发送验证码");
  check("S5：页面上没有服务器原文", await noRaw(d.page));
  const bad = await layoutOk(d.page); check("S5：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("S6 其他 4xx（认不出的错误码）", { otp: (r) => json(r, 400, { code: 400, error_code: "brand_new_code", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /验证码没发出去。请检查邮箱地址/);
  check("S6：保守文案 + 诊断行（状态码 + 错误码）", (await T(d.page, "[data-login-diag]")) === "诊断：400 · brand_new_code" && (await noRaw(d.page)));
});
await scenario("S1a 断网（navigator.onLine=false）", { online: false, otp: (r) => r.abort("internetdisconnected") }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /没连上网络/);
  check("S1a：留在填邮箱这一步，不跳去输验证码", (await d.page.locator("[data-email]").count()) === 1 && (await d.page.locator("[data-code]").count()) === 0);
  check("S1a：不冷却；没有诊断行；XP 句子在", !(await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === XP50);
});
await scenario("S1b 在线但请求失败", { otp: (r) => r.abort("connectionreset") }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /网络不稳，没等到回应/);
  check("S1b（没超时）：留在填邮箱页，不冷却，文案提醒先看邮箱", (await d.page.locator("[data-email]").count()) === 1 && !(await d.page.locator("[data-send-code]").isDisabled()) && /看看邮箱（含垃圾邮件）/.test(await T(d.page, "[data-login-msg]")));
});
await scenario("S1b 请求超时（服务器一直不回）", { otp: () => new Promise(() => {}) }, async (d) => {
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor({ timeout: 25000 });
  const m = await T(d.page, "[data-login-msg]");
  check("超时：跳到输验证码这一步，文案要求先看邮箱（含垃圾邮件）", /请求超时，邮件可能已发出。请先检查邮箱/.test(m) && /垃圾邮件/.test(m), m);
  check("超时：没有诊断行，XP 句子在", (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === XP50);
  const rs = await T(d.page, "[data-resend]");
  check("超时：“重新发送”被冷却（约 60 秒）锁住，避免马上重复发送", (await d.page.locator("[data-resend]").isDisabled()) && secondsIn(rs) > 50 && secondsIn(rs) <= 60, rs);
  check("超时：服务器只收到 1 次 otp 请求", d.hits.otp === 1, String(d.hits.otp));
  const bad = await layoutOk(d.page); check("超时：320px 布局无溢出（最长的一条文案）", bad.length === 0, bad.join("; ")); await shot(d, "timeout");
});

// ---------- 输验证码失败（V1–V4）----------
await scenario("V1 验证码错误（403）", { verify: (r) => json(r, 403, { code: 403, error_code: "otp_expired", msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const before = await dump(d.page);
  await d.page.locator("[data-code]").fill("000000"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码错误或已过期/);
  check("V1：原文案；没有诊断行；XP 句子在", (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === XP50);
  check("V1：页面上没有服务器原文；游客进度逐字节不变", (await noRaw(d.page)) && (await dump(d.page)) === before);
  check("V1：输入框还在，已输入的内容保留", (await d.page.locator("[data-code]").inputValue()) === "000000");
  const bad = await layoutOk(d.page); check("V1：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("V2 验证太频繁（429 带 30 秒）", { verify: (r) => json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN + " after 30 seconds" }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /输入得太频繁了/);
  check("V2：文案写 30 秒；「登录」按钮在冷却期内禁用；无原文", /30 秒/.test(await T(d.page, "[data-login-msg]")) && (await d.page.locator("[data-verify]").isDisabled()) && (await noRaw(d.page)));
});
await scenario("V4 登录服务故障（500）", { verify: (r) => json(r, 500, { code: 500, msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /登录服务暂时出问题/);
  check("V4：不说成验证码错；诊断行 诊断：500；XP 句子；无原文", !/验证码错误/.test(await T(d.page, "[data-login-msg]")) && (await T(d.page, "[data-login-diag]")) === "诊断：500" && (await T(d.page, "[data-login-xp]")) === XP50 && (await noRaw(d.page)));
});
await scenario("V3 验证时网络不稳", { verify: (r) => r.abort("connectionreset") }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /登录没有确认/);
  check("V3：提示再点一次「登录」；「登录」按钮可再点", !(await d.page.locator("[data-verify]").isDisabled()) && /再点一次「登录」/.test(await T(d.page, "[data-login-msg]")));
});

// ---------- XP 为 0 ----------
await scenario("没有 XP 时不显示进度句子", { xp: 0, otp: (r) => json(r, 500, { error_code: "unexpected_failure", msg: CAN }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /邮件服务暂时出问题/);
  check("XP=0：进度句子不出现", !(await d.page.locator("[data-login-xp]").isVisible()) && !(await body(d)).includes("XP 还在这台设备上"));
});

// ---------- 成功路径不受影响 ----------
await scenario("发送成功仍进入输验证码，60 秒后才能重发", {}, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const rs = await T(d.page, "[data-resend]");
  check("成功：进入输验证码步骤；“重新发送”有 60 秒内的倒计时；没有诊断行 / 红字", (await d.page.locator("[data-resend]").isDisabled()) && secondsIn(rs) > 0 && secondsIn(rs) <= 60 && (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-msg]")) === "", rs);
});

// ---------- 回归：键盘遮挡（P0-3）----------
await scenario("键盘弹出（可视高度 315）时错误区和发送按钮都看得见", { fakeVv: true, otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " after 40 seconds" }) }, async (d) => {
  await d.page.evaluate(() => { window.__vvh = 315; window.visualViewport.dispatchEvent(new Event("resize")); });
  await d.page.waitForFunction(() => document.querySelector("[data-login]")?.classList.contains("kb-open"));
  const geo = () => d.page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; }; return { vv: window.visualViewport.height, email: r("[data-email]"), send: r("[data-send-code]"), msg: r("[data-login-msg]"), xp: r("[data-login-xp]"), fb: r("[data-login-feedback]"), actions: r(".login-actions"), sheet: r(".login-sheet .sheet") }; });
  let g = await geo();
  check("键盘开：弹窗高度跟 --app-h，底边不超过可视高度", g.sheet && g.sheet.bottom <= g.vv + 1 && g.sheet.top >= -1, JSON.stringify(g.sheet));
  check("键盘开（还没出错）：输入框和发送按钮同时在可视区内", g.email.top >= 0 && g.email.bottom <= g.vv && g.send.bottom <= g.vv && g.send.top >= 0, JSON.stringify(g));
  await sendTap(d);
  await waitMsg(d, /刚刚已经发过验证码/);
  await d.page.waitForTimeout(200);
  g = await geo();
  check("键盘开 + 出错：错误文字和进度行完整可见，且没有被吸底的发送按钮盖住", g.msg.top >= 0 && g.xp.bottom <= g.actions.top + 1 && g.msg.bottom <= g.actions.top + 1, JSON.stringify(g));
  check("键盘开 + 出错：发送按钮（吸底）仍在可视区内", g.send.bottom <= g.vv + 1 && g.send.top >= 0, JSON.stringify(g.send));
  check("键盘开 + 出错：说明段落已隐藏，只留错误区", !(await d.page.locator("[data-login-desc]").isVisible()));
  await d.page.evaluate(() => { window.__vvh = 568; window.visualViewport.dispatchEvent(new Event("resize")); });
  await d.page.waitForFunction(() => !document.querySelector("[data-login]")?.classList.contains("kb-open"));
  check("键盘收起：说明段落恢复（含 50 XP 说明）", /你现在的 50 XP 保存在这台设备上/.test(await T(d.page, "[data-login-desc]")));
  await shot(d, "keyboard");
});

// ---------- 回归：选择弹窗保护（G3 / G4 / C1），游客进度不被覆盖 ----------
const okVerify = (r) => json(r, 200, { access_token: "at-1", refresh_token: "rt-1", expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: "11111111-1111-4111-8111-111111111111", email: "t@example.com" } });
const toChoice = async (d) => { await sendTap(d); await d.page.locator("[data-code]").waitFor(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap(); await d.page.locator('[data-choice="transfer"]').waitFor(); };
await scenario("选择弹窗：处理中不能关，失败后可重试，游客进度不丢", { verify: okVerify, getProgress: async (r, n) => { if (n < 2) return json(r, 200, []); await new Promise((x) => setTimeout(x, 4000)); return json(r, 500, { code: 500, error_code: "unexpected_failure", msg: CAN }); } }, async (d) => {
  await toChoice(d);
  const guestKey = await d.page.evaluate(() => localStorage.getItem("suipian.progress"));
  check("选择弹窗：有「稍后再说」按钮", (await d.page.locator("[data-choice-later]").count()) === 1);
  await d.page.locator('[data-choice="transfer"]').tap();
  await waitMsg(d, /正在上传并核对/, 8000);
  check("G3：处理中两个选择按钮都禁用", (await d.page.locator('[data-choice="transfer"]').isDisabled()) && (await d.page.locator('[data-choice="cloud"]').isDisabled()));
  await d.page.keyboard.press("Escape");
  await d.page.mouse.click(5, 5); // 点遮罩（弹窗外）
  await d.page.waitForTimeout(900);
  check("G3：处理中按 Esc / 点遮罩都关不掉弹窗", (await d.page.locator("[data-login]").count()) === 1);
  await waitMsg(d, /没有处理完/);
  check("C1：失败文案（游客进度原样留在这台设备上）+ XP 句子；两个按钮恢复可点", /游客进度原样留在这台设备上，可以再试一次/.test(await T(d.page, "[data-login-msg]")) && (await T(d.page, "[data-login-xp]")) === XPSYNC && !(await d.page.locator('[data-choice="transfer"]').isDisabled()) && !(await d.page.locator('[data-choice="cloud"]').isDisabled()));
  check("C1：页面上没有服务器原文；游客进度逐字节不变，XP 仍是 50", (await noRaw(d.page)) && (await d.page.evaluate(() => localStorage.getItem("suipian.progress"))) === guestKey && (await d.page.evaluate(() => window.__app.getState().xp)) === 50);
  const bad = await layoutOk(d.page); check("C1：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("选择后上传失败：登录已完成，提示是中文，没有服务器原文", { verify: okVerify, progress: (r) => json(r, 500, { code: 500, error_code: "unexpected_failure", msg: CAN }) }, async (d) => {
  await toChoice(d);
  await d.page.locator('[data-choice="transfer"]').tap();
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"), null, { timeout: 15000 });
  const t = await T(d.page, ".toast");
  check("上传失败：弹窗关闭，提示“登录成功。本机进度仍在，云端同步未完成…”，无英文原文", /登录成功/.test(t) && /本机进度仍在，云端同步未完成/.test(t) && !t.includes(CAN), t);
  check("上传失败：没有 JS 报错且仍是已登录状态", await d.page.evaluate(() => !!window.__app.sync.account()));
});
await scenario("选择弹窗：「稍后再说」不处理，也不会自动覆盖云端", { verify: okVerify }, async (d) => {
  await toChoice(d);
  const guestKey = await d.page.evaluate(() => localStorage.getItem("suipian.progress"));
  await d.page.locator("[data-choice-later]").tap();
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"));
  check("G4：提示“已取消登录。你的 50 XP 还在这台设备上。”", /已取消登录。你的 50 XP 还在这台设备上。/.test(await T(d.page, ".toast")));
  check("G4：没有向云端写任何东西（create / save 都是 0 次）", d.hits.create === 0 && d.hits.save === 0, JSON.stringify(d.hits));
  check("G4：游客进度逐字节不变，XP 仍是 50", (await d.page.evaluate(() => localStorage.getItem("suipian.progress"))) === guestKey && (await d.page.evaluate(() => window.__app.getState().xp)) === 50);
  check("G4：仍是未登录状态（没有半登录）", await d.page.evaluate(() => !window.__app.sync.account()));
  await d.page.waitForTimeout(1500);
  check("G4：等一会儿也不会自己去写云端", d.hits.create === 0 && d.hits.save === 0);
});
await scenario("选择弹窗：空闲时按 Esc 等同于「稍后再说」", { verify: okVerify }, async (d) => {
  await toChoice(d);
  await d.page.keyboard.press("Escape");
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"));
  check("Esc 关闭后给出取消提示，没有写云端", /已取消登录/.test(await T(d.page, ".toast")) && d.hits.create === 0);
});

// ---------- 回归：退出后 0 XP 的说明（P0-4）、冲突死路、重新登录 ----------
async function patchedAccount(d, { status, xp }) {
  await d.page.evaluate(([st, x]) => {
    const a = window.__app;
    a.getState().xp = x; a.persist();
    a.sync.account = () => ({ email: "t@example.com" });
    a.sync.status = () => ({ status: st, message: "CANARY_RAW_SERVER_TEXT", detail: null });
    a.sync.logout = async () => ({ ok: true });
  }, [status, xp]);
  await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="account"]').tap();
  await d.page.waitForSelector("[data-account] [data-logout]");
}
await scenario("退出登录：提示里说清账号的 XP 在云端", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "synced", xp: 120 });
  await d.page.locator("[data-logout]").tap();
  await d.page.waitForSelector(".toast");
  const t = await T(d.page, ".toast");
  check("X0：已退出登录。账号里的 120 XP 在云端，重新登录就回来。", t === "已退出登录。账号里的 120 XP 在云端，重新登录就回来。", t);
});
await scenario("退出登录：账号 XP 为 0 时只说已退出", { nav: "none", xp: 0 }, async (d) => {
  await patchedAccount(d, { status: "synced", xp: 0 });
  await d.page.locator("[data-logout]").tap();
  await d.page.waitForSelector(".toast");
  check("X0（0 XP）：“已退出登录。”", (await T(d.page, ".toast")) === "已退出登录。");
});
await scenario("多设备冲突不再是死路", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "conflict", xp: 80 });
  const st = await T(d.page, "[data-sync-status]");
  check("Y9a：说明同步已暂停、本机进度还在、去哪里导出", /同步已暂停/.test(st) && /进度还在/.test(st) && /导出进度文件/.test(st) && !/需要选择保留哪一份/.test(st) && !st.includes(CAN), st);
  check("Y9a：「立即同步」禁用（避免反复撞冲突），「导出进度文件」可点", (await d.page.locator("[data-sync-now]").isDisabled()) && (await d.page.locator("[data-export]").isVisible()) && !(await d.page.locator("[data-export]").isDisabled()));
  const dl = d.page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await d.page.locator("[data-export]").tap();
  const file = await dl;
  check("Y9a：点「导出进度文件」真的能下载到文件", !!file);
  check("Y9a：页面上没有服务器原文；退出 / 切换账号按钮仍可点", (await noRaw(d.page)) && !(await d.page.locator("[data-logout]").isDisabled()) && !(await d.page.locator("[data-switch]").isDisabled()));
  const bad = await layoutOk(d.page); check("Y9a：320px 布局无溢出", bad.length === 0, bad.join("; "));
});
await scenario("同步出错的状态栏不显示英文", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "error", xp: 80 });
  const st = await T(d.page, "[data-sync-status]");
  check("Y3：不显示“同步失败：英文”", !st.includes(CAN) && !/[A-Za-z]{4,}/.test(st), st);
});
await scenario("登录已过期：有「重新登录」按钮，邮箱预填", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "need-login", xp: 80 });
  check("Y7：账号卡片上有「重新登录」", (await d.page.locator("[data-relogin]").count()) === 1);
  await d.page.locator("[data-relogin]").tap();
  await d.page.locator("[data-email]").waitFor();
  check("Y7：登录页邮箱已预填，说明里写“登录已过期”", (await d.page.locator("[data-email]").inputValue()) === "t@example.com" && /登录已过期/.test(await T(d.page, "[data-login-desc]")));
});

// ---------- 产品官裁决：退出时区分已同步 / 未上传；换邮箱不串冷却；冲突期间不写云端 ----------
await scenario("退出登录：同步没完成时不报 XP 数字，说清已同步在云端、未上传留在本机", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "pending", xp: 120 });
  await d.page.locator("[data-logout]").tap();
  await d.page.waitForSelector(".toast, [data-confirm], .sheet button");
  let t = await T(d.page, ".toast");
  if (!t) { await d.page.getByRole("button", { name: "仍然退出" }).tap().catch(() => {}); await d.page.waitForSelector(".toast"); t = await T(d.page, ".toast"); }
  check("X0（未同步）：已退出登录。已同步的进度在云端；还没上传的进度留在这台设备上…，且不含 120", /^已退出登录。已同步的进度在云端；还没上传的进度留在这台设备上/.test(t) && !t.includes("120"), t);
});
await scenario("换邮箱：针对旧邮箱的冷却不会拦住新邮箱，改回旧邮箱仍然拦", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " after 40 seconds" }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /刚刚已经发过验证码/);
  check("旧邮箱：发送按钮被冷却锁住", await d.page.locator("[data-send-code]").isDisabled());
  await d.page.locator("[data-email]").fill("other@example.com");
  check("改成新邮箱：按钮立刻可点，旧邮箱的“刚刚已发过”提示清掉", !(await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-send-code]")) === "发送验证码" && (await T(d.page, "[data-login-msg]")) === "" && (await d.page.locator("[data-enter-code]").count()) === 0);
  await d.page.locator("[data-email]").fill("T@Example.com ");
  check("改回旧邮箱（大小写 / 空格不同也算同一个）：按钮又被锁住", await d.page.locator("[data-send-code]").isDisabled());
  check("整个过程服务器只收到 1 次 otp 请求", d.hits.otp === 1, String(d.hits.otp));
});
await scenario("超时后返回改邮箱：新邮箱不继承旧邮箱的 60 秒等待，验证码页重新计时", { otp: (r) => (r.request().postData() || "").includes("t@example.com") ? new Promise(() => {}) : json(r, 200, {}) }, async (d) => {
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor({ timeout: 25000 });
  check("超时进入验证码页：重发被锁", await d.page.locator("[data-resend]").isDisabled());
  await d.page.getByRole("button", { name: "换个邮箱" }).tap();
  await d.page.locator("[data-email]").waitFor();
  check("回到填邮箱页：旧邮箱的冷却仍然拦着同一个邮箱（不能立刻重发）", await d.page.locator("[data-send-code]").isDisabled());
  await d.page.locator("[data-email]").fill("new@example.com");
  check("改成新邮箱：可以发送", !(await d.page.locator("[data-send-code]").isDisabled()));
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor();
  const rs = await T(d.page, "[data-resend]");
  check("新邮箱的验证码页：重发倒计时重新从约 60 秒开始，验证码输入框是空的，没有旧邮箱的错误提示", secondsIn(rs) > 50 && secondsIn(rs) <= 60 && (await d.page.locator("[data-code]").inputValue()) === "" && (await T(d.page, "[data-login-msg]")) === "" && /new@example.com/.test(await T(d.page, ".login-sent")), rs);
  check("两个邮箱各发 1 次，共 2 次请求", d.hits.otp === 2, String(d.hits.otp));
});
await scenario("冲突期间不会写云端：禁用的「立即同步」点不动，不产生任何写请求", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "conflict", xp: 80 });
  await d.page.locator("[data-sync-now]").evaluate((b) => b.click());
  await d.page.waitForTimeout(800);
  check("冲突：没有 create / save 请求，本机 XP 原样", d.hits.create === 0 && d.hits.save === 0 && (await d.page.evaluate(() => window.__app.getState().xp)) === 80, JSON.stringify(d.hits));
});

// ---------- 已发布产物的核对（只在 DIST_DIR / FAKE_URL 给定时运行）----------
if (EXPECT_SHA) {
  await scenario("预览产物：页面显示的源码提交、云项目，且只访问测试项目", { nav: "none", otp: (r) => json(r, 500, { error_code: "unexpected_failure", msg: CAN }) }, async (d) => {
    await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="account"]').tap();
    await d.page.waitForSelector("[data-account]");
    const txt = await body(d);
    check(`“我的”页显示源码提交 ${EXPECT_SHA.slice(0, 7)}`, txt.includes(EXPECT_SHA), txt.slice(0, 200));
    const ref = new URL(FAKE).host.split(".")[0];
    check(`“我的”页显示云项目 ${ref}（测试项目，不是正式项目）`, txt.includes(ref) && !txt.includes("aqlcunkmggzzvyavlkjg") && !txt.includes("⚠ 正式项目"));
    await d.page.locator("[data-open-login]").tap();
    await d.page.locator("[data-email]").fill("t@example.com");
    await sendTap(d);
    await waitMsg(d, /邮件服务暂时出问题/);
    const allowed = new Set(["localhost:" + PORT, new URL(FAKE).host]);
    const other = [...d.hosts].filter((x) => !allowed.has(x));
    check("整个过程只访问本机页面和测试项目地址（请求都被浏览器内拦截，没有发往任何服务器）", other.length === 0, other.join(","));
    check("没有出现正式项目地址", ![...d.hosts].some((x) => x.includes("aqlcunkmggzzvyavlkjg")));
  });
}

await browser.close(); srv.closeAllConnections(); srv.close();
const bad = results.filter((v) => !v).length;
console.log(`\n${BNAME}: ${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
