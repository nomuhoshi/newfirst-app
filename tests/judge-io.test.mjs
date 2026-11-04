// 判题器的 input / 文件 / 多文件 / call 模式测试：执行器用真实 CPython 加 src/py-task.js（和浏览器里 worker 用的是同一段 Python）。
// 运行：node tests/judge-io.test.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { judge, KIND, makeRunnerExecutor } from "../src/judge.js";
import { PY_TASK_HELPER } from "../src/py-task.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };

const dir = mkdtempSync(join(tmpdir(), "judgeio-"));
writeFileSync(join(dir, "helper.py"), PY_TASK_HELPER);
writeFileSync(join(dir, "driver.py"), `
import sys, json, io, contextlib
exec(open(sys.argv[1], encoding="utf-8").read())
opts = json.loads(sys.stdin.read())
buf = io.StringIO()
with contextlib.redirect_stdout(buf):
    r = _run_task(opts, opts.get("data"))
print(json.dumps({"stdout": buf.getvalue(), "error": r["error"], "files": r["files"]}, ensure_ascii=False))
`);
let seq = 0;
const exec = {
  calls: [],
  exec({ files, entry, data, stdin, readFiles, timeoutMs }) {
    this.calls.push({ files, entry, stdin, readFiles });
    return new Promise((resolve) => {
      const p = spawn("python3", ["-I", join(dir, "driver.py"), join(dir, "helper.py")]);
      let out = "", timedOut = false;
      const timer = setTimeout(() => { timedOut = true; p.kill("SIGKILL"); }, timeoutMs);
      p.stdout.on("data", (b) => (out += b));
      p.on("close", () => {
        clearTimeout(timer);
        if (timedOut) return resolve({ stdout: "", error: null, timedOut: true, limitHit: false });
        const r = JSON.parse(out);
        resolve({ stdout: r.stdout, error: r.error, files: r.files, timedOut: false, limitHit: false });
      });
      p.stdin.end(JSON.stringify({ id: ++seq, files, entry, data, stdin, read: readFiles }));
    });
  },
};
const T = (name, expected, extra = {}) => ({ name, expected, ...extra });

// ---------- input ----------
const askName = 'name = input("名字:")\nn = int(input())\nprint(name * n)';
let r = await judge({ code: askName, tests: [T("a", "名字:abab", { stdin: ["ab", "2"] }), T("b", "名字:x", { stdin: "x\n1\n" })] }, exec);
check("input：每组各自的 stdin，提示文字在输出里", r.status === "pass" && r.settle, JSON.stringify(r.cases));
r = await judge({ code: askName, tests: [T("a", "x")] }, exec);
check("input：没给 stdin → 运行出错（明确说没有输入数据），算答错而不是环境问题", r.status === "fail" && r.attempt && r.cases[0].kind === KIND.ERROR && /没有输入数据/.test(r.cases[0].error.msg), JSON.stringify(r.cases[0]));
r = await judge({ code: askName, tests: [T("a", "x", { stdin: ["ab"] })] }, exec);
check("input：输入不够 → EOFError，不挂起", r.cases[0].kind === KIND.ERROR && r.cases[0].error.kind === "EOFError", JSON.stringify(r.cases[0]));

// ---------- 多文件 ----------
const files = [{ path: "main.py", content: "from shop import total\nprint(total(3))" }, { path: "shop.py", content: "def total(n):\n    return n * 15" }];
r = await judge({ files, tests: [T("a", "45")] }, exec);
check("多文件：files + 默认入口 main.py", r.status === "pass", JSON.stringify(r.cases));
r = await judge({ files: [{ path: "app.py", content: "print('入口是 app.py')" }], entry: "app.py", tests: [T("a", "入口是 app.py")] }, exec);
check("多文件：自定义入口", r.status === "pass");
r = await judge({ files: [{ path: "a.py", content: "print(1)" }], tests: [T("a", "1")] }, exec);
check("多文件：缺少入口文件 → internal-error（出题错误，不算学生）", r.status === "internal-error" && !r.attempt);
r = await judge({ files: [{ path: "main.py", content: "import shop\nshop.boom()" }, { path: "shop.py", content: "def boom():\n    raise ValueError('坏了')" }], tests: [T("a", "")] }, exec);
check("多文件：出错时带文件名和行号", r.cases[0].kind === KIND.ERROR && r.cases[0].error.file === "shop.py" && r.cases[0].error.line === 2, JSON.stringify(r.cases[0].error));

