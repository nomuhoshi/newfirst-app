import { defineConfig } from "vite";
import swPlugin from "./scripts/vite-sw-plugin.mjs";
// base: "./" 让网站放在任何子路径下（例如 /newfirst-app/）都能找到资源。
// 两个页面：index.html 是正式的学习应用；lab.html 是第 1 步的技术验证页（保留做回归测试）。
// 构建目标 es2020：让应用自己的脚本能在较旧的 Safari / 微信内置浏览器里解析（这只是语法层面的兼容改善；Pyodide 是预先编译好的，单独处理）。
// 构建时间同时是应用版本号和离线缓存版本号：显示在“我的”页，方便确认手机上打开的是不是最新版本。
const BUILD = new Date().toISOString();
// 预览构建（LAB=1）：启用“编程实验室”第三版视觉；缓存名前缀 lab3-suipian-（不以 suipian- 开头，正式版的清理逻辑删不到它）；本地存储另由 src/lab-storage.js 加前缀隔离。正式构建不设这个变量，行为不变。
const LAB = process.env.LAB === "1";
export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    rollupOptions: { input: { main: "index.html", lab: "lab.html" } },
  },
  worker: { format: "es" },
  plugins: [swPlugin({ version: BUILD, prefix: LAB ? "lab3-suipian-" : "suipian-" })],
  define: { __BUILD__: JSON.stringify(BUILD), __LAB__: JSON.stringify(LAB) },
});
