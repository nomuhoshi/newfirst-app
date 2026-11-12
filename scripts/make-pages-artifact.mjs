// 从构建产物 dist/ 生成“要发布的文件”dist-pages/：测试专用页面留在仓库和测试用的 dist/ 里，但不进发布内容。
//   不发布：access-test.html、access-test-config.js（访问测试页）、lab.html（第 1 步技术验证页）以及“只有 lab.html 用到”的 assets 文件。
//   “只有 lab 用到” = 从 lab.html 顺着文件内容里的引用（按构建出的文件名）能到达、而从所有正式文件（index.html、sw.js、其他非 assets 文件）
//   顺着引用都到不了的 assets 文件。判断依据是引用关系，不是“有没有被预缓存”：正式入口运行时按需请求的文件（动态 import 的分块、Worker）即使不在
//   预缓存清单里也属于正式文件，不会被去掉；lab 和正式入口共用的分块也保留；两边都没人引用的孤儿文件也保留（只删能证明是 lab 独占的）。
//   其余文件逐字节原样复制——测试跑的是 dist/，发布的是同样的文件去掉测试页，不是另一次构建。
// 生成后自检（任何一条不满足就非零退出，CI 失败，不会部署）：
//   1. 发布目录里没有上面列出的任何文件；
//   2. sw.js 预缓存清单里的每个文件都在发布目录里（否则 Service Worker 安装会失败）；
//   3. 发布目录里的 index.html / sw.js / 其他 html、js、css 都没有引用被去掉的页面或 lab 专用文件；
//   3b. 发布目录里所有 js/css/html 里写成相对路径的 import / new URL(…, import.meta.url) / src / href 引用，指向的文件都在发布目录里（运行时依赖不缺）；
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

const TEXT = /\.(html|js|mjs|css|json|webmanifest)$/;
// 从若干起点出发，顺着“文件内容里出现了某个 assets 文件名”这种引用走，返回能到达的 assets 文件集合
function reachableAssets(distDir, all, roots) {
  const assets = all.filter((f) => f.startsWith("assets/")), byName = new Map(assets.map((f) => [f.split("/").pop(), f]));
  const seen = new Set(), queue = [...roots];
  while (queue.length) {
    const f = queue.pop();
    if (!TEXT.test(f) || f.startsWith("pyodide/")) continue;
    const text = readFileSync(join(distDir, f), "utf8");
    for (const [name, path] of byName) if (!seen.has(path) && text.includes(name)) { seen.add(path); queue.push(path); }
  }
  return seen;
}

export function makePagesArtifact(distDir, outDir) {
  const all = walk(distDir);
  const pre = new Set(precacheList(distDir).map((u) => (u === "" ? "index.html" : u)));
  const formalRoots = all.filter((f) => !f.startsWith("assets/") && !TEST_ONLY_FILES.includes(f));
  const fromFormal = reachableAssets(distDir, all, formalRoots);
  const fromLab = all.includes("lab.html") ? reachableAssets(distDir, all, ["lab.html"]) : new Set();
  const labOnly = [...fromLab].filter((f) => !fromFormal.has(f) && !pre.has(f));
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
  // 3b：相对路径引用都要在发布目录里（抓“误删了运行时按需请求的文件”）
  const REL = [/\bimport\s*\(\s*["'`](\.{1,2}\/[^"'`?#]+)["'`]/g, /\bfrom\s*["'`](\.{1,2}\/[^"'`?#]+)["'`]/g, /\bimport\s*["'`](\.{1,2}\/[^"'`?#]+)["'`]/g,
    /new URL\(\s*["'`]([^"'`?#]+)["'`]\s*,\s*import\.meta\.url/g, /\b(?:src|href)=["'](\.\/[^"'?#]+)["']/g, /url\(\s*["']?(\.{1,2}\/[^"')?#]+)["']?\s*\)/g];
  for (const f of kept) {
    if (!/\.(html|js|mjs|css)$/.test(f) || f.startsWith("pyodide/")) continue;
    const text = readFileSync(join(outDir, f), "utf8"), dir = f.includes("/") ? f.slice(0, f.lastIndexOf("/")) : "";
    for (const re of REL) for (const m of text.matchAll(re)) {
      const target = resolve("/", dir, m[1]).slice(1);
      if (target && !keptSet.has(target) && !/\/$/.test(m[1]) && !all.includes(target + "/index.html")) problems.push(`${f} 引用的 ${m[1]} 不在发布目录里`);
    }
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
