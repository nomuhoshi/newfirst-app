// Residual checks for HEAD 08345537 and subsequent revisions. No browser launch.
// Execute the candidate's actual sampler, check() calls, and T3 classification.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { observeSuipianV4Storage } from "./lib/ledger-observer.mjs";

const sourcePath = resolve(process.env.DIAGNOSTIC_SOURCE || fileURLToPath(new URL("./progress-concurrency-diagnostic.test.mjs", import.meta.url)));
const source = readFileSync(sourcePath, "utf8");
const sha256 = createHash("sha256").update(source).digest("hex");
console.log("GPT1_RESIDUAL_SOURCE", JSON.stringify({ sourcePath, sha256 }));
const OLD = { xp: 50, runs: 1, done: ["U1L1"] };
const EMPTY = { xp: 0, runs: 0, done: [] };
const EPOCH = "c-gpt1-residual-clear";
const clone = (v) => JSON.parse(JSON.stringify(v));

function once(marker) {
  const i = source.indexOf(marker);
  assert.ok(i >= 0, "missing source anchor: " + marker);
  assert.equal(source.indexOf(marker, i + marker.length), -1, "ambiguous source anchor: " + marker);
  return i;
}
function declaration(name) {
  const start = once(`const ${name} =`);
  const end = source.indexOf(";\n", start);
  assert.ok(end > start, "missing declaration end: " + name);
  return source.slice(start, end + 1);
}
const helpers = ["matchesStorageTriad", "matchesMemoryTriad", "storageFromDump"].map(declaration).join("\n");
const callbackMarker = "const t2ImmediateSave = await tabA.evaluate(() => {";
const callbackStart = once(callbackMarker) + callbackMarker.length;
const callbackEnd = source.indexOf("\n    });", callbackStart);
assert.ok(callbackEnd > callbackStart, "missing T2 callback end");
const callbackBody = source.slice(callbackStart, callbackEnd);
const gateStart = callbackEnd + "\n    });".length;
const gateEnd = source.indexOf("    // 关闭 Tab B", gateStart);
assert.ok(gateEnd > gateStart, "missing T1/T2 gate boundary; review changed anchors explicitly");
const gateBody = source.slice(gateStart, gateEnd);
const lifecycleStart = once("    const observedHiddenToVisible =");
const lifecycleEnd = once("    // ---------- T4");
assert.ok(lifecycleEnd > lifecycleStart, "T3 classification must precede T4");
const lifecycleBody = source.slice(lifecycleStart, lifecycleEnd);

class MemoryStorage {
  constructor(records = {}) { this.values = new Map(Object.entries(records)); }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, String(v)); }
}
const emptyObservation = () => ({ ok: true, status: "OK", currentEpoch: EPOCH, ...clone(EMPTY) });
function t1Fixture() {
  return {
    epochBeforeClear: "m0", epochAfterClear: EPOCH,
    rawBaseExists: true, parseError: null, rawBaseVersion: 4, rawBaseEpoch: EPOCH,
    rawBaseXp: null, rawBaseRuns: null, rawBaseDone: [], activeTabKeysAfterClear: ["suipian.v4.tab.B"],
    tabBMemoryAfterClear: clone(EMPTY),
    v4Dump: {
      "suipian.v4.epoch": EPOCH,
      ["suipian.v4.base." + EPOCH]: JSON.stringify({ v: 4, epoch: EPOCH, s: {} }),
      "suipian.v4.tab.B": JSON.stringify({ v: 4, epoch: EPOCH, entries: { B: { xp: 0, runs: 0, firstXp: {}, done: {} } } }),
    },
  };
}

async function nativeVerdict({ before, returnValue, controlled = false }) {
  const storage = new MemoryStorage({ "suipian.v4.epoch": EPOCH });
  let state = { xp: before.xp, lessonsCompleted: before.runs, done: Object.fromEntries(before.done.map((id) => [id, true])) };
  const sample = vm.runInNewContext(`(() => {${callbackBody}\n})()`, {
    Storage: MemoryStorage, localStorage: storage, document: { visibilityState: "visible" },
    window: { __app: {
      getState: () => state,
      persist() { state = { xp: 0, lessonsCompleted: 0, done: {} }; return returnValue; },
    } },
  }, { timeout: 1000 });
  const checks = [];
  await vm.runInNewContext(helpers + `\n(async () => {${gateBody}\n})()`, {
    t2ImmediateSave: sample, t1ClearAndRaw: t1Fixture(), preClearEpoch: "m0",
    isControlled: controlled, track: controlled ? "controlled-deferred-delivery" : "native-unmodified", ctx: {},
    EXPECTED_PRE_CLEAR: clone(OLD), EXPECTED_EMPTY: clone(EMPTY), observeSuipianV4Storage,
    observeStaticStorage: async () => emptyObservation(),
    check(name, ok, detail = "") { checks.push({ name: String(name), ok: ok === true, detail }); },
  }, { timeout: 1000 });
  const t1 = checks.filter((c) => c.name.includes(" T1 "));
  assert.ok(t1.length > 0 && t1.every((c) => c.ok), "T1 fixture must be accepted; unrelated T1 failures cannot stand in for the T2 counterexample");
  const t2 = checks.filter((c) => c.name.includes(" T2 "));
  assert.ok(t2.length >= 2, "actual T2 checks were not fully reached");
  return { accepted: t2.every((c) => c.ok), sample, checks: t2 };
}
function nativeTest(name, input, expected) {
  test(name, async () => {
    const r = await nativeVerdict(input);
    console.log("GPT1_RESIDUAL_CASE", JSON.stringify({ name, expected, ...r }));
    assert.equal(r.accepted, expected, JSON.stringify(r, null, 2));
  });
}
nativeTest("positive: native healthy save after prior adoption returns true", { before: EMPTY, returnValue: true }, true);
nativeTest("negative: native false without an old-to-empty clear-conflict witness is rejected", { before: EMPTY, returnValue: false }, false);
nativeTest("positive: native explicit clear conflict may return false", { before: OLD, returnValue: false }, true);
nativeTest("positive: controlled explicit clear conflict may return false", { before: OLD, returnValue: false, controlled: true }, true);

