// Synthetic storage only. A failed read while adopting a clear epoch must not rebind old progress.
import test from "node:test";
import assert from "node:assert/strict";

let serial = 0;
class MemoryStorage {
  values = new Map();
  failLength = 0;
  failReadKey = null;
  get length() {
    if (this.failLength > 0) { this.failLength--; throw new Error("synthetic enumeration failure"); }
    return this.values.size;
  }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) {
    if (this.failReadKey === k) { this.failReadKey = null; throw new Error("synthetic ledger read failure"); }
    return this.values.get(k) ?? null;
  }
  setItem(k, v) { this.values.set(k, String(v)); }
  removeItem(k) { this.values.delete(k); }
}

async function scenario(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const storage = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  try {
    const id = ++serial;
    const A = await import(`../src/storage.js?clear-adoption=${id}-A`);
    const B = await import(`../src/storage.js?clear-adoption=${id}-B`);
    const old = A.loadState().state;
    old.onboarded = true;
    A.addXp(old, 50, "U1L1", true);
    old.done.U1L1 = true;
    A.addRun(old);
    assert.equal(A.saveState(old), true);
    const oldEpoch = A.stateEpoch(old);
    const fresh = B.clearState();
    assert.notEqual(fresh.clearFailed, true);
    fresh.onboarded = true;
    assert.equal(B.saveState(fresh), true);
    const newEpoch = B.stateEpoch(fresh);
    assert.notEqual(oldEpoch, newEpoch);
    const currentLedgerKey = [...storage.values].find(([k, raw]) => k.startsWith("suipian.v4.tab.") && JSON.parse(raw).epoch === newEpoch)?.[0];
    assert.ok(currentLedgerKey);
    const persisted = () => JSON.parse(B.guestRawV3(storage));
    assert.equal(persisted().xp, 0);
    await run({ A, B, storage, old, oldEpoch, newEpoch, currentLedgerKey, persisted });
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else delete globalThis.localStorage;
  }
}

function assertEmpty(state) {
  assert.equal(state.xp, 0);
  assert.equal(state.lessonsCompleted, 0);
  assert.deepEqual(state.done, {});
}

test("healthy clear adoption wins and repeated saves do not restore old progress", { concurrency: false }, async () => {
  await scenario(async ({ A, old, newEpoch, persisted }) => {
    assert.equal(A.saveState(old), false);
    assert.equal(A.getLastSaveStatus(), "cleared");
    assert.equal(A.stateEpoch(old), newEpoch);
    assertEmpty(old);
    assert.equal(A.saveState(old), true);
    assert.equal(A.saveState(old), true);
    assertEmpty(persisted());
  });
});

test("enumeration failure during save adoption preserves the old binding until retry", { concurrency: false }, async () => {
  await scenario(async ({ A, storage, old, oldEpoch, newEpoch, persisted }) => {
    storage.failLength = 1;
    assert.equal(A.saveState(old), false);
    assert.equal(A.getLastSaveStatus(), "failed");
    assert.equal(old.xp, 50);
    assert.equal(old.done.U1L1, true);
    assert.equal(A.stateEpoch(old), oldEpoch, "failed adoption must not bind old memory to the new epoch");
    assertEmpty(persisted());
    assert.equal(A.saveState(old), false);
    assert.equal(A.getLastSaveStatus(), "cleared");
    assert.equal(A.stateEpoch(old), newEpoch);
    assertEmpty(old);
    assert.equal(A.saveState(old), true);
    assertEmpty(persisted());
  });
});

test("ledger read failure during merge adoption cannot turn a later save into resurrection", { concurrency: false }, async () => {
  await scenario(async ({ A, storage, old, oldEpoch, newEpoch, currentLedgerKey, persisted }) => {
    storage.failReadKey = currentLedgerKey;
    assert.equal(A.syncFromStorage(old), false);
    assert.equal(old.xp, 50);
    assert.equal(A.stateEpoch(old), oldEpoch, "failed merge must keep the original ledger binding");
    assert.equal(A.saveState(old), false);
    assert.equal(A.getLastSaveStatus(), "cleared");
    assert.equal(A.stateEpoch(old), newEpoch);
    assertEmpty(old);
    assertEmpty(persisted());
  });
});

test("repeated failed adoption preserves pending old memory, then clear wins without duplicate XP", { concurrency: false }, async () => {
  await scenario(async ({ A, storage, old, oldEpoch, persisted }) => {
    A.addXp(old, 7, "OLD-PENDING", false);
    A.addRun(old);
    for (let i = 0; i < 2; i++) {
      storage.failLength = 1;
      assert.equal(A.saveState(old), false);
      assert.equal(old.xp, 57);
      assert.equal(old.lessonsCompleted, 2);
      assert.equal(A.stateEpoch(old), oldEpoch);
    }
    assert.equal(A.saveState(old), false);
    assert.equal(A.getLastSaveStatus(), "cleared");
    assertEmpty(old);
    for (let i = 0; i < 3; i++) assert.equal(A.saveState(old), true);
    assertEmpty(persisted());
  });
});

test("persisted new epoch stays empty after recovery even when adoption previously failed", { concurrency: false }, async () => {
  await scenario(async ({ A, storage, old, persisted }) => {
    storage.failLength = 1;
    assert.equal(A.saveState(old), false);
    // A user may try save again before any storage/visibility callback is delivered.
    A.saveState(old);
    assertEmpty(persisted());
  });
});
