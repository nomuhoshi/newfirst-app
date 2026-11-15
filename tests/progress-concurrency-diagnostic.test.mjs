// 并发清除窗口浏览器事件诊断专项（保留 tests/progress-concurrency.test.mjs 原无注入用例零改动）
// 约束：
// 1. 观察器直接使用 tests/lib/ledger-observer.mjs 的唯一命名导出 observeSuipianV4Storage(storage?)；
// 2. 直接读取 ok/status/currentEpoch/xp/runs/done（done 为已排序数组；失败时 ok=false，进度字段为 null），无任何猜结构或补零回退；
// 3. 事件包装仅注入受控轨道（controlled-deferred-delivery），原生轨道（native-unmodified）零注入运行；
// 4. 真实回前台 T3（bringToFront）与人工事件 T4（SYNTHETIC_EVENT）严格分列，不用 T4 成功掩盖 T3 异常；
// 5. 截获、释放、实际处理、队列清空及页面异常均有明确断言；
// 6. T0/T1/T2/T3/T4 各阶段完整核验 xp / runs / done 三元组。
// 运行：npm run build && MOBILE_BROWSER=webkit|chromium node tests/progress-concurrency-diagnostic.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, mkdtempSync, rmSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { observeSuipianV4Storage } from "./lib/ledger-observer.mjs";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PFX = process.env.PREVIEW_PREFIX || "/";
const BNAME = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const engine = BNAME === "webkit" ? webkit : chromium;

if (!existsSync(join(DIST, "index.html"))) {
  console.log(`环境失败：${BNAME} 缺少 dist/index.html，请先运行 npm run build`);
  process.exit(2);
}

let pass = 0;
let fail = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} [${BNAME}] ${name}${ok || !detail ? "" : "  — " + detail}`);
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
};

const srv = createServer((req, res) => {
  const u = new URL(req.url, "http://localhost");
  if (!u.pathname.startsWith(PFX)) {
    res.writeHead(404);
    res.end();
    return;
  }
  let p = join(DIST, decodeURIComponent(u.pathname.slice(PFX.length)));
  if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(p));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://localhost:${srv.address().port}${PFX}`;
const PRIVACY_URL = new URL("privacy.html", BASE).href;

const dirs = [];
const newDir = () => {
  const d = mkdtempSync(join(tmpdir(), "suipian-conc-diag-"));
  dirs.push(d);
  return d;
};
const OPTS = { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: engine === chromium, serviceWorkers: "block" };
const open = (dir) => engine.launchPersistentContext(dir, OPTS);
const load = async (ctx) => {
  const p = await ctx.newPage();
  p.errors = [];
  p.on("pageerror", (e) => p.errors.push(String(e?.message || e)));
  await p.goto(BASE);
  await p.waitForFunction(() => window.__app?.getState);
  return p;
};

// 在同源静态页 privacy.html 中直接序列化执行 observeSuipianV4Storage，原样透传标准返回字段
async function observeStaticStorage(ctx) {
  const obsPage = await ctx.newPage();
  const obsErrors = [];
  obsPage.on("pageerror", (e) => obsErrors.push(String(e?.message || e)));
  try {
    await obsPage.goto(PRIVACY_URL);
    const res = await obsPage.evaluate(observeSuipianV4Storage);
    if (obsErrors.length > 0) {
      return {
        ok: false,
        status: "OBSERVER_PAGE_ERROR",
        xp: null,
        runs: null,
        done: null,
        pageErrors: obsErrors,
      };
    }
    return { ...res, pageErrors: [] };
  } finally {
    await obsPage.close().catch(() => {});
  }
}

const readTabMemory = (page) =>
  page.evaluate(() => {
    const s = window.__app.getState();
    return {
      xp: s.xp,
      runs: s.lessonsCompleted,
      done:
        s.done !== null && typeof s.done === "object" && !Array.isArray(s.done)
          ? Object.keys(s.done).filter((k) => Boolean(s.done[k])).sort()
          : null,
      visibilityState: document.visibilityState,
    };
  });

