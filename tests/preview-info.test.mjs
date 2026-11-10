// 测试入口信息面板 + 构建期云项目校验的“真实构建”测试：
//  A. 配置错误的构建必须失败（正式项目 / secret 密钥 / 项目编号不符 / 没有源码提交号）；正确的构建日志打印云端模式和源码提交号，且日志里没有密钥；
//  B. 浏览器里打开该构建：“我的”页的测试入口信息显示的 SHA、云项目与构建时给的一致；登录后云端请求只发往这个项目、绝不出现正式域名；
//     只显示信息，面板里没有任何按钮；本地存储键全部带测试入口前缀；
//  C. 正式构建（没有 PREVIEW_ID）里没有这个面板。
// 不连接真实 Supabase（云端用假服务器接管请求）。运行：MOBILE_BROWSER=chromium|webkit node tests/preview-info.test.mjs
import { spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join, resolve, sep } from "node:path";
import { chromium, webkit } from "playwright";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const BROWSER = process.env.MOBILE_BROWSER || "chromium";
const REF = "abcdefghij0123456789", HOST = `${REF}.supabase.co`, FAKE = `https://${HOST}`;
const PROD_REF = "aqlcunkmggzzvyavlkjg";
const SHA = "0123456789abcdef0123456789abcdef01234567";
const KEY = "sb_publishable_FAKEFAKEFAKE0123456789";
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${BROWSER}] ${name}${!ok && detail ? "  — " + detail : ""}`); };
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".svg": "image/svg+xml" };
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

function build(outDir, extraEnv = {}) {
  const env = { ...process.env, ...extraEnv };
  for (const k of ["PREVIEW_ID", "TEST_SUPABASE_URL", "TEST_SUPABASE_ANON_KEY", "REQUIRE_TEST_CLOUD", "EXPECTED_TEST_PROJECT_REF", "SOURCE_SHA", "GITHUB_SHA"]) if (!(k in extraEnv)) delete env[k];
  return spawnSync("npm", ["run", "build", "--", "--outDir", outDir, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8", timeout: 300000 });
}
const GOOD = { PREVIEW_ID: "acc", TEST_SUPABASE_URL: FAKE, TEST_SUPABASE_ANON_KEY: KEY, REQUIRE_TEST_CLOUD: "1", EXPECTED_TEST_PROJECT_REF: REF, SOURCE_SHA: SHA };
const tmp = mkdtempSync(join(tmpdir(), "sp-preview-info-"));
const out = (n) => join(tmp, n);
const log = (r) => (r.stdout || "") + (r.stderr || "");

function serveDir(dir) {
  const base = resolve(dir);
  const srv = createServer((req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (p.endsWith("/")) p += "index.html";
      const f = resolve(join(base, p));
      if (!f.startsWith(base + sep) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end("not found"); return; }
      res.writeHead(200, { "content-type": MIME[extname(f)] || "application/octet-stream", "cache-control": "no-store" });
      res.end(readFileSync(f));
    } catch { res.writeHead(500); res.end("error"); }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok({ srv, origin: `http://127.0.0.1:${srv.address().port}/` })));
}

// ---------- 假 Supabase（HTTP 层）----------
const S = { users: new Map(), rows: new Map(), tokens: new Map(), n: 0 };
const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: body === undefined ? "" : JSON.stringify(body) });
async function fakeSupabase(ctx) {
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request(), u = new URL(req.url());
    if (ctx.__off) return route.abort("internetdisconnected"); // Chromium 的 setOffline 拦不住 route 接管的请求，这里自己断
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    const body = req.postData() ? JSON.parse(req.postData()) : {};
    const uid = S.tokens.get((req.headers().authorization || "").replace("Bearer ", ""));
    const issue = (id, email) => { const at = "at-" + ++S.n, rt = "rt-" + S.n; S.tokens.set(at, id); S.tokens.set(rt, id); return { access_token: at, refresh_token: rt, expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id, email } }; };
    if (u.pathname === "/auth/v1/otp") return json(route, 200, {});
    if (u.pathname === "/auth/v1/verify") { if (body.token !== "123456") return json(route, 403, { msg: "Token has expired or is invalid" }); if (!S.users.has(body.email)) S.users.set(body.email, "u" + S.users.size + "xxxxxxxx"); return json(route, 200, issue(S.users.get(body.email), body.email)); }
    if (u.pathname === "/auth/v1/token") { const id = S.tokens.get(body.refresh_token); return id ? json(route, 200, issue(id, [...S.users].find(([, v]) => v === id)?.[0] || "")) : json(route, 400, { msg: "invalid refresh token" }); }
    if (u.pathname === "/auth/v1/logout") return json(route, 204);
    if (!uid) return json(route, 401, { message: "JWT expired" });
    if (u.pathname === "/rest/v1/progress") return json(route, 200, S.rows.has(uid) ? [S.rows.get(uid)] : []);
    if (u.pathname === "/rest/v1/rpc/create_progress") { if (S.rows.has(uid)) return json(route, 200, null); S.rows.set(uid, { doc: body.new_doc, rev: 1 }); return json(route, 200, 1); }
    if (u.pathname === "/rest/v1/rpc/save_progress") { const r = S.rows.get(uid); if (!r || r.rev !== body.expected_rev) return json(route, 200, null); r.doc = body.new_doc; r.rev++; return json(route, 200, r.rev); }
    if (u.pathname === "/rest/v1/rpc/delete_my_account") { S.rows.delete(uid); return json(route, 200, null); }
    return json(route, 404, { message: "no route" });
  });
}
const xpIn = (email) => Object.values(S.rows.get(S.users.get(email))?.doc.xp ?? {}).reduce((a, b) => a + b, 0);


