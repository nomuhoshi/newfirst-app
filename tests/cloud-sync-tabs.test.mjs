// 同一浏览器开两个标签页（共用 localStorage）时的登录令牌刷新。纯 Node，运行：node tests/cloud-sync-tabs.test.mjs
// 假服务器按 Supabase 默认行为：刷新令牌一次性轮换；已用过的刷新令牌在复用宽限期（10 秒）之后再用 → 整个会话作废（防令牌被盗）。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { saveAccount, setCurrentAccount } from "../src/account-store.js";
import { emptyDoc } from "../src/account-data.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

function setup() {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const S = { clock: 1_000_000, issued: new Map(), revoked: false, n: 0, refreshCalls: 0 };
  const REUSE_MS = 10_000;
  const mk = (rt, life = 3600_000) => ({ accessToken: "at-" + rt, refreshToken: rt, expiresAt: S.clock + life, userId: "u1", email: "a@b.c" });
  S.issued.set("rt0", { usedAt: null });
  const api = {
    async refresh(s) {
      S.refreshCalls++;
      const t = S.issued.get(s.refreshToken);
      if (S.revoked || !t) return { ok: false, kind: "auth", message: "Invalid Refresh Token" };
      if (t.usedAt !== null && S.clock - t.usedAt > REUSE_MS) { S.revoked = true; return { ok: false, kind: "auth", message: "Invalid Refresh Token: Already Used" }; }
      if (t.usedAt === null) t.usedAt = S.clock;
      const rt = "rt" + (++S.n); S.issued.set(rt, { usedAt: null });
      return { ok: true, session: mk(rt) };
    },
    async getProgress() { return S.revoked ? { ok: false, kind: "auth", message: "会话已作废" } : { ok: true, row: null }; },
    async createProgress() { return { ok: true, rev: 1 }; },
    async saveProgress() { return { ok: true, rev: 2 }; },
  };
  saveAccount(storage, "u1", { doc: emptyDoc(), base: null, dirty: { hearts: false, prefs: false } }, { now: S.clock });
  setCurrentAccount(storage, "u1");
  storage.setItem(AUTH_KEY, JSON.stringify({ session: mk("rt0", 30_000) })); // 30 秒后过期：同步时需要刷新
  const opts = { storage, api, now: () => S.clock, today: () => "2026-11-04", schedule: () => 0 };
  const A = createSync(opts), B = createSync(opts);
  A.restore(); B.restore();
  return { S, A, B, storage };
}

{ // 1. A 刷新后，B 过了宽限期才同步：B 应该用 A 存下的新令牌，而不是拿旧令牌去刷新（会让整个会话作废）
  const { S, A, B } = setup();
  const ra = await A.syncNow();
  S.clock += 20_000;
  const rb = await B.syncNow();
  check("A 标签页刷新令牌后同步成功", ra.ok);
  check("B 标签页沿用 A 刷新后的令牌，同步成功", rb.ok, rb.message || "");
  check("会话没有被服务器作废", !S.revoked);
  check("整个过程只刷新了一次", S.refreshCalls === 1, `刷新 ${S.refreshCalls} 次`);
  const ra2 = await A.syncNow();
  check("之后 A 仍然能同步", ra2.ok, A.status().status);
}

{ // 2. 存储里的凭证属于别的账号时，不能被借用
  const { S, A, storage } = setup();
  storage.setItem(AUTH_KEY, JSON.stringify({ session: { accessToken: "x", refreshToken: "rtX", expiresAt: S.clock + 3600_000, userId: "u2", email: "x@y.z" } }));
  const r = await A.syncNow();
  check("不借用别的账号的凭证（仍按自己的令牌刷新）", r.ok && S.refreshCalls === 1 && A.account().userId === "u1");
}

const pass = results.filter(Boolean).length;
console.log(`\n两个标签页的令牌刷新：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