const matchesStorageTriad = (obs, expected) =>
  obs !== null &&
  typeof obs === "object" &&
  obs.ok === true &&
  obs.status === "OK" &&
  typeof obs.currentEpoch === "string" &&
  obs.currentEpoch.length > 0 &&
  typeof obs.xp === "number" &&
  obs.xp === expected.xp &&
  typeof obs.runs === "number" &&
  obs.runs === expected.runs &&
  Array.isArray(obs.done) &&
  obs.done.length === expected.done.length &&
  obs.done.every((v, i) => v === expected.done[i]);

const matchesMemoryTriad = (mem, expected) =>
  mem !== null &&
  typeof mem === "object" &&
  typeof mem.xp === "number" &&
  mem.xp === expected.xp &&
  typeof mem.runs === "number" &&
  mem.runs === expected.runs &&
  Array.isArray(mem.done) &&
  mem.done.length === expected.done.length &&
  mem.done.every((v, i) => v === expected.done[i]);

async function passOnboarding(page) {
  for (let i = 0; i < 6 && (await page.locator(".onboard").count()); i++) {
    await page.locator(".onboard .btn3d.primary").click();
    await page.waitForTimeout(100);
  }
  await page.waitForSelector(".pathview");
}

async function finishLesson(page, id) {
  await page.locator(`[data-lesson="${id}"]`).scrollIntoViewIfNeeded();
  await page.locator(`[data-lesson="${id}"]`).click();
  await page.locator(".overlay .btn3d.primary").click();
  await page.locator(".lessonfoot .btn3d.primary").click();
  await page.waitForSelector("[data-check]");
  for (let n = 0; n < 20 && !(await page.locator(".finish").count()); n++) {
    const ex = await page.evaluate(() => JSON.parse(JSON.stringify(window.__app.currentEx)));
    if (ex.type === "predict" || ex.type === "pick") {
      await page.locator(".choice").nth(ex.options.findIndex((o) => Boolean(o.correct))).click();
    } else if (ex.type === "fill") {
      for (const t of ex.answer) await page.locator(`.kchip.tok[data-token="${t.replace(/"/g, '\\"')}"]`).click();
    } else {
      for (const k of ex.answers[0]) await page.locator(`.order-bank [data-line="${k}"]`).click();
    }
    await page.locator("[data-check]").click();
    await page.waitForSelector(".feedbar [data-continue]:not([disabled])");
    await page.locator(".feedbar [data-continue]").click();
  }
  await page.waitForSelector(".finish");
  await page.locator(".finish button", { hasText: "继续" }).first().click();
  await page.waitForSelector(".pathview");
}

