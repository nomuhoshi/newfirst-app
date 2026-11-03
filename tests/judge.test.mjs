// 判题核心测试：用真实 Python（python3 子进程，每组一个新进程 = 全新全局变量）跑 U3 输出模式。
// 运行：node tests/judge.test.mjs
import { spawn } from "node:child_process";
import { judge, normalizeOutput, KIND, messageFor, makeRunnerExecutor } from "../src/judge.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };

const PY = `import json,sys,traceback
src=sys.stdin.read(); d=json.loads(sys.argv[1]); ns={"__name__":"__main__"}; ns.update(d or {})
try:
    exec(compile(src,"<你的代码>","exec"),ns)
except BaseException as e:
    sys.stdout.flush(); print("\\x00ERR"+json.dumps({"kind":type(e).__name__,"line":None,"msg":str(e)}),file=sys.stderr)
`;
const pyExec = {
  calls: 0,
  exec({ code, data, timeoutMs }) {
    this.calls++;
    return new Promise((resolve) => {
      const p = spawn("python3", ["-c", PY, JSON.stringify(data)]);
      let out = "", err = "", timedOut = false;
      const timer = setTimeout(() => { timedOut = true; p.kill("SIGKILL"); }, timeoutMs);
      p.stdout.on("data", (b) => (out += b)); p.stderr.on("data", (b) => (err += b));
      p.on("close", () => {
        clearTimeout(timer);
        const m = err.match(/\x00ERR(.*)/);
        resolve({ stdout: out, error: m ? JSON.parse(m[1]) : null, timedOut, limitHit: false });
      });
      p.stdin.end(code);
    });
  },
};

const T = (name, expected, data, hidden) => ({ name, expected, data, hidden });
const t1 = [T("样例", "总价 60", { price: 15, cups: 4 }), T("隐藏1", "总价 0", { price: 9, cups: 0 }, true)];
const good = 'print("总价", price * cups)';

let r = await judge({ code: good, tests: t1, checkMode: "output" }, pyExec);
check("正确代码：status=pass，两组都 ok，attempt/settle", r.attempt && r.settle && r.status === "pass" && r.cases.every((c) => c.ok && c.kind === KIND.PASS), JSON.stringify(r));
check("返回 totalMs 数字，cases 含 name/hidden/ok/kind", typeof r.totalMs === "number" && r.cases[1].hidden === true && r.cases[0].name === "样例");

r = await judge({ code: 'print("总价", price - cups)', tests: t1 }, pyExec);
check("错误代码：status=fail，kind=wrong-output", r.status === "fail" && r.cases[0].kind === KIND.WRONG && r.cases[0].stdout.trim() === "总价 11");
check("隐藏用例失败不暴露 expected/actual", r.cases[1].ok === false && !("expected" in r.cases[1]) && !("stdout" in r.cases[1]), JSON.stringify(r.cases[1]));
check("公开用例失败给出 expected/actual", r.cases[0].expected === "总价 60");

r = await judge({ code: "print(1/0)", tests: t1 }, pyExec);
check("运行出错：kind=error 且带错误类型", r.status === "fail" && r.cases[0].kind === KIND.ERROR && r.cases[0].error.kind === "ZeroDivisionError");

r = await judge({ code: "try:\n    seen\nexcept NameError:\n    seen = 0\nseen += 1\nprint(seen)", tests: [T("a", "1"), T("b", "1"), T("c", "1")] }, pyExec);
check("每组全新全局变量：上一组留下的变量不影响下一组", r.status === "pass", JSON.stringify(r.cases));

