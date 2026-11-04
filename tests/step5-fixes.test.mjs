// PR #11 数据完整性修复的针对性回归测试（纯 Node，模块测试，不是真实学习流程）。运行：node tests/step5-fixes.test.mjs
import * as D from "../src/account-data.js";
import * as S from "../src/account-store.js";
import { freshState, HEART_REGEN_MS } from "../src/storage.js";

let fails = 0, total = 0;
function check(name, fn) {
  total++; let ok = false, detail = "";
  try { ok = !!fn(); } catch (e) { detail = "  — 抛错：" + e.message; }
  if (!ok) fails++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail}`);
}
function fakeStorage({ failRead = false, failWrite = false, failRemove = false } = {}) {
  const m = new Map();
  const s = {
    failRead, failWrite, failRemove,
    getItem: (k) => { if (s.failRead) throw new Error("SecurityError"); return m.has(k) ? m.get(k) : null; },
    setItem: (k, v) => { if (s.failWrite) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { if (s.failRemove) throw new Error("SecurityError"); m.delete(k); },
    raw: m,
  };
  return s;
}
const NOW = Date.UTC(2026, 10, 3, 3, 0, 0);
const DEV = "devA", G = "guest1";
const guest = (o = {}) => ({ ...freshState(), xp: 130, hearts: 3, heartsAt: NOW - 10 * 60000, streak: 3, lastDay: "2026-11-02", done: { U1L1: true }, lessonsCompleted: 4, ...o });

// 1. 两次同步之间学了多天
check("1 两次同步之间连续学了 3 天（11-03…11-05）：三天都进入 days，不只最后一天", () => {
  const doc = D.guestToDoc(guest(), { deviceId: DEV, guestId: G, now: NOW }).doc; // days 10-31…11-02
  const st = { ...D.docToState(doc, null, NOW), lastDay: "2026-11-05", streak: 6 };
  const r = D.syncStateIntoDoc(doc, st, { deviceId: DEV, today: "2026-11-05", now: NOW });
  return ["2026-11-03", "2026-11-04", "2026-11-05"].every((d) => r.doc.days.includes(d)) && r.doc.days.length === 6 && r.changed.days;
});
check("1 历史日期不截断：中间断过的旧日期在同步后仍保留", () => {
  const doc = { ...D.emptyDoc({ lineage: "L1" }), days: ["2026-01-01", "2026-10-31"] };
  const r = D.syncStateIntoDoc(doc, { ...freshState(), lastDay: "2026-11-02", streak: 1 }, { deviceId: DEV, today: "2026-11-02", now: NOW });
  return JSON.stringify(r.doc.days) === JSON.stringify(["2026-01-01", "2026-10-31", "2026-11-02"]);
});

// 2. 没有记录 / 读取失败 / 损坏
check("2 账号副本读取失败：返回 read-failed，不是“没有副本”", () => {
  const st = fakeStorage(); S.saveAccount(st, "userA", { doc: D.emptyDoc() }); st.failRead = true;
  const r = S.loadAccount(st, "userA"); return r.ok === false && r.code === "read-failed";
});
check("2 没有副本 → copy:null；损坏 → corrupt（三种区分）", () => {
  const st = fakeStorage(); st.setItem("suipian.acct.userB", "{bad");
  return S.loadAccount(st, "userA").copy === null && S.loadAccount(st, "userB").code === "corrupt";
});
check("2 读取失败时以为是空副本去保存（expectEmpty）：拒绝写入，原有副本不被覆盖", () => {
  const st = fakeStorage(); const doc = { ...D.emptyDoc(), xp: { devA: 500 } }; S.saveAccount(st, "userA", { doc });
  const before = st.raw.get("suipian.acct.userA"); st.failRead = true;
  const w = S.saveAccount(st, "userA", { doc: D.emptyDoc() }, { expectEmpty: true });
  return w === false && st.raw.get("suipian.acct.userA") === before;
});
check("2 游客记录：none / read-failed / corrupt / ok 四种区分", () => {
  const a = fakeStorage(), b = fakeStorage({ failRead: true }), c = fakeStorage(), d = fakeStorage();
  c.setItem(S.GUEST_KEY, "{bad"); d.setItem(S.GUEST_KEY, JSON.stringify(guest()));
  return S.readGuest(a).status === "none" && S.readGuest(b).status === "read-failed" && S.readGuest(c).status === "corrupt" && S.readGuest(d).status === "ok";
});

// 3. 设备编号保存失败
check("3 设备编号写不进去：明确返回失败，不给每次都不同的临时编号", () => {
  const st = fakeStorage({ failWrite: true }); const a = S.getDeviceId(st), b = S.getDeviceId(st);
  return a.ok === false && a.code === "save-failed" && b.ok === false;
});
check("3 设备编号读取失败：返回 read-failed，不生成新编号覆盖", () => {
  const st = fakeStorage(); const id = S.getDeviceId(st).id; st.failRead = true;
  const r = S.getDeviceId(st); st.failRead = false;
  return r.ok === false && r.code === "read-failed" && S.getDeviceId(st).id === id;
});

// 4. 导入后游客又有新进度
check("4 导入后游客又学了：返回 guest-changed + 两个选择，云端不变、不累加", () => {
  const first = D.replaceWithGuest(guest(), { deviceId: DEV, guestId: G, now: NOW }).doc;
  const r = D.replaceWithGuest(guest({ xp: 150, lessonsCompleted: 5 }), { deviceId: DEV, guestId: G, cloudDoc: first, now: NOW });
  return r.outcome === "guest-changed" && r.choices.join() === "keep-cloud,replace" && D.sumXp(r.doc) === 130;
});
check("4 选“保留云端”：云端原样；选“替换”：代数 +1，XP = 新快照（150，不是 280）", () => {
  const first = D.replaceWithGuest(guest(), { deviceId: DEV, guestId: G, now: NOW }).doc;
  const g2 = guest({ xp: 150, lessonsCompleted: 5 });
  const k = D.replaceWithGuest(g2, { deviceId: DEV, guestId: G, cloudDoc: first, now: NOW, choice: "keep-cloud" });
  const r = D.replaceWithGuest(g2, { deviceId: DEV, guestId: G, cloudDoc: first, now: NOW, choice: "replace" });
  const again = D.replaceWithGuest(g2, { deviceId: DEV, guestId: G, cloudDoc: r.doc, now: NOW });
  return k.outcome === "kept-cloud" && D.docsEquivalent(k.doc, first) && r.outcome === "replaced" && r.doc.gen === 2 && D.sumXp(r.doc) === 150 && again.outcome === "already-imported";
});
check("4 只是红心计时 / 设置变化，不算新进度：仍是 already-imported", () => {
  const first = D.replaceWithGuest(guest(), { deviceId: DEV, guestId: G, now: NOW }).doc;
  return D.replaceWithGuest(guest({ hearts: 5, heartsAt: NOW, lastActive: NOW }), { deviceId: DEV, guestId: G, cloudDoc: first, now: NOW }).outcome === "already-imported";
});

// 5. 上传期间游客继续学习
check("5 上传期间游客又答了题：清理前比对快照，不一致 → 保留本机游客记录", () => {
  const st = fakeStorage(); st.setItem(S.GUEST_KEY, JSON.stringify(guest()));
  const snap = S.readGuestRaw(st); const up = D.guestToDoc(JSON.parse(snap), { deviceId: DEV, guestId: G, now: NOW }).doc;
  st.setItem(S.GUEST_KEY, JSON.stringify(guest({ xp: 140 }))); const cur = S.readGuestRaw(st);
  const r = S.clearGuestAfterVerified(st, { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: up, guestSnapshotRaw: snap });
  return r === false && S.readGuestRaw(st) === cur;
});
check("5 没有提供上传快照：一律保留", () => {
  const st = fakeStorage(); st.setItem(S.GUEST_KEY, JSON.stringify(guest()));
  const up = D.guestToDoc(guest(), { deviceId: DEV, guestId: G, now: NOW }).doc;
  return S.clearGuestAfterVerified(st, { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: up }) === false && S.readGuestRaw(st) !== null;
});

// 6. 合并后刷新计分状态
check("6 合并后用 refreshStateAfterMerge 刷新：之后本机再挣 10 XP 不会丢", () => {
  const base = { ...D.emptyDoc({ lineage: "L1" }), xp: { devA: 30 } };
  const remote = { ...D.clone?.(base) ?? JSON.parse(JSON.stringify(base)), xp: { devA: 30, devB: 20 } };
  const merged = D.mergeDocs(base, remote).doc; // 50
  let st = D.refreshStateAfterMerge(merged, D.docToState(base, null, NOW), NOW);
  st = { ...st, xp: st.xp + 10 };
  return D.sumXp(D.syncStateIntoDoc(merged, st, { deviceId: DEV, today: "2026-11-03", now: NOW }).doc) === 60;
});
check("6 对照：不刷新（state 仍是合并前 30）时，本机新挣的 10 XP 会被抵掉 —— 说明刷新是必要的", () => {
  const base = { ...D.emptyDoc({ lineage: "L1" }), xp: { devA: 30 } };
  const merged = D.mergeDocs(base, { ...base, xp: { devA: 30, devB: 20 } }).doc;
  const st = { ...D.docToState(base, null, NOW), xp: 40 };
  return D.sumXp(D.syncStateIntoDoc(merged, st, { deviceId: DEV, today: "2026-11-03", now: NOW }).doc) === 50;
});

// 7. 红心恢复计时
check("7 同步写回时，“还差多久”随时间更新（20 分钟后剩 10 分钟，而不是停在 30 分钟）", () => {
  const doc = { ...D.emptyDoc({ lineage: "L1" }), hearts: { n: 3, msToNext: HEART_REGEN_MS } };
  const st = { ...D.docToState(doc, null, NOW) };
  const r = D.syncStateIntoDoc(doc, st, { deviceId: DEV, today: "2026-11-03", now: NOW + 20 * 60000 });
  return r.doc.hearts.n === 3 && Math.abs(r.doc.hearts.msToNext - (HEART_REGEN_MS - 20 * 60000)) < 1000 && r.changed.hearts === false;
});
check("7 保存后过 20 分钟重新打开：倒计时接着走，不重置", () => {
  const st = fakeStorage(); const doc = { ...D.emptyDoc({ lineage: "L1" }), hearts: { n: 3, msToNext: HEART_REGEN_MS } };
  S.saveAccount(st, "userA", { doc }, { now: NOW });
  const c = S.loadAccount(st, "userA", { now: NOW + 20 * 60000 }).copy;
  const s2 = D.docToState(c.doc, null, NOW + 20 * 60000);
  return c.doc.hearts.n === 3 && Math.abs(c.doc.hearts.msToNext - (HEART_REGEN_MS - 20 * 60000)) < 1000 && Math.abs(s2.heartsAt - (NOW)) < 1000;
});
check("7 保存后过了一整个恢复周期再打开：按现有规则恢复 1 颗", () => {
  const st = fakeStorage(); const doc = { ...D.emptyDoc({ lineage: "L1" }), hearts: { n: 3, msToNext: 5 * 60000 } };
  S.saveAccount(st, "userA", { doc }, { now: NOW });
  return S.loadAccount(st, "userA", { now: NOW + 6 * 60000 }).copy.doc.hearts.n === 4;
});
check("7 设备时间往回拨：不加心、不重置", () => {
  const st = fakeStorage(); const doc = { ...D.emptyDoc({ lineage: "L1" }), hearts: { n: 3, msToNext: 5 * 60000 } };
  S.saveAccount(st, "userA", { doc }, { now: NOW });
  const h = S.loadAccount(st, "userA", { now: NOW - 3600000 }).copy.doc.hearts; return h.n === 3 && h.msToNext === 5 * 60000;
});
// 8（对抗轮发现）同一设备两个标签页
check("8 两个标签页各自从 40 开始挣 +10 / +5，先后保存（带 baseline）：55，不丢", () => {
  let doc = { ...D.emptyDoc({ lineage: "L1" }), xp: { devA: 40 } }; const b = { xp: 40, lessonsCompleted: 0 };
  doc = D.syncStateIntoDoc(doc, { ...freshState(), xp: 50 }, { deviceId: DEV, today: "2026-11-03", now: NOW, baseline: b }).doc;
  doc = D.syncStateIntoDoc(doc, { ...freshState(), xp: 45 }, { deviceId: DEV, today: "2026-11-03", now: NOW, baseline: b }).doc;
  return D.sumXp(doc) === 55;
});
console.log(`\n共 ${total} 项，失败 ${fails} 项`);
process.exit(fails ? 1 : 0);
