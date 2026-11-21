// G-LOGIN-07：真实 createAccountUi + 可控 DOM / 时钟；在途登录另用真实 createSync。
// 只用注入的假接口，不联网。运行：node tests/login-input-lifecycle.test.mjs
import assert from "node:assert/strict";
import { createAccountUi } from "../src/account-ui.js";
import { createSync } from "../src/sync.js";
import { freshState } from "../src/storage.js";

const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 80; i++) await Promise.resolve(); };
const T0 = 1_700_000_000_000;
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
class Events {
  listeners = new Map();
  addEventListener(k, f) { if (!this.listeners.has(k)) this.listeners.set(k, new Set()); this.listeners.get(k).add(f); }
  removeEventListener(k, f) { this.listeners.get(k)?.delete(f); }
  emit(k, e = {}) { for (const f of [...(this.listeners.get(k) || [])]) f({ type: k, preventDefault() {}, ...e }); }
  count(k) { return this.listeners.get(k)?.size || 0; }
}
class El extends Events {
  constructor(tag, env) { super(); this.tag = tag; this.env = env; this.attrs = {}; this.children = []; this.parentNode = null; this.value = ""; this.disabled = false; this.dataset = {}; this.style = {}; this._text = ""; this.classes = new Set(); }
  get isConnected() { return this === this.env.body || !!this.parentNode?.isConnected; }
  get className() { return [...this.classes].join(" "); }
  set className(v) { this.classes = new Set(String(v).split(/\s+/).filter(Boolean)); }
  get classList() { const s = this.classes; return { contains: k => s.has(k), add: (...ks) => ks.forEach(k => s.add(k)), remove: (...ks) => ks.forEach(k => s.delete(k)), toggle: (k, on) => { const yes = on ?? !s.has(k); if (yes) s.add(k); else s.delete(k); return yes; } }; }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return own(this.attrs, k) ? this.attrs[k] : null; }
  get textContent() { return this._text + this.children.map(x => typeof x === "string" ? x : x.textContent).join(""); }
  set textContent(v) { this.replaceChildren(); this._text = String(v); }
  append(...xs) { for (const x of xs.flat(Infinity)) if (x != null && x !== false) { if (typeof x !== "string") { x.remove(); x.parentNode = this; } this.children.push(x); } }
  replaceChildren(...xs) { for (const x of this.children) if (typeof x !== "string") x.parentNode = null; this.children = []; this._text = ""; this.append(...xs); }
  remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(x => x !== this); this.parentNode = null; }
  focus() { if (this.isConnected && !this.disabled) { this.env.doc.activeElement = this; this.env.focused.push(this); } }
  select() { this.selected = true; }
  scrollIntoView() {}
  click() { if (!this.disabled && this.isConnected) this.emit("click", { target: this }); }
}
const walk = (root, pred) => { if (!root || typeof root === "string") return null; if (pred(root)) return root; for (const c of root.children) { const r = walk(c, pred); if (r) return r; } return null; };
const all = (root) => !root || typeof root === "string" ? [] : [root, ...root.children.flatMap(all)];

