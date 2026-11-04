// docs/15 §5：别的设备选择“用本机覆盖云端”（代数 +1）后，这台设备上还没同步的进度会被替换。
// 不能静默丢掉：同步层要发出通知（onNotice("replaced", …)），界面显示“这个账号的进度已在别的设备上被替换”。纯 Node。
import { createSync, AUTH_KEY } from "../src/sync.js";
import { saveAccount, setCurrentAccount, loadAccount } from "../src/account-store.js";
import { emptyDoc, docToState, sumXp } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok); console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`); };

function setup({ learnOffline }) {
  const mem = new Map();
  const storage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
  const clock = 1_000_000;
  const old = emptyDoc({ gen: 1, lineage: "L1" }); old.xp.devB = 20;
  let row = { doc: old, rev: 3 };
  const api = {
    async refresh() { return { ok: false, kind: "auth" }; },
    async getProgress() { return { ok: true, row: JSON.parse(JSON.stringify(row)) }; },
    async createProgress() { return { ok: true, rev: null }; },
    async saveProgress(s, exp, doc) { if (exp !== row.rev) return { ok: true, rev: null }; row = { doc, rev: row.rev + 1 }; return { ok: true, rev: row.rev }; },
  };
  saveAccount(storage, "u1", { doc: old, base: 3, dirty: { hearts: false, prefs: false } }, { now: clock });
  setCurrentAccount(storage, "u1");
  storage.setItem(AUTH_KEY, JSON.stringify({ session: { accessToken: "a", refreshToken: "r", expiresAt: clock + 3600_000, userId: "u1", email: "" } }));
  const notices = [];
  const sync = createSync({ storage, api, now: () => clock, today: () => "2026-11-04", schedule: () => 0, onNotice: (kind, info) => notices.push({ kind, info }) });
  const r = sync.restore(freshState());
  if (learnOffline) { const s = { ...r.state, xp: r.state.xp + 50, lessonsCompleted: r.state.lessonsCompleted + 1, done: { ...r.state.done, U1L1: true } }; sync.persistLocal(s); }
  // 另一台设备选择覆盖：云端变成第 2 代
  const fresh = emptyDoc({ gen: 2, lineage: "L2" }); fresh.xp.devC = 10;
  row = { doc: fresh, rev: row.rev + 1 };
  return { sync, notices, storage };
}

{
  const { sync, notices, storage } = setup({ learnOffline: true });
  const r = await sync.syncNow();
  const L = loadAccount(storage, "u1", { now: 1_000_000 });
  check("同步成功，本机换成云端的第 2 代", r.ok && L.copy.doc.gen === 2 && sumXp(L.copy.doc) === 10);
  check("有未同步的学习内容被替换 → 发出 replaced 通知", notices.some((n) => n.kind === "replaced"), JSON.stringify(notices));
  check("同步结果里也标明 replacedLocal", r.replacedLocal === true);
  const r2 = await sync.syncNow();
  check("同一次替换只通知一次", notices.filter((n) => n.kind === "replaced").length === 1 && !r2.replacedLocal);
}
{
  const { sync, notices } = setup({ learnOffline: false });
  const r = await sync.syncNow();
  check("本机没有未同步的学习内容 → 不通知（只是正常换代）", r.ok && notices.length === 0 && !r.replacedLocal, JSON.stringify(notices));
}
{ // 正常同步后标记会清掉：之后云端再换代，不应误报
  const { sync, notices, storage } = setup({ learnOffline: false });
  await sync.syncNow();
  check("没有学习时，本机副本没有“未上传内容”标记", loadAccount(storage, "u1", { now: 1_000_000 }).copy.dirty.content === false);
}

const pass = results.filter(Boolean).length;
console.log(`\n覆盖后的替换通知：${pass}/${results.length} 通过`);
process.exit(pass === results.length ? 0 : 1);
