// CI 构建：同一次运行里构建两份，除了 CSP 的测试域之外应当逐字节相同（后面的 make-pages-artifact 会核对）。
//   dist/         测试专用构建（CSP_TEST_ORIGIN=1：connect-src 带 https://fake.supabase.test）。现有整套测试跑它。绝不发布。
//   dist-formal/  正式构建（默认，不带测试域）。发布内容 dist-pages/ 从它复制；CSP 专项在 dist-pages 上跑。
// 两次构建共用同一个 BUILD_TIME（决定 sw.js 版本和 main-*.js 内容哈希），所以不会出现“测的不是发的”。
// 日志里写清目标、源码提交号和产物目录，避免测试构建被误发布。
import { spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
const BUILD_TIME = new Date().toISOString();
const sha = process.env.GITHUB_SHA || process.env.SOURCE_SHA || "";
const run = (cmd, args, env = {}) => { const r = spawnSync(cmd, args, { stdio: "inherit", env: { ...process.env, ...env } }); if (r.status !== 0) { console.error(`失败：${cmd} ${args.join(" ")}`); process.exit(r.status || 1); } };
console.log(`[build-ci] BUILD_TIME=${BUILD_TIME} 源码提交=${sha || "（本地，取 git）"}`);
run("npm", ["run", "copy-pyodide"]);
rmSync("dist", { recursive: true, force: true }); rmSync("dist-formal", { recursive: true, force: true });
console.log("[build-ci] 目标：测试专用构建 → dist/（含测试域，不得发布）");
run("npx", ["vite", "build", "--outDir", "dist"], { BUILD_TIME, CSP_TEST_ORIGIN: "1" });
console.log("[build-ci] 目标：正式构建 → dist-formal/（不含测试域，发布内容从这里来）");
run("npx", ["vite", "build", "--outDir", "dist-formal"], { BUILD_TIME, CSP_TEST_ORIGIN: "0" });
console.log("[build-ci] 两份构建完成");