function harness({ captchaOn = false, send, verify, retry, finishChoice, token, realSync = false, cloudVerify, cloudRead } = {}) {
  const e = { now: T0, timers: new Map(), nextTimer: 1, sheets: [], caps: [], calls: [], toasts: [], switched: [], errors: [], focused: [], verified: false, clearCount: 0 };
  const original = { document: globalThis.document, window: globalThis.window, setTimeout, clearTimeout, setInterval, clearInterval, now: Date.now };
  const vv = new Events(); vv.height = 844;
  const doc = new Events(); e.doc = doc; e.body = new El("body", e); doc.body = e.body; doc.activeElement = e.body; doc.visibilityState = "visible"; doc.querySelectorAll = () => [];
  globalThis.document = doc; globalThis.window = { innerHeight: 844, visualViewport: vv };
  Date.now = () => e.now;
  const arm = (fn, ms, repeat) => { const id = e.nextTimer++; e.timers.set(id, { fn, at: e.now + ms, repeat }); return id; };
  globalThis.setTimeout = (fn, ms = 0) => arm(fn, ms, 0);
  globalThis.setInterval = (fn, ms) => arm(fn, ms, ms);
  globalThis.clearTimeout = globalThis.clearInterval = id => e.timers.delete(id);
  e.advance = ms => {
    const end = e.now + ms;
    for (let n = 0; n < 5000; n++) {
      const item = [...e.timers].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
      if (!item) { e.now = end; return; }
      const [id, t] = item; e.now = t.at;
      if (t.repeat) t.at += t.repeat; else e.timers.delete(id);
      t.fn();
    }
    throw new Error("Timer did not settle");
  };
  const h = (tag, attrs = {}, ...kids) => {
    const el = new El(tag, e);
    for (const [k, v] of Object.entries(attrs)) if (v != null && v !== false) {
      if (k === "class") el.className = v; else if (k === "text") el.textContent = v; else el.setAttribute(k, v === true ? "" : v);
    }
    el.append(...kids); return el;
  };
  const button = (label, fn, cls, attrs) => {
    const b = h("button", { class: cls, ...attrs }, label);
    b.addEventListener("click", event => { if (!b.disabled) { try { Promise.resolve(fn(event)).catch(x => e.errors.push(x)); } catch (x) { e.errors.push(x); } } });
    return b;
  };
  const mem = new Map();
  e.storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  e.snapshot = () => JSON.stringify([...mem].sort(([a], [b]) => a.localeCompare(b)));
  const api = {
    configured: true,
    sendCode: async (...args) => { e.calls.push(["send", ...args]); return send ? send(...args) : { ok: true }; },
    verifyCode: async (...args) => { e.calls.push(["verify", ...args]); return cloudVerify ? cloudVerify(...args) : { ok: true, session: { userId: "user-a", email: args[0], accessToken: "at-a", refreshToken: "rt-a", expiresAt: e.now + 3600000 } }; },
    getProgress: async (...args) => { e.calls.push(["read", ...args]); return cloudRead ? cloudRead(...args) : { ok: false, kind: "server", status: 503 }; },
  };
  let sync;
  if (realSync) {
    sync = createSync({ storage: e.storage, api, now: () => e.now, schedule: () => 0 });
    const clear = sync.clearVerified; sync.clearVerified = () => { e.clearCount++; clear(); };
  } else sync = {
    sendCode: api.sendCode,
    verify: async (...args) => { e.calls.push(["verify", ...args]); return verify ? verify(...args) : { ok: false, kind: "auth", status: 403, stage: "verify" }; },
    retryRead: async (...args) => { e.calls.push(["retry", ...args]); return retry ? retry(...args) : { ok: false, kind: "network", stage: "read", canRetry: true }; },
    finishChoice: async choice => { e.calls.push(["choice", choice]); return finishChoice ? finishChoice(choice) : { ok: false, kind: "network" }; },
    clearVerified: () => { e.clearCount++; e.verified = false; }, hasVerified: () => e.verified, account: () => null,
  };
  e.sync = sync;
  e.ui = createAccountUi({
    h, button, icon: () => h("i"), api, sync, getState: () => freshState(),
    showToast: x => e.toasts.push(x), onSwitchedIn: x => e.switched.push(x), onSwitchedOut() {}, rerender() {},
    sheet(content, opts) {
      const s = { opts, closed: false };
      s.close = () => { if (s.closed) return; s.closed = true; s.box.remove(); opts.onClose?.(); };
      s.requestClose = () => { if (!opts.canClose || opts.canClose()) s.close(); };
      s.box = h("div", {}, ...content(s.close)); e.body.append(s.box); e.sheets.push(s); return s.close;
    },
    makeCaptcha() {
      const cap = { enabled: captchaOn, destroyCount: 0, resetCount: 0, releaseCount: 0,
        getToken: async () => { e.calls.push(["token"]); return token ? token() : { ok: true, token: "test-token" }; },
        reset() { this.resetCount++; }, release() { this.releaseCount++; }, destroy() { this.destroyCount++; },
      }; e.caps.push(cap); return cap;
    },
  });
  e.open = (email = "a@example.com") => { const close = e.ui.openLogin({ email }); e.sheet = e.sheets.at(-1); return close; };
  e.get = attr => walk(e.sheet.box, el => own(el.attrs, attr));
  e.text = attr => e.get(attr)?.textContent || "";
  e.click = attr => { const el = e.get(attr); assert.ok(el, "Missing control: " + attr); el.click(); };
  e.edit = (attr, value) => { const el = e.get(attr); assert.ok(el, "Missing input: " + attr); el.value = value; el.emit("input", { target: el }); };
  e.count = key => e.calls.filter(c => c[0] === key).length;
  e.enterCode = async () => { e.open(); e.click("data-send-code"); await flush(); assert.ok(e.get("data-code"), "G07_PRECONDITION code page"); };
  e.dispose = () => {
    try { for (const s of e.sheets) s.close(); assert.deepEqual(e.errors, [], "G07_NO_RUNTIME_ERROR"); }
    finally { globalThis.document = original.document; globalThis.window = original.window; globalThis.setTimeout = original.setTimeout; globalThis.clearTimeout = original.clearTimeout; globalThis.setInterval = original.setInterval; globalThis.clearInterval = original.clearInterval; Date.now = original.now; }
  };
  e.vv = vv;
  return e;
}

