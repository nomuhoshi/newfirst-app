// 把 Pyodide 运行文件从 node_modules 复制到 public/pyodide/，让它和网页一起托管（不依赖外部 CDN）。
import { cpSync, mkdirSync, existsSync } from "node:fs";
const src = "node_modules/pyodide/";
const dst = "public/pyodide/";
const files = ["pyodide.mjs", "pyodide.asm.mjs", "pyodide.asm.wasm", "python_stdlib.zip", "pyodide-lock.json"];
mkdirSync(dst, { recursive: true });
for (const f of files) {
  if (existsSync(src + f)) cpSync(src + f, dst + f);
  else console.warn("缺少文件：", f);
}
console.log("Pyodide 已复制到", dst);
