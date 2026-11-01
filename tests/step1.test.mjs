// 第一步的自动测试：桌面版 Chromium 模拟手机屏幕（触摸）。不能代替 iPhone 真机测试。
// 准备：npm install && npx playwright install chromium
// 运行：npm run build && npm test
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const PORT = 4318;
const BASE = `http://localhost:${PORT}/`;
const server = spawn("npx", ["vite", "preview", "--port", String(PORT), "--strictPort"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 2500));

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(BASE + "lab.html");

  const status = () => page.locator("#status").textContent();
  const output = () => page.locator("#output").textContent();
  const waitReady = () => page.waitForFunction(() => window.__app.runner.state === "ready", null, { timeout: 60000 });
  const S = () => page.evaluate(() => { const v = window.__app.view; const s = v.state.selection.main; return { doc: v.state.doc.toString(), from: s.from, to: s.to }; });
  const setDoc = (text, a = text.length, h = a) => page.evaluate(([t, a, h]) => {
    const v = window.__app.view; v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: t }, selection: { anchor: a, head: h } });
  }, [text, a, h]);
  // 真实触摸点按键
  const key = (k) => page.locator(`.kb-key[data-key=${JSON.stringify(k)}]`).first();
  const tap = async (k) => key(k).tap();
  const layer = async (sym) => { const want = sym ? "{123}" : "{abc}"; if (await key(want).count()) await tap(want); };
  const tapRun = () => page.locator("#run").tap();
  const runAndWait = async (code) => {
    await setDoc(code);
    await tapRun();
    await page.waitForFunction(() => window.__app.runner.state === "ready" && !/运行中/.test(document.getElementById("status").textContent), null, { timeout: 20000 });
    return output();
  };
  const runData = (code, data) => page.evaluate(([c, d]) => new Promise((resolve) => {
    const r = window.__app.runner;
    let out = "";
    const prevOut = r.onOutput, prevStatus = r.onStatus;
    r.onOutput = (t) => { out += t; };
    r.onStatus = (s, info) => { if (s === "done") { r.onOutput = prevOut; r.onStatus = prevStatus; prevStatus(s, info); resolve({ out, error: info.error }); } };
    r.run(c, d);
  }), [code, data]);

  const t0 = Date.now();
  await waitReady();
  check("Python 在页面打开后自动加载", true, `${((Date.now() - t0) / 1000).toFixed(1)} 秒（桌面沙箱，非手机）`);

  await page.locator(".cm-content").tap();
  await tap("p");
  check("触摸按键后编辑器仍保持焦点", await page.evaluate(() => document.activeElement?.classList.contains("cm-content")) && (await S()).doc === "p");
  check("默认不弹系统键盘（inputmode=none）", (await page.locator(".cm-content").getAttribute("inputmode")) === "none");

  // ---------- A06 括号 ----------
  await setDoc(""); await tap("("); let s = await S();
  check("A06 输入 ( 自动补 )，光标在中间", s.doc === "()" && s.from === 1);
  await tap(")"); s = await S();
  check("A06 再输入 ) 跳过已有右括号", s.doc === "()" && s.from === 2);
  await setDoc(""); await tap("("); await tap("{backspace}"); s = await S();
  check("A06 空配对中退格同时删除", s.doc === "");
  await setDoc("abc", 0, 3); await tap('"'); s = await S();
  check("A06 选中文字输入引号会包裹", s.doc === '"abc"', JSON.stringify(s.doc));
  await setDoc("x", 1); await tap(")"); s = await S();
  check("A06 无配对时 ) 正常插入", s.doc === "x)");

  // ---------- A07 缩进 ----------
  await setDoc("", 0); await tap("{tab}"); s = await S();
  check("A07 Tab 插入 4 个空格", s.doc === "    ");
  await setDoc("if x:\n    a\nb", 0, 13); await tap("{tab}"); s = await S();
  check("A07 多行选区逐行缩进", s.doc === "    if x:\n        a\n    b", JSON.stringify(s.doc));
  await tap("{untab}"); await tap("{untab}"); s = await S();
  check("A07 退缩进最多删 4 个空格且不删正文", s.doc === "if x:\na\nb", JSON.stringify(s.doc));
  const enterCase = async (text, want, name) => { await setDoc(text); await tap("{enter}"); const d = (await S()).doc; check(name, d === want, JSON.stringify(d)); };
  await enterCase("for i in range(3):", "for i in range(3):\n    ", "A07 冒号后回车自动缩进");
  await enterCase("    x = 1", "    x = 1\n    ", "A07 普通行回车延续缩进");
  await enterCase("if True: # 注释", "if True: # 注释\n    ", "A07 冒号后有注释，仍然缩进");
  await enterCase("for n in range(3):  # 循环", "for n in range(3):  # 循环\n    ", "A07 for 行带注释，仍然缩进");
  await enterCase("# comment:", "# comment:\n", "A07 注释里的冒号不触发缩进");
  await enterCase('print("a:")', 'print("a:")\n', "A07 字符串里的冒号不触发缩进");

  // 外接键盘 Tab / Shift+Tab
  await setDoc("x"); await page.locator(".cm-content").focus(); await page.keyboard.press("Home");
  await page.keyboard.press("Tab"); s = await S();
  const stillFocused = await page.evaluate(() => document.activeElement?.classList.contains("cm-content"));
  check("外接键盘 Tab 缩进，焦点不离开编辑区", s.doc === "    x" && stillFocused, JSON.stringify(s.doc));
  await page.keyboard.press("Shift+Tab"); s = await S();
  check("外接键盘 Shift+Tab 退缩进", s.doc === "x", JSON.stringify(s.doc));

  // ---------- A08 编辑 ----------
  await setDoc("ac", 1); await tap("b"); s = await S();
  check("A08 中间插入", s.doc === "abc" && s.from === 2);
  await setDoc("hello", 1, 4); await tap("a"); s = await S();
  check("A08 输入替换选区", s.doc === "hao");
  await setDoc("ab", 2); await tap("{left}"); await tap("{left}"); await tap("{right}"); await tap("x"); s = await S();
  check("A08 左右移动后插入位置正确", s.doc === "axb");
  await setDoc("");
  for (let i = 0; i < 25; i++) await tap("a");
  for (let i = 0; i < 20; i++) await tap("{undo}");
  s = await S();
  check("A08 撤销 20 步（每次按键一步）", s.doc === "aaaaa", `剩余 ${JSON.stringify(s.doc)}`);

  // 标准按钮激活（外接键盘 Enter / 读屏）
  await setDoc("");
  await page.waitForTimeout(900); // 与上一次触摸隔开，模拟外接键盘操作
  await key("q").focus(); await page.keyboard.press("Enter");
  check("字母键可用键盘 Enter 激活，且只输入一次", (await S()).doc === "q", JSON.stringify((await S()).doc));
  await setDoc("print(7)");
  await page.waitForTimeout(900);
  await page.locator("#run").focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => /运行成功/.test(document.getElementById("status").textContent));
  check("Run 可用键盘 Enter 激活", (await output()) === "7\n", JSON.stringify(await output()));

  // ---------- A10 运行 ----------
  let out = await runAndWait("print(2 + 3)");
  check("A10 print(2 + 3) 输出 5", out === "5\n", JSON.stringify(out));
  out = await runAndWait("x = 1");
  check("A10 无输出时明确提示，不残留上一轮", out === "程序运行完成，没有输出", JSON.stringify(out));
  out = await runAndWait("print('x' in globals())");
  check("A10 变量不跨轮泄漏", out === "False\n", JSON.stringify(out));
  out = await runAndWait("print('你好，世界')");
  check("中文输出正常", out === "你好，世界\n", JSON.stringify(out));
  out = await runAndWait('print("HELLO", end="")');
  check("无换行输出也能显示", out === "HELLO", JSON.stringify(out));
  out = await runAndWait('print("SECOND")');
  check("无换行输出不会混入下一轮", out === "SECOND\n", JSON.stringify(out));

  // 测试数据注入（下一步判分要用）
  let r = await runData("print(sum(nums)/len(nums))", { nums: [2, 4, 6] });
  check("注入测试数据：平均值输出 4.0", r.out === "4.0\n" && !r.error, JSON.stringify(r));
  r = await runData("print(sum(nums)/len(nums))", { nums: [1, 2, 3, 6] });
  check("第二组数据重新注入，不复用上一组", r.out === "3.0\n" && !r.error, JSON.stringify(r));
  r = await runData("print(nums[10])", { nums: [1] });
  check("数据题出错时报告用户错误", r.error && r.error.kind === "IndexError" && r.error.line === 1, JSON.stringify(r.error));
  r = await runData("print(len(nums))", { nums: [1, 2] });
  check("出错后下一次数据运行正常", r.out === "2\n" && !r.error, JSON.stringify(r));

  // ---------- A12 错误 ----------
  out = await runAndWait("if True\n    print(1)");
  check("A12 缺冒号：显示 SyntaxError 和行号", /SyntaxError（第 1 行）/.test(out), out.split("\n")[0]);
  check("A12 出错后代码保留", (await S()).doc === "if True\n    print(1)");
  out = await runAndWait("a = 1\nprint(b)");
  check("A12 未定义变量：NameError 第 2 行，无内部调用帧", /NameError（第 2 行）/.test(out) && !/pyodide|_pyodide|eval\(/.test(out), out.split("\n")[0]);
  out = await runAndWait("print(1 / 0)");
  check("A12 除以零有中文说明", /ZeroDivisionError/.test(out) && /除数不能是 0/.test(out));
  out = await runAndWait("if True:\n    print('fixed')");
  check("A12 修复后无需刷新即可再运行", out === "fixed\n");
  out = await runAndWait("input()");
  check("不支持 input() 时给出说明", /暂不支持 input/.test(out));
  out = await runAndWait('raise ValueError("x" * 100000)');
  check("超长错误信息被截断", out.length < 1000 && /已截断/.test(out), `长度 ${out.length}`);

  // ---------- 输出上限（UTF-8 字节） ----------
  const bytes = (t) => Buffer.byteLength(t, "utf8");
  const userPart = (o) => o.split("\n⚠")[0];
  out = await runAndWait('print("中" * 3000)');
  check("中文输出按 UTF-8 字节限制在 8 KiB 内", bytes(userPart(out)) <= 8192 && /输出超过/.test(out) && !out.includes("\uFFFD"), `${bytes(userPart(out))} 字节`);
  out = await runAndWait('print("😀" * 3000)');
  check("表情符号不被切坏", bytes(userPart(out)) <= 8192 && !out.includes("\uFFFD"), `${bytes(userPart(out))} 字节`);
  out = await runAndWait('print("x" * 250000)');
  check("单次超大输出被截断到 8 KiB", bytes(userPart(out)) <= 8192 && /输出超过/.test(out), `${bytes(userPart(out))} 字节`);
  out = await runAndWait("i = 0\nwhile True:\n    print(i)\n    i += 1");
  check("A13 无限输出：最多 100 行后停止", userPart(out).split("\n").filter(Boolean).length <= 100 && /输出超过/.test(out), `${userPart(out).split("\n").filter(Boolean).length} 行`);
  out = await runAndWait("print('after limit')");
  check("达到上限后可正常再运行", out === "after limit\n");

  // ---------- A13 超时 / Stop ----------
  await setDoc("while True:\n    pass");
  let t = Date.now();
  await tapRun();
  await page.waitForTimeout(1000);
  const runningNow = await page.evaluate(() => window.__app.runner.state === "running");
  await tap("z");
  const editedWhileRunning = (await S()).doc.endsWith("z");
  check("A13 死循环运行中，界面仍可输入", runningNow && editedWhileRunning);
  await page.waitForFunction(() => document.getElementById("output").textContent.includes("超过 5 秒"), null, { timeout: 15000 });
  const el = (Date.now() - t) / 1000;
  check("A13 死循环在约 5 秒时自动停止", el >= 4.5 && el <= 7.5, `${el.toFixed(1)} 秒`);
  t = Date.now(); await waitReady();
  check("A13 停止后自动重新加载", true, `${((Date.now() - t) / 1000).toFixed(1)} 秒`);
  check("A13 草稿保留", (await S()).doc === "while True:\n    passz");
  out = await runAndWait("print('ok')");
  check("A13 之后正常程序可运行", out === "ok\n");

  await setDoc("while True:\n    pass");
  await tapRun();
  await page.waitForTimeout(500);
  t = Date.now();
  await page.locator("#stop").tap();
  check("A13 Stop 立即停止", (await output()).includes("已停止") && Date.now() - t < 1000);
  await waitReady();

  // ---------- A14 连点 / 旧结果 ----------
  await setDoc("print(1)");
  await page.evaluate(() => { const b = document.getElementById("run"); for (let i = 0; i < 3; i++) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true })); });
  await page.waitForFunction(() => /运行成功/.test(document.getElementById("status").textContent));
  check("A14 连点 Run 只执行一次", (await output()) === "1\n", JSON.stringify(await output()));

  // 运行中线程崩溃 → 重试 → 旧计时器不能误杀新线程
  await setDoc("while True:\n    pass");
  await tapRun();
  await page.waitForTimeout(300);
  await page.evaluate(() => { const r = window.__app.runner; r.worker.onerror(new ErrorEvent("error", { message: "模拟崩溃" })); });
  check("运行中崩溃：显示加载失败", /加载失败|出错/.test(await status()), await status());
  await page.evaluate(() => window.__app.runner.boot());
  await waitReady();
  await page.waitForTimeout(6000); // 超过旧的 5 秒计时器
  check("崩溃后重试：旧计时器没有终止新线程", await page.evaluate(() => window.__app.runner.state === "ready"));
  out = await runAndWait("print('alive')");
  check("崩溃重试后可以正常运行", out === "alive\n");

  // 加载失败 → 重试
  await page.evaluate((base) => { const r = window.__app.runner; Object.defineProperty(r, "indexURL", { configurable: true, get: () => base + "no-such-dir/" }); r.boot(); }, BASE);
  await page.waitForFunction(() => window.__app.runner.state === "loadError", null, { timeout: 30000 });
  check("运行资源加载失败时如实提示", /加载失败/.test(await status()), (await status()).slice(0, 40));
  await page.evaluate(() => { delete window.__app.runner.indexURL; });
  await page.locator("#run").tap(); // 失败状态下点 Run = 重试
  await waitReady();
  out = await runAndWait("print('retry ok')");
  check("加载失败后点 Run 重试成功", out === "retry ok\n");

  // ---------- 系统键盘切换 ----------
  await setDoc("print(1)");
  await tap("{system}");
  const sys = { im: await page.locator(".cm-content").getAttribute("inputmode"), kb: await page.locator("#keyboard").isHidden() };
  await page.locator("#back-to-kb").tap();
  const back = { im: await page.locator(".cm-content").getAttribute("inputmode"), kb: await page.locator("#keyboard").isHidden() };
  check("切换系统键盘再切回，内容不丢", sys.im === "text" && sys.kb && back.im === "none" && !back.kb && (await S()).doc === "print(1)");

  // ---------- A19（部分）宽度与按键尺寸 ----------
  for (const w of [360, 390, 430]) {
    await page.setViewportSize({ width: w, height: 800 });
    const m = await page.evaluate(() => {
      const keys = [...document.querySelectorAll(".kb-key")].map((b) => b.getBoundingClientRect());
      return { overflow: document.documentElement.scrollWidth > window.innerWidth, minW: Math.min(...keys.map((k) => k.width)), minH: Math.min(...keys.map((k) => k.height)) };
    });
    check(`宽度 ${w}px：无横向溢出，按键 ≥32×44`, !m.overflow && m.minW >= 31.5 && m.minH >= 44, `最小按键 ${m.minW.toFixed(1)}×${m.minH.toFixed(1)}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tests/step1-390.png" });

  check("页面无脚本错误", errors.length === 0, errors.join(" | "));
} finally {
  await browser.close();
  server.kill();
}
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
