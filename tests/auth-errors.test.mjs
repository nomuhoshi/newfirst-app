// AUTH-MAIL-01 专项（纯 Node）：发验证码 / 输验证码失败的分类、文案、诊断行、冷却。
// 全部走真实的 createApi（假 fetch 返回 Supabase Auth 的各种错误体形状）→ describeSendError / describeVerifyError。
// 运行：node tests/auth-errors.test.mjs
import { createApi } from "../src/cloud-api.js";
import { describeSendError, describeVerifyError, safeCode, safeStatus, serverCooldownMs, SEND_COPY, VERIFY_COPY } from "../src/auth-errors.js";
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const reply = (status, body, headers = {}) => async () => ({ ok: status < 400, status, headers: { get: (k) => headers[String(k).toLowerCase()] ?? null }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const api = (fetchFn, timeoutMs) => createApi({ url: "https://x.supabase.test", anonKey: "k", fetchFn, timeoutMs });
const send = async (status, body, headers, xp = 0) => { const r = await api(reply(status, body, headers)).sendCode("a@b.co"); return { r, d: describeSendError(r, { xp }) }; };
const ver = async (status, body, headers, xp = 0) => { const r = await api(reply(status, body, headers)).verifyCode("a@b.co", "123456"); return { r, d: describeVerifyError(r, { xp }) }; };
const seen = { send: new Set(), verify: new Set() };
const S = async (...a) => { const x = await send(...a); seen.send.add(x.d.id); return x; };
const V = async (...a) => { const x = await ver(...a); seen.verify.add(x.d.id); return x; };

// ---------- 发验证码：分类 ----------
let x = await S(500, { code: 500, error_code: "unexpected_failure", msg: "Error sending magic link email" });
check("500 unexpected_failure → server；诊断行 HTTP 500 · unexpected_failure", x.d.id === "server" && x.d.diag === "诊断：HTTP 500 · unexpected_failure", JSON.stringify(x.d));
check("500 的文案不说成额度 / 配额 / 次数用完", !/额度|配额|次数|用完/.test(x.d.text), x.d.text);
check("500 的冷却是 30 秒，而不是配额类的长冷却", x.d.cooldownMs === 30000);
x = await S(500, { code: 500, msg: "Error sending magic link email" });
check("500 没有 error_code（老版本）：同样归 server，诊断行只有 HTTP 500", x.d.id === "server" && x.d.diag === "诊断：HTTP 500");
x = await S(502, "<html>Bad Gateway</html>");
check("非 JSON 的 502：归 server，不崩，不显示 HTML", x.d.id === "server" && x.d.diag === "诊断：HTTP 502" && !/html|Bad Gateway/i.test(x.d.text + x.d.diag));
x = await S(503, "");
check("空响应体 503：归 server", x.d.id === "server" && x.d.diag === "诊断：HTTP 503");
x = await S(400, { code: 400, error_code: "email_address_not_authorized", msg: "Email address \"x@qq.com\" cannot be used as it is not authorized" });
check("email_address_not_authorized → notAuthorized；文案不带邮箱原文", x.d.id === "notAuthorized" && !x.d.text.includes("x@qq.com") && x.d.cooldownMs === 0, x.d.text);
x = await S(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" });
check("429 over_email_send_rate_limit → rateEmail；没给秒数：保守冷却 5 分钟", x.d.id === "rateEmail" && x.d.cooldownMs === 300000);
x = await S(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 40 seconds." });
check("429 消息里带 “after 40 seconds”：冷却取真实数字 41 秒（含 1 秒余量）", x.d.id === "rateEmail" && x.d.cooldownMs === 41000, String(x.d.cooldownMs));
x = await S(429, { error_code: "over_request_rate_limit", msg: "Request rate limit reached" }, { "retry-after": "120" });
check("Retry-After: 120 → 冷却 120 秒（优先于默认）", x.d.id === "rateRequest" && x.d.cooldownMs === 120000, String(x.d.cooldownMs));
x = await S(429, { error_code: "over_request_rate_limit", msg: "slow down" });
check("429 over_request_rate_limit 无数字：60 秒", x.d.id === "rateRequest" && x.d.cooldownMs === 60000);
x = await S(429, { msg: "slow down" });
check("429 无错误码：归 rateOther，60 秒，诊断行只有 HTTP 429", x.d.id === "rateOther" && x.d.cooldownMs === 60000 && x.d.diag === "诊断：HTTP 429");
x = await S(429, { msg: "after 99999 seconds" });
check("服务器给的冷却上限截到 1 小时", x.d.cooldownMs === 3600000);
x = await S(429, { msg: "after 1 seconds" });
check("服务器给的冷却下限抬到 10 秒（防止刚点完又能点）", x.d.cooldownMs === 10000);
x = await S(422, { code: 422, error_code: "otp_disabled", msg: "Signups not allowed for otp" });
check("otp_disabled → noSignup", x.d.id === "noSignup" && /没有登录资格/.test(x.d.text));
x = await S(422, { code: 422, error_code: "signup_disabled", msg: "Signups not allowed for this instance" });
check("signup_disabled → noSignup", x.d.id === "noSignup");
x = await S(400, { error_code: "email_address_invalid", msg: "Email address \"a@b\" is invalid" });
check("email_address_invalid → invalidEmail", x.d.id === "invalidEmail");
x = await S(400, { error_code: "email_provider_disabled", msg: "Email logins are disabled" });
check("email_provider_disabled → providerOff", x.d.id === "providerOff");
x = await S(400, { error_code: "some_new_code", msg: "Something new" });
check("认不出的错误码 → unknown：保守文案，不编原因", x.d.id === "unknown" && !/额度|名单|资格|配额|域名/.test(x.d.text) && x.d.diag === "诊断：HTTP 400 · some_new_code", JSON.stringify(x.d));
x = await S(401, { msg: "Invalid API key" });
check("401 → unknown（不当成验证码问题，也不泄露原文）", x.d.id === "unknown" && !/API key/.test(x.d.text + x.d.diag));

// ---------- 断网 vs 超时 ----------
{
  const off = await api(async () => { throw new TypeError("Failed to fetch"); }).sendCode("a@b.co");
  const dOff = describeSendError(off); seen.send.add(dOff.id);
  check("断网（fetch 抛 TypeError）→ offline：不冷却、不算“可能已发出”", dOff.id === "offline" && dOff.cooldownMs === 0 && !dOff.uncertainSent && dOff.diag === "诊断：网络不通", JSON.stringify(dOff));
  const hang = api((url, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))), 30);
  const to = await hang.sendCode("a@b.co");
  const dTo = describeSendError(to); seen.send.add(dTo.id);
  check("请求超时（自己的计时器中止）→ timeout，cloud-api 标出 timedOut", to.kind === "network" && to.timedOut === true && dTo.id === "timeout");
  check("超时：标记“邮件可能已发出”，文案要求先查邮箱（含垃圾邮件），冷却 60 秒", dTo.uncertainSent === true && /邮箱/.test(dTo.text) && /垃圾邮件/.test(dTo.text) && dTo.cooldownMs === 60000, dTo.text);
  check("超时和断网是两种不同分类、不同文案", dTo.id !== dOff.id && dTo.text !== dOff.text);
  check("断网的结果里没有 timedOut 标记", off.timedOut === undefined);
  const noCfg = describeSendError(await createApi({ url: "", anonKey: "" }).sendCode("a@b.co")); seen.send.add(noCfg.id);
  check("云端没配置 → config", noCfg.id === "config" && /云端暂未开通/.test(noCfg.text));
}

// ---------- 输验证码 ----------
x = await V(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
check("验证码错误 / 过期（403）→ wrongCode", x.d.id === "wrongCode" && /验证码错误或已过期/.test(x.d.text) && x.d.diag === "诊断：HTTP 403 · otp_expired", JSON.stringify(x.d));
x = await V(400, { msg: "invalid" });
check("验证码这一步的 400 也归 wrongCode", x.d.id === "wrongCode");
x = await V(429, { error_code: "over_request_rate_limit", msg: "after 30 seconds" });
check("输验证码 429 → rate，冷却取真实的 31 秒", x.d.id === "rate" && x.d.cooldownMs === 31000, String(x.d.cooldownMs));
x = await V(500, { msg: "boom" });
check("输验证码 500 → server（不说成验证码错了）", x.d.id === "server" && !/验证码错误/.test(x.d.text));
{
  const off = describeVerifyError(await api(async () => { throw new TypeError("x"); }).verifyCode("a@b.co", "1")); seen.verify.add(off.id);
  const to = describeVerifyError(await api((u, i) => new Promise((_, rej) => i.signal.addEventListener("abort", () => rej(new Error("a")))), 30).verifyCode("a@b.co", "1")); seen.verify.add(to.id);
  check("输验证码：断网 → offline；超时 → timeout（不确定是否已成功，提示再点一次登录）", off.id === "offline" && to.id === "timeout" && /再点一次“登录”/.test(to.text));
  const cfg = describeVerifyError(await createApi({ url: "", anonKey: "" }).verifyCode("a@b.co", "1")); seen.verify.add(cfg.id);
  check("输验证码：云端没配置 → config", cfg.id === "config");
  const cr = describeVerifyError({ ok: false, kind: "auth", status: 401, message: "JWT expired" }); seen.verify.add(cr.id);
  check("验证码已过、后面读云端记录被拒（无 stage）→ cloudRead，不说验证码错", cr.id === "cloudRead" && !/验证码错误/.test(cr.text));
  const ot = describeVerifyError({ ok: false, kind: "weird", message: "?" }); seen.verify.add(ot.id);
  check("认不出的 → other，保守文案", ot.id === "other" && /原因暂时不明/.test(ot.text));
}

// ---------- 不暴露服务器原文 + 诊断行过滤 ----------
{
  const CAN = "CANARY<script>alert(1)</script>https://evil.example/?t=eyJhbGciOi secret=abc";
  const bodies = [
    [500, { code: 500, error_code: "unexpected_failure", msg: CAN }], [429, { error_code: "over_email_send_rate_limit", msg: CAN }],
    [400, { error_code: "email_address_not_authorized", message: CAN }], [422, { error_code: "otp_disabled", error_description: CAN }],
    [400, { error: CAN }], [403, { msg: CAN }], [400, CAN], [502, CAN],
  ];
  let leak = "";
  for (const [st, b] of bodies) {
    for (const [name, fn] of [["send", send], ["verify", ver]]) {
      const { d } = await fn(st, b, {}, 50);
      const all = [d.text, d.diag, d.xp].join("\n");
      if (/CANARY|<script|evil\.example|eyJ|secret=/.test(all)) leak += `${name}/${st}:${all}\n`;
    }
  }
  check("16 种“原文里塞满危险字符”的响应：界面文字、诊断行、XP 行都不含服务器原文", leak === "", leak);
  const hostile = [["BAD CODE<script>", ""], ["UPPER_CASE", ""], ["x".repeat(100), ""], ["a", ""], ["over_email_send_rate_limit", "over_email_send_rate_limit"], ["has-dash", ""], [123, ""], [null, ""]];
  check("错误码过滤：只放行小写字母数字下划线（2–64 位）", hostile.every(([i, o]) => safeCode(i) === o), JSON.stringify(hostile.map(([i]) => safeCode(i))));
  check("状态码过滤：只放行 100–599 的整数", [[500, 500], [99, 0], [600, 0], [200.5, 0], ["500", 0], [NaN, 0], [undefined, 0]].every(([i, o]) => safeStatus(i) === o));
  const { d } = await send(500, { error_code: "BAD CODE<script>", msg: "x" });
  check("不合格的错误码不进诊断行（只剩 HTTP 500）", d.diag === "诊断：HTTP 500", d.diag);
}

// ---------- XP 提示 ----------
{
  const exact = "你的 50 XP 还在这台设备上，没有受影响。";
  const cases = [["500 server", await send(500, {}, {}, 50)], ["429", await send(429, {}, {}, 50)], ["notAuthorized", await send(400, { error_code: "email_address_not_authorized" }, {}, 50)], ["验证码错", await ver(403, {}, {}, 50)]];
  check("XP>0：所有失败界面都显示固定句子（50 XP）", cases.every(([, c]) => c.d.xp === exact), cases.map(([n, c]) => n + ":" + c.d.xp).join(" | "));
  const to = describeSendError(await api((u, i) => new Promise((_, rej) => i.signal.addEventListener("abort", () => rej(new Error("a")))), 30).sendCode("a@b.co"), { xp: 50 });
  const off = describeSendError(await api(async () => { throw new TypeError("x"); }).sendCode("a@b.co"), { xp: 50 });
  check("XP>0：超时、断网时也显示", to.xp === exact && off.xp === exact);
  check("XP=0 / 未提供 / NaN / 字符串：不显示这一句", ["0", undefined, NaN, "50", -5, null].every((v, i) => (describeSendError({ ok: false, kind: "server", status: 500 }, { xp: i === 0 ? 0 : v }).xp === "")));
  check("XP 取整显示（50.7 → 50）", describeSendError({ ok: false, kind: "server", status: 500 }, { xp: 50.7 }).xp === exact);
}

// ---------- 其他 ----------
{
  const frozen = Object.freeze({ ok: false, kind: "server", status: 500, errorCode: "unexpected_failure", message: "m" });
  let threw = false; try { describeSendError(frozen, { xp: 5 }); describeVerifyError(frozen, { xp: 5 }); } catch { threw = true; }
  check("不修改传入的结果对象（冻结对象不抛错）", !threw);
  check("成功的结果不产生提示", describeSendError({ ok: true }) === null && describeVerifyError({ ok: true }) === null);
  check("serverCooldownMs：没有真实数字时返回 0（由调用方用默认值）", serverCooldownMs({ message: "nope" }) === 0 && serverCooldownMs({}) === 0 && serverCooldownMs(null) === 0);
  const missS = Object.keys(SEND_COPY).filter((k) => !seen.send.has(k)), missV = Object.keys(VERIFY_COPY).filter((k) => !seen.verify.has(k));
  check("文案表里每一类都被上面的用例触发过（发送侧）", missS.length === 0, missS.join(","));
  check("文案表里每一类都被上面的用例触发过（验证侧）", missV.length === 0, missV.join(","));
  check("每条文案非空且不含服务器常见英文原文片段", [...Object.values(SEND_COPY), ...Object.values(VERIFY_COPY)].every((e) => e.text.length > 8 && !/Error sending|rate limit exceeded|not authorized/i.test(e.text)));
}
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
