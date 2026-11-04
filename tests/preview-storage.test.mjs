// 测试入口（PREVIEW_ID）和正式站同在一个域名下，共用 localStorage。要证明：
//  1. 前缀装上时：云端关闭的测试入口读不到、改不动、删不掉正式版的登录凭证 / 当前账号 / 本机副本 / 游客记录，正式版刷新后仍是登录状态；
//  2. 浏览器拒绝安装前缀时：测试入口立即停止运行（不读写任何正式版的键），而不是悄悄共用同一份存储。
// 运行：MOBILE_BROWSER=webkit|chromium node tests/preview-storage.test.mjs（需要 playwright）
import http from "node:http"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} [${process.env.MOBILE_BROWSER || "chromium"}] ${n}${!ok && d ? "  — " + d : ""}`); };
const srv = http.createServer((q, r) => { const f = path.join(ROOT, decodeURIComponent(q.url.split("?")[0])); if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(200, { "content-type": "text/html" }); return r.end("<!doctype html><title>t</title>"); } r.writeHead(200, { "content-type": /\.m?js$/.test(f) ? "text/javascript" : "text/plain" }); r.end(fs.readFileSync(f)); });
await new Promise((ok) => srv.listen(0, "127.0.0.1", ok)); const port = srv.address().port;
const shimSrc = fs.readFileSync(path.join(ROOT, "src/preview-storage.js"), "utf8").replaceAll("__PREVIEW_ID__", '"rc1"');
const browserType = process.env.MOBILE_BROWSER === "webkit" ? webkit : chromium;
let browser; try { browser = await browserType.launch(); } catch (e) { console.log("环境失败：浏览器启动失败 " + String(e.message).split("\n")[0]); srv.closeAllConnections(); srv.close(); process.exit(2); }

async function run(mode) {
  const ctx = await browser.newContext(); const page = await ctx.newPage();
  const errors = []; page.on("pageerror", (e) => errors.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${port}/`);
  const out = await page.evaluate(async ({ shimSrc, mode }) => {
    const real = window.localStorage;
    const doc = { schema: 1, gen: 1, lineage: "L1", xp: { d: 40 }, done: { U1L1: 1 }, hearts: { n: 5, msToNext: 0 }, prefs: {}, imported: {}, runs: {}, updatedAt: 1 };
    const AUTH = JSON.stringify({ session: { accessToken: "a", refreshToken: "r", expiresAt: Date.now() + 3600e3, userId: "prodUser1", email: "me@x.com" } });
    real.setItem("suipian.auth", AUTH); real.setItem("suipian.session", "prodUser1");
    real.setItem("suipian.acct.prodUser1", JSON.stringify({ doc, base: 3, dirty: { hearts: false, prefs: false, content: false }, savedAt: Date.now() })); real.setItem("suipian.progress", "GUEST-RAW");
    const snap0 = JSON.stringify(Object.entries(real).sort());
    if (mode === "rejected") Object.defineProperty(window, "localStorage", { get: () => real, configurable: false }); // 之后再覆盖会失败
    let threw = null;
    const onerr = (e) => { threw = String(e.message || e.error); e.preventDefault(); }; window.addEventListener("error", onerr);
    const s = document.createElement("script"); s.textContent = shimSrc; document.head.append(s);
    await new Promise((r) => setTimeout(r, 50)); window.removeEventListener("error", onerr);
    const installed = window.localStorage !== real;
    let restoreXp = "未运行", mid = null;
    if (installed) { // 前缀装上：云端关闭的测试入口照常启动同步层
      const { createSync } = await import("/src/sync.js");
      const api = { async refresh() { return { ok: false, kind: "network" }; }, async getProgress() { return { ok: false, kind: "network" }; } };
      const sync = createSync({ storage: window.localStorage, api, projectId: "cloud-off", legacyProject: "aqlcunkmggzzvyavlkjg.supabase.co" });
      const r = sync.restore({ version: 3, onboarded: true, xp: 0, done: {} }); restoreXp = r && r.state ? r.state.xp : null;
      window.localStorage.setItem("suipian.progress", "PREVIEW-GUEST"); // 测试入口自己写的游客记录
      mid = real.getItem("rc1:suipian.progress");
    }
    const snap1 = JSON.stringify(Object.entries(real).filter(([k]) => !k.startsWith("rc1:")).sort());
    return { installed, threw, bodyText: document.body ? document.body.textContent.slice(0, 60) : "", restoreXp, prodUnchanged: snap0 === snap1, authSame: real.getItem("suipian.auth") === AUTH, guestSame: real.getItem("suipian.progress") === "GUEST-RAW", previewKeys: Object.keys(real).filter((k) => k.startsWith("rc1:")), mid };
  }, { shimSrc, mode });
  await ctx.close(); return { ...out, errors };
}
const A = await run("normal");
check("前缀装上：测试入口的 localStorage 已换成带前缀的版本", A.installed === true);
check("前缀装上：云端关闭的测试入口看不到正式版的账号（restore 为空）", A.restoreXp === null, String(A.restoreXp));
check("前缀装上：正式版的凭证 / 当前账号 / 本机副本 / 游客记录一个字没变（刷新后仍是登录状态）", A.prodUnchanged && A.authSame && A.guestSame);
check("前缀装上：测试入口自己写的键都在 rc1: 前缀下", A.mid === "PREVIEW-GUEST" && A.previewKeys.length >= 1 && A.previewKeys.every((k) => k.startsWith("rc1:")));
const B = await run("rejected");
check("前缀被拒绝：测试入口没有换掉 localStorage，并且立即停止（抛错）", B.installed === false && (!!B.threw || B.errors.length > 0), JSON.stringify({ threw: B.threw, errors: B.errors }));
check("前缀被拒绝：页面显示停止运行的说明，没有继续运行应用", /不允许测试入口隔离存储/.test(B.bodyText), B.bodyText);
check("前缀被拒绝：没有读写任何正式版的键（凭证、账号、副本、游客记录原样）", B.prodUnchanged && B.authSame && B.guestSame);
await browser.close(); srv.closeAllConnections(); srv.close();
const failed = results.filter((r) => !r).length;
console.log(`\n共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
