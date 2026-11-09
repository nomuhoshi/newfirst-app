// 发验证码失败时，界面要显示“中文分类 + 服务器状态码 + 错误码 + 原文”，而不是只丢一句英文原文。
// 走真实的 createApi（假 fetch 返回 Supabase Auth 的真实错误体形状）→ sendCodeErrorText。
// 运行：node tests/auth-error-display.test.mjs
import { createApi } from "../src/cloud-api.js";
import { sendCodeErrorText } from "../src/account-ui.js";
const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const reply = (status, body) => async () => ({ ok: status < 400, status, text: async () => (typeof body === "string" ? body : JSON.stringify(body)) });
const send = async (status, body) => sendCodeErrorText(await createApi({ url: "https://x.supabase.test", anonKey: "k", fetchFn: reply(status, body) }).sendCode("a@b.co"));

// 本次 acc1 现场只知道页面文字是 Error sending magic link email；真实状态码 / 错误码以 Auth 日志为准，这里用假响应覆盖各种可能的形状
const t500 = await send(500, { code: 500, error_code: "unexpected_failure", msg: "Error sending magic link email" });
check("500 unexpected_failure：中文说明 + 状态码 + 错误码 + 英文原文", /发信失败/.test(t500) && t500.includes("服务器返回 500") && t500.includes("unexpected_failure") && t500.includes("Error sending magic link email"), t500);
const t500b = await send(500, { code: 500, msg: "Error sending magic link email" });
check("500 没有 error_code（老版本）：仍给出中文说明 + 状态码 + 原文", /服务器这边出错/.test(t500b) && t500b.includes("500") && t500b.includes("Error sending magic link email"), t500b);
const tna = await send(400, { code: 400, error_code: "email_address_not_authorized", msg: "Email address \"x@qq.com\" cannot be used as it is not authorized" });
check("email_address_not_authorized：说明是发信名单限制", /发信服务允许的名单/.test(tna) && tna.includes("400") && tna.includes("email_address_not_authorized"), tna);
const tr = await send(429, { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" });
check("over_email_send_rate_limit：说明是发送次数上限，带 429 和错误码", /次数已达上限/.test(tr) && tr.includes("429") && tr.includes("over_email_send_rate_limit"), tr);
const tr2 = await send(429, { code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" });
check("over_request_rate_limit：请求太频繁", /请求太频繁/.test(tr2) && tr2.includes("over_request_rate_limit"), tr2);
const tr3 = await send(429, { msg: "slow down" });
check("429 无错误码：沿用“发送太频繁”并附状态码", /发送太频繁/.test(tr3) && tr3.includes("429"), tr3);
const tod = await send(422, { code: 422, error_code: "otp_disabled", msg: "Signups not allowed for otp" });
check("otp_disabled（注册已关闭且邮箱不存在）：说明没有登录资格", /没有登录资格/.test(tod) && tod.includes("422") && tod.includes("otp_disabled"), tod);
const tinv = await send(400, { code: 400, error_code: "email_address_invalid", msg: "Email address \"a@b\" is invalid" });
check("email_address_invalid：服务器不接受这个邮箱", /不接受这个邮箱/.test(tinv) && tinv.includes("email_address_invalid"), tinv);
const tunk = await send(400, { code: 400, error_code: "some_new_code", msg: "Something new" });
check("认不出的错误码：不编原因，只显示通用句 + 状态码 + 错误码 + 原文", tunk.startsWith("验证码没发出去") && tunk.includes("some_new_code") && tunk.includes("Something new") && !/名单|上限|资格/.test(tunk), tunk);
const thtml = await send(502, "<html>Bad Gateway</html>");
check("非 JSON 的 502：显示服务器返回 502，不崩", /服务器这边出错/.test(thtml) && thtml.includes("502"), thtml);
const tempty = await send(503, "");
check("空响应体 503：显示“服务器返回 503”且不重复", /服务器这边出错/.test(tempty) && tempty.includes("服务器返回 503") && (tempty.match(/503/g) || []).length === 1, tempty);
const tnet = sendCodeErrorText(await createApi({ url: "https://x.supabase.test", anonKey: "k", fetchFn: async () => { throw new TypeError("Failed to fetch"); } }).sendCode("a@b.co"));
check("断网：仍是“网络连不上”，不带服务器码", /网络连不上/.test(tnet) && !/服务器返回/.test(tnet), tnet);
const tcfg = sendCodeErrorText(await createApi({ url: "", anonKey: "" }).sendCode("a@b.co"));
check("云端没配置：显示“云端暂未开通”", /云端暂未开通/.test(tcfg), tcfg);
check("成功不产生提示文字", sendCodeErrorText({ ok: true }) === "");
// 展示里不能泄露密钥：原文来自服务器，但请求头里的 key 不会进入文字
check("提示文字里没有密钥或 Authorization 内容", !/Bearer|apikey|sb_publishable/i.test([t500, tna, tr, tunk].join("\n")));
const bad = results.filter((x) => !x).length;
console.log(`\n${results.length - bad}/${results.length} 通过`);
process.exit(bad ? 1 : 0);
