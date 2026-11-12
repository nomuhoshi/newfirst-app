// 进度文件（导出 / 导入）测试：纯函数 + 真实浏览器里的“我的”页。
// 目的：用户在云端连不上、清了浏览器数据、换手机时，手里有一份自己的备份，而且导回来不会让现有进度变少。
// 运行：npm run build && node tests/progress-file.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { buildExport, parseImport, mergeImport, exportFileName, summarize, FILE_FORMAT, encodeCode, decodeCode } from "../src/progress-file.js";
import { DATA_VERSION } from "../src/storage.js";
import { fileURLToPath } from "node:url";

const results = [];
function check(name, ok, detail = "") { results.push({ ok: !!ok }); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); }
const FIX = readFileSync(new URL("./fixtures/local-v3-progress.json", import.meta.url), "utf8");
const base = JSON.parse(FIX);

// ===== 纯函数 =====
{
  const exp = buildExport(base, { now: Date.UTC(2026, 10, 4, 12, 0, 0), build: "b1", unreadable: [{ savedAt: 5, raw: "{bad" }] });
  const text = JSON.stringify(exp);
  const r = parseImport(text);
  check("导出再导入：内容原样读回（关卡、XP、连续天数）", r.ok && r.state.xp === 190 && r.state.streak === 4 && r.state.lastDay === "2026-11-02" && Object.keys(r.state.done).length === 8 && r.exportedAt.startsWith("2026-11-04"));
  check("导出带上被留下来的读不懂旧记录原文", exp.unreadable.length === 1 && exp.unreadable[0].raw === "{bad" && exp.format === FILE_FORMAT);
  check("文件名带日期", exportFileName(new Date(2026, 10, 4)) === "suipian-progress-2026-11-04.json");
  const bad = (mut) => { const o = JSON.parse(text); mut(o); return parseImport(JSON.stringify(o)); };
  check("拒绝：空文件 / 不是 JSON / 别的 JSON", !parseImport("").ok && !parseImport("{oops").ok && !parseImport('{"a":1}').ok);
  check("拒绝：格式版本不认识", !bad((o) => { o.exportVersion = 2; }).ok);
  check("拒绝：学习记录版本不对", !bad((o) => { o.state.version = 2; }).ok);
  check("拒绝：XP 为负 / 不是整数 / 大得离谱", !bad((o) => { o.state.xp = -1; }).ok && !bad((o) => { o.state.xp = 1.5; }).ok && !bad((o) => { o.state.xp = 1e12; }).ok);
  check("拒绝：日期不合理", !bad((o) => { o.state.lastDay = "昨天"; }).ok);
  check("拒绝：关卡编号里有 __proto__ 或奇怪字符", !parseImport(text.replace('"U1L1"', '"__proto__"')).ok && !bad((o) => { o.state.done["a b<script>"] = true; }).ok);
  check("拒绝：超过 1MB 的文件", !parseImport(" ".repeat(1024 * 1024 + 1) + "{}").ok);
  check("导入后的数据里不带文件里的红心 / 偏好（只取进度）", (() => { const o = JSON.parse(text); o.state.prefs = { sound: false }; o.state.hearts = 1; const q = parseImport(JSON.stringify(o)); return q.ok && !("prefs" in q.state) && !("hearts" in q.state); })());
}
{ // 合并规则：永远不让现有进度变少
  const cur = { ...base, xp: 300, streak: 2, lastDay: "2026-11-03", done: { U1L1: true, U2L5: true }, hearts: 2, prefs: { sound: false, haptics: true, soundStyle: "A" }, lessonsCompleted: 5 };
  const imp = { xp: 190, streak: 4, lastDay: "2026-11-02", done: { U1L1: true, U1L2: true, U1L3: true }, lessonsCompleted: 11 };
  const m = mergeImport(cur, imp);
  check("合并：关卡取并集", Object.keys(m.done).sort().join() === "U1L1,U1L2,U1L3,U2L5");
  check("合并：XP 取较大的（导入较小的文件不会让 XP 变少）", m.xp === 300);
  check("合并：最后学习日期较新的一边决定连续天数", m.streak === 2 && m.lastDay === "2026-11-03");
  check("合并：当前设备的红心和偏好不被覆盖", m.hearts === 2 && m.prefs.sound === false && m.prefs.soundStyle === "A");
  const m2 = mergeImport({ ...cur, lastDay: "2026-10-01", streak: 1, xp: 10 }, imp);
  check("合并：导入的文件更新时，XP 和连续天数取文件里的", m2.xp === 190 && m2.streak === 4 && m2.lastDay === "2026-11-02");
  const m3 = mergeImport({ ...cur, lastDay: "2026-11-02", streak: 9 }, imp);
  check("合并：同一天取较大的连续天数", m3.streak === 9);
  const before = JSON.stringify(cur); mergeImport(cur, imp);
  check("合并不修改传入的当前记录", JSON.stringify(cur) === before);
  check("摘要", summarize(imp).lessons === 3 && summarize(imp).xp === 190);
}

