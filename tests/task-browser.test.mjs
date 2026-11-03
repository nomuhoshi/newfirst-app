// 真实 Pyodide + 真实 Worker：input()、文件、多文件、每组隔离（Chromium；WebKit 由独立的 WebKit job 覆盖）。
// 运行：npm run copy-pyodide && node tests/task-browser.test.mjs
import { createServer } from "vite";
import { chromium } from "playwright";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };

const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { port: 5198, strictPort: true }, worker: { format: "es" } });
await server.listen();
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  await page.goto("http://localhost:5198/tests/task-browser.html");
  await page.waitForFunction(() => window.pageReady);
  const T = (code, task, data) => page.evaluate(([c, t, d]) => window.T(c, t, d), [code, task, data ?? null]);

  let r = await T('name = input("名字:")\nprint("你好", name)', { stdin: ["小明"] });
  check("真实 Pyodide：input() 读 stdin，提示写进输出", r.stdout === "名字:你好 小明\n" && !r.error, JSON.stringify(r));
  r = await T("input()", { stdin: [] });
  check("真实 Pyodide：输入用完 → EOFError", r.error?.kind === "EOFError", JSON.stringify(r.error));
  r = await T("input()", {});
  check("真实 Pyodide：没给 stdin → 明确报错", /没有输入数据/.test(r.error?.msg || ""), JSON.stringify(r.error));
  r = await T('print("null 参数")', { stdin: null, files: { "x.txt": "a" }, read: [], entry: "main.py" });
  check("真实 Pyodide：任务参数里的 null（如 stdin: null）等于没给，不会炸成 JsNull", r.stdout === "null 参数\n" && !r.error, JSON.stringify(r));
  r = await T("print(price * cups)", {}, { price: 15, cups: 4 });
  check("真实 Pyodide：任务运行也能注入 data", r.stdout === "60\n", JSON.stringify(r));

  r = await T('with open("out.txt", "w") as f:\n    f.write("结果")\nprint(open("in.txt").read())', { files: { "in.txt": "你好" }, read: ["out.txt", "none.txt"] });
  check("真实 Pyodide：虚拟文件读写，read 返回写出的文件", r.stdout === "你好\n" && r.files?.["out.txt"] === "结果" && r.files?.["none.txt"] === null, JSON.stringify(r));
  r = await T('import os\nprint(os.path.exists("in.txt"), os.path.exists("out.txt"))', {});
  check("真实 Pyodide：上一组的文件不残留", r.stdout === "False False\n", JSON.stringify(r));

  r = await T("", { files: { "main.py": "import util\nprint(util.V)", "util.py": "V = 1" } });
  const r2 = await T("", { files: { "main.py": "import util\nprint(util.V)", "util.py": "V = 2" } });
  const r3 = await T("", { files: { "main.py": "import util" } });
  check("真实 Pyodide：多文件 import；同名模块换内容读到新的；上一组模块不残留", r.stdout === "1\n" && r2.stdout === "2\n" && r3.error?.kind === "ModuleNotFoundError", JSON.stringify([r.stdout, r2.stdout, r3.error]));
  r = await T("", { files: { "main.py": "import util\nutil.boom()", "util.py": "def boom():\n    return 1 / 0" } });
  check("真实 Pyodide：多文件出错 → 报告文件名和行号", r.error?.kind === "ZeroDivisionError" && r.error.file === "util.py" && r.error.line === 2, JSON.stringify(r.error));
  r = await T("x = 1\nprint(1 +", {});
  check("真实 Pyodide：语法错误有行号", r.error?.kind === "SyntaxError" && r.error.line === 2, JSON.stringify(r.error));
  r = await T('print("普通运行不受影响")', null);
  check("普通运行（没有 task）行为不变", r.stdout === "普通运行不受影响\n" && !r.error && r.files === null, JSON.stringify(r));
  check("无页面脚本错误", errs.length === 0, errs.join(" | "));
} finally {
  await browser.close(); await server.close();
}
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
