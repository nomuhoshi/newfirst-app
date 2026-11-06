// R1（损坏游客导入待办守卫）× DB-3.1（退出异常修复）整合验证：故障注入，真实 createApi（只替换 fetch）→ 真实 createSync。
// 重点：R1 在 logout 里“手写的本机清理”不能只凭效果等价放行——每条失败路径都要证明：
//   ① 损坏 / 读不出的待办下，普通退出一个云端请求都不发（包括 refresh / logout / 任何 rest 调用）；
//   ② 强制退出遇到账号指针 / 凭证清理失败（报错、静默无效、先删后报错）能回滚，游客记录、损坏待办、账号副本逐字节保留；
//   ③ 成功的强制退出同样逐字节保留这三样，且零网络；
//   ④ 待办正常时，bad_jwt + 刷新返回通用错误仍保持登录（不被 R1 的守卫或 Q 段逻辑互相绕过）。
// 运行：node tests/r1-logout-integration.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createSync, AUTH_KEY } from "../src/sync.js";
import { createApi } from "../src/cloud-api.js";
import { GUEST_KEY, DEVICE_KEY, SESSION_KEY, getGuestId, loadPendingImport, saveAccount, setCurrentAccount, getCurrentAccount } from "../src/account-store.js";
import { emptyDoc, guestFingerprint } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const NOW = 1_000_000, TODAY = "2026-11-05", UID = "uInteg", MAIL = "integ@example.test";
const PENDING_KEY = `suipian.acct.import.${UID}`, ACCT_KEY = `suipian.acct.${UID}`;
const clone = (x) => JSON.parse(JSON.stringify(x));
const sessionObj = () => ({ userId: UID, email: MAIL, accessToken: "at-1", refreshToken: "rt-1", expiresAt: NOW + 3_600_000 });

function mem() {
  const m = new Map();
  return { _m: m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, removeItem: (k) => { m.delete(k); } };
}
function resp(status, body) { return { ok: status >= 200 && status < 300, status, text: async () => (body === undefined ? "" : typeof body === "string" ? body : JSON.stringify(body)) }; }

// 返回 { raw, api, fetches, sync(storage), snapshot() }。fetchFn 的默认行为：任何请求都记录；handler 可按路径覆盖。
function fixture({ pendingRaw = "{bad json", handler = null } = {}) {
  const raw = mem(); raw.setItem(DEVICE_KEY, "devInteg");
  const guest = { ...freshState(), onboarded: true, xp: 80, lessonsCompleted: 5, done: { U1L1: true, U1L2: true }, streak: 1, lastDay: TODAY };
  const guestRaw = JSON.stringify(guest); raw.setItem(GUEST_KEY, guestRaw);
  const gid = getGuestId(raw).id;
  const doc = emptyDoc({ gen: 1, lineage: "L-integ" });
  doc.xp.devInteg = 80; doc.runs.devInteg = 5; doc.done = { U1L1: "2026-11-04", U1L2: TODAY }; doc.days = ["2026-11-04", TODAY]; doc.imported[gid] = true;
  assert.equal(saveAccount(raw, UID, { doc, base: 7, dirty: { content: true, hearts: false, prefs: false } }, { now: NOW }), true);
  assert.equal(setCurrentAccount(raw, UID), true);
  raw.setItem(AUTH_KEY, JSON.stringify({ session: sessionObj() }));
  if (pendingRaw !== null) raw.setItem(PENDING_KEY, pendingRaw);
  const fetches = [];
  const fetchFn = async (url, o) => {
    const path = url.replace("https://x.supabase.co", "");
    fetches.push(o.method + " " + path.split("?")[0]);
    if (handler) { const r = handler(path, o); if (r) return r; }
    return resp(500, "unexpected request in a locked state");
  };
  const api = createApi({ url: "https://x.supabase.co", anonKey: "anon", fetchFn });
  const make = (storage = raw) => createSync({ storage, api, now: () => NOW, today: () => TODAY, schedule: () => 0 });
  const snapshot = () => ({ guest: raw.getItem(GUEST_KEY), pending: raw.getItem(PENDING_KEY), account: raw.getItem(ACCT_KEY), auth: raw.getItem(AUTH_KEY), pointer: raw.getItem(SESSION_KEY) });
  return { raw, api, fetches, make, snapshot, guestRaw, gid };
}
const keep = (s) => ({ guest: s.guest, pending: s.pending, account: s.account }); // 游客记录 + 待办 + 账号副本

