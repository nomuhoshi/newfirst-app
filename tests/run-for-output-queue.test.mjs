// GPT1/产品官 11-16 对 #116 的阻断项：runForOutput 外层看门狗超时、运行中工作线程报错之后，监听必须清掉，排在后面的请求必须能正常执行。
// 这是 Node 里的“真实代码”测试：src/app.js 里的 runForOutput / runForOutputNow 原文按标记截出来执行，配真实的 src/runner.js 和假的 Worker（可编程：正常 / 加载失败 / 吞掉运行请求 / 运行中报错）。
// 不依赖 vite，本机和 CI 都能跑。浏览器里的端到端见 tests/lazy-python.test.mjs。
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { test } from "node:test";

globalThis.document = { baseURI: "http://localhost/" };
const workers = [];
let behavior = { load: "ok", run: "ok" }; // load: ok | fail | hang；run: ok | swallow | error | loop
class FakeWorker {
  constructor() { this.dead = false; workers.push(this); }
  postMessage(m) {
    if (this.dead) return;
    if (m.type === "init") {
      if (behavior.load === "hang") return;
      setTimeout(() => { if (!this.dead) this.onmessage?.({ data: behavior.load === "fail" ? { type: "loadError", msg: "fake load error" } : { type: "ready", ms: 1 } }); }, 5);
    } else if (m.type === "run") {
      const r = typeof behavior.run === "function" ? behavior.run(m) : behavior.run;
      if (r === "swallow" || r === "loop") { if (r === "swallow") this.swallowed = m; return; } // 吞掉：永远没有结果
      if (r === "error") { setTimeout(() => { if (!this.dead) this.onerror?.({ message: "fake worker crashed", preventDefault() {} }); }, 5); return; }
      setTimeout(() => {
        if (this.dead) return;
        const out = String(m.code).replace(/^print\("(.*)"\)$/, "$1");
        this.onmessage?.({ data: { type: "out", id: m.id, text: out + "\n" } });
        this.onmessage?.({ data: { type: "done", id: m.id, error: null } });
      }, 5);
    }
  }
  terminate() { this.dead = true; }
}
globalThis.Worker = FakeWorker;

const { Runner, LIMITS } = await import("../src/runner.js");
const appSrc = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const a = appSrc.indexOf("let outputChain = Promise.resolve();"), b = appSrc.indexOf("// Python 运行不了时，如实说明原因");
assert.ok(a > 0 && b > a, "找不到 runForOutput 源码标记");
const body = appSrc.slice(a, b);

function setup() {
  workers.length = 0; behavior = { load: "ok", run: "ok" };
  LIMITS.runMs = 150; LIMITS.loadMs = 400;
  const listeners = new Set();
  const runner = new Runner({
    onStatus(s, info) { for (const l of [...listeners]) l.status?.(s, info); },
    onOutput(t) { for (const l of [...listeners]) l.output?.(t); },
  });
  const { runForOutput } = new Function("runner", "listeners", "LIMITS", body + "\nreturn { runForOutput };")(runner, listeners, LIMITS);
  return { runner, listeners, runForOutput };
}
const settle = (ms) => new Promise((r) => setTimeout(r, ms));
const waitReady = async (runner, ms = 3000) => { const t0 = Date.now(); while (runner.state !== "ready") { if (Date.now() - t0 > ms) throw new Error("runner 没有回到 ready：" + runner.state); await settle(10); } };

test("Q1 冷启动并发两个请求：各得各的输出，全部监听注销", async () => {
  const { runner, listeners, runForOutput } = setup();
  const [x, y] = await Promise.all([runForOutput('print("AAA")'), runForOutput('print("BBB")')]);
  assert.equal(x?.out, "AAA\n"); assert.equal(y?.out, "BBB\n");
  assert.equal(listeners.size, 0); assert.equal(runner.state, "ready");
});

