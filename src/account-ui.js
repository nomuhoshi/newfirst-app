// 登录 / 账号界面：邮箱验证码登录、同步状态、退出、切换账号、删除账号。
// 不直接碰数据：全部通过 sync（src/sync.js）；元素创建函数和弹窗从 app.js 传进来，所以样式和无障碍行为和其他弹窗一致。
import { createCaptcha } from "./captcha.js";
import { describeSendError, describeVerifyError, describeChoiceError, syncErrorText, safeMessage, fmtSendWait, SYNC_COPY } from "./auth-errors.js";

// 同步状态的文字。出错类状态不显示服务器原文（Y3b/Y3c/Y3d）；诊断行只带过滤后的状态码和错误码。
export function statusText(s) {
  const st = s?.status;
  if (st === "import-recovery-required") return "游客导入记录损坏：云端同步已暂停。学习进度仍保存在本机，请保留数据等待恢复处理。";
  if (st === "import-read-failed") return "无法读取游客导入记录：云端同步已暂停。请检查本机存储后重试。";
  if (st === "synced") return "已同步 ✓";
  if (st === "syncing") return "同步中…";
  if (st === "pending") return s?.message && (s.message.includes("本机副本写回") || s.message.includes("本机同步重试计数")) ? s.message : "有进度等待上传（联网后自动同步）";
  if (st === "offline") return "现在离线：进度已存在这台设备，联网后自动同步";
  if (st === "need-login") return "登录已过期，需要重新登录才能同步（进度还在这台设备上）";
  // Y9a：多设备冲突目前没有“选一份留下”的界面（Y9b 需要新的业务逻辑）。至少说清：同步已暂停、本机进度还在、下一步做什么。
  if (st === "conflict") return "这个账号在别处被覆盖过，同步已暂停。你在这台设备上的进度还在，可以继续学习。请先到“我的 → 数据与备份”，在“备份学习记录”里导出进度文件，再联系我们处理。";
  if (st === "pending-local-cleanup") return "账号已在云端删除，但这台设备还没清理完。请不要继续用这个登录。";
  if (st === "error") { const e = syncErrorText(s.message, s.detail); return e.text + (e.diag ? e.diag : ""); }
  return "已登录，正在准备同步…";
}
const ERR = {
  network: "网络连不上，请检查网络后重试。",
  "rate-limit": "云端请求太频繁了，请稍后再试。",
  config: "云端暂未开通。",
};
// 提示条 / 弹窗里的失败文字：应用自己写的中文原样显示，其余（可能是服务器英文原文）换成通用中文，绝不直接显示 r.message。
export const errorText = (r) => {
  if (ERR[r?.kind]) return ERR[r.kind];
  if (r?.kind === "auth") return SYNC_COPY.AUTH;
  if (r?.status >= 500 || r?.kind === "server") return "云端暂时出问题，请稍后再试。进度还在这台设备上。";
  return safeMessage(r?.message, "出错了，请稍后再试。进度还在这台设备上。");
};
// 登录成功但这次没同步上（D1）：不拼接服务器原文。
const syncedToast = (r, okText, notText) => (r.synced ? okText : notText + (r.syncError ? "本机进度仍在，云端同步未完成，联网后会自动补上。" : ""));

const fmtWait = (ms) => fmtSendWait(Math.max(1, Math.ceil(ms / 1000))); // 合法的长等待不截断（小时 / 天），两分钟内精确到秒，和同步层的截止时间一致

// D：人机验证站点密钥只来自构建（测试入口），正式构建为空 = 功能关闭
const BUILD_CAPTCHA_KEY = typeof __CAPTCHA_SITE_KEY__ !== "undefined" ? __CAPTCHA_SITE_KEY__ : "";

