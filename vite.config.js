import { defineConfig } from "vite";
import { execSync } from "node:child_process";
import swPlugin from "./scripts/vite-sw-plugin.mjs";
import { checkPreviewCloud, resolveSourceSha } from "./scripts/preview-cloud-check.mjs";
// base: "./" 让网站放在任何子路径下（例如 /newfirst-app/）都能找到资源。
// 两个页面：index.html 是正式的学习应用；lab.html 是第 1 步的技术验证页（保留做回归测试）。
// 构建目标 es2020：让应用自己的脚本能在较旧的 Safari / 微信内置浏览器里解析（这只是语法层面的兼容改善；Pyodide 是预先编译好的，单独处理）。
// 构建时间同时是应用版本号和离线缓存版本号：显示在“我的”页，方便确认手机上打开的是不是最新版本。
const BUILD = new Date().toISOString();
// 测试入口构建（PREVIEW_ID=pr11 之类）：本地存储键加 "<id>:" 前缀、离线缓存前缀 "<id>-suipian-"。测试入口和正式站同在 github.io 域名下，不隔离的话会读到/清掉正式版的进度和缓存。正式构建不设这个变量，行为不变。
const PREVIEW_ID = (process.env.PREVIEW_ID || "").replace(/[^a-z0-9-]/gi, ""); // 允许连字符（PREVIEW_ID=login-sync → 键前缀 login-sync:）
// 测试入口的云端：只来自构建时的环境变量（独立的测试 Supabase 项目），不设就没有云端；正式构建不读这两个变量。
const TEST_CLOUD = PREVIEW_ID ? { url: process.env.TEST_SUPABASE_URL || "", anonKey: process.env.TEST_SUPABASE_ANON_KEY || "" } : { url: "", anonKey: "" };
// 构建时校验测试入口的目标云项目（配置错误 → 构建失败，不再静默变成“云端关闭”）。构建日志打印云端模式和源码提交号（不打印密钥）。
const gitSha = () => { try { const sha = execSync("git rev-parse HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); const dirty = execSync("git status --porcelain", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); return sha + (dirty ? "-dirty" : ""); } catch { return ""; } };
const SOURCE_SHA = resolveSourceSha(process.env, gitSha);
const CLOUD_CHECK = checkPreviewCloud(process.env);
if (PREVIEW_ID && process.env.REQUIRE_TEST_CLOUD === "1" && !/^[0-9a-f]{40}$/.test(SOURCE_SHA)) CLOUD_CHECK.errors.push("严格模式需要完整的 40 位源码提交号（设置 SOURCE_SHA 或在干净的 git 工作区构建），现在是：" + SOURCE_SHA);
console.log(`[构建] ${PREVIEW_ID ? "测试入口 " + PREVIEW_ID : "正式构建"} | 云端：${CLOUD_CHECK.info.cloud} | 源码提交：${SOURCE_SHA}`);
for (const n of CLOUD_CHECK.notes) console.log("[构建] " + n);
if (CLOUD_CHECK.errors.length) throw new Error("测试入口云配置校验失败，构建已中止：\n  - " + CLOUD_CHECK.errors.join("\n  - "));
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: { input: { main: "index.html", lab: "lab.html" } },
  },
  worker: { format: "es" },
  plugins: [swPlugin({ version: BUILD, prefix: PREVIEW_ID ? `${PREVIEW_ID}-suipian-` : "suipian-" })],
  define: { __SOURCE_SHA__: JSON.stringify(SOURCE_SHA), __BUILD__: JSON.stringify(BUILD), __PREVIEW_ID__: JSON.stringify(PREVIEW_ID), __TEST_CLOUD__: JSON.stringify(TEST_CLOUD) },
});
