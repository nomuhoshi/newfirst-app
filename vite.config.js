import { defineConfig } from "vite";
// base: "./" 让网站放在任何子路径下（例如 /first-app/）都能找到资源。
export default defineConfig({
  base: "./",
  build: { target: "es2022" },
  worker: { format: "es" },
});
