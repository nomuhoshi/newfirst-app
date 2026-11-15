// 纯 Node 观察器校准脚本（无浏览器依赖）
// 覆盖：缺省 epoch(m0) 下 XP50/次数1/U1L1、清除后为空、非空基线 suipian.v4.base.<epoch>(XP80)、
//       多账本与重复 ID 合并取最大（不跳过后续条目）、firstXp 按关卡索引对象、旧代隔离、
//       非法结构报错、读取失败(READ_ERROR)、观察期间换代(EPOCH_CHANGED_DURING_READ)、以及观察前后存储零变更
// 运行：node tests/ledger-observer-calibration.mjs
import assert from "node:assert/strict";
import { observeSuipianV4Storage } from "./lib/ledger-observer.mjs";

function createMockStorage(initial = {}) {
  const map = new Map(Object.entries(initial).map(([k, v]) => [String(k), String(v)]));
  let mutations = 0;
  let onGetItemHook = null;
  const storage = {
    get length() {
      return map.size;
    },
    key(i) {
      return [...map.keys()][i] ?? null;
    },
    getItem(k) {
      const key = String(k);
      if (typeof onGetItemHook === "function") {
        onGetItemHook(key, map);
      }
      return map.has(key) ? map.get(key) : null;
    },
    setItem(k, v) {
      mutations += 1;
      map.set(String(k), String(v));
    },
    removeItem(k) {
      mutations += 1;
      map.delete(String(k));
    },
    clear() {
      mutations += 1;
      map.clear();
    },
    _snapshot() {
      return Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b)));
    },
    _getMutations() {
      return mutations;
    },
    _setGetItemHook(fn) {
      onGetItemHook = fn;
    },
  };
  return storage;
}

function observeAndAssertImmutable(storage, label) {
  const beforeSnap = storage._snapshot();
  const beforeMut = storage._getMutations();
  const res = observeSuipianV4Storage(storage);
  const afterSnap = storage._snapshot();
  const afterMut = storage._getMutations();
  assert.equal(afterMut, beforeMut, `[${label}] 观察器不得调用任何写/删存储操作`);
  assert.deepEqual(afterSnap, beforeSnap, `[${label}] 观察前后存储内容必须完全一致`);
  return res;
}

let passed = 0;
const step = (name, fn) => {
  fn();
  passed += 1;
  console.log(`✅ [Node 校准] ${name}`);
};

// 1. 缺省 epoch = m0，准确读出 XP50、次数1、U1L1
step("1. epoch 缺省为 m0，准确读出 XP50、次数1、U1L1", () => {
  const st = createMockStorage({
    "suipian.v4.tab.tab1": JSON.stringify({
      epoch: "m0",
      firstXp: { U1L1: 50 },
      entries: {
        "run-1": { type: "run", lesson: "U1L1" },
        "done-1": { type: "done", lesson: "U1L1" },
      },
    }),
  });
  const res = observeAndAssertImmutable(st, "default-m0-xp50");
  assert.equal(res.ok, true);
  assert.equal(res.currentEpoch, "m0");
  assert.equal(res.epochSource, "default-m0");
  assert.equal(res.xp, 50);
  assert.equal(res.runs, 1);
  assert.deepEqual(res.done, ["U1L1"]);
});

// 2. 清除换代后当前代为空，旧代 m0 被隔离
step("2. 清除换代至 m1 后当前代为空记录，旧代 m0 隔离", () => {
  const st = createMockStorage({
    "suipian.v4.epoch": "m1",
    "suipian.v4.tab.tab1": JSON.stringify({
      epoch: "m0",
      firstXp: { U1L1: 50 },
      entries: { "run-1": { type: "run" }, "done-1": { type: "done", lesson: "U1L1" } },
    }),
    "suipian.v4.tab.tab2": JSON.stringify({
      epoch: "m1",
      firstXp: {},
      entries: {},
    }),
  });
  const res = observeAndAssertImmutable(st, "cleared-m1");
  assert.equal(res.ok, true);
  assert.equal(res.currentEpoch, "m1");
  assert.equal(res.xp, 0);
  assert.equal(res.runs, 0);
  assert.deepEqual(res.done, []);
  assert.deepEqual(res.ignoredOldEpochKeys, [{ key: "suipian.v4.tab.tab1", epoch: "m0" }]);
});

// 3. 非空基线 suipian.v4.base.<epoch>（XP80、次数2、U1L1+U1L2）
step("3. 非空基线 suipian.v4.base.m1 准确读出 XP80、次数2、U1L1+U1L2", () => {
  const st = createMockStorage({
    "suipian.v4.epoch": "m1",
    "suipian.v4.base.m1": JSON.stringify({
      epoch: "m1",
      s: {
        xp: 80,
        lessonsCompleted: 2,
        done: { U1L1: true, U1L2: true },
        firstXp: { U1L1: 50, U1L2: 30 },
      },
    }),
  });
  const res = observeAndAssertImmutable(st, "non-empty-base-xp80");
  assert.equal(res.ok, true);
  assert.equal(res.usedBase, true);
  assert.equal(res.baseKey, "suipian.v4.base.m1");
  assert.equal(res.xp, 80);
  assert.equal(res.runs, 2);
  assert.deepEqual(res.done, ["U1L1", "U1L2"]);
});

