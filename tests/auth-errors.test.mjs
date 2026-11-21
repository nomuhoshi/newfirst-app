// AUTH-MAIL-01/02 专项（纯 Node）：发验证码 / 输验证码 / 选择游客进度失败的分类（对应设计规范 S1a–S6、V1–V4、C1）、
// 文案、诊断行、冷却，以及同步状态栏和提示条里不出现服务器英文原文。
// 全部走真实的 createApi（假 fetch 返回 Supabase Auth 的各种错误体形状）→ describe*。
// 运行：node tests/auth-errors.test.mjs
import { createApi } from "../src/cloud-api.js";
import { describeSendError, describeVerifyError, describeChoiceError, classifySend, safeCode, safeStatus, serverWaitSec, syncErrorText, isOwnChinese, safeMessage, SEND_COPY, VERIFY_COPY, CHOICE_COPY } from "../src/auth-errors.js";
import { statusText, errorText } from "../src/account-ui.js";
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const reply = (status, body, headers = {}) => async () => ({ ok: status < 400, status, headers: { get: (k) => headers[String(k).toLowerCase()] ?? null }, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const mk = (fetchFn, extra = {}) => createApi({ url: "https://x.supabase.test", anonKey: "k", fetchFn, ...extra });
const seen = { send: new Set(), verify: new Set(), choice: new Set() };
const send = async (status, body, headers, o = {}) => { const r = await mk(reply(status, body, headers)).sendCode("a@b.co"); const d = describeSendError(r, o); seen.send.add(d.id); return { r, d }; };
const ver = async (status, body, headers, o = {}) => { const r = await mk(reply(status, body, headers)).verifyCode("a@b.co", "123456"); const d = describeVerifyError(r, o); seen.verify.add(d.id); return { r, d }; };
const hang = (ms = 30) => mk((u, i) => new Promise((_, rej) => i.signal.addEventListener("abort", () => rej(Object.assign(new Error("aborted"), { name: "AbortError" })))), { timeoutMs: ms });
const down = (online) => mk(async () => { throw new TypeError("Failed to fetch"); }, { isOnline: () => online });

// ---------- S4 服务故障 ----------
let x = await send(500, { code: 500, error_code: "unexpected_failure", msg: "Error sending magic link email" });
check("S4：500 unexpected_failure；诊断行“诊断：500 · unexpected_failure”", x.d.id === "S4" && x.d.diag === "诊断：500 · unexpected_failure", JSON.stringify(x.d));
check("S4：文案不说成额度 / 配额 / 次数用完；前两次冷却 30 秒", !/额度|配额|次数|用完/.test(x.d.text) && x.d.cooldownMs === 30000 && x.d.cooldownLabel === "30 秒后可再试", JSON.stringify(x.d));
check("S4：第 3 次起冷却 5 分钟，文案追加“先继续学习”", (() => { const d = describeSendError(x.r, { fails: 3 }); return d.cooldownMs === 300000 && /先继续学习，晚点再登录也行/.test(d.text) && d.cooldownLabel === "约 5 分钟后可再试"; })() && describeSendError(x.r, { fails: 2 }).cooldownMs === 30000 && !/先继续学习/.test(describeSendError(x.r, { fails: 2 }).text));
x = await send(500, { code: 500, msg: "Error sending magic link email" });
check("S4：500 没有 error_code（老版本）：诊断行只有状态码", x.d.id === "S4" && x.d.diag === "诊断：500");
x = await send(400, { msg: "Error sending confirmation email" });
check("S4：消息匹配 Error sending … email（即使是 4xx）也归 S4", x.d.id === "S4" && x.d.diag === "诊断：400");
x = await send(502, "<html>Bad Gateway</html>");
check("S4：非 JSON 的 502，不显示 HTML", x.d.id === "S4" && x.d.diag === "诊断：502" && !/html|Bad Gateway/i.test(x.d.text + x.d.diag));
x = await send(503, "");
check("S4：空响应体 503", x.d.id === "S4" && x.d.diag === "诊断：503");

// ---------- S2 / S3 限流 ----------
// G-LOGIN-06：原因只看“错误码 + 原文有限匹配”，等待数字（Retry-After）只决定等多久。完整矩阵 / 假时钟见 tests/send-code-cooldown.test.mjs。
x = await send(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 40 seconds." });
check("S2：邮箱限流码 + 发送间隔提示 → 该邮箱请求太频繁；不保证旧验证码有效；没有等待头 → 60 秒默认（原文里的 40 秒不进界面也不决定等待）；给“去输入验证码”入口", x.d.id === "S2" && /这个邮箱/.test(x.d.text) && /不一定还有效/.test(x.d.text) && !/40 秒/.test(x.d.text) && x.d.cooldownMs === 60000 && x.d.secondary === "enter-code" && x.d.diag === "", JSON.stringify(x.d));
x = await send(429, { error_code: "over_request_rate_limit", msg: "Request rate limit reached" }, { "retry-after": "120" });
check("S8：over_request_rate_limit + Retry-After 120 → 中性请求限流（不再是“验证码刚发过”），等 120 秒，不推断已发邮件 / 额度", x.d.id === "S8" && /120 秒/.test(x.d.text) && x.d.cooldownMs === 120000 && !/发过|邮件服务|额度/.test(x.d.text) && x.d.secondary === "", JSON.stringify(x.d));
x = await send(429, { error_code: "over_request_rate_limit", msg: "slow down" });
check("S8：over_request_rate_limit 没有数字 → N=60", x.d.id === "S8" && /60 秒/.test(x.d.text) && x.d.cooldownMs === 60000);
x = await send(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" });
check("S3：邮箱限流码 + email rate limit exceeded → 邮件服务限流，没有等待头 → 60 秒默认（不再自己生成 5 分钟），不显示诊断行", x.d.id === "S3" && x.d.cooldownMs === 60000 && x.d.cooldownLabel === "可再发" && x.d.diag === "" && /邮件服务暂时限流/.test(x.d.text) && !/最久可能要等一小时|5 分钟/.test(x.d.text), JSON.stringify(x.d));
x = await send(429, { msg: "slow down" });
check("S8：429 无错误码无秒数 → 中性请求限流（不推断是邮件额度）", x.d.id === "S8" && !/邮件服务|额度/.test(x.d.text));
x = await send(429, { msg: "after 99999 seconds" });
check("发码冷却不再截到 1 小时（Retry-After 缺失时原文里的数字不决定等待，仍是 60 秒默认）", x.d.cooldownMs === 60000);
x = await send(429, { msg: "m" }, { "retry-after": "99999" });
check("合法的长 Retry-After 99999 秒不截断（约 28 小时）", x.d.cooldownMs === 99999000 && /约 28 小时/.test(x.d.text), JSON.stringify(x.d));
x = await send(429, { msg: "m" }, { "retry-after": "1" });
check("冷却下限：合法的 1 秒按现有最短 5 秒（原来 10 秒是 UI 层另抬的，和同步层门禁不一致）", x.d.cooldownMs === 5000, JSON.stringify(x.d));

// ---------- S5 / S6 ----------
x = await send(400, { code: 400, error_code: "email_address_not_authorized", msg: "Email address \"x@qq.com\" cannot be used as it is not authorized" });
check("S5：email_address_not_authorized；文案不带邮箱原文；不冷却；显示诊断行", x.d.id === "S5" && !x.d.text.includes("x@qq.com") && x.d.cooldownMs === 0 && x.d.diag === "诊断：400 · email_address_not_authorized" && !/测试名单/.test(x.d.text), JSON.stringify(x.d));
x = await send(400, { error_code: "email_address_not_authorized", msg: "m" }, {}, { preview: true });
check("S5t：测试入口构建用“不在测试名单里”的文案", x.d.id === "S5t" && /不在测试名单里/.test(x.d.text));
for (const [st, c] of [[422, "otp_disabled"], [422, "signup_disabled"], [400, "email_address_invalid"]]) {
  x = await send(st, { error_code: c, msg: "m" });
  check(`S5：${c}`, x.d.id === "S5");
}
x = await send(400, { msg: "Signups not allowed for otp" });
check("S5：没有错误码但消息是 Signups not allowed → S5", x.d.id === "S5");
x = await send(400, { msg: "Email address \"a@b.co\" is not authorized" });
check("S5：没有错误码但消息含 not authorized → S5", x.d.id === "S5");
x = await send(400, { error_code: "email_provider_disabled", msg: "Email logins are disabled" });
check("S6：email_provider_disabled 不在候选清单里 → S6（保守文案）", x.d.id === "S6");
x = await send(400, { error_code: "some_new_code", msg: "Something new" });
check("S6：认不出的错误码 → 保守文案，不编原因，显示状态码 + 错误码", x.d.id === "S6" && !/额度|名单|资格|配额|域名/.test(x.d.text) && x.d.diag === "诊断：400 · some_new_code" && /仍不行请截图下方诊断信息/.test(x.d.text), JSON.stringify(x.d));
x = await send(401, { msg: "Invalid API key" });
check("S6：401 不泄露原文", x.d.id === "S6" && !/API key/.test(x.d.text + x.d.diag));

// ---------- S7：发送这一步意外出错，结果不可确认 ----------
{
  const r = { ok: false, kind: "unknown", message: "CANARY_RAW", stack: "at x" }, d = describeSendError(r, { xp: 50 }); seen.send.add(d.id);
  check("S7：kind=unknown → S7，文案是“暂时无法确认是否发出，请先检查邮件。”（不说“没发出去”）", classifySend(r) === "S7" && d.text === "暂时无法确认是否发出，请先检查邮件。" && !d.text.includes("没发出去"), JSON.stringify(d));
  check("S7：不冷却、无诊断行、不含原文、带去输入验证码入口、不自动跳页、有 XP 提示", d.cooldownMs === 0 && d.diag === "" && !JSON.stringify(d).includes("CANARY") && d.secondary === "enter-code" && d.uncertainSent === false && d.xp.includes("50 XP"), JSON.stringify(d));
}

// ---------- S1a / S1b ----------
{
  const off = await down(false).sendCode("a@b.co"), dOff = describeSendError(off); seen.send.add(dOff.id);
  check("S1a：navigator.onLine=false 的请求失败 → 不冷却、不跳页、不显示诊断行", dOff.id === "S1a" && dOff.cooldownMs === 0 && !dOff.uncertainSent && dOff.diag === "", JSON.stringify(dOff));
  const flaky = await down(true).sendCode("a@b.co"), dFl = describeSendError(flaky); seen.send.add(dFl.id);
  check("S1b：在线但请求失败 → 不冷却，文案提醒先看邮箱；因为没超时，不跳页", dFl.id === "S1b" && dFl.cooldownMs === 0 && !dFl.uncertainSent && /看看邮箱（含垃圾邮件）/.test(dFl.text));
  const to = await hang().sendCode("a@b.co"), dTo = describeSendError(to); seen.send.add(dTo.id);
  check("S1b：请求超时（自己的计时器中止）→ 标出 timedOut；邮件可能已发出，跳去输验证码、重发锁 60 秒", to.timedOut === true && dTo.id === "S1b" && dTo.uncertainSent === true && /请求超时，邮件可能已发出。请先检查邮箱/.test(dTo.text), JSON.stringify(dTo));
  const toOff = await mk((u, i) => new Promise((_, rej) => i.signal.addEventListener("abort", () => rej(new Error("a")))), { timeoutMs: 30, isOnline: () => false }).sendCode("a@b.co");
  check("超时优先于离线判断：超时仍是 S1b（邮件可能已发）", describeSendError(toOff).id === "S1b" && toOff.offline === undefined);
  check("S1a 和 S1b 文案不同", dOff.text !== dTo.text);
  const cfg = describeSendError(await createApi({ url: "", anonKey: "" }).sendCode("a@b.co")); seen.send.add(cfg.id);
  check("CFG：云端没配置", cfg.id === "CFG" && /云端暂未开通/.test(cfg.text));
}

// ---------- V1–V5 ----------
x = await ver(403, { code: 403, error_code: "otp_expired", msg: "Token has expired or is invalid" });
check("V1：验证码错误 / 过期（403）→ 沿用原文案；不显示诊断行", x.d.id === "V1" && /验证码错误或已过期，请检查后重试，或点“重新发送”/.test(x.d.text) && x.d.diag === "");
x = await ver(400, { msg: "invalid" });
check("V1：验证码这一步的 400 也归 V1", x.d.id === "V1");
x = await ver(429, { error_code: "over_request_rate_limit", msg: "after 30 seconds" });
check("V2：验证 429 → 文案写 30 秒，冷却取真实的 31 秒", x.d.id === "V2" && /30 秒/.test(x.d.text) && x.d.cooldownMs === 31000);
x = await ver(429, { msg: "slow" });
check("V2：没有数字 → 60 秒", x.d.id === "V2" && x.d.cooldownMs === 60000 && /60 秒/.test(x.d.text));
x = await ver(500, { msg: "boom" });
check("V4：验证 500 → 登录服务暂时出问题；诊断行 诊断：500；不说成验证码错", x.d.id === "V4" && x.d.diag === "诊断：500" && !/验证码错误/.test(x.d.text));
{
  const off = describeVerifyError(await down(false).verifyCode("a@b.co", "1")), to = describeVerifyError(await hang().verifyCode("a@b.co", "1")), onl = describeVerifyError(await down(true).verifyCode("a@b.co", "1"));
  [off, to, onl].forEach((d) => seen.verify.add(d.id));
  check("V3：断网 / 超时 / 在线失败 都是 V3；提示再点一次「登录」，不冷却，不显示诊断行", [off, to, onl].every((d) => d.id === "V3" && d.cooldownMs === 0 && d.diag === "" && /再点一次「登录」/.test(d.text)));
  const cr = describeVerifyError({ ok: false, kind: "auth", status: 401, message: "JWT expired" }); seen.verify.add(cr.id);
  check("V6（规范外补充，旧路径：没有 stage 的 auth 失败）：验证码已用掉、后面凭证 / 读取被拒 → 不说验证码错，要换新码，带诊断行", cr.id === "V6" && !/验证码错误/.test(cr.text) && /「重新发送」/.test(cr.text) && cr.diag === "诊断：401");
  // 2026-11-19：验证码这一步成功（一次性验证码已被用掉）、随后读云端记录失败（sync 打 stage:"read"）。
  // 还能重试（canRetry:true，已验证会话还留在内存里）→ V5「重试读取」；不能重试（次数 / 时限 / 会话失效）→ V6 换新验证码。两种都不能说验证码错。
  const READS = [["503", { ok: false, kind: "server", status: 503, stage: "read" }], ["403 bad_jwt", { ok: false, kind: "auth", status: 403, errorCode: "bad_jwt", stage: "read" }], ["断网", { ok: false, kind: "network", offline: true, stage: "read" }], ["超时", { ok: false, kind: "network", timedOut: true, stage: "read" }], ["429", { ok: false, kind: "rate-limit", status: 429, stage: "read" }]];
  for (const [label, r] of READS) {
    const d = describeVerifyError({ ...r, canRetry: true }, { xp: 50 }); seen.verify.add(d.id);
    check(`V5（读云端失败：${label}，可重试）：提示点「重试读取」、不用重新输验证码；不叫人再点「登录」、不说验证码错、不叫换新码`, d.id === "V5" && /「重试读取」/.test(d.text) && /不用重新输入验证码/.test(d.text) && !/再点「登录」|稍后再点|重新发送/.test(d.text) && !/验证码错误/.test(d.text) && d.cooldownMs === 0, d.id + " " + d.text);
    const e = describeVerifyError({ ...r, canRetry: false, exhausted: true }, { xp: 50 }); seen.verify.add(e.id);
    check(`V6（读云端失败：${label}，不能再重试）：说明验证码已用过、请点「重新发送」换新的；不叫人再点「登录」/「重试读取」、不说验证码错`, e.id === "V6" && /已经用过/.test(e.text) && /「重新发送」/.test(e.text) && !/再点「登录」|稍后再点|重试读取/.test(e.text) && !/验证码错误/.test(e.text) && e.cooldownMs === 0, e.id + " " + e.text);
  }
  { // V5w：重试读取被 429 限流、还在等待：会话还在、还能重试，但要等倒计时（waitMs）结束
    const w = describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "read", canRetry: true, waitMs: 45_000, retryAt: 1 }, { xp: 50 }); seen.verify.add(w.id);
    check("V5w（重试读取被 429 限流）：说明要等 45 秒再点「重试读取」，不用重新输验证码；不说验证码错、不叫换新码；按钮冷却由界面按 waitMs 管（cooldownMs 为 0）", w.id === "V5w" && /45 秒/.test(w.text) && /「重试读取」/.test(w.text) && /不用重新输入验证码/.test(w.text) && !/验证码错误/.test(w.text) && !/重新发送/.test(w.text) && w.cooldownMs === 0, JSON.stringify(w));
    const w2 = describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "read", canRetry: true, waitMs: 600_000 }, { xp: 0 });
    check("V5w：长等待按分钟显示（600 秒 → 约 10 分钟）", w2.id === "V5w" && /约 10 分钟/.test(w2.text), w2.text);
    check("V5w 只在“读取被限流且还有剩余等待”时出现：等待已结束（waitMs 0）或没带 waitMs → 普通 V5；不能再重试 → V6（即使是 429）", describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "read", canRetry: true, waitMs: 0 }).id === "V5" && describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "read", canRetry: true }).id === "V5" && describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "read", canRetry: false, exhausted: true, waitMs: 5000 }).id === "V6");
  }
  check("读云端失败没有 canRetry 标记 → 保守按“不能重试”（V6），不会出现点了没用的「重试读取」", describeVerifyError({ ok: false, kind: "server", status: 503, stage: "read" }).id === "V6");
  { const d = describeVerifyError({ ok: false, kind: "server", status: 500, stage: "verify" }); check("对照：验证码这一步本身 5xx（验证码没被用掉）仍是 V4，可以再点「登录」", d.id === "V4" && /再点「登录」/.test(d.text), d.text); }
  const ot = describeVerifyError({ ok: false, kind: "weird", message: "?" }); seen.verify.add(ot.id);
  check("认不出的验证失败 → 按 V4 保守处理", ot.id === "V4");
  const cfg = describeVerifyError(await createApi({ url: "", anonKey: "" }).verifyCode("a@b.co", "1")); seen.verify.add(cfg.id);
  check("验证侧 CFG", cfg.id === "CFG");
}

