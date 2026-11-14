// G: Playwright browser Service Worker capability & takeover probe.
// Exit codes:
//   0 = SW lifecycle, version query, waiting -> skipWaiting -> controllerchange takeover, and cache retention passed.
//   1 = Lifecycle/version/takeover assertion failed.
//   2 = Environment failure (browser missing/cannot launch or serviceWorker API unavailable).
import { chromium, webkit } from "playwright";
import { createServer } from "node:http";

const name = process.env.MOBILE_BROWSER === "webkit" ? "webkit" : "chromium";
const engine = name === "webkit" ? webkit : chromium;

let versionNum = 1;
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.url.startsWith("/sw.js")) {
    const ver = `cap-v${versionNum}`;
    const cache = `suipian-${ver}`;
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.end([
      `const VERSION = ${JSON.stringify(ver)};`,
      `const CACHE = ${JSON.stringify(cache)};`,
      `self.addEventListener("install", (e) => {`,
      `  e.waitUntil((async () => {`,
      `    const c = await caches.open(CACHE);`,
      `    await c.put("./marker", new Response(VERSION));`,
      `    if (VERSION === "cap-v1") await self.skipWaiting();`,
      `  })());`,
      `});`,
      `self.addEventListener("activate", (e) => {`,
      `  e.waitUntil(self.clients.claim());`,
      `});`,
      `self.addEventListener("message", (e) => {`,
      `  if (e.data?.type === "skipWaiting") self.skipWaiting();`,
      `  if (e.data?.type === "version") e.source?.postMessage({ type: "version", version: VERSION, cache: CACHE });`,
      `});`,
    ].join("\n"));
  } else {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end("<!doctype html><title>SW capability</title>");
  }
});

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://localhost:${server.address().port}/`;

const queryControllerVersion = (page, timeoutMs = 4000) =>
  page.evaluate((ms) => new Promise((resolve) => {
    if (!navigator.serviceWorker?.controller) return resolve(null);
    let settled = false;
    const finish = (val) => { if (!settled) { settled = true; resolve(val); } };
    const onMsg = (e) => {
      if (e.data?.type === "version") {
        navigator.serviceWorker.removeEventListener("message", onMsg);
        finish({ version: e.data.version, cache: e.data.cache });
      }
    };
    navigator.serviceWorker.addEventListener("message", onMsg);
    try {
      navigator.serviceWorker.controller.postMessage({ type: "version" });
    } catch {
      navigator.serviceWorker.removeEventListener("message", onMsg);
      finish(null);
      return;
    }
    setTimeout(() => {
      navigator.serviceWorker.removeEventListener("message", onMsg);
      finish(null);
    }, ms);
  }), timeoutMs);

let browser = null;
let ctx = null;
let page = null;

// Stage 1: Environment initialization (exit 2 on failure)
try {
  browser = await engine.launch();
  ctx = await browser.newContext({ serviceWorkers: "allow" });
  page = await ctx.newPage();
  await page.goto(url, { timeout: 15000 });
  const supported = await page.evaluate(() => "serviceWorker" in navigator);
  if (!supported) throw new Error("navigator.serviceWorker absent");
} catch (e) {
  console.error("SW_CAPABILITY_ENV_FAILED", JSON.stringify({ browser: name, exitCode: 2, error: String(e.stack || e) }));
  await ctx?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await new Promise((r) => server.close(r));
  process.exit(2);
}

// Stage 2: Lifecycle, version query, and activation takeover assertions (exit 1 on failure)
let code = 0;
try {
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, rej) => setTimeout(() => rej(new Error("sw ready timeout (15000ms)")), 15000)),
    ]);
    const sw = reg.active;
    if (sw && sw.state !== "activated") {
      await Promise.race([
        new Promise((resolve) => {
          if (sw.state === "activated" || sw.state === "redundant") return resolve();
          const onState = () => {
            if (sw.state === "activated" || sw.state === "redundant") {
              sw.removeEventListener("statechange", onState);
              resolve();
            }
          };
          sw.addEventListener("statechange", onState);
        }),
        new Promise((_, rej) => setTimeout(() => rej(new Error("sw activated state timeout (15000ms)")), 15000)),
      ]);
    }
  });
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return reg?.active?.state === "activated" && !!navigator.serviceWorker.controller;
  }, null, { timeout: 15000 });
  const installed = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.state || null);
  const ctrlV1 = await queryControllerVersion(page, 4000);

  // Publish v2: must install and wait without taking over prematurely
  versionNum = 2;
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    await Promise.race([
      reg.update(),
      new Promise((_, rej) => setTimeout(() => rej(new Error("sw update timeout (15000ms)")), 15000)),
    ]);
  });
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration())?.waiting, null, { timeout: 15000 });
  const waitingState = await page.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.waiting?.state || null);
  const ctrlStillV1 = await queryControllerVersion(page, 4000);

  // Trigger skipWaiting and verify controllerchange + v2 controller version + retained v1 cache
  await page.evaluate(async () => {
    window.__swControllerChanges = 0;
    navigator.serviceWorker.addEventListener("controllerchange", () => { window.__swControllerChanges += 1; });
    const reg = await navigator.serviceWorker.getRegistration();
    reg.waiting.postMessage({ type: "skipWaiting" });
  });
  await page.waitForFunction(async () => {
    const reg = await navigator.serviceWorker.getRegistration();
    return window.__swControllerChanges >= 1 && !reg?.waiting && reg?.active?.state === "activated" && !!navigator.serviceWorker.controller;
  }, null, { timeout: 15000 });
  const ctrlV2 = await queryControllerVersion(page, 4000);
  const cachesList = await page.evaluate(async () => (await caches.keys()).filter((k) => k.startsWith("suipian-")).sort());

  const outcome = {
    browser: name,
    installed,
    ctrlV1,
    waitingState,
    ctrlStillV1,
    ctrlV2,
    cachesList,
  };
  console.log("SW_CAPABILITY_RESULT", JSON.stringify(outcome));

  if (installed !== "activated") throw new Error(`v1 expected activated, got ${installed}`);
  if (ctrlV1?.version !== "cap-v1" || ctrlV1?.cache !== "suipian-cap-v1") throw new Error(`v1 controller mismatch: ${JSON.stringify(ctrlV1)}`);
  if (waitingState !== "installed") throw new Error(`v2 expected waiting state installed, got ${waitingState}`);
  if (ctrlStillV1?.version !== "cap-v1") throw new Error(`v2 took over prematurely: ${JSON.stringify(ctrlStillV1)}`);
  if (ctrlV2?.version !== "cap-v2" || ctrlV2?.cache !== "suipian-cap-v2") throw new Error(`v2 controller mismatch after skipWaiting: ${JSON.stringify(ctrlV2)}`);
  if (!cachesList.includes("suipian-cap-v1") || !cachesList.includes("suipian-cap-v2")) throw new Error(`historical cache not retained: ${JSON.stringify(cachesList)}`);
} catch (e) {
  code = 1;
  console.error("SW_CAPABILITY_ASSERTION_FAILED", JSON.stringify({ browser: name, exitCode: 1, error: String(e.stack || e) }));
} finally {
  await ctx?.close().catch(() => {});
  await browser?.close().catch(() => {});
  await new Promise((r) => server.close(r));
}
process.exit(code);
