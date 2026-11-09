// 登录弹窗里“发验证码 / 输验证码 / 选择游客进度”失败时的分类、提示文案、诊断行和重试冷却。
// 纯函数，不碰存储、不联网，所以能直接在 Node 里测。编号对应 docs/design/login-sync-ux-spec.md（DESIGN-AUTH-02）：
//   S1a–S6 发验证码失败；V1–V4 输验证码失败；C1 选择游客进度失败。V5、CFG 是规范之外补的两类（见各自注释）。
//
// 规则（AUTH-MAIL-01 / 02）：
//  1. 页面不显示服务器原文。原文只用来“分类”，永远不进界面（msg / message / error_description 都一样）。
//  2. 状态码和错误码经过安全过滤才进诊断行（状态码 100–599 的整数；错误码 ^[a-z0-9_]{3,40}$），过滤不过就不显示。
//  3. 不确定的错误码用保守文案，不编原因；5xx 不等于“邮件额度用完”。
//  4. 登录失败从不改本机进度；游客 XP 大于 0 时每个失败界面都带一行“进度还在这台设备上”。
//  5. 冷却时间优先取服务器给的真实数字（消息里的 after N seconds、Retry-After），没有才用保守默认值。
//  6. 超时 ≠ 断网：超时时邮件可能已经发出，应先去查邮箱，不要马上重发。

// ---------- 过滤 ----------
export const safeStatus = (n) => (Number.isInteger(n) && n >= 100 && n <= 599 ? n : 0);
export const safeCode = (s) => (typeof s === "string" && /^[a-z0-9_]{3,40}$/.test(s) ? s : "");

// ---------- 文案表 ----------
// 键 = 设计规范里的编号。cooldown：ms 数 / "server"（取服务器给的数字，没有就用 fallback）/ 0 不冷却。diag：该类是否显示诊断行。
const IS_PREVIEW = typeof __PREVIEW_ID__ !== "undefined" && !!__PREVIEW_ID__;
const fmtWait = (sec) => (sec <= 90 ? `${sec} 秒` : `约 ${Math.ceil(sec / 60)} 分钟`);
export const SEND_COPY = {
  // 规范之外：云端没配置（登录入口本来就不会出现，防御用）
  CFG: { text: () => "云端暂未开通，现在只能在这台设备上学习。", cooldown: 0, diag: false },
  S1a: { text: () => "没连上网络，验证码没发出去。联网后再点「发送验证码」。", cooldown: 0, diag: false },
  S1b: { text: () => "网络不稳，没等到回应。验证码可能已经发出，先看看邮箱（含垃圾邮件）。", cooldown: 0, diag: false },
  S2: { text: (c) => `刚刚已经发过验证码，请等 ${fmtWait(c.n)}再发。先看看邮箱（含垃圾邮件），验证码还能用。`, cooldown: "server", fallback: 60000, diag: false, secondary: "enter-code" },
  S3: { text: () => "登录邮件发得太多，暂时发不出验证码。请过一会儿再试，最久可能要等一小时。", cooldown: 300000, diag: false },
  S4: { text: (c) => "邮件服务暂时出问题，验证码没发出去。不是你的操作有误，过几分钟再试。" + (c.fails >= 3 ? "先继续学习，晚点再登录也行。" : ""), cooldown: 0, diag: true },
  S5: { text: () => "这个邮箱暂时收不到登录验证码。请换一个邮箱试试。", cooldown: 0, diag: true },
  S5t: { text: () => "这个邮箱不在测试名单里。测试入口只允许指定邮箱登录。", cooldown: 0, diag: true },
  S6: { text: () => "验证码没发出去。请检查邮箱地址，或稍后再试。仍不行请截图下方诊断信息。", cooldown: 0, diag: true },
};
export const VERIFY_COPY = {
  CFG: SEND_COPY.CFG,
  V1: { text: () => "验证码错误或已过期，请检查后重试，或点“重新发送”。", cooldown: 0, diag: false },
  V2: { text: (c) => `输入得太频繁了，请等 ${fmtWait(c.n)}再试。`, cooldown: "server", fallback: 60000, diag: false },
  V3: { text: () => "网络不稳，登录没有确认。再点一次「登录」；如果提示验证码无效，点「重新发送」换新的。", cooldown: 0, diag: false },
  V4: { text: () => "登录服务暂时出问题，请等几分钟再点「登录」。", cooldown: 0, diag: true },
  // 规范之外：验证码这一步通过了，但随后读云端记录被拒（401/403）。不能说成“验证码错”，也不能说登录成功。
  V5: { text: () => "验证码对了，但读取云端记录没成功，没有完成登录。稍后再点「登录」。", cooldown: 0, diag: true },
};
export const CHOICE_COPY = {
  C1: { text: () => "没有处理完。你的游客进度原样留在这台设备上，可以再试一次。", cooldown: 0, diag: false },
  C1d: { text: () => "没有处理完。你的游客进度原样留在这台设备上，可以再试一次。", cooldown: 0, diag: true }, // 数据类失败才带诊断行
};
// 状态栏 / 提示条里的同步失败（Y3b/Y3c/Y3d）和通用提示，同样不显示原文。
export const SYNC_COPY = {
  Y3b: "云端请求太频繁，稍后会自动重试。",
  Y3c: "云端暂时出问题，稍后会自动重试。进度还在这台设备上。",
  Y3d: "云端的进度记录读不出来，同步已暂停。你的进度没有动，请截图下面的诊断信息发给我们。",
  AUTH: "登录状态有问题，请重新登录。进度还在这台设备上。",
  GENERIC: "这次没有成功，请稍后再试。进度还在这台设备上。",
};

