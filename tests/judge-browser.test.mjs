// 判题核心 + 真实 Runner（真 Pyodide、真 Worker）在 WebKit 和 Chromium 里跑。
// 运行：npm run copy-pyodide && node tests/judge-browser.test.mjs
// 浏览器启动失败 → 输出“环境失败”并 exit 2（不算测试通过）。
import { createServer } from "vite";
import { webkit, chromium } from "playwright";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${name}${ok ? "" : "  — " + extra}`); };

const server = await createServer({ configFile: false, root: process.cwd(), logLevel: "error", server: { port: 5199, strictPort: true }, worker: { format: "es" } });
await server.listen();
const URL = "http://localhost:5199/tests/judge-browser.html";
const T = (name, expected, data, hidden) => ({ name, expected, data, hidden });

// 默认只跑 Chromium（CI 只装了它）；本机或独立的 WebKit job 用 JUDGE_BROWSERS=webkit,chromium
const BROWSERS = (process.env.JUDGE_BROWSERS || "chromium").split(",").map((x) => x.trim());
for (const [bn, bt] of [["WebKit", webkit], ["Chromium", chromium]].filter(([n]) => BROWSERS.includes(n.toLowerCase()))) {
  let browser;
  try { browser = await bt.launch(); } catch (e) { console.log(`环境失败：${bn} 启动失败 ${e.message.split("\n")[0]}`); await server.close(); process.exit(2); }
  const page = await browser.newPage();
  const errs = []; page.on("pageerror", (e) => errs.push(e.message));
  let block = true;
  await page.route("**/pyodide/pyodide.mjs", (r) => (block ? r.abort() : r.continue()));
  await page.goto(URL); await page.waitForFunction(() => window.pageReady);
  const J = (a) => page.evaluate((a) => window.J(a), a);
  const tag = (s) => `[${bn}] ${s}`;

  // 1. 首次加载被网络挡住 → unavailable；恢复网络后同一个 Runner 能恢复
  let r = await J({ code: 'print("总价", price * cups)', tests: [T("a", "总价 60", { price: 15, cups: 4 })], limits: { readyCapMs: 20000 } });
  check(tag("加载失败（pyodide.mjs 被挡）→ unavailable，不算作答，retry"), r.status === "unavailable" && !r.attempt && !r.settle && r.retry, JSON.stringify(r));
  block = false;
  const t0 = Date.now();
  r = await J({ code: 'print("总价", price * cups)', tests: [T("样例", "总价 60", { price: 15, cups: 4 }), T("隐藏", "总价 0", { price: 9, cups: 0 }, true), T("大数", "总价 1000000", { price: 1000, cups: 1000 })] });
  const wall = Date.now() - t0;
  check(tag("恢复网络后重新加载并判 pass（多组输入）"), r.status === "pass" && r.settle && r.cases.length === 3, JSON.stringify(r));
  check(tag(`首次加载时间（墙钟 ${wall}ms）不计入 totalMs（${r.totalMs}ms）`), r.totalMs < 2000 && wall > r.totalMs, `${wall} ${r.totalMs}`);

  r = await J({ code: 'print("总价", price - cups)', tests: [T("样例", "总价 60", { price: 15, cups: 4 }), T("隐藏", "总价 0", { price: 9, cups: 0 }, true)] });
  check(tag("错误代码 → fail，隐藏组不暴露输出"), r.status === "fail" && r.cases[0].stdout.trim() === "总价 11" && !("stdout" in r.cases[1]));

  r = await J({ code: "try:\n    seen\nexcept NameError:\n    seen = 0\nseen += 1\nprint(seen)", tests: [T("a", "1"), T("b", "1")] });
  check(tag("真实 Worker：每组全新全局变量"), r.status === "pass", JSON.stringify(r.cases));

  r = await J({ code: "print(1/0)", tests: [T("a", "")] });
  check(tag("运行出错 → error ZeroDivisionError"), r.cases[0].kind === "error" && r.cases[0].error.kind === "ZeroDivisionError");

  r = await J({ code: "print('hi')\nprint()", tests: [T("a", "hi")] });
  check(tag("strict：多余空行 → wrong-output；lenient 声明时通过"), r.cases[0].kind === "wrong-output" && (await J({ code: "print('hi ')\nprint()", tests: [T("a", "hi")], compare: "lenient" })).status === "pass");

  // 2. 死循环超时 → 重启 → 下一组正常（不误报 unavailable），重启时间不计入
  const t1 = Date.now();
  r = await J({ code: "if n == 0:\n    while True: pass\nprint(n)", tests: [T("loop", "0", { n: 0 }), T("b", "1", { n: 1 }), T("c", "2", { n: 2 })], limits: { caseMs: 1500, totalMs: 10000 } });
  const wall2 = Date.now() - t1;
  check(tag("死循环 → case-timeout；重启后后面两组照常 pass"), r.cases.map((c) => c.kind).join() === "case-timeout,pass,pass" && r.status === "fail" && r.settle, JSON.stringify(r.cases.map((c) => c.kind)));
  check(tag(`超时重启的加载时间不计入（墙钟 ${wall2}ms，totalMs ${r.totalMs}ms）`), r.totalMs < 2500 && wall2 > r.totalMs + 300, `${wall2} ${r.totalMs}`);
  r = await J({ code: "print(7)", tests: [T("a", "7")] });
  check(tag("超时之后再判题一次也正常"), r.status === "pass");
  // 3. 新字段（真实 Pyodide）：input / 文件 / 多文件 / call
  r = await J({ code: 'n = input("数量:")\nprint(int(n) * 15)', tests: [T("a", "数量:45", { stdin: ["3"] }), T("b", "数量:0", { stdin: ["0"] })] });
  check(tag("input：stdin 逐组传入"), r.status === "pass", JSON.stringify(r.cases));
  r = await J({ files: [{ path: "main.py", content: "import shop\nprint(shop.total(2))\nopen('o.txt','w').write('x')" }, { path: "shop.py", content: "def total(n):\n    return n * 15" }], tests: [{ name: "a", expected: "30", expectedFiles: { "o.txt": "x" } }] });
  check(tag("多文件 + 输出文件检查"), r.status === "pass", JSON.stringify(r.cases));
  r = await J({ code: "def price(n):\n    return n * 15\n", checkMode: "call", tests: [{ name: "a", call: { fn: "price", args: [3] }, expectedReturn: 45 }, { name: "b", call: { fn: "price", args: [0] }, expectedReturn: 1 }] });
  check(tag("call 模式：按返回值判"), r.status === "fail" && r.cases[0].ok && r.cases[1].kind === "wrong-return" && r.cases[1].actualReturn === "0", JSON.stringify(r.cases));
  r = await J({ code: "input()", tests: [T("a", "")] });
  check(tag("没有 stdin 却调用 input()：算答错（不是环境问题），提示没有输入数据"), r.status === "fail" && /没有输入数据/.test(r.cases[0].error.msg), JSON.stringify(r.cases));

  // 4. 默认限时（5 秒 / 10 秒）真实跑一次：死循环 → 约 5 秒后 case-timeout，提示写 5 秒
  const t2 = Date.now();
  r = await J({ code: "while True: pass", tests: [T("loop", ""), T("b", "")] });
  const wall3 = Date.now() - t2;
  check(tag(`默认限时：死循环约 5 秒结束（墙钟 ${wall3}ms），消息写 5 秒`), r.cases[0].kind === "case-timeout" && /5 秒/.test(r.cases[0].message) && r.totalMs >= 4900 && r.totalMs < 5900, `${r.totalMs} ${r.cases[0].message}`);
  check(tag(`默认限时：两组都死循环 → 合计不超过 10 秒预算，结果完整（${r.cases.map((c) => c.kind).join()}，墙钟 ${wall3}ms）`), r.cases.length === 2 && r.settle && r.totalMs <= 10500 && r.cases[1].kind !== "pass", JSON.stringify(r.cases.map((c) => c.kind)));
  const st = await page.evaluate(() => [window.runner.state, typeof window.runner.onStatus]);
  check(tag("结束后 Runner 为 ready，回调已还原"), st[0] === "ready");
  check(tag("无页面脚本错误"), errs.length === 0, errs.join(" | "));
  await browser.close();
}
await server.close();
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
