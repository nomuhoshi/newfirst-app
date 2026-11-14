// npm run test:mobile [webkit|chromium]：不带参数时两个内核都跑。任一个失败（1）、环境失败（2）或超时（124）都返回非 0。
// 执行器在 scripts/script-runner.mjs：每个脚本有独立时间上限（TEST_STEP_TIMEOUT 秒，默认 900），超时杀整个进程组，最后逐脚本汇总。
import { fileURLToPath } from "node:url";
import { runEngines } from "../../scripts/script-runner.mjs";
const T = fileURLToPath(new URL("./webkit.test.mjs", import.meta.url));
const list = process.argv.slice(2).length ? process.argv.slice(2) : ["webkit", "chromium"];
// 判题核心、代码题答题页、账号登录/云端、多标签页令牌刷新与替换提示：同一个内核再各跑一遍
const EXTRAS = ["../judge-browser.test.mjs", "../code-task.test.mjs", "../account-ui.test.mjs", "../auth-errors-ui.test.mjs", "../touch-targets.test.mjs", "../lazy-python.test.mjs", "../code-block-whitespace.test.mjs", "../csp.test.mjs", "../account-replaced.test.mjs", "../account-cleanup-ui.test.mjs", "../pending-quarantine-ui.test.mjs", "../preview-info.test.mjs", "../sync-two-tabs-browser.test.mjs", "../preview-storage.test.mjs", "../preview-build-isolation.test.mjs", "../code-drafts-project.test.mjs", "../accounts-off.test.mjs", "../choice-layout.test.mjs", "../feedback-scroll.test.mjs", "../feedback-ios-sticky.test.mjs", "../progress-concurrency.test.mjs", "../progress-persistence.test.mjs", "../theme-toggle.test.mjs"];
const scriptsFor = (b) => [
  { file: T, env: { MOBILE_BROWSER: b } },
  ...EXTRAS.map((e) => ({ file: fileURLToPath(new URL(e, import.meta.url)), env: { MOBILE_BROWSER: b, JUDGE_BROWSERS: b } })),
];
const { code } = await runEngines(list, scriptsFor);
process.exit(code);
