// 发布前性能度量（只读）：统计构建产物体积，Pyodide 单列（它只在点“运行”时才下载，不在首屏）。
// 用法：node scripts/perf-size.mjs <dist 目录>    输出表格到日志，设置了 GITHUB_STEP_SUMMARY 时同时写进运行摘要。
import { readdirSync, statSync, readFileSync, appendFileSync } from "node:fs";
import { join, extname, relative } from "node:path";
import { gzipSync } from "node:zlib";

const root = process.argv[2];
if (!root) { console.error("用法：node scripts/perf-size.mjs <dist 目录>"); process.exit(2); }
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); statSync(p).isDirectory() ? walk(p) : files.push(p); } })(root);

const kind = (rel) => rel.startsWith("pyodide/") ? "Pyodide（点“运行”才下载）" : [".js", ".mjs"].includes(extname(rel)) ? "脚本 JS" : extname(rel) === ".css" ? "样式 CSS" : extname(rel) === ".html" ? "页面 HTML" : [".png", ".svg", ".ico", ".jpg", ".webp"].includes(extname(rel)) ? "图片 / 图标" : [".mp3", ".wav", ".ogg", ".m4a"].includes(extname(rel)) ? "音频" : "其他（json 等）";
const groups = new Map();
const big = [];
for (const f of files) {
  const rel = relative(root, f).replaceAll("\\", "/"); const buf = readFileSync(f); const k = kind(rel);
  const gz = [".js", ".mjs", ".css", ".html", ".json", ".svg"].includes(extname(rel)) ? gzipSync(buf).length : buf.length;
  const g = groups.get(k) || { n: 0, raw: 0, gz: 0 }; g.n++; g.raw += buf.length; g.gz += gz; groups.set(k, g);
  if (k !== "Pyodide（点“运行”才下载）") big.push([rel, buf.length, gz]);
}
const kb = (n) => (n / 1024).toFixed(1) + " KB";
const lines = ["| 类别 | 文件数 | 原始 | gzip（或原样） |", "| --- | ---: | ---: | ---: |"];
for (const [k, g] of [...groups].sort((a, b) => b[1].raw - a[1].raw)) lines.push(`| ${k} | ${g.n} | ${kb(g.raw)} | ${kb(g.gz)} |`);
const shell = big.filter(([r]) => /\.(js|css|html)$/.test(r));
const shellRaw = shell.reduce((s, x) => s + x[1], 0), shellGz = shell.reduce((s, x) => s + x[2], 0);
lines.push("", `首屏壳（不含 Pyodide 的 JS + CSS + HTML）：原始 ${kb(shellRaw)}，gzip ${kb(shellGz)}`, "", "最大的 8 个非 Pyodide 文件：", "", "| 文件 | 原始 | gzip |", "| --- | ---: | ---: |");
for (const [r, raw, gz] of big.sort((a, b) => b[1] - a[1]).slice(0, 8)) lines.push(`| ${r} | ${kb(raw)} | ${kb(gz)} |`);
const out = lines.join("\n");
console.log(out);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, "## 构建产物体积\n\n" + out + "\n");