export function createAccountUi({ h, button, sheet, icon, showToast, sync, api, getState, onSwitchedIn, onSwitchedOut, rerender, makeCaptcha = () => createCaptcha({ siteKey: BUILD_CAPTCHA_KEY }) }) {
  const statusEls = new Set();
  // 退出 / 切换账号共用一把“处理中”锁：任何一个在跑，退出、切换账号、重新登录、登录入口、删除账号的按钮都禁用（退出还没结束时不让别的账号操作插进来），
  // 重复点击（或点另一个入口）不会再发起第二次操作；处理函数里还有一层兜底（按钮被绕过禁用也不执行）。
  // 锁带所有权标记：只有拿到锁的那次操作结束时才能放锁，旧操作的 finally 不会解掉后来的锁；整个界面只有一份，重新渲染出的新卡片首帧就是禁用的。
  // “退出后接着做的事”（切换账号要打开登录弹窗）由操作返回，放锁之后才执行，不会被自己的锁挡住。
  const LOGOUT_LOCKED = "[data-logout],[data-switch],[data-relogin],[data-login-link],[data-open-login],[data-delete-account]";
  let logoutLock = null;
  let loginDialog = null; // 一个界面只保留一个有效登录弹窗；重复打开沿用原弹窗，不接管它的异步操作
  const setLogoutUi = (b) => { try { for (const el of document.querySelectorAll(LOGOUT_LOCKED)) el.disabled = b; } catch {} };
  const lockedBtn = (b) => { if (logoutLock) b.disabled = true; return b; };
  const withLogoutLock = async (fn) => {
    if (logoutLock) return;
    const mine = {}; logoutLock = mine; setLogoutUi(true);
    let after = null;
    try { after = await fn(); } finally { if (logoutLock === mine) { logoutLock = null; setLogoutUi(false); } }
    if (typeof after === "function") after();
  };
  function refreshStatus() {
    const s = sync.status();
    for (const el of [...statusEls]) { if (el.__shown && !el.isConnected) { statusEls.delete(el); continue; } paint(el, s); }
  }
  function paint(el, s) { el.textContent = statusText(s); el.dataset.status = s.status || ""; if (el.isConnected) el.__shown = true; }

  // ---------- 登录弹窗 ----------
  // 版面（规范 §5.1）：标题、说明、输入、错误区（输入框正下方）、发送按钮（吸底）、先不登录。
  // 键盘弹出时按钮不能被挡：弹窗高度跟着 --app-h（= visualViewport.height），错误区和按钮放在最先看到的位置。
  function openLogin({ reason = "", email: prefill = "" } = {}) {
    if (logoutLock) return; // 退出还在处理中：不打开登录弹窗（按钮已禁用，这里是兜底）
    if (!api.configured) { showToast("云端暂未开通，现在只能在这台设备上学习。"); return; }
    if (loginDialog) return loginDialog.close;
    let busy = false, inChoice = false, finished = false;
    const captcha = makeCaptcha(); // 每次打开登录弹窗一个；关闭（done / 弹窗被移出页面）时销毁
    const mine = { close: null }; loginDialog = mine;
    let loginOp = null, cleanup = () => {};
    const isCurrent = (op = null) => !finished && loginDialog === mine && (!op || loginOp === op);
    const cancelled = () => ({ ok: false, kind: "stale", discarded: true });
    const captchaMount = h("div", { class: "login-captcha", "data-captcha-mount": "" });
    // 发验证码：先取一次性令牌（没开人机验证 = 不取、调用形状和以前完全一致），发完无论成败都作废，下一次（含重发）重新取。
    // 这里不会抛，异常按“发送失败”返回，令牌照样作废（否则调用方的 busy 标志和“发送中…”按钮永远恢复不了）：
    //  · 还没发请求就出错（getToken 抛出 / 被拒绝）→ kind=captcha：邮件确定没发，文案“没发出去”；
    //  · 请求已交出去后 sendCode 抛出 → kind=unknown：邮件可能已发出，文案“暂时无法确认是否发出，请先检查邮件”（S7）。
    // 都不带异常原文。
    const sendWithCaptcha = async (addr, op) => {
      let requested = false;
      try {
        if (!isCurrent(op)) return cancelled();
        if (!captcha.enabled) { requested = true; return await sync.sendCode(addr); }
        const t = await captcha.getToken({ mount: captchaMount });
        if (!isCurrent(op)) return cancelled(); // 取令牌时已取消：不再发验证码，即使注入的组件仍返回成功令牌
        if (!t.ok) return { ok: false, kind: "captcha", reason: t.reason };
        requested = true;
        return await sync.sendCode(addr, t.token);
      } catch {
        return requested ? { ok: false, kind: "unknown" } : { ok: false, kind: "captcha", reason: "error" };
      } finally {
        if (captcha.enabled && isCurrent(op)) captcha.reset();
      }
    };
    const closeLogin = sheet((close) => {
      const box = h("div", { class: "lsheet login", "data-login": "" });
      let email = prefill, cooldownTimer = null, cooldownUntil = 0, verifyUntil = 0, sendLabel = "", s4Fails = 0, kb = false;
      // 冷却按邮箱记账：针对某个邮箱的冷却（刚发过、验证太频繁、超时后的重发等待）不会拦住另一个邮箱；cdEmail 为空表示全局冷却（服务故障 / 总配额）。
      let cdEmail = "", verifyEmail = "";
      const norm = (x) => String(x || "").trim().toLowerCase();
      const cdLeft = (v) => (cooldownUntil > Date.now() && (!cdEmail || cdEmail === norm(v)) ? cooldownUntil - Date.now() : 0);
      const setCooldown = (ms, v, scope) => { cooldownUntil = Date.now() + ms; cdEmail = scope === "email" ? norm(v) : ""; };
      // 发码被限流（含本地挡住）：以同步层给的实际门禁截止时间为准（全局，不标成只针对某个邮箱）。重复点击 / 换邮箱 / 重开弹窗拿到的都是同一个截止时间，不会重新计满。
      const setSendGate = (d, v) => { if (Number.isFinite(d.retryAt)) { cooldownUntil = d.retryAt; cdEmail = ""; } else setCooldown(d.cooldownMs, v, d.scope); };
      // 错误区：一个始终存在的 role=alert 容器，里面最多三层——L1 原因与动作（红）、L2 进度行（灰）、L3 诊断行（灰、等宽）。
      const msg = h("p", { class: "login-msg", "data-login-msg": "" });
      const xpEl = h("p", { class: "login-xp", "data-login-xp": "" });
      const diagEl = h("p", { class: "login-diag", "data-login-diag": "" });
      const feedback = h("div", { class: "login-feedback", role: "alert", "data-login-feedback": "" }, msg, xpEl, diagEl);
      const extra = h("div", { class: "login-extra", "data-login-extra": "" });
      const say = (t, bad = true, more = null) => {
        msg.textContent = t; msg.classList.toggle("bad", bad); diagEl.textContent = more?.diag || ""; xpEl.textContent = more?.xp || ""; extra.replaceChildren();
        box.classList.toggle("has-error", !!t && bad); applyKb();
        if (t && feedback.scrollIntoView) { try { feedback.scrollIntoView({ block: "nearest" }); } catch {} }
      };
      const localXp = () => { try { const x = getState()?.xp; return Number.isFinite(x) ? x : 0; } catch { return 0; } };
      const sayFail = (d) => say(d.text, true, d);
      const done = () => { cleanup(); close(); };
      // 异步调用万一抛异常（不该发生，但发生了不能让“处理中”卡住）：当作“没确认”处理，按钮 / busy 由调用处在 finally 里复位。
      const guarded = async (fn, fallback = { ok: false, kind: "network", message: "网络连不上，请检查网络后重试" }) => { try { return await fn(); } catch { return fallback; } };
      // 键盘判断（规范 §5.1 第 4 条）：可视高度不到窗口高度的 75% 就算键盘弹出，说明文字缩成一行；有错误时说明整段隐藏。
      const desc = h("p", { class: "login-desc", "data-login-desc": "" });
      const descText = () => {
        const xp = localXp();
        if (kb) return xp > 0 ? `你的 ${Math.floor(xp)} XP 保存在这台设备上。不用设密码。` : "不用设密码。";
        const base = reason || "用邮箱登录，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。";
        return xp > 0 ? (reason ? `${reason}你现在的 ${Math.floor(xp)} XP 保存在这台设备上。` : `你现在的 ${Math.floor(xp)} XP 保存在这台设备上。登录后会多存一份到云端，换手机或 iPad 也能接着学。没有账号会自动创建；不用设密码。`) : base;
      };
      function applyKb() {
        const vv = window.visualViewport;
        kb = !!vv && vv.height < window.innerHeight * 0.75;
        box.classList.toggle("kb-open", kb);
        if (inStepEmail || inStepCode) desc.textContent = descText();
      }
      let inStepEmail = false, inStepCode = false, tickNow = () => {};
      const vv = window.visualViewport;
      const onVv = () => { if (!box.isConnected) { cleanup(); return; } applyKb(); };
      vv?.addEventListener("resize", onVv);
      // 取验证码要切到邮件 App：iOS 会暂停后台页面的计时器，回到前台时按时间戳立刻重算（规范 §2.3 第 2 条）
      const onVis = () => { if (!box.isConnected) { cleanup(); return; } if (document.visibilityState === "visible") tickNow(); };
      document.addEventListener("visibilitychange", onVis);
      let focusTimer = null;
      const focusSoon = (input) => {
        clearTimeout(focusTimer);
        focusTimer = setTimeout(() => { focusTimer = null; if (isCurrent() && input.isConnected && !input.disabled) input.focus(); }, 50);
      };
      cleanup = () => {
        if (finished) return;
        finished = true; loginOp = null;
        clearInterval(cooldownTimer); clearTimeout(focusTimer);
        vv?.removeEventListener("resize", onVv);
        document.removeEventListener("visibilitychange", onVis);
        captcha.destroy();
        if (loginDialog === mine) { loginDialog = null; sync.clearVerified?.(); }
      };

      function stepEmail() {
        inStepEmail = true; inStepCode = false; inChoice = false;
        const input = h("input", { class: "login-input", type: "email", inputmode: "email", autocomplete: "email", autocapitalize: "off", spellcheck: "false", placeholder: "you@example.com", "aria-label": "邮箱", "data-email": "" });
        input.value = email;
        const go = button("发送验证码", async () => {
          if (!isCurrent()) return;
          const v = input.value.trim();
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { say("请输入有效的邮箱地址。"); return; }
          if (busy || cdLeft(v) > 0) return; const op = loginOp = {}; busy = true; input.disabled = true; go.disabled = true; go.textContent = "发送中…"; say("正在发送…", false);
          let r; try { r = await guarded(() => sendWithCaptcha(v, op)); } finally { if (isCurrent(op)) { busy = false; input.disabled = false; } }
          if (!isCurrent(op)) return; // 取消 / 重开后，旧结果和 finally 都只属于旧操作
          if (!r.ok) {
            const d0 = describeSendError(r, { xp: localXp(), fails: 1, captchaOn: captcha.enabled });
            s4Fails = d0.id === "S4" ? s4Fails + 1 : 0; // S4 连续失败计数只放内存，成功一次清零
            const d = d0.id === "S4" ? describeSendError(r, { xp: localXp(), fails: s4Fails, captchaOn: captcha.enabled }) : d0;
            if (d.cooldownMs) setSendGate(d, v);
            sendLabel = d.cooldownLabel;
            if (d.uncertainSent) { email = v; setCooldown(60000, v, "email"); stepCode(); sayFail(d); return; } // 超时：邮件可能已发出，直接去输验证码、先查邮箱，不鼓励马上重发
            sayFail(d);
            if (d.secondary === "enter-code") extra.append(button("我已收到，去输入验证码", () => { if (!isCurrent() || busy) return; email = v; stepCode(); }, "btn3d ghost wide", { "data-enter-code": "" }));
            sendTick(); return;
          }
          s4Fails = 0; sendLabel = "";
          email = v; setCooldown(60000, v, "email"); say("");
          stepCode();
        }, "btn3d primary wide", { "data-send-code": "" });
        const sendTick = () => {
          if (!isCurrent()) return;
          const left = cdLeft(input.value);
          input.disabled = busy;
          go.disabled = busy || left > 0;
          go.textContent = busy ? "发送中…" : left > 0 ? (sendLabel === "可再发" ? `${fmtWait(left)}后可再发` : sendLabel || `${fmtWait(left)}后可再发`) : "发送验证码";
          clearInterval(cooldownTimer);
          if (left > 0) cooldownTimer = setInterval(() => { if (!box.isConnected) { cleanup(); return; } sendTick(); if (cdLeft(input.value) <= 0) clearInterval(cooldownTimer); }, 1000);
        };
        tickNow = sendTick;
        sendTick();
        // 改了邮箱：针对旧邮箱的提示（刚发过 / 超时 / 额外按钮）不再适用于新邮箱，清掉并按新邮箱重新算冷却
        input.addEventListener("input", () => { if (!isCurrent()) return; if (!busy && cdEmail && norm(input.value) !== cdEmail && box.classList.contains("has-error")) say(""); sendTick(); });
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        desc.textContent = descText();
        captcha.release(); // 换页会搬动挂载点（嵌入框架会重载），先拆掉旧组件，下次发送时重新建
        box.replaceChildren(
          h("h2", { text: "登录 / 注册" }),
          desc,
          input, feedback,
          ...(captcha.enabled ? [captchaMount] : []),
          h("div", { class: "login-actions" }, go, extra),
          ...(sync.hasLeftoverAuth && sync.hasLeftoverAuth() ? [leftoverButton()] : []),
           button("先不登录", done, "btn3d ghost wide", { "data-login-cancel": "" }),
          privacyNote(),
        );
        focusSoon(input);
      }
      // 上次退出时云端已撤销、但这台设备的登录凭证没清掉：给一个再次清理的入口（不联网，读回确认才算成功）
      function leftoverButton() {
        const b = button("清理本机残留的登录凭证", async () => {
          if (!isCurrent()) return;
          b.disabled = true;
          const r = await sync.retryAuthCleanup();
          if (!isCurrent()) return;
          if (r.ok) { b.remove(); say(r.nothingToClean ? "没有发现需要清理的登录凭证。" : "已清理本机残留的登录凭证。", false); } else { b.disabled = false; say(safeMessage(r.message, "还是没清掉，请检查浏览器的存储权限后再试。")); }
        }, "btn3d ghost wide", { "data-clean-auth": "" });
        return b;
      }

      function stepCode() {
        inStepEmail = false; inStepCode = true; inChoice = false;
        let resends = 0;
        let retryMode = false; // 验证码已通过、但读云端记录失败：「登录」按钮变成「重试读取」，只重读云端，不再提交验证码
        let readUntil = 0; // 重试读取被 429 限流：这个时间之前「重试读取」禁用并显示倒计时（sync.retryRead 在里面也会挡，两层都不会发请求）
        let changeEmail, leaveCode;
        const input = h("input", { class: "login-input code", type: "text", inputmode: "numeric", pattern: "[0-9]*", autocomplete: "one-time-code", maxlength: "10", placeholder: "验证码", "aria-label": "邮箱验证码", "data-code": "" });
        const resend = button("重新发送", async () => {
          if (!isCurrent()) return;
          if (cdLeft(email) > 0 || busy) return;
          if (retryMode) { retryMode = false; readUntil = 0; go.textContent = "登录"; } // 重发 = 换新验证码：之前已验证的会话作废（sync.sendCode 里会清）
          const op = loginOp = {}; busy = true; resend.disabled = true; resend.textContent = "发送中…"; tick();
          let r; try { r = await guarded(() => sendWithCaptcha(email, op)); } finally { if (isCurrent(op)) busy = false; }
          if (!isCurrent(op)) return;
          if (!r.ok) {
            const d0 = describeSendError(r, { xp: localXp(), fails: 1, captchaOn: captcha.enabled });
            s4Fails = d0.id === "S4" ? s4Fails + 1 : 0;
            const d = d0.id === "S4" ? describeSendError(r, { xp: localXp(), fails: s4Fails, captchaOn: captcha.enabled }) : d0;
            if (d.cooldownMs) setSendGate(d, email);
            sayFail(d); tick(); return;
          }
          s4Fails = 0; resends++;
          setCooldown(60000, email, "email"); say("已重新发送。请查收邮件（含垃圾邮件）。", false);
          if (resends >= 2) extra.append(h("p", { class: "login-hint", text: `还是没收到？确认邮箱 ${email} 拼写正确，或点「换个邮箱」。` })); // P2-2
          tick();
        }, "btn3d ghost", { "data-resend": "" });
        const tick = () => {
          if (!isCurrent()) return;
          input.disabled = busy;
          if (changeEmail) changeEmail.disabled = busy;
          if (leaveCode) leaveCode.disabled = busy;
          const left = Math.ceil(cdLeft(email) / 1000);
          if (busy) { resend.disabled = true; go.disabled = true; }
          if (!busy) { resend.disabled = left > 0; resend.textContent = left > 0 ? `重新发送（${fmtWait(left * 1000)}）` : "重新发送"; }
          if (retryMode && !busy) {
            if (sync.hasVerified && !sync.hasVerified()) { // 已验证的会话到期了（等待跨过了到期时间）：不能再重试；不自动重发验证码，只提示去「重新发送」
              retryMode = false; readUntil = 0; go.textContent = "登录";
              sayFail(describeVerifyError({ ok: false, kind: "auth", stage: "read", canRetry: false, expired: true }, { xp: localXp() }));
            } else if (readUntil > 0 && readUntil <= Date.now()) { // 限流等待结束：恢复普通的「重试读取」提示
              readUntil = 0; go.textContent = "重试读取";
              sayFail(describeVerifyError({ ok: false, kind: "other", stage: "read", canRetry: true }, { xp: localXp() }));
            }
          }
          const readLeft = retryMode && readUntil > Date.now() ? Math.ceil((readUntil - Date.now()) / 1000) : 0;
          if (!busy && retryMode) go.textContent = readLeft > 0 ? `重试读取（${readLeft} 秒）` : "重试读取";
          if (!busy && (readLeft > 0 || (verifyUntil > Date.now() && verifyEmail === norm(email)))) go.disabled = true; else if (!busy) go.disabled = false;
        };
        tickNow = tick;
        clearInterval(cooldownTimer); cooldownTimer = setInterval(() => { if (!box.isConnected) { cleanup(); return; } tick(); }, 1000);
        const go = button("登录", async () => {
          if (!isCurrent()) return;
          const c = input.value.replace(/\s+/g, "");
          if (!retryMode && !/^\d{6}$/.test(c)) { say("请输入邮件里的 6 位数字验证码。"); return; }
          if (busy) return;
          if (retryMode && readUntil > Date.now()) { tick(); return; } // 限流等待中：不发任何请求
          const op = loginOp = {}; busy = true; go.disabled = true; go.textContent = retryMode ? "读取中…" : "登录中…"; tick(); say(retryMode ? "正在重试读取…" : "正在登录…", false);
          // 重试读取：不再调用验证接口（验证码是一次性的，已经用掉）；只用 sync 里留着的已验证会话重读云端。
          const wasRetry = retryMode;
          let r; try { r = await guarded(() => (wasRetry ? sync.retryRead(getState()) : sync.verify(email, c, getState())), wasRetry ? { ok: false, kind: "network", stage: "read", canRetry: true, message: "网络连不上，请检查网络后重试" } : undefined); } finally { if (isCurrent(op)) { busy = false; go.disabled = false; go.textContent = retryMode ? "重试读取" : "登录"; } }
          if (!isCurrent(op)) return;
          if (r.discarded) { say(""); tick(); return; } // 这一轮已被换邮箱 / 重发作废：丢掉结果，只清掉“正在…”的提示
          retryMode = r.ok === false && r.stage === "read" && r.canRetry === true; go.textContent = retryMode ? "重试读取" : "登录";
          if (!r.ok) {
            if (r.kind === "other-account" || r.kind === "data" || r.kind === "local") { say(errorText(r)); tick(); return; }
            const d = describeVerifyError(r, { xp: localXp() });
            readUntil = d.id === "V5w" ? Date.now() + r.waitMs : 0;
            if (d.id === "V2") { verifyUntil = Date.now() + d.cooldownMs; verifyEmail = norm(email); if (verifyUntil > cooldownUntil || cdEmail === norm(email)) setCooldown(verifyUntil - Date.now(), email, "email"); }
            sayFail(d); tick();
            if (d.id === "V1") { try { input.focus(); input.select(); } catch {} } // 保留已输入的内容并全选，方便重输
            return;
          }
          if (r.needChoice) { stepChoice(r); return; }
          success(r);
        }, "btn3d primary wide", { "data-verify": "" });
        tick();
        input.addEventListener("keydown", (e) => { if (e.key === "Enter") go.click(); });
        // 改了验证码：说明用户要换一个码，已验证会话作废，按钮回到「登录」
        input.addEventListener("input", () => { if (!isCurrent()) return; if (retryMode && !busy) { retryMode = false; readUntil = 0; sync.clearVerified?.(); go.textContent = "登录"; say(""); tick(); } });
        desc.textContent = "";
        captcha.release();
        changeEmail = button("换个邮箱", () => { if (!isCurrent() || busy) return; sync.clearVerified?.(); say(""); stepEmail(); }, "btn3d ghost wide", { "data-login-change-email": "" });
        leaveCode = button("先不登录", () => { if (isCurrent() && !busy) done(); }, "btn3d ghost wide", { "data-login-cancel": "" });
        box.replaceChildren(
          h("h2", { text: "输入验证码" }),
          h("p", { class: "login-sent", text: `验证码已发到 ${email}。没收到？看看垃圾邮件，或稍等再重新发送。` }),
          input, feedback,
          ...(captcha.enabled ? [captchaMount] : []),
          h("div", { class: "login-actions" }, go, resend, extra),
          changeEmail, leaveCode,
        );
        tick(); focusSoon(input);
      }

      function stepChoice(info) {
        inStepEmail = false; inStepCode = false; inChoice = true;
        const g = `${info.guest.xp} XP、${info.guest.lessons} 关`;
        const btns = [];
        // G3：处理中两个按钮都禁用，点遮罩和 Esc 也不会关掉弹窗；C1：失败后恢复可点，游客进度原样留在这台设备上。
        const pick = async (choice) => {
          if (!isCurrent()) return;
          if (busy) return; busy = true; btns.forEach((b) => { b.disabled = true; }); say("正在上传并核对…", false);
          let r; try { r = await guarded(() => sync.finishChoice(choice)); } finally { if (isCurrent()) { busy = false; btns.forEach((b) => { b.disabled = false; }); } }
          if (!isCurrent()) return;
          if (!r.ok) { sayFail(describeChoiceError(r, { xp: info.guest.xp })); return; }
          success(r);
        };
        const mk = (label, choice, cls) => { const b = button(label, () => pick(choice), cls, { "data-choice": choice }); btns.push(b); return b; };
        const later = button("稍后再说", () => { if (!busy) close(); }, "btn3d ghost wide", { "data-choice-later": "" }); // G4：不处理就关掉；游客进度原样保留，不会自动覆盖云端
        if (!info.cloudHasData) {
          box.replaceChildren(
            h("h2", { text: "转存这台设备上的进度？" }),
            h("p", { text: `这台设备上有没登录时学的进度（${g}）。要放进这个账号吗？` }),
            mk("安全合并到账号", "transfer", "btn3d primary wide"),
            mk("不转存，用全新账号", "cloud", "btn3d wide"),
            h("p", { class: "muted small", text: "安全合并：XP / 次数按设备取较大值，关卡和日期取并集；上传成功并确认云端一致后，游客记录才会清除。不转存则原样保留。" }),
            feedback, later,
          );
        } else {
          box.replaceChildren(
            h("h2", { text: "这个账号已有学习进度" }),
            h("p", { text: `云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${g}）。` }),
            mk("保留云端进度（推荐）", "cloud", "btn3d primary wide"),
            mk("安全合并游客进度", "transfer", "btn3d wide"),
            h("p", { class: "muted small", text: "安全合并不会整份覆盖：其他设备的 XP、关卡、红心和设置都会保留，XP / 次数按设备取较大值，关卡和日期取并集。选“保留云端进度”时游客记录原样保留，只记下它的指纹，之后游客再变才会再次提示。" }),
            feedback, later,
          );
        }
        try { btns[0]?.focus({ preventScroll: true }); } catch {} // 焦点留在弹窗内，Esc / Tab 才有效（原按钮已被替换掉）
      }

      function success(r) {
        done();
        onSwitchedIn(r);
        showToast(syncedToast(r, "登录成功，进度已同步。", "登录成功。"));
      }
      stepEmail();
      return [box];
    }, {
      cls: "login-sheet",
      canClose: () => !busy, // 发送 / 登录 / 处理中不允许点遮罩或按 Esc 关掉
      onClose: () => { const cancelledChoice = inChoice && !finished && loginDialog === mine; cleanup(); if (cancelledChoice) { const x = Math.floor(getState()?.xp ?? 0); showToast("已取消登录。" + (x > 0 ? `你的 ${x} XP 还在这台设备上。` : "你的进度原样留在这台设备上。")); } },
    });
    mine.close = closeLogin;
    return closeLogin;
  }

  // 隐私说明：静态页 privacy.html（不依赖脚本、断网也在离线缓存里）。新标签页打开，不打断登录流程。
  function privacyNote() {
    return h("p", { class: "privacy-note", "data-privacy-note": "" }, "登录即表示你已阅读",
      h("a", { href: "./privacy.html", target: "_blank", rel: "noopener", "data-privacy-link": "" , text: "隐私说明" }), "。");
  }

  function restoreErrorBanner() {
    const issue = sync.restoreError?.();
    if (!issue) return null;
    const box = h("div", { class: "acct-recover", role: "alert", "data-restore-error": issue.code },
      h("h3", { text: "账号记录尚未恢复" }), h("p", { class: "muted", text: issue.message }),
      h("p", { class: "muted small", text: "当前显示本机游客进度。恢复前新做的题先保存在游客记录里，账号副本不会被覆盖。" }));
    if (issue.retryable) {
      const retry = lockedBtn(button("重试恢复", () => {
        if (logoutLock) return;
        retry.disabled = true;
        try {
          const r = sync.retryRestore(getState());
          if (r.stale) { rerender(); return; }
          if (!r.ok) { rerender(); showToast(safeMessage(r.message, "仍无法恢复，请稍后重试。")); return; }
          onSwitchedIn(r.restored);
          showToast("本机账号进度已恢复。");
          sync.syncNow(); // 和启动恢复一样，在应用 state 切换完成后才尝试后台同步。
        } finally { retry.disabled = false; }
      }, "btn3d primary wide", { "data-retry-restore": "" }));
      box.append(retry);
    }
    return box;
  }

  // ---------- “我的”页里的账号卡片 ----------
  function accountCard() {
    const acc = sync.account();
    const card = h("section", { class: "acct-card", "data-account": "" });
    if (!api.configured) {
      card.append(h("h3", { text: "账号" }), h("p", { class: "muted", text: "云端暂未开通：学习进度只保存在这台设备上。" }));
      return card;
    }
    if (!acc) {
      const restoreBanner = restoreErrorBanner();
      if (restoreBanner) card.append(restoreBanner);
      card.append(h("h3", { text: "账号" }), h("p", { class: "muted", text: "登录后，进度会保存到云端，换手机或 iPad 也能接着学。" }),
        lockedBtn(button("邮箱登录 / 注册", () => openLogin(), "btn3d primary wide", { "data-open-login": "" })), privacyNote());
      return card;
    }
    const st = h("p", { class: "acct-status", role: "status", "data-sync-status": "" }); statusEls.add(st);
    const sheetConfirm = (title, body, okLabel, okFn, danger = false) => sheet((close) => [h("div", { class: "lsheet" }, h("h2", { text: title }), h("p", { text: body }),
      button(okLabel, async () => { close(); await okFn(); }, "btn3d wide " + (danger ? "danger" : "primary")), button("取消", close, "btn3d ghost wide"))]);
    // ---------- 损坏的游客导入待办：恢复入口 ----------
    // 确认损坏（corrupt）才给“备份并重新导入”；读取失败（read-failed）只给“重试读取”，绝不隔离。
    // 恢复成功只在隔离确实完成（原文已备份并读回、原待办已删除并读回）之后才说；任何一步失败都如实告诉用户原待办还在。
    function openImportChoice(info) {
      const g = `${info.guest.xp} XP、${info.guest.lessons} 关`;
      let busy = false, closed = false;
      sheet((close) => {
        const box = h("div", { class: "lsheet", "data-import-choice": "" });
        const msg = h("p", { class: "login-msg", role: "alert", "data-choice-msg": "" });
        const controls = [];
        const isActive = () => !closed && box.isConnected;
        const setBusy = (value) => { busy = value; controls.forEach((b) => { b.disabled = value; }); };
        const closeOwn = () => {
          // 旧弹窗收尾时，保留后来弹窗里的焦点；共用 sheet() 的关闭规则不变。
          const focused = document.activeElement;
          const keepFocus = focused?.isConnected && !box.contains(focused);
          close();
          if (keepFocus && focused.isConnected) focused.focus?.({ preventScroll: true });
        };
        const pick = async (choice) => {
          if (!isActive() || busy) return;
          setBusy(true);
          msg.textContent = "正在处理…"; msg.classList.remove("bad");
          let r;
          try { r = await sync.finishChoice(choice); }
          catch { r = { ok: false, kind: "network" }; }
          finally { if (isActive()) setBusy(false); }
          if (!isActive()) return; // 只接收所属弹窗仍有效时的结果
          if (r.stale || r.kind === "session-changed") { closeOwn(); return; }
          if (!r.ok) { msg.textContent = describeChoiceError(r, { xp: info.guest.xp }).text; msg.classList.add("bad"); return; }
          closeOwn(); onSwitchedIn(r);
          showToast(syncedToast(r, "游客进度已处理，已同步。", "游客进度已处理。"));
        };
        const mk = (label, choice, cls) => { const b = button(label, () => pick(choice), cls, { "data-choice": choice }); controls.push(b); return b; };
        const later = button("稍后再说", () => { if (isActive() && !busy) closeOwn(); }, "btn3d ghost wide"); controls.push(later);
        box.append(
          ...(info.cloudHasData
            ? [h("h2", { text: "这个账号已有学习进度" }), h("p", { text: `云端已经有这个账号的进度。这台设备上还有没登录时学的进度（${g}）。` }),
              mk("保留云端进度（推荐）", "cloud", "btn3d primary wide"),
              mk("安全合并游客进度", "transfer", "btn3d wide")]
            : [h("h2", { text: "转存这台设备上的进度？" }), h("p", { text: `这台设备上有没登录时学的进度（${g}）。要放进这个账号吗？` }),
              mk("安全合并到账号", "transfer", "btn3d primary wide"),
              mk("不转存，用全新账号", "cloud", "btn3d wide")]),
          msg, later);
        return [box];
      }, { canClose: () => !busy, onClose: () => { closed = true; } });
    }
    async function runRecovery(digest) {
      const q = await sync.quarantinePendingImport({ expectedDigest: digest });
      if (!q.ok) { showToast(safeMessage(q.message, "没有处理成功，原来的待办还在。")); rerender(); return; }
      showToast("损坏的待办已备份并移除。");
      const r = await sync.resumeGuestImportChoice(getState());
      if (r.stale) return; // G-LOGIN-04：旧恢复结果不再提示、重绘或打开选择框
      if (!r.ok) { showToast("待办已处理，但还没能确认云端：" + errorText(r) + " 点“立即同步”可重试。"); rerender(); return; }
      if (r.needChoice) { rerender(); openImportChoice(r); return; }
      showToast(r.alreadyImported ? "云端已经有这份游客进度，不会重复加分。" : "已同步。"); rerender();
    }
    function recoveryBox() {
      const info = sync.pendingRecoveryInfo();
      if (info.state === "corrupt") {
        return h("div", { class: "acct-recover", "data-recovery": "corrupt" },
          h("p", { class: "muted small", text: "游客导入待办损坏，云端同步已锁定。可以先把损坏的内容备份在本机，再重新确认游客进度怎么处理；游客记录、账号副本和登录都不会被删。" }),
          button("备份并重新导入", () => sheetConfirm("备份损坏的待办？", "会把损坏的待办原文备份在这台设备上（读回确认后才移除原待办），不联网。之后会重新问你游客进度怎么处理，不会重复加分。", "备份并继续", () => runRecovery(info.digest)), "btn3d wide", { "data-quarantine": "" }));
      }
      if (info.state === "read-failed") {
        return h("div", { class: "acct-recover", "data-recovery": "read-failed" },
          h("p", { class: "muted small", text: "现在读不出游客导入待办。这只是读取失败，不能当作损坏，所以不会备份或删除任何东西。请检查浏览器存储权限后重试。" }),
          button("重试读取", async () => { const r = await sync.syncNow({ manual: true }); if (!r.ok) showToast(errorText(r)); rerender(); }, "btn3d wide", { "data-pending-retry": "" }));
      }
      return null;
    }
    // X0：退出后界面回到这台设备的游客记录，合并过的用户会看到 0 XP，所以提示里必须说清账号里的 XP 在云端。
    const syncedBeforeLogout = () => { try { return sync.status().status === "synced"; } catch { return false; } };
    const xpBeforeLogout = () => { try { const x = Math.floor(getState()?.xp ?? 0); return x > 0 ? x : 0; } catch { return 0; } };
    // 只有退出前确认“已同步”，才说账号里的 N XP 在云端；没同步完（待上传 / 离线 / 出错 / 冲突）就只说已同步的在云端、没上传的留在本机，不报数字。
    const loggedOutText = (xp, synced = true) => "已退出登录。" + (synced ? (xp > 0 ? `账号里的 ${xp} XP 在云端，重新登录就回来。` : "") : "已同步的进度在云端；还没上传的进度留在这台设备上，用同一个账号重新登录会接着上传。");
    const doLogout = (then) => withLogoutLock(() => logoutFlow(then));
    async function logoutFlow(then) {
      const xp0 = xpBeforeLogout(), syn0 = syncedBeforeLogout();
      const r = await sync.logout();
      if (r.stale) return; // 这次退出已被别的操作取代（强制退出 / 重新登录）：什么都不做，不再走一次“已退出”
      if (r.ok) { onSwitchedOut(); showToast(r.warning ? safeMessage(r.message, loggedOutText(xp0, syn0)) : loggedOutText(xp0, syn0)); return then; }
      if (r.stayed) sheetConfirm("云端退出失败", "这台设备仍保持登录。已同步的进度在云端；没同步的留在这台设备上，用同一个账号重新登录会接着上传，XP 会回来。可以稍后再试，或只在这台设备退出（云端会话可能仍有效）。", "只在这台设备退出", () => withLogoutLock(async () => {
        const f = await sync.forceLocalLogout();
        if (f.stale) return;
        if (!f.ok) { showToast(safeMessage(f.message, "还没退出。")); return; }
        onSwitchedOut(); showToast(f.warning ? safeMessage(f.message, loggedOutText(xp0, syn0)) : loggedOutText(xp0, syn0)); return then;
      }), true);
      else if (r.kind === "import-corrupt" || r.kind === "import-read-failed") sheetConfirm("游客导入待办需要恢复", "云端同步已锁定，继续学习可保存在本机。仅在本机退出会保留游客记录、损坏待办和未上传账号副本；重新登录后仍需专门恢复，云端会话可能仍有效。", "仅在本机退出", () => withLogoutLock(async () => {
        const f = await sync.forceLocalLogout();
        if (f.stale) return;
        if (!f.ok) { showToast(safeMessage(f.message, "还没退出。")); return; }
        onSwitchedOut(); showToast(safeMessage(f.message, "已在本机退出，数据已保留。")); return then;
      }), true);
      else if (r.pending) sheetConfirm("有进度还没上传", "现在连不上云端。退出后这些进度会先留在这台设备上，用同一个账号重新登录时会接着上传，XP 会回来；建议联网后再退出。", "仍然退出", () => withLogoutLock(async () => {
        const f = await sync.logout({ force: true });
        if (f.stale) return;
        if (!f.ok) { showToast(safeMessage(f.message, "还没退出。")); return; }
        onSwitchedOut(); showToast(f.warning ? safeMessage(f.message, loggedOutText(xp0, false)) : loggedOutText(xp0, false)); return then;
      }), true);
      else showToast(errorText(r));
    }
    card.append(h("h3", { text: "账号" }), h("p", { class: "acct-email", text: acc.email || "已登录" }), st, ...[recoveryBox()].filter(Boolean),
      ...(sync.status().status === "need-login" ? [lockedBtn(button("重新登录", () => openLogin({ reason: "登录已过期，重新登录后会接着上传。", email: acc.email || "" }), "btn3d primary wide", { "data-relogin": "" }))] : []), // Y7
      (() => { const conflict = sync.status().status === "conflict"; const b = button("立即同步", async () => { const r = await sync.syncNow({ manual: true }); if (!r.ok) showToast(errorText(r)); else rerender(); }, "btn3d wide", { "data-sync-now": "" }); if (conflict) { b.disabled = true; b.title = "同步已暂停：这个账号在别处被覆盖过"; } return b; })(),
      (() => { const out = button("退出登录", () => doLogout(), "btn3d", { "data-logout": "" }), sw = button("切换账号", () => doLogout(() => openLogin()), "btn3d", { "data-switch": "" }); lockedBtn(out); lockedBtn(sw); return h("div", { class: "acct-row" }, out, sw); })(),
      lockedBtn(button("删除账号和云端记录", () => { if (logoutLock) return; sheetConfirm("删除账号？", "会永久删除这个账号和云端的学习记录，不能恢复。这台设备上也会退出登录。", "永久删除", async () => {
        if (logoutLock) return; // 退出还在处理中：不并行删除
        const r = await sync.deleteAccount();
        if (r.stale) { showToast(safeMessage(r.message, r.cloudDeleted === true ? "账号已在云端删除。这台设备在删除过程中已退出或换了账号，本机没有改动。" : r.cloudDeleted === null ? "无法确认旧账号是否已删除；当前登录和本机数据未改动。" : "删除没有完成。")); return; } // 删除期间这台设备已退出 / 换了账号：不走“已删除并退出”的回调，不动现在的账号
        if (r.ok) { onSwitchedOut(); showToast("账号已删除。"); }
        else if (r.pendingLocalCleanup) { onSwitchedOut(); showToast(safeMessage(r.message, "账号已在云端删除，但这台设备还没清理完。")); }
        else showToast(errorText(r));
      }, true); }, "btn3d danger-ghost wide", { "data-delete-account": "" })));
    paint(st, sync.status());
    return card;
  }

  // ---------- 地图页上的一行入口 ----------
  function accountRow() {
    if (!api.configured) return null;
    const acc = sync.account();
    if (!acc) { const restoreBanner = restoreErrorBanner(); if (restoreBanner) return restoreBanner; }
    if (!acc) return lockedBtn(button("登录 / 注册：换设备也能接着学", () => openLogin(), "acct-link", { "data-login-link": "" }));
    const st = h("span", { class: "acct-mini", "data-sync-mini": "" }); statusEls.add(st);
    const row = h("div", { class: "acct-row-mini" }, h("span", { text: acc.email || "已登录" }), st);
    paint(st, sync.status());
    return row;
  }

  return { openLogin, accountCard, accountRow, refreshStatus };
}
