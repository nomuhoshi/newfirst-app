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
// 浏览器只在服务器声明 expose-headers 时才让页面读到 Retry-After（跨域）；测试里的假服务器显式声明，等于真实服务器配置了的情形。
const RAX = (sec) => ({ "retry-after": String(sec), "access-control-expose-headers": "retry-after" });
const json = (route, status, body, headers = {}) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json", ...headers }, body: body === undefined ? "" : JSON.stringify(body) });

// 每个场景的假服务器应答由场景决定：函数 (route) => ...。progress 相关的路由默认返回“云端没有进度”。
// stall：路径片段列表。命中的请求在页面里直接得到“响应头 200 已到、正文永远不来”的响应（不经过 route，也不响应中止信号 = 最坏情况）
async function device({ xp = 50, otp, verify, progress, getProgress, logout, del, online = true, fakeVv = false, nav = "login", stall = [] } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 320, height: 568 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  const hits = { otp: 0, verify: 0, create: 0, save: 0, get: 0, logout: 0, del: 0 };
  const rows = { n: 0 };
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/otp") { hits.otp++; return (otp || ((r) => json(r, 200, {})))(route); }
    if (u.pathname === "/auth/v1/verify") { hits.verify++; return (verify || ((r) => json(r, 403, { msg: "Token has expired or is invalid" })))(route); }
    if (u.pathname === "/rest/v1/progress") { hits.get++; return (getProgress || ((r) => json(r, 200, [])))(route, hits.get); }
    if (u.pathname === "/rest/v1/rpc/create_progress") { hits.create++; return (progress || ((r) => json(r, 200, 1)))(route); }
    if (u.pathname === "/rest/v1/rpc/save_progress") { hits.save++; return json(route, 200, null); }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") { hits.del++; return (del || ((r) => json(r, 200, null)))(route, hits.del); }
    if (u.pathname === "/auth/v1/logout") { hits.logout++; return (logout || ((r) => json(r, 204)))(route, hits.logout); }
    return json(route, 404, { message: "no route" });
  });
  const guest = { version: 3, onboarded: true, xp, hearts: 5, heartsAt: Date.now(), streak: 1, lastDay: "2026-11-03", done: xp > 0 ? { U1L1: true } : {}, lessonsCompleted: xp > 0 ? 1 : 0, installTipClosed: false, lastActive: 0, prefs: { sound: true, haptics: true, soundStyle: "J" } };
  await ctx.addInitScript(([cfg, g, onl, fake, pfx, stall]) => {
    if (stall.length) { const of = window.fetch.bind(window); window.__stalled = 0; window.fetch = (input, init) => { const u = String(typeof input === "string" ? input : input?.url || ""); if (stall.some((x) => u.includes(x))) { window.__stalled++; return Promise.resolve(new Response(new ReadableStream({ start() {} }), { status: 200 })); } return of(input, init); }; }
    try { if (!pfx && !localStorage.getItem("suipian.cloudConfig")) localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg)); if (!localStorage.getItem(pfx + "suipian.progress") && !sessionStorage.getItem("g-done")) { localStorage.setItem(pfx + "suipian.progress", JSON.stringify(g)); sessionStorage.setItem("g-done", "1"); } } catch {}
    if (!onl) Object.defineProperty(navigator, "onLine", { get: () => false, configurable: true });
    if (fake) { // 模拟 iOS：键盘弹出时可视视口变矮，但布局视口不变
      const vv = new EventTarget();
      Object.defineProperties(vv, { height: { get: () => window.__vvh ?? window.innerHeight }, width: { get: () => window.innerWidth }, offsetTop: { value: 0 }, offsetLeft: { value: 0 }, scale: { value: 1 } });
      Object.defineProperty(window, "visualViewport", { value: vv, configurable: true });
    }
  }, [{ url: FAKE, anonKey: "pub-key" }, guest, online, fakeVv, PFX, stall]);
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
await scenario("S2 邮箱发送间隔（G-LOGIN-06：不再说“刚发过”，等待取本页门禁 60 秒默认）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " For security purposes, you can only request this after 40 seconds." }) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /这个邮箱请求验证码太频繁/);
  const btn = await T(d.page, "[data-send-code]");
  check("S2：没有 Retry-After → 沿用 60 秒默认门禁，按钮写“N 秒后可再发”（原文里的 40 秒不决定等待）", secondsIn(btn) >= 55 && secondsIn(btn) <= 60 && /秒后可再发/.test(btn), btn);
  check("S2：文案不说“刚发过”、不保证旧验证码有效；没有诊断行；XP 句子在", /不一定还有效/.test(await T(d.page, "[data-login-msg]")) && !/刚刚已经发过|还能用/.test(await T(d.page, "[data-login-msg]")) && (await T(d.page, "[data-login-diag]")) === "" && (await T(d.page, "[data-login-xp]")) === XP50);
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
await scenario("S3 邮件服务限流（email rate limit exceeded；G-LOGIN-06 不再生成 5 分钟）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " email rate limit exceeded" }, RAX(600)) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /邮件服务暂时限流/);
  const b3 = await T(d.page, "[data-send-code]");
  check("S3：有等待头也不变 S2；按钮禁用，写真实倒计时“约 10 分钟后可再发”（不是 5 分钟）；无诊断行；无次按钮", /^约 10 分钟后可再发$/.test(b3) && (await d.page.locator("[data-send-code]").isDisabled()) && (await T(d.page, "[data-login-diag]")) === "" && (await d.page.locator("[data-enter-code]").count()) === 0);
});
await scenario("S8 请求限流（over_request_rate_limit + Retry-After 7200：中性文案，长等待不截成一小时）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN }, RAX(7200)) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /请求太频繁了，暂时发不出验证码/);
  const m8 = await T(d.page, "[data-login-msg]"), b8 = await T(d.page, "[data-send-code]");
  check("S8：不说“验证码刚发过”、不说邮件额度；写约 2 小时；按钮倒计时约 2 小时（不是 60 分钟）；没有“我已收到”入口", /约 2 小时/.test(m8) && !/发过|邮件服务|额度/.test(m8) && /^约 2 小时后可再发$/.test(b8) && (await d.page.locator("[data-enter-code]").count()) === 0, m8 + " | " + b8);
  check("S8：页面上没有服务器原文；服务器只收到 1 次请求", (await noRaw(d.page)) && d.hits.otp === 1, String(d.hits.otp));
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

// 响应头已到、正文永远不来（2026-11-19 GPT1 验收条件 1–4）：必须和“响应头没到”一样在时限后结束、界面解除处理中状态
await scenario("S1b 响应头已到、正文挂起（发码）", { stall: ["/auth/v1/otp"] }, async (d) => {
  const before = await dump(d.page);
  await sendTap(d);
  await d.page.locator("[data-code]").waitFor({ timeout: 25000 });
  const m = await T(d.page, "[data-login-msg]");
  check("正文挂起·发码：到时跳到输验证码页，文案要求先检查邮箱（可能已发出）", /请求超时，邮件可能已发出。请先检查邮箱/.test(m), m);
  check("正文挂起·发码：只发出 1 次请求（不自动重发），“重新发送”被冷却锁住", (await d.page.evaluate(() => window.__stalled)) === 1 && (await d.page.locator("[data-resend]").isDisabled()));
  check("正文挂起·发码：本机存储逐字节不变（进度、游客记录都在）", (await dump(d.page)) === before);
});
await scenario("S1b 响应头已到、正文挂起（输验证码登录）", { stall: ["/auth/v1/verify"] }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const before = await dump(d.page);
  await d.page.locator("[data-code]").fill("123456");
  await d.page.locator("[data-verify]").tap();
  check("正文挂起·登录：显示“登录中…”并禁用按钮", (await T(d.page, "[data-verify]")) === "登录中…" && (await d.page.locator("[data-verify]").isDisabled()));
  await waitMsg(d, /网络不稳，登录没有确认/, 25000);
  check("正文挂起·登录：到时解除“登录中”——按钮恢复可点、文字回到“登录”", (await T(d.page, "[data-verify]")) === "登录" && !(await d.page.locator("[data-verify]").isDisabled()));
  check("正文挂起·登录：没有登录成功（弹窗仍在、没有账号卡片）", (await d.page.locator("[data-login]").count()) === 1);
  check("正文挂起·登录：能退回改邮箱（弹窗不再被“处理中”锁死）", await d.page.locator("[data-code]").count() === 1 && (await d.page.getByRole("button", { name: "换个邮箱" }).tap().then(() => true, () => false)) && (await d.page.locator("[data-email]").count()) === 1);
  check("正文挂起·登录：本机存储逐字节不变（进度、游客记录都在）", (await dump(d.page)) === before);
});

