// 数据兼容保护测试（纯 Node，不需要浏览器）。运行：node tests/data-compat.test.mjs
// 目的：用户的学习数据不管以后怎么改版都要还在。这里的“固定样本”代表已经存在于用户手机和云端里的真实格式：
//   tests/fixtures/local-v3-progress.json   本机记录（localStorage，第 3 版）
//   tests/fixtures/cloud-doc-schema1.json   云端账号文档（schema 1）
//   tests/fixtures/released-lessons.json    已上线的关卡编号（只能追加）
// 任何改动让这些样本读不出来、数值变了、或编号对不上，这个测试就会红。
// 要改样本的预期结果 = 你在改用户的数据格式：先读 docs/19-data-promise.md。
import { readFileSync } from "node:fs";
import * as D from "../src/account-data.js";
import { loadState, clearState, listUnreadable, freshState, DATA_VERSION } from "../src/storage.js";

const fx = (name) => readFileSync(new URL(`./fixtures/${name}`, import.meta.url), "utf8");
const LOCAL_RAW = fx("local-v3-progress.json");
const CLOUD = JSON.parse(fx("cloud-doc-schema1.json"));
// 样本是加「外观」设置之前的旧文档：读进来会补上 theme:"system"，其余原样（旧文档不会被改坏）
const CLOUD_N = { ...CLOUD, prefs: { ...CLOUD.prefs, theme: "system" } };
const RELEASED = JSON.parse(fx("released-lessons.json"));
const content = (f) => JSON.parse(readFileSync(new URL(`../content/${f}`, import.meta.url), "utf8"));

