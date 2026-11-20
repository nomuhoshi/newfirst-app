// 反向验证：把“登录重试读取遵守 429 等待”的保护一处一处故意改坏，tests/retry-read-cooldown.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/retry-read-cooldown-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "retry-read-cooldown.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-retryread-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：重试读取等待专项全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  // 已核实、故意不单独做变异的冗余防线：noteReadFailure 里等待取“较大值”而不是直接覆盖（只有等待还没结束时才会有新的 429，而那时读取被挡住，根本到不了这里，两种写法等价）。
  const GATE = "if (v.waitUntil && now() < v.waitUntil) return {";
  const MUTS = [
    ["sync.js", "重试读取不看等待（等待期间照样发请求）", GATE, "if (false) return {"],
    ["sync.js", "等待提前 1 秒放行（差一秒就打回去）", GATE, "if (v.waitUntil && now() < v.waitUntil - 1000) return {"],
    ["sync.js", "被挡住的点击也算一次读取（消耗次数）", "stage: \"read\", canRetry: true, retryable: false, retryAt: v.waitUntil, waitMs: v.waitUntil - now()", "stage: \"read\", canRetry: true, retryable: false, retryAt: (v.reads++, v.waitUntil), waitMs: v.waitUntil - now()"],
    ["sync.js", "读取被 429 时不记录等待", "v.waitUntil = Math.max(v.waitUntil || 0, now() + cooldownMsFrom(r));", ""],
    ["sync.js", "等待不看服务器的 Retry-After（固定 60 秒）", "now() + cooldownMsFrom(r));\n      return { ...r, canRetry: true, retryAt", "now() + 60_000);\n      return { ...r, canRetry: true, retryAt"],
    ["sync.js", "等待把已验证会话的到期时间往后推（续命）", "v.waitUntil = Math.max(v.waitUntil || 0, now() + cooldownMsFrom(r));", "v.waitUntil = Math.max(v.waitUntil || 0, now() + cooldownMsFrom(r)); v.expiresAt = Math.max(v.expiresAt, v.waitUntil);"],
    ["sync.js", "不报回剩余等待（界面拿不到倒计时）", "waitMs: Math.max(0, v.waitUntil - now()) };", "};"],
    ["sync.js", "同一个码再 verify 绕过等待（重新走验证接口）", "if (verified && verified.email === mail && verified.code === c && now() < verified.expiresAt) return retryRead(baseState);", ""],
    ["sync.js", "到期检查去掉（跨过到期时还显示等待）", "if (now() >= v.expiresAt) { verified = null; return { ok: false, kind: \"auth\", stage: \"read\", canRetry: false, expired: true", "if (false) { verified = null; return { ok: false, kind: \"auth\", stage: \"read\", canRetry: false, expired: true"],
    ["sync.js", "关窗 / 改邮箱 / 重发 / 退出不作废已验证会话（等待带到下一轮）", "function dropVerified() { verifyGen++; verified = null; }", "function dropVerified() { verifyGen++; }"],
    ["sync.js", "在途读取被作废后，迟到的 429 仍会把旧会话“复活”", "if (isCurrent && !isCurrent()) return discarded(); // 读云端期间", "if (false) return discarded(); // 读云端期间"],
  ];
  for (const [file, name, from, to] of MUTS) {
    reset();
    const p = join(SRC, file);
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    const fails = (r.stdout.match(/^❌/gm) || []).length;
    check(`变异“${name}”：重试读取等待专项变红（失败或挂住都算红，exit=${r.status}，红 ${fails} 项）`, r.status !== 0 && r.status !== null, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
