// mobile / e2e 外层运行器共用的“逐脚本”执行器（tests/webkit/run.mjs、tests/e2e/run.mjs 在用）。
// 之前这两个运行器用 spawnSync 顺序跑脚本：没有时间上限（一个脚本卡住整个 CI job 就挂到平台超时）、没有逐脚本汇总。
// 现在每个脚本：
//   1. 有独立时间上限（默认 900 秒；环境变量 TEST_STEP_TIMEOUT 秒数可调，与 scripts/run-tests.mjs 同名）；
//      超时就杀掉这个脚本的整个进程组（含它派生的浏览器、子服务器），记为“超时”（退出码 124），然后照旧继续跑后面的脚本；
//   2. 结束后（无论成败）都清理一次它的进程组，不留残余进程；
//   3. 记一行：脚本、引擎、退出码、耗时、分类（通过 / 失败 / 超时 / 环境失败）。分类沿用旧约定：退出码 2 = 环境失败；
//      脚本启动不了（spawn 报错）或被外部信号杀掉也算环境失败（2）；其余非 0 = 失败。
// 不改：脚本列表、引擎参数、执行顺序、环境变量、各脚本自己的断言。任何一个不是“通过”，最终退出码就非 0（取各行退出码的最大值）。
import { spawn } from "node:child_process";
import { basename } from "node:path";

export const DEFAULT_TIMEOUT_SEC = 900;
export const KIND_TEXT = { pass: "通过", fail: "失败", timeout: "超时", env: "环境失败" };
const ICON = { pass: "✅", fail: "❌", timeout: "⏱", env: "⚠️" };

export function timeoutMs(env = process.env) {
  const n = Number(env.TEST_STEP_TIMEOUT);
  return (Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_SEC) * 1000;
}
function killGroup(child, sig) { try { process.kill(-child.pid, sig); } catch { try { child.kill(sig); } catch { /* 已经退出 */ } } }

const active = new Set();
let hooked = false;
function hookParentSignals() { // 父进程被 Ctrl-C / SIGTERM 时，不把已经自成进程组的子脚本留在后台
  if (hooked) return; hooked = true;
  for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { for (const c of active) killGroup(c, "SIGKILL"); process.exit(128 + (sig === "SIGINT" ? 2 : 15)); });
}

// item: { file, engine, env?, label? }；opts: { limitMs, execPath, quiet }。返回一行结果，从不抛错。
export async function runScript(item, opts = {}) {
  hookParentSignals();
  const limit = opts.limitMs ?? timeoutMs();
  const label = item.label || basename(item.file);
  const t0 = Date.now();
  return await new Promise((done) => {
    let settled = false, timedOut = false, killTimer = null;
    const finish = (row) => { if (settled) return; settled = true; clearTimeout(timer); clearTimeout(killTimer); done({ label, engine: item.engine ?? "", secs: Math.round((Date.now() - t0) / 100) / 10, ...row }); };
    let child;
    try { child = spawn(opts.execPath || process.execPath, [item.file], { stdio: "inherit", detached: true, env: { ...process.env, ...(item.env || {}) } }); }
    catch (e) { console.error(`无法启动 ${label}：${e}`); return finish({ code: 2, kind: "env", note: String(e.code || e.message) }); }
    active.add(child);
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`\n⏱ 超时（${limit / 1000} 秒）：${label}${item.engine ? `（${item.engine}）` : ""}\n  正在结束它的整个进程组……`);
      killGroup(child, "SIGTERM"); killTimer = setTimeout(() => killGroup(child, "SIGKILL"), 5000);
    }, limit);
    child.on("error", (e) => { active.delete(child); console.error(`无法启动 ${label}：${e}`); finish({ code: 2, kind: "env", note: String(e.code || e.message) }); });
    child.on("exit", (code, sig) => {
      active.delete(child); killGroup(child, "SIGKILL"); // 无论成败，清掉它留下的浏览器 / 子服务器
      if (timedOut) return finish({ code: 124, kind: "timeout" });
      if (code === 0) return finish({ code: 0, kind: "pass" });
      if (code === null) return finish({ code: 2, kind: "env", note: `被信号 ${sig} 终止` });
      return finish({ code, kind: code === 2 ? "env" : "fail" });
    });
  });
}

export function summaryLines(rows) {
  const out = ["", "── 逐脚本汇总 ──"];
  for (const r of rows) out.push(`${ICON[r.kind]} ${KIND_TEXT[r.kind].padEnd(4, "　")} rc=${String(r.code).padEnd(3)} ${String(r.secs).padStart(6)}s  ${r.engine ? `[${r.engine}] ` : ""}${r.label}${r.note ? `  （${r.note}）` : ""}`);
  const n = (k) => rows.filter((r) => r.kind === k).length;
  out.push(`共 ${rows.length} 个脚本：通过 ${n("pass")}，失败 ${n("fail")}，超时 ${n("timeout")}，环境失败 ${n("env")}`);
  return out;
}
export const exitCodeOf = (rows) => rows.reduce((m, r) => Math.max(m, r.code), 0);

// 按引擎依次跑；每个引擎先跑 scriptsFor(engine) 给出的脚本（顺序不变，失败不提前停——和旧运行器一致）。
// TEST_RUNNER_SCRIPTS（JSON 数组，文件路径）仅供自检：用它替换脚本列表，不碰真实浏览器。
export async function runEngines(engines, scriptsFor, opts = {}) {
  const limitMs = opts.limitMs ?? timeoutMs();
  const override = process.env.TEST_RUNNER_SCRIPTS ? JSON.parse(process.env.TEST_RUNNER_SCRIPTS) : null;
  const rows = [];
  for (const b of engines) {
    const items = override ? override.map((file) => ({ file, engine: b, env: { MOBILE_BROWSER: b, JUDGE_BROWSERS: b } })) : scriptsFor(b);
    const mine = [];
    for (const it of items) { const r = await runScript({ ...it, engine: b }, { limitMs, execPath: opts.execPath }); rows.push(r); mine.push(r); }
    const worst = mine.some((r) => r.kind === "timeout") ? "超时" : mine.some((r) => r.kind === "env") ? "环境失败" : mine.some((r) => r.kind === "fail") ? "失败" : "通过";
    console.log(`== ${b}: ${worst}`);
  }
  for (const l of summaryLines(rows)) console.log(l);
  return { rows, code: exitCodeOf(rows) };
}