let passed = 0, failed = 0, gate;
async function test(name, options, fn) {
  const e = harness(options);
  try { await fn(e); passed++; console.log("PASS " + name); }
  catch (x) { failed++; console.error("FAIL " + name + "\n" + x.stack); }
  finally { try { e.dispose(); } catch (x) { failed++; console.error("FAIL cleanup: " + x.stack); } }
}

await test("格式：无效码零请求，保留前导零及现有去空白行为", {}, async e => {
  await e.enterCode();
  for (const value of ["", "123", "1234", "12345", "1234567", "12a456", "１２３４５６", "code:123456"]) {
    e.edit("data-code", value); e.click("data-verify"); e.get("data-code").emit("keydown", { key: "Enter" }); await flush();
    assert.equal(e.count("verify"), 0, "G07_FORMAT " + value);
    assert.match(e.text("data-login-msg"), /6 位数字/, "G07_FORMAT_COPY");
  }
  e.edit("data-code", " 00 12\n34 "); e.get("data-code").emit("keydown", { key: "Enter" }); e.click("data-verify"); await flush();
  assert.equal(e.count("verify"), 1, "G07_VALID_PASTE"); assert.equal(e.calls.find(c => c[0] === "verify")[2], "001234", "G07_LEADING_ZERO");
  assert.equal(e.get("data-code").disabled, false); assert.equal(e.get("data-code").selected, true);
});

await test("发送：输入快照、连点互斥、处理中可先不登录", { send: () => gate.promise }, async e => {
  gate = deferred(); e.open(); e.click("data-send-code"); e.click("data-send-code"); await flush();
  assert.equal(e.get("data-email").disabled, true, "G07_EMAIL_BUSY");
  assert.equal(e.count("send"), 1); assert.equal(e.calls[0][1], "a@example.com");
  assert.equal(e.get("data-login-cancel").disabled, false);
  e.sheet.requestClose(); assert.equal(e.sheet.closed, false, "G07_EMAIL_BUSY_CLOSE");
  e.click("data-login-cancel"); assert.equal(e.sheet.closed, true);
  gate.resolve({ ok: true }); await flush(); assert.equal(e.switched.length, 0);
});

for (const action of ["verify", "retry", "resend"]) {
  await test(`${action}：输入和四个入口互斥，失败后恢复`, { verify: () => action === "retry" ? { ok: false, kind: "server", status: 503, stage: "read", canRetry: true } : gate.promise, retry: () => gate.promise, send: () => action === "resend" && gate ? gate.promise : { ok: true } }, async e => {
    gate = null; await e.enterCode();
    if (action === "resend") e.advance(61000);
    e.edit("data-code", "123456");
    if (action === "retry") { e.verified = true; e.click("data-verify"); await flush(); assert.equal(e.text("data-verify"), "重试读取"); }
    gate = deferred(); e.click(action === "resend" ? "data-resend" : "data-verify"); await flush();
    for (const attr of ["data-code", "data-verify", "data-resend", "data-login-change-email", "data-login-cancel"]) assert.equal(e.get(attr).disabled, true, "G07_CODE_BUSY " + action + " " + attr);
    const before = e.calls.length; e.click("data-verify"); e.click("data-resend"); e.click("data-login-change-email"); e.click("data-login-cancel"); e.sheet.requestClose();
    assert.equal(e.calls.length, before); assert.equal(e.sheet.closed, false, "G07_CODE_BUSY_CLOSE");
    gate.resolve({ ok: false, kind: "network", ...(action === "retry" ? { stage: "read", canRetry: true } : {}) }); await flush();
    for (const attr of ["data-code", "data-verify", "data-login-change-email", "data-login-cancel"]) assert.equal(e.get(attr).disabled, false, "G07_CODE_RECOVER " + attr);
    e.click("data-login-cancel"); assert.equal(e.sheet.closed, true, "G07_CODE_EXIT");
  });
}