function lifecycleVerdict(probe, memoryVisibility = "visible") {
  const checks = [], unverified = [];
  const result = vm.runInNewContext(helpers + `\n(() => {${lifecycleBody}\nreturn t3Lifecycle;})()`, {
    t3ProbeRaw: clone(probe), t3Memory: { ...clone(EMPTY), visibilityState: memoryVisibility },
    t3Obs: emptyObservation(), clearedEpoch: EPOCH, EXPECTED_EMPTY: clone(EMPTY), track: "native-unmodified",
    check(name, ok, detail = "") { checks.push({ name: String(name), ok: ok === true, detail }); },
    markUnverified(name, detail = "") { unverified.push({ name: String(name), detail }); },
  }, { timeout: 1000 });
  const storage = checks.filter((c) => c.name.includes("存储"));
  assert.ok(storage.length > 0 && storage.every((c) => c.ok), "storage fixture must stay healthy during the lifecycle counterexample");
  const lifecycleChecks = checks.filter((c) => c.name.includes("hidden→visible"));
  return { lifecycle: result, checks, unverified, passedLifecycleChecks: lifecycleChecks.filter((c) => c.ok).length };
}
function lifecycleTest(name, probe, expected, memoryVisibility = "visible") {
  test(name, () => {
    const r = lifecycleVerdict(probe, memoryVisibility);
    console.log("GPT1_RESIDUAL_CASE", JSON.stringify({ name, expected, probe, memoryVisibility, ...r }));
    if (expected) {
      assert.equal(r.lifecycle.status, "OBSERVED_HIDDEN_TO_VISIBLE");
      assert.equal(r.lifecycle.observedHiddenToVisible, true);
      assert.equal(r.passedLifecycleChecks, 1);
      assert.equal(r.unverified.length, 0);
    } else {
      assert.equal(r.lifecycle.status, "LIFECYCLE_EVIDENCE_NOT_OBTAINED", JSON.stringify(r, null, 2));
      assert.equal(r.lifecycle.observedHiddenToVisible, false);
      assert.equal(r.passedLifecycleChecks, 0, "T3 must not acquire a pass without in-window evidence");
      assert.equal(r.unverified.length, 1);
    }
  });
}
// The probe window starts when its listeners are installed and ends at finish().
// visibilityAfter belongs to that window; memoryVisibility is read later and cannot fill a missing event.
lifecycleTest("positive: ordered hidden then visible inside the probe window", { visibilityBefore: "visible", transitions: ["hidden", "visible"], visibilityAfter: "visible" }, true);
lifecycleTest("positive: initially hidden with a visible event inside the window", { visibilityBefore: "hidden", transitions: ["visible"], visibilityAfter: "visible" }, true);
lifecycleTest("negative: hidden event without any visible event is unverified", { visibilityBefore: "visible", transitions: ["hidden"], visibilityAfter: "hidden" }, false);
lifecycleTest("negative: visible then hidden is the wrong conversion order", { visibilityBefore: "visible", transitions: ["visible", "hidden"], visibilityAfter: "hidden" }, false);
lifecycleTest("negative: a conversion completed before the probe window is not T3 evidence", { visibilityBefore: "visible", transitions: [], visibilityAfter: "visible" }, false);
lifecycleTest("negative: visible only after probe finish is outside the window", { visibilityBefore: "hidden", transitions: [], visibilityAfter: "hidden" }, false);
lifecycleTest("negative: always-visible probe has no conversion evidence", { visibilityBefore: "visible", transitions: [], visibilityAfter: "visible" }, false);
lifecycleTest("negative: missing probe is unverified", null, false);

// Strict requirement: after the observed conversion the probe must not return to hidden, even if it later becomes visible again.
lifecycleTest("negative: hidden after an accepted conversion permanently invalidates this probe window", { visibilityBefore: "visible", transitions: ["hidden", "visible", "hidden", "visible"], visibilityAfter: "visible" }, false);