// ---------- C1 ----------
{
  const a = describeChoiceError({ ok: false, kind: "network", message: "x" }, { xp: 50 }); seen.choice.add(a.id);
  const b = describeChoiceError({ ok: false, kind: "data", code: "doc_invalid", message: "CANARY" }, { xp: 50 }); seen.choice.add(b.id);
  const c = describeChoiceError({ ok: false, kind: "server", status: 500, message: "CANARY" }, { xp: 0 });
  check("C1：游客进度原样留在这台设备上、可以再试一次；普通失败不显示诊断行", a.id === "C1" && /你的游客进度原样留在这台设备上，可以再试一次/.test(a.text) && a.diag === "" && a.xp !== "");
  check("C1：数据类失败显示诊断行（诊断：数据 · doc_invalid）", b.id === "C1d" && b.diag === "诊断：数据 · doc_invalid", b.diag);
  check("C1：XP=0 不带进度行；原文不外露", c.xp === "" && !/CANARY/.test(JSON.stringify([a, b, c])));
}

// ---------- 不暴露服务器原文 + 过滤 ----------
{
  const CAN = "CANARY<script>alert(1)</script>https://evil.example/?t=eyJhbGciOi secret=abc user@leak.example";
  const bodies = [
    [500, { code: 500, error_code: "unexpected_failure", msg: CAN }], [429, { error_code: "over_email_send_rate_limit", msg: CAN }],
    [429, { error_code: "over_request_rate_limit", msg: CAN + " after 30 seconds" }], [400, { error_code: "email_address_not_authorized", message: CAN }],
    [422, { error_code: "otp_disabled", error_description: CAN }], [400, { error: CAN }], [403, { msg: CAN }], [400, CAN], [502, CAN],
  ];
  let leak = "";
  for (const [st, b] of bodies) for (const [name, fn] of [["send", send], ["verify", ver]]) for (const o of [{ xp: 50 }, { xp: 50, preview: true }]) {
    const { d } = await fn(st, b, {}, o);
    const all = [d.text, d.diag, d.xp, d.cooldownLabel].join("\n");
    if (/CANARY|<script|evil\.example|eyJ|secret=|leak\.example/.test(all)) leak += `${name}/${st}:${all}\n`;
  }
  check("36 种“原文里塞满危险字符 / 邮箱”的响应：界面文字、诊断行、XP 行都不含服务器原文", leak === "", leak);
  const hostile = [["BAD CODE<script>", ""], ["UPPER_CASE", ""], ["x".repeat(100), ""], ["ab", ""], ["abc", "abc"], ["over_email_send_rate_limit", "over_email_send_rate_limit"], ["has-dash", ""], [123, ""], [null, ""]];
  check("错误码过滤：只放行 ^[a-z0-9_]{3,40}$", hostile.every(([i, o]) => safeCode(i) === o), JSON.stringify(hostile.map(([i]) => safeCode(i))));
  check("状态码过滤：只放行 100–599 的整数", [[500, 500], [99, 0], [600, 0], [200.5, 0], ["500", 0], [NaN, 0], [undefined, 0]].every(([i, o]) => safeStatus(i) === o));
  x = await send(500, { error_code: "BAD CODE<script>", msg: "x" });
  check("不合格的错误码不进诊断行（只剩状态码）", x.d.diag === "诊断：500", x.d.diag);
}

