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

for (const [bn, bt] of [["WebKit", webkit], ["Chromium", chromium]]) {
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
  const st = await page.evaluate(() => [window.runner.state, typeof window.runner.onStatus]);
  check(tag("结束后 Runner 为 ready，回调已还原"), st[0] === "ready");
  check(tag("无页面脚本错误"), errs.length === 0, errs.join(" | "));
  await browser.close();
}
await server.close();
console.log(`\n${pass} 通过，${fail} 失败`);
process.exit(fail ? 1 : 0);
