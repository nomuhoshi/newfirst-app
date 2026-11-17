// Run against the actual candidate source. No Playwright import or browser launch.
// Expected outcomes below are fixed; acceptance is evaluated by the candidate's own check() calls.
// 程序员 sonnet2 于 2026-11-15 在 GPT1 校准包原件（SHA256 937f50c6…）基础上的改动，仅为适配 T1 改用已审观察器判定：
//   1. 引入 tests/lib/ledger-observer.mjs 的 observeSuipianV4Storage，并把它与 storageFromDump 注入 T1/T2 断言的 VM 沙箱；
//   2. syntheticT1 改成真实格式（base.s={}、本代空进度账本，rawBaseXp/Runs 为 null），并带固定常量转存夹具；
//   3. 新增 T1 用例：基线缺失 / 基线损坏 / 本代账本带进度 / epoch 对不上 / 没有转存 必须拒绝；旧代账本里的进度应被忽略。
// 原有 9 项的断言与期望一字未动。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { observeSuipianV4Storage } from "./lib/ledger-observer.mjs";

const sourcePath = resolve(process.env.DIAGNOSTIC_SOURCE || fileURLToPath(new URL("./progress-concurrency-diagnostic.test.mjs", import.meta.url)));
const storagePath = resolve(process.env.DIAGNOSTIC_STORAGE_SOURCE || fileURLToPath(new URL("../src/storage.js", import.meta.url)));
const appPath = resolve(process.env.DIAGNOSTIC_APP_SOURCE || fileURLToPath(new URL("../src/app.js", import.meta.url)));
const source = readFileSync(sourcePath, "utf8");
const digest = (s) => createHash("sha256").update(s).digest("hex");
console.log("GPT1_GUARD_CALIBRATION_SOURCE", JSON.stringify({ sourcePath, sha256: digest(source), storagePath, appPath }));

function once(text, marker) {
  const i = text.indexOf(marker);
  assert.ok(i >= 0, `source anchor missing: ${marker}`);
  assert.equal(text.indexOf(marker, i + marker.length), -1, `source anchor is ambiguous: ${marker}`);
  return i;
}
function callback(variable) {
  const marker = `const ${variable} = await tab${variable === "t1ClearAndRaw" ? "B" : "A"}.evaluate(() => {`;
  const start = once(source, marker) + marker.length;
  const end = source.indexOf("\n    });", start);
  assert.ok(end > start, `callback terminator missing: ${variable}`);
  return source.slice(start, end);
}
function arrowDeclaration(name) {
  const start = once(source, `const ${name} =`);
  const end = source.indexOf(";\n", start);
  assert.ok(end > start, `declaration terminator missing: ${name}`);
  return source.slice(start, end + 1);
}
function blockArrowDeclaration(name) {
  const start = once(source, `const ${name} =`);
  const end = source.indexOf("\n};", start);
  assert.ok(end > start, `block declaration terminator missing: ${name}`);
  return source.slice(start, end + 3);
}

const t2Body = callback("t2ImmediateSave");
const t2Marker = "const t2ImmediateSave = await tabA.evaluate(() => {";
const t2End = source.indexOf("\n    });", once(source, t2Marker) + t2Marker.length) + "\n    });".length;
const checksEnd = source.indexOf("    // 关闭 Tab B", t2End);
assert.ok(checksEnd > t2End, "T1/T2 assertion boundary missing; update the extractor explicitly instead of skipping");
const gateSource = source.slice(t2End, checksEnd);
assert.ok(gateSource.includes("check("), "actual assertion block is empty");
const helpers = arrowDeclaration("matchesStorageTriad") + "\n" + arrowDeclaration("matchesMemoryTriad") + "\n" + arrowDeclaration("storageFromDump");
const EMPTY = { xp: 0, runs: 0, done: [] };
const OLD = { xp: 50, runs: 1, done: ["U1L1"] };
const CLEARED = "c-gpt1-fixed-clear";
const clone = (v) => JSON.parse(JSON.stringify(v));
const storageSnapshot = (extra = {}) => ({ ok: true, status: "OK", currentEpoch: CLEARED, ...clone(EMPTY), ...extra });

class MemoryStorage {
  constructor(records = {}) { this.values = new Map(Object.entries(records)); }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, String(v)); }
  removeItem(k) { this.values.delete(k); }
  clear() { this.values.clear(); }
}