// ---------- XP 提示 ----------
{
  const exact = "你的 50 XP 还在这台设备上，没有受影响。";
  const o = { xp: 50 };
  const all = [(await send(500, {}, {}, o)).d, (await send(429, {}, {}, o)).d, (await send(429, { msg: "after 30 seconds" }, {}, o)).d, (await send(400, { error_code: "email_address_not_authorized" }, {}, o)).d, (await send(400, { error_code: "x_unknown" }, {}, o)).d, (await ver(403, {}, {}, o)).d, (await ver(500, {}, {}, o)).d, describeSendError(await hang().sendCode("a@b.co"), o), describeSendError(await down(false).sendCode("a@b.co"), o), describeVerifyError(await down(true).verifyCode("a@b.co", "1"), o)];
  check("XP>0：S1a–S6、V1–V4 所有失败界面都有固定句子", all.every((d) => d.xp === exact), all.map((d) => d.id + ":" + d.xp).join(" | "));
  const bad = ["0", undefined, NaN, "50", -5, null].every((v, i) => describeSendError({ ok: false, kind: "server", status: 500 }, { xp: i === 0 ? 0 : v }).xp === "");
  check("XP=0 / 未提供 / NaN / 字符串 / 负数：不显示这一句", bad);
  check("XP 取整显示（50.7 → 50）", describeSendError({ ok: false, kind: "server", status: 500 }, { xp: 50.7 }).xp === exact);
}