r = await judge({ code: "print('hi')", tests: [T("a", "hi")] }, pyExec);
check("strict：允许末尾一个换行（print 自带的换行）", r.status === "pass");
r = await judge({ code: "print('hi')\nprint()", tests: [T("a", "hi")] }, pyExec);
check("strict：多出来的空行要比较 → wrong-output", r.cases[0].kind === KIND.WRONG);
r = await judge({ code: "print('hi  ')", tests: [T("a", "hi")] }, pyExec);
check("strict：行尾空格要比较 → wrong-output", r.cases[0].kind === KIND.WRONG);
r = await judge({ code: "print('hi  ')\nprint()", tests: [T("a", "hi")], compare: "lenient" }, pyExec);
check("lenient（题目声明时）：忽略行尾空白和末尾空行", r.status === "pass");
r = await judge({ code: "print('a')\nprint()\nprint('b')", tests: [T("a", "a\nb")], compare: "lenient" }, pyExec);
check("lenient：中间空行仍要比较", r.cases[0].kind === KIND.WRONG);
check("normalizeOutput 统一 \\r\\n 和 \\r", normalizeOutput("a\r\nb\r") === "a\nb" && normalizeOutput("a\n\n") === "a\n");
r = await judge({ code: good, tests: t1, compare: "fuzzy" }, pyExec);
check("未知 compare 值：internal-error", r.status === "internal-error");
// 时限：用小数字测逻辑（同样的分支，真实默认是 5s/10s）
let t = Date.now();
r = await judge({ code: "while True: pass", tests: [T("a", "")], limits: { caseMs: 500, totalMs: 2000 } }, pyExec);
check("死循环：单组超时 kind=case-timeout，消息说 0.5 秒（跟着 limits 变）", r.cases[0].kind === KIND.CASE_TIMEOUT && r.cases[0].message.includes("0.5 秒") && Date.now() - t < 1800, JSON.stringify(r));
check("新规则：超时只是环境保护 → status=timeout，不算作答、不结算、不扣红心（attempt/settle=false，retry=true，提示写明不扣红心）", r.status === "timeout" && !r.attempt && !r.settle && r.retry && /不扣红心/.test(r.cases[0].message), JSON.stringify(r));

pyExec.calls = 0; t = Date.now();
r = await judge({ code: "import time\ntime.sleep(0.4)\nprint('ok')", tests: [T("a", "ok"), T("b", "ok"), T("c", "ok"), T("d", "ok")], limits: { caseMs: 500, totalMs: 1000 } }, pyExec);
const kinds = r.cases.map((c) => c.kind);
check("总时限：用完预算的那一组 kind=total-timeout 并立即停止（不再跑后面的组），消息说 1 秒、与单组超时不同", kinds.join() === "pass,pass,total-timeout" && r.cases[2].message.includes("1 秒") && messageFor(KIND.TOTAL_TIMEOUT) !== messageFor(KIND.CASE_TIMEOUT) && messageFor(KIND.CASE_TIMEOUT).includes("5 秒") && messageFor(KIND.TOTAL_TIMEOUT).includes("10 秒"), kinds.join(","));
check("总时限后不再调用执行器（最多 3 次）", pyExec.calls <= 3, String(pyExec.calls));
check("每组 ms 和 totalMs 只算执行时间", r.cases[0].ms >= 300 && r.totalMs >= 800);
check("总时限：整体耗时受控，status=timeout（不算答错）", Date.now() - t < 1700 && r.status === "timeout" && !r.attempt && !r.settle, String(Date.now() - t));

r = await judge({ code: good, tests: t1 }, { exec: async () => { throw { unavailable: true }; } });
check("Python 不可用：status=unavailable（不算对错）", r.status === "unavailable" && !r.attempt && !r.settle && r.retry && r.cases[0].message.includes("代码已保留"));
let n = 0;
r = await judge({ code: good, tests: t1 }, { exec: async (a) => { if (n++) throw { unavailable: true }; return pyExec.exec(a); } });
check("第 1 组通过后环境失败：整体 unavailable，不结算（不完整结果不结算）", r.status === "unavailable" && !r.settle && !r.attempt && r.cases.length === 1 && r.cases[0].kind === KIND.UNAVAILABLE);
r = await judge({ code: good, tests: t1 }, { exec: async () => { throw new Error("boom"); } });
check("执行器内部异常：status=internal-error，不算作答", r.status === "internal-error" && !r.attempt && !r.settle);
r = await judge({ code: good, tests: t1 }, { exec: async () => ({ stdout: "", error: { kind: "InternalError", msg: "x" } }) });
check("worker 报 InternalError：status=internal-error（不算学生错）", r.status === "internal-error");
r = await judge({ code: good, tests: t1 }, { exec: async () => ({ stdout: "x", error: null, limitHit: true }) });
check("输出超限：kind=output-limit，status=output-limit（不算作答、不结算、不扣红心），提示点明检查循环或打印次数", r.cases[0].kind === KIND.OUTPUT_LIMIT && r.status === "output-limit" && !r.attempt && !r.settle && r.retry && /检查循环或打印次数/.test(r.cases[0].message), JSON.stringify(r));
r = await judge({ code: good, tests: t1, checkMode: "function" }, pyExec);
check("非 output 模式：internal-error（本 PR 只支持 U3 输出模式）", r.status === "internal-error");
r = await judge({ code: good, tests: [] }, pyExec);
check("没有用例：internal-error，不会误判 pass", r.status === "internal-error");

