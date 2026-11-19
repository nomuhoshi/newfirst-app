// 判题“不会无限等”：执行器 / 工作线程不回话时，judge 必须在有限时间内返回“不算作答”的结果（不扣红心、不结算、保留代码、可重试）。
// 对应 P3 真机“点检查之后一直是检查中”：这里只证明“就算 Python 工作线程没有任何回应，也一定会结束”，不替代真机验证。
// 运行：node tests/judge-hang.test.mjs
import { judge, makeRunnerExecutor, JUDGE_LIMITS } from "../src/judge.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };
const tests = [{ name: "a", expected: "hi\n" }, { name: "b", expected: "hi\n" }];
const FAST = { caseMs: 40, totalMs: 400, readyCapMs: 40, graceMs: 40 };
const timed = async (f) => { const t0 = Date.now(); const r = await f(); return [r, Date.now() - t0]; };
const notAttempt = (r) => r.attempt === false && r.settle === false && r.retry === true;

// ---- 1. 执行器永远不返回：到点就当“环境不可用”，不算作答 ----
{
  const hung = { exec: () => new Promise(() => {}) };
  const [r, ms] = await timed(() => judge({ code: 'print("hi")', tests, limits: FAST }, hung));
  check("执行器一直不返回：judge 在 readyCap + 单组时限 + 宽限内结束（<500ms）", ms < 500 && ms >= 100, `用时 ${ms}ms`);
  check("  结果：unavailable，不算作答、不结算、可重试", r.status === "unavailable" && notAttempt(r), JSON.stringify(r).slice(0, 200));
  check("  最后一条是 unavailable 的说明（界面据此提示重试）", r.cases.at(-1)?.kind === "unavailable" && /重试/.test(r.cases.at(-1).message));
}
// ---- 2. 第一组通过、第二组卡死：整体不结算（不能因为只跑完一组就结算通过）----
{
  let n = 0;
  const half = { exec: () => (++n === 1 ? Promise.resolve({ stdout: "hi\n", error: null, timedOut: false, limitHit: false, ms: 1 }) : new Promise(() => {})) };
  const [r] = await timed(() => judge({ code: 'print("hi")', tests, limits: FAST }, half));
  check("第 2 组卡死：unavailable，且不结算（第 1 组通过也不算数）", r.status === "unavailable" && notAttempt(r) && n === 2, JSON.stringify(r).slice(0, 200));
}
// ---- 3. 慢但会返回的执行器不被误杀：在 单组时限 + 就绪上限 内返回的都正常处理 ----
{
  const slow = { exec: () => new Promise((res) => setTimeout(() => res({ stdout: "hi\n", error: null, timedOut: false, limitHit: false, ms: 60 }), 90)) };
  const [r] = await timed(() => judge({ code: 'print("hi")', tests, limits: FAST }, slow));
  check("90ms 才返回（< readyCap 40 + case 40 + grace 40 = 120ms）：正常判 pass，不被兜底误杀", r.status === "pass" && r.attempt && r.settle, JSON.stringify(r).slice(0, 160));
}
// ---- 4. 兜底之后迟到的结果不会改写已经返回的结果 ----
{
  let late;
  const lateExec = { exec: () => new Promise((res) => { late = res; }) };
  const r = await judge({ code: 'print("hi")', tests, limits: FAST }, lateExec);
  late({ stdout: "hi\n", error: null, timedOut: false, limitHit: false, ms: 1 });
  await new Promise((r2) => setTimeout(r2, 30));
  check("兜底返回之后迟到的 pass 不改变结果（仍是 unavailable）", r.status === "unavailable");
}
// ---- 5. 默认上限没被悄悄放大 ----
check("默认 graceMs 是 5000，readyCapMs 仍是 30000（最长等待有明确上界）", JUDGE_LIMITS.graceMs === 5000 && JUDGE_LIMITS.readyCapMs === 30000);

// ---- 6. 用真实 Runner + 永远不回话的假 Worker：加载阶段 / 运行阶段都会结束 ----
globalThis.document = { baseURI: "http://localhost/" };
const workers = [];
globalThis.Worker = class { constructor() { this.terminated = false; workers.push(this); } postMessage() {} terminate() { this.terminated = true; } };
const { Runner } = await import("../src/runner.js");
{
  const runner = new Runner({ onStatus() {}, onOutput() {} });
  const exec = makeRunnerExecutor(runner);
  // 6a 加载阶段：工作线程一直没有 ready
  const [r, ms] = await timed(() => judge({ code: 'print("hi")', tests, limits: FAST }, exec));
  check("加载阶段工作线程无回应：在 readyCap（40ms）后返回 unavailable，不无限“检查中”", r.status === "unavailable" && notAttempt(r) && ms < 400, `${r.status} ${ms}ms`);
  // 6b 让它就绪，再让运行阶段没有 done：单组时限到了会停止并返回 timeout（不扣红心）
  const w = workers.at(-1); w.onmessage({ data: { type: "ready", ms: 1 } });
  check("  工作线程报告 ready 后 Runner 状态是 ready", runner.state === "ready");
  const [r2, ms2] = await timed(() => judge({ code: "while True: pass", tests, limits: FAST }, exec));
  check("运行阶段工作线程无回应：单组时限后停止并重启线程，返回 timeout（不算作答、不扣红心）", r2.status === "timeout" && notAttempt(r2) && ms2 < 400, `${r2.status} ${ms2}ms`);
  check("  旧工作线程被终止，并新建了一个重新加载的线程", workers.some((x) => x.terminated) && runner.state === "loading", `terminated=${workers.some((x) => x.terminated)} state=${runner.state}`);
  // 6c 重启后的线程也没就绪：再点一次检查仍然会结束
  const [r3, ms3] = await timed(() => judge({ code: 'print("hi")', tests, limits: FAST }, exec));
  check("重启后线程仍没就绪：再检查一次也在 readyCap 后结束（unavailable），没有排队卡死", r3.status === "unavailable" && ms3 < 400, `${r3.status} ${ms3}ms`);
}

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