// 仅用于受控轨道（controlled-deferred-delivery）的跨标签事件截获、队列回放与实际处理计数脚本
function installControlledTrackHooks() {
  window.__deferCrossTabDelivery = false;
  window.__deferredDeliveryQueue = [];
  window.__interceptedNotifications = [];
  window.__appHandledNotifications = [];

  const origWinAdd = window.addEventListener.bind(window);
  window.addEventListener = function (type, listener, options) {
    if (type === "storage" && typeof listener === "function") {
      return origWinAdd(type, function (ev) {
        window.__appHandledNotifications.push({
          channel: "window.storage.listener",
          key: ev.key,
          replayed: Boolean(ev.__replayedByDiagnostic),
        });
        return listener.call(this, ev);
      }, options);
    }
    return origWinAdd(type, listener, options);
  };

  let userOnStorage = null;
  const storageDesc =
    Object.getOwnPropertyDescriptor(Window.prototype, "onstorage") ||
    Object.getOwnPropertyDescriptor(window, "onstorage");
  Object.defineProperty(window, "onstorage", {
    configurable: true,
    get() {
      return userOnStorage;
    },
    set(fn) {
      userOnStorage = fn;
      if (storageDesc && typeof storageDesc.set === "function") {
        storageDesc.set.call(
          window,
          typeof fn === "function"
            ? function (ev) {
                window.__appHandledNotifications.push({
                  channel: "window.onstorage",
                  key: ev.key,
                  replayed: Boolean(ev.__replayedByDiagnostic),
                });
                return fn.call(this, ev);
              }
            : fn
        );
      }
    },
  });

  origWinAdd(
    "storage",
    (ev) => {
      if (ev.__replayedByDiagnostic) return;
      if (!window.__deferCrossTabDelivery) return;
      const init = {
        key: ev.key,
        oldValue: ev.oldValue,
        newValue: ev.newValue,
        url: ev.url,
      };
      ev.stopImmediatePropagation();
      window.__interceptedNotifications.push({ channel: "window.storage", detail: ev.key });
      window.__deferredDeliveryQueue.push({
        channel: "window.storage",
        detail: ev.key,
        replay() {
          const cloned = new StorageEvent("storage", init);
          cloned.__replayedByDiagnostic = true;
          window.dispatchEvent(cloned);
        },
      });
    },
    true
  );

  const OrigBC = window.BroadcastChannel;
  if (OrigBC) {
    window.BroadcastChannel = function (...args) {
      const bc = new OrigBC(...args);
      const origAdd = bc.addEventListener.bind(bc);
      let userOnMessage = null;
      origAdd("message", (ev) => {
        if (typeof userOnMessage !== "function") return;
        const detail = String(ev.data?.type ?? typeof ev.data);
        const invoke = (replayed) => {
          window.__appHandledNotifications.push({
            channel: "BroadcastChannel.onmessage",
            detail,
            replayed,
          });
          userOnMessage.call(bc, ev);
        };
        if (window.__deferCrossTabDelivery) {
          window.__interceptedNotifications.push({ channel: "BroadcastChannel.onmessage", detail });
          window.__deferredDeliveryQueue.push({
            channel: "BroadcastChannel.onmessage",
            detail,
            replay: () => invoke(true),
          });
        } else {
          invoke(false);
        }
      });
      Object.defineProperty(bc, "onmessage", {
        configurable: true,
        get() {
          return userOnMessage;
        },
        set(fn) {
          userOnMessage = fn;
        },
      });
      bc.addEventListener = function (type, listener, options) {
        if (type === "message" && typeof listener === "function") {
          return origAdd(type, function (ev) {
            const detail = String(ev.data?.type ?? typeof ev.data);
            const invoke = (replayed) => {
              window.__appHandledNotifications.push({
                channel: "BroadcastChannel.listener",
                detail,
                replayed,
              });
              listener.call(this, ev);
            };
            if (window.__deferCrossTabDelivery) {
              window.__interceptedNotifications.push({ channel: "BroadcastChannel.listener", detail });
              window.__deferredDeliveryQueue.push({
                channel: "BroadcastChannel.listener",
                detail,
                replay: () => invoke(true),
              });
            } else {
              invoke(false);
            }
          }, options);
        }
        return origAdd(type, listener, options);
      };
      return bc;
    };
    window.BroadcastChannel.prototype = OrigBC.prototype;
  }

  window.__beginControlledInterception = () => {
    window.__interceptedNotifications = [];
    window.__appHandledNotifications = [];
    window.__deferredDeliveryQueue = [];
    window.__deferCrossTabDelivery = true;
  };

  window.__releaseControlledQueue = () => {
    const interceptedCount = window.__interceptedNotifications.length;
    const handledBeforeRelease = window.__appHandledNotifications.length;
    window.__deferCrossTabDelivery = false;
    const batch = window.__deferredDeliveryQueue.splice(0);
    const replayErrors = [];
    let releasedCount = 0;
    for (const item of batch) {
      try {
        item.replay();
        releasedCount += 1;
      } catch (err) {
        replayErrors.push({ channel: item.channel, detail: item.detail, error: String(err?.stack || err) });
      }
    }
    const handledTotal = window.__appHandledNotifications.length;
    return {
      interceptedCount,
      releaseAttempts: batch.length,
      releasedCount,
      handledBeforeRelease,
      handledAfterRelease: handledTotal - handledBeforeRelease,
      remainingQueueLength: window.__deferredDeliveryQueue.length,
      replayErrors,
    };
  };
}