await scenario("登录调用抛异常：“登录中”也会解除（busy / 按钮在 finally 复位）", {}, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const before = await dump(d.page);
  await d.page.evaluate(() => { const s = window.__app.sync; window.__origVerify = s.verify; s.verify = async () => { throw new Error("boom"); }; });
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /登录没有确认/);
  check("抛异常·登录：按钮恢复可点、文字回到“登录”（没有卡在“登录中…”）", (await T(d.page, "[data-verify]")) === "登录" && !(await d.page.locator("[data-verify]").isDisabled()));
  check("抛异常·登录：弹窗没被处理中锁死（能点「换个邮箱」）、没有登录成功", (await d.page.locator("[data-login]").count()) === 1 && (await d.page.getByRole("button", { name: "换个邮箱" }).tap().then(() => true, () => false)) && (await d.page.locator("[data-email]").count()) === 1);
  check("抛异常·登录：本机存储逐字节不变", (await dump(d.page)) === before);
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
await scenario("键盘弹出（可视高度 315）时错误区和发送按钮都看得见", { fakeVv: true, otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " For security purposes, you can only request this after 40 seconds." }) }, async (d) => {
  await d.page.evaluate(() => { window.__vvh = 315; window.visualViewport.dispatchEvent(new Event("resize")); });
  await d.page.waitForFunction(() => document.querySelector("[data-login]")?.classList.contains("kb-open"));
  const geo = () => d.page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if (!e || e.offsetParent === null) return null; const b = e.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; }; return { vv: window.visualViewport.height, email: r("[data-email]"), send: r("[data-send-code]"), msg: r("[data-login-msg]"), xp: r("[data-login-xp]"), fb: r("[data-login-feedback]"), actions: r(".login-actions"), sheet: r(".login-sheet .sheet") }; });
  let g = await geo();
  check("键盘开：弹窗高度跟 --app-h，底边不超过可视高度", g.sheet && g.sheet.bottom <= g.vv + 1 && g.sheet.top >= -1, JSON.stringify(g.sheet));
  check("键盘开（还没出错）：输入框和发送按钮同时在可视区内", g.email.top >= 0 && g.email.bottom <= g.vv && g.send.bottom <= g.vv && g.send.top >= 0, JSON.stringify(g));
  await sendTap(d);
  await waitMsg(d, /这个邮箱请求验证码太频繁/);
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
// 2026-11-19（GPT1 方案）：验证码这一步成功（验证码已被用掉），随后读云端记录失败 → 保留已验证会话，按钮变「重试读取」，重试不再调用验证接口
const hasVerified = (d) => d.page.evaluate(() => window.__app.sync.hasVerified());
await scenario("V5 验证码对了、读云端先 503 再成功：点「重试读取」完成登录，验证接口只调 1 次", { verify: okVerify, getProgress: (r, n) => (n < 2 ? json(r, 503, { msg: CAN }) : json(r, 200, [])) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  const before = await dump(d.page);
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码对了，但读取云端记录没成功/);
  const m = await T(d.page, "[data-login-msg]");
  check("V5：提示点「重试读取」、不用重新输入验证码；不叫人再点「登录」、不说验证码错", /「重试读取」/.test(m) && /不用重新输入验证码/.test(m) && !/再点「登录」|稍后再点|重新发送/.test(m) && !/验证码错误/.test(m), m);
  check("V5：按钮文字变成「重试读取」且可点；诊断行 诊断：503；没有服务器原文", (await T(d.page, "[data-verify]")) === "重试读取" && !(await d.page.locator("[data-verify]").isDisabled()) && (await T(d.page, "[data-login-diag]")) === "诊断：503" && (await noRaw(d.page)));
  check("V5：没有登录成功（弹窗还在、还在输验证码页），本机存储逐字节不变，验证接口 1 次", (await d.page.locator("[data-code]").count()) === 1 && (await dump(d.page)) === before && d.hits.verify === 1);
  await d.page.locator("[data-verify]").tap();
  await d.page.locator('[data-choice="transfer"]').waitFor({ timeout: 15000 });
  check("点「重试读取」：不再调用验证接口（仍是 1 次），读到云端后进入游客进度选择，游客进度还在", d.hits.verify === 1 && d.hits.get === 2 && (await d.page.evaluate(() => window.__app.getState().xp)) === 50);
  await d.page.locator('[data-choice="transfer"]').tap();
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"), null, { timeout: 15000 });
  check("选择合并后登录完成：已登录、XP 仍是 50、验证接口全程 1 次、已验证会话已清掉", (await d.page.evaluate(() => !!window.__app.sync.account() && window.__app.getState().xp === 50)) && d.hits.verify === 1 && !(await hasVerified(d)));
});
await scenario("V5 读云端被拒（403）：只允许重试 1 次，之后叫人换新验证码（V6）", { verify: okVerify, getProgress: (r) => json(r, 403, { code: 403, error_code: "bad_jwt", msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码对了，但读取云端记录没成功/);
  check("403 首次失败：V5、按钮「重试读取」", (await T(d.page, "[data-verify]")) === "重试读取" && /「重试读取」/.test(await T(d.page, "[data-login-msg]")));
  await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /这个验证码已经用过/);
  const m = await T(d.page, "[data-login-msg]");
  check("403 重试仍失败：V6——说明验证码已用过、请点「重新发送」换新的；不再有「重试读取」", /「重新发送」/.test(m) && !/重试读取/.test(m) && (await T(d.page, "[data-verify]")) === "登录" && !(await hasVerified(d)), m);
  check("403：验证接口仍只调 1 次、读取共 2 次；没有登录；没有服务器原文", d.hits.verify === 1 && d.hits.get === 2 && !(await d.page.evaluate(() => !!window.__app.sync.account())) && (await noRaw(d.page)));
});
await scenario("V5 作废：改验证码 / 关窗都会清掉已验证会话", { verify: okVerify, getProgress: (r) => json(r, 503, { msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码对了，但读取云端记录没成功/);
  check("V5 之后已验证会话在内存里", await hasVerified(d));
  await d.page.locator("[data-code]").fill("654321");
  check("改了验证码：已验证会话作废、按钮回到「登录」、旧提示清掉", !(await hasVerified(d)) && (await T(d.page, "[data-verify]")) === "登录" && !/重试读取/.test(await T(d.page, "[data-login-msg]")));
  await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码对了，但读取云端记录没成功/);
  check("新输的码走正常验证（验证接口第 2 次），再次进入「重试读取」", d.hits.verify === 2 && (await T(d.page, "[data-verify]")) === "重试读取" && (await hasVerified(d)));
  await d.page.locator("[data-code]").focus(); // 按钮在处理中被禁用过，焦点已回到页面：先把焦点放回弹窗里，Esc 才送得到弹窗
  await d.page.keyboard.press("Escape");
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"));
  check("关窗：已验证会话作废（不会带到下一次打开）", !(await hasVerified(d)) && !(await d.page.evaluate(() => !!window.__app.sync.account())));
});
await scenario("V5 换个邮箱：已验证会话作废", { verify: okVerify, getProgress: (r) => json(r, 503, { msg: CAN }) }, async (d) => {
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await waitMsg(d, /验证码对了，但读取云端记录没成功/);
  await d.page.getByRole("button", { name: "换个邮箱" }).tap();
  await d.page.locator("[data-email]").waitFor();
  check("换个邮箱：回到邮箱页、已验证会话作废、没有登录", !(await hasVerified(d)) && !(await d.page.evaluate(() => !!window.__app.sync.account())));
});
// 2026-11-20（GPT1 任务 3）：重试读取被 429 限流 → 按钮显示倒计时并禁用，等待期间不发请求；等待跨过会话到期 → V6（不自动重发验证码）。
// 页面里的时间用“偏移量”快进（Date.now 加上偏移，应用里所有倒计时 / 到期判断都读它）；浏览器只等真实的几秒。
const RA = (sec) => ({ "retry-after": String(sec), "access-control-expose-headers": "Retry-After" });
const shiftClock = (d, ms) => d.page.evaluate((ms) => { if (window.__shiftOff === undefined) { window.__shiftOff = 0; const real = Date.now.bind(Date); Date.now = () => real() + window.__shiftOff; } window.__shiftOff += ms; document.dispatchEvent(new Event("visibilitychange")); }, ms); // 同时模拟“从后台回来”
const goText = (d) => T(d.page, "[data-verify]");
const toWait = async (d) => { await sendTap(d); await d.page.locator("[data-code]").waitFor(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap(); await waitMsg(d, /云端读取太频繁/); };
await scenario("V5w 重试读取被 429：按钮倒计时并禁用，等待期间不发请求；等完再点才读取", { verify: okVerify, getProgress: (r, n) => (n < 2 ? json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN }, RA(7)) : json(r, 200, [])) }, async (d) => {
  await toWait(d);
  const m = await T(d.page, "[data-login-msg]");
  check("V5w：提示“读取太频繁、请等 N 秒再点「重试读取」，不用重新输入验证码”；不说验证码错、不叫换新码、没有服务器原文", /请等 \d+ 秒再点「重试读取」/.test(m) && /不用重新输入验证码/.test(m) && !/验证码错误|重新发送/.test(m) && (await noRaw(d.page)), m);
  const b0 = await goText(d);
  check("V5w：按钮写“重试读取（N 秒）”（N ≤ 8）且禁用；弹窗还在；验证接口 1 次、读取 1 次", /^重试读取（[1-8] 秒）$/.test(b0) && (await d.page.locator("[data-verify]").isDisabled()) && (await d.page.locator("[data-code]").count()) === 1 && d.hits.verify === 1 && d.hits.get === 1, b0);
  await d.page.locator("[data-verify]").evaluate((el) => el.click()); await d.page.locator("[data-code]").press("Enter"); // 禁用按钮 / 回车：都不该发请求
  const direct = await d.page.evaluate(async () => { const r = await window.__app.sync.retryRead(window.__app.getState()); const v = await window.__app.sync.verify("t@example.com", "123456", window.__app.getState()); return [r.kind, r.stage, r.canRetry, v.kind, v.stage]; });
  await d.page.waitForTimeout(300);
  check("V5w：点禁用的按钮 / 回车 / 直接调用 retryRead 和同码 verify，都不发请求（读取仍是 1 次、验证接口仍是 1 次），仍有等待", d.hits.get === 1 && d.hits.verify === 1 && direct.join() === "rate-limit,read,true,rate-limit,read" && (await hasVerified(d)), JSON.stringify([d.hits, direct]));
  await d.page.waitForFunction(() => document.querySelector("[data-verify]")?.textContent === "重试读取" && !document.querySelector("[data-verify]").disabled, null, { timeout: 15000 });
  const m2 = await T(d.page, "[data-login-msg]");
  check("等待结束：按钮恢复「重试读取」且可点，提示换回普通的“点「重试读取」再试一次”；等待期间一共只读取过 1 次", /验证码对了，但读取云端记录没成功/.test(m2) && d.hits.get === 1 && d.hits.verify === 1, m2);
  await d.page.locator("[data-verify]").tap();
  await d.page.locator('[data-choice="transfer"]').waitFor({ timeout: 15000 });
  check("等完再点「重试读取」：读取第 2 次，进入游客进度选择；验证接口始终 1 次；发信接口始终 1 次（没有自动重发）", d.hits.get === 2 && d.hits.verify === 1 && d.hits.otp === 1);
  await d.page.locator('[data-choice="transfer"]').tap();
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"), null, { timeout: 15000 });
  check("选择后登录完成：已登录，XP 仍是 50", await d.page.evaluate(() => !!window.__app.sync.account() && window.__app.getState().xp === 50));
});
await scenario("V5w 从后台回来：倒计时按真实时间走（不是从头数）；到点恢复", { verify: okVerify, getProgress: (r, n) => (n < 2 ? json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN }, RA(120)) : json(r, 200, [])) }, async (d) => {
  await toWait(d);
  const b0 = secondsIn(await goText(d));
  check("初始倒计时约 120 秒", b0 >= 115 && b0 <= 120, String(b0));
  await shiftClock(d, 100_000);
  const b1 = secondsIn(await goText(d));
  check("过了 100 秒（后台回来）：倒计时直接是约 20 秒，按钮仍禁用，期间没有新请求", b1 >= 17 && b1 <= 20 && (await d.page.locator("[data-verify]").isDisabled()) && d.hits.get === 1, String(b1));
  await shiftClock(d, 30_000);
  check("再过 30 秒：等待结束，按钮是「重试读取」且可点", (await goText(d)) === "重试读取" && !(await d.page.locator("[data-verify]").isDisabled()));
  await d.page.locator("[data-verify]").tap();
  await d.page.locator('[data-choice="transfer"]').waitFor({ timeout: 15000 });
  check("点「重试读取」成功：读取共 2 次、验证接口 1 次", d.hits.get === 2 && d.hits.verify === 1);
});
await scenario("V5w 等待跨过会话到期：转 V6（请重新发送），不自动重发验证码，不再读取", { verify: okVerify, getProgress: (r) => json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN }, RA(1000)) }, async (d) => {
  await toWait(d);
  check("等待 1000 秒、已验证会话只有 5 分钟：先显示倒计时", /^重试读取（\d+ 秒）$/.test(await goText(d)) && (await hasVerified(d)));
  await shiftClock(d, 310_000);
  await waitMsg(d, /这个验证码已经用过/);
  const m = await T(d.page, "[data-login-msg]");
  check("会话到期：V6——验证码已用过，请点「重新发送」；按钮回到「登录」且没有倒计时字样", /「重新发送」/.test(m) && !/重试读取/.test(m) && (await goText(d)) === "登录" && !(await hasVerified(d)), m);
  check("没有自动重发验证码（发信接口仍是 1 次）、没有再读取（读取仍是 1 次）、验证接口 1 次、没有登录", d.hits.otp === 1 && d.hits.get === 1 && d.hits.verify === 1 && !(await d.page.evaluate(() => !!window.__app.sync.account())));
});
await scenario("V5w 等待期间：改验证码 / 换个邮箱 / 重新发送 / 关窗，都作废旧会话和旧倒计时", { verify: okVerify, getProgress: (r) => json(r, 429, { code: 429, error_code: "over_request_rate_limit", msg: CAN }, RA(300)) }, async (d) => {
  await toWait(d);
  await d.page.locator("[data-code]").fill("654321");
  check("改验证码：已验证会话作废，按钮回到「登录」且可点（没有倒计时）", !(await hasVerified(d)) && (await goText(d)) === "登录" && !(await d.page.locator("[data-verify]").isDisabled()));
  await d.page.locator("[data-verify]").tap(); await waitMsg(d, /云端读取太频繁/);
  check("新码走正常验证（验证接口第 2 次），再次进入倒计时", d.hits.verify === 2 && /^重试读取（\d+ 秒）$/.test(await goText(d)));
  await shiftClock(d, 61_000); // 让“重新发送”的 60 秒冷却结束
  await d.page.locator("[data-resend]").tap(); await waitMsg(d, /已重新发送/);
  check("重新发送：发信接口第 2 次；旧会话作废、按钮回到「登录」且可点", d.hits.otp === 2 && !(await hasVerified(d)) && (await goText(d)) === "登录" && !(await d.page.locator("[data-verify]").isDisabled()));
  await d.page.locator("[data-code]").fill("111111"); await d.page.locator("[data-verify]").tap(); await waitMsg(d, /云端读取太频繁/);
  await d.page.getByRole("button", { name: "换个邮箱" }).tap(); await d.page.locator("[data-email]").waitFor();
  check("换个邮箱：回邮箱页，旧会话作废", !(await hasVerified(d)));
  await shiftClock(d, 61_000); // 刚重发过：等“发送”的 60 秒冷却结束
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  check("同一个邮箱重新发码进入验证码页：按钮是「登录」（旧倒计时没有带过来）且可点", (await goText(d)) === "登录" && !(await d.page.locator("[data-verify]").isDisabled()));
  await d.page.locator("[data-code]").fill("222222"); await d.page.locator("[data-verify]").tap(); await waitMsg(d, /云端读取太频繁/);
  await d.page.locator("[data-code]").focus(); await d.page.keyboard.press("Escape");
  await d.page.waitForFunction(() => !document.querySelector("[data-login]"));
  check("关窗：旧会话作废，没有登录", !(await hasVerified(d)) && !(await d.page.evaluate(() => !!window.__app.sync.account())));
});
// 2026-11-20（GPT1 第 1 单）：退出 / 切换账号共用处理中锁，重复点击只撤销一次，已退出的收尾（提示 / 回调）只执行一次。
// 记录每一次 showToast：提示元素是复用的，重复设置同样的文字浏览器不一定产生 DOM 变化，所以改为数 showToast 排的 4 秒清除定时器（每次提示恰好排一个）
const logToasts = (page) => page.evaluate(() => { window.__toasts = []; const st = window.setTimeout.bind(window); window.setTimeout = (fn, ms, ...a) => { if (ms === 4000) window.__toasts.push(document.querySelector(".toast")?.textContent ?? ""); return st(fn, ms, ...a); }; });
const loggedInAccountCard = async (d) => { // 游客 0 XP：登录直接完成，再打开账号卡
  await sendTap(d); await d.page.locator("[data-code]").waitFor();
  await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await d.page.locator('[data-choice="cloud"]').waitFor({ timeout: 15000 }); await d.page.locator('[data-choice="cloud"]').tap(); // 游客记录（0 XP）也会问一次：选“用全新账号”
  try { await d.page.waitForFunction(() => !document.querySelector("[data-login]") && !!window.__app.sync.account(), null, { timeout: 15000 }); } catch (e) { throw new Error("登录没完成：" + (await d.page.evaluate(() => JSON.stringify({ login: !!document.querySelector("[data-login]"), acct: window.__app.sync.account(), msg: document.querySelector("[data-login-msg]")?.textContent, body: document.querySelector("[data-login]")?.innerText?.slice(0, 200) })))); }
  await logToasts(d.page);
  await d.page.getByRole("button", { name: "我的" }).tap(); await d.page.locator('[data-me-menu="account"]').tap();
  await d.page.waitForSelector("[data-account] [data-logout]");
};
// 有“云端记录”的假服务器：第一次创建成功，之后读得回来（否则登录后会一直是“待上传”，退出会先问“有进度还没上传”）
const cloudWithRow = () => { const st = { row: null }; return { progress: (r) => { if (st.row) return json(r, 200, null); try { st.row = { doc: JSON.parse(r.request().postData() || "{}").new_doc, rev: 1 }; } catch { st.row = { doc: {}, rev: 1 }; } return json(r, 200, 1); }, getProgress: (r) => json(r, 200, st.row ? [{ doc: st.row.doc, rev: st.row.rev }] : []) }; };
const gate = () => { let go; const p = new Promise((r) => { go = r; }); return { p, go }; };
await (async () => {
  const g = gate();
  await scenario("退出登录：连点两次 + 点「切换账号」，只撤销一次，两个按钮都禁用，已退出的提示只出现一次", { xp: 0, verify: okVerify, ...cloudWithRow(), logout: async (r) => { await g.p; return json(r, 204); } }, async (d) => {
    await loggedInAccountCard(d);
    await d.page.locator("[data-logout]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-logout]")?.disabled === true);
    check("点「退出登录」后：「退出登录」「切换账号」两个按钮都立刻禁用", (await d.page.locator("[data-logout]").isDisabled()) && (await d.page.locator("[data-switch]").isDisabled()));
    await d.page.locator("[data-logout]").evaluate((el) => { el.disabled = false; el.click(); el.click(); }); // 绕过禁用态，直接再点（模拟极快的连点 / 键盘重复）
    await d.page.locator("[data-switch]").evaluate((el) => { el.disabled = false; el.click(); });
    await d.page.waitForTimeout(300);
    check("连点两次「退出登录」+ 点一次「切换账号」：云端撤销请求只有 1 次，没有打开登录弹窗", d.hits.logout === 1 && (await d.page.locator("[data-login]").count()) === 0, JSON.stringify(d.hits));
    g.go(); await d.page.waitForFunction(() => !window.__app.sync.account(), null, { timeout: 15000 }); await d.page.waitForTimeout(300);
    const toasts = await d.page.evaluate(() => window.__toasts);
    check("放行后：退出成功，“已退出登录”的提示只出现 1 次，撤销请求仍只有 1 次", toasts.filter((x) => /已退出登录/.test(x)).length === 1 && d.hits.logout === 1, JSON.stringify([toasts, d.hits.logout]));
  });
})();
await (async () => {
  const g = gate();
  await scenario("切换账号：处理中点「退出登录」被挡；完成后只打开一次登录弹窗", { xp: 0, verify: okVerify, ...cloudWithRow(), logout: async (r) => { await g.p; return json(r, 204); } }, async (d) => {
    await loggedInAccountCard(d);
    await d.page.locator("[data-switch]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-switch]")?.disabled === true);
    await d.page.locator("[data-logout]").evaluate((el) => { el.disabled = false; el.click(); });
    await d.page.waitForTimeout(300);
    check("处理中点「退出登录」：不发第二次撤销", d.hits.logout === 1, JSON.stringify(d.hits));
    g.go(); await d.page.locator("[data-login]").waitFor({ timeout: 15000 }); await d.page.waitForTimeout(300);
    check("完成后：已退出，登录弹窗只有 1 个（切换账号的回调只执行一次）", (await d.page.locator("[data-login]").count()) === 1 && !(await d.page.evaluate(() => !!window.__app.sync.account())));
  });
})();
// GPT1 15:00：退出处理中，重新登录 / 删除账号入口也一起禁用（现有按钮、重新渲染出的新卡片首帧、处理函数兜底）；失败后恢复；确认弹窗里的强制退出只执行一次
const LOCKED = ["[data-logout]", "[data-switch]", "[data-delete-account]", "[data-relogin]"];
const lockedState = (d) => d.page.evaluate((sels) => sels.map((s) => { const el = document.querySelector(s); return el ? (el.disabled ? "禁用" : "可点") : "无"; }), LOCKED);
const reopenAccount = async (d) => { await d.page.locator("[data-me-back]").tap(); await d.page.locator('[data-me-menu="account"]').tap(); await d.page.waitForSelector("[data-account] [data-logout]"); };
const showNeedLogin = async (d) => { await d.page.evaluate(() => { window.__app.sync.status = (() => { const o = window.__app.sync.status; return () => ({ ...o(), status: "need-login" }); })(); }); await reopenAccount(d); };
await (async () => {
  const g = gate();
  await scenario("退出处理中：退出 / 切换 / 重新登录 / 删除入口全部禁用，新卡片首帧也是禁用，绕过禁用点击也不执行", { xp: 0, verify: okVerify, ...cloudWithRow(), logout: async (r) => { await g.p; return json(r, 204); } }, async (d) => {
    await loggedInAccountCard(d); await showNeedLogin(d);
    check("处理前：四个入口都可点（含“重新登录”）", (await lockedState(d)).join() === "可点,可点,可点,可点", (await lockedState(d)).join());
    await d.page.locator("[data-logout]").tap();
    await d.page.waitForFunction(() => document.querySelector("[data-logout]")?.disabled === true);
    check("退出处理中：四个入口都禁用", (await lockedState(d)).join() === "禁用,禁用,禁用,禁用", (await lockedState(d)).join());
    await d.page.locator("[data-delete-account]").evaluate((el) => { el.disabled = false; el.click(); });
    await d.page.locator("[data-relogin]").evaluate((el) => { el.disabled = false; el.click(); });
    await d.page.waitForTimeout(300);
    check("绕过禁用点“删除账号”“重新登录”：不弹删除确认、不打开登录弹窗（处理函数兜底），没有任何额外请求", (await d.page.locator(".lsheet").count()) === 0 && (await d.page.locator("[data-login]").count()) === 0 && d.hits.logout === 1, JSON.stringify([d.hits, await d.page.locator(".lsheet").count()]));
    await reopenAccount(d); // 处理中重新渲染出的新卡片（先把上面手动放开的按钮状态丢掉）
    check("处理中重新渲染（离开再回到账号页）：新卡片首帧就是禁用的", (await lockedState(d)).join() === "禁用,禁用,禁用,无" || (await lockedState(d)).join() === "禁用,禁用,禁用,禁用", (await lockedState(d)).join());
    g.go(); await d.page.waitForFunction(() => !window.__app.sync.account(), null, { timeout: 15000 });
    check("放行后退出成功：没有账号，没有额外撤销请求", d.hits.logout === 1);
  });
})();
await scenario("退出失败后：入口全部恢复；重新渲染状态一致；确认弹窗里的强制退出连点也只执行一次", { xp: 0, verify: okVerify, ...cloudWithRow(), logout: (r) => json(r, 503, { msg: CAN }) }, async (d) => {
  await loggedInAccountCard(d); await showNeedLogin(d);
  await d.page.locator("[data-logout]").tap();
  await d.page.getByText("云端退出失败").waitFor({ timeout: 15000 });
  check("撤销失败、弹出确认：四个入口都恢复可点", (await lockedState(d)).join() === "可点,可点,可点,可点", (await lockedState(d)).join());
  await d.page.keyboard.press("Escape"); await d.page.waitForTimeout(300); // 先关掉失败弹窗
  await reopenAccount(d);
  check("失败后重新渲染：新卡片同样是可点（锁已放，状态一致）", (await lockedState(d)).join() === "可点,可点,可点,可点", (await lockedState(d)).join());
  await d.page.locator("[data-logout]").tap(); await d.page.getByText("云端退出失败").waitFor({ timeout: 15000 }); // 弹窗再出现
  await d.page.evaluate(() => { window.__toasts.length = 0; });
  const btn = d.page.getByRole("button", { name: "只在这台设备退出" });
  await btn.evaluate((el) => { el.click(); el.click(); }); // 确认按钮连点 / 重复触发
  await d.page.waitForFunction(() => !window.__app.sync.account(), null, { timeout: 15000 }); await d.page.waitForTimeout(400);
  const toasts = await d.page.evaluate(() => window.__toasts);
  check("确认“只在这台设备退出”（连点两次）：只退出一次——已退出提示和回调各 1 次，没有账号，没有再联网撤销（撤销请求仍是 2 次：两次普通退出各一）", toasts.length === 1 && /已在这台设备退出/.test(toasts[0]) && d.hits.logout === 2, JSON.stringify([toasts, d.hits.logout]));
});
// GPT1 队列第 2 项：删除账号请求在途时本机已退出 / 重新登录，迟到的响应只报告云端结果，不清新会话的本机数据，也不走“已删除并退出”的回调
const loginAgain = async (d) => { // 退出后在“我的 → 账号”里重新走一遍邮箱登录（游客记录若还会问就选“用全新账号”）
  await d.page.locator("[data-me-back]").tap(); await d.page.locator('[data-me-menu="account"]').tap();
  await d.page.locator("[data-open-login]").tap(); await d.page.locator("[data-email]").fill("t@example.com"); await sendTap(d);
  await d.page.locator("[data-code]").waitFor(); await d.page.locator("[data-code]").fill("123456"); await d.page.locator("[data-verify]").tap();
  await d.page.waitForFunction(() => !!document.querySelector('[data-choice="cloud"]') || (!document.querySelector("[data-login]") && !!window.__app.sync.account()), null, { timeout: 15000 });
  if (await d.page.locator('[data-choice="cloud"]').count()) await d.page.locator('[data-choice="cloud"]').tap(); // 游客记录第一次登录时已处理过，通常不会再问
  await d.page.waitForFunction(() => !document.querySelector("[data-login]") && !!window.__app.sync.account(), null, { timeout: 15000 });
};
// 迟到结果三种：成功 / 云端明确报错 / 响应丢了（连接被掐断，服务端可能已提交 → 结果未知）
for (const outcome of ["ok", "fail", "lost"]) await (async () => {
  const lateFails = outcome === "fail", lost = outcome === "lost", label = lost ? "丢失（结果未知）" : lateFails ? "失败" : "成功";
  const g = gate();
  await scenario(`删除账号请求在途时本机退出并重新登录，删除响应迟到${label}：只提示云端结果，不清新会话，不走“已删除”回调`, { xp: 0, verify: okVerify, ...cloudWithRow(), del: async (r) => { await g.p; if (lost) return r.abort("connectionreset"); return lateFails ? json(r, 503, { msg: CAN }) : json(r, 200, null); } }, async (d) => {
    await loggedInAccountCard(d);
    await d.page.locator("[data-delete-account]").tap();
    await d.page.getByRole("button", { name: "永久删除" }).tap();
    await d.page.waitForFunction(() => true); await d.page.waitForTimeout(300);
    check("删除请求已发出并挂起（删除接口 1 次）", d.hits.del === 1, JSON.stringify(d.hits));
    await d.page.evaluate(() => window.__app.sync.forceLocalLogout());       // 删除还没返回：本机先强制退出
    await loginAgain(d);                                                      // 再登录（同一个账号）
    await d.page.evaluate(() => { window.__toasts.length = 0; }); // 间谍已在 loggedInAccountCard 里装好，这里只清空，别重复包一层
    const before = await dump(d.page);
    await d.page.evaluate(() => { document.querySelector("[data-account]").dataset.mark = "kept"; }); // 标记当前账号卡：若迟到结果触发了“已退出”回调（重新渲染），标记会丢
    g.go(); await d.page.waitForTimeout(800);
    const toasts = await d.page.evaluate(() => window.__toasts);
    check(`迟到的删除响应（${label}）：只出现一条说明云端结果的提示，没有“账号已删除。”回调提示${lost ? "，且是“无法确认”而不是“删除没有完成”" : ""}`, toasts.length === 1 && (lost ? /无法确认旧账号是否已删除/.test(toasts[0]) && !/没有完成/.test(toasts[0]) : lateFails ? /删除没有完成/.test(toasts[0]) : /账号已在云端删除/.test(toasts[0])) && !toasts.includes("账号已删除。"), JSON.stringify(toasts));
    check("迟到的删除结果没有触发“已退出”回调：当前账号卡没有被重新渲染（标记还在）", await d.page.evaluate(() => document.querySelector("[data-account]")?.dataset.mark === "kept"));
    check("新会话原样保留：仍是登录状态，本机存储逐字节不变（凭证 / 账号副本 / 账号指针都在），删除接口仍只有 1 次", (await d.page.evaluate(() => !!window.__app.sync.account())) && (await dump(d.page)) === before && d.hits.del === 1);
  });
})();
await scenario("被取代的旧退出返回（stale）：界面什么都不做——没有“已退出”提示、不切走账号、按钮恢复", { nav: "none" }, async (d) => {
  await patchedAccount(d, { status: "synced", xp: 120 });
  await logToasts(d.page); await d.page.evaluate(() => { window.__app.sync.logout = async () => ({ ok: false, kind: "stale", stale: true, superseded: true, retryable: false, message: "" }); });
  await d.page.locator("[data-switch]").tap(); await d.page.waitForTimeout(400);
  const toasts = await d.page.evaluate(() => window.__toasts);
  check("旧退出被取代（stale）：没有任何提示、没有打开登录弹窗、账号卡还在，两个按钮可点", toasts.length === 0 && (await d.page.locator("[data-login]").count()) === 0 && (await d.page.locator("[data-account] [data-logout]").count()) === 1 && !(await d.page.locator("[data-logout]").isDisabled()) && !(await d.page.locator("[data-switch]").isDisabled()), JSON.stringify(toasts));
});
await scenario("退出失败后按钮恢复：失败提示出现，两个按钮重新可点，再点会重新发起一次撤销", { xp: 0, verify: okVerify, ...cloudWithRow(), logout: (r) => json(r, 503, { msg: CAN }) }, async (d) => {
  await loggedInAccountCard(d);
  await d.page.locator("[data-logout]").tap();
  await d.page.getByText("云端退出失败").waitFor({ timeout: 15000 });
  check("撤销失败：弹出“云端退出失败”，仍是登录状态，两个按钮恢复可点", (await d.page.evaluate(() => !!window.__app.sync.account())) && !(await d.page.locator("[data-logout]").isDisabled()) && !(await d.page.locator("[data-switch]").isDisabled()) && d.hits.logout === 1, JSON.stringify(d.hits));
  await d.page.keyboard.press("Escape"); await d.page.waitForTimeout(300);
  await d.page.locator("[data-logout]").tap(); await d.page.getByText("云端退出失败").waitFor({ timeout: 15000 });
  check("再点一次：重新发起撤销（共 2 次），不会被上一次的“处理中”卡住", d.hits.logout === 2, JSON.stringify(d.hits));
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
  check("Y9a：「立即同步」禁用（避免反复撞冲突），「导出进度文件」可点", (await d.page.locator("[data-sync-now]").isDisabled()));
  await d.page.locator("[data-me-back]").tap(); await d.page.locator('[data-me-menu="data"]').tap();
  check("Y9a：「导出进度文件」可点", (await d.page.locator("[data-export]").isVisible()) && !(await d.page.locator("[data-export]").isDisabled()));
  const dl = d.page.waitForEvent("download", { timeout: 5000 }).catch(() => null);
  await d.page.locator("[data-export]").tap();
  const file = await dl;
  check("Y9a：点「导出进度文件」真的能下载到文件", !!file);
  await d.page.locator("[data-me-back]").tap(); await d.page.locator('[data-me-menu="account"]').tap();
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
await scenario("换邮箱：发码限流按本页实际门禁，换邮箱 / 改回都不会解锁，也不会重新计满（G-LOGIN-06；原来按邮箱记账）", { otp: (r) => json(r, 429, { code: 429, error_code: "over_email_send_rate_limit", msg: CAN + " For security purposes, you can only request this after 40 seconds." }, RAX(90)) }, async (d) => {
  await sendTap(d);
  await waitMsg(d, /这个邮箱请求验证码太频繁/);
  check("旧邮箱：发送按钮被冷却锁住，倒计时约 90 秒", (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(await T(d.page, "[data-send-code]")) > 80, await T(d.page, "[data-send-code]"));
  await d.page.waitForTimeout(2200);
  await d.page.locator("[data-email]").fill("other@example.com");
  const bn = await T(d.page, "[data-send-code]");
  check("改成新邮箱：仍被同一个门禁锁住（不能绕过），倒计时没有重新计满（已走过约 2 秒，不超过 88 秒）", (await d.page.locator("[data-send-code]").isDisabled()) && secondsIn(bn) > 70 && secondsIn(bn) <= 88, bn);
  await d.page.locator("[data-email]").fill("T@Example.com ");
  check("改回旧邮箱：同一个门禁，同样锁住", await d.page.locator("[data-send-code]").isDisabled());
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
