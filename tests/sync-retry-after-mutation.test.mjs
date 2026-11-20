// 反向验证：把“普通同步遵守服务器 429 等待时间”的保护一处一处故意改坏，tests/sync-retry-after.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/sync-retry-after-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "sync-retry-after.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-retryafter-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：Retry-After 专项全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  // 已核实、故意不做变异的冗余防线：拿到锁后的 gen 检查（syncOnce 里 dead() 会立刻拦下，不发请求不写本机）、runPendingImport 返回后的 dead() 检查（写入函数每次 await 后已经检查，stale 结果会原样返回）。
  // 已核实、故意不单独做变异的冗余防线：唤醒里“只去掉会话代次检查”（bumpAcct 同时把 wakeToken 清空，令牌检查已经拦住旧会话的唤醒，两层只去一层不会变红）。
  const MUTS = [
    ["cloud-api.js", "cloud-api 不带出 Retry-After", "...(ra.valid ? { retryAfterSec: ra.sec } : {})", ""],
    ["cloud-api.js", "不认 HTTP 日期", "if (v.length <= 40) {\n    const t = parseHttpDate", "if (false) {\n    const t = parseHttpDate"],
    ["cloud-api.js", "非法值当成“0 秒”（只剩最短等待，没有保底 60 秒）", "return { present: true, valid: false };\n}", "return { present: true, valid: true, sec: 0 };\n}"],
    ["sync.js", "同步层忽略服务器的 Retry-After（回到固定 60 秒）", "const sec = r && r.retryAfterSec;", "const sec = undefined;"],
    ["sync.js", "把长等待截到 1 小时（缩短服务器要求的等待）", "Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000))", "Math.min(3_600_000, Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000)))"],
    ["sync.js", "合法但已过的值没有最短等待", "Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000))", "Math.ceil(sec * 1000)"],
    ["sync.js", "缺失 / 非法没有保底等待", ": COOLDOWN_MS;\n  };", ": 0;\n  };"],
    ["sync.js", "后到的 429 覆盖（缩短）尚未结束的等待", "cooldownUntil = Math.max(cooldownUntil, until);", "cooldownUntil = until;"],
    ["sync.js", "同步的 429 记在登录阶段的冷却上（退出 / 换账号不会作废）", "armCooldown(r, true); return r;", "armCooldown(r); return r;"],
    ["sync.js", "会话代次前进时不作废同步冷却", "function bumpAcct() { acctGen++; loggingOut = false; selfLogoutCleaning = false; syncCooldownUntil = 0;", "function bumpAcct() { acctGen++; loggingOut = false; selfLogoutCleaning = false;"],
    ["sync.js", "同步入口不检查冷却", "    if (inCooldown()) {\n      const limited = rateLimited();", "    if (false) {\n      const limited = rateLimited();"],
    ["sync.js", "旧任务读取返回后不核对代次（旧会话的 429 回来改写新会话的等待）", "const remote = await api.getProgress(session);\n      const afterGetLost = lostDuringSync();\n      if (afterGetLost) return afterGetLost;", "const remote = await api.getProgress(session);"],
    ["cloud-api.js", "不认 rfc850 日期", "if ((m = /^([A-Za-z]{6,9}), (\\d{2})", "if (false && (m = /^([A-Za-z]{6,9}), (\\d{2})"],
    ["cloud-api.js", "不认 asctime 日期", "} else if ((m = /^([A-Za-z]{3}) ([A-Za-z]{3}) ([ \\d]\\d)", "} else if (false && (m = /^([A-Za-z]{3}) ([A-Za-z]{3}) ([ \\d]\\d)"],
    ["cloud-api.js", "日期不往回读校验（2 月 30 日滚成 3 月）", "return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo && dt.getUTCDate() === d ? dt.getTime() : NaN;", "return dt.getTime();"],
    ["cloud-api.js", "rfc850 两位年份不做 50 年规则", "if (Number.isFinite(t) && t > nowMs + 50 * 365.2425 * 86400_000) y -= 100;", ""],
    ["sync.js", "冷却到期没有自动唤醒", "armWake(); } else cooldownUntil", "} else cooldownUntil"],
    ["sync.js", "唤醒不核对令牌（重复 429 延期后旧唤醒照样触发）", "if (wakeToken !== tok || g !== acctGen) return;", "if (g !== acctGen) return;"],
    ["sync.js", "唤醒既不核对令牌也不核对会话代次（旧会话的唤醒替新会话同步）", "if (wakeToken !== tok || g !== acctGen) return;", ""],
    ["sync.js", "唤醒提前到点也直接联网", "if (inCooldown()) { armWake(); return; }", ""],
    ["sync.js", "唤醒定时器不分段（超长等待溢出）", "Math.min(coolUntil() - now(), MAX_TIMER_MS)", "(coolUntil() - now())"],
    ["sync.js", "唤醒按只看同步冷却排期（较长的发码冷却下排得太早）", "Math.min(coolUntil() - now(), MAX_TIMER_MS)", "Math.min(syncCooldownUntil - now(), MAX_TIMER_MS)"],
    ["sync.js", "唤醒到点只看同步冷却（较长的发码冷却吞掉唤醒，之后没人再唤醒）", "if (inCooldown()) { armWake(); return; }", "if (now() < syncCooldownUntil) { armWake(); return; }"],
    ["sync.js", "游客导入收到 429 不进同步冷却（走网络短退避）", "          noteRateLimit(pr);\n", ""],
    ["sync.js", "导入写入失败丢掉服务器的等待时间", "kind = c.kind; raSec = c.retryAfterSec; break; }\n        if (c.rev === null) { latest", "kind = c.kind; break; }\n        if (c.rev === null) { latest"],
    ["sync.js", "导入读回失败丢掉服务器的等待时间", "rbRa = rb.retryAfterSec; }", "}"],
    ["sync.js", "登录选择里的导入 429 不进冷却", "if (result && result.kind === \"rate-limit\") noteRateLimit(result);", ""],
    ["sync.js", "发码入口不检查冷却", "    if (inCooldown()) return rateLimited();\n    const r = await", "    const r = await"],
  ];
  for (const [file, name, from, to] of MUTS) {
    reset();
    const p = join(SRC, file);
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    check(`变异“${name}”：Retry-After 专项变红（失败或挂住都算红，exit=${r.status}）`, r.status !== 0 && r.status !== null, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
