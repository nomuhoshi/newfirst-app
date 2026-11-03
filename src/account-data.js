// 账号进度的数据格式与合并规则。和任何云服务无关，也不读写浏览器存储，全部是纯函数，所以可以在 Node 里直接测试。
// 设计依据：docs/15-account-sync-plan.md §4、§5。本文件不改变任何游戏规则（XP、红心、连续天数、解锁）。
//
// 账号文档（doc）：
//   schema   数据格式版本（现在是 1）。比自己认识的更新 → 拒绝处理，不乱改。
//   gen      第几代。用户选择“用这份覆盖云端”时 +1；高的一代整份替换低的一代。
//   lineage  这一代的随机编号。同一代但编号不同 = 两次互相独立的“覆盖”，不能自动合并，要让用户选。
//   xp       { 设备编号: 这台设备自己挣到的 XP }。总 XP = 各设备相加。
//   runs     { 设备编号: 这台设备完成关卡的次数 }（含复习）。
//   done     { 关卡编号: 第一次完成的日期（未知则是空字符串） }
//   days     完成过关卡的全部日期（YYYY-MM-DD，升序，不重复，不截断）
//   hearts   { n: 红心数, msToNext: 距离下一颗恢复还差多少毫秒（满了是 0） }  —— 只存“相对时间”，不依赖设备时钟
//   prefs    { sound, haptics, soundStyle }
//   imported { 游客编号: true }  —— 已经导入过的游客记录，防止重复导入
import { HEARTS_MAX, HEART_REGEN_MS, regenHearts } from "./storage.js";

export const SCHEMA = 1;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_STREAK_DAYS = 5000; // 游客记录里的连续天数换算成日期时的上限（防止损坏数据导致超大数组）

