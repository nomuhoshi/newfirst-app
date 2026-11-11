// 本机记录：只存在这台设备的浏览器里（localStorage），不上传任何地方。
// 读写都包在 try/catch 里：无痕模式、存储被禁用时不能让页面白屏。

const KEY = "suipian.progress";
export const DATA_VERSION = 3;

export const HEARTS_MAX = 5;
export const HEART_REGEN_MS = 30 * 60 * 1000; // 每 30 分钟恢复 1 颗

export function freshState() {
  return {
    version: DATA_VERSION,
    onboarded: false,     // 看过开场介绍
    xp: 0,
    hearts: HEARTS_MAX,
    heartsAt: Date.now(), // 上一次计算红心恢复的时间
    streak: 0,            // 连续学习天数
    lastDay: null,        // 最后一次完成关卡的日期（本地日期 YYYY-MM-DD）
    done: {},             // 完成的关卡 { U1L1: true }
    doneOn: {},           // 每关第一次完成的本地日期 { U1L1: "2026-11-04" }；只用来在合并进账号时带上完成日期，旧记录没有（日期未知）
    lessonsCompleted: 0,  // 完成关卡的总次数（含复习）
    installTipClosed: false,
    lastActive: 0,
    prefs: { sound: true, haptics: true, soundStyle: "J" }, // 音效、振动开关；soundStyle：按键音效风格 A–J，默认 J（旧 v3 记录没有这些项，加载时补上默认值）
  };
}

// 旧版记录（第 1 版讲解卡、第 2 版教程）：题目都已撤下，不沿用完成状态
function migrateOld(old) {
  const s = freshState();
  s.installTipClosed = !!old.installTipClosed;
  return { state: s, notice: "课程改版为关卡模式，旧版的学习记录不再使用，请从第一关开始。" };
}

// 读不懂的本机记录（损坏、版本不认识、旧版）在被空记录覆盖之前，原样留一份。
// app.js 会在提示“已从头开始”后立刻把空记录存回去，没有这一步，原来的进度就永远没了。
// 最多留 3 份（最新的）；备份本身失败（存储满、被禁用）不能让页面出错。
// 只有用户主动点“清除学习记录”才会真正清空，那条路不经过这里。
const STASH_PREFIX = "suipian.progress.unreadable.";
const STASH_KEEP = 3;
function stashUnreadable(raw) {
  try {
    localStorage.setItem(STASH_PREFIX + Date.now(), raw);
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(STASH_PREFIX)) keys.push(k); }
    keys.sort(); // 时间戳位数相同，字典序就是时间序
    while (keys.length > STASH_KEEP) localStorage.removeItem(keys.shift());
  } catch { /* 忽略 */ }
}
// 列出已备份的读不懂的记录（最新的在前），供排查或以后的“找回”入口使用
export function listUnreadable() {
  const out = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STASH_PREFIX)) out.push({ key: k, savedAt: Number(k.slice(STASH_PREFIX.length)), raw: localStorage.getItem(k) });
    }
  } catch { /* 忽略 */ }
  return out.sort((a, b) => b.savedAt - a.savedAt);
}

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    // 读取失败不等于“没有记录”：标记 readFailed，调用方不能把这份空记录存回去（可能盖掉真实进度）
    return { state: freshState(), notice: "这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。", readFailed: true };
  }
  if (!raw) { const f = freshState(); track(f); return { state: f, notice: null }; }
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    stashUnreadable(raw);
    return { state: freshState(), notice: "本机记录损坏，已从头开始。" };
  }
  if (data && (data.version === 1 || data.version === 2)) { stashUnreadable(raw); return migrateOld(data); }
  if (!data || data.version !== DATA_VERSION) { stashUnreadable(raw); return { state: freshState(), notice: "学习记录的格式无法识别，已从头开始。" }; }
  // 旧的 v3 记录只补新增的偏好，学习进度原样保留
  const base = freshState();
  const prefs = { ...base.prefs, ...(data.prefs && typeof data.prefs === "object" ? data.prefs : {}) };
  if (!/^[A-J]$/.test(prefs.soundStyle)) prefs.soundStyle = "J";
  delete prefs.keySound; // 试听阶段的旧字段，不再使用
  const doneOn = {};
  if (data.doneOn && typeof data.doneOn === "object" && !Array.isArray(data.doneOn)) {
    for (const [k, v] of Object.entries(data.doneOn)) if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) doneOn[k] = v;
  }
  const out = { ...base, ...data, prefs, doneOn }; track(out);
  return { state: out, notice: null };
}

// ---------- 多标签页安全 ----------
// 每个内存记录（一个标签页里的 state 对象）带两个不写进存储的“基线”：
//   xp / lessonsCompleted：上一次与存储对齐时的值。保存时只把“这个标签页自上次对齐以来新增的 XP”加到存储里已有的 XP 上，
//   所以两个标签页分别完成不同关卡，XP 是相加而不是取大；同一份记录重复保存，新增量为 0，不会重复加分。
//   epoch：这个标签页看到的“清除学习记录”代数。别处清除过（代数变了），这个标签页的旧内存记录整个作废，改为采用存储里的新状态，不会复活清除前的数据。
const EPOCH_KEY = KEY + ".epoch";
const BASE = new WeakMap(); // state -> { xp, lc, epoch }
function readEpoch() { try { return localStorage.getItem(EPOCH_KEY) || ""; } catch { return null; } }
function track(state) { BASE.set(state, { xp: state.xp || 0, lc: state.lessonsCompleted || 0, epoch: readEpoch() ?? "" }); }
// 读取存储里现有的 v3 记录：{ ok:false } 读取异常；{ ok:true, d:null } 没有 / 读不懂；{ ok:true, d } 正常
function readStoredV3() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ok: true, d: null };
    const d = JSON.parse(raw);
    return { ok: true, d: d && d.version === DATA_VERSION && d.done && typeof d.done === "object" ? d : null };
  } catch (e) { return e instanceof SyntaxError ? { ok: true, d: null } : { ok: false }; }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
