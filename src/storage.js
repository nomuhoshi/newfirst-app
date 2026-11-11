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

// =====================================================================================
// 本机存储 v4：每个页面（标签页）只写自己的键，读取时合并
// -------------------------------------------------------------------------------------
// 为什么：旧格式把整份进度放在一个共享的键 suipian.progress 里，任何页面“读-改-写”都可能盖掉别的页面刚写的内容，
//   localStorage 没有跨页面的原子更新，所以补写重试保证不了安全。v4 里没有共享的可变记录：
//   suipian.v4.epoch            当前“清除代数”。没有 = "m0"（从未清除过）。
//   suipian.v4.base.<epoch>     这一代的基线：迁移时从旧键 suipian.progress 复制过来的进度（旧键原样保留不动）；清除后的新一代基线是空的。
//   suipian.v4.tab.<随机>       某个页面（或压缩池）的账本：{ v:4, epoch, entries:{ 页面id: 账本条目 } }。每个页面只写自己的键。
//   账本条目 = { xp, runs, firstXp:{关卡:XP}, done, doneOn, lastDay, streak, meta:{t,hearts,heartsAt,prefs,onboarded,installTipClosed} }
// 合并规则全部是“并集 / 取最大 / 求和”这类交换律、幂等的运算，所以重复读、乱序读、同一份被读两遍结果都一样：
//   done 并集；doneOn 取最早日期；firstXp 每关取各页面的最大值（基线里已完成的关卡不再计首次奖励）——同一关两个页面同时首次通关，奖励只算一次；
//   xp = 基线 xp + Σ 各页面 xp + Σ 各关 firstXp；lessonsCompleted = 基线次数 + Σ 各页面 runs（同一关两个页面各完成一次 = 两次，语义见 docs/56）；
//   streak / lastDay 跟最后学习日期最新的一方；红心 / 偏好 / 开场标记取 meta.t 最新的一方。
// 页面 id：每次页面加载都生成新的随机 id（不用 sessionStorage：复制标签页 / 部分新窗口会继承它，两个同时活着的页面就会写同一个键）。刷新后是新 id、新键，旧键的账本原样保留，合并时各取各的，不会重复计分。
// 不做自动压缩 / 删除（压缩与另一页的并发更新有竞争窗口，会丢进度）；键会随“有保存动作的页面加载次数”增长，空间不足时保存明确失败（返回 false，页面提示）。
// 旧键 suipian.progress：一次性迁移（只读，不改不删），此后 v4 **不再从旧键读取进度**（不自动回灌）；v4 保存后另写一份旧格式镜像，仅为兼容尽力而为，不是进度来源，写失败不影响保存结果。
//   旧代码页面之后写进旧键的内容不会被迁入；清除之后这一代同样不读旧键。
// =====================================================================================
const K_EPOCH = "suipian.v4.epoch", K_BASE = "suipian.v4.base.", K_TAB = "suipian.v4.tab.", K_TABID = "suipian.v4.tabId";
const M0 = "m0";
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
const rnd = () => Math.random().toString(36).slice(2, 10);
const LS = () => globalThis.localStorage;
const rd = (S, k) => { try { return { ok: true, v: S.getItem(k) }; } catch { return { ok: false }; } };
const wr = (S, k, v) => { try { S.setItem(k, v); return true; } catch { return false; } };
const rm = (S, k) => { try { S.removeItem(k); return true; } catch { return false; } };
// 枚举失败返回 null（不能当成“没有键”）
const keysWith = (S, prefix) => { const out = []; try { for (let i = 0; i < S.length; i++) { const k = S.key(i); if (k && k.startsWith(prefix)) out.push(k); } } catch { return null; } return out; };
const parse = (raw) => { try { const o = JSON.parse(raw); return o && typeof o === "object" ? o : null; } catch { return null; } };

