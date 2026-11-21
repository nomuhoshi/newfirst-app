// D：登录弹窗里的人机验证接线（Node，不开浏览器：假 DOM + 假 sync + 假 captcha，真 account-ui）。
// 验证：没开 = 调用形状和以前完全一致；开了 = 发送前取令牌、令牌只交给这一次 sendCode、发完无论成败都 reset、重发重新取、
// 取令牌失败 / 服务器拒绝令牌 → 不发邮件、不冷却、可立即重试、界面不出现令牌和服务器原文。
// 运行：node tests/captcha-ui.test.mjs
import { createAccountUi } from "../src/account-ui.js";

let ok = 0, bad = 0;
const check = (name, cond, detail = "") => { if (cond) ok++; else bad++; console.log(`${cond ? "✅" : "❌"} ${name}${!cond && detail ? "  — " + detail : ""}`); };

// ---------- 假 DOM（只实现 account-ui 登录流程用到的部分）----------
class El {
  constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.listeners = {}; this.dataset = {}; this.style = {}; this.isConnected = true; this.parentNode = null; this.value = ""; this.disabled = false; this._t = ""; this._cls = new Set(); this.className = ""; }
  get classList() { const s = this._cls; return { toggle: (c, on) => { if (on === undefined ? !s.has(c) : on) s.add(c); else s.delete(c); }, contains: (c) => s.has(c), add: (c) => s.add(c), remove: (c) => s.delete(c) }; }
  get textContent() { return this._t + this.children.map(textOf).join(""); }
  set textContent(v) { this.children = []; this._t = String(v); }
  setAttribute(k, v) { this.attrs[k] = v; }
  append(...n) { for (const c of n.flat()) { if (c == null || c === false) continue; if (typeof c === "string") this.children.push({ text: c }); else { c.parentNode = this; this.children.push(c); } } }
  appendChild(c) { this.append(c); return c; }
  replaceChildren(...n) { this.children = []; this.append(...n); }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  removeEventListener() {}
  click() { for (const f of this.listeners.click || []) f({ target: this }); }
  focus() {} select() {} blur() {} remove() {} contains() { return false; }
}
const has = (el, name) => el instanceof El && Object.prototype.hasOwnProperty.call(el.attrs, name);
const find = (root, name) => { if (has(root, name)) return root; for (const c of root.children || []) { if (c instanceof El) { const r = find(c, name); if (r) return r; } } return null; };
function textOf(n) { return n.text !== undefined ? n.text : n.textContent; }
globalThis.document = { createElement: (t) => new El(t), addEventListener() {}, removeEventListener() {}, visibilityState: "visible", activeElement: null, body: new El("body") };
globalThis.window = { innerHeight: 800, visualViewport: undefined };
const unhandled = []; process.on("unhandledRejection", (e) => unhandled.push(String(e?.message || e)));
let NOW = 1_000_000; Date.now = () => NOW;
function h(tag, attrs = {}, ...kids) { const el = new El(tag); for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === "class") el.className = v; else if (k === "text") el.textContent = v; else el.setAttribute(k, v === true ? "" : v); } for (const c of kids.flat()) if (c != null && c !== false) el.append(c); return el; }
function button(label, fn, cls = "btn", attrs = {}) { const b = h("button", { type: "button", class: cls, ...attrs }, label); b.addEventListener("click", (e) => { if (!b.disabled) fn(e); }); return b; }
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)); };