for (const result of ["success", "failure", "throw"]) {
  await test(`令牌挂起取消后重开：迟到 ${result} 不发码、不改新弹窗`, { captchaOn: true, token: () => gate.promise }, async e => {
    gate = deferred(); e.open(); e.click("data-send-code"); await flush(); assert.equal(e.count("token"), 1);
    const old = e.sheet; e.click("data-login-cancel"); e.open("b@example.com");
    if (result === "throw") gate.reject(new Error("TOKEN_CANARY")); else gate.resolve(result === "success" ? { ok: true, token: "late" } : { ok: false, reason: "error" });
    await flush(); assert.equal(e.count("send"), 0, "G07_TOKEN_CANCEL"); assert.equal(e.get("data-email").value, "b@example.com");
    assert.equal(e.text("data-login-msg"), ""); assert.equal(e.get("data-email").disabled, false);
    assert.equal(e.caps[0].destroyCount, 1); assert.equal(e.caps[0].resetCount, 0); assert.equal(old.closed, true);
  });
}

for (const result of ["success", "failure", "throw"]) {
  await test(`已发送请求取消后重开：迟到 ${result} 不翻页、不解新操作的锁`, { send: () => gate.promise }, async e => {
    gate = deferred(); e.open(); e.click("data-send-code"); await flush(); const first = gate;
    const old = e.sheet; e.click("data-login-cancel"); const oldText = old.box.textContent;
    e.open("b@example.com"); gate = deferred(); e.click("data-send-code"); await flush();
    const box = e.sheet.box, before = box.textContent, timerCount = e.timers.size;
    if (result === "throw") first.reject(new Error("SEND_CANARY")); else first.resolve({ ok: result === "success", kind: "server", status: 503 });
    await flush(); assert.equal(e.sheet.box, box); assert.equal(box.textContent, before, "G07_LATE_SEND");
    assert.equal(old.box.textContent, oldText, "G07_CLOSED_SEND_DOM"); assert.equal(e.timers.size, timerCount, "G07_CLOSED_SEND_TIMER");
    assert.equal(e.get("data-email").disabled, true, "G07_OLD_FINALLY");
    assert.equal(e.count("send"), 2); assert.equal(e.toasts.length, 0);
    gate.resolve({ ok: false, kind: "network" }); await flush(); assert.equal(e.get("data-email").disabled, false);
  });
}

for (const stage of ["verify", "read"]) for (const result of ["success", "failure", "throw"]) {
  await test(`真实 sync：强制关闭 ${stage} 挂起操作，迟到 ${result} 不建立账号`, { realSync: true, cloudVerify: (...a) => stage === "verify" ? gate.promise : { ok: true, session: { userId: "user-a", email: a[0], accessToken: "at-a", refreshToken: "rt-a", expiresAt: T0 + 3600000 } }, cloudRead: () => gate.promise }, async e => {
    gate = deferred(); await e.enterCode(); e.edit("data-code", "123456"); e.click("data-verify"); await flush();
    assert.equal(e.count(stage), 1, "G07_PRECONDITION in-flight " + stage);
    const old = e.sheet; old.close(); const afterCancel = e.snapshot(), oldText = old.box.textContent; e.open("b@example.com");
    if (result === "throw") gate.reject(new Error("VERIFY_CANARY"));
    else gate.resolve(result === "failure" ? { ok: false, kind: "server", status: 503 } : stage === "verify" ? { ok: true, session: { userId: "user-a", email: "a@example.com", accessToken: "old-at", refreshToken: "old-rt", expiresAt: T0 + 3600000 } } : { ok: true, row: null });
    await flush(); assert.equal(e.sync.account(), null, "G07_LATE_AUTH"); assert.equal(e.sync.hasVerified(), false);
    assert.equal(e.snapshot(), afterCancel, "G07_LATE_STORAGE"); assert.equal(e.switched.length, 0); assert.equal(e.toasts.length, 0);
    assert.equal(old.box.textContent, oldText, "G07_CLOSED_VERIFY_DOM");
    assert.equal(e.get("data-email").value, "b@example.com"); assert.equal(e.text("data-login-msg"), "");
  });
}

