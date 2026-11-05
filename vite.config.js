import { defineConfig } from "vite";
import swPlugin from "./scripts/vite-sw-plugin.mjs";
// base: "./" 让网站放在任何子路径下（例如 /newfirst-app/）都能找到资源。
// 两个页面：index.html 是正式的学习应用；lab.html 是第 1 步的技术验证页（保留做回归测试）。
// 构建目标 es2020：让应用自己的脚本能在较旧的 Safari / 微信内置浏览器里解析（这只是语法层面的兼容改善；Pyodide 是预先编译好的，单独处理）。
// 构建时间同时是应用版本号和离线缓存版本号：显示在“我的”页，方便确认手机上打开的是不是最新版本。
const BUILD = new Date().toISOString();
// 测试入口构建（PREVIEW_ID=pr11 之类）：本地存储键加 "<id>:" 前缀、离线缓存前缀 "<id>-suipian-"。测试入口和正式站同在 github.io 域名下，不隔离的话会读到/清掉正式版的进度和缓存。正式构建不设这个变量，行为不变。
const PREVIEW_ID = (process.env.PREVIEW_ID || "").replace(/[^a-z0-9-]/gi, ""); // 允许连字符（PREVIEW_ID=login-sync → 键前缀 login-sync:）
// 测试入口的云端：只来自构建时的环境变量（独立的测试 Supabase 项目），不设就没有云端；正式构建不读这两个变量。
const TEST_CLOUD = PREVIEW_ID ? { url: process.env.TEST_SUPABASE_URL || "", anonKey: process.env.TEST_SUPABASE_ANON_KEY || "" } : { url: "", anonKey: "" };
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: { input: { main: "index.html", lab: "lab.html" } },
  },
  worker: { format: "es" },
  plugins: [swPlugin({ version: BUILD, prefix: PREVIEW_ID ? `${PREVIEW_ID}-suipian-` : "suipian-" })],
  define: { __BUILD__: JSON.stringify(BUILD), __PREVIEW_ID__: JSON.stringify(PREVIEW_ID), __TEST_CLOUD__: JSON.stringify(TEST_CLOUD) },
});