// 4. 多账本合并 + 重复 ID 合并取最大（不跳过后来条目）+ firstXp 按关卡去重取最大
step("4. 多账本合并、重复 entryId 取最大（不跳过后来条目）与 firstXp 对象合并", () => {
  const st = createMockStorage({
    "suipian.v4.epoch": "m2",
    "suipian.v4.base.m2": JSON.stringify({
      epoch: "m2",
      s: { xp: 50, lessonsCompleted: 1, done: { U1L1: true }, firstXp: { U1L1: 50 } },
    }),
    "suipian.v4.tab.a": JSON.stringify({
      epoch: "m2",
      firstXp: { U1L2: 30 },
      entries: {
        "bonus-1": { type: "xp", xp: 10 },
        "run-2": { type: "run", count: 1 },
        "done-2": { type: "done", lesson: "U1L2" },
      },
    }),
    "suipian.v4.tab.b": JSON.stringify({
      epoch: "m2",
      firstXp: { U1L1: 50, U1L2: 30 },
      entries: {
        "bonus-1": { type: "xp", xp: 25 },
        "run-2": { type: "run", count: 1 },
      },
    }),
  });
  const res = observeAndAssertImmutable(st, "multi-ledger-max-merge");
  assert.equal(res.ok, true);
  assert.equal(res.xp, 105);
  assert.equal(res.runs, 2);
  assert.deepEqual(res.done, ["U1L1", "U1L2"]);
  assert.deepEqual(res.duplicateEntryIds, ["bonus-1", "run-2"]);
});

// 5. 旧代基线与旧代账本完全隔离
step("5. 旧代基线 suipian.v4.base.m1 与旧代账本完全隔离", () => {
  const st = createMockStorage({
    "suipian.v4.epoch": "m2",
    "suipian.v4.base.m1": JSON.stringify({
      epoch: "m1",
      s: { xp: 80, lessonsCompleted: 2, done: { U1L1: true, U1L2: true } },
    }),
    "suipian.v4.tab.old": JSON.stringify({
      epoch: "m1",
      firstXp: { U1L3: 999 },
      entries: { "old-run": { type: "run", count: 9 } },
    }),
  });
  const res = observeAndAssertImmutable(st, "old-epoch-isolation");
  assert.equal(res.ok, true);
  assert.equal(res.xp, 0);
  assert.equal(res.runs, 0);
  assert.deepEqual(res.done, []);
  assert.deepEqual(res.ignoredOldEpochBaseKeys, ["suipian.v4.base.m1"]);
  assert.deepEqual(res.ignoredOldEpochKeys, [{ key: "suipian.v4.tab.old", epoch: "m1" }]);
});

// 6. 非法结构（entries 为数组 / 损坏 JSON / firstXp 为数组）显式标错，绝不当作零进度
step("6. entries/firstXp 为数组或 JSON 损坏时返回 CORRUPT_STORAGE 且 xp=null", () => {
  for (const [label, badVal] of [
    ["entries-array", JSON.stringify({ epoch: "m0", entries: [] })],
    ["firstXp-array", JSON.stringify({ epoch: "m0", entries: {}, firstXp: [] })],
    ["corrupt-json", "{not-valid-json"],
  ]) {
    const st = createMockStorage({ "suipian.v4.tab.bad": badVal });
    const res = observeAndAssertImmutable(st, label);
    assert.equal(res.ok, false);
    assert.equal(res.status, "CORRUPT_STORAGE");
    assert.equal(res.xp, null);
  }
});

// 7. 读取失败（READ_ERROR）与观察期间换代（EPOCH_CHANGED_DURING_READ）
step("7. 读取失败与观察期间换代均返回明确错误且 xp=null", () => {
  const stErr = createMockStorage({ "suipian.v4.epoch": "m0" });
  stErr._setGetItemHook(() => {
    throw new Error("SecurityError: storage denied");
  });
  const resErr = observeSuipianV4Storage(stErr);
  assert.equal(resErr.ok, false);
  assert.equal(resErr.status, "READ_ERROR");
  assert.equal(resErr.xp, null);

  const stTear = createMockStorage({
    "suipian.v4.epoch": "m0",
    "suipian.v4.tab.t1": JSON.stringify({ epoch: "m0", firstXp: { U1L1: 50 }, entries: {} }),
  });
  let epochReads = 0;
  stTear._setGetItemHook((key, map) => {
    if (key === "suipian.v4.epoch") {
      epochReads += 1;
      if (epochReads === 2) {
        map.set("suipian.v4.epoch", "m1");
      }
    }
  });
  const resTear = observeSuipianV4Storage(stTear);
  assert.equal(resTear.ok, false);
  assert.equal(resTear.status, "EPOCH_CHANGED_DURING_READ");
  assert.equal(resTear.epochBefore, "m0");
  assert.equal(resTear.epochAfter, "m1");
  assert.equal(resTear.xp, null);
});

console.log(`\n纯 Node 观察器校准全部通过：${passed} 项`);
