// Supabase 的最小客户端（只用 fetch，不依赖 SDK）：邮箱验证码登录 + 读取 / 保存进度。fetch 可以注入，所以能在 Node 里用假服务器测试。
// 每个方法都返回 { ok:true, ... } 或 { ok:false, kind, message }，kind：
//   "network" 连不上（离线 / 超时）；"auth" 登录失效或验证码不对；"rate-limit" 请求太频繁；"server" 其他服务器错误；"config" 没配置。
export function createApi({ url, anonKey, fetchFn = (...a) => fetch(...a), timeoutMs = 15000 }) {
  const base = String(url || "").replace(/\/+$/, "");
  const configured = !!(base && anonKey);

  async function req(path, { method = "GET", body, token, query } = {}) {
    if (!configured) return { ok: false, kind: "config", message: "云端暂未开通" };
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let resp;
    try {
      resp = await fetchFn(base + path + (query ? "?" + query : ""), {
        method, signal: ctl?.signal,
        headers: { apikey: anonKey, Authorization: "Bearer " + (token || anonKey), "Content-Type": "application/json" },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch (e) {
      return { ok: false, kind: "network", message: "网络连不上，请检查网络后重试" };
    } finally { if (timer) clearTimeout(timer); }
    let data = null;
    const text = await resp.text().catch(() => "");
    if (text) { try { data = JSON.parse(text); } catch { data = text; } }
    if (resp.ok) return { ok: true, status: resp.status, data };
    const msg = (data && (data.msg || data.message || data.error_description || data.error)) || `服务器返回 ${resp.status}`;
    const kind = resp.status === 429 ? "rate-limit" : resp.status === 401 || resp.status === 403 ? "auth" : "server";
    return { ok: false, kind, status: resp.status, message: String(msg) };
  }

  const toSession = (d) => d && d.access_token && d.user?.id ? {
    accessToken: d.access_token, refreshToken: d.refresh_token,
    expiresAt: Number.isFinite(d.expires_at) ? d.expires_at * 1000 : Date.now() + (d.expires_in ?? 3600) * 1000,
    userId: d.user.id, email: d.user.email || "",
  } : null;

  return {
    configured,
    async sendCode(email) {
      const r = await req("/auth/v1/otp", { method: "POST", body: { email, create_user: true } });
      return r.ok ? { ok: true } : r;
    },
    async verifyCode(email, code) {
      const r = await req("/auth/v1/verify", { method: "POST", body: { type: "email", email, token: String(code).trim() } });
      if (!r.ok) return r.kind === "server" && r.status && r.status < 500 ? { ...r, kind: "auth" } : r;
      const session = toSession(r.data);
      return session ? { ok: true, session } : { ok: false, kind: "server", message: "登录返回的内容无法识别" };
    },
    async refresh(session) {
      const r = await req("/auth/v1/token", { method: "POST", query: "grant_type=refresh_token", body: { refresh_token: session.refreshToken } });
      if (!r.ok) return r.kind === "server" && r.status && r.status < 500 ? { ...r, kind: "auth" } : r;
      const s = toSession(r.data);
      return s ? { ok: true, session: s } : { ok: false, kind: "server", message: "刷新登录返回的内容无法识别" };
    },
    // scope：local 只结束这台设备的会话；global（Supabase 默认）会撤销该用户所有设备的 refresh token，所以默认用 local。
    async signOut(session, scope = "local") {
      const sc = scope === "global" || scope === "others" ? scope : "local";
      const r = await req("/auth/v1/logout", { method: "POST", token: session.accessToken, query: "scope=" + sc });
      return r.ok ? { ok: true } : r;
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
