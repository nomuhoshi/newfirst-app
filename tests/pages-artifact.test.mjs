// 发布内容生成脚本的测试：测试页不进发布目录，其余文件逐字节一致，自检能抓到悬空引用 / 缺文件。纯 node，造一个假 dist。
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { makePagesArtifact, precacheList } from "../scripts/make-pages-artifact.mjs";
import { injectCsp, TEST_CLOUD_ORIGIN } from "../scripts/vite-csp-plugin.mjs";
import { PROD_HOST } from "../src/cloud-config.js";
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
// ---- GPT1 04:44 阻断项：“未预缓存”不等于“lab 专用”。只删能证明由 lab 独占的文件 ----
{ const d = fake("f"); put(d, "assets/main-A.js", "import('./chunk-C.js');new Worker(new URL('./py-worker-W.js',import.meta.url),{type:'module'});");
  put(d, "assets/chunk-C.js", "export*from'./dep-D.js'"); put(d, "assets/dep-D.js", "export const d=1"); put(d, "assets/py-worker-W.js", "export{}");
  const o = join(tmp, "f-out"); const r = makePagesArtifact(d, o);
  ok("10 正式入口运行时按需加载、但不在预缓存里的分块 / 它的依赖 / Worker 全部保留", ["assets/chunk-C.js", "assets/dep-D.js", "assets/py-worker-W.js"].every((f) => existsSync(join(o, f))) && r.problems.length === 0, r.problems.join(" | ") + " dropped=" + r.dropped.join()); }
{ const d = fake("g"); put(d, "assets/shared-S.js", "export const s=1"); put(d, "assets/main-A.js", "import {s} from './shared-S.js'"); put(d, "assets/lab-B.js", "import {s} from './shared-S.js'");
  const o = join(tmp, "g-out"); const r = makePagesArtifact(d, o);
  ok("11 lab 和正式入口共用的分块保留，lab 独占的照样去掉", existsSync(join(o, "assets/shared-S.js")) && !existsSync(join(o, "assets/lab-B.js")) && r.problems.length === 0, r.problems.join(" | ")); }
{ const d = fake("h"); put(d, "assets/orphan-Z.js", "x");
  const o = join(tmp, "h-out"); const r = makePagesArtifact(d, o);
  ok("12 没人引用的孤儿文件保留（只删能证明是 lab 独占的）", existsSync(join(o, "assets/orphan-Z.js")) && !r.dropped.includes("assets/orphan-Z.js")); }
{ const d = fake("i"); put(d, "assets/main-A.js", "import('./missing-M.js')"); const r = makePagesArtifact(d, join(tmp, "i-out"));
  ok("13 正式文件里的相对 import 指向发布目录里不存在的文件：自检失败", r.problems.some((p) => /missing-M\.js 不在发布目录里/.test(p)), r.problems.join(" | ")); }
{ const d = fake("j"); put(d, "assets/main-A.js", "import('./lab-B.js')"); const r = makePagesArtifact(d, join(tmp, "j-out"));
  ok("14 正式入口引用了 lab 文件：不会被当作 lab 独占（保留），自检通过", !r.dropped.includes("assets/lab-B.js") && r.problems.length === 0, r.problems.join(" | ") + " dropped=" + r.dropped.join()); }
// ---- K-CSP：发布内容的 CSP 不得带测试域 / 其他项目 / 通配；与测试专用构建只允许差这一个测试域 ----
const withCsp = (name, opts) => { const d = fake(name); const h = readFileSync(join(d, "index.html"), "utf8").replace("<!doctype html>", '<!doctype html><meta charset="utf-8">'); writeFileSync(join(d, "index.html"), injectCsp(h, opts)); return d; };
const PROD = `https://${PROD_HOST}`;
{ const d = withCsp("k1", { connect: [PROD] }); const r = makePagesArtifact(d, join(tmp, "k1-out"), { requireCsp: true });
  ok("15 正式 CSP（只有 'self' 和正式项目）：自检通过", r.problems.length === 0, r.problems.join(" | ")); }
{ const d = withCsp("k2", { connect: [PROD], testOrigin: true }); const r = makePagesArtifact(d, join(tmp, "k2-out"), { requireCsp: true });
  ok("16 发布内容的 CSP 带测试域 fake.supabase.test：自检失败", r.problems.some((p) => /connect-src 里有不该有的来源：https:\/\/fake\.supabase\.test/.test(p)) && r.problems.some((p) => /出现了测试域/.test(p)), r.problems.join(" | ")); }
{ const d = withCsp("k3", { connect: ["https://other-project.supabase.co"] }); const r = makePagesArtifact(d, join(tmp, "k3-out"), { requireCsp: true });
  ok("17 CSP 放行了别的 Supabase 项目：自检失败", r.problems.some((p) => /other-project/.test(p)), r.problems.join(" | ")); }
{ const d = withCsp("k4", { connect: ["https://*.supabase.co"] }); const r = makePagesArtifact(d, join(tmp, "k4-out"), { requireCsp: true });
  ok("18 CSP 里有通配符：自检失败", r.problems.some((p) => /通配符/.test(p)), r.problems.join(" | ")); }
{ const d = fake("k5"); const r = makePagesArtifact(d, join(tmp, "k5-out"), { requireCsp: true });
  ok("19 要求有 CSP 而发布内容里没有：自检失败", r.problems.some((p) => /CSP meta 应当恰好 1 条/.test(p)), r.problems.join(" | ")); }
{ const f = withCsp("k6f", { connect: [PROD] }), t = withCsp("k6t", { connect: [PROD], testOrigin: true });
  const r = makePagesArtifact(f, join(tmp, "k6-out"), { requireCsp: true, testDist: t });
  ok("20 与测试专用构建对照：只差 CSP 里的测试域 → 通过", r.problems.length === 0, r.problems.join(" | ")); }
{ const f = withCsp("k7f", { connect: [PROD] }), t = withCsp("k7t", { connect: [PROD], testOrigin: true }); writeFileSync(join(t, "assets/main-A.js"), "console.log('different')");
  const r = makePagesArtifact(f, join(tmp, "k7-out"), { requireCsp: true, testDist: t });
  ok("21 对照时 JS 内容不同：失败（说明测的不是发的）", r.problems.some((p) => /assets\/main-A\.js 内容不同/.test(p)), r.problems.join(" | ")); }
{ const f = withCsp("k8f", { connect: [PROD] }), t = withCsp("k8t", { connect: [PROD], testOrigin: true }); put(t, "assets/extra.js", "x");
  const r = makePagesArtifact(f, join(tmp, "k8-out"), { requireCsp: true, testDist: t });
  ok("22 对照时测试构建多出文件：失败", r.problems.some((p) => /测试专用构建里有、正式构建里没有的文件：assets\/extra\.js/.test(p)), r.problems.join(" | ")); }
{ const f = withCsp("k9f", { connect: [PROD] }), t = withCsp("k9t", { connect: [PROD, "https://x.supabase.co"], testOrigin: true });
  const r = makePagesArtifact(f, join(tmp, "k9-out"), { requireCsp: true, testDist: t });
  ok("23 对照时 CSP 除测试域外还有别的差异：失败", r.problems.some((p) => /index\.html 内容不同/.test(p)), r.problems.join(" | ")); }
rmSync(tmp, { recursive: true, force: true });
console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