// ---------- 场景搭建 ----------
function setup({ captchaEnabled, tokens = ["TOK1", "TOK2", "TOK3"], tokenResults = null, sendResults = [] }) {
  const log = []; let ti = 0, si = 0, sheetBox = null;
  const cap = {
    enabled: captchaEnabled,
    async getToken(o) { log.push(["getToken", o?.mount?.attrs?.["data-captcha-mount"] === ""]); const scripted = tokenResults?.shift(); if (scripted?.reject) throw new Error("getToken boom"); if (scripted) return scripted; return { ok: true, token: tokens[ti++] }; },
    reset() { log.push(["reset"]); }, release() { log.push(["release"]); }, destroy() { log.push(["destroy"]); },
  };
  const sync = { async sendCode(...args) { log.push(["sendCode", ...args]); const r = sendResults[si++] || { ok: true }; if (r.throws) throw new Error("boom"); return r; }, hasLeftoverAuth: () => false, account: () => null, status: () => ({}), async verify() { return { ok: false, kind: "auth", stage: "verify" }; } };
  const toasts = [];
  const ui = createAccountUi({ h, button, sheet: (content) => { sheetBox = content(() => {})[0]; return sheetBox; }, icon: () => new El("i"), showToast: (t) => toasts.push(t), sync, api: { configured: true }, getState: () => ({ xp: 0 }), onSwitchedIn() {}, onSwitchedOut() {}, rerender() {}, makeCaptcha: () => cap });
  return { log, cap, sync, ui, toasts, box: () => sheetBox };
}
// createAccountUi 返回值里有没有 openLogin？没有就通过账号卡片按钮进入
function launch(s) {
  if (typeof s.ui.openLogin === "function") { s.ui.openLogin(); return s.box(); }
  const card = s.ui.accountCard();
  find(card, "data-open-login").click();
  return s.box();
}
async function sendFrom(box, addr) { const input = find(box, "data-email"); input.value = addr; find(box, "data-send-code").click(); await flush(); }

