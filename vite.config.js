import { defineConfig } from "vite";
// base: "./" 让网站放在任何子路径下（例如 /newfirst-app/）都能找到资源。
// 两个页面：index.html 是正式的学习应用；lab.html 是第 1 步的技术验证页（保留做回归测试）。
export default defineConfig({
  base: "./",
  build: {
    target: "es2022",
    rollupOptions: { input: { main: "index.html", lab: "lab.html" } },
  },
  worker: { format: "es" },
  // 构建时间：显示在“我的”页，方便确认手机上打开的是不是最新版本
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
});
