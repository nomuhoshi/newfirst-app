// Supabase 的最小客户端（只用 fetch，不依赖 SDK）：邮箱验证码登录 + 读取 / 保存进度。fetch 可以注入，所以能在 Node 里用假服务器测试。
// 每个方法都返回 { ok:true, ... } 或 { ok:false, kind, message }，kind：
//   "network" 连不上（离线 / 超时）；"auth" 登录失效或验证码不对；"rate-limit" 请求太频繁；"server" 其他服务器错误；"config" 没配置。
const SESSION_GONE_CODES = new Set(["session_not_found", "user_not_found", "session_expired"]);
function classifySignOutFailure(r) {
  if (r.status !== 401 && r.status !== 403 && r.status !== 404) return null;
  const code = r.errorCode || "";
  if (SESSION_GONE_CODES.has(code)) return "gone";
  if (code === "bad_jwt") return "token-invalid";
  // 老版本 GoTrue 没有 error_code：只认 401 + 消息明确说 JWT / token 无效或过期
  if (!code && r.status === 401 && /(jwt|token)[^]*(invalid|expired|malformed)|(invalid|expired|malformed)[^]*(jwt|token)/i.test(String(r.message || ""))) return "token-invalid";
  return null;
}

// 刷新失败里，哪些明确证明“这个刷新令牌 / 会话已经死了”（GoTrue RefreshTokenGrant 的 400，错误码 refresh_token_not_found /
// refresh_token_already_used / session_not_found / session_expired）。通用 403、路由 404、OAuth invalid_request（空令牌）、
// validation_failed（格式不对 / 不是本服务签发）、429、5xx 都不是。
const REFRESH_DEAD_CODES = new Set(["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired"]);
function classifyRefreshFailure(r) {
  if (r.status !== 400 && r.status !== 401 && r.status !== 403) return false;
  if (r.errorCode) return REFRESH_DEAD_CODES.has(r.errorCode); // 有明确错误码就只按错误码判断
  // 老版本 GoTrue 没有 error_code：OAuth invalid_grant，或消息以 "Invalid Refresh Token" 开头
  return r.oauthError === "invalid_grant" || /^Invalid Refresh Token/i.test(String(r.message || ""));
}

// Retry-After：delay-seconds（非负整数）或 HTTP-date。HTTP-date 按 RFC 9110 接受三种格式，都按 UTC 解释（不依赖本地时区，不用 Date.parse 猜）：
//   IMF-fixdate  Sun, 06 Nov 1994 08:49:37 GMT
//   rfc850-date  Sunday, 06-Nov-94 08:49:37 GMT   （两位年份：看起来比现在晚 50 年以上，就当成最近的过去那一年）
//   asctime-date Sun Nov  6 08:49:37 1994          （没有时区，天数前补空格）
// 日期严格校验：月份 / 星期名必须是合法名字，日期必须真实存在（2 月 30 日不行），时分秒不超范围。
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
const WD_SHORT = new Set(["sun", "mon", "tue", "wed", "thu", "fri", "sat"]);
const WD_LONG = new Set(["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"]);
function utcMs(y, mo, d, hh, mi, ss) {
  if (!(hh <= 23 && mi <= 59 && ss <= 59)) return NaN;
  const dt = new Date(0);
  dt.setUTCFullYear(y, mo, d); dt.setUTCHours(hh, mi, ss, 0);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo && dt.getUTCDate() === d ? dt.getTime() : NaN; // 往回读一遍：2 月 30 日会滚到 3 月，对不上就是假日期
}
function parseHttpDate(v, nowMs) {
  let m, y, mo, d, hh, mi, ss;
  if ((m = /^([A-Za-z]{3}), (\d{1,2}) ([A-Za-z]{3}) (\d{4}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(v))) {
    if (!WD_SHORT.has(m[1].toLowerCase())) return NaN;
    [d, mo, y, hh, mi, ss] = [+m[2], MONTHS[m[3].toLowerCase()], +m[4], +m[5], +m[6], +m[7]];
  } else if ((m = /^([A-Za-z]{6,9}), (\d{2})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2}):(\d{2}) GMT$/.exec(v))) {
    if (!WD_LONG.has(m[1].toLowerCase())) return NaN;
    [d, mo, hh, mi, ss] = [+m[2], MONTHS[m[3].toLowerCase()], +m[5], +m[6], +m[7]];
    const yy = +m[4]; y = Math.floor(new Date(nowMs).getUTCFullYear() / 100) * 100 + yy;
    const t = utcMs(y, mo, d, hh, mi, ss);
    if (Number.isFinite(t) && t > nowMs + 50 * 365.2425 * 86400_000) y -= 100; // 比现在晚 50 年以上 → 最近的过去那一年
  } else if ((m = /^([A-Za-z]{3}) ([A-Za-z]{3}) ([ \d]\d) (\d{2}):(\d{2}):(\d{2}) (\d{4})$/.exec(v))) {
    if (!WD_SHORT.has(m[1].toLowerCase())) return NaN;
    [mo, d, hh, mi, ss, y] = [MONTHS[m[2].toLowerCase()], +m[3].trim(), +m[4], +m[5], +m[6], +m[7]];
  } else return NaN;
  if (mo === undefined) return NaN;
  return utcMs(y, mo, d, hh, mi, ss);
}
// 返回 { present, valid, sec }：缺失 / 空串 → present:false；格式不对（负数、小数、乱码、不是上面三种日期）→ present:true, valid:false；
// 合法 → valid:true，sec = 还要等的整数秒（日期已过期 = 0；超大数字按 Number.MAX_SAFE_INTEGER，由调用方决定怎么等）。
export function parseRetryAfter(raw, nowMs = Date.now()) {
  if (raw === null || raw === undefined) return { present: false };
  const v = String(raw).trim();
  if (!v) return { present: false };
  if (/^\d+$/.test(v)) { const n = Number(v); return { present: true, valid: true, sec: Number.isFinite(n) ? Math.min(n, Number.MAX_SAFE_INTEGER) : Number.MAX_SAFE_INTEGER }; }
  if (v.length <= 40) {
    const t = parseHttpDate(v, nowMs);
    if (Number.isFinite(t)) return { present: true, valid: true, sec: Math.max(0, Math.ceil((t - nowMs) / 1000)) };
  }
  return { present: true, valid: false };
}