// Runner 适配器：假 Runner，状态机与 src/runner.js 一致（run/stop/boot/whenReady）
function fakeRunner(script, { loadMs = 0, loadOk = () => true } = {}) {
  const r = { state: "ready", onStatus() {}, onOutput() {}, stopped: 0, boots: 0, appStatus: [],
    boot() { r.boots++; r.state = "loading"; r.onStatus("loading"); setTimeout(() => { if (loadOk()) { r.state = "ready"; r.onStatus("ready"); } else { r.state = "loadError"; r.onStatus("loadError"); } }, loadMs); },
    whenReady(cap) { return new Promise((res) => { const t0 = Date.now(); const tick = () => r.state === "ready" ? res("ready") : r.state === "loadError" ? res("loadError") : Date.now() - t0 >= cap ? res("never-ready") : setTimeout(tick, 5); tick(); }); },
    run(code, data) { if (r.state !== "ready") return false; r.state = "running"; r.onStatus("running"); queueMicrotask(() => script(r, code, data)); return true; },
    stop() { if (r.state !== "running") return; r.stopped++; r.onStatus("stopped"); r.boot(); } };
  r.onStatus = (s) => r.appStatus.push(s);
  return r;
}
const appHandler = (fr) => fr.onStatus;
let fr = fakeRunner((r) => { r.onOutput("总价 "); r.onOutput("60\n"); r.state = "ready"; r.onStatus("done", { error: null }); });
let h = appHandler(fr);
r = await judge({ code: good, tests: [T("a", "总价 60")] }, makeRunnerExecutor(fr));
check("适配器：拼接分段输出判 pass，回调还原", r.status === "pass" && fr.onStatus === h);
// 超时后重启（重启加载 300ms）→ 下一组不能误报 unavailable，重启时间不计入预算
let k = 0;
fr = fakeRunner((r, code) => { if (k++ === 0) return; /* 第 1 组死循环 */ r.onOutput("ok\n"); r.state = "ready"; r.onStatus("done", {}); }, { loadMs: 300 });
h = appHandler(fr);
r = await judge({ code: "x", tests: [T("a", "ok"), T("b", "ok"), T("c", "ok")], limits: { caseMs: 100, totalMs: 250 } }, makeRunnerExecutor(fr));
check("适配器：第一组超时 → status=timeout 立即停止，stop() 一次", r.status === "timeout" && r.cases.map((c) => c.kind).join() === "case-timeout" && fr.stopped === 1 && r.totalMs < 250, JSON.stringify(r.cases.map((c) => c.kind)) + " " + r.totalMs);
r = await judge({ code: "x", tests: [T("a", "ok"), T("b", "ok")] }, makeRunnerExecutor(fr));
check("适配器：超时重启之后再判题照常通过（不误报 unavailable），重启加载不计时", r.status === "pass" && r.settle, JSON.stringify(r.cases.map((c) => c.kind)));
check("适配器：超时后回调已还原，界面收到重启的 loading/ready", fr.onStatus === h && fr.appStatus.includes("loading") && fr.appStatus.includes("ready"));
// 加载失败 → 自动 boot 重试一次；再失败 → unavailable；之后恢复
let ok = false;
fr = fakeRunner((r) => { r.onOutput("总价 60\n"); r.state = "ready"; r.onStatus("done", {}); }, { loadMs: 10, loadOk: () => ok }); fr.state = "loadError";
const ex = makeRunnerExecutor(fr);
r = await judge({ code: good, tests: t1 }, ex);
check("适配器：加载失败（重试也失败）→ unavailable，不算作答", r.status === "unavailable" && !r.attempt && fr.boots === 1);
ok = true;
r = await judge({ code: good, tests: [T("a", "总价 60")] }, ex);
check("适配器：网络恢复后再判题会重新加载并正常判", r.status === "pass" && fr.boots === 2);
// 一直不就绪
fr = fakeRunner(() => {}); fr.state = "loading";
t = Date.now();
r = await judge({ code: good, tests: t1, limits: { readyCapMs: 200 } }, makeRunnerExecutor(fr));
check("适配器：一直不就绪 → 等到上限后 unavailable", r.status === "unavailable" && Date.now() - t < 600);
// run() 同步抛错 → 清理
fr = fakeRunner(() => {}); h = appHandler(fr); fr.run = () => { throw new Error("sync"); };
r = await judge({ code: good, tests: t1 }, makeRunnerExecutor(fr));
check("适配器：run() 同步抛错 → internal-error，回调还原", r.status === "internal-error" && fr.onStatus === h);
// 取消
fr = fakeRunner(() => {}); h = appHandler(fr);
const ac = new AbortController(); setTimeout(() => ac.abort(), 50);
r = await judge({ code: good, tests: t1, limits: { caseMs: 2000 } }, makeRunnerExecutor(fr), { signal: ac.signal });
check("适配器：取消 → status=cancelled，不算作答、不结算、retry=false，stop() 一次，回调还原", r.status === "cancelled" && r.cases[0].kind === KIND.CANCELLED && !r.attempt && !r.settle && !r.retry && fr.stopped === 1 && fr.onStatus === h);
fr = fakeRunner((r) => { r.state = "ready"; r.onStatus("outputLimitStopped"); });
r = await judge({ code: good, tests: t1 }, makeRunnerExecutor(fr));
check("适配器：输出超限 → output-limit，不算作答", r.cases[0].kind === KIND.OUTPUT_LIMIT && r.status === "output-limit" && !r.attempt);