// ---------- 分类（规范 §2.5，按顺序匹配）----------
const http = (r) => safeStatus(r?.status);
const msgOf = (r) => String(r?.message || "");
const secondsFromMessage = (r) => { const m = /(\d{1,5})\s*seconds?/i.exec(msgOf(r)); return m ? Number(m[1]) : 0; };
// 服务器给的真实等待秒数：Retry-After 优先，其次消息里的 “after N seconds”。没有返回 0。
export function serverWaitSec(r) {
  const h = Number(r?.retryAfterSec);
  if (Number.isFinite(h) && h > 0) return Math.min(3600, Math.max(1, Math.round(h)));
  const n = secondsFromMessage(r);
  return n > 0 ? Math.min(3600, n) : 0;
}
const S5_CODES = new Set(["email_address_not_authorized", "email_address_invalid", "signup_disabled", "otp_disabled"]);
export function classifySend(r, { preview = IS_PREVIEW } = {}) {
  if (!r || r.ok) return "";
  if (r.kind === "config") return "CFG";
  if (r.kind === "network") return r.offline ? "S1a" : "S1b";
  const st = http(r), code = safeCode(r.errorCode);
  if (st === 429 || r.kind === "rate-limit" || code === "over_email_send_rate_limit" || code === "over_request_rate_limit") {
    if (serverWaitSec(r) > 0 || code === "over_request_rate_limit") return "S2";
    return "S3";
  }
  if (S5_CODES.has(code) || /not authorized|Signups not allowed/i.test(msgOf(r))) return preview ? "S5t" : "S5";
  if (st >= 500 || /Error sending .* email/i.test(msgOf(r))) return "S4";
  return "S6"; // 其他 4xx / 认不出的码：不编原因
}
export function classifyVerify(r) {
  if (!r || r.ok) return "";
  if (r.kind === "config") return "CFG";
  if (r.kind === "network") return "V3";
  if (r.kind === "rate-limit" || http(r) === 429) return "V2";
  if (r.stage === "verify" && r.kind === "auth") return "V1";
  if (http(r) >= 500) return "V4";
  if (r.stage !== "verify" && r.kind === "auth") return "V5";
  return "V4"; // 认不出的：按服务故障处理（保守文案 + 诊断行）
}

// ---------- 对外 ----------
function diagLine(r) {
  const st = http(r), code = safeCode(r?.errorCode) || safeCode(r?.code);
  const head = st ? String(st) : r?.kind === "network" ? "断网" : r?.kind === "data" ? "数据" : "";
  const bits = [head, code].filter(Boolean);
  return bits.length ? "诊断：" + bits.join(" · ") : "";
}
const xpLine = (xp) => (Number.isFinite(xp) && xp > 0 ? `你的 ${Math.floor(xp)} XP 还在这台设备上，没有受影响。` : "");
const clampMs = (ms) => Math.min(3600000, Math.max(10000, ms));

function build(table, id, r, { xp = 0, fails = 1 } = {}) {
  const e = table[id];
  const n = serverWaitSec(r) || (id === "S2" || id === "V2" ? 60 : 0);
  const cd = id === "S4" ? (fails >= 3 ? 300000 : 30000) : e.cooldown === "server" ? clampMs((serverWaitSec(r) ? serverWaitSec(r) + 1 : e.fallback / 1000) * 1000) : e.cooldown || 0;
  return {
    id, design: id, text: e.text({ n, fails }), diag: e.diag ? diagLine(r) : "", xp: xpLine(xp),
    cooldownMs: cd, uncertainSent: id === "S1b" && r?.timedOut === true, secondary: e.secondary || "",
    // 倒计时按钮上的字样（规范 §2.3 第 6 条）
    cooldownLabel: id === "S2" ? "可再发" : id === "S3" ? "约 5 分钟后可再试" : id === "S4" ? (fails >= 3 ? "约 5 分钟后可再试" : "30 秒后可再试") : "",
  };
}
export const describeSendError = (r, o = {}) => (r && !r.ok ? build(SEND_COPY, classifySend(r, o), r, o) : null);
export const describeVerifyError = (r, o = {}) => (r && !r.ok ? build(VERIFY_COPY, classifyVerify(r), r, o) : null);
export function describeChoiceError(r, o = {}) {
  if (!r || r.ok) return null;
  return build(CHOICE_COPY, r.kind === "data" ? "C1d" : "C1", r, o);
}

// ---------- 同步状态 / 提示条里的失败 ----------
// 只在文字里没有英文单词（4 个及以上连续字母）、且有汉字时，才认为是应用自己写的中文，可以原样显示；
// 其余一律视为可能来自服务器，换成通用文案。
export const isOwnChinese = (m) => typeof m === "string" && /[一-鿿]/.test(m) && !/[A-Za-z]{4,}/.test(m);
export function safeMessage(m, fallback = SYNC_COPY.GENERIC) { return isOwnChinese(m) ? m : fallback; }
// 同步失败（状态值 error）在状态栏里的文字。detail = { kind, status, errorCode, code }。返回 { text, diag }。
export function syncErrorText(message, detail = null) {
  const r = detail || {};
  if (r.kind === "rate-limit" || http(r) === 429) return { text: SYNC_COPY.Y3b, diag: "" };
  if (r.kind === "data") return { text: SYNC_COPY.Y3d, diag: diagLine(r) };
  if (r.kind === "auth") return { text: SYNC_COPY.AUTH, diag: "" };
  if (http(r) >= 500 || r.kind === "server") return { text: SYNC_COPY.Y3c, diag: diagLine(r) };
  if (isOwnChinese(message)) return { text: message, diag: "" };
  return { text: SYNC_COPY.GENERIC, diag: "" };
}