const emptyEntry = () => ({ xp: 0, runs: 0, firstXp: {}, done: {}, doneOn: {}, lastDay: null, streak: 0, meta: null });
// 把 b 并进 a（逐字段取最大 / 并集），返回 a
function joinEntry(a, b) {
  if (!b || typeof b !== "object") return a;
  a.xp = Math.max(num(a.xp), num(b.xp)); a.runs = Math.max(num(a.runs), num(b.runs));
  for (const [k, v] of Object.entries(b.firstXp || {})) if (num(v) > num(a.firstXp[k])) a.firstXp[k] = num(v);
  for (const [k, v] of Object.entries(b.done || {})) if (v) a.done[k] = true;
  for (const [k, v] of Object.entries(b.doneOn || {})) if (typeof v === "string" && ISO.test(v) && (!a.doneOn[k] || v < a.doneOn[k])) a.doneOn[k] = v;
  const ld = typeof b.lastDay === "string" && ISO.test(b.lastDay) ? b.lastDay : null;
  if (ld && (!a.lastDay || ld > a.lastDay)) { a.lastDay = ld; a.streak = num(b.streak); } else if (ld && ld === a.lastDay) a.streak = Math.max(num(a.streak), num(b.streak));
  if (b.meta && typeof b.meta === "object" && num(b.meta.t) > num(a.meta && a.meta.t)) a.meta = b.meta;
  return a;
}
const cloneEntry = (e) => joinEntry(emptyEntry(), e);