// ---------- 文件 ----------
const fileCode = 'lines = open("names.txt").read().split()\nwith open("count.txt", "w") as f:\n    f.write(str(len(lines)))\nprint("ok")';
r = await judge({ code: fileCode, tests: [T("三个人", "ok", { files: { "names.txt": "a b c" }, expectedFiles: { "count.txt": "3" } }), T("一个人", "ok", { files: { "names.txt": "z" }, expectedFiles: { "count.txt": "1" } })] }, exec);
check("文件：测试提供输入文件，检查输出文件（每组独立）", r.status === "pass", JSON.stringify(r.cases));
r = await judge({ code: fileCode, tests: [T("a", "ok", { files: { "names.txt": "a b c" }, expectedFiles: { "count.txt": "4" } }), T("h", "ok", { hidden: true, files: { "names.txt": "a" }, expectedFiles: { "count.txt": "9" } })] }, exec);
check("文件：内容不对 → wrong-file，公开组给出期望和实际", r.cases[0].kind === KIND.WRONG_FILE && r.cases[0].files[0].actual === "3" && r.cases[0].files[0].expected === "4", JSON.stringify(r.cases[0]));
check("文件：隐藏组不暴露文件内容", r.cases[1].kind === KIND.WRONG_FILE && !("files" in r.cases[1]) && !("expected" in r.cases[1]));
r = await judge({ code: 'print("ok")', tests: [T("a", "ok", { expectedFiles: { "never.txt": "x" } })] }, exec);
check("文件：期望的文件没生成 → wrong-file（actual 为 null）", r.cases[0].kind === KIND.WRONG_FILE && r.cases[0].files[0].actual === null);
r = await judge({ code: 'open("names.txt","w").write("学生覆盖")\nprint(open("names.txt").read())', tests: [T("a", "学生覆盖", { files: { "names.txt": "原文件" } })] }, exec);
check("文件：学生可以改工作目录里的文件，但只影响这一组", r.status === "pass");

// ---------- call 模式 ----------
const C = (name, call, expectedReturn, extra = {}) => ({ name, call, expectedReturn, ...extra });
const price = "def price(n, vip=False):\n    p = n * 15\n    return p - 5 if vip else p\n";
r = await judge({ code: price, checkMode: "call", tests: [C("普通", { fn: "price", args: [3] }, 45), C("会员", { fn: "price", args: [3], kwargs: { vip: true } }, 40)] }, exec);
check("call：按返回值判，支持位置参数和关键字参数", r.status === "pass" && r.settle, JSON.stringify(r.cases));
r = await judge({ code: price + "print('这些输出不参与判题')\n", checkMode: "call", tests: [C("a", { fn: "price", args: [1] }, 15)] }, exec);
check("call：print 的输出不参与比较", r.status === "pass");
r = await judge({ code: price, checkMode: "call", tests: [C("a", { fn: "price", args: [3] }, 46), C("h", { fn: "price", args: [3] }, 46, { hidden: true })] }, exec);
check("call：返回值不对 → wrong-return，公开组显示期望和实际，隐藏组不显示", r.cases[0].kind === KIND.WRONG_RETURN && r.cases[0].expected === "46" && r.cases[0].actualReturn === "45" && !("actualReturn" in r.cases[1]) && !("expected" in r.cases[1]), JSON.stringify(r.cases));
const val = (v, e, extra) => judge({ code: `def f():\n    return ${v}\n`, checkMode: "call", tests: [C("a", { fn: "f" }, e, extra)] }, exec).then((x) => x.status === "pass");
check("call 比较：元组 ≡ 列表", await val("(1, 2)", [1, 2]));
check("call 比较：1 与 1.0 按值相同", await val("1.0", 1) && await val("1", 1.0));
check("call 比较：True 与 1 不同", !(await val("True", 1)) && !(await val("1", true)));
check("call 比较：0.1+0.2 与 0.3 在误差内相同；tol 可收紧", await val("0.1 + 0.2", 0.3) && !(await val("0.1 + 0.2", 0.3, { tol: 1e-20 })));
check("call 比较：字符串区分大小写；列表顺序要一致", !(await val("'Ab'", "ab")) && !(await val("[2, 1]", [1, 2])) && await val("{'a': [1, {'b': 2}]}", { a: [1, { b: 2 }] }));
check("call 比较：None 与 null", await val("None", null) && !(await val("0", null)));
r = await judge({ code: price, checkMode: "call", tests: [C("a", { fn: "cost", args: [1] }, 15)] }, exec);
check("call：函数名写错 → 错误提示点出函数名（算答错）", r.cases[0].kind === KIND.ERROR && /price|cost/.test(r.cases[0].error.msg) && r.status === "fail", JSON.stringify(r.cases[0]));
r = await judge({ code: "def f(a, b):\n    return a / b\n", checkMode: "call", tests: [C("除零", { fn: "f", args: [1, 0] }, 0)] }, exec);
check("call：函数里出错 → 带学生代码里的行号", r.cases[0].kind === KIND.ERROR && r.cases[0].error.kind === "ZeroDivisionError" && r.cases[0].error.line === 2, JSON.stringify(r.cases[0].error));
r = await judge({ code: "def f(a):\n    return a\n", checkMode: "call", tests: [C("多传参数", { fn: "f", args: [1, 2] }, 1)] }, exec);
check("call：参数个数不对 → TypeError，不显示判题器附加代码里的行号", r.cases[0].error.kind === "TypeError" && r.cases[0].error.line === null, JSON.stringify(r.cases[0].error));
r = await judge({ code: "def f():\n    return 1\nraise SystemExit\n", checkMode: "call", tests: [C("a", { fn: "f" }, 1)] }, exec);
check("call：学生代码提前退出，不会被误判通过", r.status === "fail" && r.cases[0].ok === false);

