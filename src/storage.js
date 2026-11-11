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
  if (!raw) { const f = normalize(freshState()); EPOCHS.set(f, readEpoch() ?? ""); return { state: f, notice: null }; }
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
  const out = normalize({ ...base, ...data, prefs, doneOn }); EPOCHS.set(out, readEpoch() ?? "");
  return { state: out, notice: null };
}

// ---------- 多标签页安全 ----------
// 学习进度写成“可合并”的形式：任意顺序、重复、同时的写入合并后结果相同，不丢也不重复计。
//   done / doneOn：并集（完成过就是完成过）。
//   firstXp：{关卡id: 该关首次通关拿到的 XP}，合并取每关较大值——两个标签同时首次完成同一关，奖励只算一次。
//   xpLed / runsLed：{标签页id: 这个标签页挣的非首次通关 XP / 完成次数}，合并取每个标签页的较大值（每个标签页只增不减），再求和——两个标签页各做各的不会互相覆盖。
//   xpBase / runsBase：新记录格式出现之前就有的数（旧存档、导入文件带来的数），合并取较大值。
//   xp = xpBase + Σ xpLed + Σ firstXp；lessonsCompleted = runsBase + Σ runsLed。xp / lessonsCompleted 仍是照常读取的总数，计分规则（每题 +10 / +5、通关 +10）不变。
// 另外：清除学习记录会写入新的“清除代数”（epoch）；标签页发现代数变了，丢弃自己内存里的旧记录，采用存储里的新状态，不会把清除前的记录写回来。
const EPOCH_KEY = KEY + ".epoch";
const TAB_ID = Math.random().toString(36).slice(2, 10);
const TABS = new WeakMap(); // 仅测试用：让同一个进程里的多个内存记录扮成不同标签页
export const _asTab = (state, id) => { TABS.set(state, id); return state; };
const tabOf = (state) => TABS.get(state) || TAB_ID;
const EPOCHS = new WeakMap(); // state -> 这个记录最后一次对齐时看到的清除代数
const sum = (o) => Object.values(o || {}).reduce((t, v) => t + (Number(v) > 0 ? Number(v) : 0), 0);
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
function readEpoch() { try { return localStorage.getItem(EPOCH_KEY) || ""; } catch { return null; } }
// 补齐字段；如果 xp / lessonsCompleted 被直接改过（旧存档、导入合并），差额并入 Base，保证“总数”不会因为迁移变小
function normalize(state) {
  for (const k of ["firstXp", "xpLed", "runsLed"]) if (!state[k] || typeof state[k] !== "object" || Array.isArray(state[k])) state[k] = {};
  state.xp = num(state.xp); state.lessonsCompleted = num(state.lessonsCompleted);
  const cx = num(state.xpBase) + sum(state.xpLed) + sum(state.firstXp);
  state.xpBase = Math.max(0, num(state.xpBase) + (state.xp - cx));
  const cr = num(state.runsBase) + sum(state.runsLed);
  state.runsBase = Math.max(0, num(state.runsBase) + (state.lessonsCompleted - cr));
  return state;
}
function recalc(state) {
  state.xp = num(state.xpBase) + sum(state.xpLed) + sum(state.firstXp);
  state.lessonsCompleted = num(state.runsBase) + sum(state.runsLed);
}
// 加 XP。first 是“这一关首次通关途中拿到的 XP”（记在 firstXp[lessonId]），其余（复习、练习）记在本标签页名下
export function addXp(state, amount, lessonId = null, first = false) {
  normalize(state);
  if (first && lessonId) state.firstXp[lessonId] = num(state.firstXp[lessonId]) + amount;
  else state.xpLed[tabOf(state)] = num(state.xpLed[tabOf(state)]) + amount;
  recalc(state);
}
// 完成一关（含复习）的次数 +1
export function addRun(state) { normalize(state); state.runsLed[tabOf(state)] = num(state.runsLed[tabOf(state)]) + 1; recalc(state); }

