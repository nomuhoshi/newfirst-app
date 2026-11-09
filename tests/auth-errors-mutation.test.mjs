// 反向验证（AUTH-MAIL-01）：把登录错误处理的关键逻辑一处一处故意改坏，专项测试 tests/auth-errors.test.mjs 必须变红。
// 做法：复制 src/ 和专项测试到临时目录，每次只改一处，跑同一个测试；不改工作区文件。
// 运行：node tests/auth-errors-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const TEST = join("tests", "auth-errors.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };
const W = mkdtempSync(join(tmpdir(), "sp-autherr-mut-"));
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

  const MUTS = [
    ["auth-errors.js", "5xx 一律当成邮件额度用完", 'if (st >= 500) return "server";', 'if (st >= 500) return "rateEmail";'],
    ["auth-errors.js", "429 只认错误码、不认状态码", 'if (st === 429 || r.kind === "rate-limit") return "rateOther";', 'if (false) return "rateOther";'],
    ["auth-errors.js", "无资格邮箱不单独分类", 'if (code === "email_address_not_authorized") return "notAuthorized";', ""],
    ["auth-errors.js", "注册关闭不单独分类", 'if (code === "otp_disabled" || code === "signup_disabled") return "noSignup";', ""],
    ["auth-errors.js", "超时和断网不区分（超时也当断网）", 'return r.timedOut ? "timeout" : "offline";\n  const st', 'return "offline";\n  const st'],
    ["auth-errors.js", "超时不再标记“邮件可能已发出”", "cooldown: 60000, uncertainSent: true", "cooldown: 60000, uncertainSent: false"],
    ["auth-errors.js", "断网也强制冷却", 'text: "现在没有网络，验证码没有发出去。连上网络后再试。", cooldown: 0', 'text: "现在没有网络，验证码没有发出去。连上网络后再试。", cooldown: 60000'],
    ["auth-errors.js", "完全去掉 XP 提示", "const xpLine = (xp) => (Number.isFinite(xp) && xp > 0 ?", "const xpLine = (xp) => (false ?"],
    ["auth-errors.js", "XP 提示在 XP 为 0 时也显示", "Number.isFinite(xp) && xp > 0 ?", "Number.isFinite(xp) ?"],
    ["auth-errors.js", "XP 提示句子被改动", "还在这台设备上，没有受影响。", "已保存。"],
    ["auth-errors.js", "XP 不取整", "${Math.floor(xp)}", "${xp}"],
    ["auth-errors.js", "界面文字夹带服务器原文", "text: e.text, diag", "text: e.text + (r?.message || \"\"), diag"],
    ["auth-errors.js", "诊断行夹带服务器原文", 'bits.length ? "诊断：" + bits.join(" · ") : ""', 'bits.length ? "诊断：" + bits.join(" · ") + " " + (r?.message || "") : ""'],
    ["auth-errors.js", "错误码不过滤", 'typeof s === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(s) ? s : ""', 'typeof s === "string" ? s : ""'],
    ["auth-errors.js", "状态码不过滤", "Number.isInteger(n) && n >= 100 && n <= 599 ? n : 0", "n || 0"],
    ["auth-errors.js", "忽略服务器给的秒数", "const m = /after (\\d{1,5}) seconds?/i.exec(String(r?.message || \"\"));", "const m = null;"],
    ["auth-errors.js", "忽略 Retry-After", "const fromHeader = Number(r?.retryAfterSec);", "const fromHeader = NaN;"],
    ["auth-errors.js", "冷却上限被拿掉", "Math.min(3600000, Math.max(10000, ms))", "Math.max(10000, ms)"],
    ["auth-errors.js", "冷却下限被拿掉", "Math.min(3600000, Math.max(10000, ms))", "Math.min(3600000, ms)"],
    ["auth-errors.js", "5xx 不冷却", 'text: "服务器这边出了问题，验证码没有发出去，不是你的操作有误。过一会儿再试；多次都不行请联系开发者。", cooldown: 30000', 'text: "服务器这边出了问题，验证码没有发出去，不是你的操作有误。过一会儿再试；多次都不行请联系开发者。", cooldown: 0'],
    ["auth-errors.js", "不确定的错误码被写成具体原因", '原因暂时不明。稍后再试一次；还不行请联系开发者。", cooldown: 30000', '额度用完了，请稍后再试。", cooldown: 30000'],
    ["auth-errors.js", "验证码错误不再单独分类", 'if (r.stage === "verify" && r.kind === "auth") return "wrongCode";', ""],
    ["auth-errors.js", "验证码后读云端被拒也说成验证码错", 'if (r.stage !== "verify" && r.kind === "auth") return "cloudRead";', 'if (r.kind === "auth") return "wrongCode";'],
    ["cloud-api.js", "cloud-api 不再标出超时", "...(timedOut ? { timedOut: true } : {})", ""],
    ["cloud-api.js", "cloud-api 不读 Retry-After", 'resp.headers.get("retry-after")', '"0"'],
    ["cloud-api.js", "验证码这一步不再打 stage 标记", ", stage: \"verify\" }; //", " }; //"],
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
