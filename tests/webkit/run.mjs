// npm run test:mobile [webkit|chromium]：不带参数时两个内核都跑。任一个失败（1）或环境失败（2）都返回非 0。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const T = fileURLToPath(new URL("./webkit.test.mjs", import.meta.url));
const list = process.argv.slice(2).length ? process.argv.slice(2) : ["webkit", "chromium"];
let worst = 0;
for (const b of list) {
  const r = spawnSync(process.execPath, [T], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b } });
  let code = r.status ?? 2;
  // 判题核心、代码题答题页、账号登录/云端、多标签页令牌刷新与替换提示：同一个内核再各跑一遍
  for (const extra of ["../judge-browser.test.mjs", "../code-task.test.mjs", "../account-ui.test.mjs", "../auth-errors-ui.test.mjs", "../touch-targets.test.mjs", "../code-block-whitespace.test.mjs", "../csp.test.mjs", "../account-replaced.test.mjs", "../account-cleanup-ui.test.mjs", "../pending-quarantine-ui.test.mjs", "../preview-info.test.mjs", "../sync-two-tabs-browser.test.mjs", "../preview-storage.test.mjs", "../preview-build-isolation.test.mjs", "../code-drafts-project.test.mjs", "../accounts-off.test.mjs", "../choice-layout.test.mjs", "../feedback-scroll.test.mjs", "../feedback-ios-sticky.test.mjs", "../progress-persistence.test.mjs"]) {
    const x = spawnSync(process.execPath, [fileURLToPath(new URL(extra, import.meta.url))], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b, JUDGE_BROWSERS: b } });
    code = Math.max(code, x.status ?? 2);
  }
  console.log(`== ${b}: ${code === 0 ? "通过" : code === 2 ? "环境失败" : "失败"}`);
  worst = Math.max(worst, code);
}
process.exit(worst);
