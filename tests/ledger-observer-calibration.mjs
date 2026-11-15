// Canonical-format controls for the independent diagnostic observer.
// No browser, backend, real account or real browser profile is used.
import test from "node:test";
import assert from "node:assert/strict";
import { observeSuipianV4Storage as observe } from "./lib/ledger-observer.mjs";

class MemoryStorage {
  constructor(records = {}) { this.values = new Map(Object.entries(records)); this.writes = 0; }
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { return this.values.get(k) ?? null; }
  setItem(k, v) { this.writes++; this.values.set(k, String(v)); }
  removeItem(k) { this.writes++; this.values.delete(k); }
  clear() { this.writes++; this.values.clear(); }
}
const base = (epoch, s = {}) => JSON.stringify({ v: 4, epoch, s });
const ledger = (epoch, entries) => JSON.stringify({ v: 4, epoch, entries });
function fixture(epoch = "m0", state = {}, extra = {}) {
  return new MemoryStorage({
    ...(epoch === "m0" ? {} : { "suipian.v4.epoch": epoch }),
    ["suipian.v4.base." + epoch]: base(epoch, state), ...extra,
  });
}
function readUnchanged(storage) {
  const before = [...storage.values], writes = storage.writes;
  const result = observe(storage);
  assert.equal(storage.writes, writes, "the observer must not write or delete");
  assert.deepEqual([...storage.values], before, "the observer must not change stored bytes");
  return result;
}
function expectProgress(result, xp, runs, done) {
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.xp, xp);
  assert.equal(result.runs, runs);
  assert.deepEqual(result.done, done);
}
function expectFailure(result, status) {
  assert.equal(result.ok, false);
  assert.equal(result.status, status);
  assert.equal(result.xp, null);
  assert.equal(result.runs, null);
  assert.equal(result.done, null);
}

test("m0: an actual page entry contains firstXp/done maps and reports 50/1/U1L1", () => {
  const s = fixture("m0", {}, {
    "suipian.v4.tab.a": ledger("m0", { a: { xp: 0, runs: 1, firstXp: { U1L1: 50 }, done: { U1L1: true } } }),
  });
  const r = readUnchanged(s);
  expectProgress(r, 50, 1, ["U1L1"]);
  assert.equal(r.currentEpoch, "m0");
});

test("real storage.js output is readable without calling the production merger as an oracle", { concurrency: false }, async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const s = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: s });
  try {
    const st = await import("../src/storage.js?observer-real-fixture");
    const state = st.loadState().state;
    state.onboarded = true;
    st.addXp(state, 50, "U1L1", true); state.done.U1L1 = true; st.addRun(state);
    assert.equal(st.saveState(state), true);
    // Expected values are independent constants; neither computeView nor guestRawV3 is called for the assertion.
    expectProgress(readUnchanged(s), 50, 1, ["U1L1"]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});

test("non-empty epoch-specific base is counted and suppresses an already-completed first reward", () => {
  const s = fixture("c-base", { xp: 80, lessonsCompleted: 2, done: { U1L1: true, U1L2: true } }, {
    "suipian.v4.tab.a": ledger("c-base", { a: { xp: 2, runs: 1, firstXp: { U1L1: 999, U1L3: 20 }, done: { U1L3: true } } }),
  });
  expectProgress(readUnchanged(s), 102, 3, ["U1L1", "U1L2", "U1L3"]);
});

test("duplicate page IDs merge maxima and union maps, rather than retaining the first record", () => {
  const s = fixture("c-duplicate", { xp: 50, lessonsCompleted: 1, done: { U1L1: true } }, {
    "suipian.v4.tab.a": ledger("c-duplicate", { shared: { xp: 10, runs: 1, firstXp: { U1L2: 30 }, done: { U1L2: true } } }),
    "suipian.v4.tab.pool": ledger("c-duplicate", { shared: { xp: 25, runs: 2, firstXp: { U1L2: 40 }, done: { U1L3: true } } }),
  });
  const r = readUnchanged(s);
  expectProgress(r, 115, 3, ["U1L1", "U1L2", "U1L3"]);
  assert.deepEqual(r.duplicateEntryIds, ["shared"]);
});

