// GPT1-003（本机写回失败重试上限）的真实浏览器双标签页测试：同一浏览器上下文里两个真实页面，
// 用真实 navigator.locks 和真实 localStorage 抢同一个账号的写回重试上限。云端与定时器是假的（不联网）。
// Node 里的模拟锁无法证明浏览器行为，所以这里单独验证：
//   1. 互斥：A 在临界区内时，B 的自动同步拿不到锁，不读云端；A 放行后 B 才进入；
//   2. 上限跨标签页共享：A/B 交替自动同步，云端读取总数 = 3，第 4 次起任何标签页都不再读云端；
//   3. 网络重连（online）、页面重新可见（visibilitychange）两个自动触发源绕不过上限；
//   4. 另一个标签页手动同步成功会把计数清零，本标签页的自动同步随之恢复；
//   5. 没有 Web Locks 的浏览器：自动同步安全停机（云端 0 次），手动仍可用。
// 运行：MOBILE_BROWSER=chromium|webkit node tests/sync-two-tabs-browser.test.mjs   （不设默认 chromium；起不来按「环境失败」退出 2）
import { createServer } from "vite";
import { chromium, webkit } from "playwright";

const PORT = 5197, URL_ = `http://localhost:${PORT}/tests/sync-two-tabs-browser.html`;
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const engine = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;

const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { port: PORT, strictPort: true } });
await server.listen();
let browser;
try { browser = await engine.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); await server.close(); process.exit(2); }

async function openTab(ctx, { seed = false } = {}) {
  const page = await ctx.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto(URL_); await page.waitForFunction(() => window.pageReady);
  if (seed) await page.evaluate(() => H.seed());
  const restored = await page.evaluate(() => H.boot());
  page.errs = errs; page.restored = restored;
  return page;
}
const cloudGets = (...pages) => Promise.all(pages.map((p) => p.evaluate(() => window.calls.get))).then((a) => a.reduce((x, y) => x + y, 0));
const retryKey = (page) => page.evaluate(() => localStorage.getItem(H.RETRY_KEY));
const pendingSettled = (page, p) => page.evaluate((x) => x, p);

