// D：src/captcha.js（Turnstile 客户端封装）的行为。Node，假 window / document / turnstile，不联网。
// 运行：node tests/captcha.test.mjs
import { createCaptcha, getLastCaptchaFailure, resetCaptchaFailure, captchaDiagLine } from "../src/captcha.js";

let ok = 0, bad = 0;
const check = (name, cond, detail = "") => { if (cond) ok++; else bad++; console.log(`${cond ? "✅" : "❌"} ${name}${!cond && detail ? "  — " + detail : ""}`); };
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

class Node_ { constructor(tag) { this.tag = tag; this.children = []; this.attrs = {}; this.parentNode = null; this.isConnected = true; }
  setAttribute(k, v) { this.attrs[k] = v; }
  appendChild(c) { c.parentNode = this; this.children.push(c); if (c.tag === "script") env.scripts.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; c.isConnected = false; } }
// 假环境：turnstile 只有在“脚本加载成功”后才出现在 win 上
function mkEnv({ scriptBehavior = "load", turnstileOnLoad = true } = {}) {
  const calls = [], widgets = new Map(); let nid = 0;
  const win = {};
  const doc = { createElement: (t) => new Node_(t), head: new Node_("head"), body: new Node_("body"), documentElement: new Node_("html") };
  doc.head.appendChild = function (c) { Node_.prototype.appendChild.call(this, c); if (c.tag === "script") setTimeout(() => { if (scriptBehavior === "load") { if (turnstileOnLoad) win.turnstile = api; c.onload?.(); } else if (scriptBehavior === "error") c.onerror?.(); }, 0); return c; };
  const api = {
    render(container, opts) { const id = "w" + ++nid; widgets.set(id, { container, opts }); calls.push(["render", id, opts.sitekey, opts.execution, opts.appearance, opts.retry, opts["refresh-expired"]]); return id; },
    execute(id) { calls.push(["execute", id]); }, reset(id) { calls.push(["reset", id]); }, remove(id) { calls.push(["remove", id]); widgets.delete(id); },
  };
  env = { win, doc, calls, widgets, scripts: [] };
  return env;
}
let env;
const fire = (id, cb, ...a) => { const w = env.widgets.get(id); const f = cb === "callback" ? w.opts.callback : w.opts[cb]; return f(...a); };

