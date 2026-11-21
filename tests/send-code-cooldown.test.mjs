// G-LOGIN-06 专项（纯 Node，假接口 + 假时钟，不联网）：发送 / 重发验证码的冷却分类与倒计时一致性。
// 对应 GPT1 规格：同一错误码的不同原因要分开；Retry-After 只决定等待时间、不决定原因；本地冷却拦截不是新的服务器拒绝；
// 合法的长等待不截断；120 秒等待中反复点击不加请求、不后移截止时间。运行：node tests/send-code-cooldown.test.mjs
import { createApi } from "../src/cloud-api.js";
import { createSync } from "../src/sync.js";
import { describeSendError, classifySend } from "../src/auth-errors.js";

const results = [];
const check = (n, ok, d = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${n}${!ok && d ? "  — " + d : ""}`); };
const mem = () => { const m = new Map(); return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } }; };
const PROD = "aqlcunkmggzzvyavlkjg.supabase.co";
const T0 = 1_700_000_000_000;

// 一个带假时钟的完整链路：真实 createApi（解析 Retry-After）→ 真实 createSync（冷却门禁）→ describeSendError
function rig(responses) {
  const S = { t: T0, calls: 0, queue: [...responses] };
  const fetchFn = async () => {
    S.calls++;
    const x = S.queue.length > 1 ? S.queue.shift() : S.queue[0];
    return { ok: x.status < 400, status: x.status, headers: { get: (k) => (x.headers || {})[String(k).toLowerCase()] ?? null }, text: async () => (typeof x.body === "string" ? x.body : JSON.stringify(x.body ?? {})) };
  };
  const now = () => S.t;
  const api = createApi({ url: "https://x.supabase.test", anonKey: "k", fetchFn, now, isOnline: () => true });
  const sync = createSync({ storage: mem(), api, projectId: PROD, legacyProject: PROD, now, today: () => "2026-11-21", schedule: () => 0 });
  const send = async (addr = "a@example.com") => { const r = await sync.sendCode(addr); return { r, d: describeSendError(r, { xp: 0, fails: 1 }) }; };
  return { S, send, sync, advance: (ms) => { S.t += ms; } };
}
const E_INTERVAL = { code: 429, error_code: "over_email_send_rate_limit", msg: "For security purposes, you can only request this after 45 seconds." };
const E_QUOTA = { code: 429, error_code: "over_email_send_rate_limit", msg: "email rate limit exceeded" };
const E_REQ = { code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" };
const claimsSent = (t) => /刚刚已经发过|已经发过验证码|验证码刚发过|验证码还能用|已发出|验证码已发/.test(t);

// ---------- 1. 分类矩阵：同一错误码的不同原因 ----------
for (const [label, hdr] of [["无等待头", {}], ["Retry-After:600", { "retry-after": "600" }]]) {
  let x = await rig([{ status: 429, body: E_INTERVAL, headers: hdr }]).send();
  check(`矩阵 邮箱限流码 + 发送间隔提示（${label}）→ S2：该邮箱请求间隔，不保证旧验证码仍有效`, x.d.id === "S2" && /这个邮箱|该邮箱/.test(x.d.text) && /不一定|不保证/.test(x.d.text) && !/邮件服务/.test(x.d.text), JSON.stringify(x.d));
  x = await rig([{ status: 429, body: E_QUOTA, headers: hdr }]).send();
  check(`矩阵 邮箱限流码 + email rate limit exceeded（${label}）→ S3：邮件服务限流；有等待头也不能变成 S2`, x.d.id === "S3" && /邮件服务/.test(x.d.text) && !claimsSent(x.d.text), JSON.stringify(x.d));
  x = await rig([{ status: 429, body: E_REQ, headers: hdr }]).send();
  check(`矩阵 over_request_rate_limit（${label}）→ S8 中性请求限流：不推断已发邮件或额度用完`, x.d.id === "S8" && !claimsSent(x.d.text) && !/邮件服务|额度|配额|用完/.test(x.d.text) && x.d.secondary !== "enter-code", JSON.stringify(x.d));
  x = await rig([{ status: 429, body: { msg: "slow down" }, headers: hdr }]).send();
  check(`矩阵 未知 429（无错误码，${label}）→ S8`, x.d.id === "S8" && !claimsSent(x.d.text), JSON.stringify(x.d));
  x = await rig([{ status: 429, body: { msg: "For security purposes, you can only request this after 30 seconds." }, headers: hdr }]).send();
  check(`矩阵 只有等待数字、没有已知邮箱限流码（${label}）→ S8（数字只决定等待时间，不决定原因）`, x.d.id === "S8", JSON.stringify(x.d));
}
let x = await rig([{ status: 429, body: E_QUOTA }]).send();
check("矩阵 S3 不再重新生成 5 分钟等待（没有等待信息沿用 60 秒默认，标签是实时倒计时）", x.d.cooldownMs === 60000 && x.d.cooldownLabel !== "约 5 分钟后可再试", JSON.stringify(x.d));
// 不误分类：网络 / 5xx / CAPTCHA / 其他 4xx
const kinds = [
  [{ ok: false, kind: "network", offline: true }, "S1a"], [{ ok: false, kind: "network", timedOut: true }, "S1b"], [{ ok: false, kind: "network" }, "S1b"],
  [{ ok: false, kind: "server", status: 500, errorCode: "unexpected_failure", message: "Error sending magic link email" }, "S4"], [{ ok: false, kind: "server", status: 503, message: "x" }, "S4"],
  [{ ok: false, kind: "captcha", reason: "unavailable" }, "K1"], [{ ok: false, kind: "captcha", reason: "timeout" }, "K2"], [{ ok: false, kind: "server", status: 400, errorCode: "captcha_failed", message: "x" }, "K4"],
  [{ ok: false, kind: "server", status: 400, errorCode: "email_address_not_authorized", message: "x" }, "S5"], [{ ok: false, kind: "server", status: 400, message: "weird" }, "S6"],
  [{ ok: false, kind: "unknown" }, "S7"],
];
check("矩阵 网络 / 5xx / CAPTCHA / 其他 4xx / 未知 不被限流类误收", kinds.every(([r, id]) => classifySend(r) === id), JSON.stringify(kinds.map(([r]) => classifySend(r))));
check("矩阵 429 但带 captcha_failed 仍是 K4（人机验证优先）", classifySend({ ok: false, kind: "rate-limit", status: 429, errorCode: "captcha_failed" }) === "K4");

// ---------- 2. 返回字段契约（同步层 → 界面） ----------
{
  const R = rig([{ status: 429, body: E_REQ, headers: { "retry-after": "120" } }]);
  const a = await R.send();
  check("契约 服务器限流：kind=rate-limit，retryAt = 实际门禁截止时间，waitMs = 剩余等待，localBlock=false", a.r.kind === "rate-limit" && a.r.retryAt === T0 + 120000 && a.r.waitMs === 120000 && a.r.localBlock === false && a.d.cooldownMs === 120000 && a.d.retryAt === T0 + 120000, JSON.stringify(a.r));
  check("契约 界面倒计时是全局（scope 为空），不标成仅针对某个邮箱", a.d.scope === "", JSON.stringify(a.d));
}

// ---------- 3. 假时钟：120 秒等待中反复点击 ----------
for (const [label, body, id] of [["over_request_rate_limit", E_REQ, "S8"], ["邮箱发送间隔", E_INTERVAL, "S2"], ["邮件服务限流", E_QUOTA, "S3"]]) {
  const R = rig([{ status: 429, body, headers: { "retry-after": "120" } }, { status: 200, body: {} }]);
  const first = await R.send();
  R.advance(1000);
  const second = await R.send();
  check(`假时钟（${label}）第 1 次：${id}，等待 120 秒`, first.d.id === id && first.d.cooldownMs === 120000, JSON.stringify(first.d));
  check(`假时钟（${label}）1 秒后再点：被本地挡住（HTTP 仍 1 次），截止时间不后移，界面剩余 119 秒（不是重新计满 120 / 300 秒）`, R.S.calls === 1 && second.r.localBlock === true && second.r.retryAt === T0 + 120000 && second.d.id === "S9" && second.d.cooldownMs === 119000 && second.d.retryAt === T0 + 120000, JSON.stringify([R.S.calls, second.r, second.d]));
  check(`假时钟（${label}）本地拦截提示是中性等待：不说“又被服务器拒绝”、不说验证码已发`, !claimsSent(second.d.text) && !/服务器|邮件服务|额度/.test(second.d.text) && /119 秒/.test(second.d.text), second.d.text);
  for (let i = 0; i < 6; i++) { R.advance(500); await R.send(); }
  const afterSpam = await R.send();
  check(`假时钟（${label}）反复点击 7 次：HTTP 请求数不增加，截止时间仍是原来的`, R.S.calls === 1 && afterSpam.r.retryAt === T0 + 120000, `calls=${R.S.calls} retryAt=${afterSpam.r.retryAt}`);
  R.S.t = T0 + 119999; const edge = await R.send();
  check(`假时钟（${label}）差 1 毫秒到期仍被挡`, R.S.calls === 1 && edge.r.localBlock === true);
  R.S.t = T0 + 120000; const ok1 = await R.send(); const ok2 = await R.send();
  check(`假时钟（${label}）到期后用户请求只多 1 次 HTTP（第二次点击是新的一次请求，不是被误挡）`, R.S.calls === 3 && ok2.r.ok === true, `calls=${R.S.calls}`);
}
// 换邮箱不重新计满
{
  const R = rig([{ status: 429, body: E_INTERVAL, headers: { "retry-after": "120" } }, { status: 200, body: {} }]);
  await R.send("a@example.com"); R.advance(30000);
  const b = await R.send("b@example.com");
  check("换邮箱：同样被实际门禁（全局）挡住，剩余 90 秒，截止时间不变，HTTP 不增加", R.S.calls === 1 && b.r.retryAt === T0 + 120000 && b.d.cooldownMs === 90000 && b.d.id === "S9", JSON.stringify(b.d));
  const R2 = rig([{ status: 429, body: E_INTERVAL, headers: { "retry-after": "120" } }, { status: 200, body: {} }]);
  await R2.send(); R2.advance(1000);
  const reopened = await R2.send(); // 重开弹窗 = 新界面从头调用同一个 sync
  check("重开弹窗：界面新状态下点发送，仍是原截止时间（不重新计满）", reopened.r.retryAt === T0 + 120000 && reopened.d.cooldownMs === 119000 && R2.S.calls === 1, JSON.stringify(reopened.d));
}

// ---------- 4. 等待数值：长等待 / 零值 / 缺失 / 非法 / HTTP 日期 ----------
{
  let R = rig([{ status: 429, body: E_REQ, headers: { "retry-after": "7200" } }]);
  let a = await R.send();
  check("长等待 Retry-After:7200 → 等待 7200 秒，不截成一小时（同步层与界面一致）", a.r.waitMs === 7200000 && a.d.cooldownMs === 7200000 && a.d.retryAt === T0 + 7200000 && /2 小时/.test(a.d.text), JSON.stringify(a.d));
  R = rig([{ status: 429, body: E_QUOTA, headers: { "retry-after": "7200" } }]); a = await R.send();
  check("长等待 + 邮件服务限流 S3：同样 7200 秒，不重新生成 5 分钟", a.d.id === "S3" && a.d.cooldownMs === 7200000, JSON.stringify(a.d));
  R = rig([{ status: 429, body: E_REQ, headers: { "retry-after": "0" } }]); a = await R.send();
  check("合法零值 Retry-After:0 → 按现有最短 5 秒", a.r.waitMs === 5000 && a.d.cooldownMs === 5000, JSON.stringify(a.d));
  for (const bad of [undefined, "", "abc", "-5", "1.5"]) {
    R = rig([{ status: 429, body: E_REQ, headers: bad === undefined ? {} : { "retry-after": bad } }]); a = await R.send();
    check(`缺失 / 非法等待头（${JSON.stringify(bad)}）→ 沿用 #141 的 60 秒默认`, a.r.waitMs === 60000 && a.d.cooldownMs === 60000, JSON.stringify(a.d));
  }
  const date = new Date(T0 + 90_000).toUTCString();
  R = rig([{ status: 429, body: E_REQ, headers: { "retry-after": date } }]); a = await R.send();
  check("HTTP 日期形式的等待（90 秒后）→ 等待 90 秒", a.r.waitMs === 90000 && a.d.cooldownMs === 90000, JSON.stringify(a.d));
  R = rig([{ status: 429, body: E_REQ, headers: { "retry-after": "86400" } }]); a = await R.send();
  check("一天的等待也不截断", a.d.cooldownMs === 86400000 && a.r.retryAt === T0 + 86400000);
}