let failed = false;
try {
  const probe = await (await browser.newContext()).newPage();
  await probe.goto(URL_); await probe.waitForFunction(() => window.pageReady);
  const hasLocks = await probe.evaluate(() => !!navigator.locks && typeof navigator.locks.request === "function");
  await probe.context().close();
  console.log(`# 内核：${process.env.MOBILE_BROWSER || "chromium"}；Web Locks：${hasLocks ? "有" : "没有"}`);

  if (hasLocks) {
    // ---- 1. 互斥 ----
    {
      const ctx = await browser.newContext();
      const A = await openTab(ctx, { seed: true }); const B = await openTab(ctx);
      check("两个标签页都恢复了同一个账号", A.restored && B.restored);
      await A.evaluate(() => { window.hold(); window.__resA = null; window.sync.syncNow().then((r) => { window.__resA = r; }); });
      await A.waitForFunction(() => window.calls.get === 1);
      await B.evaluate(() => { window.__resB = null; window.sync.syncNow().then((r) => { window.__resB = r; }); });
      await sleep(500);
      const state = await A.evaluate(async () => { const q = await navigator.locks.query(); return { held: q.held.map((l) => l.name), pending: q.pending.map((l) => l.name) }; });
      check("A 在临界区内：浏览器里该账号的写回锁被持有，B 的请求在排队", state.held.some((n) => n.startsWith("suipian:writeback:")) && state.pending.some((n) => n.startsWith("suipian:writeback:")), JSON.stringify(state));
      check("B 拿不到锁：A 持锁期间 B 读云端 0 次，B 的同步没有返回", (await B.evaluate(() => window.calls.get)) === 0 && (await B.evaluate(() => window.__resB)) === null);
      await A.evaluate(() => window.releaseGate());
      await A.waitForFunction(() => window.__resA !== null); await B.waitForFunction(() => window.__resB !== null);
      check("A 放行后 B 才进入临界区（B 读云端 1 次）", (await B.evaluate(() => window.calls.get)) === 1);
      check("全程无页面脚本错误", A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).join(" | "));
      await ctx.close();
    }
    // ---- 2. 上限跨标签页共享 ----
    {
      const ctx = await browser.newContext();
      const A = await openTab(ctx, { seed: true }); const B = await openTab(ctx);
      for (const p of [A, B]) await p.evaluate(() => { window.faults.writeback = true; });
      const r1 = await A.evaluate(() => window.sync.syncNow());   // 失败 1（A）
      const r2 = await B.evaluate(() => window.sync.syncNow());   // 失败 2（B，读到 A 写的计数 1）
      check("A、B 交替失败：存储里的计数依次是 1、2", r1.localWritebackFailed === true && r2.localWritebackFailed === true && (await retryKey(A)) === "2", `${r1.kind}/${r2.kind}/${await retryKey(A)}`);
      const r3 = await A.evaluate(() => window.sync.syncNow());   // 失败 3（A）→ 上限
      check("第 3 次失败达到上限，计数 = 3", r3.retryLimitReached === true && (await retryKey(B)) === "3", JSON.stringify(r3));
      const before = await cloudGets(A, B);
      const r4 = await B.evaluate(() => window.sync.syncNow());   // B 第 4 次：被上限拦截
      const r5 = await A.evaluate(() => window.sync.syncNow());
      check("上限之后 A、B 的自动同步都被拦截，云端读取总数停在 3", r4.retryLimitReached === true && r5.retryLimitReached === true && before === 3 && (await cloudGets(A, B)) === 3, `before=${before} after=${await cloudGets(A, B)}`);
      // ---- 3. 自动触发源绕不过上限 ----
      for (const p of [A, B]) await p.evaluate(() => { dispatchEvent(new Event("online")); document.dispatchEvent(new Event("visibilitychange")); });
      await sleep(400);
      check("网络重连（online）与页面重新可见（visibilitychange）都不能绕过上限：云端读取仍是 3", (await cloudGets(A, B)) === 3, String(await cloudGets(A, B)));
      // 到上限之后，用户继续学习（写入本机副本）不能再安排自动同步定时器：否则每次学习都会重新唤醒云端轮询
      await A.evaluate(() => { window.faults.writeback = false; });
      const timers = await A.evaluate(() => {
        const n0 = window.jobs.length;
        const st = { ...H.freshState(), onboarded: true, xp: 95, lessonsCompleted: 3, done: { U1L1: true }, streak: 1, lastDay: "2026-11-04" };
        const r = window.sync.persistLocal(st);
        return { saved: r.ok === true, added: window.jobs.length - n0 };
      });
      check("到上限后继续学习：本机照常保存，但不再安排自动同步定时器", timers.saved && timers.added === 0, JSON.stringify(timers));
      await A.evaluate(() => { window.faults.writeback = true; });
      // ---- 4. 另一标签页手动同步成功 → 清零 → 本标签页自动恢复 ----
      await B.evaluate(() => { window.faults.writeback = false; });
      const m = await B.evaluate(() => window.sync.syncNow({ manual: true }));
      check("B 手动同步成功，存储里的计数被写回 0", m.ok === true && (await retryKey(A)) === "0", JSON.stringify(m));
      await A.evaluate(() => { window.faults.writeback = false; });
      const a2 = await A.evaluate(() => window.sync.syncNow());
      check("A 的自动同步随之恢复（读云端、成功）", a2.ok === true && (await cloudGets(A, B)) >= 5, JSON.stringify(a2));
      check("全程无页面脚本错误", A.errs.length === 0 && B.errs.length === 0, A.errs.concat(B.errs).join(" | "));
      await ctx.close();
    }
  } else {
    console.log("# 该内核没有 Web Locks：不跑互斥用例，只验证 v4 设计的安全停机分支");
  }
  // ---- 5. 没有 Web Locks（真实删除 navigator.locks）：自动同步安全停机，手动仍可用 ----
  {
    const ctx = await browser.newContext();
    await ctx.addInitScript(() => { try { Object.defineProperty(navigator, "locks", { value: undefined, configurable: true }); } catch {} });
    const A = await openTab(ctx, { seed: true });
    const none = await A.evaluate(() => navigator.locks === undefined);
    check("前置：这个页面里确实没有 navigator.locks", none);
    const auto = await A.evaluate(() => window.sync.syncNow());
    check("没有 Web Locks：自动同步被拦截（retryLimitReached），云端读取 0 次", auto.ok === false && auto.retryLimitReached === true && (await cloudGets(A)) === 0, JSON.stringify(auto));
    await A.evaluate(() => { dispatchEvent(new Event("online")); }); await sleep(300);
    check("没有 Web Locks：online 事件也不会触发云端读取", (await cloudGets(A)) === 0);
    const manual = await A.evaluate(() => window.sync.syncNow({ manual: true }));
    check("没有 Web Locks：手动同步仍可用（读云端 1 次、成功）", manual.ok === true && (await cloudGets(A)) === 1, JSON.stringify(manual));
    check("无页面脚本错误", A.errs.length === 0, A.errs.join(" | "));
    await ctx.close();
  }
} catch (e) {
  failed = true; console.log("❌ 测试异常：" + (e?.stack || e));
} finally {
  await browser.close(); await server.close();
}
const bad = results.filter((r) => !r).length + (failed ? 1 : 0);
console.log(`\n双标签页测试：共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