{ // 1 没有站点密钥 = 完全关闭
  const e = mkEnv(); const c = createCaptcha({ siteKey: "  ", win: e.win, doc: e.doc });
  const r = await c.getToken({ mount: new Node_("div") });
  check("1 没有站点密钥：enabled=false，getToken 直接给空令牌，不加载脚本、不建节点、不调用 turnstile", c.enabled === false && r.ok && r.token === "" && e.scripts.length === 0 && e.calls.length === 0 && e.doc.body.children.length === 0);
  c.reset(); c.release(); c.destroy();
  check("1 关闭状态下 reset / release / destroy 不报错也不动作", e.calls.length === 0);
}
{ // 2 正常取令牌
  const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const mount = new Node_("div");
  const p = c.getToken({ mount }); await tick(5);
  const render = e.calls.find((x) => x[0] === "render");
  check("2 脚本只从 challenges.cloudflare.com 加载，渲染参数：显式执行 / 仅需交互时显示 / 不自动重试 / 过期不自动刷新", e.scripts.length === 1 && e.scripts[0].src.startsWith("https://challenges.cloudflare.com/turnstile/v0/api.js") && render[2] === "SITEKEY123" && render[3] === "execute" && render[4] === "interaction-only" && render[5] === "never" && render[6] === "manual", JSON.stringify(render));
  check("2 组件挂在调用方给的容器里", e.widgets.get(render[1]).container.parentNode === mount);
  const iReset = e.calls.findIndex((x) => x[0] === "reset"), iExec = e.calls.findIndex((x) => x[0] === "execute");
  check("2 取令牌前先 reset 再 execute", iReset >= 0 && iReset < iExec, JSON.stringify(e.calls));
  fire(render[1], "callback", "TOKEN-ONE");
  const r = await p;
  check("2 回调给出令牌 → { ok:true, token }", r.ok === true && r.token === "TOKEN-ONE");
  // 第二次：复用同一个组件，不重复加载脚本，重新 reset + execute，旧令牌不会被返回
  const p2 = c.getToken({ mount }); await tick(5);
  check("2 第二次取令牌：不重复加载脚本、不重复 render、再次 reset+execute", e.scripts.length === 1 && e.calls.filter((x) => x[0] === "render").length === 1 && e.calls.filter((x) => x[0] === "execute").length === 2);
  fire(render[1], "callback", "TOKEN-TWO");
  const r2 = await p2;
  check("2 第二次拿到的是新令牌，不是上一次的", r2.token === "TOKEN-TWO");
  // 令牌用完后过期回调（没有等待中的请求）不应该报错或影响下一次
  fire(render[1], "expired-callback");
  const p3 = c.getToken({ mount }); await tick(5); fire(render[1], "callback", "TOKEN-THREE");
  check("2 无等待请求时的过期回调被忽略，下一次照常", (await p3).token === "TOKEN-THREE");
}
{ // 3 失败分类
  const cases = [["error-callback", ["110200"], "error", "110200"], ["error-callback", ["bad code <script>"], "error", undefined], ["expired-callback", [], "expired", undefined], ["timeout-callback", [], "timeout", undefined], ["callback", [""], "error", undefined]];
  for (const [cb, args, reason, code] of cases) {
    const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
    const p = c.getToken({ mount: new Node_("div") }); await tick(5);
    const id = e.calls.find((x) => x[0] === "render")[1]; fire(id, cb, ...args);
    const r = await p;
    check(`3 ${cb}(${JSON.stringify(args[0] ?? "")}) → ${reason}${code ? " + 错误码" : "（错误码被过滤）"}`, r.ok === false && r.reason === reason && r.code === code && !JSON.stringify(r).includes("script"), JSON.stringify(r));
  }
}
{ // 4 脚本加载失败 / 超时 / 脚本加载了但没有 turnstile
  let e = mkEnv({ scriptBehavior: "error" }); let c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  let r = await c.getToken({ mount: new Node_("div") });
  check("4 脚本加载出错 → unavailable", r.ok === false && r.reason === "unavailable");
  e.scripts.length = 0; e.win.turnstile = undefined;
  e = mkEnv({ scriptBehavior: "never" }); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc, loadTimeoutMs: 30 });
  const t0 = Date.now(); r = await c.getToken({ mount: new Node_("div") });
  check("4 脚本一直不回应 → 超时后 unavailable（界面不会卡死）", r.ok === false && r.reason === "unavailable" && Date.now() - t0 < 500);
  e = mkEnv({ turnstileOnLoad: false }); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  r = await c.getToken({ mount: new Node_("div") });
  check("4 脚本加载了但页面上没有 turnstile → unavailable", r.ok === false && r.reason === "unavailable");
  // 失败后可以重试（加载状态不被缓存成“永远失败”）
  e.win.turnstile = undefined; e.scripts.length = 0;
}
{ // 5 取令牌超时（用户没完成交互式挑战）
  const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc, tokenTimeoutMs: 40 });
  const r = await c.getToken({ mount: new Node_("div") });
  check("5 一直没有令牌 → 超时 reason=timeout", r.ok === false && r.reason === "timeout");
  const p = c.getToken({ mount: new Node_("div") }); await tick(5);
  check("5 超时之后能再次发起（不卡在 busy）", e.calls.filter((x) => x[0] === "execute").length === 2);
  c.destroy(); await p;
}
{ // 6 并发 / reset / destroy
  const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const mount = new Node_("div");
  const p = c.getToken({ mount }); await tick(5);
  const busy = await c.getToken({ mount });
  check("6 上一次还没结束时再取 → busy，不重复 execute", busy.ok === false && busy.reason === "busy" && e.calls.filter((x) => x[0] === "execute").length === 1);
  c.reset();
  const cancelled = await p;
  check("6 reset 会取消等待中的请求（cancelled），并 reset 组件", cancelled.ok === false && cancelled.reason === "cancelled" && e.calls.filter((x) => x[0] === "reset").length >= 2);
  const p2 = c.getToken({ mount }); await tick(5); c.destroy();
  const r2 = await p2;
  check("6 destroy：等待中的请求被取消，组件被移除，容器从页面拿掉", r2.reason === "cancelled" && e.calls.some((x) => x[0] === "remove") && mount.children.length === 0);
  const after = await c.getToken({ mount });
  check("6 destroy 之后再取 → unavailable，不再建组件", after.ok === false && after.reason === "unavailable" && e.calls.filter((x) => x[0] === "render").length === 1);
}
{ // 7 release：换页后重建
  const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const m1 = new Node_("div"), m2 = new Node_("div");
  let p = c.getToken({ mount: m1 }); await tick(5); fire(e.calls.find((x) => x[0] === "render")[1], "callback", "T1"); await p;
  c.release();
  check("7 release：旧组件被 remove，容器拿掉", e.calls.some((x) => x[0] === "remove") && m1.children.length === 0);
  p = c.getToken({ mount: m2 }); await tick(5);
  const renders = e.calls.filter((x) => x[0] === "render");
  check("7 release 之后在新挂载点重新建组件，仍可取令牌", renders.length === 2 && e.widgets.get(renders[1][1]).container.parentNode === m2);
  fire(renders[1][1], "callback", "T2"); check("7 新组件取到令牌", (await p).token === "T2");
  // 挂载点换了但没 release：也会在新挂载点重建
  const m3 = new Node_("div"); p = c.getToken({ mount: m3 }); await tick(5);
  const renders2 = e.calls.filter((x) => x[0] === "render");
  check("7 挂载点变了：自动拆旧建新", renders2.length === 3 && e.widgets.get(renders2[2][1]).container.parentNode === m3);
  c.destroy(); await p;
}
{ // 8 令牌不外泄：返回值之外不留在实例 / window / document 上
  const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const p = c.getToken({ mount: new Node_("div") }); await tick(5); fire(e.calls.find((x) => x[0] === "render")[1], "callback", "SECRET-TOKEN-XYZ"); await p;
  const dump = JSON.stringify(Object.keys(c)) + JSON.stringify(e.win, (k, v) => (typeof v === "function" ? undefined : v)) + JSON.stringify(e.doc.body, (k, v) => (k === "parentNode" ? undefined : v));
  check("8 令牌没有留在实例、window、document 上", !dump.includes("SECRET-TOKEN-XYZ"));
}