{ // 进度码
  const code = encodeCode(base, { now: Date.UTC(2026, 10, 4, 12, 0, 0), build: "b1" });
  const d = decodeCode(code), r = d.ok ? parseImport(d.text) : null;
  check("进度码：以 SPC1. 开头，只有安全字符", code.startsWith("SPC1.") && /^SPC1\.[A-Za-z0-9_.-]+$/.test(code));
  check("进度码：编码再解码，进度原样（关卡、XP、连续天数）", r && r.ok && r.state.xp === 190 && r.state.streak === 4 && Object.keys(r.state.done).length === 8);
  const chopped = code.match(/.{1,17}/g).join("\n  ");
  check("进度码：粘贴时夹着换行和空格也能读", decodeCode(chopped).ok && parseImport(decodeCode(chopped).text).ok);
  check("进度码：前面带别的文字（聊天软件常加前缀）也能读", decodeCode("我的进度码：" + code).ok);
  check("进度码：空 / 不是进度码 / 被截断都拒绝或读不出进度", !decodeCode("").ok && !decodeCode("hello").ok && (() => { const t = decodeCode(code.slice(0, 30)); return !t.ok || !parseImport(t.text).ok; })());
  { // 字段白名单、校验和、真实日期
    const dirty = { ...base, email: "a@b.c", accessToken: "SECRET", diagnostics: "D", prefs: { sound: false }, hearts: 1, extra: { token: "X" } };
    const c2 = encodeCode(dirty), txt = decodeCode(c2).text, exp = buildExport(dirty);
    check("进度码和导出文件只带进度字段：不含邮箱、令牌、诊断、偏好、红心", !/SECRET|a@b\.c|diagnostics|prefs|hearts|extra/.test(txt) && !/SECRET|a@b\.c|diagnostics|prefs|hearts|extra/.test(JSON.stringify(exp)));
    check("白名单后进度仍完整", (() => { const q = parseImport(txt); return q.ok && q.state.xp === 190 && Object.keys(q.state.done).length === 8; })());
    const flip = (str, i) => str.slice(0, i) + (str[i] === "A" ? "B" : "A") + str.slice(i + 1);
    check("进度码改一个字符：校验不通过", !decodeCode(flip(c2, 20)).ok && /校验/.test(decodeCode(flip(c2, 20)).error));
    check("进度码缺校验位（旧格式或被截断）：拒绝", !decodeCode(c2.slice(0, c2.lastIndexOf("."))).ok);
    const bad = JSON.parse(txt); bad.state.lastDay = "2026-02-31";
    check("拒绝不存在的日期 2026-02-31", !parseImport(JSON.stringify(bad)).ok);
  }
}

