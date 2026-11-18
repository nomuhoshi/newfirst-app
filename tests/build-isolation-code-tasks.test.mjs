// 构建隔离：外层环境即使设了 CODE_TASKS_TEST_BUILD=1 和 CODE_TASKS=U3L5-M1，npm run build:ci 的前两份构建（dist、dist-formal）也必须没有代码题，只有 dist-code-tasks 有。
// 做法：在临时目录前缀（BUILD_CI_PREFIX=iso-）下跑完整的 scripts/build-ci.mjs，不动真正的 dist；再读三份主脚本里的试点列表。
// 另有一条：直接用正式构建参数（没有 CSP_TEST_ORIGIN）加 CODE_TASKS_TEST_BUILD=1 跑 vite，必须中止（不静默构建）。
// 运行：node tests/build-isolation-code-tasks.test.mjs
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
const IDS = JSON.parse(readFileSync(new URL("../scripts/code-task-pilot-ids.json", import.meta.url), "utf8")), IDS_TXT = "[" + IDS.join(",") + "]";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = "") => { ok ? pass++ : fail++; console.log(`${ok ? "✅" : "❌"} ${n}${ok || !d ? "" : "  — " + d}`); };
const DIRS = ["iso-dist", "iso-dist-formal", "iso-dist-code-tasks", "iso-guard"];
const clean = () => { for (const d of DIRS) rmSync(join(ROOT, d), { recursive: true, force: true }); };
const RE = /=\[((?:`[^`]+`,?)*)\],[\w$]+=[\w$]+\(\{U1:/;
const list = (d) => { const dir = join(ROOT, d, "assets"); if (!existsSync(dir)) return "（没有产物）"; const f = readdirSync(dir).find((x) => /^main-.*\.js$/.test(x)); const m = readFileSync(join(dir, f), "utf8").match(RE); return m ? "[" + (m[1].match(/`([^`]+)`/g) || []).map((x) => x.slice(1, -1)).join(",") + "]" : "（找不到试点列表：压缩后的写法变了，请更新本测试的正则）"; };
clean();
try {
  const outer = { ...process.env, CODE_TASKS_TEST_BUILD: "1", CODE_TASKS: "U3L5-M1", BUILD_CI_PREFIX: "iso-" };
  const r = spawnSync("node", ["scripts/build-ci.mjs"], { cwd: ROOT, env: outer, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  check("外层环境设了 CODE_TASKS_TEST_BUILD=1 和 CODE_TASKS=U3L5-M1：完整 build-ci 仍然成功", r.status === 0, (r.stderr || "").slice(-300));
  const log = r.stdout || "";
  check("构建日志：前两份构建写“代码题试点：关闭”，第三份写“试点题列表（仅测试构建，不得发布）”", (log.match(/代码题试点：关闭/g) || []).length === 2 && log.includes("代码题试点：" + IDS.join("、") + "（仅测试构建"), (log.match(/代码题试点：[^\n]*/g) || []).join(" | "));
  check("构建产物（主脚本）：dist（测试专用）里试点列表是 []", list("iso-dist") === "[]", list("iso-dist"));
  check("构建产物（主脚本）：dist-formal（正式）里试点列表是 []", list("iso-dist-formal") === "[]", list("iso-dist-formal"));
  check("构建产物（主脚本）：只有 dist-code-tasks 里是试点题列表（" + IDS_TXT + "）", list("iso-dist-code-tasks") === IDS_TXT, list("iso-dist-code-tasks"));
  // 正式构建参数 + 外层 CODE_TASKS_TEST_BUILD=1：必须中止
  const g = spawnSync("npx", ["vite", "build", "--outDir", "iso-guard"], { cwd: ROOT, env: { ...process.env, CODE_TASKS_TEST_BUILD: "1", CODE_TASKS: "U3L5-M1", CSP_TEST_ORIGIN: "0" }, encoding: "utf8" });
  check("正式构建（CSP_TEST_ORIGIN 不是 1）遇到 CODE_TASKS_TEST_BUILD=1：构建中止，没有产物", g.status !== 0 && /正式构建不得启用代码题试点/.test((g.stderr || "") + (g.stdout || "")) && !existsSync(join(ROOT, "iso-guard", "index.html")), `status=${g.status}`);
} finally { clean(); }
console.log(`\n共 ${pass + fail} 项，失败 ${fail} 项`);
process.exit(fail ? 1 : 0);
