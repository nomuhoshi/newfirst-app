// `npm test` 的运行器：按顺序执行 package.json 里 "test:chain" 的每一条命令（用 " && " 分隔），
// 比 shell 里直接 `a && b && c` 多三样：
//   1. 每条命令有时间上限（默认 900 秒，环境变量 TEST_STEP_TIMEOUT 秒数可调）；超时就杀掉整个进程组（含浏览器、子服务器），
//      并明确写出“哪一条卡住了”，而不是让整个 npm test 静静地挂着；
//   2. 每条命令结束都打印一行：命令、退出码、耗时；失败 / 超时时马上停（KEEP_GOING=1 则继续跑完并汇总）；
//   3. 命令结束后清理本工作区残留的 `vite preview` 进程（老版本的测试会留下它们）。
// 用法：node scripts/run-tests.mjs [chain 名，默认 test:chain]    （TEST_CHAIN_CMD 可直接给一条链，测试用）
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
const chainName = process.argv[2] || "test:chain";
const chain = process.env.TEST_CHAIN_CMD || pkg.scripts[chainName];
if (!chain) { console.error(`package.json 里没有 ${chainName}`); process.exit(2); }
const LIMIT = Number(process.env.TEST_STEP_TIMEOUT || 900) * 1000;
const KEEP = process.env.KEEP_GOING === "1";
const cmds = chain.split(" && ").map((s) => s.trim()).filter(Boolean);

function killGroup(child, sig) { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* 已经退出 */ } } }
function sweepStrayPreviews() { // 只清本工作区的（命令行里带本目录的 node_modules/.bin/vite）
  spawnSync("pkill", ["-f", `${ROOT}/node_modules/.bin/vite preview`], { stdio: "ignore" });
}
async function runOne(cmd) {
  const t0 = Date.now();
  return await new Promise((done) => {
    const child = spawn("bash", ["-c", cmd], { cwd: ROOT, stdio: "inherit", detached: true }); // detached：自成进程组，超时能整组杀
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; console.error(`\n⏱ 超时（${LIMIT / 1000} 秒）：${cmd}\n  正在结束这条命令的整个进程组……`); killGroup(child, "SIGTERM"); setTimeout(() => killGroup(child, "SIGKILL"), 5000); }, LIMIT);
    child.on("exit", (code, sig) => { clearTimeout(timer); killGroup(child, "SIGKILL"); done({ cmd, code: timedOut ? 124 : (code ?? (sig ? 128 : 1)), secs: Math.round((Date.now() - t0) / 1000), timedOut }); });
    child.on("error", (e) => { clearTimeout(timer); console.error(String(e)); done({ cmd, code: 127, secs: 0, timedOut: false }); });
  });
}

const rows = []; let bad = 0;
for (const cmd of cmds) {
  const r = await runOne(cmd); sweepStrayPreviews(); rows.push(r);
  if (r.code !== 0) { bad++; if (!KEEP) break; }
}
console.log("\n── 测试运行汇总 ──");
for (const r of rows) console.log(`${r.code === 0 ? "✅" : r.timedOut ? "⏱" : "❌"} rc=${String(r.code).padEnd(3)} ${String(r.secs).padStart(4)}s  ${r.cmd}`);
if (rows.length < cmds.length) console.log(`（第一个失败后已停止，剩余 ${cmds.length - rows.length} 条没有运行；KEEP_GOING=1 可以继续跑完）`);
if (bad) console.log(rows.filter((r) => r.code !== 0).map((r) => (r.timedOut ? `卡住：${r.cmd}` : `失败：${r.cmd}`)).join("\n"));
process.exit(bad ? 1 : 0);