function getEpoch(S) { const r = rd(S, K_EPOCH); return r.ok ? r.v || M0 : null; }
// 读取 / 建立某一代的基线。返回 { ok, base, notice, unsaved }。读取异常 ok:false（绝不当成“没有记录”）。
function ensureBase(S, epoch) {
  const key = K_BASE + epoch, r = rd(S, key);
  if (!r.ok) return { ok: false };
  const have = r.v && parse(r.v);
  if (have && have.v === 4 && have.epoch === epoch) return { ok: true, base: have, notice: null };
  let base = { v: 4, epoch, s: {}, legacyXp: 0, legacyRuns: 0 }, notice = null;
  if (epoch !== M0) base.ignoreLegacy = true;
  else {
    const l = rd(S, KEY);
    if (!l.ok) return { ok: false };
    if (l.v) {
      let data = null, syntaxBad = false;
      try { data = JSON.parse(l.v); } catch { syntaxBad = true; }
      if (syntaxBad) { stashUnreadable(l.v); notice = "本机记录损坏，已从头开始。"; }
      else if (!data || typeof data !== "object") { stashUnreadable(l.v); notice = "学习记录的格式无法识别，已从头开始。"; }
      else if (data.version === 1 || data.version === 2) { stashUnreadable(l.v); notice = "课程改版为关卡模式，旧版的学习记录不再使用，请从第一关开始。"; base.s.installTipClosed = !!data.installTipClosed; }
      else if (data.version !== DATA_VERSION) { stashUnreadable(l.v); notice = "学习记录的格式无法识别，已从头开始。"; }
      else {
        const doneOn = {};
        if (data.doneOn && typeof data.doneOn === "object") for (const [k, v] of Object.entries(data.doneOn)) if (typeof v === "string" && ISO.test(v)) doneOn[k] = v;
        const prefs = { ...freshState().prefs, ...(data.prefs && typeof data.prefs === "object" ? data.prefs : {}) };
        if (!/^[A-J]$/.test(prefs.soundStyle)) prefs.soundStyle = "J";
        delete prefs.keySound;
        const KNOWN = new Set(["version", "done", "doneOn", "xp", "lessonsCompleted", "streak", "lastDay", "onboarded", "installTipClosed", "hearts", "heartsAt", "prefs", "lastActive", "mirrorXp", "mirrorRuns", "mirrorFp"]);
        const extra = {}; for (const [k, v] of Object.entries(data)) if (!KNOWN.has(k)) extra[k] = v;
        base.s = { extra, done: { ...(data.done && typeof data.done === "object" ? data.done : {}) }, doneOn, xp: num(data.xp), lessonsCompleted: num(data.lessonsCompleted), streak: num(data.streak), lastDay: typeof data.lastDay === "string" ? data.lastDay : null, onboarded: !!data.onboarded, installTipClosed: !!data.installTipClosed, hearts: Number.isFinite(data.hearts) ? data.hearts : HEARTS_MAX, heartsAt: Number.isFinite(data.heartsAt) ? data.heartsAt : Date.now(), prefs, lastActive: num(data.lastActive) };
        base.legacyXp = base.s.xp; base.legacyRuns = base.s.lessonsCompleted;
      }
    }
  }
  const unsaved = !wr(S, key, JSON.stringify(base)); // 写不进去：本次先用内存里的基线，旧键没动，下次打开会再迁移（幂等）
  return { ok: true, base, notice, unsaved };
}
// 读出所有账本，合并成 { 页面id: 条目 }（只认当前这一代）；same 是本页面的内存账本（和存储里同 id 的取最大）
function scanEntries(S, epoch, own) {
  const all = {}, keys = keysWith(S, K_TAB);
  if (keys === null) return null; // 枚举失败：视图不完整
  for (const k of keys) {
    const r = rd(S, k);
    if (!r.ok) return null;       // 某个账本读取失败：视图不完整，调用方必须当成读取异常
    if (!r.v) continue;
    const rec = parse(r.v);
    if (!rec) { if (!listUnreadable().some((x) => x.raw === r.v)) stashUnreadable(r.v); continue; } // 读不懂的账本：留一份备份，不当进度
    if (rec.v !== 4 || rec.epoch !== epoch || !rec.entries || typeof rec.entries !== "object") continue;
    for (const [id, e] of Object.entries(rec.entries)) joinEntry(all[id] || (all[id] = emptyEntry()), e);
  }
  if (own) joinEntry(all[own.id] || (all[own.id] = emptyEntry()), own.e);
  return { all, keys };
}
// ---- 旧键 suipian.progress ----
// 只在迁移时读一次；之后只是“尽力而为”的镜像（v4 保存成功后写一份旧格式的合并结果，供回滚 / 旧页面 / 排查参考，不是进度来源，v4 不读回）。
function mirrorRaw(v, state) {
  return JSON.stringify({ version: DATA_VERSION, onboarded: !!state.onboarded, xp: v.xp, hearts: state.hearts, heartsAt: state.heartsAt, streak: v.streak, lastDay: v.lastDay, done: v.done, doneOn: v.doneOn, lessonsCompleted: v.runs, installTipClosed: !!state.installTipClosed, lastActive: state.lastActive, prefs: state.prefs });
}
// 启动时：旧键里如果出现读不懂的内容（例如旧代码写坏），留一份备份（不当进度，不提示）
function stashLegacyIfUnreadable(S) {
  const r = rd(S, KEY);
  if (!r.ok || !r.v) return;
  const d = parse(r.v);
  if ((!d || (d.version !== DATA_VERSION)) && !listUnreadable().some((x) => x.raw === r.v)) stashUnreadable(r.v);
}
// 合并视图：基线 + 各页面条目（含 legacy）
function computeView(S, epoch, base, own) {
  const sc = scanEntries(S, epoch, own);
  if (!sc) return null; // 视图不完整（读取 / 枚举失败）
  const { all, keys } = sc;
  const bs = base.s || {}, baseDone = bs.done || {};
  const v = { done: { ...baseDone }, doneOn: { ...(bs.doneOn || {}) }, xp: num(bs.xp), runs: num(bs.lessonsCompleted), lastDay: bs.lastDay || null, streak: num(bs.streak), meta: null, onboarded: !!bs.onboarded, installTipClosed: !!bs.installTipClosed };
  const first = {};
  for (const e of Object.values(all)) {
    v.xp += num(e.xp); v.runs += num(e.runs);
    for (const [k, x] of Object.entries(e.firstXp)) if (num(x) > num(first[k])) first[k] = num(x);
    for (const k of Object.keys(e.done)) v.done[k] = true;
    for (const [k, d] of Object.entries(e.doneOn)) if (!v.doneOn[k] || d < v.doneOn[k]) v.doneOn[k] = d;
    if (e.lastDay && (!v.lastDay || e.lastDay > v.lastDay)) { v.lastDay = e.lastDay; v.streak = num(e.streak); } else if (e.lastDay && e.lastDay === v.lastDay) v.streak = Math.max(v.streak, num(e.streak));
    if (e.meta && num(e.meta.t) > num(v.meta && v.meta.t)) v.meta = e.meta;
    if (e.meta && e.meta.onboarded) v.onboarded = true;
    if (e.meta && e.meta.installTipClosed) v.installTipClosed = true;
  }
  for (const [k, x] of Object.entries(first)) if (!baseDone[k]) v.xp += x; // 基线里已完成的关卡不再计首次奖励
  v.entries = all; v.keys = keys;
  return v;
}