test("Q2 外层看门狗：运行请求被吞、runner 自己的超时也没触发 → A 结算 null、监听归零、停掉这次运行，排队的 B 正常执行", async () => {
  const { runner, listeners, runForOutput } = setup();
  await runForOutput('print("warm")'); // 先让 runner ready
  behavior.run = (m) => (m.code === 'print("A")' ? "swallow" : "ok");
  const pa = runForOutput('print("A")'), pb = runForOutput('print("B")');
  await settle(30);
  assert.equal(runner.state, "running");
  clearTimeout(runner.current.timer); // 模拟 runner 自己的超时没有触发：只剩外层看门狗
  const t0 = Date.now();
  const ra = await pa;
  assert.equal(ra, null, "A 应该如实失败");
  assert.ok(Date.now() - t0 >= LIMITS.runMs + 2500, "看门狗不应早于 runMs + 3 秒触发：" + (Date.now() - t0));
  const rb = await pb;
  assert.equal(rb?.out, "B\n", "排队的 B 必须执行并得到自己的输出：" + JSON.stringify(rb));
  assert.equal(listeners.size, 0, "监听必须全部注销");
  assert.equal(runner.state, "ready");
});

test("Q3 运行中工作线程报错（runner 进入 loadError）：A 结算 null、监听归零，排队的 B 重新加载后正常执行", async () => {
  const { runner, listeners, runForOutput } = setup();
  await runForOutput('print("warm")');
  behavior.run = (m) => (m.code === 'print("A")' ? "error" : "ok");
  const pa = runForOutput('print("A")'), pb = runForOutput('print("B")');
  const ra = await pa;
  assert.equal(ra, null);
  const rb = await pb;
  assert.equal(rb?.out, "B\n", JSON.stringify(rb));
  assert.equal(listeners.size, 0); assert.equal(runner.state, "ready");
});

test("Q8 单独一个请求：看门狗 / 运行中报错结算的那一刻，共享监听集合就是空的（不是等后面的请求来清）", async () => {
  for (const mode of ["swallow", "error"]) {
    const { runner, listeners, runForOutput } = setup();
    await runForOutput('print("warm")');
    behavior.run = mode;
    const p = runForOutput('print("A")');
    if (mode === "swallow") { await settle(30); clearTimeout(runner.current.timer); }
    assert.equal(await p, null, mode);
    assert.equal(listeners.size, 0, mode + "：结算后监听必须为 0，实际 " + listeners.size);
  }
});

test("Q4 加载失败：两个并发请求都如实失败，监听归零；恢复后新请求成功", async () => {
  const { runner, listeners, runForOutput } = setup();
  behavior.load = "fail";
  const [x, y] = await Promise.all([runForOutput('print("F1")'), runForOutput('print("F2")')]);
  assert.equal(x, null); assert.equal(y, null); assert.equal(listeners.size, 0);
  behavior.load = "ok";
  const z = await runForOutput('print("CCC")');
  assert.equal(z?.out, "CCC\n"); assert.equal(listeners.size, 0); assert.equal(runner.state, "ready");
});

test("Q5 runner 自己的超时（死循环）：A 得到 Stopped，排队的 B 仍得到自己的输出", async () => {
  const { runner, listeners, runForOutput } = setup();
  await runForOutput('print("warm")');
  behavior.run = (m) => (m.code === "LOOP" ? "loop" : "ok");
  const [x, y] = await Promise.all([runForOutput("LOOP"), runForOutput('print("EEE")')]);
  assert.equal(x?.error?.kind, "Stopped"); assert.equal(y?.out, "EEE\n");
  assert.equal(listeners.size, 0); assert.equal(runner.state, "ready");
});

test("Q6 运行器被别处占用（例如写代码题在跑）：请求等对方结束再执行，不被误判成不可用", async () => {
  const { runner, listeners, runForOutput } = setup();
  await runForOutput('print("warm")');
  behavior.run = (m) => (m.code === "SLOW" ? (() => "ok") : "ok");
  // 别处直接占用 runner：用 run() 发一次，延迟结束
  const orig = FakeWorker.prototype.postMessage;
  let slowDone = null;
  FakeWorker.prototype.postMessage = function (m) {
    if (m.type === "run" && m.code === "SLOW") { setTimeout(() => { this.onmessage?.({ data: { type: "done", id: m.id, error: null } }); slowDone = Date.now(); }, 80); return; }
    return orig.call(this, m);
  };
  try {
    assert.equal(runner.run("SLOW"), true);
    const r = await runForOutput('print("AFTER")');
    assert.equal(r?.out, "AFTER\n", JSON.stringify(r));
    assert.ok(slowDone, "应当在对方结束之后才执行");
    assert.equal(listeners.size, 0);
  } finally { FakeWorker.prototype.postMessage = orig; }
});

