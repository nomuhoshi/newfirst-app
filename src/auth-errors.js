// 登录弹窗里“发验证码 / 输验证码”失败时的分类、提示文案、诊断行和重试冷却。纯函数，不碰存储、不联网，所以能直接在 Node 里测。
//
// 规则（AUTH-MAIL-01）：
//  1. 页面不显示服务器原文（msg / message / error_description 一律不进界面）。
//  2. 只把“状态码”和“错误码”放进诊断行，且先过安全过滤（数字范围 / 小写字母数字下划线），过滤不过就不显示。
//  3. 不确定的错误码用保守文案，不编原因；5xx 不等于“邮件额度用完”。
//  4. 登录失败从不改本机进度；有 XP 时明说“还在这台设备上，没有受影响”。
//  5. 冷却时间优先取服务器给的真实数字（消息里的“after N seconds”、Retry-After），没有才用保守默认值。
//  6. 超时 ≠ 断网：超时时邮件可能已经发出，应先去查邮箱，不要马上重发。

// ---------- 过滤 ----------
export const safeStatus = (n) => (Number.isInteger(n) && n >= 100 && n <= 599 ? n : 0);
export const safeCode = (s) => (typeof s === "string" && /^[a-z][a-z0-9_]{1,63}$/.test(s) ? s : "");

// ---------- 文案表（设计师方案到了之后只改这张表）----------
// id 是内部分类名；design 留给设计师编号（L0 / S1–S6 / V1–V4 / C1），拿到原文后对号填入。
// cooldown：ms 数 / "server"（取服务器给的数字，没有就用 fallback）/ 0 不冷却。
export const SEND_COPY = {
  config: { design: null, text: "云端暂未开通，现在只能在这台设备上学习。", cooldown: 0 },
  offline: { design: null, text: "现在没有网络，验证码没有发出去。连上网络后再试。", cooldown: 0 },
  timeout: { design: null, text: "请求超时了，验证码可能已经发出。先去邮箱（包括垃圾邮件）看一下，收到就直接输入；一分钟后还没有，再点“重新发送”。", cooldown: 60000, uncertainSent: true },
  rateEmail: { design: null, text: "这个邮箱发验证码的次数暂时用完了，请稍后再试。", cooldown: "server", fallback: 300000 },
  rateRequest: { design: null, text: "请求太频繁了，请稍等一会儿再试。", cooldown: "server", fallback: 60000 },
  rateOther: { design: null, text: "发送太频繁了，请稍等一会儿再试。", cooldown: "server", fallback: 60000 },
  notAuthorized: { design: null, text: "这个邮箱现在收不到验证码：当前的发信服务不给它发信。请换一个邮箱，或联系开发者。", cooldown: 0 },
  noSignup: { design: null, text: "这个邮箱没有登录资格（此环境已关闭公开注册）。请用已开通的邮箱，或联系开发者。", cooldown: 0 },
  invalidEmail: { design: null, text: "服务器不接受这个邮箱地址，请检查是否输错。", cooldown: 0 },
  providerOff: { design: null, text: "此环境没有开启邮箱登录，请联系开发者。", cooldown: 0 },
  server: { design: null, text: "服务器这边出了问题，验证码没有发出去，不是你的操作有误。过一会儿再试；多次都不行请联系开发者。", cooldown: 30000 },
  unknown: { design: null, text: "验证码没有发出去，原因暂时不明。稍后再试一次；还不行请联系开发者。", cooldown: 30000 },
};
export const VERIFY_COPY = {
  config: SEND_COPY.config,
  offline: { design: null, text: "现在没有网络，没能完成登录。连上网络后再点“登录”。", cooldown: 0 },
  timeout: { design: null, text: "登录请求超时了，不确定是否已经成功。先再点一次“登录”；如果提示验证码无效，再点“重新发送”拿新的。", cooldown: 0 },
  wrongCode: { design: null, text: "验证码错误或已过期，请检查后重试，或点“重新发送”。", cooldown: 0 },
  rate: { design: null, text: "试得太频繁了，请稍等一会儿再试。", cooldown: "server", fallback: 60000 },
  server: { design: null, text: "服务器这边出了问题，没能完成登录，不是你的操作有误。过一会儿再试。", cooldown: 0 },
  cloudRead: { design: null, text: "验证码对了，但读取云端记录没成功，没有完成登录。稍后再点“登录”。", cooldown: 0 },
  other: { design: null, text: "没能完成登录，原因暂时不明。稍后再试一次；还不行请联系开发者。", cooldown: 0 },
};

