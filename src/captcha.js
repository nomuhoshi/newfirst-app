// D：登录前的人机验证（Cloudflare Turnstile）客户端。
// 设计要点（每条都有对应测试，见 tests/captcha.test.mjs）：
//  1. 没有站点密钥（siteKey 为空）= 功能完全关闭：不加载脚本、不建节点、getToken 直接返回 { ok:true, token:"" }，调用方走旧路径。
//  2. 令牌只对“这一次请求”有效：不缓存、不保存、不写日志、不进诊断。每次 getToken 前先 reset，拿到的令牌用完（无论成败）调用方必须 reset。
//  3. 失败分类固定、不带原文：unavailable（脚本没加载出来 / 被拦）、timeout、error（组件报错，只带过滤后的短错误码）、expired（令牌过期）、busy（上一次还没结束）。
//  4. 任何路径都不会让界面永远卡住：脚本加载和取令牌各有超时。
//  5. 组件挂在调用方给的容器里（交互式挑战需要可见），destroy 时移除。
const SCRIPT_URL = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
const SAFE_CODE = /^[0-9a-zA-Z_-]{1,24}$/;
const safeCode = (c) => (typeof c === "string" || typeof c === "number") && SAFE_CODE.test(String(c)) ? String(c) : "";

export function createCaptcha({ siteKey = "", win = typeof window !== "undefined" ? window : undefined, doc = typeof document !== "undefined" ? document : undefined, loadTimeoutMs = 15000, tokenTimeoutMs = 30000, scriptUrl = SCRIPT_URL } = {}) {
  const key = typeof siteKey === "string" ? siteKey.trim() : "";
  const enabled = !!key;
  let widgetId = null, container = null, loading = null, pending = null, destroyed = false;

  const fail = (reason, code) => ({ ok: false, reason, ...(safeCode(code) ? { code: safeCode(code) } : {}) });

  function loadScript() {
    if (win?.turnstile) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (done) return; done = true; clearTimeout(t); if (!ok) loading = null; resolve(ok); };
      const t = setTimeout(() => finish(false), loadTimeoutMs);
      try {
        const s = doc.createElement("script");
        s.src = scriptUrl; s.async = true; s.defer = true; s.setAttribute("data-captcha-script", "");
        s.onload = () => finish(!!win?.turnstile);
        s.onerror = () => finish(false);
        (doc.head || doc.documentElement).appendChild(s);
      } catch { finish(false); }
    });
    return loading;
  }

  function settle(result) { const p = pending; pending = null; if (p) { clearTimeout(p.timer); p.resolve(result); } }

  function ensureWidget(mount) {
    if (widgetId !== null && container && container.isConnected !== false && (!mount || container.parentNode === mount)) return true;
    if (widgetId !== null) { try { win.turnstile.remove(widgetId); } catch { /* 忽略 */ } widgetId = null; }
    container = doc.createElement("div"); container.setAttribute("data-captcha-widget", "");
    (mount || doc.body).appendChild(container);
    try {
      widgetId = win.turnstile.render(container, {
        sitekey: key, execution: "execute", appearance: "interaction-only", retry: "never", "refresh-expired": "manual",
        callback: (token) => settle(typeof token === "string" && token ? { ok: true, token } : fail("error")),
        "error-callback": (code) => { settle(fail("error", code)); return true; },
        "expired-callback": () => settle(fail("expired")),
        "timeout-callback": () => settle(fail("timeout")),
      });
    } catch { widgetId = null; return false; }
    return widgetId !== null && widgetId !== undefined;
  }

  return {
    enabled,
    // mount：放组件的容器（交互式挑战需要可见）。返回 { ok:true, token } 或 { ok:false, reason, code? }
    async getToken({ mount } = {}) {
      if (!enabled) return { ok: true, token: "" };
      if (destroyed) return fail("unavailable");
      if (pending) return fail("busy");
      if (!(await loadScript())) return fail("unavailable");
      if (destroyed || !ensureWidget(mount)) return fail("unavailable");
      try { win.turnstile.reset(widgetId); } catch { /* 忽略 */ }
      return new Promise((resolve) => {
        const timer = setTimeout(() => settle(fail("timeout")), tokenTimeoutMs);
        pending = { resolve, timer };
        try { win.turnstile.execute(widgetId); } catch { settle(fail("error")); }
      });
    },
    // 令牌一次性：每次请求用完（成功或失败）都调用，让下一次重新取
    reset() {
      if (pending) settle(fail("cancelled"));
      if (widgetId !== null && win?.turnstile) { try { win.turnstile.reset(widgetId); } catch { /* 忽略 */ } }
    },
    // 界面换页（搬动挂载点会让嵌入框架重载）：拆掉当前组件，下次 getToken 重新建；不影响后续使用
    release() { teardown(); },
    destroy() { destroyed = true; teardown(); },
  };
  function teardown() {
    if (pending) settle(fail("cancelled"));
    if (widgetId !== null && win?.turnstile) { try { win.turnstile.remove(widgetId); } catch { /* 忽略 */ } }
    widgetId = null;
    if (container?.parentNode) container.parentNode.removeChild(container);
    container = null;
  }
}
