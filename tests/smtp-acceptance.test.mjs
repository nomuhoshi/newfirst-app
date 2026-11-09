// scripts/smtp-acceptance.mjs 的自测（AUTH-MAIL-01 任务三）：本机假 Supabase 服务器，不连任何真实项目、不发任何真实邮件。
// 运行：node tests/smtp-acceptance.test.mjs
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = fileURLToPath(new URL("../scripts/smtp-acceptance.mjs", import.meta.url));
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const KEY = "sb_publishable_TESTKEY_abcdefghijklmnopqrstuvwxyz0123456789";
let mode = {}, otpHits = [];
const srv = createServer((req, res) => {
  let body = ""; req.on("data", (c) => (body += c));
  req.on("end", () => {
    const send = (st, o) => { res.writeHead(st, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
    if (req.url === "/auth/v1/settings") return send(200, { external: { email: mode.noEmail ? false : true }, disable_signup: mode.openSignup ? false : true, mailer_autoconfirm: !!mode.autoconfirm });
    if (req.url === "/auth/v1/otp") { otpHits.push({ body: JSON.parse(body || "{}"), auth: req.headers.authorization }); const o = mode.otp || [200, {}]; return send(o[0], o[1]); }
    send(404, {});
  });
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const URL_LOCAL = `http://127.0.0.1:${srv.address().port}`;
const T = mkdtempSync(join(tmpdir(), "sp-smtp-acc-"));
const run = (args = [], env = {}, tmp = T) => new Promise((resolve) => {
  const p = spawn(process.execPath, [SCRIPT, ...args], { env: { PATH: process.env.PATH, TMPDIR: tmp, SUIPIAN_TEST_URL: URL_LOCAL, SUIPIAN_TEST_ANON_KEY: KEY, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  let o = ""; p.stdout.on("data", (c) => (o += c)); p.stderr.on("data", (c) => (o += c));
  p.on("close", (code) => resolve({ code, o }));
});
const nokey = (o) => !o.includes(KEY) && !/Bearer/i.test(o);

try {
  let r = await run([], { SUIPIAN_TEST_URL: "", SUIPIAN_TEST_ANON_KEY: "" });
  check("缺少网址 / 密钥：退出码 2", r.code === 2 && /缺少/.test(r.o), r.o);
  r = await run(["--allow-local"], { SUIPIAN_TEST_URL: "https://aqlcunkmggzzvyavlkjg.supabase.co" });
  check("正式项目网址：拒绝（退出码 2）", r.code === 2 && /正式项目/.test(r.o), r.o);
  r = await run(["--allow-local"], { SUIPIAN_TEST_URL: "https://AQLCUNKMGGZZVYAVLKJG.Supabase.co/" });
  check("正式项目网址换大小写 / 加斜杠也拒绝", r.code === 2 && /正式项目/.test(r.o));
  r = await run(["--allow-local", "--send", "--email=a@b.co", "--yes-send-one-mail"], { SUIPIAN_TEST_URL: "https://aqlcunkmggzzvyavlkjg.supabase.co" });
  check("正式项目 + 要求发信：同样拒绝，且一封都没发", r.code === 2 && otpHits.length === 0);
  r = await run([], { SUIPIAN_TEST_URL: "https://evil.example.com" });
  check("不是 *.supabase.co 的网址：拒绝", r.code === 2 && /不是 https/.test(r.o));
  r = await run([], { SUIPIAN_TEST_URL: URL_LOCAL });
  check("本机地址没带 --allow-local：拒绝", r.code === 2);
  r = await run(["--allow-local"], { SUIPIAN_TEST_ANON_KEY: "sb_secret_abcdefghijklmnop" });
  check("secret 密钥：拒绝，且不回显密钥", r.code === 2 && /secret/.test(r.o) && !r.o.includes("sb_secret_abcdefghijklmnop"));
  const sr = "eyJhbGciOiJIUzI1NiJ9." + Buffer.from(JSON.stringify({ role: "service_role" })).toString("base64url") + ".sig";
  r = await run(["--allow-local"], { SUIPIAN_TEST_ANON_KEY: sr });
  check("service_role 的 JWT 密钥：拒绝，且不回显", r.code === 2 && !r.o.includes(sr));

  mode = {}; otpHits = [];
  r = await run(["--allow-local"]);
  check("预检全部通过：退出码 0", r.code === 0 && /4\/4 项通过/.test(r.o), r.o);
  check("预检阶段没有发任何邮件", otpHits.length === 0);
  check("输出里只有被截断的密钥前缀，没有完整密钥 / Bearer", nokey(r.o) && r.o.includes(KEY.slice(0, 16) + "…"), r.o);
  mode = { openSignup: true }; r = await run(["--allow-local"]);
  check("公开注册没关：预检失败（退出码 1）", r.code === 1 && /公开注册已关闭/.test(r.o) && /❌/.test(r.o));
  mode = { autoconfirm: true }; r = await run(["--allow-local"]);
  check("开了免邮件确认：预检失败", r.code === 1);
  mode = { noEmail: true }; r = await run(["--allow-local"]);
  check("邮箱登录没开：预检失败", r.code === 1);

  mode = {}; otpHits = [];
  r = await run(["--allow-local", "--send", "--email=a@b.co"]);
  check("--send 没带 --yes-send-one-mail：拒绝，没发", r.code === 2 && otpHits.length === 0);
  r = await run(["--allow-local", "--send", "--yes-send-one-mail", "--email=not-an-email"]);
  check("邮箱格式不对：拒绝，没发", r.code === 2 && otpHits.length === 0);

  const T2 = mkdtempSync(join(tmpdir(), "sp-smtp-acc2-"));
  r = await run(["--allow-local", "--send", "--email=owner@example.com", "--yes-send-one-mail"], {}, T2);
  check("授权后发 1 封：退出码 0，服务器只收到 1 次 otp", r.code === 0 && otpHits.length === 1, r.o);
  check("发信用 create_user:false（验收不创建用户）且带的是公开密钥", otpHits[0]?.body.create_user === false && otpHits[0]?.body.email === "owner@example.com" && otpHits[0]?.auth === "Bearer " + KEY);
  check("成功后列出需要人确认的三件事（收信、登录、50 XP 合并）", /收到了验证码邮件/.test(r.o) && /能登录/.test(r.o) && /XP/.test(r.o) && nokey(r.o));
  r = await run(["--allow-local", "--send", "--email=owner@example.com", "--yes-send-one-mail"], {}, T2);
  check("1 小时内第二次发送：拒绝，服务器没有收到第 2 次", r.code === 2 && /不要重复发送/.test(r.o) && otpHits.length === 1);
  r = await run(["--allow-local", "--send", "--email=owner@example.com", "--yes-send-one-mail", "--force"], {}, T2);
  check("--force 才能绕过（排障用）", r.code === 0 && otpHits.length === 2);

  const failCase = async (otp, re, name) => {
    const T3 = mkdtempSync(join(tmpdir(), "sp-smtp-acc3-")); mode = { otp }; otpHits = [];
    const x = await run(["--allow-local", "--send", "--email=owner@example.com", "--yes-send-one-mail"], {}, T3);
    check(name, x.code === 1 && re.test(x.o) && !/CANARY/.test(x.o) && nokey(x.o), x.o); rmSync(T3, { recursive: true, force: true });
  };
  await failCase([500, { error_code: "unexpected_failure", msg: "CANARY Error sending magic link email" }], /S4.*500 · unexpected_failure/, "发信 500：退出码 1，分类为 S4，诊断行带状态码和错误码，不显示服务器原文");
  await failCase([429, { error_code: "over_email_send_rate_limit", msg: "CANARY after 40 seconds" }], /S2/, "发信 429（服务器给了 40 秒）：分类为 S2");
  await failCase([400, { error_code: "email_address_not_authorized", msg: "CANARY" }], /S5/, "发信 400 无资格：分类为 S5");
  await failCase([422, { error_code: "otp_disabled", msg: "CANARY" }], /S5/, "发信 422 otp_disabled（用户不存在）：分类为 S5");

  const src = readFileSync(SCRIPT, "utf8");
  const envNames = [...src.matchAll(/process\.env\.([A-Z_]+)/g)].map((m) => m[1]);
  check("脚本只读两个环境变量（公开网址、公开密钥），不读任何 SMTP 密码 / API key", envNames.every((n) => ["SUIPIAN_TEST_URL", "SUIPIAN_TEST_ANON_KEY"].includes(n)), envNames.join(","));
  check("脚本源码里没有疑似密钥（re_ / sb_secret_ / 长 JWT 字面量）", !/re_[A-Za-z0-9]{16,}|sb_secret_[A-Za-z0-9]{8,}|eyJ[A-Za-z0-9_-]{30,}/.test(src));
} finally { srv.close(); srv.closeAllConnections?.(); rmSync(T, { recursive: true, force: true }); }
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