// ---- 页面账本（内存里，一个 state 对象对应一个）----
const LEDGERS = new WeakMap(); // state -> { id, epoch, e, metaT }
let lastSavedAt = 0;
export const getLastSavedAt = () => lastSavedAt;
function pageId() { return Date.now().toString(36) + rnd() + rnd(); } // 每次页面加载一个新 id
const PAGE_ID = pageId();
function attach(S, state, epoch, id = PAGE_ID) {
  const e = emptyEntry();
  const r = rd(S, K_TAB + id), rec = r.ok && r.v ? parse(r.v) : null; // 同一标签页刷新：接着写自己上一次的账本
  if (rec && rec.v === 4 && rec.epoch === epoch && rec.entries && rec.entries[id]) joinEntry(e, rec.entries[id]);
  const L = { id, epoch, e, metaT: 0 };
  LEDGERS.set(state, L);
  return L;
}
// 把合并视图写进内存记录（就地修改）。adoptMeta：红心 / 偏好 / 开场标记是否采用最新的一方
function applyView(state, v, L, { reset = false, adoptMeta = true } = {}) {
  const before = JSON.stringify([state.done, state.xp, state.lessonsCompleted, state.streak, state.lastDay, state.hearts, state.onboarded]);
  state.done = { ...v.done }; state.doneOn = { ...v.doneOn };
  state.xp = v.xp; state.lessonsCompleted = v.runs; state.streak = v.streak; state.lastDay = v.lastDay;
  if (v.onboarded) state.onboarded = true; if (v.installTipClosed) state.installTipClosed = true;
  if (reset) state.onboarded = true;
  if (adoptMeta && v.meta && num(v.meta.t) > L.metaT) {
    const m = v.meta;
    if (Number.isFinite(m.hearts)) state.hearts = Math.min(HEARTS_MAX, Math.max(0, m.hearts));
    if (Number.isFinite(m.heartsAt)) state.heartsAt = m.heartsAt;
    if (m.prefs && typeof m.prefs === "object") state.prefs = { ...state.prefs, ...m.prefs };
    L.metaT = num(m.t);
  }
  return before !== JSON.stringify([state.done, state.xp, state.lessonsCompleted, state.streak, state.lastDay, state.hearts, state.onboarded]);
}
const NO_SAVE = "这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。";
function stateFromView(S, epoch, base) {
  const state = freshState();
  state.prefs = { ...state.prefs, ...(base.s && base.s.prefs ? base.s.prefs : {}) };
  if (Number.isFinite(base.s && base.s.hearts)) { state.hearts = base.s.hearts; state.heartsAt = base.s.heartsAt; }
  state.lastActive = num(base.s && base.s.lastActive);
  if (base.s && base.s.extra) for (const [k, v] of Object.entries(base.s.extra)) if (!(k in state)) state[k] = v; // 旧记录里的未知字段原样带着
  const L = attach(S, state, epoch);
  const v = computeView(S, epoch, base, L);
  if (!v) return null; // 视图不完整：不能当成完整记录
  applyView(state, v, L);
  return { state, L };
}

export function loadState() {
  const S = LS();
  const epoch = getEpoch(S);
  if (epoch === null) return { state: freshState(), notice: NO_SAVE, readFailed: true };
  const b = ensureBase(S, epoch);
  if (!b.ok) return { state: freshState(), notice: NO_SAVE, readFailed: true };
  const r = stateFromView(S, epoch, b.base);
  if (!r) return { state: freshState(), notice: "读取本机学习记录时出错，这次先不保存，请刷新重试（记录没有被改动）。", readFailed: true };
  stashLegacyIfUnreadable(S);
  return { state: r.state, notice: b.notice };
}