test("Q7 校准：旧写法（超时只清自己的计时器、忽略运行中 loadError）在 Q2/Q3 的场景下确实会残留监听或卡住下一个请求（证明测试能抓到缺陷）", async () => {
  // 旧版 runForOutputNow：运行阶段监听只认 done/timeout/stopped/outputLimit*，外层 race 超时后不注销
  const old = `
let outputChain = Promise.resolve();
function runForOutput(code) { let cap = null;
  const guarded = () => Promise.race([runForOutputNow(code), new Promise((resolve) => { cap = setTimeout(() => resolve(null), LIMITS.loadMs + LIMITS.runMs + 3000); })]).finally(() => clearTimeout(cap));
  const p = outputChain.then(guarded); outputChain = p.then(() => {}, () => {}); return p; }
function runForOutputNow(code) { return new Promise((resolve) => {
  let waiter = null, timer = null;
  const finish = (v) => { clearTimeout(timer); if (waiter) listeners.delete(waiter); resolve(v); };
  const go = () => { let out = ""; const l = { output: (t) => { out += t; }, status: (s, info) => { if (!["done", "timeout", "stopped", "outputLimit", "outputLimitStopped"].includes(s)) return; listeners.delete(l); resolve(s === "done" ? { out, error: info.error } : { out, error: { kind: "Stopped", line: null, msg: "运行被停止" } }); } };
    listeners.add(l); if (!runner.run(code)) { listeners.delete(l); resolve(null); } };
  if (runner.state === "ready") return go();
  waiter = { status: (s) => { if (s === "ready") { listeners.delete(waiter); clearTimeout(timer); go(); } else if (s === "loadError") finish(null); } };
  listeners.add(waiter); timer = setTimeout(() => finish(null), LIMITS.loadMs + 2000);
  if (runner.state === "idle" || runner.state === "loadError") runner.boot(); }); }
return { runForOutput };`;
  const mk = () => {
    workers.length = 0; behavior = { load: "ok", run: "ok" };
    LIMITS.runMs = 150; LIMITS.loadMs = 400;
    const listeners = new Set();
    const runner = new Runner({ onStatus(s, i) { for (const l of [...listeners]) l.status?.(s, i); }, onOutput(t) { for (const l of [...listeners]) l.output?.(t); } });
    const { runForOutput } = new Function("runner", "listeners", "LIMITS", old)(runner, listeners, LIMITS);
    return { runner, listeners, runForOutput };
  };
  { // (a) 运行中 worker 报错：A 返回 null 的那一刻，旧写法的运行监听还留在共享集合里
    const { listeners, runForOutput } = mk();
    await runForOutput('print("warm")');
    behavior.run = "error";
    const ra = await runForOutput('print("A")');
    assert.equal(ra, null);
    assert.equal(listeners.size, 1, "旧写法：A 结束后监听残留（缺陷存在）：" + listeners.size);
  }
  { // (b) 运行请求被吞、runner 自己的超时也没触发：旧写法下排队的 B 得不到输出
    const { runner, runForOutput } = mk();
    await runForOutput('print("warm")');
    behavior.run = (m) => (m.code === 'print("A")' ? "swallow" : "ok");
    const pa = runForOutput('print("A")'), pb = runForOutput('print("B")');
    await settle(30); clearTimeout(runner.current.timer);
    assert.equal(await pa, null);
    const rb = await pb;
    assert.notEqual(rb?.out, "B\n", "旧写法下 B 不应得到正确输出（缺陷存在）：" + JSON.stringify(rb));
  }
});
