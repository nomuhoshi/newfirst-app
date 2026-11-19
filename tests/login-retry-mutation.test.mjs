// 反向验证：把“已验证会话 + 重试读取”的关键逻辑一处一处故意改坏，tests/login-fault-matrix.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/login-retry-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const TEST = join("tests", "login-fault-matrix.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-loginretry-mut-"));
const SRC = join(W, "src");
try {
  mkdirSync(join(W, "tests"), { recursive: true });
  cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));
  const reset = () => { rmSync(SRC, { recursive: true, force: true }); cpSync(join(ROOT, "src"), SRC, { recursive: true }); };
  const run = () => spawnSync(process.execPath, [join(W, TEST)], { cwd: W, encoding: "utf8", timeout: 180000 });
  reset();
  const base = run();
  check("未改源码的对照：故障矩阵全绿", base.status === 0, (base.stdout + base.stderr).split("\n").slice(-3).join(" | "));

  const MUTS = [
    ["同邮箱同码再调 verify 时仍重新验证（会撞上已用掉的码）", "if (verified && verified.email === mail && verified.code === c && now() < verified.expiresAt) return retryRead(baseState);", ""],
    ["到期不作废（retryRead 里）", "if (now() >= v.expiresAt) { verified = null; return {", "if (false) { verified = null; return {"],
    ["到期不作废（读失败后判断里）", "const expired = now() >= v.expiresAt;", "const expired = false;"],
    ["留存时间不受令牌有效期限制", "(Number(r.session.expiresAt) || Infinity) - 60_000", "Infinity"],
    ["读云端期间被作废，迟到的结果不丢弃", "if (isCurrent && !isCurrent()) return discarded();", ""],
    ["验证请求在途时被作废，迟到的结果不丢弃", "if (gen !== verifyGen) return discarded();", ""],
    ["重发验证码不作废已验证会话", "dropVerified(); // 重发验证码", "// 重发验证码"],
    ["连点重试不共用同一次读取", "if (v.inflight) return v.inflight;", ""],
    ["403 也允许重试到 5 次", "const tries = authClass ? READ_TRIES_AUTH : READ_TRIES_OTHER;", "const tries = READ_TRIES_OTHER;"],
    ["重试成功后不清掉已验证会话", "if (out.ok) { if (verified === v) verified = null; return out; }", "if (out.ok) { return out; }"],
    ["数据类失败仍留着已验证会话", "if (verified === v) verified = null; // 数据", "// 数据"],
    ["读取返回后不再复查到期（成功响应在到期后仍能登录）", "isCurrent: () => stillOurs() && now() < v.expiresAt", "isCurrent: () => stillOurs()"],
    ["到期被丢弃时不转成“已失效”结果", "if (stillOurs()) { verified = null; return expiredResult(); } return out;", "return out;"],
    ["退出不作废待读取会话", "dropVerified(); // 退出（含强制本机退出", "// 退出（含强制本机退出"],
    ["重试读取又调用验证接口（退回旧行为）", "const out = await begin(v.session, baseState ?? v.baseState,", "const vr = await api.verifyCode(v.email, v.code); const out = await begin(vr.session || v.session, baseState ?? v.baseState,"],
    ["验证后读取失败不留已验证会话", "return noteReadFailure(v, out);\n  }\n  // 读失败之后", "return out;\n  }\n  // 读失败之后"],
  ];
  for (const [name, from, to] of MUTS) {
    reset();
    const p = join(SRC, "sync.js");
    const text = readFileSync(p, "utf8");
    if (!text.includes(from)) { check(`变异“${name}”：要改的源码片段存在`, false, "片段没找到：" + from.slice(0, 60)); continue; }
    writeFileSync(p, text.replace(from, to));
    const r = run();
    check(`变异“${name}”：故障矩阵变红`, r.status === 1, `exit=${r.status}`);
  }
} finally { rmSync(W, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