const EXPECTED_PRE_CLEAR = { xp: 50, runs: 1, done: ["U1L1"] };
const EXPECTED_EMPTY = { xp: 0, runs: 0, done: [] };

try {
  for (const track of ["native-unmodified", "controlled-deferred-delivery"]) {
    const isControlled = track === "controlled-deferred-delivery";
    const ctx = await open(newDir());

    // 事件包装仅注入受控轨道；原生轨道零注入运行
    if (isControlled) {
      await ctx.addInitScript(installControlledTrackHooks);
    }

    const tabA = await load(ctx);
    await passOnboarding(tabA);
    await finishLesson(tabA, "U1L1");

    // ---------- T0：清除前完整核验（xp=50 / runs=1 / done=["U1L1"]） ----------
    const t0Memory = await readTabMemory(tabA);
    const t0Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T0 清除前旧页内存完整核验（xp=50, runs=1, done=["U1L1"]）`,
      matchesMemoryTriad(t0Memory, EXPECTED_PRE_CLEAR),
      JSON.stringify(t0Memory)
    );
    check(
      `[${track}] T0 清除前存储观察器完整核验（xp=50, runs=1, done=["U1L1"]）`,
      matchesStorageTriad(t0Obs, EXPECTED_PRE_CLEAR),
      JSON.stringify(t0Obs)
    );

    const tabB = await load(ctx);

    if (isControlled) {
      await tabA.evaluate(() => window.__beginControlledInterception());
    }

    // ---------- T1：Tab B 执行清除后、旧页保存前 ----------
    await tabB.evaluate(() => window.__app.clearProgress());
    const t1Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T1 清除后保存前存储观察器完整核验（xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t1Obs, EXPECTED_EMPTY),
      JSON.stringify(t1Obs)
    );

    // ---------- T2：保留临界窗口，旧页同步立即调用 persist() ----------
    const t2ImmediateSave = await tabA.evaluate(() => {
      const rawGet = Storage.prototype.getItem;
      const storageEpochBefore = rawGet.call(localStorage, "suipian.v4.epoch");
      const sPre = window.__app.getState();
      const preMem = {
        xp: sPre.xp,
        runs: sPre.lessonsCompleted,
        done:
          sPre.done !== null && typeof sPre.done === "object" && !Array.isArray(sPre.done)
            ? Object.keys(sPre.done).filter((k) => Boolean(sPre.done[k])).sort()
            : null,
      };
      let persistRet = null;
      let persistError = null;
      try {
        persistRet = window.__app.persist();
      } catch (err) {
        persistError = String(err);
      }
      const sPost = window.__app.getState();
      const postMem = {
        xp: sPost.xp,
        runs: sPost.lessonsCompleted,
        done:
          sPost.done !== null && typeof sPost.done === "object" && !Array.isArray(sPost.done)
            ? Object.keys(sPost.done).filter((k) => Boolean(sPost.done[k])).sort()
            : null,
      };
      const storageEpochAfter = rawGet.call(localStorage, "suipian.v4.epoch");
      return { storageEpochBefore, storageEpochAfter, preMem, persistRet, persistError, postMem };
    });

    if (isControlled) {
      check(
        `[${track}] T2 保存前旧页内存仍未受清除广播影响（xp=50, runs=1, done=["U1L1"]）`,
        matchesMemoryTriad(t2ImmediateSave.preMem, EXPECTED_PRE_CLEAR),
        JSON.stringify(t2ImmediateSave)
      );
    }

    const t2Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T2 旧页立即保存后存储持久化保护完整核验（xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t2Obs, EXPECTED_EMPTY),
      JSON.stringify({ t2ImmediateSave, t2Obs })
    );

    // 关闭 Tab B；受控轨道释放暂存通知，并逐项断言截获、释放、实际处理、队列清空
    await tabB.close();
    let controlledStats = null;
    if (isControlled) {
      controlledStats = await tabA.evaluate(() => window.__releaseControlledQueue());
      check(
        `[${track}] 通知截获断言：成功截获至少 1 条跨标签清除通知`,
        controlledStats.interceptedCount >= 1,
        JSON.stringify(controlledStats)
      );
      check(
        `[${track}] 通知释放断言：暂存通知全量释放且回放无异常`,
        controlledStats.releaseAttempts === controlledStats.interceptedCount &&
          controlledStats.releasedCount === controlledStats.interceptedCount &&
          controlledStats.replayErrors.length === 0,
        JSON.stringify(controlledStats)
      );
      check(
        `[${track}] 实际处理断言：应用注册监听器实际处理了释放的通知`,
        controlledStats.handledAfterRelease >= 1,
        JSON.stringify(controlledStats)
      );
      check(
        `[${track}] 队列清空断言：释放后待投递队列完全清空`,
        controlledStats.remainingQueueLength === 0,
        JSON.stringify(controlledStats)
      );
    }

    // ---------- T3（独立分列）：真实回前台 bringToFront()（不用 T4 成功掩盖 T3 异常） ----------
    await tabA.bringToFront();
    const t3Memory = await readTabMemory(tabA);
    const t3Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T3 真实回前台(bringToFront)存储完整核验（xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t3Obs, EXPECTED_EMPTY),
      JSON.stringify({ t3Memory, t3Obs })
    );
    check(
      `[${track}] T3 真实回前台(bringToFront)旧页内存收敛独立核验（xp=0, runs=0, done=[]）`,
      matchesMemoryTriad(t3Memory, EXPECTED_EMPTY),
      JSON.stringify({ t3Memory, t3Obs })
    );

    // ---------- T4（独立分列）：人工派发前台事件 SYNTHETIC_EVENT（visibilitychange + focus） ----------
    const t4Memory = await tabA.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      const s = window.__app.getState();
      return {
        eventSource: "SYNTHETIC_EVENT",
        xp: s.xp,
        runs: s.lessonsCompleted,
        done:
          s.done !== null && typeof s.done === "object" && !Array.isArray(s.done)
            ? Object.keys(s.done).filter((k) => Boolean(s.done[k])).sort()
            : null,
        visibilityState: document.visibilityState,
      };
    });
    const t4Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T4 人工事件(SYNTHETIC_EVENT)后存储完整核验（xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t4Obs, EXPECTED_EMPTY),
      JSON.stringify({ t4Memory, t4Obs })
    );
    check(
      `[${track}] T4 人工事件(SYNTHETIC_EVENT)后旧页内存收敛独立核验（xp=0, runs=0, done=[]）`,
      matchesMemoryTriad(t4Memory, EXPECTED_EMPTY),
      JSON.stringify({ t4Memory, t4Obs })
    );

    // ---------- 页面未捕获异常断言 ----------
    check(
      `[${track}] 页面异常断言：tabA 与 tabB 全程零未捕获 pageerror`,
      tabA.errors.length === 0 && tabB.errors.length === 0,
      JSON.stringify({ tabAErrors: tabA.errors, tabBErrors: tabB.errors })
    );

    const diagnosticSummary = {
      browser: BNAME,
      track,
      note: "controlled synthetic timing provides candidate explanations only and does not prove original CI job root cause",
      t0: { memory: t0Memory, storage: t0Obs },
      t1: { storage: t1Obs },
      t2: { immediateSave: t2ImmediateSave, storage: t2Obs },
      controlledStats,
      t3_realBringToFront: { memory: t3Memory, storage: t3Obs },
      t4_syntheticEvents: { memory: t4Memory, storage: t4Obs },
      pageErrors: { tabA: tabA.errors, tabB: tabB.errors },
    };
    console.log("CONCURRENCY_CLEAR_DIAGNOSTIC", JSON.stringify(diagnosticSummary));

    await ctx.close();
  }
} finally {
  await new Promise((r) => srv.close(r));
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

console.log(fail ? `\n[${BNAME}] ${fail} 项失败` : `\n[${BNAME}] 全部通过`);
process.exit(fail ? 1 : 0);
