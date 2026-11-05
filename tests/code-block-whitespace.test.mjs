// 回归：题面代码块（predict / fill / order 里的 codeLine）必须保留缩进、运算符两侧和字符串内部的空格。
// 旧 bug：.lc 是 inline-flex，纯空格的裸文本节点被当作空白丢掉 → 缩进消失、"name = "a"" 的空格变少。
// 运行：npm run build && node tests/code-block-whitespace.test.mjs   （MOBILE_BROWSER=webkit|chromium，默认 chromium；DIST_DIR 可换构建目录）
// 判断方法不依赖具体字体：把每一行的实际渲染宽度，和同字体、white-space:pre 的“标准件”宽度对比。
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = resolve(process.env.DIST_DIR || join(ROOT, "dist"));
const PORT = 4365, BASE = `http://localhost:${PORT}/`;
const ENGINE = process.env.MOBILE_BROWSER || "chromium";
if (!["webkit", "chromium"].includes(ENGINE)) { console.log(`环境失败：未知 MOBILE_BROWSER=${ENGINE}`); process.exit(2); }
let playwright;
try { playwright = await import("playwright"); } catch (e) { try { const { createRequire } = await import("node:module"); playwright = createRequire("/")("playwright"); } catch { console.log(`环境失败：无法加载 playwright（${e.message}）`); process.exit(2); } }
if (!existsSync(join(DIST, "index.html"))) { console.log("环境失败：没有 dist/，请先 npm run build"); process.exit(2); }
let browser;
try { browser = await playwright[ENGINE].launch(); } catch (e) { console.log(`环境失败：${ENGINE} 无法启动（${String(e.message).split("\n")[0]}）`); process.exit(2); }
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm", ".svg": "image/svg+xml", ".wav": "audio/wav" };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; }
  s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));

let fails = 0;
const check = (name, ok, detail = "") => { if (!ok) fails++; console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };
const opts = [{ text: "a", correct: true, why: "" }, { text: "b", correct: false, why: "" }];
const LESSON = (ex) => ({ id: "TWS", title: "t", concept: "t", story: "t", introCode: "x = 1", exercises: [ex] });
const CODE_PRED = 'print(0)\n    print(i)\n    if i > 0:\n        print(i)\nname = "a  b"\ncups = 2\ntotal = cups * 3 + 1';
const LONG = 'print("' + "这一行很长很长 ".repeat(12) + 'END")';
const L = {
  predict: LESSON({ type: "predict", prompt: "q", code: CODE_PRED, options: opts }),
  fill: LESSON({ type: "fill", prompt: "q", code: 'for i in range(3):\n    if i {0} 1:\n        print(i)\nname = "a  b"', tokens: ["<", ">"], answer: ["<"], expected: "0", why: {}, hint: "h" }),
  order: LESSON({ type: "order", prompt: "q", lines: ["print(0)", "    print(i)", "        print(i + 1)"], shuffled: [2, 1, 0], answers: [[0, 1, 2]], expected: "0", hint: "h" }),
  long: LESSON({ type: "predict", prompt: "q", code: LONG, options: opts }),
};

async function mount(viewport, lesson) {
  const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: ENGINE === "chromium", serviceWorkers: "block" });
  const page = await ctx.newPage();
  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__app && window.__app.getState);
  await page.evaluate(() => { const st = window.__app.getState(); st.onboarded = true; st.installTipClosed = true; window.__app.persist(); window.__app.renderPath(); });
  if (!(await page.evaluate(() => typeof window.__app.startLesson))) throw new Error("window.__app.startLesson 不存在");
  await page.evaluate((x) => window.__app.startLesson(x, { review: false }), lesson);
  await page.getByRole("button", { name: /继续/ }).first().click();
  return { ctx, page };
}
// 每行：实际宽度 vs 同字体 white-space:pre 标准件宽度
const measureRows = (page, rowSel, textSel) => page.evaluate(([rowSel, textSel]) => [...document.querySelectorAll(rowSel)].map((row) => {
  const lc = row.querySelector(textSel); const txt = lc.textContent;
  const ref = document.createElement("span"); ref.style.cssText = "white-space:pre;position:absolute;visibility:hidden;left:0;top:0"; ref.textContent = txt;
  lc.appendChild(ref); const cs = getComputedStyle(lc); ref.style.font = cs.font; ref.style.fontFamily = cs.fontFamily; ref.style.fontSize = cs.fontSize;
  const want = ref.getBoundingClientRect().width; ref.remove();
  return { txt, got: lc.getBoundingClientRect().width, want };
}), [rowSel, textSel]);
const near = (a, b) => Math.abs(a - b) <= 1.5;