let browser;
const allFiles = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? allFiles(join(d, e.name)) : [join(d, e.name)]));
try {
  // ---------- A. 构建期校验 ----------
  const bad = [
    ["指向正式项目", { TEST_SUPABASE_URL: `https://${PROD_REF}.supabase.co` }, /正式/],
    ["secret 密钥", { TEST_SUPABASE_ANON_KEY: "sb_secret_AAAAAAAAAAAA" }, /secret|service_role/],
    ["项目编号不是期望的测试项目", { EXPECTED_TEST_PROJECT_REF: "zzzzzzzzzzzzzzzzzzzz" }, /不是期望的测试项目/],
    ["严格模式没有 40 位源码提交号", { SOURCE_SHA: "", GIT_DIR: "/nonexistent-git-dir" }, /40 位源码提交号/],
    ["严格模式没给云配置", { TEST_SUPABASE_URL: "", TEST_SUPABASE_ANON_KEY: "" }, /要求连接测试云项目/],
  ];
  for (const [name, patch, re] of bad) {
    const r = build(out("bad"), { ...GOOD, ...patch });
    check(`A 构建失败：${name}`, r.status !== 0 && re.test(log(r)), `退出码 ${r.status}`);
    check(`A 失败时不留下可部署的产物：${name}`, !existsSync(join(out("bad"), "index.html")));
  }
  const g = build(out("good"), GOOD);
  if (g.status !== 0) { console.log("环境失败：正确配置的构建失败\n" + log(g).slice(-1500)); process.exit(2); }
  check("A 正确配置能构建，日志打印云端模式和完整源码提交号", log(g).includes(`云端：测试云项目 ${REF}`) && log(g).includes(`源码提交：${SHA}`), log(g).split("\n").filter((l) => l.includes("[构建]")).join(" | "));
  check("A 构建日志里没有密钥", !log(g).includes("FAKEFAKEFAKE"));
  const files = allFiles(out("good"));
  const main = files.filter((f) => /assets[\\/]main-.*\.js$/.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");
  check("A 产物里写入了源码提交号和测试云主机名", main.includes(SHA) && main.includes(HOST));
  check("A 产物里没有任何 secret / service_role 字样的密钥", !/sb_secret_[A-Za-z0-9]/.test(main) && !/service_role/.test(main));
  const prodBuild = build(out("prod"), {});
  if (prodBuild.status !== 0) { console.log("环境失败：正式构建失败"); process.exit(2); }
  check("A 正式构建日志不读测试云变量", log(prodBuild).includes("正式构建") && !log(prodBuild).includes("测试云项目"));

  // ---------- B / C. 浏览器 ----------
  try { browser = await (BROWSER === "webkit" ? webkit : chromium).launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); process.exit(2); }

  async function open(dir, { fake = true, onboarded = true } = {}) {
    const { srv, origin } = await serveDir(dir);
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
    const reqHosts = [];
    ctx.on("request", (r) => { try { const u = new URL(r.url()); if (u.origin + "/" !== origin) reqHosts.push(u.hostname); } catch {} });
    if (fake) await fakeSupabase(ctx);
    const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message || e)));
    await page.goto(origin, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
    if (onboarded) await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; window.__app.persist(); window.__app.renderPath(); });
    return { srv, ctx, page, errors, reqHosts };
  }
  const toMe = async (page) => { await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-account]"); };

  {
    const t = await open(out("good"));
    await toMe(t.page);
    const panel = t.page.locator("[data-preview-info]");
    check("B 测试入口信息面板存在", (await panel.count()) === 1);
    let txt = await panel.innerText();
    check("B 面板显示完整源码提交号（与构建时一致）", txt.includes(`源码提交：${SHA}`), txt);
    check("B 面板显示测试云项目地址和项目编号", txt.includes(HOST) && txt.includes(REF), txt);
    check("B 面板显示测试入口名；未登录时同步状态是游客", txt.includes("测试入口：acc") && /没有登录/.test(txt), txt);
    check("B 面板上没有任何按钮（不能清数据）", (await t.page.locator("[data-preview-info] button, [data-preview-info] a").count()) === 0 && (await panel.evaluate((el) => el.parentElement.querySelectorAll("button").length)) === 0);
    check("B 面板节点上带 data-sha / data-cloud-host，方便自动核对", (await panel.getAttribute("data-sha")) === SHA && (await panel.getAttribute("data-cloud-host")) === HOST);
    // 登录 → 同步 → 面板更新
    await t.page.locator("[data-open-login]").tap();
    await t.page.locator("[data-email]").fill("info@example.com");
    await t.page.locator("[data-send-code]").tap();
    await t.page.locator("[data-code]").waitFor();
    await t.page.locator("[data-code]").fill("123456");
    await t.page.locator("[data-verify]").tap();
    await t.page.waitForSelector("[data-sync-status]");
    await t.page.waitForFunction(() => /已同步/.test(document.querySelector("[data-preview-info]")?.textContent || ""), null, { timeout: 15000 });
    txt = await t.page.locator("[data-preview-info]").innerText();
    check("B 登录同步后面板显示“已同步 ✓”、最近确认同步的时间、账号", /已同步 ✓/.test(txt) && /最近确认同步：\d{2}:\d{2}:\d{2}/.test(txt) && /info@example.com/.test(txt), txt);
    check("B 所有云端请求只发往测试项目，没有正式域名", t.reqHosts.length > 0 && t.reqHosts.every((h) => h === HOST) && !t.reqHosts.some((h) => h.includes(PROD_REF)), JSON.stringify([...new Set(t.reqHosts)]));
    // 测试入口把 window.localStorage 换成了带前缀的包装，所以真实键要从同源的新 iframe 里读（拿到的是没被包装的真 localStorage）
    const keys = await t.page.evaluate(() => { const f = document.createElement("iframe"); document.body.append(f); const ls = f.contentWindow.localStorage; const out = []; for (let i = 0; i < ls.length; i++) out.push(ls.key(i)); f.remove(); return out; });
    check("B 本地存储键全部带测试入口前缀 acc:", keys.length > 0 && keys.every((k) => k.startsWith("acc:")), JSON.stringify(keys.filter((k) => !k.startsWith("acc:"))));
    check("B 没有页面脚本错误", t.errors.length === 0, JSON.stringify(t.errors));
    await t.ctx.close(); t.srv.close();
  }
  // ---------- D. 三个小问题的回归 ----------
  //  ① 游客做完的关卡合并进账号后，云端记录里有完成日期（不是空）；
  //  ② 在开场介绍最后一屏点“已有账号？登录”，登录再退出后，不再重放“你好，我是小码！”（刷新后也一样）；
  //  ③ 退出登录后，测试入口信息的“最近确认同步”不再显示上一个账号的时间。
  {
    const today = () => { const d = new Date(), p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`; };
    const answerAll = async (page) => {
      let n = 0;
      while (await page.locator("[data-check]").count()) {
        const ex = await page.evaluate(() => window.__app.currentEx);
        if (ex.type === "predict") await page.locator(".choice").nth(ex.options.findIndex((o) => o.correct)).evaluate((b) => b.click());
        else if (ex.type === "fill") for (let k = 0; k < ex.answer.length; k++) {
          await page.locator(`[data-slot="${k}"]`).evaluate((b) => b.click());
          await page.evaluate((t) => [...document.querySelectorAll("[data-token]")].find((b) => b.dataset.token === t).click(), ex.answer[k]);
        } else for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).first().evaluate((b) => b.click());
        await page.locator("[data-check]").evaluate((b) => b.click());
        await page.locator("[data-continue]:not([disabled])").waitFor();
        await page.locator("[data-continue]").evaluate((b) => b.click());
        await page.waitForSelector("[data-check], .finish");
        if (++n > 12) break;
      }
      await page.waitForSelector(".finish");
    };
    const loginCode = async (page, email) => {
      await page.locator("[data-email]").fill(email);
      await page.locator("[data-send-code]").tap();
      await page.locator("[data-code]").fill("123456");
      await page.locator("[data-verify]").tap();
    };

    // ① 游客真的做完 U1L1 → 登录并选“安全合并” → 云端 done.U1L1 是今天的日期
    {
      const t = await open(out("good"));
      await t.page.evaluate(() => window.__app.startLesson(window.__app.allLessons()[0]));
      await t.page.waitForSelector("[data-check]");
      await answerAll(t.page);
      const guest = await t.page.evaluate(() => { const s = window.__app.getState(); return { done: !!s.done.U1L1, on: s.doneOn?.U1L1 }; });
      check("D① 游客做完 U1L1，本机记下了完成日期（今天）", guest.done && guest.on === today(), JSON.stringify(guest));
      await t.page.reload({ waitUntil: "domcontentloaded" }); await t.page.waitForFunction(() => window.__app && window.__app.getState);
      check("D① 刷新后完成日期还在", (await t.page.evaluate(() => window.__app.getState().doneOn?.U1L1)) === today());
      await toMe(t.page);
      await t.page.locator("[data-open-login]").tap();
      await loginCode(t.page, "dates@example.com");
      await t.page.locator('[data-choice="transfer"]').waitFor({ timeout: 15000 });
      await t.page.locator('[data-choice="transfer"]').tap();
      await t.page.waitForFunction(() => /已同步/.test(document.querySelector("[data-preview-info]")?.textContent || ""), null, { timeout: 15000 });
      const row = S.rows.get(S.users.get("dates@example.com"));
      check("D① 合并进云端后，U1L1 有完成日期（不是空）", row?.doc.done?.U1L1 === today(), JSON.stringify(row?.doc.done));
      check("D① 没有页面脚本错误", t.errors.length === 0, JSON.stringify(t.errors));
      await t.ctx.close(); t.srv.close();
    }

    // ②③ 在开场介绍最后一屏登录 → 退出 → 不重放开场介绍；刷新后也不重放；“最近确认同步”清掉
    {
      const t = await open(out("good"), { onboarded: false });
      await t.page.waitForSelector(".onboard");
      check("D② 全新设备先看到开场介绍", /你好，我是小码/.test(await t.page.locator(".onboard").innerText()));
      await t.page.getByRole("button", { name: "继续" }).tap(); await t.page.getByRole("button", { name: "继续" }).tap();
      await t.page.locator("[data-onboard-login]").tap();
      await loginCode(t.page, "onboard@example.com");
      await t.page.waitForFunction(() => window.__app.sync.account()?.email === "onboard@example.com", null, { timeout: 15000 });
      await toMe(t.page);
      await t.page.waitForFunction(() => /最近确认同步：\d{2}:\d{2}:\d{2}/.test(document.querySelector("[data-preview-info]")?.textContent || ""), null, { timeout: 15000 });
      await t.page.locator("[data-logout]").tap();
      await t.page.locator("[data-open-login]").waitFor();
      const after = await t.page.locator("[data-preview-info]").innerText();
      check("D③ 退出后，“最近确认同步”不再显示上一个账号的时间", /最近确认同步：—/.test(after) && !/最近确认同步：\d{2}:/.test(after), after);
      check("D② 退出后没有回到开场介绍", (await t.page.locator(".onboard").count()) === 0 && (await t.page.evaluate(() => window.__app.getState().onboarded)) === true);
      await t.page.reload({ waitUntil: "domcontentloaded" }); await t.page.waitForFunction(() => window.__app && window.__app.getState);
      await t.page.waitForSelector(".statsbar, .onboard");
      check("D② 退出后刷新，直接进地图，不重放“你好，我是小码！”", (await t.page.locator(".onboard").count()) === 0 && (await t.page.locator(".statsbar").count()) === 1);
      await toMe(t.page);
      check("D③ 刷新后“最近确认同步”仍是“—”", /最近确认同步：—/.test(await t.page.locator("[data-preview-info]").innerText()));
      check("D 没有页面脚本错误", t.errors.length === 0, JSON.stringify(t.errors));
      await t.ctx.close(); t.srv.close();
    }
  }
  {
    const t = await open(out("prod"), { fake: false });
    await toMe(t.page);
    check("C 正式构建的“我的”页没有测试入口信息面板", (await t.page.locator("[data-preview-info]").count()) === 0);
    check("C 正式构建没有 SHA 面板文字", !(await t.page.locator("body").innerText()).includes("测试入口信息"));
    await t.ctx.close(); t.srv.close();
  }
} catch (e) {
  check("测试入口信息测试异常", false, String(e.stack || e).split("\n").slice(0, 4).join(" | "));
} finally {
  try { await browser?.close(); } catch {}
  rmSync(tmp, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
