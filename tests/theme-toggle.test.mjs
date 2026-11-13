// 外观切换（「我的」页：跟随系统 / 浅色 / 深色）。系统外观用 emulateMedia 模拟：
// 选「深色」时系统是浅色也要变深；选「浅色」时系统是深色也要变浅；选「跟随系统」跟着系统；刷新后选择还在；
// 选择存在 prefs.theme（登录后随账号同步），云端文档的 prefs 里带 theme；老文档没有 theme 时补 system。
// 运行：npm run build && node tests/theme-toggle.test.mjs   （MOBILE_BROWSER=webkit 换内核）
import { chromium, webkit } from "playwright";
import { startDistServer } from "./helpers/dist-server.mjs";

const engine = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const srv = await startDistServer();
let browser;
try { browser = await engine.launch(); } catch (e) { console.log(`环境失败：浏览器起不来：${String(e.message).split("\n")[0]}`); await srv.close(); process.exit(2); }
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, serviceWorkers: "block", colorScheme: "light" });
ctx.setDefaultTimeout(30000);
const page = await ctx.newPage(); const errors = []; page.on("pageerror", (e) => errors.push(e.message));
await page.goto(srv.base); await page.waitForFunction(() => window.__app?.getState);
await page.evaluate(() => { const s = window.__app.getState(); s.onboarded = true; s.installTipClosed = true; window.__app.persist(); });
await page.reload(); await page.waitForSelector(".pathview"); await page.waitForFunction(() => window.__app?.getState);
const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--g-bg").trim().toUpperCase());
const attr = () => page.evaluate(() => document.documentElement.getAttribute("data-theme"));
const bar = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').getAttribute("content"));
const LIGHT = "#F7F5F0", DARK = "#101E28";
await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="settings"]').tap(); await page.waitForSelector("[data-theme-row]");