// ---------- XP 措辞分情形（产品官裁决）：能确认没改动才说“没有受影响”；云端状态未知说“云端同步未完成” ----------
{
  const c1 = describeChoiceError({ ok: false, kind: "server", status: 500 }, { xp: 50 });
  const c1d = describeChoiceError({ ok: false, kind: "data", code: "doc_invalid" }, { xp: 50 });
  check("C1/C1d：XP 句子是“仍在这台设备上，云端同步未完成”，不说“没有受影响”", c1.xp === "你的 50 XP 仍在这台设备上，云端同步未完成。" && c1d.xp === c1.xp && !/没有受影响/.test(JSON.stringify([c1, c1d])), JSON.stringify([c1.xp, c1d.xp]));
  check("C1 的 XP 也取整（50.7 → 50）", describeChoiceError({ ok: false, kind: "server", status: 500 }, { xp: 50.7 }).xp === c1.xp);
  const s1 = describeSendError({ ok: false, kind: "server", status: 500 }, { xp: 50 }), v1 = describeVerifyError({ ok: false, kind: "auth", status: 403, stage: "verify" }, { xp: 50 });
  check("发送 / 验证码失败（登录没发生、本机没动）仍用“没有受影响”", /没有受影响/.test(s1.xp) && /没有受影响/.test(v1.xp));
  const t1 = describeSendError({ ok: false, kind: "network", timedOut: true }, { xp: 50 }), t2 = describeSendError({ ok: false, kind: "network" }, { xp: 50 });
  check("S1b 超时文案：请求超时，邮件可能已发出。请先检查邮箱；非超时是网络不稳版本", /^请求超时，邮件可能已发出。请先检查邮箱/.test(t1.text) && /^网络不稳/.test(t2.text) && t1.uncertainSent && !t2.uncertainSent);
  check("冷却范围（G-LOGIN-06）：发码限流（S2/S3/S8/S9）都按本页实际门禁，不绑邮箱；只有 V2（验证太频繁）按当前邮箱；S4、S5、S6 不绑邮箱", describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "verify" }).scope === "email" && ["rate-limit", "server"].every((k) => describeSendError({ ok: false, kind: k, status: k === "server" ? 500 : 429 }).scope === "") && describeSendError({ ok: false, kind: "rate-limit", status: 429, errorCode: "over_email_send_rate_limit", message: "you can only request this after 30 seconds" }).scope === "");
  // V2（输入验证码太频繁）仍走 serverWaitSec：Retry-After 优先、上限 1 小时、下限 10 秒。发码路径（S2/S3/S8/S9）已不用它，这几条原来由发码的断言顺带覆盖，现在直接测 V2。
  const v2 = (o) => describeVerifyError({ ok: false, kind: "rate-limit", status: 429, stage: "verify", ...o });
  check("V2：Retry-After 120 → 冷却 121 秒、文案约 2 分钟（忽略 Retry-After 会变成 60 秒）", v2({ retryAfterSec: 120 }).cooldownMs === 121000 && /约 2 分钟/.test(v2({ retryAfterSec: 120 }).text), JSON.stringify(v2({ retryAfterSec: 120 })));
  check("V2：冷却上限截到 1 小时（验证路径语义不变）", v2({ retryAfterSec: 99999 }).cooldownMs === 3600000);
  check("V2：冷却下限抬到 10 秒（验证路径语义不变）", v2({ retryAfterSec: 1 }).cooldownMs === 10000);
  check("S9 本地冷却拦截：中性等待文案，截止时间沿用原来的（retryAt），不说服务器拒绝", (() => { const d = describeSendError({ ok: false, kind: "rate-limit", localBlock: true, retryAt: 5000, waitMs: 3000, message: "请求太频繁了" }); seen.send.add(d.id); return d.id === "S9" && d.cooldownMs === 3000 && d.retryAt === 5000 && /3 秒/.test(d.text) && !/服务器|邮件服务|发过/.test(d.text); })());
}