// ---------- 校验 ----------
const bad = async (a) => (await judge(a, exec)).status === "internal-error";
check("校验：call 缺 fn / fn 不是标识符 / 缺 expectedReturn → internal-error", await bad({ code: "x", checkMode: "call", tests: [{ name: "a", call: {}, expectedReturn: 1 }] }) && await bad({ code: "x", checkMode: "call", tests: [{ name: "a", call: { fn: "a;b" }, expectedReturn: 1 }] }) && await bad({ code: "x", checkMode: "call", tests: [{ name: "a", call: { fn: "f" } }] }));
check("校验：stdin 类型 / files 类型 / expectedFiles 类型不对 → internal-error", await bad({ code: "x", tests: [T("a", "", { stdin: 5 })] }) && await bad({ code: "x", tests: [T("a", "", { files: { a: 1 } })] }) && await bad({ code: "x", tests: [T("a", "", { expectedFiles: ["x"] })] }));
check("校验：output 模式 expected 不是字符串 → internal-error", await bad({ code: "x", tests: [{ name: "a" }] }));
r = await judge({ code: "x", files: [], tests: [T("a", "")] }, exec);
check("校验：files 是空数组 → internal-error", r.status === "internal-error");

// ---------- 提示文字跟着 limits 变 ----------
r = await judge({ code: "while True: pass", tests: [T("a", "")], limits: { caseMs: 700, totalMs: 4000 } }, exec);
check("限时提示跟着 limits 变（0.7 秒）", /0\.7 秒/.test(r.cases[0].message) && !/5 秒/.test(r.cases[0].message), r.cases[0].message);
check("默认限时提示是 5 秒 / 10 秒", /5 秒/.test((await import("../src/judge.js")).messageFor(KIND.CASE_TIMEOUT)) && /10 秒/.test((await import("../src/judge.js")).messageFor(KIND.TOTAL_TIMEOUT)));
check("自定义总时限提示（如 7 秒）", /7 秒/.test((await import("../src/judge.js")).messageFor(KIND.TOTAL_TIMEOUT, { caseMs: 2000, totalMs: 7000 })));

// ---------- 适配器 ----------
function fakeRunner() {
  const r = { state: "ready", onStatus() {}, onOutput() {}, runs: [], active: 0, maxActive: 0,
    boot() {}, whenReady() { return Promise.resolve("ready"); },
    run(code, data, task) { r.runs.push({ code, data, task }); r.active++; r.maxActive = Math.max(r.maxActive, r.active); r.state = "running"; setTimeout(() => { r.active--; r.state = "ready"; r.onOutput("ok\n"); r.onStatus("done", { error: null, files: { "out.txt": "x" } }); }, 30); return true; },
    stop() {} };
  return r;
}
const fr = fakeRunner();
const ex = makeRunnerExecutor(fr);
r = await judge({ files: [{ path: "main.py", content: "print('ok')" }, { path: "u.py", content: "" }], tests: [T("a", "ok", { stdin: ["1"], expectedFiles: { "out.txt": "x" } })] }, ex);
check("适配器：把 files / entry / stdin / read 交给 Runner，并把 files 带回判题", r.status === "pass" && fr.runs[0].task.entry === "main.py" && Object.keys(fr.runs[0].task.files).length === 2 && fr.runs[0].task.stdin[0] === "1" && fr.runs[0].task.read[0] === "out.txt", JSON.stringify(fr.runs[0]));
const both = await Promise.all([judge({ code: "print('ok')", tests: [T("a", "ok")] }, ex), judge({ code: "print('ok')", tests: [T("b", "ok")] }, ex)]);
check("适配器：同时发起两次判题会排队，同一时刻只有一个在跑，结果互不串", both.every((x) => x.status === "pass") && fr.maxActive === 1, `maxActive=${fr.maxActive}`);

rmSync(dir, { recursive: true, force: true });
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