// ===== 浏览器：我的页 =====
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url)));
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/json", ".wasm": "application/wasm" };
const srv = createServer((req, resp) => {
  const url = new URL(req.url, "http://x/"); let p = join(DIST, decodeURIComponent(url.pathname));
  if (url.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { resp.writeHead(404); resp.end("nf"); return; }
  resp.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream", "cache-control": "no-store" }); resp.end(readFileSync(p));
});
await new Promise((res) => srv.listen(0, res)); const URLBASE = `http://localhost:${srv.address().port}/`;
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: "block", acceptDownloads: true, permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.addInitScript((raw) => { if (!sessionStorage.getItem("seeded")) { sessionStorage.setItem("seeded", "1"); Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); /* 模拟带着旧存档第一次打开 v4 */ localStorage.setItem("suipian.progress", raw); localStorage.setItem("suipian.progress.unreadable.1700000000000", "{旧的坏记录"); } }, FIX);
  await page.goto(URLBASE); await page.waitForSelector(".statsbar", { timeout: 15000 });
  await page.getByRole("button", { name: "我的" }).tap();
  await page.waitForSelector("[data-backup]");
  check("我的页有“备份学习记录”：导出和导入两个按钮", (await page.locator("[data-export]").count()) === 1 && (await page.locator("[data-import]").count()) === 1);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator("[data-export]").tap()]);
  const dir = mkdtempSync(join(tmpdir(), "sp-")); const saved = join(dir, dl.suggestedFilename()); await dl.saveAs(saved);
  const fileText = readFileSync(saved, "utf8"); const parsed = JSON.parse(fileText);
  check("导出：下载的是 suipian-progress-日期.json", /^suipian-progress-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  check("导出：文件里的进度和手机里的一致，并带上旧坏记录", parsed.state.xp === 190 && Object.keys(parsed.state.done).length === 8 && parsed.unreadable.some((u) => u.raw === "{旧的坏记录"));
  check("导出后提示去下载位置确认文件，并且不重置 14 天提醒", /已请求下载/.test(await page.locator("[data-backup-msg]").innerText()) && (await page.evaluate(() => localStorage.getItem("suipian.meta.lastExport"))) === null);

  // 清掉进度（模拟清了浏览器数据）后导入
  await page.evaluate(() => { window.__app.clearProgress(); /* v4 的 XP 与关卡只增不减，改用真实清除来模拟“清了浏览器数据” */ });
  await page.reload(); await page.waitForSelector(".statsbar");
  await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-backup]");
  await page.locator("[data-import-file]").setInputFiles(saved);
  await page.waitForSelector("[data-import-confirm]");
  check("导入：先给确认，写明文件里有几关、多少 XP", /8 个已完成关卡.*190 XP/.test(await page.locator("[data-import-confirm]").innerText()));
  check("导入：确认之前不改任何记录", (await page.evaluate(() => window.__app.getState().xp)) === 0);
  await page.getByRole("button", { name: "确认导入" }).tap();
  await page.waitForFunction(() => window.__app.getState().xp === 190);
  const st = await page.evaluate(() => window.__app.getState());
  const ls = JSON.parse(await page.evaluate(() => localStorage.getItem("suipian.progress")));
  check("导入：关卡、XP、连续天数恢复，并存进本机", Object.keys(st.done).length === 8 && st.xp === 190 && st.streak === 4 && ls.xp === 190 && Object.keys(ls.done).length === 8);

  // 进度码：复制 → 清空 → 粘贴 → 确认
  await page.locator("[data-code-copy]").tap();
  await page.waitForFunction(() => /进度码已复制/.test(document.querySelector("[data-backup-msg]")?.textContent || ""));
  const codeText = await page.evaluate(() => navigator.clipboard.readText());
  check("复制进度码：剪贴板里是 SPC1. 开头的一段文字", /^SPC1\.[A-Za-z0-9_.-]+$/.test(codeText));
  await page.evaluate(() => { window.__app.clearProgress(); });
  await page.reload(); await page.waitForSelector(".statsbar");
  await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-backup]");
  check("清空后进度为 0", (await page.evaluate(() => window.__app.getState().xp)) === 0);
  await page.locator("[data-code-paste]").tap();
  await page.locator("[data-code-in]").fill("请看这个：\n" + codeText.match(/.{1,25}/g).join("\n"));
  await page.locator("[data-code-read]").tap();
  await page.waitForSelector("[data-import-confirm]");
  check("粘贴进度码：先确认，确认前不改记录", /8 个已完成关卡.*190 XP/.test(await page.locator("[data-import-confirm]").innerText()) && (await page.evaluate(() => window.__app.getState().xp)) === 0);
  await page.getByRole("button", { name: "确认导入" }).tap();
  await page.waitForFunction(() => window.__app.getState().xp === 190);
  check("粘贴进度码：进度恢复", Object.keys(await page.evaluate(() => window.__app.getState().done)).length === 8);
  await page.locator("[data-code-paste]").tap(); await page.locator("[data-code-in]").fill("乱写的"); await page.locator("[data-code-read]").tap();
  check("粘贴错误的进度码：说明原因", /不是碎片编程的进度码/.test(await page.locator("[data-backup-msg]").innerText()));

  // 保存失败（存储写入报错）：导入不能报“成功”
  await page.evaluate(() => { window.__realSet = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (String(k).startsWith("suipian.v4.tab.")) throw new DOMException("full", "QuotaExceededError"); return window.__realSet.call(this, k, v); }; });
  await page.evaluate(() => { const st = window.__app.getState(); st.xp = 0; st.done = {}; });
  await page.locator("[data-code-paste]").tap(); await page.locator("[data-code-in]").fill(codeText); await page.locator("[data-code-read]").tap();
  await page.waitForSelector("[data-import-confirm]"); await page.getByRole("button", { name: "确认导入" }).tap();
  await page.waitForTimeout(300);
  const toastTxt = await page.locator(".toast").innerText();
  check("保存失败时导入不报“进度已导入”，提示还没保存、先别关页面", !/^进度已导入/.test(toastTxt) && /还没有保存/.test(toastTxt), toastTxt);
  await page.evaluate(() => { Storage.prototype.setItem = window.__realSet; });

  // 坏文件：给出原因，不改记录
  const badPath = join(dir, "bad.json"); writeFileSync(badPath, '{"hello":1}');
  await page.locator("[data-import-file]").setInputFiles(badPath);
  await page.waitForFunction(() => /不是碎片编程的进度文件/.test(document.querySelector("[data-backup-msg]")?.textContent || ""));
  check("导入坏文件：说明原因，现有进度不变", (await page.evaluate(() => window.__app.getState().xp)) === 190 && (await page.locator("[data-import-confirm]").count()) === 0);

  // 导入较小的文件不会让现有进度变少
  await page.evaluate(() => { const st = window.__app.getState(); st.xp = 500; st.done.U2L5 = true; window.__app.persist(); });
  await page.locator("[data-import-file]").setInputFiles(saved); await page.waitForSelector("[data-import-confirm]");
  await page.getByRole("button", { name: "确认导入" }).tap(); await page.waitForTimeout(300);
  const st2 = await page.evaluate(() => window.__app.getState());
  check("导入较旧的文件：XP 不减少、已有关卡不丢", st2.xp === 500 && st2.done.U2L5 === true && Object.keys(st2.done).length === 9);
  check("页面没有脚本错误", errors.length === 0, errors.join("; "));
  await ctx.close();
} finally { await browser.close(); srv.closeAllConnections(); srv.close(); }
const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
