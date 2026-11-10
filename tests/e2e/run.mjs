// npm run test:e2e [webkit|chromium]：不带参数时两个内核都跑。任一失败（1）或环境失败（2）都返回非 0。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const TESTS = ["./critical-flow.test.mjs"].map((f) => fileURLToPath(new URL(f, import.meta.url)));
const list = process.argv.slice(2).length ? process.argv.slice(2) : ["chromium", "webkit"];
let worst = 0;
for (const b of list) {
  let code = 0;
  for (const t of TESTS) {
    const r = spawnSync(process.execPath, [t], { stdio: "inherit", env: { ...process.env, MOBILE_BROWSER: b } });
    code = Math.max(code, r.status ?? 2);
  }
  console.log(`== ${b}: ${code === 0 ? "通过" : code === 2 ? "环境失败" : "失败"}`);
  worst = Math.max(worst, code);
}
process.exit(worst);
