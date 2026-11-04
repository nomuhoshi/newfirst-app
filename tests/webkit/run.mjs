// npm run test:mobile [webkit|chromium]：不带参数时两个内核都跑。任一个失败（1）或环境失败（2）都返回非 0。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const T = fileURLToPath(new URL("./webkit.test.mjs", import.meta.url));
const list = process.argv.slice(2).length ? process.argv.slice(2) : ["webkit", "chromium"];
let worst = 0;
for (const b of list) {
  const r = spawnSync(process.execPath, [T], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b } });
  let code = r.status ?? 2;
  // 判题核心 + 真实 Runner（真 Pyodide、真 Worker）：同一个内核再跑一遍
  const x = spawnSync(process.execPath, [fileURLToPath(new URL("../judge-browser.test.mjs", import.meta.url))], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b, JUDGE_BROWSERS: b } });
  const y = spawnSync(process.execPath, [fileURLToPath(new URL("../account-ui.test.mjs", import.meta.url))], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b } }); // 账号登录 / 云端同步界面（假 Supabase、两台设备）
  code = Math.max(code, y.status ?? 2);
  code = Math.max(code, x.status ?? 2);
  console.log(`== ${b}: ${code === 0 ? "通过" : code === 2 ? "环境失败" : "失败"}`);
  worst = Math.max(worst, code);
}
process.exit(worst);