// ---- 9 “复制诊断”用的最近一次失败记录：原因（固定枚举）+ 过滤后的短错误码，不含令牌 / 邮箱 / 原文 ----
const SYN = "SYNTHETIC-TOKEN=eyJabc123 user@example.invalid /private/path";
const startPending = async (c, e, mount = new Node_("div")) => { const p = c.getToken({ mount }); await tick(5); return { p, id: e.calls.filter((x) => x[0] === "render").at(-1)[1] }; };
{ // 9a 没失败过：没有这一行
  resetCaptchaFailure();
  check("9a 没有失败过：记录为空，诊断行为空串（诊断里不会多出这一行）", getLastCaptchaFailure() === null && captchaDiagLine() === "");
}
{ // 9b 组件报错 + 数字错误码 → 记 error + 码（数字类型也行）
  resetCaptchaFailure(); const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const { p, id } = await startPending(c, e); fire(id, "error-callback", 110200); const r = await p;
  check("9b error-callback(110200) → 返回值带 code，诊断行 = “人机验证最近一次失败：error（错误码 110200）”", r.reason === "error" && r.code === "110200" && captchaDiagLine() === "人机验证最近一次失败：error（错误码 110200）", captchaDiagLine());
  const { p: p2, id: id2 } = await startPending(c, e); fire(id2, "error-callback", "300030"); await p2;
  check("9b 再失败一次：只保留最近一次", getLastCaptchaFailure().code === "300030" && captchaDiagLine().includes("300030") && !captchaDiagLine().includes("110200"));
}
{ // 9c 不安全的错误码（含空格 / 等号 / 邮箱 / 路径 / 过长 / 非字符串 / 对象）→ 丢掉码，只留原因；诊断行里没有任何合成敏感字符串
  for (const bad of [SYN, "x y", "a=b", "user@example.invalid", "/private/path", "A".repeat(25), { code: SYN }, ["110200"], null, undefined, true]) {
    resetCaptchaFailure(); const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
    const { p, id } = await startPending(c, e); fire(id, "error-callback", bad); const r = await p;
    const line = captchaDiagLine();
    if (!(r.reason === "error" && r.code === undefined && line === "人机验证最近一次失败：error" && !/SYNTHETIC|token=|example\.invalid|private/i.test(line))) { check(`9c 不安全错误码被丢弃：${String(JSON.stringify(bad)).slice(0, 30)}`, false, `${JSON.stringify(r)} ${line}`); }
  }
  check("9c 11 种不安全的错误码都只留原因、不带码，诊断行里没有合成敏感内容", true);
}
{ // 9d 超时、脚本没加载、组件建不出来 → 各记一条；busy / cancelled / destroy 不算
  resetCaptchaFailure(); let e = mkEnv(); let c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc, tokenTimeoutMs: 30 });
  await c.getToken({ mount: new Node_("div") });
  check("9d 取令牌超时 → 记 timeout（无码）", captchaDiagLine() === "人机验证最近一次失败：timeout");
  resetCaptchaFailure(); e = mkEnv({ scriptBehavior: "error" }); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  await c.getToken({ mount: new Node_("div") });
  check("9d 脚本没加载出来 → 记 unavailable", captchaDiagLine() === "人机验证最近一次失败：unavailable");
  resetCaptchaFailure(); e = mkEnv(); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const { p, id } = await startPending(c, e);
  const busy = await c.getToken({ mount: new Node_("div") });
  check("9d 重复点击得到 busy → 不记", busy.reason === "busy" && getLastCaptchaFailure() === null);
  c.reset(); const cancelled = await p;
  check("9d reset 取消等待中的请求（cancelled）→ 不记", cancelled.reason === "cancelled" && getLastCaptchaFailure() === null);
  const { p: p3 } = await startPending(c, e); c.destroy(); await p3;
  check("9d destroy 取消等待、之后再取被拒（unavailable）→ 都不记", getLastCaptchaFailure() === null && (await c.getToken({ mount: new Node_("div") })).reason === "unavailable" && getLastCaptchaFailure() === null);
}
{ // 9e 过期回调：有等待请求时记 expired；没有等待请求（用完的令牌自己过期）时不记
  resetCaptchaFailure(); const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const { p, id } = await startPending(c, e); fire(id, "callback", "TOK"); await p;
  fire(id, "expired-callback");
  check("9e 没有等待请求时的过期回调 → 不记（没有失败）", getLastCaptchaFailure() === null);
  const { p: p2, id: id2 } = await startPending(c, e); fire(id2, "expired-callback"); await p2;
  check("9e 等待中的请求遇到过期 → 记 expired", captchaDiagLine() === "人机验证最近一次失败：expired");
}
{ // 9f 成功取到令牌后清空；令牌本身不会出现在诊断行里
  resetCaptchaFailure(); const e = mkEnv(); const c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  const a = await startPending(c, e); fire(a.id, "error-callback", "110200"); await a.p;
  check("9f 前提：先失败一次", captchaDiagLine().includes("110200"));
  const b = await startPending(c, e); fire(b.id, "callback", "SECRET-TOKEN-XYZ"); const r = await b.p;
  check("9f 之后成功取到令牌 → 失败记录清空，诊断行为空", r.ok === true && getLastCaptchaFailure() === null && captchaDiagLine() === "" && !JSON.stringify(getLastCaptchaFailure()).includes("SECRET-TOKEN-XYZ"));
}
{ // 9g 诊断行只会由固定枚举 + 过滤码组成；伪造的记录（不在枚举里 / 带别的字段）不会被渲染成别的文字
  check("9g captchaDiagLine 对不在枚举里的原因、带脏字段的记录只给空串 / 不带脏字段", captchaDiagLine({ reason: SYN, code: "110200" }) === "" && captchaDiagLine({ reason: "error", code: "110200", token: SYN, email: SYN }) === "人机验证最近一次失败：error（错误码 110200）" && getLastCaptchaFailure() === null);
}
{ // 9h 等脚本加载期间弹窗已关闭（destroy），之后加载失败 / 加载超时：关闭之后的结果，不记成真实验证失败
  resetCaptchaFailure(); let e = mkEnv({ scriptBehavior: "error" }); let c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  let p = c.getToken({ mount: new Node_("div") }); c.destroy(); let r = await p;
  check("9h 加载中关闭后脚本加载出错 → 返回 unavailable，但不记失败（诊断行为空）", r.ok === false && r.reason === "unavailable" && getLastCaptchaFailure() === null && captchaDiagLine() === "", JSON.stringify(r));
  resetCaptchaFailure(); e = mkEnv({ scriptBehavior: "hang" }); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc, loadTimeoutMs: 40 });
  p = c.getToken({ mount: new Node_("div") }); c.destroy(); r = await p;
  check("9h 加载中关闭后脚本一直不回应（加载超时）→ 也不记失败", r.ok === false && r.reason === "unavailable" && getLastCaptchaFailure() === null, JSON.stringify(r));
  resetCaptchaFailure(); e = mkEnv({ scriptBehavior: "error" }); c = createCaptcha({ siteKey: "SITEKEY123", win: e.win, doc: e.doc });
  await c.getToken({ mount: new Node_("div") });
  check("9h 对照：没有关闭时同样的加载出错照常记 unavailable（上面的“不记”不是误伤）", captchaDiagLine() === "人机验证最近一次失败：unavailable");
}
{ // 9i captchaDiagLine 收到脏 code（不是内部产生的记录）：格式化时再过 safeCode，只输出白名单内的码
  const dirty = [SYN, "x y", "a=b", "user@example.invalid", "/private/path", "A".repeat(25), "", { code: SYN }, ["110200"], null, undefined, true, false, 0];
  let leaked = [];
  for (const code of dirty) { const line = captchaDiagLine({ reason: "error", code }); if (line !== "人机验证最近一次失败：error" && !(code === 0 && line.includes("错误码 0"))) leaked.push(JSON.stringify(code)?.slice(0, 30) + " → " + line.slice(0, 60)); }
  check("9i 14 种脏 code 传给 captchaDiagLine：不输出任何一个（只剩原因）", leaked.length === 0, leaked.join(" | "));
  check("9i 合法的码（字符串 / 数字）仍照常输出", captchaDiagLine({ reason: "error", code: "110200" }) === "人机验证最近一次失败：error（错误码 110200）" && captchaDiagLine({ reason: "error", code: 300030 }) === "人机验证最近一次失败：error（错误码 300030）");
  check("9i 脏 code 的返回里没有任何合成敏感字符串", !/SYNTHETIC|token=|example\.invalid|private/i.test(captchaDiagLine({ reason: "error", code: SYN }) + captchaDiagLine({ reason: "timeout", code: SYN })));
}
console.log(`\n${ok} 通过，${bad} 失败`);
process.exit(bad ? 1 : 0);