await test("关闭幂等、监听和计时器即时释放；旧输入事件不能清新会话", { verify: () => ({ ok: false, kind: "server", status: 503, stage: "read", canRetry: true }) }, async e => {
  await e.enterCode(); e.verified = true; e.edit("data-code", "123456"); e.click("data-verify"); await flush();
  const old = e.sheet, oldInput = e.get("data-code");
  assert.equal(e.doc.count("visibilitychange"), 1); assert.equal(e.vv.count("resize"), 1); assert.ok(e.timers.size > 0);
  e.click("data-login-cancel");
  assert.equal(e.clearCount, 1, "G07_CLEAN_ONCE"); assert.equal(e.caps[0].destroyCount, 1, "G07_DESTROY_ONCE");
  assert.equal(e.doc.count("visibilitychange"), 0, "G07_VIS_RELEASE"); assert.equal(e.vv.count("resize"), 0, "G07_VV_RELEASE"); assert.equal(e.timers.size, 0, "G07_TIMER_RELEASE");
  e.open("b@example.com"); e.verified = true; const n = e.clearCount;
  old.opts.onClose(); old.opts.onClose(); oldInput.emit("input", { target: oldInput });
  assert.equal(e.clearCount, n, "G07_OLD_CLEANUP"); assert.equal(e.verified, true);
  e.advance(50); assert.ok(e.focused.every(el => el.isConnected), "G07_OLD_FOCUS");
  assert.equal(e.doc.count("visibilitychange"), 1); assert.equal(e.vv.count("resize"), 1);
});

await test("重复打开复用同一弹窗，不接管在途操作", { send: () => gate.promise }, async e => {
  gate = deferred(); const a = e.open(); e.click("data-send-code"); await flush(); const b = e.ui.openLogin({ email: "other@example.com" });
  assert.equal(a, b, "G07_SINGLE_DIALOG"); assert.equal(e.sheets.length, 1); assert.equal(e.caps.length, 1);
  gate.resolve({ ok: true }); await flush(); assert.match(e.sheet.box.textContent, /a@example.com/);
});

await test("遮罩 / Esc 共用关闭钩子，空闲验证码页即时释放资源", {}, async e => {
  await e.enterCode(); e.sheet.requestClose();
  assert.equal(e.sheet.closed, true); assert.equal(e.clearCount, 1, "G07_CLOSE_HOOK");
  assert.equal(e.caps[0].destroyCount, 1); assert.equal(e.timers.size, 0, "G07_CLOSE_HOOK");
  assert.equal(e.doc.count("visibilitychange"), 0); assert.equal(e.vv.count("resize"), 0);
});

await test("登录成功只回调一次；游客选择和上传关闭规则保持", { verify: () => ({ ok: true, synced: true, userId: "user-a" }) }, async e => {
  await e.enterCode(); e.edit("data-code", "001234"); e.click("data-verify"); await flush();
  assert.equal(e.sheet.closed, true); assert.equal(e.switched.length, 1, "G07_SUCCESS"); assert.equal(e.toasts.length, 1);
  assert.equal(e.caps[0].destroyCount, 1); assert.equal(e.clearCount, 1);
});

await test("游客选择：传输失败仍可重试，上传中不可关闭", { verify: () => ({ ok: true, needChoice: true, cloudHasData: false, guest: { xp: 50, lessons: 1 } }), finishChoice: () => gate.promise }, async e => {
  gate = deferred(); await e.enterCode(); e.edit("data-code", "123456"); e.click("data-verify"); await flush();
  const transfer = all(e.sheet.box).find(el => el.attrs["data-choice"] === "transfer"); assert.ok(transfer, "G07_CHOICE"); transfer.click(); await flush();
  e.sheet.requestClose(); assert.equal(e.sheet.closed, false); assert.equal(transfer.disabled, true);
  gate.resolve({ ok: false, kind: "network" }); await flush(); assert.equal(transfer.disabled, false);
  e.sheet.requestClose(); assert.equal(e.sheet.closed, true); assert.match(e.toasts[0], /已取消登录/);
});

await test("冷却期间可以编辑；G06 截止时间和全局门禁保持", { send: () => ({ ok: false, kind: "rate-limit", localBlock: false, status: 429, errorCode: "over_request_rate_limit", retryAt: T0 + 120000, waitMs: 120000 }) }, async e => {
  e.open(); e.click("data-send-code"); await flush(); e.advance(1000);
  assert.equal(e.get("data-email").disabled, false); e.edit("data-email", "other@example.com");
  assert.equal(e.get("data-send-code").disabled, true); assert.match(e.text("data-send-code"), /119 秒/, "G07_COOLDOWN"); assert.equal(e.count("send"), 1);
});

console.log(`G-LOGIN-07 Node: ${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