// ---------- 分类 ----------
function http(r) { return safeStatus(r?.status); }
export function classifySend(r) {
  if (!r || r.ok) return "";
  if (r.kind === "config") return "config";
  if (r.kind === "network") return r.timedOut ? "timeout" : "offline";
  const st = http(r), code = safeCode(r.errorCode);
  if (code === "over_email_send_rate_limit") return "rateEmail";
  if (code === "over_request_rate_limit") return "rateRequest";
  if (st === 429 || r.kind === "rate-limit") return "rateOther";
  if (code === "email_address_not_authorized") return "notAuthorized";
  if (code === "otp_disabled" || code === "signup_disabled") return "noSignup";
  if (code === "email_address_invalid") return "invalidEmail";
  if (code === "email_provider_disabled") return "providerOff";
  if (st >= 500) return "server";
  return "unknown"; // 其他 4xx / 认不出的码：不编原因
}
export function classifyVerify(r) {
  if (!r || r.ok) return "";
  if (r.kind === "config") return "config";
  if (r.kind === "network") return r.timedOut ? "timeout" : "offline";
  if (r.kind === "rate-limit" || http(r) === 429) return "rate";
  if (r.stage === "verify" && r.kind === "auth") return "wrongCode";
  if (r.stage !== "verify" && r.kind === "auth") return "cloudRead"; // 验证码这一步已过，后面读云端记录被拒
  if (http(r) >= 500) return "server";
  return "other";
}

// ---------- 冷却 ----------
// 取服务器给的真实数字：GoTrue 的 429 消息里常带 “after N seconds”，也可能有 Retry-After 头。
export function serverCooldownMs(r) {
  const fromHeader = Number(r?.retryAfterSec);
  if (Number.isFinite(fromHeader) && fromHeader > 0) return clamp(fromHeader * 1000);
  const m = /after (\d{1,5}) seconds?/i.exec(String(r?.message || ""));
  if (m) return clamp((Number(m[1]) + 1) * 1000); // +1 秒余量，免得刚到点又被拒
  return 0;
}
const clamp = (ms) => Math.min(3600000, Math.max(10000, ms));
function cooldownOf(entry, r) {
  if (entry.cooldown === "server") return serverCooldownMs(r) || entry.fallback;
  return entry.cooldown || 0;
}

// ---------- 对外 ----------
function diagLine(r) {
  if (r?.kind === "network") return r.timedOut ? "诊断：请求超时" : "诊断：网络不通";
  const bits = [];
  const st = http(r), code = safeCode(r?.errorCode);
  if (st) bits.push(`HTTP ${st}`);
  if (code) bits.push(code);
  return bits.length ? "诊断：" + bits.join(" · ") : "";
}
const xpLine = (xp) => (Number.isFinite(xp) && xp > 0 ? `你的 ${Math.floor(xp)} XP 还在这台设备上，没有受影响。` : "");

function build(table, id, r, xp) {
  const e = table[id];
  return { id, design: e.design, text: e.text, diag: diagLine(r), xp: xpLine(xp), cooldownMs: cooldownOf(e, r), uncertainSent: !!e.uncertainSent };
}
export const describeSendError = (r, { xp = 0 } = {}) => (r && !r.ok ? build(SEND_COPY, classifySend(r), r, xp) : null);
export const describeVerifyError = (r, { xp = 0 } = {}) => (r && !r.ok ? build(VERIFY_COPY, classifyVerify(r), r, xp) : null);
