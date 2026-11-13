// npm run test:e2e [webkit|chromium]：不带参数时两个内核都跑。任一失败（1）、环境失败（2）或超时（124）都返回非 0。
// 执行器在 scripts/script-runner.mjs：每个脚本有独立时间上限（TEST_STEP_TIMEOUT 秒，默认 900），超时杀整个进程组，最后逐脚本汇总。
import { fileURLToPath } from "node:url";
import { runEngines } from "../../scripts/script-runner.mjs";
const TESTS = ["./critical-flow.test.mjs", "./pwa-split.test.mjs"].map((f) => fileURLToPath(new URL(f, import.meta.url)));
const list = process.argv.slice(2).length ? process.argv.slice(2) : ["chromium", "webkit"];
const scriptsFor = (b) => TESTS.map((file) => ({ file, env: { MOBILE_BROWSER: b } }));
const { code } = await runEngines(list, scriptsFor);
process.exit(code);