// 直接描述原始接口结果（没有经过同步层、没有 waitMs）：界面文案层自己的兜底规则必须和同步层一致
{
  const raw = (sec) => describeSendError({ ok: false, kind: "rate-limit", status: 429, errorCode: "over_request_rate_limit", ...(sec === undefined ? {} : { retryAfterSec: sec }) });
  check("原始结果兜底：7200 秒不截断；0 秒抬到 5 秒；缺失 60 秒；120 秒原样", raw(7200).cooldownMs === 7200000 && raw(0).cooldownMs === 5000 && raw(undefined).cooldownMs === 60000 && raw(120).cooldownMs === 120000 && raw(1).cooldownMs === 5000, JSON.stringify([7200, 0, undefined, 120, 1].map((v) => raw(v).cooldownMs)));
}

// ---------- 5. 不误伤其他流程 ----------
{
  const R = rig([{ status: 500, body: { code: 500, error_code: "unexpected_failure", msg: "Error sending magic link email" } }, { status: 500, body: {} }]);
  const a = await R.send(); const b = await R.send();
  check("S4 服务故障：不进入限流门禁（不返回 retryAt），连续点击每次都发请求", a.d.id === "S4" && a.r.retryAt === undefined && b.d.id === "S4" && R.S.calls === 2, JSON.stringify([a.r, R.S.calls]));
  const ok = rig([{ status: 200, body: {} }]); const s = await ok.send();
  check("成功发送：返回 ok，没有限流字段", s.r.ok === true && s.r.retryAt === undefined && s.r.waitMs === undefined);
}

const bad = results.filter((v) => !v).length;
console.log(`\n共 ${results.length} 项，失败 ${bad} 项`);
process.exit(bad ? 1 : 0);
