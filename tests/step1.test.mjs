// 第一步的自动测试：桌面版 Chromium 模拟手机屏幕。不能代替 iPhone 真机测试。
// 运行：npm run build && npm test
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); }
catch { ({ chromium } = require(require("node:child_process").execSync("npm root -g").toString().trim() + "/playwright")); }

const PORT = 4318;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`http://localhost:${PORT}/`);
  const t0 = Date.now();
  await page.waitForFunction(() => document.getElementById("status").textContent.includes("已就绪"), null, { timeout: 60000 });
  check("Python 在页面打开后自动加载", true, `${((Date.now() - t0) / 1000).toFixed(1)} 秒（桌面沙箱，非手机）`);

  const S = () => page.evaluate(() => { const v = window.__app.view; const s = v.state.selection.main; return { doc: v.state.doc.toString(), from: s.from, to: s.to }; });
  const setDoc = (text, a = text.length, h = a) => page.evaluate(([t, a, h]) => {
    const v = window.__app.view; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t }, selection: { anchor: a, head: h } });
  }, [text, a, h]);
  const press = (k) => page.evaluate((k) => {
    const b = [...document.querySelectorAll(".kb-key")].find((b) => b.dataset.key === k);
    if (!b) throw new Error("找不到按键 " + k);
    b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));
  }, k);
  const toLayer = async (sym) => { const want = sym ? "{123}" : "{abc}"; if (await page.evaluate((w) => !![...document.querySelectorAll(".kb-key")].find((b) => b.dataset.key === w), want)) await press(want); };

  // 真实点击一次：按键不能抢走编辑器焦点
  await page.locator(".cm-content").click();
  await page.locator('[data-key="p"]').click();
  const focusOk = await page.evaluate(() => document.activeElement?.classList.contains("cm-content"));
  check("点按键后编辑器仍保持焦点", focusOk && (await S()).doc === "p");
  const im = await page.evaluate(() => document.querySelector(".cm-content").getAttribute("inputmode"));
  check("默认不弹系统键盘（inputmode=none）", im === "none", `inputmode=${im}`);

  // A06 括号
  await setDoc(""); await press("("); let s = await S();
  check("A06 输入 ( 自动补 )，光标在中间", s.doc === "()" && s.from === 1);
  await press(")"); s = await S();
  check("A06 再输入 ) 跳过已有右括号", s.doc === "()" && s.from === 2);
  await setDoc(""); await press("("); await press("{backspace}"); s = await S();
  check("A06 空配对中退格同时删除", s.doc === "");
  await setDoc("abc", 0, 3); await press('"'); s = await S();
  check("A06 选中文字输入引号会包裹", s.doc === '"abc"', JSON.stringify(s.doc));
  await setDoc("x", 1); await press(")"); s = await S();
  check("A06 无配对时 ) 正常插入", s.doc === "x)");

  // A07 缩进
  await toLayer(false);
  await setDoc("", 0); await press("{tab}"); s = await S();
  check("A07 Tab 插入 4 个空格", s.doc === "    ");
  await setDoc("if x:\n    a\nb", 0, 13); await press("{tab}"); s = await S();
  check("A07 多行选区逐行缩进", s.doc === "    if x:\n        a\n    b", JSON.stringify(s.doc));
  await press("{untab}"); await press("{untab}"); s = await S();
  check("A07 退缩进最多删 4 个空格且不删正文", s.doc === "if x:\na\nb", JSON.stringify(s.doc));
  await setDoc("for i in range(3):"); await press("{enter}"); s = await S();
  check("A07 冒号后回车自动缩进", s.doc === "for i in range(3):\n    ", JSON.stringify(s.doc));
  await setDoc("    x = 1"); await press("{enter}"); s = await S();
  check("A07 普通行回车延续缩进", s.doc === "    x = 1\n    ", JSON.stringify(s.doc));

  // A08 编辑
  await setDoc("ac", 1); await press("b"); s = await S();
  check("A08 中间插入", s.doc === "abc" && s.from === 2);
  await setDoc("hello", 1, 4); await press("a"); s = await S();
  check("A08 输入替换选区", s.doc === "hao");
  await setDoc("ab", 2); await press("{left}"); await press("{left}"); await press("{right}"); await press("x"); s = await S();
  check("A08 左右移动后插入位置正确", s.doc === "axb");
  await setDoc("");
  await page.evaluate(() => { const v = window.__app.view; v.dispatch({ effects: [] }); });
  for (let i = 0; i < 25; i++) await press("a");
  for (let i = 0; i < 20; i++) await press("{undo}");
  s = await S();
  check("A08 撤销 20 步（每次按键一步）", s.doc === "aaaaa", `剩余 ${JSON.stringify(s.doc)}`);

  // 运行相关
  const run = async (code) => {
    await setDoc(code);
    await page.evaluate(() => document.getElementById("run").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
    await page.waitForFunction(() => /运行成功|运行出错/.test(document.getElementById("status").textContent), null, { timeout: 15000 });
    return page.evaluate(() => document.getElementById("output").textContent);
  };
  const waitReady = () => page.waitForFunction(() => document.getElementById("status").textContent.includes("已就绪"), null, { timeout: 60000 });

  // A10
  let out = await run("print(2 + 3)");
  check("A10 print(2 + 3) 输出 5", out.trim() === "5", JSON.stringify(out));
  out = await run("x = 1");
  check("A10 无输出时明确提示，不残留上一轮", out === "程序运行完成，没有输出", JSON.stringify(out));
  out = await run("print('x' in globals())");
  check("A10 变量不跨轮泄漏", out.trim() === "False", JSON.stringify(out));
  out = await run("print('你好，世界')");
  check("中文输出正常", out.trim() === "你好，世界", JSON.stringify(out));

  // A12
  out = await run("if True\n    print(1)");
  check("A12 缺冒号：显示 SyntaxError 和行号", /SyntaxError（第 1 行）/.test(out), out.split("\n")[0]);
  const keep = (await S()).doc;
  check("A12 出错后代码保留", keep === "if True\n    print(1)");
  out = await run("a = 1\nprint(b)");
  check("A12 未定义变量：NameError 第 2 行，无内部调用帧", /NameError（第 2 行）/.test(out) && !/pyodide|_pyodide|eval\(/.test(out), out.split("\n")[0]);
  out = await run("print(1 / 0)");
  check("A12 除以零有中文说明", /ZeroDivisionError/.test(out) && /除数不能是 0/.test(out));
  out = await run("if True:\n    print('fixed')");
  check("A12 修复后无需刷新即可再运行", out.trim() === "fixed");
  out = await run("input()");
  check("不支持 input() 时给出说明", /暂不支持 input/.test(out));

  // A13 超时
  await setDoc("while True:\n    pass");
  let t = Date.now();
  await page.evaluate(() => document.getElementById("run").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
  await page.waitForFunction(() => document.getElementById("output").textContent.includes("超过 5 秒"), null, { timeout: 15000 });
  check("A13 死循环 5 秒后自动停止", true, `${((Date.now() - t) / 1000).toFixed(1)} 秒`);
  const uiAlive = await page.evaluate(() => { const v = window.__app.view; v.dispatch(v.state.replaceSelection("")); return true; });
  check("A13 运行死循环时界面仍可操作", uiAlive);
  t = Date.now(); await waitReady();
  check("A13 停止后自动重新加载", true, `${((Date.now() - t) / 1000).toFixed(1)} 秒`);
  check("A13 草稿保留", (await S()).doc === "while True:\n    pass");
  out = await run("print('ok')");
  check("A13 之后正常程序可运行", out.trim() === "ok");

  // A13 Stop 按钮
  await setDoc("while True:\n    pass");
  await page.evaluate(() => document.getElementById("run").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById("stop").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
  const stopped = await page.evaluate(() => document.getElementById("output").textContent.includes("已停止"));
  check("A13 Stop 立即停止", stopped);
  await waitReady();

  // A13 输出洪水
  await setDoc("i = 0\nwhile True:\n    print(i)\n    i += 1");
  await page.evaluate(() => document.getElementById("run").dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })));
  await page.waitForFunction(() => document.getElementById("output").textContent.includes("已停止"), null, { timeout: 15000 });
  const lines = await page.evaluate(() => document.getElementById("output").textContent.split("\n").length);
  check("A13 输出超限时停止（不超过 100 行），页面不卡", lines <= 102, `显示 ${lines} 行`);
  await waitReady();

  // A14 连点 Run
  await setDoc("print(1)");
  await page.evaluate(() => { const b = document.getElementById("run"); for (let i = 0; i < 3; i++) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); });
  await page.waitForFunction(() => /运行成功/.test(document.getElementById("status").textContent));
  out = await page.evaluate(() => document.getElementById("output").textContent);
  check("A14 连点 Run 只执行一次", out === "1\n", JSON.stringify(out));

  // 系统键盘切换
  await press("{system}");
  const sys = await page.evaluate(() => ({ im: document.querySelector(".cm-content").getAttribute("inputmode"), kb: document.getElementById("keyboard").hidden }));
  await page.locator("#back-to-kb").click();
  const back = await page.evaluate(() => ({ im: document.querySelector(".cm-content").getAttribute("inputmode"), kb: document.getElementById("keyboard").hidden }));
  check("切换系统键盘再切回，内容不丢", sys.im === "text" && sys.kb && back.im === "none" && !back.kb && (await S()).doc === "print(1)");

  // A19（部分）不同宽度无横向溢出、按键尺寸
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    const r = await page.evaluate(() => {
      const keys = [...document.querySelectorAll(".kb-key")].map((b) => b.getBoundingClientRect());
      return { overflow: document.documentElement.scrollWidth > window.innerWidth,
        minW: Math.min(...keys.map((k) => k.width)), minH: Math.min(...keys.map((k) => k.height)) };
    });
    check(`宽度 ${w}px：无横向溢出，按键 ≥32×44`, !r.overflow && r.minW >= 31.5 && r.minH >= 44, `最小按键 ${r.minW.toFixed(1)}×${r.minH.toFixed(1)}`);
  }
  await page.screenshot({ path: "tests/step1-390.png" });

  check("页面无脚本错误", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