export function newId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 24);
  let s = "";
  for (let i = 0; i < 24; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
export const isId = (x) => typeof x === "string" && ID_RE.test(x);

const natural = (n) => (Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
const clone = (x) => JSON.parse(JSON.stringify(x));

// ---------- 日期小工具（和 storage.js 一样用日历日，不看时钟的时分秒） ----------
const toUTC = (d) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
const fromUTC = (t) => { const d = new Date(t); const p = (n) => String(n).padStart(2, "0"); return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}`; };
const dayDiff = (a, b) => Math.round((toUTC(b) - toUTC(a)) / 86400000);
const addDays = (d, n) => fromUTC(toUTC(d) + n * 86400000);
const validDay = (d) => typeof d === "string" && DAY_RE.test(d) && fromUTC(toUTC(d)) === d; // 排除 2026-02-31 这类不存在的日期

// 从完整日期列表里算“截止最后一天的连续天数”（和 storage.js 里 streak 的含义一致）
export function runEndingAtLast(days) {
  if (!days.length) return 0;
  let n = 1;
  for (let i = days.length - 1; i > 0 && dayDiff(days[i - 1], days[i]) === 1; i--) n++;
  return n;
}

// ---------- 创建 / 检查 ----------
export function emptyDoc({ gen = 1, lineage = newId() } = {}) {
  return {
    schema: SCHEMA, gen, lineage,
    xp: {}, runs: {}, done: {}, days: [],
    hearts: { n: HEARTS_MAX, msToNext: 0 },
    prefs: { sound: true, haptics: true, soundStyle: "J" },
    imported: {},
  };
}

// 检查并清洗一份文档（来自云端或本机副本）。返回 { ok:true, doc } 或 { ok:false, code, message }。永远返回新对象，不改输入。
export function normalizeDoc(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return { ok: false, code: "invalid", message: "账号记录不是有效的对象" };
  if (!Number.isInteger(raw.schema) || raw.schema < 1) return { ok: false, code: "invalid", message: "账号记录缺少数据版本" };
  if (raw.schema > SCHEMA) return { ok: false, code: "schema-newer", message: "账号记录来自更新的版本，请先更新应用" };
  if (!Number.isInteger(raw.gen) || raw.gen < 1) return { ok: false, code: "invalid", message: "账号记录的代数无效" };
  if (!isId(raw.lineage)) return { ok: false, code: "invalid", message: "账号记录缺少编号" };
  const d = emptyDoc({ gen: raw.gen, lineage: raw.lineage });
  const mapNat = (src, dst) => { if (src && typeof src === "object") for (const [k, v] of Object.entries(src)) if (isId(k)) dst[k] = natural(v); };
  mapNat(raw.xp, d.xp); mapNat(raw.runs, d.runs);
  if (raw.done && typeof raw.done === "object") for (const [k, v] of Object.entries(raw.done)) if (isId(k)) d.done[k] = validDay(v) ? v : "";
  if (Array.isArray(raw.days)) d.days = [...new Set(raw.days.filter(validDay))].sort();
  if (raw.hearts && typeof raw.hearts === "object") {
    const n = Math.min(HEARTS_MAX, natural(raw.hearts.n));
    d.hearts = { n, msToNext: n >= HEARTS_MAX ? 0 : Math.min(HEART_REGEN_MS, natural(raw.hearts.msToNext)) };
  }
  if (raw.prefs && typeof raw.prefs === "object") {
    d.prefs = {
      sound: raw.prefs.sound !== false,
      haptics: raw.prefs.haptics !== false,
      soundStyle: /^[A-J]$/.test(raw.prefs.soundStyle) ? raw.prefs.soundStyle : "J",
    };
  }
  if (raw.imported && typeof raw.imported === "object") for (const k of Object.keys(raw.imported)) if (isId(k) && raw.imported[k]) d.imported[k] = true;
  return { ok: true, doc: d };
}

export const sumXp = (doc) => Object.values(doc.xp).reduce((a, b) => a + b, 0);
export const sumRuns = (doc) => Object.values(doc.runs).reduce((a, b) => a + b, 0);

// 用来比较两份文档“内容是否一致”（键的顺序无关）
function canonical(doc) {
  const sorted = (o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]]));
  return JSON.stringify({ ...doc, xp: sorted(doc.xp), runs: sorted(doc.runs), done: sorted(doc.done), imported: sorted(doc.imported), prefs: sorted(doc.prefs), hearts: sorted(doc.hearts) });
}
export function docsEquivalent(a, b) {
  const x = normalizeDoc(a), y = normalizeDoc(b);
  return x.ok && y.ok && canonical(x.doc) === canonical(y.doc);
}

// ---------- 合并 ----------
// local = 本机副本，remote = 云端当前内容。
// 返回 { doc, outcome }：
//   "merged"        同一代同一编号：XP/次数按设备取较大值再相加，完成关卡和日期取并集；红心和设置按“写入顺序”二选一
//   "remote-newer"  云端代数更高：整份用云端的（本机的旧一代作废）
//   "local-newer"   本机代数更高：整份用本机的
//   "conflict"      代数相同但编号不同（两次互相独立的“覆盖”）：不自动合并，交给用户选
//   或 { error: { code, message } }（任何一份无效、或来自更新版本）
// opts.localHeartsDirty / opts.localPrefsDirty：自上次同步以来，本机改过红心 / 设置。
//   云端是“谁最后成功写入谁说了算”，本机改过 = 本机这次写入会排在云端当前内容之后，所以用本机的；没改过就用云端的。
//   不用设备时间判断哪份更新（两台设备的时钟可能不一致）。
export function mergeDocs(local, remote, opts = {}) {
  const a = normalizeDoc(local), b = normalizeDoc(remote);
  if (!a.ok) return { error: { code: a.code, message: "本机记录：" + a.message } };
  if (!b.ok) return { error: { code: b.code, message: "云端记录：" + b.message } };
  const L = a.doc, R = b.doc;
  if (L.gen !== R.gen) return L.gen > R.gen ? { doc: L, outcome: "local-newer" } : { doc: R, outcome: "remote-newer" };
  if (L.lineage !== R.lineage) return { doc: L, outcome: "conflict", remote: R };
  const out = emptyDoc({ gen: L.gen, lineage: L.lineage });
  for (const field of ["xp", "runs"]) {
    for (const k of new Set([...Object.keys(L[field]), ...Object.keys(R[field])])) out[field][k] = Math.max(L[field][k] ?? 0, R[field][k] ?? 0);
  }
  for (const k of new Set([...Object.keys(L.done), ...Object.keys(R.done)])) {
    const x = L.done[k], y = R.done[k];
    out.done[k] = !x ? (y ?? "") : !y ? x : (x < y ? x : y);
  }
  out.days = [...new Set([...L.days, ...R.days])].sort();
  out.hearts = clone(opts.localHeartsDirty ? L.hearts : R.hearts);
  out.prefs = clone(opts.localPrefsDirty ? L.prefs : R.prefs);
  out.imported = { ...L.imported, ...R.imported };
  return { doc: out, outcome: "merged" };
}

// ---------- 游客记录（v3）↔ 账号文档 ----------
// v3 游客记录 → 账号文档。不修改输入。游客的 XP 和完成次数记在“导入它的这台设备”名下。
export function guestToDoc(state, { deviceId, guestId, gen = 1, lineage = newId(), now = Date.now() } = {}) {
  if (!isId(deviceId) || !isId(guestId)) return { ok: false, code: "bad-ids", message: "缺少设备编号或游客编号" };
  if (!state || typeof state !== "object" || state.version !== 3) return { ok: false, code: "guest-invalid", message: "游客记录不是第 3 版格式" };
  if (!Number.isFinite(state.xp) || state.xp < 0) return { ok: false, code: "guest-invalid", message: "游客记录的 XP 无效" };
  const doc = emptyDoc({ gen, lineage });
  doc.xp[deviceId] = natural(state.xp);
  doc.runs[deviceId] = natural(state.lessonsCompleted);
  if (state.done && typeof state.done === "object") for (const [k, v] of Object.entries(state.done)) if (v && isId(k)) doc.done[k] = "";
  if (validDay(state.lastDay) && Number.isInteger(state.streak) && state.streak >= 1) {
    const n = Math.min(state.streak, MAX_STREAK_DAYS);
    for (let i = n - 1; i >= 0; i--) doc.days.push(addDays(state.lastDay, -i));
  }
  const h = { hearts: Math.min(HEARTS_MAX, natural(state.hearts ?? HEARTS_MAX)), heartsAt: Number.isFinite(state.heartsAt) ? state.heartsAt : now };
  const msLeft = regenHearts(h, now);
  doc.hearts = { n: h.hearts, msToNext: h.hearts >= HEARTS_MAX ? 0 : Math.round(msLeft) };
  const p = state.prefs && typeof state.prefs === "object" ? state.prefs : {};
  doc.prefs = { sound: p.sound !== false, haptics: p.haptics !== false, soundStyle: /^[A-J]$/.test(p.soundStyle) ? p.soundStyle : "J" };
  doc.imported[guestId] = true;
  return { ok: true, doc };
}

// 账号文档 → 应用现在使用的 v3 形状（这样 app.js 的代码可以原样使用）。base 是这台设备现有的状态：开场介绍、安装提示按设备保存，不同步。
export function docToState(doc, base = null, now = Date.now()) {
  const days = doc.days;
  const n = doc.hearts.n;
  return {
    version: 3,
    onboarded: base?.onboarded ?? false,
    xp: sumXp(doc),
    hearts: n,
    heartsAt: n >= HEARTS_MAX ? now : now - (HEART_REGEN_MS - doc.hearts.msToNext), // 下一颗在 msToNext 毫秒后恢复；云端里停留的时间不补算（偏保守）
    streak: runEndingAtLast(days),
    lastDay: days.length ? days[days.length - 1] : null,
    done: Object.fromEntries(Object.keys(doc.done).map((k) => [k, true])),
    lessonsCompleted: sumRuns(doc),
    installTipClosed: base?.installTipClosed ?? false,
    lastActive: base?.lastActive ?? 0,
    prefs: { ...doc.prefs },
  };
}

// 把这台设备上的状态变化写回账号文档（不修改输入）。
// 关键：本机新挣的 XP = 状态里的总 XP − 文档里的总 XP，只加到“这台设备自己的格子”里。
// 刚从云端下载的总数，不会被当成这台设备新挣的。
// 返回 { doc, changed: { xp, runs, done, days, hearts, prefs } }，changed 用来给同步层判断“红心/设置是否改过”。
export function syncStateIntoDoc(doc, state, { deviceId, today, now = Date.now() }) {
  if (!isId(deviceId)) throw new Error("缺少设备编号");
  const out = clone(doc);
  const changed = { xp: false, runs: false, done: false, days: false, hearts: false, prefs: false };
  const dxp = natural(state.xp) - sumXp(out);
  if (dxp > 0) { out.xp[deviceId] = (out.xp[deviceId] ?? 0) + dxp; changed.xp = true; }
  const druns = natural(state.lessonsCompleted) - sumRuns(out);
  if (druns > 0) { out.runs[deviceId] = (out.runs[deviceId] ?? 0) + druns; changed.runs = true; }
  for (const [k, v] of Object.entries(state.done ?? {})) if (v && isId(k) && !(k in out.done)) { out.done[k] = validDay(today) ? today : ""; changed.done = true; }
  if (validDay(state.lastDay) && !out.days.includes(state.lastDay)) { out.days = [...out.days, state.lastDay].sort(); changed.days = true; }
  const h = { hearts: Math.min(HEARTS_MAX, natural(state.hearts)), heartsAt: Number.isFinite(state.heartsAt) ? state.heartsAt : now };
  const ms = regenHearts(h, now);
  const hearts = { n: h.hearts, msToNext: h.hearts >= HEARTS_MAX ? 0 : Math.round(ms) };
  // 红心只在“数量变了”（扣心或恢复）时才算改动；光是时间流逝让“还差多久”变小，不算
  if (hearts.n !== out.hearts.n) { out.hearts = hearts; changed.hearts = true; }
  const p = state.prefs ?? {};
  const prefs = { sound: p.sound !== false, haptics: p.haptics !== false, soundStyle: /^[A-J]$/.test(p.soundStyle) ? p.soundStyle : "J" };
  if (JSON.stringify(prefs) !== JSON.stringify(out.prefs)) { out.prefs = prefs; changed.prefs = true; }
  return { doc: out, changed };
}

// 用户在“云端已有进度”时明确选择“用这台设备的游客记录覆盖云端”：代数 +1、换新编号。
// 同一份游客记录（游客编号）只会导入一次：云端文档里已经记着它，就原样返回，不再导入。
export function replaceWithGuest(guestState, { deviceId, guestId, cloudDoc = null, now = Date.now() }) {
  if (cloudDoc) {
    const c = normalizeDoc(cloudDoc);
    if (!c.ok) return { ok: false, code: c.code, message: c.message };
    if (c.doc.imported[guestId]) return { ok: true, doc: c.doc, outcome: "already-imported" };
    const r = guestToDoc(guestState, { deviceId, guestId, gen: c.doc.gen + 1, now });
    return r.ok ? { ok: true, doc: r.doc, outcome: "replaced" } : r;
  }
  const r = guestToDoc(guestState, { deviceId, guestId, gen: 1, now });
  return r.ok ? { ok: true, doc: r.doc, outcome: "created" } : r;
}
