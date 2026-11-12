// 发布内容生成脚本的测试：测试页不进发布目录，其余文件逐字节一致，自检能抓到悬空引用 / 缺文件。纯 node，造一个假 dist。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makePagesArtifact, precacheList } from "../scripts/make-pages-artifact.mjs";
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const tmp = mkdtempSync(join(tmpdir(), "pages-"));
const put = (root, f, s) => { mkdirSync(join(root, f, ".."), { recursive: true }); writeFileSync(join(root, f), s); };
const swWith = (list) => `const VERSION = "t";\nconst PRECACHE = ${JSON.stringify(list, null, 2)};\nself.addEventListener("install", () => {});\n`;
const fake = (name, { indexExtra = "", pre = ["./", "./index.html", "./assets/main-A.js", "./assets/main-A.css", "./manifest.webmanifest", "./privacy.html"] } = {}) => {
  const d = join(tmp, name);
  put(d, "index.html", `<!doctype html><script type="module" src="./assets/main-A.js"></script><link rel="stylesheet" href="./assets/main-A.css">${indexExtra}`);
  put(d, "lab.html", `<script type="module" src="./assets/lab-B.js"></script><link rel="stylesheet" href="./assets/lab-B.css">`);
  put(d, "access-test.html", `<script src="access-test-config.js"></script>`); put(d, "access-test-config.js", "window.X=1");
  put(d, "assets/main-A.js", "console.log('app')"); put(d, "assets/main-A.css", "a{}"); put(d, "assets/lab-B.js", "console.log('lab')"); put(d, "assets/lab-B.css", "b{}");
  put(d, "manifest.webmanifest", "{}"); put(d, "privacy.html", "<p>privacy</p>"); put(d, "pyodide/pyodide.mjs", "export{}"); put(d, "sfx/test-beep.wav", "RIFF");
  put(d, "sw.js", swWith(pre));
  return d;
};
{ const d = fake("a"), o = join(tmp, "a-out"); const r = makePagesArtifact(d, o);
  ok("1 去掉的正好是 access-test.html、access-test-config.js、lab.html 和 lab 专用的 assets", r.dropped.join() === "access-test-config.js,access-test.html,assets/lab-B.css,assets/lab-B.js,lab.html", r.dropped.join());
  ok("2 自检没有问题", r.problems.length === 0, r.problems.join(" | "));
  ok("3 发布目录里没有测试页", !["access-test.html", "access-test-config.js", "lab.html", "assets/lab-B.js", "assets/lab-B.css"].some((f) => existsSync(join(o, f))));
  ok("4 应用文件、Pyodide、测试音频（应用内诊断用）、manifest、隐私页都在，且逐字节一致", ["index.html", "sw.js", "assets/main-A.js", "assets/main-A.css", "manifest.webmanifest", "privacy.html", "pyodide/pyodide.mjs", "sfx/test-beep.wav"].every((f) => readFileSync(join(o, f), "utf8") === readFileSync(join(d, f), "utf8")));
  ok("5 sw.js 预缓存清单没有被改", JSON.stringify(precacheList(o)) === JSON.stringify(precacheList(d)) && !readFileSync(join(o, "sw.js"), "utf8").includes("lab")); }
{ const d = fake("b", { indexExtra: '<a href="lab.html">lab</a>' }); const r = makePagesArtifact(d, join(tmp, "b-out"));
  ok("6 index.html 里还链接着 lab.html：自检失败", r.problems.some((p) => /index\.html 里还引用了被去掉的文件 lab\.html/.test(p)), r.problems.join(" | ")); }
{ const d = fake("c", { pre: ["./", "./index.html", "./assets/main-A.js", "./assets/ghost.js", "./manifest.webmanifest"] }); const r = makePagesArtifact(d, join(tmp, "c-out"));
  ok("7 预缓存清单里有发布目录没有的文件：自检失败（Service Worker 安装会失败）", r.problems.some((p) => /预缓存的文件不在发布目录里：assets\/ghost\.js/.test(p)), r.problems.join(" | ")); }
{ const d = fake("d", { indexExtra: '<script src="./assets/main-A.js?x=access-test-config.js"></script>' }); const r = makePagesArtifact(d, join(tmp, "d-out"));
  ok("8 应用文件里引用 access-test-config.js：自检失败", r.problems.some((p) => /access-test-config\.js/.test(p)), r.problems.join(" | ")); }
{ const d = fake("e"); writeFileSync(join(d, "sw.js"), "no list here"); let threw = false; try { makePagesArtifact(d, join(tmp, "e-out")); } catch { threw = true; }
  ok("9 读不到预缓存清单：直接报错，不生成", threw); }
rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