{ // A 没开人机验证
  const s = setup({ captchaEnabled: false });
  const box = launch(s);
  check("A 没开：登录页没有人机验证挂载点", !find(box, "data-captcha-mount"));
  await sendFrom(box, "a@b.co");
  const sends = s.log.filter((x) => x[0] === "sendCode");
  check("A 没开：sync.sendCode 只传邮箱一个参数（和以前一致），没取令牌，没 reset", sends.length === 1 && sends[0].length === 2 && sends[0][1] === "a@b.co" && !s.log.some((x) => x[0] === "getToken" || x[0] === "reset"), JSON.stringify(s.log));
  check("A 没开：发送成功后进入输验证码页", !!find(s.box(), "data-code"));
}
{ // B 开了：发送 → 重发（令牌各用一次）
  const s = setup({ captchaEnabled: true });
  let box = launch(s);
  check("B 开了：登录页有人机验证挂载点", !!find(box, "data-captcha-mount"));
  await sendFrom(box, "a@b.co");
  let ev = s.log.map((x) => x[0] + (x[1] !== undefined ? ":" + x[1] : "") + (x[2] ? ":" + x[2] : ""));
  const iGet = s.log.findIndex((x) => x[0] === "getToken"), iSend = s.log.findIndex((x) => x[0] === "sendCode"), iReset = s.log.findIndex((x) => x[0] === "reset");
  check("B 先取令牌（挂载点已传入）→ 再 sendCode(邮箱, 令牌) → 发完 reset", iGet >= 0 && iGet < iSend && iSend < iReset && s.log[iGet][1] === true && s.log[iSend][1] === "a@b.co" && s.log[iSend][2] === "TOK1", JSON.stringify(s.log));
  box = s.box();
  check("B 成功后进入输验证码页，且该页也有挂载点（重发要用）", !!find(box, "data-code") && !!find(box, "data-captcha-mount"));
  NOW += 61_000; await new Promise((r) => setTimeout(r, 1100)); // 等界面的 1 秒计时器把重发按钮刷新成可点
  find(box, "data-resend").click(); await flush();
  const sends = s.log.filter((x) => x[0] === "sendCode");
  check("B 重发：重新取了令牌（TOK2），没有复用 TOK1", sends.length === 2 && sends[1][2] === "TOK2" && sends[0][2] !== sends[1][2], JSON.stringify(sends));
  check("B 重发后也 reset", s.log.filter((x) => x[0] === "reset").length === 2);
  const dump = textOf(s.box()) + JSON.stringify(s.toasts);
  check("B 界面和提示里没有令牌", !/TOK\d/.test(dump), dump.slice(0, 120));
}
{ // C 取令牌失败：不发邮件、不冷却、可立即重试
  for (const [reason, needle] of [["unavailable", "没加载出来"], ["timeout", "超时或已过期"], ["expired", "超时或已过期"], ["error", "出错了"]]) {
    const s = setup({ captchaEnabled: true, tokenResults: [{ ok: false, reason, code: "300030" }] });
    const box = launch(s);
    await sendFrom(box, "a@b.co");
    const msg = textOf(find(s.box(), "data-login-msg"));
    check(`C ${reason}：没发请求，提示含「${needle}」，不含错误码原文`, !s.log.some((x) => x[0] === "sendCode") && msg.includes(needle) && !msg.includes("300030"), msg);
    const go = find(s.box(), "data-send-code");
    check(`C ${reason}：没有冷却，按钮可立即再点`, go.disabled === false && textOf(go) === "发送验证码", textOf(go));
    check(`C ${reason}：失败后 reset 过`, s.log.some((x) => x[0] === "reset"));
    go.click(); await flush();
    const sends = s.log.filter((x) => x[0] === "sendCode");
    check(`C ${reason}：立即重试会重新取令牌并发送`, sends.length === 1 && sends[0][2] === "TOK1" && s.log.filter((x) => x[0] === "getToken").length === 2, JSON.stringify(s.log));
  }
}
{ // D 服务器拒绝令牌 / 请求抛异常
  const RAW = "captcha verification process failed";
  const s = setup({ captchaEnabled: true, sendResults: [{ ok: false, kind: "auth", status: 400, errorCode: "captcha_failed", message: RAW }] });
  const box = launch(s);
  await sendFrom(box, "a@b.co");
  const msg = textOf(find(s.box(), "data-login-msg")), all = textOf(s.box());
  check("D 服务器 captcha_failed：提示「人机验证没通过」，不显示服务器原文，没有令牌", msg.includes("人机验证没通过") && !all.includes(RAW) && !/TOK\d/.test(all), msg);
  check("D 令牌作废（reset），无冷却，按钮可再点", s.log.some((x) => x[0] === "reset") && find(s.box(), "data-send-code").disabled === false);
  find(s.box(), "data-send-code").click(); await flush();
  const sends = s.log.filter((x) => x[0] === "sendCode");
  check("D 再点一次用新令牌（TOK2），不复用被拒的 TOK1", sends.length === 2 && sends[1][2] === "TOK2", JSON.stringify(sends));
  const s2 = setup({ captchaEnabled: true, sendResults: [{ throws: true }] });
  const box2 = launch(s2);
  await sendFrom(box2, "a@b.co");
  check("D sendCode 抛异常时 reset 仍然执行（令牌不残留），且没有未处理异常", s2.log.some((x) => x[0] === "reset") && unhandled.length === 0, JSON.stringify({ log: s2.log, unhandled }));
}

