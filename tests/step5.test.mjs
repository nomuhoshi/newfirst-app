// 账号本机数据层的测试（纯 Node，不需要浏览器）：格式转换、账号隔离、XP 合并与重复迁移防护、红心近似同步、游客记录保护。
// 运行：node tests/step5.test.mjs
import { readFileSync } from "node:fs";
import {
  SCHEMA, emptyDoc, normalizeDoc, mergeDocs, docsEquivalent, guestToDoc, docToState, syncStateIntoDoc,
  replaceWithGuest, sumXp, sumRuns, runEndingAtLast, newId,
} from "../src/account-data.js";
import {
  GUEST_KEY, readGuestRaw, getDeviceId, getGuestId, getCurrentAccount, setCurrentAccount, loadAccount, saveAccount,
  logoutLocal, clearGuestAfterVerified, removeAccountCopy,
} from "../src/account-store.js";
import { freshState, currentStreak, DATA_VERSION, HEART_REGEN_MS, regenHearts } from "../src/storage.js";

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
}
const clone = (x) => JSON.parse(JSON.stringify(x));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 假的浏览器存储；failWrites = true 时模拟写满 / 被禁用
function fakeStorage() {
  const m = new Map();
  const s = {
    failWrites: false,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (s.failWrites) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    keys: () => [...m.keys()],
  };
  return s;
}

const NOW = Date.UTC(2026, 10, 3, 3, 0, 0);
const DEV_A = "devA", DEV_B = "devB", GUEST_1 = "guest1", GUEST_2 = "guest2";
function guest(over = {}) {
  return {
    ...freshState(), xp: 130, hearts: 3, heartsAt: NOW - 10 * 60 * 1000, streak: 3, lastDay: "2026-11-02",
    done: { U1L1: true, U1L2: true, U1L3: true }, lessonsCompleted: 4, onboarded: true,
    prefs: { sound: false, haptics: true, soundStyle: "C" }, ...over,
  };
}
const mk = (state, dev = DEV_A, g = GUEST_1, extra = {}) => { const r = guestToDoc(state, { deviceId: dev, guestId: g, now: NOW, ...extra }); if (!r.ok) throw new Error(r.message); return r.doc; };

