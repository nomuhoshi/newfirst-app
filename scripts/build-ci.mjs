// CI 构建：同一次运行里构建两份，除了 CSP 的测试域之外应当逐字节相同（后面的 make-pages-artifact 会核对）。
//   dist/         测试专用构建（CSP_TEST_ORIGIN=1：connect-src 带 https://fake.supabase.test）。现有整套测试跑它。绝不发布。
//   dist-formal/  正式构建（默认，不带测试域）。发布内容 dist-pages/ 从它复制；CSP 专项在 dist-pages 上跑。
// 两次构建共用同一个 BUILD_TIME（决定 sw.js 版本和 main-*.js 内容哈希），所以不会出现“测的不是发的”。
// 日志里写清目标、源码提交号和产物目录，避免测试构建被误发布。
import { spawnSync } from "node:child_process";
import { rmSync, readFileSync } from "node:fs";
// 试点启用的题（唯一来源：scripts/code-task-pilot-ids.json；只进 dist-code-tasks）
const PILOT_IDS = JSON.parse(readFileSync(new URL("./code-task-pilot-ids.json", import.meta.url), "utf8"));
const BUILD_TIME = new Date().toISOString();
const sha = process.env.GITHUB_SHA || process.env.SOURCE_SHA || "";
const run = (cmd, args, env = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }); if (r.status !== 0) { console.error(`失败：${cmd} ${args.join(" ")}`); process.exit(r.status || 1); } };
console.log(`[build-ci] BUILD_TIME=${BUILD_TIME} 源码提交=${sha || "（本地，取 git）"}`);
// 输出目录前缀（只给“构建隔离”测试用，默认空；测试里用它在临时目录跑完整构建，不覆盖真正的 dist）
const P = (process.env.BUILD_CI_PREFIX || "").replace(/[^a-z0-9-]/gi, "");
const D = { test: `${P}dist`, formal: `${P}dist-formal`, code: `${P}dist-code-tasks` };
// 代码题试点开关：前两份构建显式关闭（不继承外层环境里可能存在的 CODE_TASKS_TEST_BUILD / CODE_TASKS），只有第三份显式开启。
const CODE_OFF = { CODE_TASKS_TEST_BUILD: "0", CODE_TASKS: "" };
run("npm", ["run", "copy-pyodide"]);
for (const d of Object.values(D)) rmSync(d, { recursive: true, force: true });
console.log("[build-ci] 目标：测试专用构建 → dist/（含测试域，不得发布）");
run("npx", ["vite", "build", "--outDir", D.test], { BUILD_TIME, CSP_TEST_ORIGIN: "1", ...CODE_OFF });
console.log("[build-ci] 目标：正式构建 → dist-formal/（不含测试域，发布内容从这里来）");
run("npx", ["vite", "build", "--outDir", D.formal], { BUILD_TIME, CSP_TEST_ORIGIN: "0", ...CODE_OFF });
// 第三份：代码题试点构建（只给“代码题试点”测试用，绝不发布；不影响上面两份逐字节对照）
console.log("[build-ci] 目标：代码题试点构建 → dist-code-tasks/（CODE_TASKS=" + PILOT_IDS.join(",") + "，仅测试，不得发布）");
run("npx", ["vite", "build", "--outDir", D.code], { BUILD_TIME, CSP_TEST_ORIGIN: "1", CODE_TASKS_TEST_BUILD: "1", CODE_TASKS: PILOT_IDS.join(",") });
console.log("[build-ci] 三份构建完成");
