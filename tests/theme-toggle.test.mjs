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
await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-theme-row]");

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
await page.getByRole("button", { name: "我的" }).tap(); await page.waitForSelector("[data-theme-row]");
check("刷新后按钮状态也对（「深色」被选中）", (await page.locator('[data-theme-opt="dark"]').getAttribute("aria-pressed")) === "true");
check("选择存在学习记录的 prefs.theme 里（会随账号同步），其余设置不变", await page.evaluate(() => { const p = window.__app.getState().prefs; return p.theme === "dark" && p.sound === true && p.haptics === true && p.soundStyle === "J"; }));
await page.locator('[data-theme-opt="system"]').tap();
check("选回「跟随系统」后 prefs.theme 回到 system", await page.evaluate(() => window.__app.getState().prefs.theme === "system"));
check("选回「跟随系统」：去掉 data-theme，重新跟着系统", (await attr()) === null && (await bg()) === LIGHT);
check("全程没有脚本错误", errors.length === 0, errors.join("|"));
await browser.close(); await srv.close();
console.log(`\n外观切换：通过 ${pass}，失败 ${fail}`);
process.exit(fail ? 1 : 0);