// 清除学习记录发生在别处：采用存储里的新状态（没有记录就是空记录），保留本标签页的偏好
function adoptStored(state, d) {
  const prefs = state.prefs, keep = freshState();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, keep, d || {}, { prefs: { ...keep.prefs, ...(d && d.prefs ? d.prefs : {}), ...prefs }, onboarded: true });
  state.done = { ...(d && d.done) }; state.doneOn = { ...(d && d.doneOn) };
}
// 把存储里可能更新的进度并进内存记录（就地修改）；返回内存记录是否有变化。
export function mergeStored(state) {
  const r = readStoredV3();
  if (!r.ok) return false;
  const d = r.d, ep = readEpoch() ?? "";
  const base = BASE.get(state);
  if (base && base.epoch !== ep) { adoptStored(state, d); track(state); return true; }
  if (!d) { if (!base) track(state); return false; }
  const bx = base ? base.xp : null, bl = base ? base.lc : null;
  let changed = false;
  for (const k of Object.keys(d.done)) if (d.done[k] && !state.done[k]) { state.done[k] = true; changed = true; }
  if (d.doneOn && typeof d.doneOn === "object") {
    state.doneOn = state.doneOn || {};
    for (const [k, v] of Object.entries(d.doneOn)) if (typeof v === "string" && ISO.test(v) && !state.doneOn[k]) state.doneOn[k] = v;
  }
  const sx = Number(d.xp) || 0, sl = Number(d.lessonsCompleted) || 0;
  // 有基线：存储值 + 本标签页新增量；没有基线（刚导入 / 刚合并生成的新对象）：保守取较大值
  const xp = bx === null ? Math.max(state.xp, sx) : sx + Math.max(0, state.xp - bx);
  const lc = bl === null ? Math.max(state.lessonsCompleted || 0, sl) : sl + Math.max(0, (state.lessonsCompleted || 0) - bl);
  if (xp !== state.xp) { state.xp = xp; changed = true; }
  if (lc !== (state.lessonsCompleted || 0)) { state.lessonsCompleted = lc; changed = true; }
  if (d.onboarded && !state.onboarded) { state.onboarded = true; changed = true; }
  const a = state.lastDay, b = d.lastDay;
  if (typeof b === "string" && ISO.test(b) && (!a || b > a)) { state.streak = Number(d.streak) || 0; state.lastDay = b; changed = true; }
  else if (b && a === b && Number(d.streak) > state.streak) { state.streak = Number(d.streak); changed = true; }
  track(state); // 与存储对齐，基线更新
  return changed;
}

// 最后一次“写入成功”的时间（毫秒），写入失败不更新；给“我的”页自测用
let lastSavedAt = 0;
export const getLastSavedAt = () => lastSavedAt;
// opts.replace：用户主动“清除学习记录”之后的保存，不合并旧记录
export function saveState(state, opts = {}) {
  try {
    if (!opts.replace) {
      if (!readStoredV3().ok) return false; // 读取异常：保留原始存储，不写
      mergeStored(state);
    }
    state.lastActive = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    track(state);
    lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try { localStorage.removeItem(KEY); localStorage.setItem(EPOCH_KEY, Date.now() + "-" + Math.random().toString(36).slice(2)); } catch { /* 忽略 */ }
  const f = freshState(); track(f);
  return f;
}

// ---------- 红心 ----------
// 按经过的时间恢复红心；返回下一颗恢复还要多少毫秒（满了返回 0）
export function regenHearts(state, now = Date.now()) {
  if (state.hearts >= HEARTS_MAX) { state.heartsAt = now; return 0; }
  const n = Math.floor((now - state.heartsAt) / HEART_REGEN_MS);
  if (n > 0) {
    state.hearts = Math.min(HEARTS_MAX, state.hearts + n);
    state.heartsAt += n * HEART_REGEN_MS;
    if (state.hearts >= HEARTS_MAX) state.heartsAt = now;
  }
  return state.hearts >= HEARTS_MAX ? 0 : HEART_REGEN_MS - (now - state.heartsAt);
}

export function loseHeart(state, now = Date.now()) {
  regenHearts(state, now);
  if (state.hearts >= HEARTS_MAX) state.heartsAt = now; // 从满格开始计时
  state.hearts = Math.max(0, state.hearts - 1);
}

// ---------- 连续天数 ----------
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function daysBetween(a, b) {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}
// 完成一关时调用
export function bumpStreak(state, now = new Date()) {
  const today = dayKey(now);
  if (state.lastDay === today) return false;
  state.streak = state.lastDay && daysBetween(state.lastDay, today) === 1 ? state.streak + 1 : 1;
  state.lastDay = today;
  return true; // 今天第一次完成
}
// 显示用：昨天之前就断了的话显示 0
export function currentStreak(state, now = new Date()) {
  if (!state.lastDay) return 0;
  return daysBetween(state.lastDay, dayKey(now)) <= 1 ? state.streak : 0;
}