// ① 损坏 / 读不出的待办下，普通退出零云端请求（即使云端会说 bad_jwt、刷新会说通用错误，也根本不会走到）
for (const variant of ["corrupt", "read-failed"]) {
  test(`INT-1 ${variant}：普通退出一个云端请求都不发，返回锁定失败，三样数据逐字节不变`, async () => {
    const f = fixture({ handler: (p) => (p.startsWith("/auth/v1/logout") ? resp(403, { error_code: "bad_jwt", msg: "invalid JWT" }) : p.startsWith("/auth/v1/token") ? resp(403, { error_code: "not_admin" }) : null) });
    let storage = f.raw;
    if (variant === "read-failed") storage = { getItem: (k) => { if (k === PENDING_KEY) throw new Error("storage read failure"); return f.raw.getItem(k); }, setItem: (k, v) => f.raw.setItem(k, v), removeItem: (k) => f.raw.removeItem(k) };
    const sync = f.make(storage);
    assert.ok(sync.restore(freshState()));
    const before = f.snapshot();
    const r = await sync.logout();
    assert.equal(r.ok, false);
    assert.equal(r.kind, variant === "corrupt" ? "import-corrupt" : "import-read-failed");
    assert.deepEqual(f.fetches, [], "锁定后不得有任何云端请求");
    assert.deepEqual(f.snapshot(), before);
    assert.equal(sync.account()?.userId, UID, "仍是登录态，没有半退出");
    assert.equal(sync.status().status, variant === "corrupt" ? "import-recovery-required" : "import-read-failed");
  });
}

// ② 强制退出的失败矩阵：每种故障都必须回滚（账号指针、凭证回到登录态），三样数据 + 凭证逐字节保留，零网络
const FAULTS = {
  "指针删除抛错": (raw) => ({ removeItem(k) { if (k === SESSION_KEY) throw new Error("denied"); return raw.removeItem(k); } }),
  "指针删除静默无效": (raw) => ({ removeItem(k) { if (k === SESSION_KEY) return; return raw.removeItem(k); }, setItem(k, v) { if (k === SESSION_KEY) return; return raw.setItem(k, v); } }),
  "凭证删除抛错（写入仍可用，不会用撤销标记蒙混过关）": (raw) => ({ removeItem(k) { if (k === AUTH_KEY) throw new Error("denied"); return raw.removeItem(k); } }),
  "凭证删除静默无效": (raw) => ({ removeItem(k) { if (k === AUTH_KEY) return; return raw.removeItem(k); } }),
  "凭证先删后报错再回滚指针": (raw) => ({ removeItem(k) { if (k === AUTH_KEY) { raw.removeItem(k); throw new Error("removed then failed"); } return raw.removeItem(k); } }),
};
for (const [name, mk] of Object.entries(FAULTS)) {
  test(`INT-2 强制退出遇到「${name}」：见下方断言（回滚或如实报告，数据不丢，零网络）`, async () => {
    const f = fixture({ handler: () => null });
    const storage = { getItem: (k) => f.raw.getItem(k), setItem: (k, v) => f.raw.setItem(k, v), removeItem: (k) => f.raw.removeItem(k), ...mk(f.raw) };
    const sync = f.make(storage);
    assert.ok(sync.restore(freshState()));
    const before = f.snapshot();
    const r = await sync.forceLocalLogout();
    assert.deepEqual(f.fetches, [], "强制本机退出零网络");
    assert.deepEqual(keep(f.snapshot()), keep(before), "游客记录、损坏待办、账号副本逐字节保留");
    if (name === "凭证先删后报错再回滚指针") {
      // 删除其实已生效（读回确认为空）：这是真的退出成功，凭证没了、指针没了、数据都在
      assert.equal(r.ok, true); assert.equal(r.cloudSessionMaybeValid, true);
      assert.equal(f.raw.getItem(AUTH_KEY), null); assert.equal(getCurrentAccount(f.raw), null);
      assert.equal(sync.account(), null);
      return;
    }
    assert.equal(r.ok, false, "清理没有真正完成就不能宣称已退出");
    assert.equal(r.kind, "local");
    assert.equal(r.rollbackFailed, false, "回滚成功");
    assert.deepEqual(f.snapshot(), before, "回滚后账号指针、凭证也和故障前逐字节一致（仍是登录态）");
    assert.equal(sync.account()?.userId, UID);
    assert.equal(sync.status().status, "import-recovery-required");
    // 故障解除后可以重试成功
    const healthy = f.make(f.raw); healthy.restore(freshState());
    const again = await healthy.forceLocalLogout();
    assert.equal(again.ok, true); assert.equal(f.raw.getItem(AUTH_KEY), null); assert.equal(getCurrentAccount(f.raw), null);
    assert.deepEqual(keep(f.snapshot()), keep(before));
    assert.deepEqual(f.fetches, []);
  });
}

