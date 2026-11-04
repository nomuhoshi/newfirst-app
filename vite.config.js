import { defineConfig } from "vite";
import swPlugin from "./scripts/vite-sw-plugin.mjs";
// base: "./" 让网站放在任何子路径下（例如 /newfirst-app/）都能找到资源。
// 两个页面：index.html 是正式的学习应用；lab.html 是第 1 步的技术验证页（保留做回归测试）。
// 构建目标 es2020：让应用自己的脚本能在较旧的 Safari / 微信内置浏览器里解析（这只是语法层面的兼容改善；Pyodide 是预先编译好的，单独处理）。
// 构建时间同时是应用版本号和离线缓存版本号：显示在“我的”页，方便确认手机上打开的是不是最新版本。
const BUILD = new Date().toISOString();
// 实验预览（EXP=<名字>，如 quick）：启用实验功能；缓存名前缀 exp-<名字>-suipian-（不以 suipian- 开头，正式版清理删不到）；本地存储由 src/exp-storage.js 加 exp-<名字>: 前缀隔离。正式构建不设这个变量，行为不变。
const EXP = process.env.EXP || "";
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: { input: { main: "index.html", lab: "lab.html" } },
  },
  worker: { format: "es" },
  plugins: [swPlugin({ version: BUILD, prefix: EXP ? `exp-${EXP}-suipian-` : "suipian-" })],
  define: { __BUILD__: JSON.stringify(BUILD), __EXP__: JSON.stringify(EXP) },
});
