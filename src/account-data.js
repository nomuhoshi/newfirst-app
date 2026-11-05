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
//   imported { 游客编号: 指纹 }  —— 已经导入过的游客记录及导入时的内容指纹（旧数据为 true），防止重复导入，并能发现导入后游客又学了新内容
import { HEARTS_MAX, HEART_REGEN_MS, regenHearts } from "./storage.js";

export const SCHEMA = 1;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const FP_RE = /^[0-9a-f]{8}$/;
const MAX_STREAK_DAYS = 5000; // 游客记录里的连续天数换算成日期时的上限（防止损坏数据导致超大数组）

export function newId() {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID().replace(/-/g, "").slice(0, 24);
  let s = "";
  for (let i = 0; i < 24; i++) s += Math.floor(Math.random() * 16).toString(16);
  return s;
}
export const isId = (x) => typeof x === "string" && ID_RE.test(x) && x !== "__proto__"; // __proto__ 作为对象键会改原型、丢数据

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
  if (raw.imported && typeof raw.imported === "object") for (const [k, v] of Object.entries(raw.imported)) if (isId(k) && v) d.imported[k] = typeof v === "string" && FP_RE.test(v) ? v : true;
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
// 游客记录“学习内容”的指纹：只看 XP、完成次数、完成的关卡、最后学习日和连续天数（红心计时、设置、开场介绍不算学习内容）。
export function guestFingerprint(state) {
  if (!state || typeof state !== "object") return null;
  const done = Object.keys(state.done ?? {}).filter((k) => state.done[k]).sort();
  const text = JSON.stringify([natural(state.xp), natural(state.lessonsCompleted), done, state.lastDay ?? null, natural(state.streak)]);
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) { h ^= text.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, "0");
}
// 游客是否已经有“学习记录”。只有完全没有学习记录（XP=0、次数=0、没有完成关卡、没有学习日期）
// 才允许跳过导入选择；红心计时、设置、开场介绍不算学习记录。
// 不能拿云端总 XP / 总次数来推断游客“没变化”：总量大不代表包含游客新增的那一笔。
export function guestHasLearning(state) {
  if (!state || typeof state !== "object") return false;
  if (natural(state.xp) > 0 || natural(state.lessonsCompleted) > 0) return true;
  if (state.done && typeof state.done === "object") {
    for (const [k, v] of Object.entries(state.done)) if (v && isId(k)) return true;
  }
  if (validDay(state.lastDay)) return true;
  return Number.isInteger(state.streak) && state.streak > 0;
}
// 云端 imported[游客编号] 的状态（guestImportStatus / replaceWithGuest / sync.js 共用）：
//   "new"     没导入过；
//   "same"    导入过，且当前游客记录与当时一致（没有可丢的进度）；
//   "changed" 指纹格式，但游客记录又变了，必须让用户选择；
//   "unknown" 旧 true 格式没有指纹，而游客有学习记录——无法证明“没变”，必须让用户选择。
// 旧 true + 游客完全为空 → "same"：没有学习记录可丢，允许跳过。
export function guestImportStatus(cloudDoc, guestId, guestState) {
  if (!cloudDoc || !isId(guestId)) return "new";
  const c = normalizeDoc(cloudDoc);
  if (!c.ok) return "new"; // 无效文档由调用方按数据处理错误处理，这里不冒充“已导入”
  const prev = c.doc.imported[guestId];
  if (!prev) return "new";
  if (!guestHasLearning(guestState)) return "same";
  if (prev === true) return "unknown"; // 没有指纹：不许用总数 / 次数 / 日期推断未变化
  const fp = guestFingerprint(guestState);
  return typeof prev === "string" && prev === fp ? "same" : "changed";
}
// 连续天数换算成日期：lastDay 往前 streak 天（含 lastDay）
function streakDays(state) {
  if (!validDay(state?.lastDay) || !Number.isInteger(state.streak) || state.streak < 1) return [];
  const n = Math.min(state.streak, MAX_STREAK_DAYS), out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(state.lastDay, -i));
  return out;
}

