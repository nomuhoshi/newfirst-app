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

// 复制诊断用：最近一次人机验证失败的“原因（固定枚举）+ 过滤后的短错误码”。只在内存里，只给“复制诊断”看，不进页面文字、不进存档、不带令牌 / 邮箱 / 原文。
// 成功取到令牌后清空；cancelled（取到令牌后的正常 reset）和 busy（重复点击）不算失败。
const FAIL_REASONS = new Set(["unavailable", "timeout", "error", "expired"]);
let lastFailure = null;
export const getLastCaptchaFailure = () => (lastFailure ? { ...lastFailure } : null);
export const resetCaptchaFailure = () => { lastFailure = null; };
export const captchaDiagLine = (f = lastFailure) => (f && FAIL_REASONS.has(f.reason) ? `人机验证最近一次失败：${f.reason}${f.code ? `（错误码 ${f.code}）` : ""}` : "");

export function createCaptcha({ siteKey = "", win = typeof window !== "undefined" ? window : undefined, doc = typeof document !== "undefined" ? document : undefined, loadTimeoutMs = 15000, tokenTimeoutMs = 30000, scriptUrl = SCRIPT_URL } = {}) {
  const key = typeof siteKey === "string" ? siteKey.trim() : "";
  const enabled = !!key;
  let widgetId = null, container = null, loading = null, pending = null, destroyed = false;

  const fail = (reason, code) => ({ ok: false, reason, ...(safeCode(code) ? { code: safeCode(code) } : {}) });
  // 只有“真的有一次取令牌失败了”才记：等待中的请求被失败结算，或取令牌前就失败（脚本没加载 / 组件建不出来）。没有等待请求时的过期回调、destroy 后的拒绝、cancelled、busy 都不记。
  const rec = (r) => { if (!r.ok && FAIL_REASONS.has(r.reason)) lastFailure = { reason: r.reason, ...(r.code ? { code: r.code } : {}) }; return r; };

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

  function settle(result) { const p = pending; pending = null; if (p) { clearTimeout(p.timer); if (result.ok) lastFailure = null; else rec(result); p.resolve(result); } }

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
      if (!(await loadScript())) return rec(fail("unavailable"));
      if (destroyed) return fail("unavailable");
      if (!ensureWidget(mount)) return rec(fail("unavailable"));
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
