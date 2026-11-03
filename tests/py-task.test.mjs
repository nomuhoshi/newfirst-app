// 任务运行助手（src/py-task.js）的测试：用真实 CPython 在**同一个进程里**连续跑多组，验证隔离。
// 覆盖 stdin / input()、虚拟文件、多文件导入、模块缓存清理、随机种子、路径越界、当前目录和 sys.path 还原。
// 运行：node tests/py-task.test.mjs
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PY_TASK_HELPER } from "../src/py-task.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };

const dir = mkdtempSync(join(tmpdir(), "pytask-"));
const DRIVER = `
import sys, json, io, os, contextlib
exec(open(sys.argv[1], encoding="utf-8").read())
runs = json.load(open(sys.argv[2], encoding="utf-8"))
out = []
for opts in runs:
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        r = _run_task(opts)
    out.append({"stdout": buf.getvalue(), "error": r["error"], "files": r["files"], "cwd": os.getcwd(), "path0": sys.path[0], "leftover": os.path.exists("/tmp/_suipian_task/" + str(opts.get("id", 0)))})
print(json.dumps(out, ensure_ascii=False))
`;
writeFileSync(join(dir, "helper.py"), PY_TASK_HELPER);
writeFileSync(join(dir, "driver.py"), DRIVER);

function runAll(runs) {
  runs.forEach((r, i) => { r.id = r.id ?? i + 1; });
  writeFileSync(join(dir, "runs.json"), JSON.stringify(runs));
  const p = spawnSync("python3", ["-I", join(dir, "driver.py"), join(dir, "helper.py"), join(dir, "runs.json")], { encoding: "utf8" });
  if (p.status !== 0) throw new Error("python 失败：" + p.stderr);
  return JSON.parse(p.stdout);
}
const main = (src, more = {}) => ({ files: { "main.py": src }, ...more });

{
  const [a, b, c, d, e, f] = runAll([
    main('print("hi", x + 1)', { data: { x: 41 } }),
    main('name = input("名字:")\nage = input()\nprint(name, age)', { stdin: ["小明", "7"] }),
    main('input()\ninput()', { stdin: ["只有一行"] }),
    main('input()'),                                   // 没给 stdin
    main('print("a", end="")'),                        // 没有换行也要输出
    main('x = input()\nprint(x)', { stdin: "第一行\n第二行\n" }),
  ]);
  check("基本运行：注入 data", a.stdout === "hi 42\n" && !a.error, JSON.stringify(a));
  check("input()：提示文字写进标准输出，输入行不回显", b.stdout === "名字:小明 7\n" && !b.error, JSON.stringify(b.stdout));
  check("input() 读完 → EOFError（不挂起）", c.error?.kind === "EOFError" && c.error.line === 2, JSON.stringify(c.error));
  check("没给 stdin 时 input() 明确报错", d.error?.kind === "RuntimeError" && /没有输入数据/.test(d.error.msg), JSON.stringify(d.error));
  check("没有换行的输出也完整", e.stdout === "a");
  check("stdin 给字符串：按行拆分，末尾换行不多一行", f.stdout === "第一行\n", JSON.stringify(f.stdout));
  check("每次运行后：当前目录还原、sys.path 还原、临时目录已删除", [a, b, c, d, e, f].every((r) => r.cwd !== "/tmp/_suipian_task/1" && !r.cwd.includes("_suipian_task") && r.path0 !== "" && !r.leftover && !String(r.path0).includes("_suipian_task")), JSON.stringify([a.cwd, a.path0]));
}
{ // 文件
  const [a, b] = runAll([
    { files: { "main.py": 'print(open("in.txt").read().strip())\nwith open("out.txt","w") as f:\n    f.write("结果\\n")', "in.txt": "你好\n" }, read: ["out.txt", "none.txt"] },
    main('import os\nprint(os.path.exists("in.txt"), os.path.exists("out.txt"))'),
  ]);
  check("虚拟文件：读到 files 里的内容", a.stdout === "你好\n" && !a.error, JSON.stringify(a));
  check("虚拟文件：read 返回运行后写出的文件；不存在的是 null", a.files["out.txt"] === "结果\n" && a.files["none.txt"] === null, JSON.stringify(a.files));
  check("文件隔离：上一组写的文件，下一组看不到", b.stdout === "False False\n", JSON.stringify(b.stdout));
}
{ // 多文件 + 模块缓存
  const [a, b, c, d] = runAll([
    { files: { "main.py": "import util\nprint(util.VALUE)", "util.py": "VALUE = 1" } },
    { files: { "main.py": "import util\nprint(util.VALUE)", "util.py": "VALUE = 2" } },   // 同名模块，内容不同：不能读到旧缓存
    main("import util"),                                                                   // 上一组的模块不能残留
    { files: { "main.py": "import util\nutil.boom()", "util.py": "def boom():\n    return 1 / 0" } },
  ]);
  check("多文件：能 import 学生写的模块", a.stdout === "1\n" && !a.error, JSON.stringify(a));
  check("模块缓存：同名模块换了内容，第二组读到新内容", b.stdout === "2\n", JSON.stringify(b.stdout));
  check("模块清理：这一组没有 util.py，import 失败（上一组的不残留）", c.error?.kind === "ModuleNotFoundError", JSON.stringify(c.error));
  check("多文件出错：报告出错的文件和行号", d.error?.kind === "ZeroDivisionError" && d.error.file === "util.py" && d.error.line === 2, JSON.stringify(d.error));
}
{ // 全局变量与随机种子
  const [a, b, c, d] = runAll([
    main("import random\nsecret = 5\nprint(random.randint(1, 10**9))"),
    main("print('secret' in globals())\nimport random\nprint(random.randint(1, 10**9))"),
    main("import random\nprint(random.randint(1, 10**9))", { seed: 7 }),
    main("import random\nprint(random.randint(1, 10**9))", { seed: 7 }),
  ]);
  const r1 = a.stdout.trim(), r2 = b.stdout.split("\n")[1];
  check("变量隔离：上一组定义的变量在下一组不存在", b.stdout.startsWith("False\n"), b.stdout);
  check("随机数：默认种子相同，每组结果一致", r1 === r2, `${r1} vs ${r2}`);
  check("随机数：指定种子可复现，且和默认不同", c.stdout === d.stdout && c.stdout !== a.stdout);
}
{ // 错误
  const [a, b, c, d, e] = runAll([
    main("print('ok')\nif True print(1)"),
    { files: { "../escape.py": "x" } , entry: "main.py" },
    { files: { "main.py": "print(1)" }, read: ["../x"] },
    { files: { "a.py": "print(1)" } },                  // 没有入口
    main("import os\nos.chdir('/')\nprint('moved')"),
  ]);
  check("语法错误：行号和文件", a.error?.kind === "SyntaxError" && a.error.line === 2 && a.error.file === "main.py", JSON.stringify(a.error));
  check("路径越界（写）→ InternalError", b.error?.kind === "InternalError", JSON.stringify(b.error));
  check("路径越界（读）→ InternalError", c.error?.kind === "InternalError", JSON.stringify(c.error));
  check("缺少入口文件 → InternalError", d.error?.kind === "InternalError" && /main\.py/.test(d.error.msg), JSON.stringify(d.error));
  check("学生代码改了当前目录：运行后还原", e.stdout === "moved\n" && e.cwd !== "/", JSON.stringify([e.stdout, e.cwd]));
}
rmSync(dir, { recursive: true, force: true });
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
