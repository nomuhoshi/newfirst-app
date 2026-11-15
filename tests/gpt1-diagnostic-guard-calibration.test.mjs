// Run against the actual candidate source. No Playwright import or browser launch.
// Expected outcomes below are fixed; acceptance is evaluated by the candidate's own check() calls.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";

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
const helpers = arrowDeclaration("matchesStorageTriad") + "\n" + arrowDeclaration("matchesMemoryTriad");
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
function sampleT2({ throws = false, stale = false, returnValue = false, epochAfter = CLEARED } = {}) {
  const storage = new MemoryStorage({ "suipian.v4.epoch": CLEARED });
  let memory = { xp: 50, lessonsCompleted: 1, done: { U1L1: true } };
  return runCallback(t2Body, {
    Storage: MemoryStorage, localStorage: storage, document: { visibilityState: "hidden" },
    window: { __app: {
      getState: () => memory,
      persist() {
        if (throws) throw new Error("gpt1-synthetic-persist-error");
        if (!stale) memory = { xp: 0, lessonsCompleted: 0, done: {} };
        storage.setItem("suipian.v4.epoch", epochAfter);
        return returnValue;
      },
    } },
  });
}
function syntheticT1() {
  return {
    epochBeforeClear: "m0", epochAfterClear: CLEARED,
    baseKeyAfterClear: "suipian.v4.base." + CLEARED,
    rawBaseExists: true, parseError: null, rawBaseVersion: 4, rawBaseEpoch: CLEARED,
    rawBaseXp: 0, rawBaseRuns: 0, rawBaseDone: [], activeTabKeysAfterClear: [],
    tabBMemoryAfterClear: clone(EMPTY),
  };
}
async function evaluateGates(t2, observation = storageSnapshot(), t1 = syntheticT1(), preClearEpoch = "m0") {
  const checks = [];
  const sandbox = {
    EXPECTED_PRE_CLEAR: clone(OLD), EXPECTED_EMPTY: clone(EMPTY),
    t2ImmediateSave: t2, t1ClearAndRaw: t1, preClearEpoch,
    isControlled: true, track: "controlled-deferred-delivery", ctx: {},
    observeStaticStorage: async () => observation,
    check(name, ok, detail = "") { checks.push({ name: String(name), ok: ok === true, detail }); },
    checks,
  };
  await vm.runInNewContext(`${helpers}\n(async () => {${gateSource}\n})()`, sandbox, { timeout: 1000 });
  assert.ok(checks.some((c) => c.name.includes(" T2 ")), "no T2 assertions were executed");
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

test("negative: BrowserContext close failures must be observable and remain eligible for cleanup", async () => {
  const activeContexts = new Set();
  const ctx = { async close() { throw new Error("gpt1-synthetic-close-error"); } };
  activeContexts.add(ctx);
  const closeCtx = vm.runInNewContext(`${blockArrowDeclaration("closeCtx")}\ncloseCtx`, { activeContexts });
  await assert.rejects(() => closeCtx(ctx), /gpt1-synthetic-close-error/);
  assert.equal(activeContexts.has(ctx), true);
});
