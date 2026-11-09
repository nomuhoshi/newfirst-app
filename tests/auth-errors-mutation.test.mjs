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
    ["auth-errors.js", "5xx 一律当成邮件额度（S3）", 'if (st >= 500 || /Error sending .* email/i.test(msgOf(r))) return "S4";', 'if (st >= 500 || /Error sending .* email/i.test(msgOf(r))) return "S3";'],
    ["auth-errors.js", "429 只认错误码、不认状态码", 'if (st === 429 || r.kind === "rate-limit" || code ===', 'if (code ==='],
    ["auth-errors.js", "429 带秒数也当 S3（不用真实数字）", 'if (serverWaitSec(r) > 0 || code === "over_request_rate_limit") return "S2";', 'if (code === "over_request_rate_limit") return "S2";'],
    ["auth-errors.js", "无资格邮箱不单独分类", 'if (S5_CODES.has(code) || /not authorized|Signups not allowed/i.test(msgOf(r))) return preview ? "S5t" : "S5";', ""],
    ["auth-errors.js", "S5 不认消息里的 not authorized", '/not authorized|Signups not allowed/i.test(msgOf(r))', '/(?!)/.test(msgOf(r))'],
    ["auth-errors.js", "测试入口不使用专用 S5t 文案", 'return preview ? "S5t" : "S5";', 'return "S5";'],
    ["auth-errors.js", "消息里的 Error sending 不归 S4", "|| /Error sending .* email/i.test(msgOf(r))", ""],
    ["auth-errors.js", "离线判断被去掉（断网全当 S1b）", 'return r.offline ? "S1a" : "S1b";', 'return "S1b";'],
    ["auth-errors.js", "超时不再标记“邮件可能已发出”", 'uncertainSent: id === "S1b" && r?.timedOut === true', "uncertainSent: false"],
    ["auth-errors.js", "S1a 也强制冷却", 'S1a: { text: () => "没连上网络，验证码没发出去。联网后再点「发送验证码」。", cooldown: 0', 'S1a: { text: () => "没连上网络，验证码没发出去。联网后再点「发送验证码」。", cooldown: 60000'],
    ["auth-errors.js", "S4 第 3 次起不拉长冷却", "(fails >= 3 ? 300000 : 30000)", "30000"],
    ["auth-errors.js", "S4 不计连续失败文案", '(c.fails >= 3 ? "先继续学习，晚点再登录也行。" : "")', '""'],
    ["auth-errors.js", "S3 冷却被改短", 'S3: { text: () => "登录邮件发得太多，暂时发不出验证码。请过一会儿再试，最久可能要等一小时。", cooldown: 300000', 'S3: { text: () => "登录邮件发得太多，暂时发不出验证码。请过一会儿再试，最久可能要等一小时。", cooldown: 1000'],
    ["auth-errors.js", "完全去掉 XP 提示", "const xpLine = (xp) => (Number.isFinite(xp) && xp > 0 ?", "const xpLine = (xp) => (false ?"],
    ["auth-errors.js", "XP 提示在 XP 为 0 时也显示", "Number.isFinite(xp) && xp > 0 ?", "Number.isFinite(xp) ?"],
    ["auth-errors.js", "XP 提示句子被改动", "还在这台设备上，没有受影响。", "已保存。"],
    ["auth-errors.js", "XP 不取整", "${Math.floor(xp)}", "${xp}"],
    ["auth-errors.js", "界面文字夹带服务器原文", "text: e.text({ n, fails }), diag", 'text: e.text({ n, fails }) + (r?.message || ""), diag'],
    ["auth-errors.js", "诊断行夹带服务器原文", 'return bits.length ? "诊断：" + bits.join(" · ") : "";', 'return bits.length ? "诊断：" + bits.join(" · ") + (r?.message || "") : "";'],
    ["auth-errors.js", "S1/S2/S3 也显示诊断行", 'S1a: { text: () => "没连上网络，验证码没发出去。联网后再点「发送验证码」。", cooldown: 0, diag: false', 'S1a: { text: () => "没连上网络，验证码没发出去。联网后再点「发送验证码」。", cooldown: 0, diag: true'],
    ["auth-errors.js", "S4 不显示诊断行", '"先继续学习，晚点再登录也行。" : ""), cooldown: 0, diag: true', '"先继续学习，晚点再登录也行。" : ""), cooldown: 0, diag: false'],
    ["auth-errors.js", "错误码不过滤", 'typeof s === "string" && /^[a-z0-9_]{3,40}$/.test(s) ? s : ""', 'typeof s === "string" ? s : ""'],
    ["auth-errors.js", "状态码不过滤", "Number.isInteger(n) && n >= 100 && n <= 599 ? n : 0", "n || 0"],
    ["auth-errors.js", "忽略服务器给的秒数", 'const m = /(\\d{1,5})\\s*seconds?/i.exec(msgOf(r));', 'const m = null;'],
    ["auth-errors.js", "忽略 Retry-After", "const h = Number(r?.retryAfterSec);", "const h = NaN;"],
    ["auth-errors.js", "冷却上限被拿掉", "Math.min(3600000, Math.max(10000, ms))", "Math.max(10000, ms)"],
    ["auth-errors.js", "冷却下限被拿掉", "Math.min(3600000, Math.max(10000, ms))", "Math.min(3600000, ms)"],
    ["auth-errors.js", "验证码错误不再单独分类（V1）", 'if (r.stage === "verify" && r.kind === "auth") return "V1";', ""],
    ["auth-errors.js", "验证后读云端被拒也说成验证码错", 'if (r.stage !== "verify" && r.kind === "auth") return "V5";', 'if (r.kind === "auth") return "V1";'],
    ["auth-errors.js", "验证 429 不单独分类（V2）", 'if (r.kind === "rate-limit" || http(r) === 429) return "V2";', ""],
    ["auth-errors.js", "验证断网 / 超时不归 V3", 'if (r.kind === "network") return "V3";', 'if (r.kind === "network") return "V4";'],
    ["auth-errors.js", "同步状态：英文原文直接显示", 'if (isOwnChinese(message)) return { text: message, diag: "" };', 'return { text: message, diag: "" };'],
    ["auth-errors.js", "同步状态：429 不单独分类", 'if (r.kind === "rate-limit" || http(r) === 429) return { text: SYNC_COPY.Y3b, diag: "" };', ""],
    ["auth-errors.js", "同步状态：5xx 不带诊断行", 'return { text: SYNC_COPY.Y3c, diag: diagLine(r) };', 'return { text: SYNC_COPY.Y3c, diag: "" };'],
    ["auth-errors.js", "isOwnChinese 放过全英文", 'typeof m === "string" && /[\u4e00-\u9fff]/.test(m) && !/[A-Za-z]{4,}/.test(stripCodes(m))', 'typeof m === "string"'],
    ["auth-errors.js", "括号代号过滤放宽成任意括号内容", '/（[A-Za-z0-9_.:-]{1,40}）/g', '/（[^）]*）/g'],
    ["account-ui.js", "errorText 直接显示 r.message", 'return safeMessage(r?.message, "出错了，请稍后再试。进度还在这台设备上。");', 'return r?.message || "出错了";'],
    ["account-ui.js", "状态栏 error 直接拼接原文", 'if (st === "error") { const e = syncErrorText(s.message, s.detail); return e.text + (e.diag ? e.diag : ""); }', 'if (st === "error") return "同步失败：" + s.message;'],
    ["account-ui.js", "冲突状态又变回死路文案", "这个账号在别处被覆盖过，同步已暂停。", "这个账号在别处被覆盖过，需要选择保留哪一份。"],
    ["cloud-api.js", "cloud-api 不再标出超时", "...(timedOut ? { timedOut: true } : !isOnline() ? { offline: true } : {})", "...(!isOnline() ? { offline: true } : {})"],
    ["cloud-api.js", "cloud-api 不再标出离线", ": !isOnline() ? { offline: true } : {})", ": {})"],
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
