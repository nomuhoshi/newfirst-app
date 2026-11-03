// 判题核心测试：用真实 Python（python3 子进程，每组一个新进程 = 全新全局变量）跑 U3 输出模式。
// 运行：node tests/judge.test.mjs
import { spawn } from "node:child_process";
import { judge, normalizeOutput, KIND, MESSAGES, makeRunnerExecutor } from "../src/judge.js";

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
check("正确代码：status=pass，两组都 ok", r.status === "pass" && r.cases.every((c) => c.ok && c.kind === KIND.PASS), JSON.stringify(r));
check("返回 totalMs 数字，cases 含 name/hidden/ok/kind", typeof r.totalMs === "number" && r.cases[1].hidden === true && r.cases[0].name === "样例");

r = await judge({ code: 'print("总价", price - cups)', tests: t1 }, pyExec);
check("错误代码：status=fail，kind=wrong-output", r.status === "fail" && r.cases[0].kind === KIND.WRONG && r.cases[0].actual.trim() === "总价 11");
check("隐藏用例失败不暴露 expected/actual", r.cases[1].ok === false && !("expected" in r.cases[1]) && !("actual" in r.cases[1]), JSON.stringify(r.cases[1]));
check("公开用例失败给出 expected/actual", r.cases[0].expected === "总价 60");

r = await judge({ code: "print(1/0)", tests: t1 }, pyExec);
check("运行出错：kind=error 且带错误类型", r.status === "fail" && r.cases[0].kind === KIND.ERROR && r.cases[0].error.kind === "ZeroDivisionError");

r = await judge({ code: "try:\n    seen\nexcept NameError:\n    seen = 0\nseen += 1\nprint(seen)", tests: [T("a", "1"), T("b", "1"), T("c", "1")] }, pyExec);
check("每组全新全局变量：上一组留下的变量不影响下一组", r.status === "pass", JSON.stringify(r.cases));

r = await judge({ code: "print('hi')   \nprint()\n", tests: [T("a", "hi\n")] }, pyExec);
check("行尾空白和末尾空行不影响比较", r.status === "pass");
check("normalizeOutput 统一 \\r\\n", normalizeOutput("a \r\nb\r\n\n") === "a\nb");
check("中间空行仍要匹配", normalizeOutput("a\n\nb") !== normalizeOutput("a\nb"));

// 时限：用小数字测逻辑（同样的分支，真实默认是 5s/10s）
let t = Date.now();
r = await judge({ code: "while True: pass", tests: [T("a", "")], limits: { caseMs: 500, totalMs: 2000 } }, pyExec);
check("死循环：单组超时 kind=case-timeout，消息说 5 秒", r.cases[0].kind === KIND.CASE_TIMEOUT && r.cases[0].message.includes("5 秒") && Date.now() - t < 1800, JSON.stringify(r));

pyExec.calls = 0; t = Date.now();
r = await judge({ code: "import time\ntime.sleep(0.4)\nprint('ok')", tests: [T("a", "ok"), T("b", "ok"), T("c", "ok"), T("d", "ok")], limits: { caseMs: 500, totalMs: 1000 } }, pyExec);
const kinds = r.cases.map((c) => c.kind);
check("总时限：超过后剩余用例 kind=total-timeout，消息说 10 秒、与单组超时不同", kinds[0] === "pass" && kinds[1] === "pass" && kinds.slice(2).every((k) => k === KIND.TOTAL_TIMEOUT) && r.cases[3].message.includes("10 秒") && MESSAGES[KIND.TOTAL_TIMEOUT] !== MESSAGES[KIND.CASE_TIMEOUT], kinds.join(","));
check("总时限后不再调用执行器（最多 3 次）", pyExec.calls <= 3, String(pyExec.calls));
check("总时限：整体耗时受控", Date.now() - t < 1700 && r.status === "fail", String(Date.now() - t));

r = await judge({ code: good, tests: t1 }, { exec: async () => { throw { unavailable: true }; } });
check("Python 不可用：status=unavailable（不算对错）", r.status === "unavailable" && r.cases[0].message === MESSAGES.unavailable);
r = await judge({ code: good, tests: t1 }, { exec: async () => { throw new Error("boom"); } });
check("执行器内部异常：status=internal-error", r.status === "internal-error");
r = await judge({ code: good, tests: t1 }, { exec: async () => ({ stdout: "", error: { kind: "InternalError", msg: "x" } }) });
check("worker 报 InternalError：status=internal-error（不算学生错）", r.status === "internal-error");
r = await judge({ code: good, tests: t1 }, { exec: async () => ({ stdout: "x", error: null, limitHit: true }) });
check("输出超限：kind=output-limit", r.cases[0].kind === KIND.OUTPUT_LIMIT && r.status === "fail");
r = await judge({ code: good, tests: t1, checkMode: "function" }, pyExec);
check("非 output 模式：internal-error（本 PR 只支持 U3 输出模式）", r.status === "internal-error");
r = await judge({ code: good, tests: [] }, pyExec);
check("没有用例：internal-error，不会误判 pass", r.status === "internal-error");

// Runner 适配器：用假 Runner 模拟 src/runner.js 的回调顺序
function fakeRunner(script) {
  const r = { state: "ready", onStatus() {}, onOutput() {}, stopped: 0,
    run(code, data) { if (r.state !== "ready") return false; r.state = "running"; queueMicrotask(() => script(r, code, data)); return true; },
    stop() { r.stopped++; r.state = "loading"; r.onStatus("stopped"); r.state = "ready"; } };
  return r;
}
let fr = fakeRunner((r) => { r.onStatus("running"); r.onOutput("总价 "); r.onOutput("60\n"); r.state = "ready"; r.onStatus("done", { error: null }); });
r = await judge({ code: good, tests: [T("a", "总价 60")] }, makeRunnerExecutor(fr));
check("Runner 适配器：拼接分段输出并判 pass，回调还原", r.status === "pass" && typeof fr.onStatus === "function");
fr = fakeRunner(() => {});
r = await judge({ code: "while True: pass", tests: [T("a", "")], limits: { caseMs: 100, totalMs: 1000 } }, makeRunnerExecutor(fr));
check("Runner 适配器：超时调用 stop() 并判 case-timeout", fr.stopped === 1 && r.cases[0].kind === KIND.CASE_TIMEOUT);
fr = fakeRunner(); fr.state = "loadError";
r = await judge({ code: good, tests: t1 }, makeRunnerExecutor(fr));
check("Runner 适配器：loadError → unavailable", r.status === "unavailable");
fr = fakeRunner((r) => { r.state = "ready"; r.onStatus("outputLimitStopped"); });
r = await judge({ code: good, tests: t1 }, makeRunnerExecutor(fr));
check("Runner 适配器：输出超限 → output-limit", r.cases[0].kind === KIND.OUTPUT_LIMIT);

console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