test("distinct page IDs sum ordinary XP/runs but share the maximum first reward", () => {
  const s = fixture("m0", {}, {
    "suipian.v4.tab.a": ledger("m0", { a: { xp: 7, runs: 1, firstXp: { U1L1: 50 }, done: { U1L1: true } } }),
    "suipian.v4.tab.b": ledger("m0", { b: { xp: 3, runs: 1, firstXp: { U1L1: 60 }, done: { U1L1: true } } }),
  });
  expectProgress(readUnchanged(s), 70, 2, ["U1L1"]);
});

test("cleared generation ignores old base, old ledgers and the legacy mirror", () => {
  const s = fixture("c-cleared", {}, {
    "suipian.v4.base.m0": base("m0", { xp: 80, lessonsCompleted: 2, done: { U1L1: true } }),
    "suipian.v4.tab.old": ledger("m0", { a: { xp: 999, runs: 9, firstXp: { U1L2: 50 }, done: { U1L2: true } } }),
    "suipian.progress": JSON.stringify({ version: 3, xp: 9999, done: { U1L3: true } }),
  });
  expectProgress(readUnchanged(s), 0, 0, []);
});

test("missing base, unknown versions, wrong epoch, malformed JSON/maps are never reported as empty", () => {
  expectFailure(readUnchanged(new MemoryStorage()), "MISSING_BASE");
  const invalidBases = [
    JSON.stringify({ v: 999, epoch: "m0", s: {} }),
    JSON.stringify({ v: 4, epoch: "wrong", s: {} }),
    JSON.stringify({ v: 4, epoch: "m0" }), "{broken",
  ];
  for (const raw of invalidBases) expectFailure(readUnchanged(new MemoryStorage({ "suipian.v4.base.m0": raw })), "CORRUPT_STORAGE");
  const invalidLedgers = [
    JSON.stringify({ v: 999, epoch: "m0", entries: {} }),
    JSON.stringify({ v: 4, epoch: "m0", entries: [] }),
    ledger("m0", { a: { firstXp: [] } }),
    ledger("m0", { a: { done: true } }), "{broken",
  ];
  for (const raw of invalidLedgers) expectFailure(readUnchanged(fixture("m0", {}, { "suipian.v4.tab.bad": raw })), "CORRUPT_STORAGE");
});

test("read/enumeration failures and an external epoch change fail explicitly without observer writes", () => {
  const denied = fixture();
  denied.getItem = () => { throw new Error("synthetic-read-denied"); };
  expectFailure(readUnchanged(denied), "READ_ERROR");
  const enumeration = fixture();
  enumeration.key = () => { throw new Error("synthetic-enumeration-denied"); };
  expectFailure(readUnchanged(enumeration), "READ_ERROR");
  const lengthFailure = fixture();
  Object.defineProperty(lengthFailure, "length", { get() { throw new Error("synthetic-length-denied"); } });
  expectFailure(readUnchanged(lengthFailure), "READ_ERROR");
  const torn = fixture(); const rawGet = torn.getItem.bind(torn); let epochReads = 0;
  torn.getItem = (key) => {
    if (key === "suipian.v4.epoch" && ++epochReads === 2) torn.values.set(key, "c-external-clear");
    return rawGet(key);
  };
  expectFailure(observe(torn), "EPOCH_CHANGED_DURING_READ");
  assert.equal(torn.writes, 0, "only the external fixture hook changes the epoch");
});

test("a throwing default localStorage getter returns READ_ERROR; explicit storage bypasses the getter", { concurrency: false }, () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  try {
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() { throw new Error("synthetic-default-storage-denied"); },
    });
    expectFailure(observe(), "READ_ERROR");
    expectProgress(readUnchanged(fixture()), 0, 0, []);
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
});
