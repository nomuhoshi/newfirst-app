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
x = await send(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 40 seconds." });
check("S2：429 消息带 “after 40 seconds” → 文案写 40 秒，冷却取真实数字 41 秒，给“去输入验证码”入口", x.d.id === "S2" && /40 秒/.test(x.d.text) && x.d.cooldownMs === 41000 && x.d.secondary === "enter-code" && x.d.diag === "", JSON.stringify(x.d));
x = await send(429, { error_code: "over_request_rate_limit", msg: "Request rate limit reached" }, { "retry-after": "120" });
check("S2：Retry-After 120 → 约 2 分钟，冷却 121 秒", x.d.id === "S2" && /约 2 分钟/.test(x.d.text) && x.d.cooldownMs === 121000, JSON.stringify(x.d));
x = await send(429, { error_code: "over_request_rate_limit", msg: "slow down" });
check("S2：over_request_rate_limit 没有数字 → N=60", x.d.id === "S2" && /60 秒/.test(x.d.text) && x.d.cooldownMs === 60000);
x = await send(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" });
check("S3：429 没有秒数 → 邮件配额，冷却 5 分钟，不显示诊断行", x.d.id === "S3" && x.d.cooldownMs === 300000 && x.d.cooldownLabel === "约 5 分钟后可再试" && x.d.diag === "" && /最久可能要等一小时/.test(x.d.text));
x = await send(429, { msg: "slow down" });
check("S3：429 无错误码无秒数 → S3", x.d.id === "S3");
x = await send(429, { msg: "after 99999 seconds" });
check("冷却上限截到 1 小时", x.d.cooldownMs === 3600000);
x = await send(429, { msg: "after 1 seconds" });
check("冷却下限抬到 10 秒", x.d.cooldownMs === 10000);

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

// ---------- S1a / S1b ----------
{
  const off = await down(false).sendCode("a@b.co"), dOff = describeSendError(off); seen.send.add(dOff.id);
  check("S1a：navigator.onLine=false 的请求失败 → 不冷却、不跳页、不显示诊断行", dOff.id === "S1a" && dOff.cooldownMs === 0 && !dOff.uncertainSent && dOff.diag === "", JSON.stringify(dOff));
  const flaky = await down(true).sendCode("a@b.co"), dFl = describeSendError(flaky); seen.send.add(dFl.id);
  check("S1b：在线但请求失败 → 不冷却，文案提醒先看邮箱；因为没超时，不跳页", dFl.id === "S1b" && dFl.cooldownMs === 0 && !dFl.uncertainSent && /看看邮箱（含垃圾邮件）/.test(dFl.text));
  const to = await hang().sendCode("a@b.co"), dTo = describeSendError(to); seen.send.add(dTo.id);
  check("S1b：请求超时（自己的计时器中止）→ 标出 timedOut；邮件可能已发出，跳去输验证码、重发锁 60 秒", to.timedOut === true && dTo.id === "S1b" && dTo.uncertainSent === true && /先看看邮箱/.test(dTo.text), JSON.stringify(dTo));
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
  check("V5（规范外补充）：验证码已过、后面读云端记录被拒 → 不说验证码错，带诊断行", cr.id === "V5" && !/验证码错误/.test(cr.text) && cr.diag === "诊断：401");
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
  check("errorText：应用自己写的中文（“请先退出当前账号”）原样显示；断网 / 限流 / 未开通沿用原句", errorText({ kind: "other-account", message: "请先退出当前账号" }) === "请先退出当前账号" && errorText({ kind: "network" }) === "网络连不上，请检查网络后重试。" && errorText({ kind: "rate-limit", message: CAN }) === "发送太频繁了，请等一分钟再试。" && errorText({ kind: "config" }) === "云端暂未开通。");
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
const bad = results.filter((v) => !v).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