// v3 游客记录 → 账号文档。不修改输入。游客的 XP 和完成次数记在“导入它的这台设备”名下。
export function guestToDoc(state, { deviceId, guestId, gen = 1, lineage = newId(), now = Date.now() } = {}) {
  if (!isId(deviceId) || !isId(guestId)) return { ok: false, code: "bad-ids", message: "缺少设备编号或游客编号" };
  if (!state || typeof state !== "object" || state.version !== 3) return { ok: false, code: "guest-invalid", message: "游客记录不是第 3 版格式" };
  if (!Number.isFinite(state.xp) || state.xp < 0) return { ok: false, code: "guest-invalid", message: "游客记录的 XP 无效" };
  const doc = emptyDoc({ gen, lineage });
  doc.xp[deviceId] = natural(state.xp);
  doc.runs[deviceId] = natural(state.lessonsCompleted);
  if (state.done && typeof state.done === "object") for (const [k, v] of Object.entries(state.done)) if (v && isId(k)) doc.done[k] = "";
  doc.days = streakDays(state);
  const h = { hearts: Math.min(HEARTS_MAX, natural(state.hearts ?? HEARTS_MAX)), heartsAt: Number.isFinite(state.heartsAt) ? state.heartsAt : now };
  const msLeft = regenHearts(h, now);
  doc.hearts = { n: h.hearts, msToNext: h.hearts >= HEARTS_MAX ? 0 : Math.round(msLeft) };
  const p = state.prefs && typeof state.prefs === "object" ? state.prefs : {};
  doc.prefs = { sound: p.sound !== false, haptics: p.haptics !== false, soundStyle: /^[A-J]$/.test(p.soundStyle) ? p.soundStyle : "J" };
  doc.imported[guestId] = guestFingerprint(state);
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
// opts.baseline = { xp, lessonsCompleted }：这个标签页上次读取 / 同步时的总数。传了就按“状态 − baseline”算新挣的部分，
// 这样同一台设备开两个标签页、各自学习后先后保存，后保存的不会把先保存的那份抵掉（不传则按旧方式和文档总数比较）。
export function syncStateIntoDoc(doc, state, { deviceId, today, now = Date.now(), baseline = null }) {
  if (!isId(deviceId)) throw new Error("缺少设备编号");
  const out = clone(doc);
  const changed = { xp: false, runs: false, done: false, days: false, hearts: false, prefs: false };
  const bx = baseline ? natural(baseline.xp) : sumXp(out), br = baseline ? natural(baseline.lessonsCompleted) : sumRuns(out);
  const dxp = natural(state.xp) - bx;
  if (dxp > 0) { out.xp[deviceId] = (out.xp[deviceId] ?? 0) + dxp; changed.xp = true; }
  const druns = natural(state.lessonsCompleted) - br;
  if (druns > 0) { out.runs[deviceId] = (out.runs[deviceId] ?? 0) + druns; changed.runs = true; }
  for (const [k, v] of Object.entries(state.done ?? {})) if (v && isId(k) && !(k in out.done)) { out.done[k] = validDay(today) ? today : ""; changed.done = true; }
  // 两次同步之间连续学了多天：按 lastDay + streak 把这几天都补上（只有 lastDay 会丢掉中间的日子）
  const newDays = streakDays(state).filter((d) => !out.days.includes(d));
  if (validDay(state.lastDay) && !out.days.includes(state.lastDay) && !newDays.includes(state.lastDay)) newDays.push(state.lastDay);
  if (newDays.length) { out.days = [...new Set([...out.days, ...newDays])].sort(); changed.days = true; }
  const h = { hearts: Math.min(HEARTS_MAX, natural(state.hearts)), heartsAt: Number.isFinite(state.heartsAt) ? state.heartsAt : now };
  const ms = regenHearts(h, now);
  const hearts = { n: h.hearts, msToNext: h.hearts >= HEARTS_MAX ? 0 : Math.round(ms) };
  // 红心只在“数量变了”（扣心或恢复）时才算改动（用于冲突时选谁）；但“还差多久”总是更新成当前值，
  // 否则下次从文档还原时会把恢复倒计时拨回到旧值（等于重置计时）。
  if (hearts.n !== out.hearts.n) changed.hearts = true;
  out.hearts = hearts;
  const p = state.prefs ?? {};
  const prefs = { sound: p.sound !== false, haptics: p.haptics !== false, soundStyle: /^[A-J]$/.test(p.soundStyle) ? p.soundStyle : "J" };
  if (JSON.stringify(prefs) !== JSON.stringify(out.prefs)) { out.prefs = prefs; changed.prefs = true; }
  return { doc: out, changed };
}

// 合并之后必须用合并结果刷新应用里继续计分的状态：否则 state.xp 仍是合并前的本机总数，
// 下一次 syncStateIntoDoc 计算“本机新挣的 XP”时会被云端多出来的部分抵掉，导致丢 XP。
export function refreshStateAfterMerge(mergedDoc, state, now = Date.now()) {
  return docToState(mergedDoc, state, now);
}

// 只把当前游客指纹写进云端 imported[游客编号]，其余字段一律保留（用户选“保留云端”）。
// 不增加代数、不换 lineage、不动任何设备 / 关卡 / 红心 / 设置 / 弹窗期间新增的进度。
export function markGuestImported(cloudDoc, guestId, guestState) {
  if (!isId(guestId)) return { ok: false, code: "bad-ids", message: "缺少游客编号" };
  const base = cloudDoc ?? emptyDoc();
  const c = normalizeDoc(base);
  if (!c.ok) return { ok: false, code: c.code, message: c.message };
  const fp = guestFingerprint(guestState);
  if (!fp) return { ok: false, code: "guest-invalid", message: "游客记录无法生成指纹" };
  const doc = clone(base); // 保留云端原有字段和值，只改 imported 这一项
  const imported = doc.imported && typeof doc.imported === "object" && !Array.isArray(doc.imported) ? doc.imported : {};
  doc.imported = { ...imported, [guestId]: fp };
  return { ok: true, doc, fingerprint: fp };
}

// “安全合并游客进度”：以云端最新文档为底，只把游客自己的 XP / 次数按设备取较大值，
// 关卡和日期取并集，并写入当前游客指纹。云端其他设备的数据、代数、lineage、红心、设置一概保留。
// 绝不再用 gen + 1 的整份覆盖（那会把其他设备以及弹窗期间新增的进度清掉）。
export function mergeGuestProgress(guestState, { deviceId, guestId, cloudDoc = null, now = Date.now() } = {}) {
  if (!isId(deviceId) || !isId(guestId)) return { ok: false, code: "bad-ids", message: "缺少设备编号或游客编号" };
  const g = guestToDoc(guestState, { deviceId, guestId, now });
  if (!g.ok) return g;
  if (!cloudDoc) return { ok: true, doc: g.doc, outcome: "created" };
  const c = normalizeDoc(cloudDoc);
  if (!c.ok) return { ok: false, code: c.code, message: c.message };
  const out = clone(c.doc);
  const guest = g.doc;
  const gxp = guest.xp[deviceId] ?? 0, gruns = guest.runs[deviceId] ?? 0;
  if (gxp > 0 || Object.hasOwn(out.xp, deviceId)) out.xp[deviceId] = Math.max(out.xp[deviceId] ?? 0, gxp);
  if (gruns > 0 || Object.hasOwn(out.runs, deviceId)) out.runs[deviceId] = Math.max(out.runs[deviceId] ?? 0, gruns);
  for (const [k, v] of Object.entries(guest.done)) {
    if (!Object.hasOwn(out.done, k)) out.done[k] = v;
    else if (!out.done[k] && v) out.done[k] = v;
  }
  out.days = [...new Set([...out.days, ...guest.days])].sort();
  out.imported = { ...out.imported, [guestId]: guest.imported[guestId] };
  // hearts / prefs / gen / lineage 保持云端最新值（其他设备的红心、设置不能被游客清掉）。
  return { ok: true, doc: out, outcome: "merged" };
}

// 用户在导入弹窗里做了选择：
//   "keep-cloud"：只写游客指纹，云端其余逐字保留（见 markGuestImported）；
//   "merge" / "transfer"（兼容旧调用）：安全合并（见 mergeGuestProgress），不再 gen + 1 整份覆盖。
// 没有选择时：同一份记录 → already-imported；旧 true / 指纹变了 → guest-changed + 两个选择。
export function replaceWithGuest(guestState, { deviceId, guestId, cloudDoc = null, now = Date.now(), choice = null }) {
  let c = null;
  if (cloudDoc) {
    c = normalizeDoc(cloudDoc);
    if (!c.ok) return { ok: false, code: c.code, message: c.message };
  }
  const status = c ? guestImportStatus(c.doc, guestId, guestState) : "new";
  if (status === "same") return { ok: true, doc: c.doc, outcome: "already-imported" };
  if (choice === "keep-cloud") {
    const r = markGuestImported(c ? c.doc : null, guestId, guestState);
    return r.ok ? { ok: true, doc: r.doc, outcome: "kept-cloud" } : r;
  }
  const mergeChoice = choice === "merge" || choice === "transfer" || choice === "replace";
  if (status !== "new" && !mergeChoice) {
    return { ok: true, doc: c.doc, outcome: "guest-changed", choices: ["keep-cloud", "merge"], message: "这份游客记录导入后又有新的学习进度，请选择保留云端，或安全合并游客进度" };
  }
  const r = mergeGuestProgress(guestState, { deviceId, guestId, cloudDoc: c ? c.doc : null, now });
  return r.ok ? { ok: true, doc: r.doc, outcome: c ? "merged" : "created" } : r;
}