{ // E 异常恢复：sendCode / getToken 意外抛出时，不能卡在“发送中…”，必须能重试（GPT1 阻断项）
  const RAWERR = "boom";
  const recovered = (s, where) => {
    const go = find(s.box(), "data-send-code");
    return go && go.disabled === false && textOf(go) === "发送验证码";
  };
  // E1 首次发送：sendCode 抛异常
  let s = setup({ captchaEnabled: true, sendResults: [{ throws: true }] });
  let box = launch(s);
  await sendFrom(box, "a@b.co");
  let msg = textOf(find(s.box(), "data-login-msg"));
  check("E1 首次发送 sendCode 抛异常：按钮恢复可点（不卡在“发送中…”），提示“暂时无法确认是否发出，请先检查邮件”（不说没发出去），不含异常原文，有“去输入验证码”入口", recovered(s) && msg === "暂时无法确认是否发出，请先检查邮件。" && !!find(s.box(), "data-enter-code") && !msg.includes(RAWERR) && !msg.includes("TOK"), msg + " | " + textOf(find(s.box(), "data-send-code")));
  check("E1 令牌作废（reset）、没有冷却、没有未处理异常", s.log.some((x) => x[0] === "reset") && unhandled.length === 0, JSON.stringify(s.log));
  find(s.box(), "data-send-code").click(); await flush();
  check("E1 立即重试：重新取令牌（TOK2），这次成功并进入输码页", s.log.filter((x) => x[0] === "sendCode").length === 2 && s.log.filter((x) => x[0] === "sendCode")[1][2] === "TOK2" && !!find(s.box(), "data-code"));
  // E2 重发：sendCode 抛异常
  s = setup({ captchaEnabled: true, sendResults: [{ ok: true }, { throws: true }, { ok: true }] });
  box = launch(s); await sendFrom(box, "a@b.co");
  NOW += 61_000; await new Promise((r) => setTimeout(r, 1100));
  let resend = find(s.box(), "data-resend");
  resend.click(); await flush();
  resend = find(s.box(), "data-resend");
  msg = textOf(find(s.box(), "data-login-msg"));
  check("E2 重发 sendCode 抛异常：重发按钮恢复（不卡“发送中…”），提示“暂时无法确认是否发出，请先检查邮件”，无冷却", resend.disabled === false && textOf(resend) === "重新发送" && msg === "暂时无法确认是否发出，请先检查邮件。" && !msg.includes(RAWERR), msg + " | " + textOf(resend) + " | " + resend.disabled);
  check("E2 登录按钮没有被锁死（busy 已清）", find(s.box(), "data-verify").disabled === false);
  resend.click(); await flush();
  check("E2 立即再重发：新令牌（TOK3）、成功后提示“已重新发送”", s.log.filter((x) => x[0] === "sendCode").length === 3 && s.log.filter((x) => x[0] === "sendCode")[2][2] === "TOK3" && textOf(find(s.box(), "data-login-msg")).includes("已重新发送"));
  // E3 getToken 被拒绝（Promise reject）
  s = setup({ captchaEnabled: true, tokenResults: [{ reject: true }] });
  box = launch(s); await sendFrom(box, "a@b.co");
  msg = textOf(find(s.box(), "data-login-msg"));
  check("E3 getToken 被拒绝：没发请求（邮件确定没发），按钮恢复，提示“人机验证出错了…验证码没发出去”，令牌 reset 过，没有未处理异常", !s.log.some((x) => x[0] === "sendCode") && recovered(s) && msg.includes("人机验证出错了") && msg.includes("验证码没发出去") && !msg.includes("boom") && s.log.some((x) => x[0] === "reset") && unhandled.length === 0, JSON.stringify(s.log) + msg);
  find(s.box(), "data-send-code").click(); await flush();
  check("E3 重试成功（下一次取令牌正常）", s.log.filter((x) => x[0] === "sendCode").length === 1 && !!find(s.box(), "data-code"));
  // E4 没开人机验证时 sendCode 抛异常：同样不卡死，也不 reset / 取令牌
  s = setup({ captchaEnabled: false, sendResults: [{ throws: true }, { ok: true }] });
  box = launch(s); await sendFrom(box, "a@b.co");
  msg = textOf(find(s.box(), "data-login-msg"));
  check("E4 没开 + sendCode 抛异常：按钮恢复、提示“暂时无法确认是否发出，请先检查邮件”、调用形状不变（仍只传邮箱）、不取令牌不 reset", recovered(s) && msg === "暂时无法确认是否发出，请先检查邮件。" && s.log.filter((x) => x[0] === "sendCode").every((x) => x.length === 2) && !s.log.some((x) => x[0] === "getToken" || x[0] === "reset"), JSON.stringify(s.log));
  find(s.box(), "data-send-code").click(); await flush();
  check("E4 重试成功", !!find(s.box(), "data-code"));
  check("E 全程没有未处理异常", unhandled.length === 0, JSON.stringify(unhandled));
}
// F 请求还在路上时离开当前页（2026-11-17 审查发现：“换个邮箱”和“先不登录”没看 busy）。
//   旧行为：重发 / 登录途中点“换个邮箱”会回到邮箱页，但「发送验证码」按钮停在禁用的“发送中…”，旧请求的结果（“已重新发送”/ 登录报错）还会写到邮箱页上。
//   新行为：处理中点“换个邮箱”不换页（和点遮罩 / Esc 不能关一致）；“先不登录”仍然可以关（人机验证最长可能等几十秒，要留退路），关掉后迟到的结果不再翻页。
const btnByText = (root, t) => { if (root instanceof El && root.tag === "button" && root.textContent === t) return root; for (const c of root.children || []) { if (c instanceof El) { const r = btnByText(c, t); if (r) return r; } } return null; };
const gateOf = () => { let open; const p = new Promise((r) => { open = r; }); return { p, open }; };
for (const captchaEnabled of [true, false]) {
  const tag = captchaEnabled ? "开" : "没开";
  { // F1 重发途中点“换个邮箱”
    const s = setup({ captchaEnabled });
    await sendFrom(launch(s), "a@b.co");
    NOW += 61_000;
    const g = gateOf(), origSend = s.sync.sendCode;
    s.sync.sendCode = async (...a) => { await g.p; return origSend(...a); };
    const resend = find(s.box(), "data-resend"); resend.disabled = false;
    resend.click(); await flush();
    check(`F1（${tag}）重发途中：按钮显示“发送中…”`, resend.textContent === "发送中…" && resend.disabled);
    btnByText(s.box(), "换个邮箱")?.click(); await flush();
    check(`F1（${tag}）重发途中点“换个邮箱”：不换页，仍在输验证码页`, !!find(s.box(), "data-code") && !find(s.box(), "data-email"));
    g.open(); await flush();
    check(`F1（${tag}）请求结束：重发按钮恢复、提示“已重新发送”留在输验证码页`, resend.textContent !== "发送中…" && find(s.box(), "data-login-msg").textContent.includes("已重新发送") && !!find(s.box(), "data-code"), resend.textContent);
    btnByText(s.box(), "换个邮箱")?.click(); await flush();
    const go = find(s.box(), "data-send-code");
    check(`F1（${tag}）结束后再点“换个邮箱”：正常回到邮箱页，按钮是刚重发过的冷却（不是“发送中…”）`, !!go && go.disabled && /后可再发$/.test(go.textContent), go && go.textContent);
    const inp = find(s.box(), "data-email"); inp.value = "other@b.co"; for (const f of inp.listeners.input || []) f();
    check(`F1（${tag}）换成别的邮箱：「发送验证码」马上可点`, !go.disabled && go.textContent === "发送验证码", go.textContent);
  }
  { // F2 登录（校验验证码）途中点“换个邮箱”
    const s = setup({ captchaEnabled });
    await sendFrom(launch(s), "a@b.co");
    const g = gateOf();
    s.sync.verify = async () => { await g.p; return { ok: false, kind: "auth", stage: "verify" }; };
    find(s.box(), "data-code").value = "123456";
    const go = find(s.box(), "data-verify"); go.click(); await flush();
    check(`F2（${tag}）登录途中：按钮显示“登录中…”`, go.textContent === "登录中…" && go.disabled);
    btnByText(s.box(), "换个邮箱")?.click(); await flush();
    check(`F2（${tag}）登录途中点“换个邮箱”：不换页`, !!find(s.box(), "data-code") && !find(s.box(), "data-email"));
    g.open(); await flush();
    check(`F2（${tag}）登录失败的提示留在输验证码页，按钮恢复`, go.textContent === "登录" && !go.disabled && !!find(s.box(), "data-login-msg").textContent && !!find(s.box(), "data-code"));
  }
  { // F3 首次发送途中点“先不登录”，请求随后成功
    const s = setup({ captchaEnabled });
    const box = launch(s);
    const g = gateOf(), origSend = s.sync.sendCode;
    s.sync.sendCode = async (...a) => { await g.p; return origSend(...a); };
    find(box, "data-email").value = "a@b.co"; find(box, "data-send-code").click(); await flush();
    btnByText(s.box(), "先不登录")?.click(); await flush();
    check(`F3（${tag}）发送途中点“先不登录”：可以关（人机验证实例已销毁）`, s.log.some((x) => x[0] === "destroy"));
    g.open(); await flush();
    check(`F3（${tag}）关掉后请求才成功：已关的弹窗不再翻到输验证码页`, !find(s.box(), "data-code") && !!find(s.box(), "data-email"));
    // G07：关闭已通过 destroy 作废组件；迟到请求不能再操作已销毁的组件，改为核验一次销毁且零次关闭后 reset。
    if (captchaEnabled) check("F3（开）关闭通过 destroy 作废令牌；迟到结果不再 reset 已销毁组件", s.log.filter((x) => x[0] === "destroy").length === 1 && s.log.filter((x) => x[0] === "reset").length === 0, JSON.stringify(s.log));
  }
  { // F4 首次发送途中点“先不登录”，请求随后失败：不在已关的弹窗上写报错、不起冷却计时
    const s = setup({ captchaEnabled, sendResults: [{ ok: false, status: 429, errorCode: "over_email_send_rate_limit", kind: "rate-limit" }] });
    const box = launch(s);
    const g = gateOf(), origSend = s.sync.sendCode;
    s.sync.sendCode = async (...a) => { await g.p; return origSend(...a); };
    find(box, "data-email").value = "a@b.co"; find(box, "data-send-code").click(); await flush();
    btnByText(s.box(), "先不登录")?.click(); await flush();
    g.open(); await flush();
    check(`F4（${tag}）关掉后请求才失败：提示区没有被改写成报错`, !find(s.box(), "data-login-msg").classList.contains("bad"), find(s.box(), "data-login-msg").textContent);
  }
}
// G 服务器要求人机验证（captcha_failed），按这份页面有没有带人机验证给不同提示
for (const captchaEnabled of [true, false]) {
  const rej = { ok: false, kind: "auth", status: 400, errorCode: "captcha_failed", message: "CANARY captcha verification process failed" };
  const s = setup({ captchaEnabled, sendResults: [rej, rej] });
  await sendFrom(launch(s), "a@b.co");
  const m1 = find(s.box(), "data-login-msg").textContent;
  if (captchaEnabled) check("G（开）服务器拒绝令牌：提示“没通过…再点一次”（K4，和以前一样）", /人机验证没通过/.test(m1) && /再点一次/.test(m1), m1);
  else check("G（没开）页面没带人机验证却被服务器要求：提示更新版本，不叫人反复点（K5）", /这个版本还不支持/.test(m1) && /更新到最新版本/.test(m1) && !/再点一次/.test(m1), m1);
  check(`G（${captchaEnabled ? "开" : "没开"}）不显示服务器原文、不冷却、仍在邮箱页`, !m1.includes("CANARY") && !find(s.box(), "data-send-code").disabled && !!find(s.box(), "data-email"));
  // 进了输验证码页后的“重新发送”走同一套提示
  const s2 = setup({ captchaEnabled, sendResults: [{ ok: true }, rej] });
  await sendFrom(launch(s2), "a@b.co"); NOW += 61_000;
  const resend = find(s2.box(), "data-resend"); resend.disabled = false; resend.click(); await flush();
  const m2 = find(s2.box(), "data-login-msg").textContent;
  check(`G（${captchaEnabled ? "开" : "没开"}）重发被拒：${captchaEnabled ? "K4" : "K5"}`, captchaEnabled ? /人机验证没通过/.test(m2) : /更新到最新版本/.test(m2), m2);
}
check("F 全程没有未处理异常", unhandled.length === 0, JSON.stringify(unhandled));
console.log(`\n${ok} 通过，${bad} 失败`);
process.exit(bad ? 1 : 0);