export function createApi({ url, anonKey, fetchFn = (...a) => fetch(...a), timeoutMs = 15000, now = () => Date.now(), isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false }) {
  const base = String(url || "").replace(/\/+$/, "");
  const configured = !!(base && anonKey);

  async function req(path, { method = "GET", body, token, query } = {}) {
    if (!configured) return { ok: false, kind: "config", message: "云端暂未开通" };
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    let timedOut = false; // 自己的超时计时器触发的中止，要和断网区分开（超时时邮件可能已经发出）
    // 超时覆盖“拿到响应头 + 读完响应体”的全过程：响应头到了、正文却一直不来时（弱网 / 半开连接），也要在时限到时结束，
    // 否则调用方（登录弹窗、同步）会一直停在“处理中”。计时器只在整个请求结束时（finally）才清掉。
    let onTimeout = () => {};
    const timeoutP = new Promise((res) => { onTimeout = res; });
    const timer = ctl ? setTimeout(() => { timedOut = true; ctl.abort(); onTimeout(); }, timeoutMs) : null;
    const netFail = () => ({ ok: false, kind: "network", message: "网络连不上，请检查网络后重试", ...(timedOut ? { timedOut: true } : !isOnline() ? { offline: true } : {}) });
    try {
      let resp;
      try {
        resp = await fetchFn(base + path + (query ? "?" + query : ""), {
          method, signal: ctl?.signal,
          headers: { apikey: anonKey, Authorization: "Bearer " + (token || anonKey), "Content-Type": "application/json" },
          body: body === undefined ? undefined : JSON.stringify(body),
        });
      } catch (e) {
        return netFail();
      }
      let data = null;
      // 正文读取和超时赛跑：真实 fetch 被中止后 text() 会自己报错，但不依赖这一点（假接口 / 个别浏览器可能不响应中止信号）。
      // 读正文本身失败（连接中途断了等）要和“正文是空的”分开：成功状态码 + 正文读失败 = 没拿到结果，不能当成功（否则 {ok:true,data:null} 会被当成“云端没有记录”）。
      const TIMED_OUT = Symbol("timeout");
      const readBody = () => resp.text().then((t) => ({ t }), () => ({ failed: true }));
      const got = await (ctl ? Promise.race([readBody(), timeoutP.then(() => TIMED_OUT)]) : readBody());
      if (got === TIMED_OUT || timedOut) return netFail();
      if (got.failed && resp.ok) return netFail();
      const text = got.failed ? "" : got.t; // 非 2xx 且正文读失败：还是按状态码归类（503 仍是 server）
      if (text) { try { data = JSON.parse(text); } catch { data = text; } }
      if (resp.ok) return { ok: true, status: resp.status, data };
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `服务器返回 ${resp.status}`;
      const kind = resp.status === 429 ? "rate-limit" : resp.status === 401 || resp.status === 403 ? "auth" : "server";
      const errorCode = data && typeof data === "object" && typeof data.error_code === "string" ? data.error_code : undefined;
      const oauthError = data && typeof data === "object" && typeof data.error === "string" ? data.error : undefined; // 老版本 / OAuth 风格：{ error: "invalid_grant", error_description }
      const ra = parseRetryAfter(typeof resp.headers?.get === "function" ? resp.headers.get("retry-after") : null, now()); // 秒数或 HTTP 日期；缺失 / 非法都不带 retryAfterSec，调用方走保底等待
      return { ok: false, kind, status: resp.status, message: String(msg), ...(errorCode ? { errorCode } : {}), ...(oauthError ? { oauthError } : {}), ...(ra.valid ? { retryAfterSec: ra.sec } : {}) };
    } finally { if (timer) clearTimeout(timer); }
  }

  const toSession = (d) => d && d.access_token && d.user?.id ? {
    accessToken: d.access_token, refreshToken: d.refresh_token,
    expiresAt: Number.isFinite(d.expires_at) ? d.expires_at * 1000 : Date.now() + (d.expires_in ?? 3600) * 1000,
    userId: d.user.id, email: d.user.email || "",
  } : null;

  return {
    configured,
    // captchaToken（可选）：人机验证令牌，只对“这一次”请求有效——不缓存、不保存、不写进日志或诊断；
    // 非空字符串才放进 gotrue_meta_security.captcha_token，其余（不传 / 空 / 非字符串）= 旧行为，请求体和以前完全一样。
    async sendCode(email, captchaToken) {
      const token = typeof captchaToken === "string" ? captchaToken.trim() : "";
      const r = await req("/auth/v1/otp", { method: "POST", body: { email, create_user: true, ...(token ? { gotrue_meta_security: { captcha_token: token } } : {}) } });
      return r.ok ? { ok: true } : r;
    },
    async verifyCode(email, code) {
      const r = await req("/auth/v1/verify", { method: "POST", body: { type: "email", email, token: String(code).trim() } });
      if (!r.ok) return { ...(r.kind === "server" && r.status && r.status < 500 ? { ...r, kind: "auth" } : r), stage: "verify" }; // stage：这是“验证码这一步”失败，和登录后读云端记录失败区分
      const session = toSession(r.data);
      return session ? { ok: true, session } : { ok: false, kind: "server", message: "登录返回的内容无法识别" };
    },
    async refresh(session) {
      const r = await req("/auth/v1/token", { method: "POST", query: "grant_type=refresh_token", body: { refresh_token: session.refreshToken } });
      if (!r.ok) {
        // kind 保持原来的粗分类（<500 的失败都叫 auth，同步那边靠它提示重新登录）；
        // 但“刷新令牌 / 会话是不是真的死了”只看明确的错误码，由 sessionState:"dead" 单独表达，退出流程只认它。
        const base = r.kind === "server" && r.status && r.status < 500 ? { ...r, kind: "auth" } : r;
        return classifyRefreshFailure(r) ? { ...base, sessionState: "dead" } : base;
      }
      const s = toSession(r.data);
      return s ? { ok: true, session: s } : { ok: false, kind: "server", message: "刷新登录返回的内容无法识别" };
    },
    // scope：local 只结束这台设备的会话；global（Supabase 默认）会撤销该用户所有设备的 refresh token，所以默认用 local。
    // 失败时额外给出 sessionState，告诉调用方“这个失败是不是意味着会话已经没了”：
    //   "gone"          服务器明确说这个会话 / 用户已不存在（session_not_found / user_not_found / session_expired）→ 等于已退出
    //   "token-invalid" 服务器说访问令牌（JWT）无效或过期（bad_jwt）→ 访问令牌死了，但 refresh token 的会话还在不在不知道，要再核实
    //   不设置          其他一切（通用 403、路由 404、代理错误、5xx、400、429、没带令牌 401）→ 不能当成已退出
    // 依据：supabase-js(auth-js) 的 _signOut 对 401/403/404 一律按状态码忽略；GoTrue /logout 本身不返回这三种，
    // 它们来自鉴权中间件（bad_jwt / session_not_found / user_not_found 是 403，no_authorization 是 401）。我们收紧为看错误码。
    async signOut(session, scope = "local") {
      const sc = scope === "global" || scope === "others" ? scope : "local";
      const r = await req("/auth/v1/logout", { method: "POST", token: session.accessToken, query: "scope=" + sc });
      if (r.ok) return { ok: true };
      const sessionState = classifySignOutFailure(r);
      return sessionState ? { ...r, sessionState } : r;
    },
    // 读自己的进度（行级权限只会返回自己的那一行）：{ ok:true, row:null | { doc, rev } }
    async getProgress(session) {
      const r = await req("/rest/v1/progress", { token: session.accessToken, query: "select=doc,rev&limit=2" });
      if (!r.ok) return r;
      if (!Array.isArray(r.data) || r.data.length > 1) return { ok: false, kind: "server", message: "读到的进度行数不对" };
      return { ok: true, row: r.data[0] ? { doc: r.data[0].doc, rev: r.data[0].rev } : null };
    },
    // 首次创建：成功 { ok:true, rev:1 }；已存在 { ok:true, rev:null }
    async createProgress(session, doc) {
      const r = await req("/rest/v1/rpc/create_progress", { method: "POST", token: session.accessToken, body: { new_doc: doc } });
      return r.ok ? { ok: true, rev: Number.isInteger(r.data) ? r.data : null } : r;
    },
    // 带版本检查的保存：成功 { ok:true, rev: 新版本 }；被抢先 { ok:true, rev:null }
    async saveProgress(session, expectedRev, doc) {
      const r = await req("/rest/v1/rpc/save_progress", { method: "POST", token: session.accessToken, body: { expected_rev: expectedRev, new_doc: doc } });
      return r.ok ? { ok: true, rev: Number.isInteger(r.data) ? r.data : null } : r;
    },
    async deleteAccount(session) {
      const r = await req("/rest/v1/rpc/delete_my_account", { method: "POST", token: session.accessToken, body: {} });
      return r.ok ? { ok: true } : r;
    },
  };
}
