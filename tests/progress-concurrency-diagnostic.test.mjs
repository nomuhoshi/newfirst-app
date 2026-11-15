// 并发清除窗口专项诊断（新增专项，保留 tests/progress-concurrency.test.mjs 原无注入测试不动）
// 复用真实的 open(dir) 与 load(ctx)；静态夹具放入独立静态上下文；事件回放如实计数且异常不可吞；
// 写入尝试与成功分开记录；内存收敛与持久化保护分别断言。
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
  p.on("pageerror", (e) => p.errors.push(e.message));
  await p.goto(BASE);
  await p.waitForFunction(() => window.__app?.getState);
  return p;
};

const observePageReadOnly = (staticPage) => staticPage.evaluate(observeSuipianV4Storage);

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
      await page.locator(".choice").nth(ex.options.findIndex((o) => !!o.correct)).click();
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

function buildCandidateExplanation({ t2Obs, obsAfter, t4Memory, immediateSave }) {
  if (!t2Obs.ok || !obsAfter.ok) {
    return "CANDIDATE_D_OBSERVE_OR_STORAGE_ANOMALY";
  }
  const persistedHasOldProgress =
    t2Obs.xp > 0 || t2Obs.done.includes("U1L1") || obsAfter.xp > 0 || obsAfter.done.includes("U1L1");
  if (persistedHasOldProgress && immediateSave.persistRet === true && immediateSave.setItemSuccesses.length > 0) {
    return "CANDIDATE_A_PERSISTENCE_WRITE_BACK_TO_ACTIVE_EPOCH";
  }
  if (immediateSave.persistRet === true && immediateSave.setItemSuccesses.length === 0 && obsAfter.xp === 0) {
    return t4Memory.xp > 0
      ? "CANDIDATE_B_NOOP_PERSIST_WITH_UNCONVERGED_MEMORY"
      : "CANDIDATE_B_NOOP_PERSIST_AND_CONVERGED";
  }
  if (immediateSave.persistRet === false && obsAfter.xp === 0 && t4Memory.xp > 0) {
    return "CANDIDATE_C_PERSIST_FALSE_OR_UNCONVERGED_MEMORY";
  }
  return "CONVERGED_EMPTY_ACTIVE_EPOCH";
}

