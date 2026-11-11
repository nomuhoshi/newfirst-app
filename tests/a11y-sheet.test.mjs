// 弹窗键盘可用性：打开后焦点进入弹窗、Tab 不跑出弹窗、Esc 关闭并把焦点还给打开它的按钮。
// 桌面 Chromium 模拟外接键盘，不代表 VoiceOver 实测（VoiceOver 未在真机上测试）。运行：npm run build && node tests/a11y-sheet.test.mjs
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname, resolve } from "node:path";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
const DIST = resolve(fileURLToPath(new URL("../dist", import.meta.url))), PORT = 4341, BASE = `http://localhost:${PORT}/`;
const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css", ".json": "application/json", ".png": "image/png", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm" };
const results = []; const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${d ? "  — " + d : ""}`); };
const srv = createServer((q, s) => { const u = new URL(q.url, BASE); let p = join(DIST, decodeURIComponent(u.pathname)); if (u.pathname.endsWith("/")) p = join(p, "index.html");
  if (!p.startsWith(DIST) || !existsSync(p) || statSync(p).isDirectory()) { s.writeHead(404); s.end(); return; } s.writeHead(200, { "content-type": MIME[extname(p)] || "application/octet-stream" }); s.end(readFileSync(p)); });
await new Promise((r) => srv.listen(PORT, r));
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 820, height: 1180 }, serviceWorkers: "block" });
await ctx.addInitScript(() => { Object.keys(localStorage).filter((k) => k.includes("suipian.v4.")).forEach((k) => localStorage.removeItem(k)); /* 模拟带着旧存档第一次打开 v4 */ localStorage.setItem("suipian.progress", JSON.stringify({ version: 3, onboarded: true, xp: 0, hearts: 5, heartsAt: Date.now(), streak: 0, lastDay: null, done: {}, lessonsCompleted: 0, installTipClosed: true, lastActive: Date.now(), prefs: { sound: false, haptics: false, soundStyle: "J" } })); });
const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
await page.goto(BASE); await page.waitForSelector(".pathview");
await page.locator('[data-lesson="U1L1"]').focus(); await page.keyboard.press("Enter"); await page.waitForSelector(".overlay");
const inside = () => page.evaluate(() => !!document.querySelector(".overlay")?.contains(document.activeElement));
check("打开弹窗后焦点在弹窗内", await inside());
check("弹窗有 aria-labelledby 指向标题", await page.evaluate(() => { const o = document.querySelector(".overlay"); const id = o.getAttribute("aria-labelledby"); return !!id && !!document.getElementById(id)?.textContent; }));
let ok = true; for (let i = 0; i < 8; i++) { await page.keyboard.press(i % 3 ? "Tab" : "Shift+Tab"); ok &&= await inside(); }
check("Tab / Shift+Tab 焦点不跑出弹窗", ok);
await page.keyboard.press("Escape");
check("Esc 关闭弹窗", !(await page.locator(".overlay").count()));
check("关闭后焦点回到关卡按钮", await page.evaluate(() => document.activeElement?.dataset?.lesson === "U1L1"));
check("没有脚本错误", errors.length === 0, errors.join(" | "));
// —— 补充：没有按钮的弹窗；隐藏/禁用控件不进 Tab 循环；反复开关；打开它的按钮被移除后关闭 ——
const act = () => page.evaluate(() => { const a = document.activeElement; return a === document.body ? "body" : (a?.dataset?.t || a?.className || a?.tagName); });
{ // 没有可聚焦控件
  await page.evaluate(() => { window.__c = window.__app.sheet(() => { const p = document.createElement("p"); p.textContent = "只有文字"; return [p]; }); });
  check("无按钮弹窗：容器 tabindex=-1", await page.evaluate(() => document.querySelector(".overlay").getAttribute("tabindex") === "-1"));
  check("无按钮弹窗：焦点真的落在弹窗容器上", await page.evaluate(() => document.activeElement === document.querySelector(".overlay")));
  await page.keyboard.press("Tab"); await page.keyboard.press("Shift+Tab");
  check("无按钮弹窗：Tab/Shift+Tab 焦点仍在弹窗", await inside() || await page.evaluate(() => document.activeElement === document.querySelector(".overlay")));
  await page.keyboard.press("Escape"); check("无按钮弹窗：Esc 能关闭", !(await page.locator(".overlay").count()));
}
{ // 隐藏 / 禁用 / tabindex=-1 控件
  await page.evaluate(() => { window.__app.sheet(() => { const mk = (t, f) => { const b = document.createElement("button"); b.textContent = t; b.dataset.t = t; f?.(b); return b; };
    return [mk("A"), mk("disabled", (b) => { b.disabled = true; }), mk("hiddenattr", (b) => { b.hidden = true; }), mk("dispnone", (b) => { b.style.display = "none"; }),
      mk("vishidden", (b) => { b.style.visibility = "hidden"; }), mk("zero", (b) => { b.style.cssText = "width:0;height:0;padding:0;border:0;overflow:hidden"; }), mk("neg", (b) => { b.tabIndex = -1; }),
      (() => { const d = document.createElement("div"); d.style.display = "none"; d.append(mk("inNone")); return d; })(), mk("B")]; }); });
  const seen = [await act()]; for (let i = 0; i < 6; i++) { await page.keyboard.press("Tab"); seen.push(await act()); }
  const back = []; for (let i = 0; i < 4; i++) { await page.keyboard.press("Shift+Tab"); back.push(await act()); }
  check("隐藏/禁用控件：打开时焦点在第一个可用按钮 A", seen[0] === "A", seen[0]);
  check("隐藏/禁用控件：Tab 只在 A、B 之间循环", seen.every((x) => x === "A" || x === "B") && seen.includes("B"), seen.join(","));
  check("隐藏/禁用控件：Shift+Tab 也只在 A、B 之间", back.every((x) => x === "A" || x === "B"), back.join(","));
  await page.keyboard.press("Escape");
}
{ // 反复开关
  let ok2 = true;
  for (let i = 0; i < 10; i++) { await page.locator('[data-lesson="U1L1"]').focus(); await page.keyboard.press("Enter"); await page.waitForSelector(".overlay");
    ok2 &&= await inside(); await page.keyboard.press("Escape"); ok2 &&= (await page.locator(".overlay").count()) === 0 && await page.evaluate(() => document.activeElement?.dataset?.lesson === "U1L1"); }
  check("反复开关 10 次：每次焦点进入、关闭后回到关卡按钮、不残留弹窗", ok2);
}
{ // 打开它的按钮被移除
  await page.evaluate(() => { const b = document.createElement("button"); b.id = "tmp-opener"; b.textContent = "x"; document.body.append(b); b.focus();
    window.__c2 = window.__app.sheet(() => { const c = document.createElement("button"); c.textContent = "ok"; return [c]; }); b.remove(); });
  const r = await page.evaluate(() => { try { window.__c2(); window.__c2(); return "ok:" + (document.activeElement === document.body ? "body" : document.activeElement?.tagName); } catch (e) { return "throw:" + e.message; } });
  check("打开按钮被移除后关闭（两次）：不抛错，焦点回到页面主体", r === "ok:body", r);
  check("打开按钮被移除后：弹窗已移除", !(await page.locator(".overlay").count()));
}
check("补充测试没有脚本错误", errors.length === 0, errors.join(" | "));
await browser.close(); srv.close();
console.log(`\n共 ${results.length} 项，失败 ${results.filter((x) => !x).length} 项`); if (results.includes(false)) process.exit(1);