// 别处清除过（代数变了）：丢弃内存里的旧记录，采用新一代的状态。视图读不完整时返回 false，内存记录不动。
function adoptEpoch(S, state, epoch, base) {
  const prefs = state.prefs, L = attach(S, state, epoch);
  const v = computeView(S, epoch, base, L);
  if (!v) return false;
  applyView(state, v, L, { reset: true }); state.prefs = { ...state.prefs, ...prefs };
  return true;
}

// 保存：只写自己的键，其余键不动。失败（读取异常 / 视图不完整 / 写入失败 / 空间不足）返回 false，不更新“最后成功保存时间”，内存进度保留，下次保存补上。
export function saveState(state) {
  const S = LS();
  try {
    const epoch = getEpoch(S);
    if (epoch === null) return false;
    const b = ensureBase(S, epoch);
    if (!b.ok) return false;
    let L = LEDGERS.get(state);
    if (L && L.epoch !== epoch) return adoptEpoch(S, state, epoch, b.base); // 别处清除过：采用新一代
    if (!L) L = attach(S, state, epoch);
    const e = L.e;
    // 记录页面自己的进度：关卡 / 日期 / 连续天数从内存记录取；XP / 次数在 addXp / addRun 里已经记过，这里只补“直接改了总数”的差额（如导入进度文件）
    const v0 = computeView(S, epoch, b.base, L);
    if (!v0) return false;
    for (const k of Object.keys(state.done)) if (state.done[k]) e.done[k] = true;
    for (const [k, d] of Object.entries(state.doneOn || {})) if (typeof d === "string" && ISO.test(d)) e.doneOn[k] = d;
    if (state.lastDay) { e.lastDay = state.lastDay; e.streak = num(state.streak); }
    if (state.xp > v0.xp) e.xp += state.xp - v0.xp;
    if (state.lessonsCompleted > v0.runs) e.runs += state.lessonsCompleted - v0.runs;
    state.lastActive = Date.now();
    e.meta = { t: state.lastActive, hearts: state.hearts, heartsAt: state.heartsAt, prefs: state.prefs, onboarded: !!state.onboarded, installTipClosed: !!state.installTipClosed };
    L.metaT = e.meta.t;
    if (!wr(S, K_TAB + L.id, JSON.stringify({ v: 4, epoch, entries: { [L.id]: e } }))) return false;
    // 写完再核对一次代数：处理期间发生了清除 → 刚写的是旧代账本（读者会忽略），不写镜像，内存采用新一代，不显示旧进度
    const ep2 = getEpoch(S);
    if (ep2 === null) return false;
    if (ep2 !== epoch) return adoptEpoch(S, state, ep2, ensureBase(S, ep2).base || { s: {} });
    const v1 = computeView(S, epoch, b.base, L);
    if (!v1) return false;
    applyView(state, v1, L, { adoptMeta: false });
    wr(S, KEY, mirrorRaw(v1, state)); // 兼容镜像：尽力而为，失败不影响保存结果（v4 才是进度来源）
    lastSavedAt = Date.now();
    return true;
  } catch {
    return false;
  }
}
// 回前台 / storage 事件 / pageshow：把别的页面的进度读进来（不写）。返回内存记录是否有变化；读取异常返回 false 且不动内存。
export function mergeStored(state) {
  const S = LS();
  try {
    const epoch = getEpoch(S); if (epoch === null) return false;
    const b = ensureBase(S, epoch); if (!b.ok) return false;
    let L = LEDGERS.get(state);
    if (L && L.epoch !== epoch) return adoptEpoch(S, state, epoch, b.base);
    if (!L) L = attach(S, state, epoch);
    const v = computeView(S, epoch, b.base, L);
    return v ? applyView(state, v, L) : false;
  } catch { return false; }
}
export const syncFromStorage = mergeStored;
// 加 XP。first：这是该关“首次通关途中”拿到的 XP（记在 firstXp[关卡]，合并取最大）；否则（复习、练习）记在本页面名下
export function addXp(state, amount, lessonId = null, first = false) {
  const S = LS();
  let L = LEDGERS.get(state);
  if (!L) { const epoch = getEpoch(S) ?? M0; L = attach(S, state, epoch); }
  if (first && lessonId) L.e.firstXp[lessonId] = num(L.e.firstXp[lessonId]) + amount;
  else L.e.xp += amount;
  state.xp += amount;
}
export function addRun(state) {
  let L = LEDGERS.get(state);
  if (!L) { const epoch = getEpoch(LS()) ?? M0; L = attach(LS(), state, epoch); }
  L.e.runs += 1; state.lessonsCompleted += 1;
}
// 仅测试：让同一进程里的多个内存记录扮成不同页面
export function _asTab(state, id) { const S = LS(); const epoch = getEpoch(S) ?? M0; attach(S, state, epoch, id); return state; }

