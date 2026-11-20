import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { startDistServer } from "./helpers/dist-server.mjs";

const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
if (!existsSync(`${DIST}/index.html`)) {
  console.log("环境失败：没有 dist/，请先 npm run build");
  process.exit(2);
}

const useWebkit = process.argv.includes("--webkit") || process.env.MOBILE_BROWSER === "webkit" || process.env.BROWSER === "webkit";
const browserType = useWebkit ? webkit : chromium;
const UA = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";
const FAKE = "https://fake.supabase.test";
const U1 = "11111111-1111-4111-8111-111111111111";

const srv = await startDistServer();
const browser = await browserType.launch();
const errors = [];

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "GET,POST,OPTIONS" };
const json = (route, status, body) => route.fulfill({ status, headers: { ...CORS, "content-type": "application/json" }, body: body === undefined ? "" : JSON.stringify(body) });

try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: UA, hasTouch: true, isMobile: true, serviceWorkers: "block" });
  await ctx.route(FAKE + "/**", async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
    if (u.pathname === "/auth/v1/logout") return json(route, 204);
    if (u.pathname === "/rest/v1/progress") return json(route, 200, []);
    if (u.pathname === "/rest/v1/rpc/create_progress") return json(route, 200, 1);
    if (u.pathname === "/rest/v1/rpc/save_progress") return json(route, 200, 2);
    return json(route, 200, {});
  });

  // 种子数据：游客进度 15 XP（suipian.progress）与账号 U1 副本 120 XP（proj:fake.supabase.test:...）
  const guestSeed = {
    version: 3,
    onboarded: true,
    xp: 15,
    hearts: 5,
    heartsAt: Date.now(),
    streak: 1,
    lastDay: "2026-11-20",
    done: {},
    lessonsCompleted: 1,
    installTipClosed: false,
    lastActive: 0,
    prefs: { sound: true, haptics: true, soundStyle: "J", theme: "system" },
  };
  const ns = "proj:fake.supabase.test:";
  const accSeed = {
    doc: {
      schema: 1,
      gen: 1,
      lineage: "lineage-browser-u1",
      xp: { d1: 120 },
      runs: { d1: 3 },
      done: { U1L1: "2026-11-20", U1L2: "2026-11-20", U1L3: "2026-11-20" },
      days: ["2026-11-20"],
      hearts: { n: 5, msToNext: 0 },
      prefs: { sound: true, haptics: true, soundStyle: "J", theme: "system" },
      imported: {},
    },
    base: 1,
    dirty: { hearts: false, prefs: false, content: false },
  };
  const authSeed = {
    session: { userId: U1, email: "u1@example.com", accessToken: "at-u1", refreshToken: "rt-u1", expiresAt: Date.now() + 3600_000 },
    project: "fake.supabase.test",
    instanceId: "inst-browser-u1",
  };

  // 使用 localStorage 幂等标志确保整个同源上下文只初始化一次，第二个标签页绝不再次 localStorage.clear()
  await ctx.addInitScript(([cfg, g, prefix, uid, acc, auth]) => {
    try {
      if (localStorage.getItem("glogin03-seeded") !== "1") {
        localStorage.clear();
        localStorage.setItem("suipian.cloudConfig", JSON.stringify(cfg));
        localStorage.setItem("suipian.progress", JSON.stringify(g));
        localStorage.setItem(prefix + "suipian.acct." + uid, JSON.stringify(acc));
        localStorage.setItem(prefix + "suipian.session", uid);
        localStorage.setItem(prefix + "suipian.auth", JSON.stringify(auth));
        localStorage.setItem("glogin03-seeded", "1");
      }
    } catch {}
  }, [{ url: FAKE, anonKey: "pub-key" }, guestSeed, ns, U1, accSeed, authSeed]);

  const tabA = await ctx.newPage();
  const tabB = await ctx.newPage();
  for (const [label, p] of [["TabA", tabA], ["TabB", tabB]]) {
    p.on("pageerror", (e) => errors.push(`${label} pageerror: ${String(e.message || e)}`));
    // WebKit 的两类已知环境噪音（与本专项验证的登录失权逻辑无关，CI 里 WebKit 首次实跑才暴露）：
    //   1) 不认识 viewport 的 interactive-widget 键；2) 答题时预加载 pyodide 在 WebKit 测试环境里加载失败（访问检查拦截 / py-worker 加载阶段拒绝；本专项不验证 Python 判题）。
    // pageerror（脚本异常）一律不放过，其它 console.error 也不放过。
    const BENIGN = [/^Viewport argument key "interactive-widget" not recognized and ignored\.?$/, /^(Fetch API )?[Cc]annot load http:\/\/localhost:\d+\/pyodide\/\S+ due to access control checks\.?$/, /^\[py-worker\] Pyodide 加载阶段的未处理拒绝：/];
    p.on("console", (m) => { if (m.type() === "error" && !BENIGN.some((re) => re.test(m.text()))) errors.push(`${label} console.error: ${m.text()}`); });
  }

  await tabA.goto(srv.base, { waitUntil: "domcontentloaded" });
  await tabA.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  await tabB.goto(srv.base, { waitUntil: "domcontentloaded" });
  await tabB.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);

  // 验证真实应用已加载账号 U1（120 XP）
  const initCheck = await tabA.evaluate(() => ({
    account: window.__app.sync.account(),
    xp: window.__app.getState().xp,
  }));
  assert.equal(initCheck.account?.userId, U1);
  assert.equal(initCheck.xp, 120);

  // Tab B 走真实导航“我的 -> 账号”并点击退出登录
  await tabB.getByRole("button", { name: "我的" }).tap();
  await tabB.locator('[data-me-menu="account"]').tap();
  await tabB.waitForSelector("[data-account]");
  await tabB.locator("[data-logout]").tap();
  await tabB.locator("[data-open-login]").waitFor();

  // 等待 Tab A 收到 storage 事件后自动切回游客状态（15 XP，account === null）
  await tabA.waitForFunction(() => window.__app.sync.account() === null && window.__app.getState().xp === 15, { timeout: 5000 });

  // 验证 Tab A“我的 -> 账号”已刷新为未登录入口，且游客存储未被 U1 的 120 XP 覆盖
  await tabA.getByRole("button", { name: "我的" }).tap();
  await tabA.locator('[data-me-menu="account"]').tap();
  await tabA.waitForSelector("[data-open-login]");

  const afterLogoutGuest = await tabA.evaluate(() => JSON.parse(localStorage.getItem("suipian.progress")));
  assert.equal(afterLogoutGuest.xp, 15, "U1 120 XP must never overwrite guest progress");

  // 切回“学习”路径，打开第一关弹层 -> 点击“开始 +… XP” -> 点击介绍页“继续” -> 答对第一道真实题目并提交
  await tabA.getByRole("button", { name: "学习", exact: true }).tap();
  const firstNode = tabA.locator(".node").first();
  await firstNode.waitFor({ state: "visible" });
  await firstNode.tap();

  const startLessonBtn = tabA.getByRole("button", { name: /^开始 \+\d+ XP$/ });
  await startLessonBtn.waitFor({ state: "visible" });
  await startLessonBtn.tap();

  const introContinue = tabA.getByRole("button", { name: "继续" });
  await introContinue.waitFor({ state: "visible" });
  await introContinue.tap();

  await tabA.locator(".choice").first().waitFor({ state: "visible", timeout: 5000 });
  const correctIdx = await tabA.evaluate(() => {
    const run = window.__app.getRun();
    if (!run || !Array.isArray(run.exercises) || !Array.isArray(run.queue) || run.queue.length === 0) {
      throw new Error("run queue unavailable");
    }
    const ex = run.exercises[run.queue[0]];
    if (!ex || !Array.isArray(ex.options)) {
      throw new Error(`exercise options missing: ${JSON.stringify(ex)}`);
    }
    const idx = ex.options.findIndex((o) => o && o.correct === true);
    if (idx < 0) {
      throw new Error(`no correct option found in exercise: ${JSON.stringify(ex)}`);
    }
    return idx;
  });

  await tabA.locator(".choice").nth(correctIdx).tap();
  const checkBtn = tabA.locator("[data-check]");
  await checkBtn.waitFor({ state: "visible" });
  await checkBtn.tap();

  // 答对一题后立即核对游客 XP 从 15 -> 25（+10 XP_CORRECT），且持久化到 suipian.progress，未串回 U1
  await tabA.waitForFunction(() => window.__app.getState().xp === 25, { timeout: 5000 });
  const postAnswerState = await tabA.evaluate(() => ({
    account: window.__app.sync.account(),
    xp: window.__app.getState().xp,
    storedGuest: JSON.parse(localStorage.getItem("suipian.progress")),
  }));
  assert.equal(postAnswerState.account, null);
  assert.equal(postAnswerState.xp, 25);
  assert.equal(postAnswerState.storedGuest.xp, 25);

  // 刷新页面后验证仍是游客态、存档保持 25 XP、且没有恢复 U1 的 120 XP
  await tabA.reload({ waitUntil: "domcontentloaded" });
  await tabA.waitForFunction(() => window.__app && window.__app.getState && window.__app.sync);
  const reloadedState = await tabA.evaluate(() => ({
    account: window.__app.sync.account(),
    xp: window.__app.getState().xp,
    storedGuest: JSON.parse(localStorage.getItem("suipian.progress")),
  }));
  assert.equal(reloadedState.account, null);
  assert.equal(reloadedState.xp, 25);
  assert.equal(reloadedState.storedGuest.xp, 25);

  assert.deepEqual(errors, [], `unexpected browser errors: ${errors.join("; ")}`);
} finally {
  await browser.close();
  await srv.close();
}
console.log(`cross-tab-session-loss real-app browser tests passed (${useWebkit ? "webkit" : "chromium"})`);