// 读取存储里现有的 v3 记录：{ ok:false } 读取异常；{ ok:true, d:null } 没有 / 读不懂；{ ok:true, d } 正常
function readStoredV3() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ok: true, d: null, raw: null };
    const d = JSON.parse(raw);
    return { ok: true, raw, d: d && d.version === DATA_VERSION && d.done && typeof d.done === "object" ? normalize(d) : null };
  } catch (e) { return e instanceof SyntaxError ? { ok: true, d: null, raw: null } : { ok: false }; }
}
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const maxMap = (into, from) => { let ch = false; for (const [k, v] of Object.entries(from || {})) { const n = num(v); if (n > num(into[k])) { into[k] = n; ch = true; } } return ch; };
// 清除学习记录发生在别处：采用存储里的新状态（没有记录就是空记录），保留本标签页的偏好
function adoptStored(state, d) {
  const prefs = state.prefs, keep = freshState();
  for (const k of Object.keys(state)) delete state[k];
  Object.assign(state, keep, d || {}, { prefs: { ...keep.prefs, ...(d && d.prefs ? d.prefs : {}), ...prefs }, onboarded: true });
  state.done = { ...(d && d.done) }; state.doneOn = { ...(d && d.doneOn) };
  normalize(state);
}
// 把存储里可能更新的进度并进内存记录（就地修改）；返回内存记录是否有变化。
export function mergeStored(state) {
  const r = readStoredV3();
  if (!r.ok) return false;
  const d = r.d, ep = readEpoch() ?? "";
  normalize(state);
  if (EPOCHS.has(state) && EPOCHS.get(state) !== ep) { adoptStored(state, d); EPOCHS.set(state, ep); return true; }
  EPOCHS.set(state, ep);
  if (!d) return false;
  let changed = false;
  for (const k of Object.keys(d.done)) if (d.done[k] && !state.done[k]) { state.done[k] = true; changed = true; }
  if (d.doneOn && typeof d.doneOn === "object") {
    state.doneOn = state.doneOn || {};
    for (const [k, v] of Object.entries(d.doneOn)) if (typeof v === "string" && ISO.test(v) && !state.doneOn[k]) state.doneOn[k] = v;
  }
  if (maxMap(state.firstXp, d.firstXp)) changed = true;
  if (maxMap(state.xpLed, d.xpLed)) changed = true;
  if (maxMap(state.runsLed, d.runsLed)) changed = true;
  if (num(d.xpBase) > num(state.xpBase)) { state.xpBase = num(d.xpBase); changed = true; }
  if (num(d.runsBase) > num(state.runsBase)) { state.runsBase = num(d.runsBase); changed = true; }
  const x0 = state.xp, r0 = state.lessonsCompleted;
  recalc(state);
  if (state.xp !== x0 || state.lessonsCompleted !== r0) changed = true;
  if (d.onboarded && !state.onboarded) { state.onboarded = true; changed = true; }
  const a = state.lastDay, b = d.lastDay;
  if (typeof b === "string" && ISO.test(b) && (!a || b > a)) { state.streak = Number(d.streak) || 0; state.lastDay = b; changed = true; }
  else if (b && a === b && Number(d.streak) > state.streak) { state.streak = Number(d.streak); changed = true; }
  return changed;
}
// 存储里的记录是否已经包含内存记录的全部进度（用来判断别的标签页的写入有没有把我们的盖掉）
function storedCovers(d, state) {
  if (!d) return false;
  for (const k of Object.keys(state.done)) if (state.done[k] && !d.done[k]) return false;
  for (const f of ["firstXp", "xpLed", "runsLed"]) for (const [k, v] of Object.entries(state[f])) if (num(d[f][k]) < num(v)) return false;
  return num(d.xpBase) >= num(state.xpBase) && num(d.runsBase) >= num(state.runsBase) && (!state.lastDay || (d.lastDay || "") >= state.lastDay);
}

// 最后一次“写入成功”的时间（毫秒），写入失败不更新；给“我的”页自测用
let lastSavedAt = 0;
export const getLastSavedAt = () => lastSavedAt;
// opts.replace：用户主动“清除学习记录”之后的保存，不合并旧记录
export function saveState(state, opts = {}) {
  try {
    if (opts.replace) {
      normalize(state); EPOCHS.set(state, readEpoch() ?? "");
      state.lastActive = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
      lastSavedAt = Date.now();
      return true;
    }
    // 读-并-写，写完回读核对：两个页面同时写，后写的会盖掉先写的，但每个页面都保留着自己的进度，
    // 回读发现存储没包含自己的内容就再合并再写，最多 4 轮，最终双方进度都在。
    for (let i = 0; i < 4; i++) {
      const r = readStoredV3();
      if (!r.ok) return false; // 读取异常：保留原始存储，不写
      mergeStored(state);
      state.lastActive = Date.now();
      localStorage.setItem(KEY, JSON.stringify(state));
      const v = readStoredV3();
      if (v.ok && storedCovers(v.d, state)) { lastSavedAt = Date.now(); return true; }
    }
    lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}
// 别的标签页写入后调用：把存储里的进度读进来；如果存储缺了我们的内容（被盖掉了），补写回去。返回内存记录是否有变化。
export function syncFromStorage(state) {
  const r = readStoredV3();
  if (!r.ok) return false;
  const changed = mergeStored(state);
  if (!storedCovers(readStoredV3().d, state)) saveState(state);
  return changed;
}

export function clearState() {
  try { localStorage.removeItem(KEY); localStorage.setItem(EPOCH_KEY, Date.now() + "-" + Math.random().toString(36).slice(2)); } catch { /* 忽略 */ }
  const f = freshState(); normalize(f); EPOCHS.set(f, readEpoch() ?? "");
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