try {
  // ---------- 1. 独立静态上下文：浏览器端观察器正向与夹具校验（绝不污染应用上下文） ----------
  {
    const staticCtx = await open(newDir());
    const staticPage = await staticCtx.newPage();
    await staticPage.goto(PRIVACY_URL);

    await staticPage.evaluate(() => {
      const rawSet = Storage.prototype.setItem;
      rawSet.call(localStorage, "suipian.v4.epoch", "m1");
      rawSet.call(
        localStorage,
        "suipian.v4.base.m1",
        JSON.stringify({
          epoch: "m1",
          s: { xp: 80, lessonsCompleted: 2, done: { U1L1: true, U1L2: true }, firstXp: { U1L1: 50, U1L2: 30 } },
        })
      );
      rawSet.call(
        localStorage,
        "suipian.v4.tab.t1",
        JSON.stringify({
          epoch: "m1",
          firstXp: { U1L2: 30 },
          entries: {
            "e-bonus": { type: "xp", xp: 10 },
          },
        })
      );
      rawSet.call(
        localStorage,
        "suipian.v4.tab.t2",
        JSON.stringify({
          epoch: "m1",
          firstXp: { U1L2: 30 },
          entries: {
            "e-bonus": { type: "xp", xp: 25 },
          },
        })
      );
      rawSet.call(
        localStorage,
        "suipian.v4.tab.oldm0",
        JSON.stringify({
          epoch: "m0",
          firstXp: { U1L1: 50 },
          entries: { "r-old": { type: "run", count: 1 } },
        })
      );
    });

    const staticObs = await observePageReadOnly(staticPage);
    check(
      "独立静态上下文观察器校验：非空基线 XP80 + 重复 ID 取最大(25) + 旧代隔离 = XP105",
      staticObs.ok === true &&
        staticObs.xp === 105 &&
        staticObs.runs === 2 &&
        staticObs.done.join(",") === "U1L1,U1L2" &&
        staticObs.duplicateEntryIds.join(",") === "e-bonus" &&
        staticObs.ignoredOldEpochKeys.some((x) => x.key === "suipian.v4.tab.oldm0"),
      JSON.stringify(staticObs)
    );
    await staticCtx.close();
  }

  // ---------- 2. 双轨竞态诊断（native-unmodified vs controlled-deferred-delivery） ----------
  for (const track of ["native-unmodified", "controlled-deferred-delivery"]) {
    const ctx = await open(newDir());

    await ctx.addInitScript(() => {
      window.__deferCrossTabDelivery = false;
      window.__deferredDeliveryQueue = [];
      window.__notificationsReceived = [];
      window.__notificationsDeliveredToApp = [];
      window.__setItemRecording = false;
      window.__setItemAttempts = [];
      window.__setItemSuccesses = [];
      window.__setItemFailures = [];

      const origSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) {
        if (!window.__setItemRecording) {
          return origSetItem.call(this, k, v);
        }
        let parsedEpoch = null;
        try {
          const obj = JSON.parse(String(v));
          parsedEpoch = obj?.epoch ?? obj?.clearEpoch ?? null;
        } catch {}
        const meta = { key: String(k), parsedEpoch, valLen: String(v).length };
        window.__setItemAttempts.push(meta);
        try {
          const ret = origSetItem.call(this, k, v);
          window.__setItemSuccesses.push(meta);
          return ret;
        } catch (err) {
          window.__setItemFailures.push({ ...meta, error: String(err) });
          throw err;
        }
      };

      // 追踪应用自身注册的 storage 监听器调用次数（仅统计应用处理器真实触发）
      const origWinAdd = window.addEventListener.bind(window);
      window.addEventListener = function (type, listener, options) {
        if (type === "storage" && typeof listener === "function") {
          return origWinAdd(type, function (ev) {
            window.__notificationsDeliveredToApp.push({
              channel: "window.storage.listener",
              key: ev.key,
              replayed: Boolean(ev.__replayedByDiagnostic),
            });
            return listener.call(this, ev);
          }, options);
        }
        return origWinAdd(type, listener, options);
      };

      // 捕获阶段记录并按需暂存 window storage 事件（保留完整 StorageEvent 字段，回放不吞异常）
      origWinAdd(
        "storage",
        (ev) => {
          if (ev.__replayedByDiagnostic) return;
          const init = {
            key: ev.key,
            oldValue: ev.oldValue,
            newValue: ev.newValue,
            url: ev.url,
          };
          window.__notificationsReceived.push({
            channel: "window.storage",
            key: ev.key,
            held: Boolean(window.__deferCrossTabDelivery),
          });
          if (window.__deferCrossTabDelivery) {
            ev.stopImmediatePropagation();
            window.__deferredDeliveryQueue.push({
              channel: "window.storage",
              detail: ev.key,
              replay() {
                const cloned = new StorageEvent("storage", init);
                cloned.__replayedByDiagnostic = true;
                window.dispatchEvent(cloned);
              },
            });
          }
        },
        true
      );

      // 包装 BroadcastChannel（addEventListener 与 onmessage），回放不吞异常
      const OrigBC = window.BroadcastChannel;
      if (OrigBC) {
        window.BroadcastChannel = function (...args) {
          const bc = new OrigBC(...args);
          const origAdd = bc.addEventListener.bind(bc);
          let userOnMessage = null;
          origAdd("message", (ev) => {
            if (typeof userOnMessage !== "function") return;
            const detail = String(ev.data?.type ?? typeof ev.data);
            window.__notificationsReceived.push({
              channel: "BroadcastChannel.onmessage",
              detail,
              held: Boolean(window.__deferCrossTabDelivery),
            });
            const invoke = () => {
              window.__notificationsDeliveredToApp.push({
                channel: "BroadcastChannel.onmessage",
                detail,
                replayed: Boolean(window.__deferCrossTabDelivery === false && ev.__replayed),
              });
              userOnMessage.call(bc, ev);
            };
            if (window.__deferCrossTabDelivery) {
              ev.__replayed = true;
              window.__deferredDeliveryQueue.push({ channel: "BroadcastChannel.onmessage", detail, replay: invoke });
            } else {
              invoke();
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
                window.__notificationsReceived.push({
                  channel: "BroadcastChannel.listener",
                  detail,
                  held: Boolean(window.__deferCrossTabDelivery),
                });
                const invoke = () => {
                  window.__notificationsDeliveredToApp.push({
                    channel: "BroadcastChannel.listener",
                    detail,
                    replayed: Boolean(ev.__replayed),
                  });
                  listener.call(this, ev);
                };
                if (window.__deferCrossTabDelivery) {
                  ev.__replayed = true;
                  window.__deferredDeliveryQueue.push({ channel: "BroadcastChannel.listener", detail, replay: invoke });
                } else {
                  invoke();
                }
              }, options);
            }
            return origAdd(type, listener, options);
          };
          return bc;
        };
        window.BroadcastChannel.prototype = OrigBC.prototype;
      }

      window.__resetDiagnosticCounters = (deferMode) => {
        window.__notificationsReceived = [];
        window.__notificationsDeliveredToApp = [];
        window.__deferredDeliveryQueue = [];
        window.__setItemAttempts = [];
        window.__setItemSuccesses = [];
        window.__setItemFailures = [];
        window.__deferCrossTabDelivery = Boolean(deferMode);
      };

      // 回放所有暂存通知：如实统计尝试/成功，异常绝不吞没
      window.__flushDeferredDeliveries = () => {
        window.__deferCrossTabDelivery = false;
        const q = window.__deferredDeliveryQueue.splice(0);
        const errors = [];
        let replaySucceeded = 0;
        for (const item of q) {
          try {
            item.replay();
            replaySucceeded += 1;
          } catch (err) {
            errors.push({ channel: item.channel, detail: item.detail, error: String(err?.stack || err) });
          }
        }
        return {
          replayAttempts: q.length,
          replaySucceeded,
          errors,
        };
      };
    });

    const tabA = await load(ctx);
    await passOnboarding(tabA);
    await finishLesson(tabA, "U1L1");

    // 正向校验：清除前通过同源静态观察页准确读出 XP50、次数1、U1L1
    const obsBeforePage = await ctx.newPage();
    await obsBeforePage.goto(PRIVACY_URL);
    const obsBefore = await observePageReadOnly(obsBeforePage);
    await obsBeforePage.close();
    check(
      `[专项诊断/${track}] 正向校验：清除前观察器准确读出 XP50、次数1、U1L1`,
      obsBefore.ok === true && obsBefore.xp === 50 && obsBefore.runs === 1 && obsBefore.done.join(",") === "U1L1",
      JSON.stringify(obsBefore)
    );

    const tabB = await load(ctx);

    // 清除前重置事件计数
    await tabA.evaluate((isControlled) => {
      window.__resetDiagnosticCounters(isControlled);
    }, track === "controlled-deferred-delivery");

    // Tab B 执行清除，保留“清除后立即由旧页保存”的窗口
    await tabB.evaluate(() => window.__app.clearProgress());

    // 保存前快照 + persist() + 保存后快照放在同一次同步 evaluate 中，写入尝试与成功分开记录
    const syncAtomicCapture = await tabA.evaluate(() => {
      const rawGet = Storage.prototype.getItem;
      const readMem = () => {
        const s = window.__app.getState();
        return {
          boundEpochNote: "internal-weakmap-not-exposed-on-state",
          xp: s.xp,
          runs: s.lessonsCompleted,
          done: Object.keys(s.done || {}).filter((k) => !!s.done[k]).sort(),
        };
      };
      const storageEpochBefore = rawGet.call(localStorage, "suipian.v4.epoch");
      const preSaveMemory = readMem();
      const receivedBeforePersist = window.__notificationsReceived.slice();
      const deliveredBeforePersist = window.__notificationsDeliveredToApp.slice();

      window.__setItemAttempts = [];
      window.__setItemSuccesses = [];
      window.__setItemFailures = [];
      window.__setItemRecording = true;
      let persistRet = null;
      let persistError = null;
      try {
        persistRet = window.__app.persist();
      } catch (err) {
        persistError = String(err);
      } finally {
        window.__setItemRecording = false;
      }

      const postSaveMemory = readMem();
      const storageEpochAfter = rawGet.call(localStorage, "suipian.v4.epoch");
      return {
        storageEpochBefore,
        storageEpochAfter,
        preSaveMemory,
        persistRet,
        persistError,
        setItemAttempts: window.__setItemAttempts.slice(),
        setItemSuccesses: window.__setItemSuccesses.slice(),
        setItemFailures: window.__setItemFailures.slice(),
        postSaveMemory,
        receivedBeforePersist,
        deliveredBeforePersist,
      };
    });

    // 静态观察页只读采样 T2
    const obsT2Page = await ctx.newPage();
    await obsT2Page.goto(PRIVACY_URL);
    const t2Obs = await observePageReadOnly(obsT2Page);
    await obsT2Page.close();

    // 关闭 Tab B，回放受控暂存通知（不吞异常），真实 bringToFront()
    await tabB.close();
    const replayResult =
      track === "controlled-deferred-delivery"
        ? await tabA.evaluate(() => window.__flushDeferredDeliveries())
        : { replayAttempts: 0, replaySucceeded: 0, errors: [] };
    check(
      `[专项诊断/${track}] 通知回放无异常（如实计数，异常未吞没）`,
      replayResult.errors.length === 0,
      JSON.stringify(replayResult)
    );

    await tabA.bringToFront();
    const t3Memory = await tabA.evaluate(() => {
      const s = window.__app.getState();
      return { xp: s.xp, runs: s.lessonsCompleted, done: Object.keys(s.done || {}).filter((k) => !!s.done[k]).sort() };
    });

    // 人工派发前台事件显式标注 SYNTHETIC_EVENT（无固定 100ms 等待）
    const syntheticStep = await tabA.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
      const s = window.__app.getState();
      return {
        eventSource: "SYNTHETIC_EVENT",
        memory: { xp: s.xp, runs: s.lessonsCompleted, done: Object.keys(s.done || {}).filter((k) => !!s.done[k]).sort() },
        notificationsReceived: window.__notificationsReceived.slice(),
        notificationsDeliveredToApp: window.__notificationsDeliveredToApp.slice(),
      };
    });

    // 静态观察页只读采样 T4
    const obsAfterPage = await ctx.newPage();
    await obsAfterPage.goto(PRIVACY_URL);
    const obsAfter = await observePageReadOnly(obsAfterPage);
    await obsAfterPage.close();

    const candidateExplanation = buildCandidateExplanation({
      t2Obs,
      obsAfter,
      t4Memory: syntheticStep.memory,
      immediateSave: syncAtomicCapture,
    });

    const diagnosticRecord = {
      browser: BNAME,
      track,
      note: "controlled synthetic reproduction provides candidate explanations only and does not prove original CI job root cause",
      candidateExplanation,
      replayResult,
      syncAtomicCapture,
      t2Obs,
      t3AfterBringToFrontMemory: t3Memory,
      t4AfterSyntheticEvents: syntheticStep,
      obsAfterStaticPrivacyPage: obsAfter,
    };
    console.log("CONCURRENCY_CLEAR_DIAGNOSTIC", JSON.stringify(diagnosticRecord));

    // 断言 A：持久化保护（当前有效代持久化保持清空，不复活）
    check(
      `[专项诊断/${track}] 持久化保护：旧页立即保存后当前有效代持久化保持清空（${candidateExplanation}）`,
      t2Obs.ok === true &&
        t2Obs.xp === 0 &&
        t2Obs.done.length === 0 &&
        obsAfter.ok === true &&
        obsAfter.xp === 0 &&
        obsAfter.done.length === 0,
      JSON.stringify(diagnosticRecord)
    );

    // 断言 B：内存收敛（旧页回前台后内存收敛为空记录）
    check(
      `[专项诊断/${track}] 内存收敛：旧页回前台后内存状态收敛为空记录（${candidateExplanation}）`,
      syntheticStep.memory.xp === 0 && syntheticStep.memory.runs === 0 && syntheticStep.memory.done.length === 0,
      JSON.stringify(diagnosticRecord)
    );

    await ctx.close();
  }
} finally {
  await new Promise((r) => srv.close(r));
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
}

console.log(fail ? `\n[${BNAME}] ${fail} 项失败` : `\n[${BNAME}] 全部通过`);
process.exit(fail ? 1 : 0);