function runCallback(body, globals) {
  return vm.runInNewContext(`(() => {${body}\n})()`, globals, { timeout: 1000 });
}
// epochVisible=false：旧页读到的还是旧代数（本机存储里没有 suipian.v4.epoch = m0），这时它不可能知道发生过清除：persist() 返回 true、内存仍是旧进度、代数保持 m0
function sampleT2({ throws = false, stale = false, returnValue = false, epochAfter = CLEARED, epochVisible = true } = {}) {
  const storage = new MemoryStorage(epochVisible ? { "suipian.v4.epoch": CLEARED } : {});
  let memory = { xp: 50, lessonsCompleted: 1, done: { U1L1: true } };
  return runCallback(t2Body, {
    Storage: MemoryStorage, localStorage: storage, document: { visibilityState: "hidden" },
    window: { __app: {
      getState: () => memory,
      persist() {
        if (throws) throw new Error("gpt1-synthetic-persist-error");
        if (!epochVisible) return true; // 看不到清除：保存成功，内存与代数都不变
        if (!stale) memory = { xp: 0, lessonsCompleted: 0, done: {} };
        storage.setItem("suipian.v4.epoch", epochAfter);
        return returnValue;
      },
    } },
  });
}
// 固定常量夹具（与真实 clearOn / saveState 输出同形，但不由产品函数计算）：base.s={}；本代只有 Tab B 的空进度账本
const emptyLedger = (epoch, id = "B") => JSON.stringify({ v: 4, epoch, entries: { [id]: { xp: 0, runs: 0, firstXp: {}, done: {}, doneOn: {}, lastDay: null, streak: 0, meta: { t: 1, onboarded: true } } } });
const syntheticDump = (epoch = CLEARED) => ({
  "suipian.v4.epoch": epoch,
  ["suipian.v4.base." + epoch]: JSON.stringify({ v: 4, epoch, s: {}, legacyXp: 0, legacyRuns: 0, ignoreLegacy: true }),
  "suipian.v4.tab.B": emptyLedger(epoch),
});
function syntheticT1(dump = syntheticDump()) {
  return {
    epochBeforeClear: "m0", epochAfterClear: CLEARED,
    baseKeyAfterClear: "suipian.v4.base." + CLEARED,
    rawBaseExists: true, parseError: null, rawBaseVersion: 4, rawBaseEpoch: CLEARED,
    rawBaseXp: null, rawBaseRuns: null, rawBaseDone: [], activeTabKeysAfterClear: ["suipian.v4.tab.B"],
    tabBMemoryAfterClear: clone(EMPTY),
    v4Dump: dump,
  };
}
async function evaluateGates(t2, observation = storageSnapshot(), t1 = syntheticT1(), preClearEpoch = "m0", { waitForEpoch = false } = {}) {
  const checks = [];
  const unverifiedNames = [];
  const sandbox = {
    EXPECTED_PRE_CLEAR: clone(OLD), EXPECTED_EMPTY: clone(EMPTY),
    t2ImmediateSave: t2, t1ClearAndRaw: t1, preClearEpoch,
    isControlled: true, track: "controlled-deferred-delivery", ctx: {}, waitForEpoch,
    markUnverified(name, detail = "") { unverifiedNames.push(String(name)); },
    observeStaticStorage: async () => observation,
    observeSuipianV4Storage,
    check(name, ok, detail = "") { checks.push({ name: String(name), ok: ok === true, detail }); },
    checks,
  };
  await vm.runInNewContext(`${helpers}\n(async () => {${gateSource}\n})()`, sandbox, { timeout: 1000 });
  assert.ok(checks.some((c) => c.name.includes(" T2 ")), "no T2 assertions were executed");
  checks.unverifiedNames = unverifiedNames;
  return checks;
}
function assertVerdict(checks, phase, expected, evidence) {
  const relevant = checks.filter((c) => c.name.includes(` ${phase} `));
  assert.ok(relevant.length > 0, `no actual ${phase} assertions were evaluated`);
  const accepted = relevant.every((c) => c.ok);
  console.log("GPT1_GUARD_CASE", JSON.stringify({ phase, expectedAccept: expected, actualAccept: accepted, evidence, checks: relevant }));
  assert.equal(accepted, expected, JSON.stringify({ evidence, checks: relevant }, null, 2));
}