// ③ 成功的强制退出：零网络，三样数据逐字节保留，损坏待办仍然是 corrupt（没有被“修好”或清掉），重开后不会复活登录
test("INT-3 强制退出成功：零网络；游客记录、损坏待办、账号副本逐字节保留；重开页面不复活登录；待办仍是 corrupt", async () => {
  const f = fixture({ handler: () => null });
  const sync = f.make(); sync.restore(freshState());
  const before = f.snapshot();
  const r = await sync.forceLocalLogout();
  assert.equal(r.ok, true); assert.equal(r.cloudSessionMaybeValid, true); assert.equal(r.warning, "cloud-session-maybe-valid");
  assert.deepEqual(f.fetches, []);
  assert.deepEqual(keep(f.snapshot()), keep(before));
  assert.equal(f.raw.getItem(AUTH_KEY), null); assert.equal(getCurrentAccount(f.raw), null);
  assert.equal(loadPendingImport(f.raw, UID).code, "corrupt");
  const reopened = f.make(); assert.equal(reopened.restore(freshState()), null); assert.equal(reopened.account(), null);
});

// ③b 同样的路径用 logout({force:true})（非 forceLocal）：损坏待办下也是纯本机，不去碰云端
test("INT-3b logout({force:true}) 遇到损坏待办：同样纯本机、零网络、数据保留", async () => {
  const f = fixture({ handler: () => null });
  const sync = f.make(); sync.restore(freshState());
  const before = f.snapshot();
  const r = await sync.logout({ force: true });
  assert.equal(r.ok, true); assert.deepEqual(f.fetches, []); assert.deepEqual(keep(f.snapshot()), keep(before));
});

// ④ 待办正常（没有损坏）：R1 的守卫不能影响 bad_jwt 的判断——刷新返回通用错误仍保持登录，游客记录与账号副本不动
const GENERIC = {
  "403 not_admin": () => resp(403, { code: 403, error_code: "not_admin", msg: "User not allowed" }),
  "404 Route not found": () => resp(404, "Route not found"),
  "400 invalid_request": () => resp(400, { error: "invalid_request", error_description: "refresh_token required" }),
};
for (const [name, tok] of Object.entries(GENERIC)) {
  test(`INT-4 待办正常：logout 返回 bad_jwt，刷新返回 ${name} → 保持登录，凭证 / 游客记录 / 账号副本原样`, async () => {
    const f = fixture({ pendingRaw: null, handler: (p) => {
      if (p.startsWith("/rest/v1/progress")) return resp(200, [{ doc: JSON.parse(f.raw.getItem(ACCT_KEY)).doc, rev: 7 }]);
      if (p.startsWith("/auth/v1/logout")) return resp(403, { code: 403, error_code: "bad_jwt", msg: "invalid JWT: token is expired" });
      if (p.startsWith("/auth/v1/token")) return tok();
      return null;
    } });
    const sync = f.make(); sync.restore(freshState());
    // 先让本机副本变成“已同步”（避免退出前先同步的分支干扰判断）
    const acct = JSON.parse(f.raw.getItem(ACCT_KEY)); acct.dirty = { content: false, hearts: false, prefs: false }; acct.base = 7; f.raw.setItem(ACCT_KEY, JSON.stringify(acct));
    const s2 = f.make(); s2.restore(freshState());
    const before = f.snapshot();
    f.fetches.length = 0;
    const r = await s2.logout();
    assert.equal(r.ok, false); assert.equal(r.stayed, true);
    const norm = (x) => ({ ...x, account: JSON.parse(x.account) }); // 退出失败回滚会按规范格式重写副本（键顺序可能不同），内容必须相同
    assert.deepEqual(norm(f.snapshot()), norm(before));
    assert.equal(s2.account()?.userId, UID);
    assert.equal(f.fetches.filter((x) => x.includes("/auth/v1/logout")).length, 1);
    assert.equal(f.fetches.filter((x) => x.includes("/auth/v1/token")).length, 1);
  });
}
