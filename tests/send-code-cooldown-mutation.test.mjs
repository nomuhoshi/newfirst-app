// 反向验证（G-LOGIN-06）：把发码冷却分类 / 截止时间 / 等待数值的关键逻辑一处一处故意改坏，专项测试 tests/send-code-cooldown.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。运行：node tests/send-code-cooldown-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "send-code-cooldown.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-sendcd-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 120000 });
  reset();
  const base = run();
  check("未改源码的对照：专项测试全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  const A = "auth-errors.js", S = "sync.js";
  const MUTS = [
    // 错误分类
    [A, "错误分类：未知 / 只有等待数字的 429 又归成 S2（“验证码刚发过”）", '    return "S8";\n  }', '    return "S2";\n  }'],
    [A, "错误分类：有等待头就当 S2（等待数字决定了原因）", 'if (r.localBlock === true) return "S9";', 'if (r.localBlock === true) return "S9"; if (r.retryAfterSec > 0 && code === EMAIL_LIMIT_CODE) return "S2";'],
    [A, "错误分类：邮件服务限流（email rate limit exceeded）被判成 S2", 'if (MAIL_QUOTA_RE.test(msgOf(r))) return "S3";', 'if (MAIL_QUOTA_RE.test(msgOf(r))) return "S2";'],
    [A, "错误分类：发送间隔提示不再识别（全落到中性类）", 'if (SEND_INTERVAL_RE.test(msgOf(r))) return "S2";', ""],
    [A, "错误分类：本地冷却拦截被当成新的服务器拒绝", 'if (r.localBlock === true) return "S9";', ""],
    [A, "错误分类：限流 429 不再识别（掉进其他 4xx）", 'if (st === 429 || r.kind === "rate-limit" || code === EMAIL_LIMIT_CODE ||', 'if (code === EMAIL_LIMIT_CODE ||'],
    // 截止时间丢失 / 后移
    [A, "截止时间丢失：界面拿不到 retryAt", "retryAt: limited && Number.isFinite(r?.retryAt) ? r.retryAt : null", "retryAt: null"],
    [S, "截止时间丢失：同步层不再返回 retryAt", "retryAt: coolUntil(), waitMs:", "waitMs:"],
    [S, "截止时间后移：本地拦截每次都按“现在 + 60 秒”重算", "retryAt: coolUntil(), waitMs: Math.max(0, coolUntil() - now()), localBlock", "retryAt: now() + 60000, waitMs: 60000, localBlock"],
    [S, "冷却期内反复点击仍发请求", "if (inCooldown()) return gate(rateLimited(), true);", "if (false) return gate(rateLimited(), true);"],
    [S, "本地拦截来源标记丢失（localBlock 不是 true）", "gate(rateLimited(), true)", "gate(rateLimited(), false)"],
    [A, "剩余等待丢失：界面不用同步层给的 waitMs（回到 60 秒默认）", "if (Number.isFinite(r?.waitMs) && r.waitMs >= 0) return Math.ceil(r.waitMs);", ""],
    // 重置 300 秒 / 1 小时截断 / 数值规则
    [A, "重置成 5 分钟：限流一律写死 300 秒", "limited ? wait : e.cooldown", "limited ? 300000 : e.cooldown"],
    [A, "一小时截断：合法的长等待被截成 3600 秒", "return Number.isFinite(sec) && sec >= 0 ? Math.max(5000, Math.ceil(sec * 1000)) : 60000;", "return Number.isFinite(sec) && sec >= 0 ? Math.min(3600000, Math.max(5000, Math.ceil(sec * 1000))) : 60000;"],
    [A, "忽略等待头（一律 60 秒）", "return Number.isFinite(sec) && sec >= 0 ? Math.max(5000, Math.ceil(sec * 1000)) : 60000;", "return 60000;"],
    [A, "零值不抬到最短 5 秒", "Math.max(5000, Math.ceil(sec * 1000))", "Math.ceil(sec * 1000)"],
    [A, "缺失 / 非法等待不再用 60 秒默认", "Math.ceil(sec * 1000)) : 60000;", "Math.ceil(sec * 1000)) : 5000;"],
    [A, "发码限流又标成只针对某个邮箱", 'scope: id === "V2" ? "email" : ""', 'scope: id === "S2" || id === "V2" || id === "S8" ? "email" : ""'],
    [S, "同步层：合法的长等待被截成一小时", "Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000))", "Math.min(3600000, Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000)))"],
    [S, "同步层：零值不抬到最短 5 秒", "Math.max(COOLDOWN_MIN_MS, Math.ceil(sec * 1000))", "Math.ceil(sec * 1000)"],
    [S, "同步层：缺失 / 非法等待不再用 60 秒默认", ": COOLDOWN_MS;\n  };\n  const armCooldown", ": 300000;\n  };\n  const armCooldown"],
    // 误报“验证码已发”
    [A, "误报“验证码已发”：中性请求限流写成“刚刚已经发过验证码”", "`请求太频繁了，暂时发不出验证码。请等 ${fmtSendWait(c.n)}再试。`", "`刚刚已经发过验证码，请等 ${fmtSendWait(c.n)}再试。`"],
    [A, "误报“验证码已发”：S2 又保证旧验证码还能用", "之前收到的验证码不一定还有效，先看看邮箱（含垃圾邮件）。", "验证码还能用，先看看邮箱（含垃圾邮件）。"],
    [A, "误报：本地拦截提示写成邮件服务拒绝", "`还在等待中，请等 ${fmtSendWait(c.n)}再点「发送验证码」。`", "`邮件服务又拒绝了，请等 ${fmtSendWait(c.n)}再点「发送验证码」。`"],
    [A, "误报：中性类推断“邮件额度用完”", "`请求太频繁了，暂时发不出验证码。", "`邮件额度用完了，暂时发不出验证码。"],
  ];
  for (const [file, name, from, to] of MUTS) {
    reset();
    const p = join(SRC, file);
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    check(`变异“${name}”：专项测试变红`, r.status === 1, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