test("positive: a healthy immediate clear-conflict save is accepted", async () => {
  const t2 = sampleT2();
  assert.equal(t2.persistError, null);
  assert.equal(t2.persistRet, false); // clear won; this is a valid boolean result.
  assert.equal(t2.postMem.xp, 0);
  assertVerdict(await evaluateGates(t2), "T2", true, t2);
});

test("immediate track: old page still sees the OLD epoch -> STALE_EPOCH_NOT_VISIBLE is reported as unverified, never as a T2 pass", async () => {
  const t2 = sampleT2({ epochVisible: false });
  assert.equal(t2.storageEpochBeforeSave, "m0");
  assert.equal(t2.persistRet, true);
  assert.equal(t2.postMem.xp, 50);
  const checks = await evaluateGates(t2);
  assert.equal(checks.unverifiedNames.length, 1, JSON.stringify(checks.unverifiedNames));
  assert.match(checks.unverifiedNames[0], /STALE_EPOCH_NOT_VISIBLE/);
  // 没有任何一条“T2 persist() 返回契约 / 收敛”断言通过：只有安全不变量（不抛错、返回布尔值）和新代数存储为空
  assert.equal(checks.some((c) => c.ok && c.name.includes("返回契约")), false, JSON.stringify(checks));
  assert.ok(checks.filter((c) => c.name.includes(" T2 ")).every((c) => c.ok), "safety invariants and new-epoch storage emptiness must hold");
});

test("immediate track: STALE_EPOCH_NOT_VISIBLE with old progress leaked into the new epoch must fail", async () => {
  const t2 = sampleT2({ epochVisible: false });
  const leaked = storageSnapshot({ xp: 50, runs: 1, done: ["U1L1"] });
  assertVerdict(await evaluateGates(t2, leaked), "T2", false, { t2, leaked });
});

test("immediate track: STALE_EPOCH_NOT_VISIBLE with a throwing persist must fail", async () => {
  const t2 = sampleT2({ epochVisible: false, throws: true });
  assertVerdict(await evaluateGates(t2), "T2", false, t2);
});

test("wait track: old page that never saw the new epoch must FAIL the strict T2 contract (no unverified escape hatch)", async () => {
  const t2 = sampleT2({ epochVisible: false });
  const checks = await evaluateGates(t2, storageSnapshot(), syntheticT1(), "m0", { waitForEpoch: true });
  assert.equal(checks.unverifiedNames.length, 0);
  assertVerdict(checks, "T2", false, t2);
});

test("negative: persist throwing must fail even when persisted progress is empty", async () => {
  const t2 = sampleT2({ throws: true });
  assert.match(t2.persistError, /gpt1-synthetic-persist-error/);
  assertVerdict(await evaluateGates(t2), "T2", false, t2);
});

test("negative: an empty snapshot from another epoch must fail", async () => {
  const t2 = sampleT2();
  const observation = storageSnapshot({ currentEpoch: "c-gpt1-wrong-generation" });
  assertVerdict(await evaluateGates(t2, observation), "T2", false, { t2, observation });
});

test("negative: stale immediate post-save memory must fail before later notifications can repair it", async () => {
  const t2 = sampleT2({ stale: true });
  assert.equal(t2.persistError, null);
  assert.equal(t2.persistRet, false);
  assert.equal(t2.postMem.xp, 50);
  assertVerdict(await evaluateGates(t2), "T2", false, t2);
});

test("negative: an epoch change during persist must fail", async () => {
  const t2 = sampleT2({ epochAfter: "c-gpt1-second-clear" });
  assertVerdict(await evaluateGates(t2), "T2", false, t2);
});

test("negative: observer read failure must not be accepted as an empty snapshot", async () => {
  const observation = { ok: false, status: "READ_ERROR", xp: null, runs: null, done: null };
  assertVerdict(await evaluateGates(sampleT2(), observation), "T2", false, observation);
});

test("negative: a non-boolean persist return value must fail", async () => {
  const t2 = sampleT2({ returnValue: "saved" });
  assertVerdict(await evaluateGates(t2), "T2", false, t2);
});