// ---------- 同步状态栏 / 提示条：不出现服务器英文原文 ----------
{
  const CAN = "CANARY_Internal Server Error JWT expired";
  const sts = [
    { status: "error", message: CAN, detail: { kind: "server", status: 500, errorCode: "unexpected_failure" } },
    { status: "error", message: CAN, detail: { kind: "rate-limit", status: 429 } },
    { status: "error", message: CAN, detail: { kind: "data", code: "doc_bad" } },
    { status: "error", message: CAN, detail: { kind: "auth", status: 401 } },
    { status: "error", message: CAN, detail: null }, { status: "error", message: CAN }, { status: "error" },
    { status: "pending", message: CAN }, { status: "offline", message: CAN }, { status: "need-login", message: CAN }, { status: "conflict", message: CAN }, { status: "synced" }, { status: "weird", message: CAN },
  ];
  check("Y3 等 13 种同步状态：状态栏文字里没有服务器原文", sts.every((s) => !/CANARY|Internal Server|JWT/.test(statusText(s))), sts.map((s) => statusText(s)).filter((t) => /CANARY|Internal|JWT/.test(t)).join(" | "));
  const y3c = statusText(sts[0]), y3b = statusText(sts[1]), y3d = statusText(sts[2]);
  check("Y3c：云端暂时出问题 + 诊断：500 · unexpected_failure", /云端暂时出问题，稍后会自动重试。进度还在这台设备上。/.test(y3c) && y3c.endsWith("诊断：500 · unexpected_failure"), y3c);
  check("Y3b：429 → 云端请求太频繁，稍后会自动重试；不再借用发验证码的文案", y3b === "云端请求太频繁，稍后会自动重试。" && !/发送太频繁/.test(y3b), y3b);
  check("Y3d：数据类 → 读不出来、同步已暂停、进度没有动 + 诊断", /读不出来，同步已暂停。你的进度没有动/.test(y3d) && y3d.endsWith("诊断：数据 · doc_bad"), y3d);
  check("应用自己写的中文（如“同步冲突太多次，请稍后再试”）原样显示", statusText({ status: "error", message: "同步冲突太多次，请稍后再试" }) === "同步冲突太多次，请稍后再试");
  check("conflict（Y9a）：同步已暂停、本机进度还在、指向“备份学习记录”导出", /同步已暂停/.test(statusText({ status: "conflict" })) && /进度还在/.test(statusText({ status: "conflict" })) && /导出进度文件/.test(statusText({ status: "conflict" })) && !/需要选择保留哪一份/.test(statusText({ status: "conflict" })));
  const errs = [{ kind: "server", status: 500, message: CAN }, { kind: "auth", message: CAN }, { kind: "x", message: CAN }, { kind: "x" }, { kind: "data", message: "Row is not valid JSON" }];
  check("errorText（提示条）：英文原文一律换成通用中文", errs.every((e) => !/CANARY|JWT|JSON|Server/i.test(errorText(e))) && errs.every((e) => /[一-鿿]/.test(errorText(e))));
  // G08：通用 429 提示不推断正在发验证码，不写死等待时间；发送 / 验证 / 读云端的专用分类保持不变。
  check("errorText：自己的中文、断网、未开通不变；通用限流中性提示，不写死一分钟", errorText({ kind: "other-account", message: "请先退出当前账号" }) === "请先退出当前账号" && errorText({ kind: "network" }) === "网络连不上，请检查网络后重试。" && [undefined, 120, 7200].every((retryAfterSec) => { const t = errorText({ kind: "rate-limit", status: 429, message: CAN, ...(retryAfterSec === undefined ? {} : { retryAfterSec }) }); return t === "云端请求太频繁了，请稍后再试。" && !/发送|验证码|一分钟|自动|CANARY/.test(t); }) && errorText({ kind: "config" }) === "云端暂未开通。");
  check("isOwnChinese / safeMessage：有汉字且没有 4 个连续英文字母才算自己的中文", isOwnChinese("本机账号记录读取失败") && isOwnChinese("需要 3 次 XP") && !isOwnChinese("Invalid refresh token") && !isOwnChinese("云端 Internal error") && !isOwnChinese("") && !isOwnChinese(null) && safeMessage("Network error") !== "Network error");
  check("syncErrorText 始终返回 { text, diag }", [null, {}, { kind: "server", status: 502 }].every((d) => { const e = syncErrorText("m", d); return typeof e.text === "string" && typeof e.diag === "string"; }));
}