for (const vw of [390, 320]) {
  const { ctx, page } = await mount({ width: vw, height: 900 }, L.predict);
  const rows = await measureRows(page, ".codeblock .cl", ".lc");
  const g = `题面代码块 @${vw}px`;
  check(`${g}：每一行（共 ${rows.length} 行）都和标准宽度一致（缩进 / 运算符 / 字符串空格都在）`, rows.length === 7 && rows.every((r) => near(r.got, r.want)), rows.filter((r) => !near(r.got, r.want)).map((r) => `${JSON.stringify(r.txt)} 实际${r.got.toFixed(1)} 应为${r.want.toFixed(1)}`).join("；"));
  const w = Object.fromEntries(rows.map((r) => [r.txt, r]));
  const cwid = w["cups = 2"].want / 8;
  check(`${g}：4 格缩进可见（"    print(i)" 比 "print(0)" 宽 4 个字符）`, near(w["    print(i)"].got - w["print(0)"].got, 4 * cwid), `${w["    print(i)"].got.toFixed(1)} vs ${w["print(0)"].got.toFixed(1)}`);
  check(`${g}：8 格缩进可见（"        print(i)" 比 "print(0)" 宽 8 个字符）`, near(w["        print(i)"].got - w["print(0)"].got, 8 * cwid), `${w["        print(i)"].got.toFixed(1)} vs ${w["print(0)"].got.toFixed(1)}`);
  check(`${g}：8 格比 4 格多 4 个字符宽`, near(w["        print(i)"].got - w["    print(i)"].got, 4 * cwid));
  check(`${g}：赋值号两侧空格保留（"cups = 2" 为 8 个字符宽）`, near(w["cups = 2"].got, 8 * cwid));
  check(`${g}：字符串内部连续两个空格保留`, near(w['name = "a  b"'].got, 'name = "a  b"'.length * cwid));
  check(`${g}：运算符两侧空格保留`, near(w["total = cups * 3 + 1"].got, "total = cups * 3 + 1".length * cwid));
  check(`${g}：页面本身没有横向溢出`, await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ctx.close();
}

{ // 填空题的代码行
  const { ctx, page } = await mount({ width: 390, height: 900 }, L.fill);
  const rows = await page.evaluate(() => [...document.querySelectorAll(".codeblock .cl")].map((r) => ({ txt: r.querySelector(".lc").textContent.replace(/\s+$/, ""), got: r.querySelector(".lc").getBoundingClientRect().width, hasSlot: !!r.querySelector("[data-slot]") })));
  const cw = await page.evaluate(() => { const s = document.createElement("span"); const lc = document.querySelector(".codeblock .lc"); s.style.cssText = "white-space:pre;position:absolute;visibility:hidden"; s.textContent = "M".repeat(20); lc.appendChild(s); const w = s.getBoundingClientRect().width / 20; s.remove(); return w; });
  const pr = rows.find((r) => r.txt === "        print(i)"), nm = rows.find((r) => r.txt.startsWith("name"));
  check("填空题：8 格缩进可见", !!pr && near(pr.got, 16 * cw), pr && `实际 ${pr.got.toFixed(1)} 应为 ${(16 * cw).toFixed(1)}`);
  check("填空题：字符串内部空格保留", !!nm && near(nm.got, 'name = "a  b"'.length * cw), nm && `实际 ${nm.got.toFixed(1)}`);
  const ifRow = await page.evaluate(() => { const r = [...document.querySelectorAll(".codeblock .cl")][1]; const first = r.querySelector(".lc > span"); return { lead: first.textContent, w: first.getBoundingClientRect().width }; });
  check("填空题：含空格的行里，空格前的缩进文本不被吃掉", ifRow.lead.startsWith("    if i") && ifRow.w > 0, JSON.stringify(ifRow));
  await ctx.close();
}

{ // 排序题的按钮
  const { ctx, page } = await mount({ width: 320, height: 900 }, L.order);
  const info = await page.evaluate(() => { const o = {}; for (const b of document.querySelectorAll(".line-chip")) { const t = b.textContent.replace(/^\d+/, ""); o[t] = b.querySelector(".tk-fn").getBoundingClientRect().left - b.getBoundingClientRect().left; }
    const s = document.createElement("span"); s.style.cssText = "white-space:pre;position:absolute;visibility:hidden"; const b = document.querySelector(".line-chip"); b.appendChild(s); s.textContent = "M".repeat(20); const cs = getComputedStyle(b); s.style.font = cs.font; const cw = s.getBoundingClientRect().width / 20; s.remove(); return { o, cw }; });
  const a = info.o["print(0)"], b4 = info.o["    print(i)"], b8 = info.o["        print(i + 1)"];
  check("排序题：4 格缩进在按钮里可见（比无缩进行靠右 4 个字符宽）", near(b4 - a, 4 * info.cw), JSON.stringify(info));
  check("排序题：8 格缩进在按钮里可见（比无缩进行靠右 8 个字符宽）", near(b8 - a, 8 * info.cw));
  const probe = await page.evaluate(() => { const bs = [...document.querySelectorAll(".line-chip")]; return bs.map((x) => { const sp = x.querySelector("span > span:not(.ln)") || x; return { t: x.textContent, ws: getComputedStyle(x.querySelector(".tk-txt") || x).whiteSpace }; }); });
  check("排序题：文本节点是 white-space: pre", probe.every((p) => p.ws === "pre"), JSON.stringify(probe));
  check("排序题 @320：页面没有横向溢出", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await ctx.close();
}

{ // 小屏仍能横滑看完整行
  const { ctx, page } = await mount({ width: 320, height: 900 }, L.long);
  const r = await page.evaluate(async () => {
    const cb = document.querySelector(".codeblock"); const lc = cb.querySelector(".lc");
    const before = { sw: cb.scrollWidth, cw: cb.clientWidth, ox: getComputedStyle(cb).overflowX, pageOverflow: document.documentElement.scrollWidth > window.innerWidth };
    cb.scrollLeft = cb.scrollWidth; await new Promise((res) => requestAnimationFrame(res));
    const range = document.createRange(); range.selectNodeContents(lc); const last = range.getBoundingClientRect(); const box = cb.getBoundingClientRect();
    return { ...before, left: cb.scrollLeft, lastRight: last.right, boxRight: box.right, lcWidth: lc.getBoundingClientRect().width };
  });
  check("小屏 @320：长行比代码块宽，代码块可横向滚动", r.sw > r.cw && r.ox === "auto", JSON.stringify(r));
  check("小屏 @320：滚到最右后能看到整行最后一个字（END"+'")'+"）", r.left > 0 && r.lastRight <= r.boxRight + 1, `lastRight=${r.lastRight.toFixed(1)} boxRight=${r.boxRight.toFixed(1)}`);
  check("小屏 @320：页面本身没有横向溢出（横滑只发生在代码块内部）", !r.pageOverflow);
  await ctx.close();
}

await browser.close(); srv.closeAllConnections(); srv.close();
console.log(fails ? `\n❌ ${ENGINE}：${fails} 项失败` : `\n✅ ${ENGINE}：全部通过`);
process.exit(fails ? 1 : 0);