check("我的页有「外观」三个选项：跟随系统、浅色、深色", (await page.locator("[data-theme-opt]").allInnerTexts()).join("|") === "跟随系统|浅色|深色");
check("每个选项的点按区域不小于 44px", await page.evaluate(() => [...document.querySelectorAll("[data-theme-opt]")].every((b) => b.getBoundingClientRect().height >= 44)));
check("默认「跟随系统」：没有 data-theme，系统浅色 → 浅色", (await page.locator('[data-theme-opt="system"]').getAttribute("aria-pressed")) === "true" && (await attr()) === null && (await bg()) === LIGHT && (await bar()) === LIGHT);
await page.emulateMedia({ colorScheme: "dark" });
await page.waitForFunction(() => document.querySelector('meta[name="theme-color"]').getAttribute("content") === "#101E28", null, { timeout: 3000 }).catch(() => {}); // 系统外观变化的通知是异步的
check("跟随系统：系统改深色 → 深色，顶栏颜色同步", (await bg()) === DARK && (await bar()) === DARK, `bg=${await bg()} bar=${await bar()}`);
await page.locator('[data-theme-opt="light"]').tap();
check("选「浅色」：系统是深色也显示浅色", (await attr()) === "light" && (await bg()) === LIGHT && (await bar()) === LIGHT && (await page.locator('[data-theme-opt="light"]').getAttribute("aria-pressed")) === "true");
await page.emulateMedia({ colorScheme: "light" });
await page.locator('[data-theme-opt="dark"]').tap();
check("选「深色」：系统是浅色也显示深色", (await attr()) === "dark" && (await bg()) === DARK && (await bar()) === DARK);
await page.reload(); await page.waitForFunction(() => window.__app?.getState);
check("刷新后选择还在（仍是深色）", (await attr()) === "dark" && (await bg()) === DARK);
await page.getByRole("button", { name: "我的" }).tap(); await page.locator('[data-me-menu="settings"]').tap(); await page.waitForSelector("[data-theme-row]");
check("刷新后按钮状态也对（「深色」被选中）", (await page.locator('[data-theme-opt="dark"]').getAttribute("aria-pressed")) === "true");
check("选择存在学习记录的 prefs.theme 里（会随账号同步），其余设置不变", await page.evaluate(() => { const p = window.__app.getState().prefs; return p.theme === "dark" && p.sound === true && p.haptics === true && p.soundStyle === "J"; }));
await page.locator('[data-theme-opt="system"]').tap();
check("选回「跟随系统」后 prefs.theme 回到 system", await page.evaluate(() => window.__app.getState().prefs.theme === "system"));
check("选回「跟随系统」：去掉 data-theme，重新跟着系统", (await attr()) === null && (await bg()) === LIGHT);
// ---- 复核补充（#100）：双标签、外观缓存写不进去 ----
// 双标签（游客）：标签 B 一直开着，标签 A 选了新外观 → B 收到 storage 事件后，页面外观和“我的”页的按钮状态都要跟着变
const page2 = await ctx.newPage(); page2.on("pageerror", (e) => errors.push(e.message));
await page2.goto(srv.base); await page2.waitForFunction(() => window.__app?.getState); await page2.waitForSelector(".pathview");
await page2.getByRole("button", { name: "我的" }).tap(); await page2.locator('[data-me-menu="settings"]').tap(); await page2.waitForSelector("[data-theme-row]");
const attr2 = () => page2.evaluate(() => document.documentElement.getAttribute("data-theme"));
await page.locator('[data-theme-opt="dark"]').tap();
await page2.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", null, { timeout: 5000 }).catch(() => {});
check("双标签：A 选「深色」→ B（一直开着）页面外观也变深色", (await attr2()) === "dark", `B data-theme=${await attr2()}`);
check("双标签：B 的「我的」页里「深色」按钮也被选中（不是页面深色、按钮还停在旧选项）", (await page2.locator('[data-theme-opt="dark"]').getAttribute("aria-pressed")) === "true" && (await page2.locator('[data-theme-opt="system"]').getAttribute("aria-pressed")) === "false");
await page.locator('[data-theme-opt="system"]').tap();
await page2.waitForFunction(() => document.documentElement.getAttribute("data-theme") === null, null, { timeout: 5000 }).catch(() => {});
check("双标签：A 选回「跟随系统」→ B 也回到跟随系统", (await attr2()) === null, `B data-theme=${await attr2()}`);
await page2.close();
await page.close(); // 先关掉写缓存正常的标签：它会收到同源 storage 事件并把 suipian-theme 写成 dark，污染下面“缓存写不进去”的前提
// 外观缓存（localStorage 里的 suipian-theme）写不进去（无痕 / 配额）：手动选择照样生效，之后系统外观变化也不能把它覆盖掉
const page3 = await ctx.newPage(); page3.on("pageerror", (e) => errors.push(e.message));
await page3.addInitScript(() => { const s = Storage.prototype.setItem, r = Storage.prototype.removeItem; Storage.prototype.setItem = function (k, v) { if (k === "suipian-theme") throw new Error("QuotaExceededError"); return s.call(this, k, v); }; Storage.prototype.removeItem = function (k) { if (k === "suipian-theme") throw new Error("denied"); return r.call(this, k); }; });
await page3.goto(srv.base); await page3.waitForFunction(() => window.__app?.getState); await page3.waitForSelector(".pathview");
await page3.getByRole("button", { name: "我的" }).tap(); await page3.locator('[data-me-menu="settings"]').tap(); await page3.waitForSelector("[data-theme-row]");
const attr3 = () => page3.evaluate(() => document.documentElement.getAttribute("data-theme"));
await page3.locator('[data-theme-opt="dark"]').tap();
{
  const a = await attr3(), pt = await page3.evaluate(() => window.__app.getState().prefs.theme), cv = await page3.evaluate(() => localStorage.getItem("suipian-theme"));
  check("缓存写失败：选「深色」照样变深色", a === "dark", `data-theme=${a}`);
  check("缓存写失败：选择已存进 prefs.theme", pt === "dark", `prefs.theme=${pt}`);
  check("缓存写失败：缓存里确实没有写进去（前提成立）", cv === null, `suipian-theme=${cv}`);
}
await page3.emulateMedia({ colorScheme: "dark" }); await page3.waitForTimeout(300); await page3.emulateMedia({ colorScheme: "light" }); await page3.waitForTimeout(300);
check("缓存写失败：系统外观来回变化后，手动选的「深色」仍然在（不被当成“跟随系统”）", (await attr3()) === "dark", `data-theme=${await attr3()}`);
await page3.reload(); await page3.waitForFunction(() => window.__app?.getState);
await page3.waitForFunction(() => document.documentElement.getAttribute("data-theme") === "dark", null, { timeout: 5000 }).catch(() => {});
check("缓存写失败：刷新后按已保存的 prefs.theme 恢复深色", (await attr3()) === "dark", `data-theme=${await attr3()}`);
await page3.close();
check("全程没有脚本错误", errors.length === 0, errors.join("|"));
await browser.close(); await srv.close();
console.log(`\n外观切换：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
