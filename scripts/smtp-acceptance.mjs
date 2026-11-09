#!/usr/bin/env node
// 测试项目发信链路的自动验收（AUTH-MAIL-01 任务三）。只对 suipian-test 这类“测试项目”用，永远拒绝正式项目。
//
// 阶段 1（默认，不发邮件）：读 /auth/v1/settings，检查测试项目的登录设置是否符合预期
//   - 邮箱登录已开启；公开注册已关闭；没有开启“免确认直接登录”。
// 阶段 2（必须同时给 --send --email=<已开通的测试邮箱> --yes-send-one-mail）：只发 1 封验证码，
//   - 用 create_user:false，所以不会创建任何用户；用和 App 相同的分类代码给出结论。
//   - 同一台机器 1 小时内第二次发送会被拒绝（--force 才能绕过，仅给开发者排障）。
//   - 收件箱里有没有信、能不能登录，脚本看不到，需要人确认（脚本结尾会列出）。
//
// 安全：密钥只从环境变量 SUIPIAN_TEST_ANON_KEY 读（公开的 sb_publishable_… 键），不接受 service_role / secret 键，
//       输出里只显示前 16 个字符；脚本不会读、不会要、也不会打印任何 SMTP 密码或 Resend API key。
// 用法：
//   SUIPIAN_TEST_URL=https://<ref>.supabase.co SUIPIAN_TEST_ANON_KEY=sb_publishable_... node scripts/smtp-acceptance.mjs
//   ... node scripts/smtp-acceptance.mjs --send --email=you@example.com --yes-send-one-mail
// 退出码：0 全部通过；1 有检查没通过；2 参数 / 安全拦截。
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describeSendError } from "../src/auth-errors.js";

const PROD_REF = "aqlcunkmggzzvyavlkjg";
const args = process.argv.slice(2);
const flag = (n) => args.includes("--" + n);
const opt = (n) => { const a = args.find((x) => x.startsWith("--" + n + "=")); return a ? a.slice(n.length + 3) : ""; };
const out = (s) => console.log(s);
const mask = (k) => String(k).slice(0, 16) + "…";
const die = (msg, code = 2) => { console.error("✖ " + msg); process.exit(code); };

const URL_IN = (process.env.SUIPIAN_TEST_URL || opt("url") || "").trim();
const KEY = (process.env.SUIPIAN_TEST_ANON_KEY || "").trim();
if (!URL_IN || !KEY) die("缺少 SUIPIAN_TEST_URL 或 SUIPIAN_TEST_ANON_KEY（只需要公开的项目网址和 sb_publishable_ 开头的公开密钥）。");
let u;
try { u = new URL(URL_IN); } catch { die("项目网址解析不了：" + URL_IN.slice(0, 60)); }
const host = u.hostname.toLowerCase();
const local = flag("allow-local") && (host === "localhost" || host === "127.0.0.1");
if (host.includes(PROD_REF)) die("拒绝：这是正式项目的网址。本脚本只允许对测试项目运行。");
if (!local && !(u.protocol === "https:" && /^[a-z0-9]{10,30}\.supabase\.co$/.test(host))) die("拒绝：网址不是 https://<ref>.supabase.co 形式的 Supabase 项目。");
if (/^sb_secret_|service_role/i.test(KEY) || (KEY.split(".").length === 3 && /service_role/.test(Buffer.from(KEY.split(".")[1] || "", "base64url").toString("utf8")))) die("拒绝：这看起来是 secret / service_role 密钥。只能用公开的 publishable（anon）密钥。");
if (!/^sb_publishable_|^eyJ/.test(KEY)) die("密钥格式不认识：应是 sb_publishable_ 开头的公开密钥。");
const base = u.origin;

const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); out(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

out(`目标项目：${host}（${local ? "本机假服务器" : "测试项目"}）  密钥：${mask(KEY)}`);

// ---------- 阶段 1：只读预检 ----------
let settings = null;
try {
  const r = await fetch(base + "/auth/v1/settings", { headers: { apikey: KEY } });
  if (!r.ok) check("读取登录设置", false, `HTTP ${r.status}`);
  else { settings = await r.json(); check("读取登录设置", true); }
} catch (e) { check("读取登录设置", false, "网络不通（" + (e?.name || "error") + "）"); }
if (settings) {
  check("邮箱登录已开启", settings.external?.email === true);
  check("公开注册已关闭（disable_signup=true）", settings.disable_signup === true, settings.disable_signup === true ? "" : "测试项目必须关闭公开注册");
  check("没有开启“免邮件确认”（mailer_autoconfirm=false）", settings.mailer_autoconfirm !== true, settings.mailer_autoconfirm === true ? "开着的话任何人填邮箱就直接登录" : "");
}

// ---------- 阶段 2：发 1 封 ----------
let sent = null;
if (flag("send")) {
  const email = opt("email").trim();
  if (!flag("yes-send-one-mail")) die("要发邮件必须同时带 --yes-send-one-mail。");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) die("--email 需要一个有效邮箱地址（必须是测试项目里已开通的用户）。");
  const marker = join(tmpdir(), "suipian-smtp-acceptance", host.replace(/[^a-z0-9.]/g, "_") + ".sent");
  if (existsSync(marker) && Date.now() - Number(readFileSync(marker, "utf8")) < 3600000 && !flag("force")) die("拒绝：1 小时内已经发过一封。先去邮箱查（含垃圾邮件），不要重复发送；确实要重发再加 --force。");
  mkdirSync(join(tmpdir(), "suipian-smtp-acceptance"), { recursive: true });
  writeFileSync(marker, String(Date.now())); // 先写标记再发：即使超时也不会在 1 小时内被脚本自己重发
  // create_user:false —— 验收不创建任何用户。
  const r = await (async () => {
    const x = await fetch(base + "/auth/v1/otp", { method: "POST", headers: { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" }, body: JSON.stringify({ email, create_user: false }) }).catch(() => null);
    if (!x) return { ok: false, kind: "network", message: "x" };
    if (x.ok) return { ok: true };
    let d = null; try { d = await x.json(); } catch {}
    return { ok: false, kind: x.status === 429 ? "rate-limit" : x.status >= 500 ? "server" : "auth", status: x.status, message: String(d?.msg || d?.message || ""), ...(typeof d?.error_code === "string" ? { errorCode: d.error_code } : {}) };
  })();
  sent = r;
  if (r.ok) check("发送验证码请求被接受（HTTP 200）", true, "请回到下面的人工确认清单");
  else { const d = describeSendError(r); check("发送验证码请求被接受（HTTP 200）", false, `${d.id}｜${d.diag.replace("诊断：", "")}｜${d.text}`); }
}

const failed = results.filter((v) => !v).length;
out(`\n${results.length - failed}/${results.length} 项通过`);
if (sent?.ok) {
  out("\n【还需要人确认，脚本看不到】");
  out(" 1. 测试邮箱（含垃圾邮件）收到了验证码邮件，正文只有 6 位验证码、没有链接；");
  out(" 2. 在测试预览里输入验证码后能登录；");
  out(" 3. 游客的 XP 经“安全合并到账号”保留，云端读回一致。");
} else if (!flag("send")) out("\n（预检阶段没有发任何邮件。要发 1 封：加 --send --email=<已开通的测试邮箱> --yes-send-one-mail）");
process.exit(failed ? 1 : 0);