test("positive: T1 accepts canonical data emitted by real storage.js and real app clearProgress/persist", { concurrency: false }, async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    const st = await import(pathToFileURL(storagePath).href + "?gpt1-guard-positive");
    const appSource = readFileSync(appPath, "utf8");
    const persistStart = once(appSource, "function persist() {");
    const clearStart = once(appSource, "function clearProgress() {");
    const clearEnd = appSource.indexOf("\n", clearStart);
    assert.ok(clearStart > persistStart && clearEnd > clearStart, "production fixture anchors changed");
    const functions = appSource.slice(persistStart, clearEnd);
    const state = st.loadState().state;
    state.onboarded = true;
    st.addXp(state, 50, "U1L1", true); state.done.U1L1 = true; st.addRun(state);
    assert.equal(st.saveState(state), true);
    const appGlobals = {
      state, sync: null, saveState: st.saveState, clearState: st.clearState,
      getLastSaveStatus: st.getLastSaveStatus, stateEpoch: st.stateEpoch,
      showToast() {}, ensureBackupBase() {}, CLEARED_MSG_SHORT: "fixture-clear-won",
    };
    const appContext = vm.createContext(appGlobals);
    const clearProgress = vm.runInContext(`${functions}\nclearProgress`, appContext, { timeout: 1000 });
    const t1 = runCallback(callback("t1ClearAndRaw"), {
      Storage: MemoryStorage, localStorage: storage,
      window: { __app: { clearProgress, getState: () => appGlobals.state } },
    });
    // Fixed expected semantic result; no production merger is used to calculate the expected values.
    assert.equal(appGlobals.state.xp, 0);
    assert.equal(appGlobals.state.lessonsCompleted, 0);
    assert.deepEqual(Object.keys(appGlobals.state.done), []);
    const t2 = sampleT2();
    t2.storageEpochBeforeSave = t1.epochAfterClear;
    t2.storageEpochAfterSave = t1.epochAfterClear;
    t2.storageEpochBefore = t1.epochAfterClear;
    t2.storageEpochAfter = t1.epochAfterClear;
    const observation = storageSnapshot({ currentEpoch: t1.epochAfterClear });
    assertVerdict(await evaluateGates(t2, observation, t1), "T1", true, {
      t1, base: JSON.parse(storage.getItem(t1.baseKeyAfterClear)),
      storageSha256: digest(readFileSync(storagePath)), appSha256: digest(appSource),
    });
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

// ---- T1 判定（程序员 sonnet2 新增）：本代有效进度由已审观察器判定；期望值均为固定常量 ----
const progressLedger = (epoch) => JSON.stringify({ v: 4, epoch, entries: { B: { xp: 50, runs: 1, firstXp: { U1L1: 50 }, done: { U1L1: true }, doneOn: {}, lastDay: null, streak: 0, meta: null } } });
const t1Verdict = async (t1, expected, label) => assertVerdict(await evaluateGates(sampleT2(), storageSnapshot(), t1), "T1", expected, { label, t1 });

test("positive: T1 accepts the canonical empty clear (base.s={} plus the legitimate empty active ledger)", async () => {
  const t1 = syntheticT1();
  assert.deepEqual(JSON.parse(t1.v4Dump["suipian.v4.base." + CLEARED]).s, {});
  assert.equal(t1.rawBaseXp, null);
  assert.equal(t1.activeTabKeysAfterClear.length, 1);
  await t1Verdict(t1, true, "canonical");
});

test("positive: T1 ignores progress that only exists in an old-epoch ledger", async () => {
  const dump = syntheticDump();
  dump["suipian.v4.tab.A"] = progressLedger("m0");
  await t1Verdict(syntheticT1(dump), true, "old-epoch ledger ignored");
});

test("negative: T1 must reject a missing base even when the raw flags look fine", async () => {
  const dump = syntheticDump();
  delete dump["suipian.v4.base." + CLEARED];
  await t1Verdict(syntheticT1(dump), false, "base missing");
});

test("negative: T1 must reject a corrupt base", async () => {
  const dump = syntheticDump();
  dump["suipian.v4.base." + CLEARED] = "{not json";
  await t1Verdict(syntheticT1(dump), false, "base corrupt");
});

test("negative: T1 must reject progress still carried by the base", async () => {
  const dump = syntheticDump();
  dump["suipian.v4.base." + CLEARED] = JSON.stringify({ v: 4, epoch: CLEARED, s: { xp: 50, lessonsCompleted: 1, done: { U1L1: true } } });
  await t1Verdict(syntheticT1(dump), false, "base carries progress");
});

test("negative: T1 must reject progress in an active (cleared-epoch) ledger", async () => {
  const dump = syntheticDump();
  dump["suipian.v4.tab.B"] = progressLedger(CLEARED);
  await t1Verdict(syntheticT1(dump), false, "active ledger carries progress");
});

test("negative: T1 must reject a dump whose epoch pointer is another generation", async () => {
  await t1Verdict(syntheticT1(syntheticDump("c-gpt1-second-clear")), false, "pointer on another generation");
});

test("negative: T1 must reject a missing raw dump instead of treating it as empty", async () => {
  const t1 = syntheticT1();
  delete t1.v4Dump;
  await t1Verdict(t1, false, "no dump");
});

test("negative: BrowserContext close failures must be observable and remain eligible for cleanup", async () => {
  const activeContexts = new Set();
  const ctx = { async close() { throw new Error("gpt1-synthetic-close-error"); } };
  activeContexts.add(ctx);
  const closeCtx = vm.runInNewContext(`${blockArrowDeclaration("closeCtx")}\ncloseCtx`, { activeContexts });
  await assert.rejects(() => closeCtx(ctx), /gpt1-synthetic-close-error/);
  assert.equal(activeContexts.has(ctx), true);
});

// ---- 收尾块整体行为（程序员 sonnet2 新增）：执行候选源码里真实的 finally 块与清理断言 ----
function cleanupBlock() {
  const start = once(source, "\n} finally {\n") + 1;
  const end = source.indexOf("\nconsole.log(\n  fail", start);
  assert.ok(end > start, "cleanup block terminator missing; update the extractor explicitly instead of skipping");
  const block = source.slice(start, end);
  assert.ok(block.includes("check("), "actual cleanup assertion is missing");
  return block;
}
async function runCleanup({ closeFails = false, serverFails = false, rmFails = false } = {}) {
  const calls = { serverClosed: 0, removed: [] };
  const checks = [];
  const failing = { async close() { throw new Error("gpt1-synthetic-close-error"); } };
  const healthy = { async close() {} };
  const activeContexts = new Set(closeFails ? [failing, healthy] : [healthy]);
  const sandbox = {
    BNAME: "chromium", console: { log() {} }, activeContexts,
    srv: { listening: true, close(cb) { calls.serverClosed += 1; cb(serverFails ? new Error("gpt1-synthetic-server-error") : undefined); } },
    dirs: ["/tmp/gpt1-dir-1", "/tmp/gpt1-dir-2"],
    rmSync(d) { calls.removed.push(d); if (rmFails) throw new Error("gpt1-synthetic-rm-error"); },
    check(name, ok, detail = "") { checks.push({ name: String(name), ok: ok === true, detail }); },
  };
  const prelude = [arrowDeclaration("cleanupErrors"), blockArrowDeclaration("cleanupFailure"), blockArrowDeclaration("closeCtx")].join("\n");
  const failures = await vm.runInNewContext(`${prelude}\n(async () => { try {\n${cleanupBlock()}\n})().then(() => cleanupErrors.length)`, sandbox, { timeout: 1000 });
  assert.equal(checks.length, 1, "exactly one cleanup assertion must run");
  return { failures, calls, checks, activeContexts, failing };
}

test("positive: a healthy cleanup closes contexts, stops the server, removes every temp dir and passes", async () => {
  const r = await runCleanup();
  assert.equal(r.failures, 0);
  assert.equal(r.activeContexts.size, 0);
  assert.equal(r.calls.serverClosed, 1);
  assert.equal(r.calls.removed.length, 2);
  assert.equal(r.checks[0].ok, true);
});

test("negative: a failed context close is recorded, keeps its reference, cleans everything else and fails the run", async () => {
  const r = await runCleanup({ closeFails: true });
  assert.equal(r.failures, 1);
  assert.equal(r.activeContexts.has(r.failing), true);
  assert.equal(r.activeContexts.size, 1);
  assert.equal(r.calls.serverClosed, 1);
  assert.equal(r.calls.removed.length, 2);
  assert.equal(r.checks[0].ok, false);
});

test("negative: server stop and temp dir failures are recorded, do not stop the remaining cleanup and fail the run", async () => {
  const server = await runCleanup({ serverFails: true });
  assert.equal(server.failures, 1);
  assert.equal(server.calls.removed.length, 2);
  assert.equal(server.checks[0].ok, false);
  const dirs = await runCleanup({ rmFails: true });
  assert.equal(dirs.failures, 2);
  assert.equal(dirs.calls.serverClosed, 1);
  assert.equal(dirs.checks[0].ok, false);
});
