// 从构建产物 dist/ 生成“要发布的文件”dist-pages/：测试专用页面留在仓库和测试用的 dist/ 里，但不进发布内容。
//   不发布：access-test.html、access-test-config.js（访问测试页）、lab.html（第 1 步技术验证页）以及只有 lab.html 用到的 assets 文件
//   （“只有 lab 用到”= 不在 sw.js 的预缓存清单里，见 vite-sw-plugin：预缓存清单 = 从主入口能到达的文件）。
//   其余文件逐字节原样复制——测试跑的是 dist/，发布的是同样的文件去掉测试页，不是另一次构建。
// 生成后自检（任何一条不满足就非零退出，CI 失败，不会部署）：
//   1. 发布目录里没有上面列出的任何文件；
//   2. sw.js 预缓存清单里的每个文件都在发布目录里（否则 Service Worker 安装会失败）；
//   3. 发布目录里的 index.html / sw.js / 其他 html、js、css 都没有引用被去掉的页面或 lab 专用文件；
//   4. 发布目录 = dist 去掉“被去掉的文件”，没有多也没有少（文件清单逐项核对）。
// 用法：node scripts/make-pages-artifact.mjs [dist 目录] [输出目录]    默认 dist → dist-pages
import { readFileSync, readdirSync, statSync, mkdirSync, copyFileSync, rmSync, existsSync } from "node:fs";
import { join, relative, resolve, dirname, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const TEST_ONLY_FILES = ["access-test.html", "access-test-config.js", "lab.html"];

const walk = (dir, base = dir, out = []) => {
  for (const n of readdirSync(dir)) { const p = join(dir, n); if (statSync(p).isDirectory()) walk(p, base, out); else out.push(relative(base, p).split(sep).join("/")); }
  return out;
};

export function precacheList(distDir) {
  const sw = readFileSync(join(distDir, "sw.js"), "utf8");
  const m = sw.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (!m) throw new Error("sw.js 里找不到 PRECACHE 清单");
  return JSON.parse(m[1]).map((u) => u.replace(/^\.\//, "")).filter((u) => u && u !== "./");
}

export function makePagesArtifact(distDir, outDir) {
  const all = walk(distDir);
  const pre = new Set(precacheList(distDir).map((u) => (u === "" ? "index.html" : u)));
  const labOnly = all.filter((f) => f.startsWith("assets/") && !pre.has(f));
  const drop = new Set([...TEST_ONLY_FILES.filter((f) => all.includes(f)), ...labOnly]);
  rmSync(outDir, { recursive: true, force: true });
  for (const f of all) { if (drop.has(f)) continue; mkdirSync(dirname(join(outDir, f)), { recursive: true }); copyFileSync(join(distDir, f), join(outDir, f)); }
  // ---- 自检 ----
  const problems = [];
  const kept = walk(outDir), keptSet = new Set(kept);
  for (const f of TEST_ONLY_FILES) if (keptSet.has(f)) problems.push(`发布目录里仍有测试页：${f}`);
  for (const f of labOnly) if (keptSet.has(f)) problems.push(`发布目录里仍有 lab 专用文件：${f}`);
  for (const u of pre) if (u !== "index.html" && !keptSet.has(u) && !u.endsWith("/")) problems.push(`sw.js 预缓存的文件不在发布目录里：${u}`);
  if (!keptSet.has("index.html") || !keptSet.has("sw.js")) problems.push("发布目录缺少 index.html 或 sw.js");
  const expected = all.filter((f) => !drop.has(f)).sort().join("\n");
  if (expected !== [...kept].sort().join("\n")) problems.push("发布目录与“dist 去掉测试页”的文件清单不一致");
  const needles = [...drop].map((f) => f.split("/").pop());
  for (const f of kept) {
    if (!/\.(html|js|mjs|css|json|webmanifest)$/.test(f) || f.startsWith("pyodide/")) continue; // Pyodide 的大文件不扫
    const text = readFileSync(join(outDir, f), "utf8");
    for (const n of needles) if (text.includes(n)) problems.push(`${f} 里还引用了被去掉的文件 ${n}`);
  }
  return { dropped: [...drop].sort(), kept: kept.length, problems };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = resolve(process.argv[2] || "dist"), out = resolve(process.argv[3] || "dist-pages");
  if (!existsSync(dist)) { console.error("找不到 " + dist + "，先运行 npm run build"); process.exit(2); }
  const r = makePagesArtifact(dist, out);
  console.log(`发布目录 ${out}：保留 ${r.kept} 个文件；去掉 ${r.dropped.length} 个测试专用文件：\n  ` + r.dropped.join("\n  "));
  if (r.problems.length) { console.error("\n自检失败：\n  " + r.problems.join("\n  ")); process.exit(1); }
  console.log("自检通过：无测试页、预缓存清单完整、没有悬空引用。");
}
