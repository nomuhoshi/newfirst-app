// 合成存储。WebKit 里“别的标签页刚清除”后，旧页读到的清除代数可能短暂还是旧的（跨进程同步延迟；CI main 44053667006 attempt 1 的 mobile (webkit)
// progress-concurrency-diagnostic T2 就是旧页直接读 localStorage 得到 m0，而清除页和观察页读到的已是新代数）。
// 本测试用“旧页读到过期代数”的存储，固定住这个窗口里的行为：
//   1. 窗口内旧页保存会返回 true（它确实看不到清除）；
//   2. 但写出的账本带的是旧代数标签，新代数的读取方（新页、备份快照、账号接管读取）看不到旧进度——旧进度不会写进新一代；
//   3. 窗口过去后，旧页再保存 / 合并：采用新一代的空记录，内存清空，不再把旧进度写出去；
//   4. 窗口内写出的旧代数残留（旧代数账本、带旧进度的兼容镜像；旧基线是空的，不处理）一旦旧页采用新一代，会被清掉。
import test from "node:test";
import assert from "node:assert/strict";

let serial = 0;
class MemoryStorage {
  values = new Map();
  hideEpoch = false; // 模拟旧页读到的清除代数还没同步过来（读 suipian.v4.epoch 得到“没有”，等于 m0）
  get length() { return this.values.size; }
  key(i) { return [...this.values.keys()][i] ?? null; }
  getItem(k) { if (this.hideEpoch && k === "suipian.v4.epoch") return null; return this.values.get(k) ?? null; }
  setItem(k, v) { this.values.set(k, String(v)); }
  removeItem(k) { this.values.delete(k); }
}
const leftovers = (S, epoch) => [...S.values.keys()].filter((k) => {
  if (k === "suipian.v4.epoch" || k === "suipian.v4.tabId") return false;
  if (k === "suipian.progress") { try { return JSON.parse(S.values.get(k)).xp > 0; } catch { return false; } } // 带旧进度的兼容镜像
  if (k.startsWith("suipian.v4.tab.")) { try { return JSON.parse(S.values.get(k)).epoch !== epoch; } catch { return true; } }
  return false;
});

async function scenario(run) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const S = new MemoryStorage();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: S });
  try {
    const id = ++serial;
    const A = await import(`../src/storage.js?stale-epoch=${id}-A`); // 旧页
    const B = await import(`../src/storage.js?stale-epoch=${id}-B`); // 清除页
    const C = await import(`../src/storage.js?stale-epoch=${id}-C`); // 之后新开的页面 / 读取方
    const old = A.loadState().state;
    old.onboarded = true; A.addXp(old, 50, "U1L1", true); old.done.U1L1 = true; A.addRun(old);
    assert.equal(A.saveState(old), true);
    const oldEpoch = A.stateEpoch(old);
    const fresh = B.clearState();
    assert.notEqual(fresh.clearFailed, true);
    const newEpoch = B.stateEpoch(fresh);
    assert.notEqual(newEpoch, oldEpoch);
    await run({ S, A, B, C, old, fresh, oldEpoch, newEpoch });
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous); else delete globalThis.localStorage;
  }
}

test("读到过期代数的旧页保存：返回 true，但旧进度不会出现在新一代里", async () => {
  await scenario(({ S, A, C, old, oldEpoch, newEpoch }) => {
    A.addXp(old, 10); // 窗口内又答对一题：有没存下的变化，保存才会真的写（无变化不写）
    S.hideEpoch = true;
    assert.equal(A.saveState(old), true, "窗口内旧页看不到清除，保存会返回 true");
    assert.equal(A.stateEpoch(old), oldEpoch);
    assert.equal(old.xp, 60, "窗口内旧页内存还是旧进度（还没收到清除）");
    S.hideEpoch = false;
    // 新代数的任何读取方都看不到旧进度
    const c = C.loadState().state;
    assert.equal(C.stateEpoch(c), newEpoch);
    assert.deepEqual([c.xp, c.lessonsCompleted, Object.keys(c.done).filter((k) => c.done[k])], [0, 0, []], "新页读到的进度必须是空的");
    const snap = C.readSnapshot(c);
    assert.equal(snap.ok, true);
    assert.deepEqual([snap.state?.xp ?? snap.xp ?? 0], [0], "备份快照里不能有旧进度");
    const raw = JSON.parse(C.guestRawV3(S));
    assert.deepEqual([raw.xp, raw.lessonsCompleted, Object.keys(raw.done || {})], [0, 0, []], "账号接管读取不能有旧进度");
    for (const k of S.values.keys()) if (k.startsWith("suipian.v4.tab.")) { const r = JSON.parse(S.values.get(k)); if (r.epoch === newEpoch) for (const e of Object.values(r.entries)) assert.equal(e.xp, 0, "标着新代数的账本里不能有旧 XP"); }
  });
});

test("窗口过去后：旧页再保存 = 采用新一代的空记录，旧进度不再写出，旧代数的账本和带旧进度的镜像被清掉", async () => {
  await scenario(({ S, A, C, old, newEpoch }) => {
    A.addXp(old, 10); S.hideEpoch = true; assert.equal(A.saveState(old), true); S.hideEpoch = false;
    assert.ok(leftovers(S, newEpoch).length > 0, "前提：窗口内的保存确实留下了旧代数的账本（读取方忽略）");
    assert.equal(A.saveState(old), false, "看到清除后保存报告清除冲突（false）");
    assert.deepEqual([old.xp, old.lessonsCompleted, Object.keys(old.done).filter((k) => old.done[k])], [0, 0, []], "内存采用新一代的空记录");
    assert.equal(A.stateEpoch(old), newEpoch);
    assert.deepEqual(leftovers(S, newEpoch), [], "旧代数的账本和带旧进度的镜像被清掉，不留在存储里");
    assert.equal(A.saveState(old), true);
    const c = C.loadState().state;
    assert.deepEqual([c.xp, c.lessonsCompleted], [0, 0]);
  });
});

test("窗口过去后：旧页只做合并（回前台 / storage 事件）也采用新一代并清掉残留", async () => {
  await scenario(({ S, A, old, newEpoch }) => {
    A.addXp(old, 10); S.hideEpoch = true; assert.equal(A.saveState(old), true); S.hideEpoch = false;
    A.mergeStored(old);
    assert.deepEqual([old.xp, old.lessonsCompleted], [0, 0]);
    assert.deepEqual(leftovers(S, newEpoch), []);
  });
});