// 保护性停止出现在前面组已通过之后：仍然不结算、不算作答；下一次提交可以正常结算
r = await judge({ code: "if n == 1:\n    while True: pass\nprint(n)", tests: [T("a", "0", { n: 0 }), T("b", "1", { n: 1 }), T("c", "2", { n: 2 })], limits: { caseMs: 400, totalMs: 3000 } }, pyExec);
check("前面通过、第二组超时：status=timeout，不结算，第三组没有运行", r.status === "timeout" && !r.attempt && !r.settle && r.cases.map((c) => c.kind).join() === "pass,case-timeout", JSON.stringify(r.cases.map((c) => c.kind)));
r = await judge({ code: "print(n)", tests: [T("a", "0", { n: 0 }), T("b", "1", { n: 1 })] }, pyExec);
check("下一次提交恢复正常：pass 且可结算", r.status === "pass" && r.attempt && r.settle);
{
  let calls = 0;
  const ex = { exec: async () => (calls++ === 0 ? { stdout: "ok", error: null } : { stdout: "x", error: null, limitHit: true }) };
  r = await judge({ code: good, tests: [T("a", "ok"), T("b", "ok"), T("c", "ok")] }, ex);
  check("前面通过、第二组输出超限：status=output-limit，不结算，第三组不运行", r.status === "output-limit" && !r.attempt && !r.settle && calls === 2 && r.cases.length === 2);
}
r = await judge({ code: good, tests: [T("a", "ok"), T("b", "ok")] }, { exec: async () => ({ stdout: "ok", error: null }) }, { signal: AbortSignal.abort() });
check("取消（已取消的信号）：status=cancelled，retry=false，不结算", r.status === "cancelled" && !r.attempt && !r.settle && !r.retry);
r = await judge({ code: "print(n)", tests: [T("a", "0", { n: 0 }), T("b", "9", { n: 1 })] }, pyExec);
check("普通答错 / 运行错误仍然正常判分（attempt=true，可结算）", r.status === "fail" && r.attempt && r.settle && r.cases[1].kind === KIND.WRONG);

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
