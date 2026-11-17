// 并发清除窗口浏览器事件诊断专项（保留 tests/progress-concurrency.test.mjs 原无注入用例零改动）
// 约定：
// 1. 直接复用 R2 观察器 tests/lib/ledger-observer.mjs 的唯一命名导出 observeSuipianV4Storage(storage?)；
// 2. T1 原始只读快照放入 Tab B 清除的同一次同步 evaluate 中，随后立即执行 Tab A 单次同步保存采样（T2），两次调用之间不开页、不做其他页面操作，之后再开静态观察页。
//    注意：相邻两次跨页 evaluate 调用之间仍可能发生调度，这不是跨页原子操作，不得这样表述；
//    T1 的本代进度不在页面里另写判定，而是把同步转存的 suipian.v4.* 原始键值交给上面同一个已审观察器判定
//    （真实清除写入 base.s={}，且清除后 Tab B 会写本代合法的空进度账本，二者都应被接受；基线缺失、损坏、读取失败一律不算“空”）；
// 3. 断言 persistError === null、typeof persistRet === "boolean"，两条轨道都要求 T2 保存后的即时内存为 0 XP / 0 次 / done 为空
//    （清除冲突时 persist() 返回 false 是合法的），并核验清除换代及 T0-T4 各阶段 epoch；
// 4. 完整保留内存与存储的 xp / runs / done 证据，真实回前台 T3 与人工事件 T4 分列独立判定；
// 5. 正常或异常退出时按“先关闭全部 BrowserContext -> 再停 HTTP 服务 -> 最后清理临时目录”顺序释放资源；
//    BrowserContext 关闭成功后才移出追踪集合，关闭失败不被吞掉：记录、继续清理其余资源、最终以失败退出。
// 运行（需先合入 R2 补丁并执行 npm run build）：
//   MOBILE_BROWSER=webkit|chromium node tests/progress-concurrency-diagnostic.test.mjs

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
let unverified = 0;
const check = (name, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "✅" : "❌"} [${BNAME}] ${name}${ok || !detail ? "" : "  — " + detail}`);
};
const markUnverified = (name, detail = "") => {
  unverified++;
  console.log(`⚠️ [${BNAME}] ${name}${!detail ? "" : "  — " + detail}`);
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

const dirs = [];
const activeContexts = new Set();
let srv = null;

const newDir = () => {
  const d = mkdtempSync(join(tmpdir(), "suipian-conc-diag-"));
  dirs.push(d);
  return d;
};

const OPTS = {
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: engine === chromium,
  serviceWorkers: "block",
};

const open = async (dir) => {
  const ctx = await engine.launchPersistentContext(dir, OPTS);
  activeContexts.add(ctx);
  return ctx;
};

// 关闭成功后才移出追踪集合；关闭失败向上抛出并保留引用，由收尾阶段再试，且计入失败
const closeCtx = async (ctx) => {
  if (!ctx) return;
  await ctx.close();
  activeContexts.delete(ctx);
};

const cleanupErrors = [];
const cleanupFailure = (stage, err) => {
  cleanupErrors.push({ stage, error: String(err?.stack || err) });
  console.log(`❌ [${BNAME}] 清理失败：${stage}  — ${String(err?.message || err)}`);
};

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
      deferredBeforeRelease: batch.length,
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

const matchesStorageTriad = (obs, expected, expectedEpoch = null) =>
  obs !== null &&
  typeof obs === "object" &&
  obs.ok === true &&
  obs.status === "OK" &&
  typeof obs.currentEpoch === "string" &&
  obs.currentEpoch.length > 0 &&
  (expectedEpoch === null || obs.currentEpoch === expectedEpoch) &&
  typeof obs.xp === "number" &&
  obs.xp === expected.xp &&
  typeof obs.runs === "number" &&
  obs.runs === expected.runs &&
  Array.isArray(obs.done) &&
  obs.done.length === expected.done.length &&
  obs.done.every((v, i) => v === expected.done[i]);

// 把 T1 同步转存的 suipian.v4.* 原始键值做成只读 Storage 外形，交给已审观察器 observeSuipianV4Storage 判定
const storageFromDump = (dump) => ({ get length() { return Object.keys(dump).length; }, key: (i) => Object.keys(dump)[i] ?? null, getItem: (k) => (Object.prototype.hasOwnProperty.call(dump, k) ? dump[k] : null) });

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

try {
  srv = createServer((req, res) => {
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

  const load = async (ctx) => {
    const p = await ctx.newPage();
    p.errors = [];
    p.on("pageerror", (e) => p.errors.push(String(e?.message || e)));
    await p.goto(BASE);
    await p.waitForFunction(() => window.__app?.getState);
    return p;
  };

  // 在同源静态页 privacy.html 中直接执行 R2 观察器 observeSuipianV4Storage
  const observeStaticStorage = async (ctx) => {
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
          currentEpoch: null,
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
  };

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

  const passOnboarding = async (page) => {
    for (let i = 0; i < 6 && (await page.locator(".onboard").count()); i++) {
      await page.locator(".onboard .btn3d.primary").click();
      await page.waitForTimeout(100);
    }
    await page.waitForSelector(".pathview");
  };

  const finishLesson = async (page, id) => {
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
  };

  // 三条轨道：前两条清除后立即采样、不等待（保留首轮失败的即时窗口）；第三条先等旧页读到新代数再采样，验证“已看见清除”时的收敛。
  for (const track of ["native-unmodified", "controlled-deferred-delivery", "native-after-epoch-visible"]) {
    const isControlled = track === "controlled-deferred-delivery";
    const waitForEpoch = track === "native-after-epoch-visible";
    const ctx = await open(newDir());

    // 事件包装仅注入受控轨道；原生轨道零注入运行
    if (isControlled) {
      await ctx.addInitScript(installControlledTrackHooks);
    }

    const tabA = await load(ctx);
    await passOnboarding(tabA);
    await finishLesson(tabA, "U1L1");

    // ---------- T0：清除前基线完整核验（XP=50 / 次数=1 / done=["U1L1"] + 初始 epoch） ----------
    const t0Memory = await readTabMemory(tabA);
    const t0Obs = await observeStaticStorage(ctx);
    check(
      `[${track}] T0 清除前旧页内存完整核验（xp=50, runs=1, done=["U1L1"]）`,
      matchesMemoryTriad(t0Memory, EXPECTED_PRE_CLEAR),
      JSON.stringify(t0Memory)
    );
    check(
      `[${track}] T0 清除前 R2 观察器完整核验（ok=true, xp=50, runs=1, done=["U1L1"], currentEpoch 非空）`,
      matchesStorageTriad(t0Obs, EXPECTED_PRE_CLEAR),
      JSON.stringify(t0Obs)
    );
    const preClearEpoch = t0Obs.currentEpoch;

    const tabB = await load(ctx);

    if (isControlled) {
      await tabA.evaluate(() => window.__beginControlledInterception());
    }

    // ---------- T1：Tab B 清除与原始只读快照在同一同步 evaluate 中完成（先不开观察页） ----------
    const t1ClearAndRaw = await tabB.evaluate(() => {
      const rawGet = Storage.prototype.getItem;
      const epochBeforeClear = rawGet.call(localStorage, "suipian.v4.epoch") || "m0";
      window.__app.clearProgress();
      const epochAfterClear = rawGet.call(localStorage, "suipian.v4.epoch") || "m0";
      const baseKeyAfterClear = "suipian.v4.base." + epochAfterClear;
      const baseRawAfterClear = rawGet.call(localStorage, baseKeyAfterClear);

      let parsedBase = null;
      let parseError = null;
      if (baseRawAfterClear !== null) {
        try {
          parsedBase = JSON.parse(baseRawAfterClear);
        } catch (err) {
          parseError = String(err);
        }
      }

      const sBase = parsedBase && typeof parsedBase.s === "object" && parsedBase.s !== null ? parsedBase.s : null;
      const rawBaseDone =
        sBase && sBase.done !== null && typeof sBase.done === "object" && !Array.isArray(sBase.done)
          ? Object.keys(sBase.done).filter((k) => Boolean(sBase.done[k])).sort()
          : [];

      const activeTabKeysAfterClear = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (typeof k === "string" && k.startsWith("suipian.v4.tab.")) {
          const rawTab = rawGet.call(localStorage, k);
          try {
            const doc = JSON.parse(rawTab);
            if (doc && doc.epoch === epochAfterClear) {
              activeTabKeysAfterClear.push(k);
            }
          } catch {}
        }
      }

      const sB = window.__app.getState();
      const tabBMemoryAfterClear = {
        xp: sB.xp,
        runs: sB.lessonsCompleted,
        done:
          sB.done !== null && typeof sB.done === "object" && !Array.isArray(sB.done)
            ? Object.keys(sB.done).filter((k) => Boolean(sB.done[k])).sort()
            : null,
      };

      // 同一次同步执行内原样转存全部 suipian.v4.* 原始键值：Node 侧交给已审观察器判定本代有效进度（页面内不另写判定逻辑，也不再开页）
      const v4Dump = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (typeof k === "string" && k.startsWith("suipian.v4.")) v4Dump[k] = rawGet.call(localStorage, k);
      }

      // rawBaseXp / rawBaseRuns / activeTabKeysAfterClear 仅作证据留存，不再作断言：
      // 真实清除写入 base.s={}（没有这两个字段），且清除后 persist() 会写 Tab B 本代的合法空进度账本
      return {
        epochBeforeClear,
        epochAfterClear,
        baseKeyAfterClear,
        rawBaseExists: baseRawAfterClear !== null,
        parseError,
        rawBaseVersion: parsedBase?.v ?? null,
        rawBaseEpoch: parsedBase?.epoch ?? null,
        rawBaseXp: typeof sBase?.xp === "number" ? sBase.xp : null,
        rawBaseRuns: typeof sBase?.lessonsCompleted === "number" ? sBase.lessonsCompleted : null,
        rawBaseDone,
        activeTabKeysAfterClear: activeTabKeysAfterClear.sort(),
        tabBMemoryAfterClear,
        v4Dump,
      };
    });

    // ---------- T2：紧接 T1 之后立即执行 Tab A 单次同步保存采样（两次调用之间不开页、不做其他页面操作；不是跨页原子操作） ----------
    // 等待只发生在 native-after-epoch-visible 轨道：保存前轮询旧页自己读到的代数，最多 3 秒，等了多久记入诊断（t2EpochWait）。3 秒仍读不到：照常采样，下面的严格断言原样失败。
    // 另两条轨道不等待：清除后立即采样。旧页此时读到的若仍是旧代数（WebKit 跨进程同步延迟的候选解释，根因未证实），记为 STALE_EPOCH_NOT_VISIBLE：不计入 T2 通过，
    // 只核验安全不变量（persist 不抛错 / 返回布尔值、新代数存储里没有旧进度）。T2 采样本身（下面这一段）和严格断言一字未改。
    const t2EpochWait = waitForEpoch
      ? await tabA.evaluate(async (expectedEpoch) => {
          const rawGet = Storage.prototype.getItem;
          const start = performance.now();
          while (performance.now() - start < 3000) {
            if ((rawGet.call(localStorage, "suipian.v4.epoch") || "m0") === expectedEpoch) return { waited: true, epochVisibleAfterMs: Math.round(performance.now() - start) };
            await new Promise((r) => setTimeout(r, 20));
          }
          return { waited: true, epochVisibleAfterMs: null };
        }, t1ClearAndRaw.epochAfterClear)
      : { waited: false };
    const t2ImmediateSave = await tabA.evaluate(() => {
      const rawGet = Storage.prototype.getItem;
      const storageEpochBeforeSave = rawGet.call(localStorage, "suipian.v4.epoch") || "m0";
      const sPre = window.__app.getState();
      const preMem = {
        xp: sPre.xp,
        runs: sPre.lessonsCompleted,
        done:
          sPre.done !== null && typeof sPre.done === "object" && !Array.isArray(sPre.done)
            ? Object.keys(sPre.done).filter((k) => Boolean(sPre.done[k])).sort()
            : null,
        visibilityState: document.visibilityState,
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
        visibilityState: document.visibilityState,
      };
      const storageEpochAfterSave = rawGet.call(localStorage, "suipian.v4.epoch") || "m0";
      return { storageEpochBeforeSave, storageEpochAfterSave, preMem, persistRet, persistError, postMem };
    });

    // ---------- 此时再打开同源静态观察页，采集 T2 后的存储权威视图 ----------
    const t2Obs = await observeStaticStorage(ctx);
    const clearedEpoch = t1ClearAndRaw.epochAfterClear;
    // T1 本代进度由已审观察器判定：基线缺失 / 损坏 / 读取失败都得 ok:false，不会被当成“空进度”；缺转存时按空转存处理（同样失败）
    const t1LedgerView = observeSuipianV4Storage(storageFromDump(t1ClearAndRaw.v4Dump ?? {}));

    check(
      `[${track}] T1 清除换代与原始只读快照核验（epoch 切换；新代基线存在且可解析；观察器判定本代进度为空，接受 base.s={} 与本代空进度账本）`,
      t1ClearAndRaw.epochBeforeClear === preClearEpoch &&
        typeof clearedEpoch === "string" &&
        clearedEpoch.length > 0 &&
        clearedEpoch !== preClearEpoch &&
        t1ClearAndRaw.rawBaseExists === true &&
        t1ClearAndRaw.parseError === null &&
        t1ClearAndRaw.rawBaseVersion === 4 &&
        t1ClearAndRaw.rawBaseEpoch === clearedEpoch &&
        matchesStorageTriad(t1LedgerView, EXPECTED_EMPTY, clearedEpoch) &&
        matchesMemoryTriad(t1ClearAndRaw.tabBMemoryAfterClear, EXPECTED_EMPTY),
      JSON.stringify({ t1ClearAndRaw, t1LedgerView })
    );

    if (isControlled) {
      check(
        `[${track}] T2 保存前旧页内存仍未受清除广播影响（xp=50, runs=1, done=["U1L1"]）`,
        matchesMemoryTriad(t2ImmediateSave.preMem, EXPECTED_PRE_CLEAR),
        JSON.stringify(t2ImmediateSave)
      );
    }

    const t2StaleViewAtSample = t2ImmediateSave.storageEpochBeforeSave !== t1ClearAndRaw.epochAfterClear;
    if (!waitForEpoch && t2StaleViewAtSample) {
      markUnverified(
        `[${track}] T2 即时采样未覆盖：旧页读到的仍是旧代数（STALE_EPOCH_NOT_VISIBLE，不计入 T2 通过；已看见清除后的收敛由 native-after-epoch-visible 轨道核验）`,
        JSON.stringify(t2ImmediateSave)
      );
      check(
        `[${track}] T2 即时窗口安全不变量（旧代数不可见：persist() 不抛错且返回布尔值；此项只证明没有异常，不证明收敛）`,
        t2ImmediateSave.persistError === null && typeof t2ImmediateSave.persistRet === "boolean",
        JSON.stringify(t2ImmediateSave)
      );
    } else {
      check(
        `[${track}] T2 persist() 返回契约、保存后即时内存为空（xp=0, runs=0, done=[]）与 epoch 前后对齐核验（persistError === null, typeof persistRet === "boolean"；清除冲突时返回 false 合法）`,
        t2ImmediateSave.persistError === null &&
          typeof t2ImmediateSave.persistRet === "boolean" &&
          // false 仅在保存前旧页内存确实仍是清除前的旧进度（有真实的旧→空采用过程）时合法；保存前已空而返回 false 没有清除冲突依据，不能算健康保存
          (t2ImmediateSave.persistRet === true || matchesMemoryTriad(t2ImmediateSave.preMem, EXPECTED_PRE_CLEAR)) &&
          matchesMemoryTriad(t2ImmediateSave.postMem, EXPECTED_EMPTY) &&
          t2ImmediateSave.storageEpochBeforeSave === clearedEpoch &&
          t2ImmediateSave.storageEpochAfterSave === clearedEpoch,
        JSON.stringify(t2ImmediateSave)
      );
    }

    check(
      `[${track}] T2 旧页立即保存后存储持久化保护完整核验（currentEpoch=${clearedEpoch}, xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t2Obs, EXPECTED_EMPTY, clearedEpoch),
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
        `[${track}] 回放前未投递断言：释放前应用处理数为 0 且暂存队列等于截获数`,
        controlledStats.handledBeforeRelease === 0 &&
          controlledStats.deferredBeforeRelease === controlledStats.interceptedCount,
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

    // ---------- T3（独立分列）：真实回前台 bringToFront()（未观测到真实 hidden→visible 仅标未取得该生命周期证据） ----------
    await tabA.evaluate(() => {
      const probe = {
        visibilityBefore: document.visibilityState,
        transitions: [],
        focusCount: 0,
      };
      const onVis = () => probe.transitions.push(document.visibilityState);
      const onFocus = () => {
        probe.focusCount += 1;
      };
      document.addEventListener("visibilitychange", onVis);
      window.addEventListener("focus", onFocus);
      window.__t3PassiveProbe = {
        finish() {
          document.removeEventListener("visibilitychange", onVis);
          window.removeEventListener("focus", onFocus);
          return {
            visibilityBefore: probe.visibilityBefore,
            transitions: probe.transitions.slice(),
            focusCount: probe.focusCount,
            visibilityAfter: document.visibilityState,
          };
        },
      };
    });
    await tabA.bringToFront();
    const t3ProbeRaw = await tabA.evaluate(() => {
      const p = window.__t3PassiveProbe ? window.__t3PassiveProbe.finish() : null;
      delete window.__t3PassiveProbe;
      return p;
    });
    const t3Memory = await readTabMemory(tabA);
    const t3Obs = await observeStaticStorage(ctx);
    // 只认探针窗口内（监听器安装→finish()）有序的 hidden→visible：初始 hidden 或窗口内出现 hidden，之后窗口内必须出现 visible，
    // 且之后不得再回到 hidden，finish() 时 visibilityAfter 必须为 visible；窗口外较晚才变 visible（只靠 t3Memory 采样）一律不算。
    const observedHiddenToVisible = (() => {
      if (!t3ProbeRaw || !Array.isArray(t3ProbeRaw.transitions)) return false;
      let hidden = t3ProbeRaw.visibilityBefore === "hidden";
      let orderedVisible = false;
      let returnedToHidden = false;
      for (const state of t3ProbeRaw.transitions) {
        if (state === "hidden") {
          if (orderedVisible) returnedToHidden = true;
          hidden = true;
        }
        else if (state === "visible") {
          if (hidden) orderedVisible = true;
          hidden = false;
        }
      }
      return orderedVisible && !returnedToHidden && !hidden && t3ProbeRaw.visibilityAfter === "visible" && t3Memory.visibilityState === "visible";
    })();
    const t3Lifecycle = {
      ...(t3ProbeRaw || {}),
      observedHiddenToVisible,
      status: observedHiddenToVisible ? "OBSERVED_HIDDEN_TO_VISIBLE" : "LIFECYCLE_EVIDENCE_NOT_OBTAINED",
    };
    check(
      `[${track}] T3 真实回前台(bringToFront)存储完整核验（currentEpoch=${clearedEpoch}, xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t3Obs, EXPECTED_EMPTY, clearedEpoch),
      JSON.stringify({ t3Lifecycle, t3Memory, t3Obs })
    );
    if (observedHiddenToVisible) {
      check(
        `[${track}] T3 真实回前台(hidden→visible)旧页内存收敛独立核验（xp=0, runs=0, done=[]）`,
        matchesMemoryTriad(t3Memory, EXPECTED_EMPTY),
        JSON.stringify({ t3Lifecycle, t3Memory, t3Obs })
      );
    } else {
      markUnverified(
        `[${track}] T3 未取得真实 hidden→visible 生命周期证据（LIFECYCLE_EVIDENCE_NOT_OBTAINED：bringToFront() 返回成功不等同验证通过）`,
        JSON.stringify({ t3Lifecycle, t3Memory, t3Obs })
      );
    }

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
      `[${track}] T4 人工事件(SYNTHETIC_EVENT)后存储完整核验（currentEpoch=${clearedEpoch}, xp=0, runs=0, done=[]）`,
      matchesStorageTriad(t4Obs, EXPECTED_EMPTY, clearedEpoch),
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
      epochs: {
        preClearEpoch,
        clearedEpoch,
        t2BeforeSaveEpoch: t2ImmediateSave.storageEpochBeforeSave,
        t2AfterSaveEpoch: t2ImmediateSave.storageEpochAfterSave,
        t2ObserverEpoch: t2Obs.currentEpoch,
        t3ObserverEpoch: t3Obs.currentEpoch,
        t4ObserverEpoch: t4Obs.currentEpoch,
      },
      t0: { memory: t0Memory, storage: t0Obs },
      t1_syncClearAndRawSnapshot: t1ClearAndRaw,
      t1_ledgerView: t1LedgerView,
      t2_syncImmediateSave: { epochWait: t2EpochWait, t2View: t2StaleViewAtSample ? "STALE_EPOCH_NOT_VISIBLE" : "EPOCH_VISIBLE", immediateSave: t2ImmediateSave, storageAfterSave: t2Obs },
      controlledStats,
      t3_realBringToFront: { lifecycle: t3Lifecycle, memory: t3Memory, storage: t3Obs },
      t4_syntheticEvents: { memory: t4Memory, storage: t4Obs },
      pageErrors: { tabA: tabA.errors, tabB: tabB.errors },
    };
    console.log("CONCURRENCY_CLEAR_DIAGNOSTIC", JSON.stringify(diagnosticSummary));

    await closeCtx(ctx);
  }
} finally {
  // 每一步失败都只记录并继续清理其余资源（失败的 BrowserContext 仍留在追踪集合里），最后统一计入失败
  // 1. 先关闭全部残留 BrowserContext
  for (const ctx of [...activeContexts]) {
    try {
      await closeCtx(ctx);
    } catch (err) {
      cleanupFailure("关闭 BrowserContext", err);
    }
  }
  // 2. 再停止本地 HTTP 服务
  if (srv && srv.listening) {
    try {
      await new Promise((resolveClose, rejectClose) => srv.close((err) => (err ? rejectClose(err) : resolveClose())));
    } catch (err) {
      cleanupFailure("停止 HTTP 服务", err);
    }
  }
  // 3. 最后清理所有测试临时目录
  for (const d of dirs) {
    try {
      rmSync(d, { recursive: true, force: true });
    } catch (err) {
      cleanupFailure(`清理临时目录 ${d}`, err);
    }
  }
}

check(
  `清理断言：BrowserContext 关闭、HTTP 服务停止、临时目录清理全部成功（残留未关闭 context ${activeContexts.size} 个）`,
  cleanupErrors.length === 0 && activeContexts.size === 0,
  JSON.stringify(cleanupErrors)
);

console.log(
  fail
    ? `\n[${BNAME}] ${fail} 项失败（通过 ${pass}，未取得证据 ${unverified}（生命周期 / 即时窗口））`
    : `\n[${BNAME}] 通过 ${pass} 项，未取得证据 ${unverified} 项（生命周期 / 即时窗口），0 项失败`
);
process.exit(fail ? 1 : 0);