// 清除学习记录：新开一代（epoch）。旧页面发现代数变了就丢弃内存里的旧记录；旧键也一并删掉，且新一代起忽略旧键，旧标签页再写旧键不会复活。
function clearOn(S) {
  const epoch = "c" + Date.now().toString(36) + rnd();
  const old = getEpoch(S);
  if (!wr(S, K_EPOCH, epoch)) return { ok: false };
  const base = { v: 4, epoch, s: {}, legacyXp: 0, legacyRuns: 0, ignoreLegacy: true };
  wr(S, K_BASE + epoch, JSON.stringify(base));
  rm(S, KEY);
  if (old) rm(S, K_BASE + old);
  for (const k of keysWith(S, K_TAB) || []) { const r = rd(S, k), x = r.ok && r.v ? parse(r.v) : null; if (x && x.v === 4 && x.epoch !== epoch) rm(S, k); }
  return { ok: true, epoch, base };
}
export function clearState() {
  const S = LS();
  const c = clearOn(S);
  const f = freshState();
  if (!c.ok) { f.clearFailed = true; return f; }
  attach(S, f, c.epoch);
  return f;
}

// ---------- 账号功能的兼容入口（账号功能未开放）：游客记录一律读完整的 v4 合并视图（不读旧键镜像）；清除游客记录时连 v4 一起清 ----------
export function hasV4(S) { const k = keysWith(S, "suipian.v4."); return k === null ? true : k.length > 0; } // 枚举失败按“有 v4”处理（guestRawV3 随后会返回 null = 读取失败，不会被当成没有记录）
// 把完整的 v4 合并视图导出成旧格式（v3）JSON：账号接管 / 导出读取这个，不读旧键镜像。视图不完整（读取 / 枚举失败）返回 null，调用方必须当成“读取失败”而不是“没有记录”。
// 内容只由存储决定（lastActive 固定 0），同一份存储每次导出逐字相同。
export function guestRawV3(S) {
  const epoch = getEpoch(S); if (epoch === null) return null;
  const b = ensureBase(S, epoch); if (!b.ok) return null;
  const v = computeView(S, epoch, b.base, null);
  if (!v) return null;
  const s = freshState(), m = v.meta || {}, bs = b.base.s || {};
  Object.assign(s, { onboarded: v.onboarded, xp: v.xp, hearts: Number.isFinite(m.hearts) ? m.hearts : (bs.hearts ?? HEARTS_MAX), heartsAt: Number.isFinite(m.heartsAt) ? m.heartsAt : (bs.heartsAt ?? 0), streak: v.streak, lastDay: v.lastDay, done: v.done, doneOn: v.doneOn, lessonsCompleted: v.runs, installTipClosed: v.installTipClosed, lastActive: 0 });
  if (m.prefs) s.prefs = { ...s.prefs, ...m.prefs };
  return JSON.stringify(s);
}
// 账号接管游客记录后清除（清除整代；返回是否成功）
export function clearGuestV4(S) { return clearOn(S).ok; }

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