// ================= 1. 游客记录（v3）转换 =================
{
  const g = guest(); const before = clone(g);
  const d = mk(g);
  check("转换：XP、完成次数记在导入它的设备名下，总数不变", d.xp[DEV_A] === 130 && sumXp(d) === 130 && d.runs[DEV_A] === 4 && sumRuns(d) === 4);
  check("转换：完成的关卡一个不少", eq(Object.keys(d.done).sort(), ["U1L1", "U1L2", "U1L3"]));
  check("转换：连续 3 天换算成最后一天往前的 3 个日期", eq(d.days, ["2026-10-31", "2026-11-01", "2026-11-02"]));
  check("转换：红心 3 颗，下一颗还差 20 分钟（只存相对时间）", d.hearts.n === 3 && d.hearts.msToNext === HEART_REGEN_MS - 10 * 60 * 1000);
  check("转换：偏好原样带过去，并记下游客编号（防止重复导入）", d.prefs.soundStyle === "C" && d.prefs.sound === false && d.imported[GUEST_1] === true);
  check("转换：不修改传入的游客记录", eq(g, before));

  const back = docToState(d, g, NOW);
  check("转换前后：XP、完成关卡、完成次数一致", back.xp === g.xp && eq(Object.keys(back.done).sort(), Object.keys(g.done).sort()) && back.lessonsCompleted === g.lessonsCompleted);
  check("转换前后：连续天数（原始值和显示值）一致", back.streak === g.streak && back.lastDay === g.lastDay &&
    ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-10"].every((day) => currentStreak(back, new Date(day + "T12:00:00")) === currentStreak(g, new Date(day + "T12:00:00"))));
  const gh = { hearts: g.hearts, heartsAt: g.heartsAt }, bh = { hearts: back.hearts, heartsAt: back.heartsAt };
  check("转换前后：红心数和恢复进度一致", back.hearts === 3 && Math.abs(regenHearts(gh, NOW) - regenHearts(bh, NOW)) < 5);
  check("转换前后：偏好一致；开场介绍这类按设备保存的项沿用本机的", eq(back.prefs, g.prefs) && back.onboarded === true);
  check("转换后的状态仍是第 3 版格式", back.version === 3 && DATA_VERSION === 3);
}
{
  const bad = [
    ["第 2 版记录", { ...guest(), version: 2 }], ["XP 不是数字", guest({ xp: NaN })], ["XP 为负", guest({ xp: -5 })], ["null", null], ["字符串", "abc"],
  ];
  check("无效的游客记录：全部返回失败，不抛错", bad.every(([, s]) => { const r = guestToDoc(s, { deviceId: DEV_A, guestId: GUEST_1 }); return r.ok === false && typeof r.code === "string"; }));
  check("缺少设备编号或游客编号：失败", guestToDoc(guest(), { deviceId: "../x", guestId: GUEST_1 }).ok === false && guestToDoc(guest(), { deviceId: DEV_A, guestId: "" }).ok === false);
  check("没有连续天数：日期为空，不出错", mk(guest({ streak: 0, lastDay: null })).days.length === 0 && mk(guest({ lastDay: "2026-02-31" })).days.length === 0);
  const t0 = Date.now(); const huge = mk(guest({ streak: 1e9 }));
  check("损坏的超大连续天数：有上限，不卡死", huge.days.length === 5000 && Date.now() - t0 < 3000);
}

// ================= 2. 完整学习日期，不截断 =================
{
  const days = []; for (let i = 0; i < 500; i++) days.push(new Date(Date.UTC(2025, 0, 1) + i * 86400000).toISOString().slice(0, 10));
  const d = { ...emptyDoc({ lineage: "L1" }), days };
  const n = normalizeDoc(d);
  check("日期：500 天（超过 400）全部保留，连续天数 500", n.ok && n.doc.days.length === 500 && runEndingAtLast(n.doc.days) === 500);
  const m = mergeDocs(d, { ...emptyDoc({ lineage: "L1" }), days: days.slice(100, 450) });
  check("日期：合并后仍保留全部 500 天", m.doc.days.length === 500);
  check("游客记录连续 450 天：换算后有 450 个日期", mk(guest({ streak: 450 })).days.length === 450);
  const gap = { ...emptyDoc({ lineage: "L1" }), days: ["2026-10-01", "2026-10-02", "2026-10-05", "2026-10-06", "2026-10-07"] };
  check("日期中间断开：连续天数只数最后一段（3 天）", runEndingAtLast(gap.days) === 3);
}

// ================= 3. 合并规则 =================
const base = () => ({ ...emptyDoc({ lineage: "LIN" }) });
{
  const a = { ...base(), xp: { devA: 100, devB: 20 }, runs: { devA: 3 }, done: { U1L1: "2026-11-01", U1L2: "" }, days: ["2026-11-01"], imported: { g1: true } };
  const b = { ...base(), xp: { devA: 90, devB: 50 }, runs: { devA: 2, devB: 1 }, done: { U1L1: "2026-10-30", U1L2: "2026-11-02", U1L3: "2026-11-02" }, days: ["2026-10-30", "2026-11-02"], imported: { g2: true } };
  const ab = mergeDocs(a, b), ba = mergeDocs(b, a);
  check("合并：每台设备的 XP 取较大值再相加（100+50 = 150）", ab.outcome === "merged" && ab.doc.xp.devA === 100 && ab.doc.xp.devB === 50 && sumXp(ab.doc) === 150);
  check("合并：完成关卡取并集，日期取较早的；未知日期被已知日期补上", eq(ab.doc.done, { U1L1: "2026-10-30", U1L2: "2026-11-02", U1L3: "2026-11-02" }));
  check("合并：学习日期、已导入的游客编号取并集", eq(ab.doc.days, ["2026-10-30", "2026-11-01", "2026-11-02"]) && ab.doc.imported.g1 && ab.doc.imported.g2);
  check("合并：先后顺序无关（XP、完成关卡、日期、导入记录）", docsEquivalent(ab.doc, ba.doc));
  check("合并：重复合并同一份，结果不变（幂等）", docsEquivalent(mergeDocs(ab.doc, b).doc, ab.doc) && docsEquivalent(mergeDocs(ab.doc, ab.doc).doc, ab.doc));
  const c = { ...base(), xp: { devC: 7 }, days: ["2026-11-05"] };
  check("合并：三份以不同顺序合并结果相同（结合律）", docsEquivalent(mergeDocs(mergeDocs(a, b).doc, c).doc, mergeDocs(a, mergeDocs(b, c).doc).doc));
  const ac = clone(a), bc = clone(b); mergeDocs(a, b);
  check("合并：不修改传入的两份文档", eq(a, ac) && eq(b, bc));
}
{
  const lo = { ...base(), gen: 1, xp: { devA: 500 } }, hi = { ...base(), gen: 2, lineage: "NEW", xp: { devB: 10 } };
  const r1 = mergeDocs(lo, hi), r2 = mergeDocs(hi, lo);
  check("重置后：云端代数更高，整份用云端的，旧一代的 XP 不会回来", r1.outcome === "remote-newer" && sumXp(r1.doc) === 10 && r1.doc.gen === 2);
  check("重置后：本机代数更高，整份用本机的", r2.outcome === "local-newer" && sumXp(r2.doc) === 10);
  const x = { ...base(), gen: 2, lineage: "AAA", xp: { devA: 100 } }, y = { ...base(), gen: 2, lineage: "BBB", xp: { devB: 100 } };
  const cf = mergeDocs(x, y);
  check("同一代、编号不同（两次独立的覆盖）：不自动合并，也不把 XP 相加", cf.outcome === "conflict" && sumXp(cf.doc) === 100);
  check("同代同编号：正常合并", mergeDocs(x, { ...x, xp: { devA: 120 } }).outcome === "merged");
  const newer = { ...base(), schema: SCHEMA + 1 };
  check("来自更新版本的记录：拒绝合并，返回错误，不乱改", mergeDocs(base(), newer).error?.code === "schema-newer" && mergeDocs(newer, base()).error?.code === "schema-newer");
  check("无效记录：返回错误而不是抛错", mergeDocs(base(), null).error?.code === "invalid" && mergeDocs({ schema: 1 }, base()).error?.code === "invalid" && mergeDocs(base(), { ...base(), gen: 0 }).error?.code === "invalid");
  const dirty = normalizeDoc({ ...base(), xp: { "../evil": 5, devA: -3, devB: 7.9, "": 1 }, days: ["x", "2026-02-31", "2026-11-02", "2026-11-02"], done: { "a b": "2026-11-01", U1L1: "bad" }, prefs: { soundStyle: "Z" }, hearts: { n: 99, msToNext: -4 } });
  check("清洗：非法的键、负数、不存在的日期、重复日期、越界红心都被处理", dirty.ok && eq(dirty.doc.xp, { devA: 0, devB: 7 }) && eq(dirty.doc.days, ["2026-11-02"]) && eq(dirty.doc.done, { U1L1: "" }) && dirty.doc.prefs.soundStyle === "J" && dirty.doc.hearts.n === 5 && dirty.doc.hearts.msToNext === 0);
}
{ // 随机检查：很多组随机文档，合并规则始终成立
  let seed = 12345; const rnd = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  const rdoc = () => {
    const d = base();
    for (const dev of ["d1", "d2", "d3"]) if (rnd(2)) { d.xp[dev] = rnd(500); d.runs[dev] = rnd(20); }
    for (let i = 0; i < rnd(6); i++) d.done["U1L" + (1 + rnd(6))] = rnd(2) ? "" : `2026-11-0${1 + rnd(9)}`;
    for (let i = 0; i < rnd(8); i++) d.days.push(`2026-11-0${1 + rnd(9)}`);
    d.days = [...new Set(d.days)].sort(); return d;
  };
  let ok = true, why = "";
  for (let i = 0; i < 300 && ok; i++) {
    const a = rdoc(), b = rdoc(), c = rdoc();
    const ab = mergeDocs(a, b).doc, ba = mergeDocs(b, a).doc;
    if (!docsEquivalent(ab, ba)) { ok = false; why = "交换律"; }
    else if (!docsEquivalent(mergeDocs(ab, b).doc, ab)) { ok = false; why = "幂等"; }
    else if (!docsEquivalent(mergeDocs(mergeDocs(a, b).doc, c).doc, mergeDocs(a, mergeDocs(b, c).doc).doc)) { ok = false; why = "结合律"; }
    else if (sumXp(ab) !== [...new Set([...Object.keys(a.xp), ...Object.keys(b.xp)])].reduce((s, k) => s + Math.max(a.xp[k] ?? 0, b.xp[k] ?? 0), 0)) { ok = false; why = "XP 总数"; }
    else if (sumXp(ab) < Math.max(sumXp(a), sumXp(b))) { ok = false; why = "XP 减少"; }
  }
  check("随机检查（300 组）：交换律、幂等、结合律、XP 总数正确且合并后不会变少", ok, why);
}

// ================= 4. XP 不重复计数 =================
{
  let cloud = mk(guest(), DEV_A, GUEST_1); const total = sumXp(cloud);
  for (let i = 0; i < 3; i++) cloud = mergeDocs(cloud, mk(guest(), DEV_A, GUEST_1)).doc;
  check("重复上传同一份：总 XP 不变", sumXp(cloud) === total && total === 130);

  // 第二台设备登录：下载总数，不当作自己新挣的
  const stateB = docToState(cloud, { onboarded: true }, NOW);
  const synced = syncStateIntoDoc(cloud, stateB, { deviceId: DEV_B, today: "2026-11-03", now: NOW });
  check("第二台设备下载后：本机新增 XP 为 0，自己的格子不增加", sumXp(synced.doc) === 130 && synced.doc.xp[DEV_B] === undefined && synced.changed.xp === false && stateB.xp === 130);
  const up2 = mergeDocs(cloud, synced.doc).doc;
  check("第二台设备下载后再次上传：总 XP 不变，完成次数不变", sumXp(up2) === 130 && sumRuns(up2) === 4);

  // 第二台设备自己挣 10 XP
  const stateB2 = { ...stateB, xp: stateB.xp + 10, lessonsCompleted: stateB.lessonsCompleted + 1 };
  const earned = syncStateIntoDoc(cloud, stateB2, { deviceId: DEV_B, today: "2026-11-03", now: NOW });
  check("第二台设备新挣 10 XP：只记在自己的格子里", earned.doc.xp[DEV_B] === 10 && earned.doc.xp[DEV_A] === 130 && sumXp(earned.doc) === 140 && earned.changed.xp);
  let c2 = cloud; for (let i = 0; i < 3; i++) c2 = mergeDocs(c2, earned.doc).doc;
  check("新挣的 XP 重复上传 3 次：总数只加一次（140）", sumXp(c2) === 140 && sumRuns(c2) === 5);

  // 两台设备断网各自学习
  const stateA = docToState(cloud, { onboarded: true }, NOW);
  const offA = syncStateIntoDoc(cloud, { ...stateA, xp: stateA.xp + 20, lessonsCompleted: stateA.lessonsCompleted + 2 }, { deviceId: DEV_A, today: "2026-11-03", now: NOW }).doc;
  const offB = earned.doc;
  let merged = mergeDocs(offA, offB).doc; merged = mergeDocs(merged, offA).doc; merged = mergeDocs(merged, offB).doc;
  check("两台设备断网各自学习（A +20，B +10）：联网后合并 = 160，不丢也不重复", sumXp(merged) === 160 && sumRuns(merged) === 7);
}
{
  // 游客记录只导入一次
  const first = replaceWithGuest(guest(), { deviceId: DEV_A, guestId: GUEST_1, cloudDoc: null, now: NOW });
  check("首次导入（云端没有进度）：创建第 1 代，XP = 游客 XP", first.ok && first.outcome === "created" && first.doc.gen === 1 && sumXp(first.doc) === 130);
  const again = replaceWithGuest(guest(), { deviceId: DEV_A, guestId: GUEST_1, cloudDoc: first.doc, now: NOW });
  check("同一份游客记录再次触发导入（重试）：识别为已导入，原样返回，XP 不变", again.outcome === "already-imported" && docsEquivalent(again.doc, first.doc) && sumXp(again.doc) === 130);
  const twice = replaceWithGuest(guest({ xp: 999 }), { deviceId: DEV_B, guestId: GUEST_1, cloudDoc: first.doc, now: NOW });
  check("另一台设备带着同一个游客编号再导入：也被拦住", twice.outcome === "already-imported" && sumXp(twice.doc) === 130);
  const other = replaceWithGuest(guest({ xp: 40, done: { U1L1: true }, lessonsCompleted: 1 }), { deviceId: DEV_B, guestId: GUEST_2, cloudDoc: first.doc, now: NOW });
  check("云端已有进度时用户选“用本机覆盖”：代数 +1、换新编号，XP 不与云端相加（40，不是 170）", other.outcome === "replaced" && other.doc.gen === 2 && other.doc.lineage !== first.doc.lineage && sumXp(other.doc) === 40);
  check("覆盖之后，旧一代的数据（来自其他设备的 XP 记录）不会合并回来", sumXp(mergeDocs(first.doc, other.doc).doc) === 40 && mergeDocs(other.doc, first.doc).outcome === "local-newer");
  const again2 = replaceWithGuest(guest({ xp: 40 }), { deviceId: DEV_B, guestId: GUEST_2, cloudDoc: other.doc, now: NOW });
  check("覆盖也只做一次：同一个游客编号再来，已导入", again2.outcome === "already-imported" && again2.doc.gen === 2);
  const badCloud = replaceWithGuest(guest(), { deviceId: DEV_A, guestId: GUEST_1, cloudDoc: { schema: 1 } });
  check("云端文档无效时：不导入，返回错误", badCloud.ok === false);
}
{
  // 浏览器数据被清除后重新登录
  const cloud = mk(guest(), DEV_A, GUEST_1);
  const newDev = "devAfterClear";
  const st = docToState(cloud, null, NOW);
  const s0 = syncStateIntoDoc(cloud, st, { deviceId: newDev, today: "2026-11-03", now: NOW });
  check("清除浏览器数据后重新登录（新设备编号）：总 XP 不增不减，旧设备格子还在", sumXp(s0.doc) === 130 && s0.doc.xp[DEV_A] === 130 && s0.doc.xp[newDev] === undefined);
  const s1 = syncStateIntoDoc(cloud, { ...st, xp: st.xp + 10 }, { deviceId: newDev, today: "2026-11-03", now: NOW });
  check("重新登录后再挣 10 XP：总数 140，记在新格子里", sumXp(s1.doc) === 140 && s1.doc.xp[newDev] === 10);
  check("重新登录后的完成关卡、日期、偏好从云端完整恢复", eq(Object.keys(st.done).sort(), ["U1L1", "U1L2", "U1L3"]) && st.streak === 3 && st.prefs.soundStyle === "C" && st.onboarded === false);
}

// ================= 5. 红心：测试版近似同步 =================
{
  const cloud0 = { ...mk(guest({ hearts: 5, heartsAt: NOW })), hearts: { n: 5, msToNext: 0 } };
  const lose = (n) => ({ ...docToState(cloud0, { onboarded: true }, NOW), hearts: n, heartsAt: NOW });
  const A = syncStateIntoDoc(cloud0, lose(4), { deviceId: DEV_A, today: "2026-11-03", now: NOW });
  const B = syncStateIntoDoc(cloud0, lose(3), { deviceId: DEV_B, today: "2026-11-03", now: NOW });
  check("红心：扣心被标记为改动；没改红心则不标记", A.changed.hearts && B.changed.hearts && syncStateIntoDoc(cloud0, docToState(cloud0, null, NOW), { deviceId: DEV_A, today: "2026-11-03", now: NOW }).changed.hearts === false);
  check("红心：只是时间流逝（还差多久变小）不算改动", syncStateIntoDoc(A.doc, docToState(A.doc, null, NOW + 5 * 60000), { deviceId: DEV_A, today: "2026-11-03", now: NOW + 5 * 60000 }).changed.hearts === false);
  // A 先上传，B 后同步（B 本机改过红心 → 以 B 为准）
  const cloudAfterA = mergeDocs(cloud0, A.doc, {}).doc;
  const bSync = mergeDocs(B.doc, cloudAfterA, { localHeartsDirty: true }).doc;
  check("红心（B 后写入）：以后写入的为准 = 3 颗（A 扣 1 + B 扣 2，实际应剩 2；这里多出 1 颗）", bSync.hearts.n === 3);
  // B 先上传，A 后同步
  const cloudAfterB = mergeDocs(cloud0, B.doc, {}).doc;
  const aSync = mergeDocs(A.doc, cloudAfterB, { localHeartsDirty: true }).doc;
  check("红心（A 后写入）：以后写入的为准 = 4 颗（B 扣的 2 颗被覆盖，已知限制）", aSync.hearts.n === 4);
  check("红心：本机没改过红心时，用云端的", mergeDocs(cloud0, A.doc, { localHeartsDirty: false }).doc.hearts.n === 4 && mergeDocs(A.doc, cloud0, { localHeartsDirty: false }).doc.hearts.n === 5);
  check("红心：覆盖造成的偏差上限 = 红心上限 5 颗，不会无限增加", [bSync, aSync].every((d) => d.hearts.n >= 0 && d.hearts.n <= 5));
  check("红心不影响 XP 和已完成关卡的合并", sumXp(aSync) === sumXp(cloud0) && eq(Object.keys(aSync.done), Object.keys(cloud0.done)));

  // 设备时钟不一致：只存相对时间，换一台时钟差几小时的设备，恢复进度一样
  const st = { ...freshState(), version: 3, hearts: 2, heartsAt: NOW - 25 * 60 * 1000, xp: 0 };
  const doc = syncStateIntoDoc(cloud0, st, { deviceId: DEV_A, today: "2026-11-03", now: NOW }).doc;
  check("红心恢复：存的是“还差 5 分钟”这样的相对时间", doc.hearts.n === 2 && Math.abs(doc.hearts.msToNext - 5 * 60 * 1000) < 5);
  let same = true;
  for (const skew of [-3 * 3600e3, 0, 3 * 3600e3, 40 * 86400e3]) {
    const t = NOW + skew; const s = docToState(doc, null, t);
    const h = { hearts: s.hearts, heartsAt: s.heartsAt };
    const left = regenHearts(h, t); const after = { hearts: s.hearts, heartsAt: s.heartsAt }; regenHearts(after, t + 5 * 60000 + 1000);
    if (s.hearts !== 2 || Math.abs(left - 5 * 60000) > 5 || after.hearts !== 3) same = false;
  }
  check("设备时钟差几小时甚至几十天：同一份文档恢复出的红心和恢复进度完全相同", same);
  const full = syncStateIntoDoc(cloud0, { ...st, hearts: 5, heartsAt: NOW }, { deviceId: DEV_A, today: "2026-11-03", now: NOW }).doc;
  check("红心满了：不记恢复时间", full.hearts.n === 5 && full.hearts.msToNext === 0 && docToState(full, null, NOW).hearts === 5);
  const zero = syncStateIntoDoc(cloud0, { ...st, hearts: 0, heartsAt: NOW }, { deviceId: DEV_A, today: "2026-11-03", now: NOW }).doc;
  check("红心为 0：下一颗在 30 分钟后", zero.hearts.n === 0 && zero.hearts.msToNext === HEART_REGEN_MS);
}
{
  const d0 = emptyDoc({ lineage: "P" }); const st = { ...docToState(d0, null, NOW), prefs: { sound: false, haptics: true, soundStyle: "E" } };
  const r = syncStateIntoDoc(d0, st, { deviceId: DEV_A, today: "2026-11-03", now: NOW });
  check("设置：改了音效会标记为改动并写入文档", r.changed.prefs && r.doc.prefs.sound === false && r.doc.prefs.soundStyle === "E");
  check("设置：本机改过用本机的，没改过用云端的", mergeDocs(r.doc, d0, { localPrefsDirty: true }).doc.prefs.soundStyle === "E" && mergeDocs(r.doc, d0, {}).doc.prefs.soundStyle === "J");
}

// ================= 6. 账号隔离（本机存储） =================
{
  const st = fakeStorage();
  const guestRaw = JSON.stringify(guest()); st.setItem(GUEST_KEY, guestRaw);
  const docA = mk(guest({ xp: 100 }), DEV_A, "gA"), docB = mk(guest({ xp: 7, done: { U1L1: true } }), DEV_A, "gB");
  check("账号隔离：两个账号各存一份", saveAccount(st, "userA", { doc: docA }) && saveAccount(st, "userB", { doc: docB }));
  const la = loadAccount(st, "userA"), lb = loadAccount(st, "userB");
  check("账号隔离：A 读到 A 的、B 读到 B 的，互不混用", sumXp(la.copy.doc) === 100 && sumXp(lb.copy.doc) === 7 && Object.keys(lb.copy.doc.done).length === 1);
  const before = st.getItem("suipian.acct.userB");
  saveAccount(st, "userA", { doc: { ...docA, xp: { [DEV_A]: 500 } } });
  check("账号隔离：改 A 不影响 B 的存储内容", st.getItem("suipian.acct.userB") === before);
  check("账号隔离：游客记录全程原样不变（逐字节）", readGuestRaw(st) === guestRaw);
  check("账号隔离：没存过的账号读到“没有副本”，不是别人的", loadAccount(st, "userC").copy === null);
  setCurrentAccount(st, "userA");
  check("当前账号：能设置和读取", getCurrentAccount(st) === "userA");
  check("退出登录：只删当前账号的副本和登录状态，别人的副本和游客记录都在", logoutLocal(st, "userA") && getCurrentAccount(st) === null && loadAccount(st, "userA").copy === null && loadAccount(st, "userB").copy !== null && readGuestRaw(st) === guestRaw);
  check("退出后：读不到上一个账号的任何数据", !st.keys().some((k) => k.includes("userA")));
  const badIds = ["../x", "", "a b", "x".repeat(65), "a/b", undefined, 123, {}];
  check("账号编号不合法：一律拒绝（不会拼出奇怪的存储键）", badIds.every((id) => loadAccount(st, id).ok === false && saveAccount(st, id, { doc: docA }) === false && setCurrentAccount(st, id) === false) && !st.keys().some((k) => k.includes("..")));
  setCurrentAccount(st, "userB"); setCurrentAccount(st, null);
  check("退出登录状态：设置为 null 会清除当前账号（不是非法编号）", getCurrentAccount(st) === null);
  st.setItem("suipian.acct.userD", "{not json"); const bad = loadAccount(st, "userD");
  check("本机副本损坏：返回错误，不抛错、不影响别的账号", bad.ok === false && bad.code === "corrupt" && loadAccount(st, "userB").ok);
  st.setItem("suipian.acct.userE", JSON.stringify({ doc: { schema: 99 } }));
  check("副本来自更新版本：提示而不是误读", loadAccount(st, "userE").code === "schema-newer");
}
{
  const st = fakeStorage(); const d1 = getDeviceId(st), d2 = getDeviceId(st), g1 = getGuestId(st);
  check("设备编号、游客编号：生成后稳定不变，格式合法", d1 === d2 && /^[A-Za-z0-9_-]{1,64}$/.test(d1) && /^[A-Za-z0-9_-]{1,64}$/.test(g1) && d1 !== g1);
  const st2 = fakeStorage(); check("清除浏览器数据（换一份空存储）后：设备编号变了", getDeviceId(st2) !== d1);
  const ro = fakeStorage(); ro.failWrites = true;
  check("存储不可写（无痕模式）：照样拿到编号，不抛错", /^[A-Za-z0-9_-]+$/.test(getDeviceId(ro)));
  check("存储不可写：保存账号返回失败，不抛错", saveAccount(ro, "userA", { doc: emptyDoc() }) === false);
}

// ================= 7. 游客记录保护、迁移失败可恢复 =================
{
  const mkSt = () => { const s = fakeStorage(); s.setItem(GUEST_KEY, JSON.stringify(guest())); return s; };
  const up = mk(guest()), same = clone(up);
  const cases = [
    ["用户没有选转存", { userChoseTransfer: false, uploadOk: true, uploaded: up, readBack: same }],
    ["没有明确选择（undefined）", { uploadOk: true, uploaded: up, readBack: same }],
    ["上传失败", { userChoseTransfer: true, uploadOk: false, uploaded: up, readBack: same }],
    ["上传超时（没有读回）", { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: null }],
    ["读回的 XP 对不上", { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: { ...clone(up), xp: { [DEV_A]: 1 } } }],
    ["读回少了一个关卡", { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: { ...clone(up), done: { U1L1: "" } } }],
    ["读回少了学习日期", { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: { ...clone(up), days: [] } }],
    ["读回的是无效数据", { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: { schema: 1 } }],
  ];
  const allKept = cases.every(([, args]) => { const s = mkSt(); const raw = readGuestRaw(s); const r = clearGuestAfterVerified(s, args); return r === false && readGuestRaw(s) === raw; });
  check(`游客记录清空：${cases.length} 种不满足条件的情况，游客记录全部保留`, allKept);
  const s = mkSt();
  check("游客记录清空：用户选转存 + 上传成功 + 读回一致，才清空", clearGuestAfterVerified(s, { userChoseTransfer: true, uploadOk: true, uploaded: up, readBack: same }) === true && readGuestRaw(s) === null);
  const reordered = { ...clone(up), xp: Object.fromEntries(Object.entries(up.xp).reverse()) };
  check("读回内容一致的判断不受键顺序影响", docsEquivalent(up, reordered));

  // 迁移中途存储写满：账号副本没写进去，游客记录原样还在，也没有写了一半的副本
  const s2 = mkSt(); const raw2 = readGuestRaw(s2); s2.failWrites = true;
  const conv = guestToDoc(JSON.parse(raw2), { deviceId: DEV_A, guestId: GUEST_1, now: NOW });
  const saved = saveAccount(s2, "userX", { doc: conv.doc });
  check("迁移时存储写满：保存失败，游客记录原样，没有残留的半份副本", conv.ok && saved === false && readGuestRaw(s2) === raw2 && !s2.keys().some((k) => k.includes("userX")));
  const s3 = mkSt(); const raw3 = readGuestRaw(s3); const r3 = guestToDoc(null, { deviceId: DEV_A, guestId: GUEST_1 });
  check("迁移时游客记录无法转换：返回失败，原始记录不动", r3.ok === false && readGuestRaw(s3) === raw3);
  check("迁移可以重来：删掉账号副本后再转换一次，结果相同", (() => { const a = mk(JSON.parse(raw3)), b = mk(JSON.parse(raw3), DEV_A, GUEST_1); return docsEquivalent({ ...a, lineage: "x" }, { ...b, lineage: "x" }); })());
}

// ================= 8. 现有游客流程不受影响 =================
{
  const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const storage = readFileSync(new URL("../src/storage.js", import.meta.url), "utf8");
  check("现有游客流程：app.js 和 storage.js 没有引用账号模块（本阶段不接入）", !/account-(data|store)/.test(app) && !/account-(data|store)/.test(storage));
  check("本机记录仍是第 3 版；新增模块不使用游客记录的存储键以外的东西写游客记录", DATA_VERSION === 3 && !/setItem\(GUEST_KEY|setItem\("suipian\.progress"/.test(readFileSync(new URL("../src/account-store.js", import.meta.url), "utf8")));
  check("新 ID 生成：不重复且格式合法", new Set(Array.from({ length: 500 }, () => newId())).size === 500 && /^[A-Za-z0-9_-]{1,64}$/.test(newId()));
}

const failed = results.filter((r) => !r.ok);
console.log(`\n共 ${results.length} 项，失败 ${failed.length} 项`);
process.exit(failed.length ? 1 : 0);