let fails = 0, total = 0;
function check(name, fn) {
  total++; let ok = false, detail = "";
  try { ok = !!fn(); } catch (e) { detail = "  — 抛错：" + e.message; }
  if (!ok) fails++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail}`);
}

// 带 length / key() 的假 localStorage（storage.js 用的是全局 localStorage）
function installStorage({ failWrite = false } = {}) {
  const m = new Map();
  const s = {
    get length() { return m.size; },
    key: (i) => [...m.keys()][i] ?? null,
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (s.failWrite) throw new Error("QuotaExceededError"); m.set(k, String(v)); },
    removeItem: (k) => { m.delete(k); },
    failWrite, raw: m,
  };
  Object.defineProperty(globalThis, "localStorage", { value: s, configurable: true, writable: true });
  return s;
}
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => (a < b ? -1 : 1))) : x));
const KEY = "suipian.progress";

// ================= A. 本机记录（第 3 版）样本 =================
{
  const st = installStorage(); st.setItem(KEY, LOCAL_RAW);
  const r = loadState(), s = r.state, f = JSON.parse(LOCAL_RAW);
  check("A1 本机 v3 样本能读出来，没有提示、没有重置", () => r.notice === null && s.version === DATA_VERSION);
  check("A2 进度数值原样保留：XP、红心、连续天数、最后学习日、总完成次数", () => s.xp === f.xp && s.hearts === f.hearts && s.heartsAt === f.heartsAt && s.streak === f.streak && s.lastDay === f.lastDay && s.lessonsCompleted === f.lessonsCompleted);
  check("A3 已完成关卡一个不少（8 关）", () => canon(s.done) === canon(f.done) && Object.keys(s.done).length === 8);
  check("A4 偏好原样保留（音效风格 C、振动关）", () => s.prefs.soundStyle === "C" && s.prefs.haptics === false && s.prefs.sound === true);
  check("A5 读取不会改动磁盘上的原始记录，也不会产生备份", () => st.getItem(KEY) === LOCAL_RAW && listUnreadable().length === 0);
}
{
  const st = installStorage();
  const old = { ...JSON.parse(LOCAL_RAW) }; delete old.prefs; // 最早的 v3 记录没有 prefs
  st.setItem(KEY, JSON.stringify(old));
  const s = loadState().state;
  check("A6 没有 prefs 的旧 v3 记录：进度保留，偏好补默认值（音效风格 J）", () => s.xp === 190 && Object.keys(s.done).length === 8 && s.prefs.soundStyle === "J" && s.prefs.sound === true);
}
{
  const st = installStorage(); st.setItem(KEY, JSON.stringify({ ...JSON.parse(LOCAL_RAW), someFutureField: 7 }));
  check("A7 v3 记录里多出来的字段不会在读取时被丢掉", () => loadState().state.someFutureField === 7);
}

// ================= B. 读不懂的记录：重置之前必须先备份 =================
{
  const st = installStorage();
  const bad = '{"version":3,"xp":190,"done":{"U1L1":tr'; // 写到一半被截断
  st.setItem(KEY, bad);
  const r = loadState();
  check("B1 损坏的记录：给出提示并从空记录开始", () => /损坏/.test(r.notice) && r.state.xp === 0);
  const u = listUnreadable();
  check("B2 损坏的原始内容被原样备份了一份", () => u.length === 1 && u[0].raw === bad);
  check("B3 读取本身没有动原来的那条记录（只有 app 稍后保存时才会覆盖）", () => st.getItem(KEY) === bad);
}
{
  const st = installStorage(); const newer = JSON.stringify({ ...JSON.parse(LOCAL_RAW), version: 99 });
  st.setItem(KEY, newer); const r = loadState();
  check("B4 来自更新版本（version 99）的记录：从空记录开始，但原始内容已备份", () => /无法识别/.test(r.notice) && listUnreadable().some((x) => x.raw === newer));
}
{
  const st = installStorage(); const v2 = JSON.stringify({ version: 2, installTipClosed: true });
  st.setItem(KEY, v2); const r = loadState();
  check("B5 第 2 版旧记录：按原规则重置，同样先备份", () => /旧版/.test(r.notice) && r.state.installTipClosed === true && listUnreadable().some((x) => x.raw === v2));
}
{
  const st = installStorage(); st.setItem(KEY, "null"); const r = loadState();
  check("B6 内容是 null / 不是对象：也先备份", () => /无法识别/.test(r.notice) && listUnreadable().some((x) => x.raw === "null"));
}
{
  const st = installStorage(); const realNow = Date.now; let t = 1_800_000_000_000;
  Date.now = () => ++t;
  try { for (let i = 1; i <= 5; i++) { st.setItem(KEY, `坏${i}`); loadState(); } } finally { Date.now = realNow; }
  const u = listUnreadable();
  check("B7 连续 5 次读不懂：只留最新的 3 份，且是最新的 3 份", () => u.length === 3 && u.map((x) => x.raw).join() === "坏5,坏4,坏3");
}
{
  const st = installStorage({ failWrite: true }); st.raw.set(KEY, "不是 JSON");
  let threw = false, r = null;
  try { r = loadState(); } catch { threw = true; }
  check("B8 备份写不进去（存储满 / 被禁用）：不抛错、页面照常能打开", () => !threw && r.state.xp === 0);
}
{
  const st = installStorage(); st.setItem(KEY, LOCAL_RAW);
  const s = clearState();
  check("B9 用户主动“清除学习记录”：不产生备份（这是用户自己的决定）", () => s.xp === 0 && st.getItem(KEY) === null && listUnreadable().length === 0);
}

// ================= C. 云端账号文档（schema 1）样本 =================
{
  const n = D.normalizeDoc(CLOUD);
  check("C1 云端 schema 1 样本通过校验，经过清洗后与原样本完全一致，只多补一个默认的外观设置 theme:system（没有丢字段、没有改数值）", () => n.ok && canon(n.doc) === canon(CLOUD_N));
  const s = D.docToState(n.doc, null, 1_800_000_000_000);
  check("C2 转成本机状态：XP 是各设备相加（190）、总完成 11 次、8 关全部完成", () => s.xp === 190 && s.lessonsCompleted === 11 && Object.keys(s.done).length === 8);
  check("C3 连续天数 4、最后学习日 2026-11-02、偏好保留", () => s.streak === 4 && s.lastDay === "2026-11-02" && s.prefs.soundStyle === "C" && s.prefs.haptics === false);
  const m = D.mergeDocs(CLOUD, CLOUD);
  check("C4 同一份文档自己和自己合并：结果不变（合并是幂等的）", () => m.outcome === "merged" && canon(m.doc) === canon(CLOUD_N));
  const more = JSON.parse(JSON.stringify(CLOUD)); more.xp.devA = 150; more.done.U2L3 = "2026-11-03"; more.days.push("2026-11-03");
  const m2 = D.mergeDocs(more, CLOUD), m3 = D.mergeDocs(CLOUD, more);
  check("C5 一边学得更多：合并后 XP 取每台设备较大值再相加（220），新完成的关卡保留；谁先谁后结果一样", () => D.sumXp(m2.doc) === 220 && m2.doc.done.U2L3 === "2026-11-03" && canon(m2.doc) === canon(m3.doc));
  check("C6 合并后 XP 和已完成关卡都不会比任何一边少", () => D.sumXp(m2.doc) >= Math.max(D.sumXp(CLOUD), D.sumXp(more)) && Object.keys(CLOUD.done).every((k) => k in m2.doc.done));
  const newer = { ...JSON.parse(JSON.stringify(CLOUD)), schema: 2, brandNewThing: { a: 1 } }; const before = canon(newer), beforeLocal = canon(CLOUD);
  const r = D.mergeDocs(CLOUD, newer);
  check("C7 云端文档来自更新的版本（schema 2）：拒绝合并并报错，不返回任何文档", () => r.error?.code === "schema-newer" && !r.doc);
  check("C8 拒绝时两份输入都没有被改动（老客户端不会把新版本的数据改坏）", () => canon(newer) === before && canon(CLOUD) === beforeLocal);
  check("C9 规则锁定：现在的清洗会丢掉不认识的字段，所以以后给云端文档加字段必须同时升 SCHEMA，让老客户端拒绝而不是处理", () => !("future" in D.normalizeDoc({ ...CLOUD, future: 1 }).doc) && D.normalizeDoc({ ...CLOUD, schema: D.SCHEMA + 1 }).code === "schema-newer");
}

// ================= D. 已上线关卡编号只能追加 =================
{
  const course = content("course.json"); const found = new Map();
  for (const u of course.units) if (u.file) for (const l of content(u.file).lessons) found.set(l.id, u.id);
  const missing = [], moved = [];
  for (const [unit, ids] of Object.entries(RELEASED)) {
    if (unit.startsWith("_")) continue;
    for (const id of ids) { if (!found.has(id)) missing.push(id); else if (found.get(id) !== unit) moved.push(`${id}→${found.get(id)}`); }
  }
  const all = Object.entries(RELEASED).filter(([k]) => !k.startsWith("_")).flatMap(([, v]) => v);
  check("D1 已上线的每个关卡编号都还在课程里" + (missing.length ? `（缺：${missing}）` : ""), () => missing.length === 0);
  check("D2 已上线的关卡没有被挪到别的单元" + (moved.length ? `（${moved}）` : ""), () => moved.length === 0);
  check("D3 已上线的编号没有重复", () => new Set(all).size === all.length);
  check("D4 每个已上线编号都能通过云端的编号校验（否则同步时这一关的完成记录会被悄悄丢掉）", () => all.every((id) => D.isId(id)));
  check("D5 两份固定样本里出现的完成关卡都在已上线清单里（样本没有编造关卡）", () => [...Object.keys(JSON.parse(LOCAL_RAW).done), ...Object.keys(CLOUD.done)].every((id) => all.includes(id)));
}

console.log(`\n共 ${total} 项，失败 ${fails} 项`);
process.exit(fails ? 1 : 0);