// ---------- 其他 ----------
{
  const frozen = Object.freeze({ ok: false, kind: "server", status: 500, errorCode: "unexpected_failure", message: "m" });
  let threw = false; try { describeSendError(frozen, { xp: 5 }); describeVerifyError(frozen, { xp: 5 }); describeChoiceError(frozen, { xp: 5 }); } catch { threw = true; }
  check("不修改传入的结果对象（冻结对象不抛错）", !threw);
  check("成功的结果不产生提示", describeSendError({ ok: true }) === null && describeVerifyError({ ok: true }) === null && describeChoiceError({ ok: true }) === null && classifySend({ ok: true }) === "");
  check("serverWaitSec：没有真实数字时返回 0", serverWaitSec({ message: "nope" }) === 0 && serverWaitSec({}) === 0 && serverWaitSec(null) === 0);
  seen.send.add("S5t");
  const missS = Object.keys(SEND_COPY).filter((k) => !seen.send.has(k)), missV = Object.keys(VERIFY_COPY).filter((k) => !seen.verify.has(k)), missC = Object.keys(CHOICE_COPY).filter((k) => !seen.choice.has(k));
  check("文案表里每一类都被上面的用例触发过", missS.length + missV.length + missC.length === 0, [missS, missV, missC].flat().join(","));
  const texts = [...Object.values(SEND_COPY), ...Object.values(VERIFY_COPY), ...Object.values(CHOICE_COPY)].map((e) => e.text({ n: 30, fails: 1 }));
  check("每条文案非空、含汉字、没有服务器常见英文原文片段", texts.every((t) => t.length > 8 && /[一-鿿]/.test(t) && !/Error sending|rate limit|not authorized|Internal/i.test(t)));
  check("规范里的“L1 不超过约 38 个汉字×2 行”：每条 L1 文案不超过 80 个字符", texts.every((t) => [...t].length <= 80), texts.filter((t) => [...t].length > 80).join(" | "));
  check("没有“安全”一词出现在失败文案里（规范 §1 第 3 条）", texts.every((t) => !t.includes("安全")));
}
{
  const { isOwnChinese, safeMessage } = await import("../src/auth-errors.js");
  check("应用自己拼的中文 + 全角括号里的短代号算中文（没能备份（quota-exceeded））", isOwnChinese("损坏的待办没能备份（quota-exceeded），所以没有动它；本机数据都还在。"));
  check("括号外的英文单词仍被挡住（防服务器原文夹在中文里）", !isOwnChinese("云端记录：Invalid JWT token") && !isOwnChinese("失败（x）Invalid token"));
  check("全角括号里的英文句子（带空格）不放行", !isOwnChinese("没能保存（Invalid JWT token）"));
  check("纯英文 / 半角括号英文不是自己的中文", !isOwnChinese("Error sending magic link email") && !isOwnChinese("无法保存(quota-exceeded)"));
  check("safeMessage 把英文原文换成备用文案", safeMessage("Invalid JWT token", "备用") === "备用");
}
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
