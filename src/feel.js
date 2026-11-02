// 手感：Web Audio 合成音效 + 振动请求。全部包在 try/catch 里：没有声音或振动能力时学习照常进行。
// 不下载任何音频文件。
//
// iPhone 无声的原因（第三轮定位）：iOS Safari 只承认 touchend / click / keydown 是“能解锁音频的用户操作”，
// 不承认 pointerdown。游戏里的按钮原来都是在 pointerdown 时就执行（包括“试听音效”），而“我的”页的
// 音频测试 A/B/C 用的是真正的 click，所以测试能响、正式关卡没声音。现在：
//   1. 游戏按钮改成真正的 click（见 app.js 的 button()），选项、检查、继续都发生在合法的用户操作里；
//   2. 只在 touchend / click / keydown 里创建和恢复 AudioContext，每次还没 running 就再解锁一次
//      （此前只在第一次、而且是在 pointerdown 里播过静音缓冲，之后再也没有重试）；
//   3. 播放时如果还没 running，先 resume，成功后（300ms 内）再播；
//   4. 状态变化会记录下来，显示在“我的”页的诊断里。

import { DEFAULT_STYLE, KEY_SOUNDS, renderEvent, EVENTS } from "./keysounds.js";

const prefs = { sound: true, haptics: true, soundStyle: DEFAULT_STYLE };
export const log = []; // 给自动测试和诊断看：实际请求过哪些音效 / 振动
const note = (n) => { log.push(n); if (log.length > 200) log.shift(); };
export const stats = { played: 0, dropped: 0, resumed: 0, unlocks: 0, lastError: "", history: [] };

export const reducedMotion = () => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
export const hapticsSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function setPrefs(p) {
  prefs.sound = p?.sound !== false;
  prefs.haptics = p?.haptics !== false;
  prefs.soundStyle = KEY_SOUNDS.some((k) => k.id === p?.soundStyle) ? p.soundStyle : DEFAULT_STYLE;
}

let ctx = null;
let master = null;
let primed = false;
function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { stats.lastError = "浏览器没有 AudioContext"; return null; }
    ctx = new AC();
    stats.history.push(`创建:${ctx.state}`);
    ctx.addEventListener?.("statechange", () => { stats.history.push(`→${ctx.state}`); if (stats.history.length > 8) stats.history.shift(); });
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // 让声音跟随 iPhone 静音键，并和其他音乐混合播放（Safari 16.4+）
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* 忽略 */ }
  } catch (e) { ctx = null; stats.lastError = "创建音频失败：" + (e?.message || e); }
  return ctx;
}

// 用户操作（touchend / click / keydown）里调用：创建 / 恢复音频环境，并播一个极短的静音缓冲。
// 只要还没 running 就重试，不再“只试一次”。
export function unlock() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state !== "running") {
      stats.unlocks++;
      c.resume().then(() => { stats.resumed++; }).catch((e) => { stats.lastError = "resume 失败：" + (e?.message || e); });
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    }
  } catch (e) { stats.lastError = "解锁失败：" + (e?.message || e); }
}

// ---- 声音：当前按键风格（默认 J）的六种变化，由 keysounds.js 合成 ----
const SOUND_MS = { select: 40, place: 55, undo: 40, correct: 140, wrong: 150, finish: 280 }; // 名义时长，用来计算同时发声数
const lastAt = {};
let active = []; // 正在发声的声音：{ gain, until }
export const activeCount = () => active.filter((v) => v.until > performance.now()).length;

// 画一个声音；同时最多 3 个，多出来的旧声音快速淡出（不会无限叠加）
function sound(c, name, style = prefs.soundStyle) {
  const nowMs = performance.now();
  active = active.filter((v) => v.until > nowMs);
  while (active.length >= 3) {
    const old = active.shift();
    try { old.gain.gain.cancelScheduledValues?.(c.currentTime); old.gain.gain.setValueAtTime?.(old.gain.gain.value ?? 1, c.currentTime); old.gain.gain.linearRampToValueAtTime?.(0.0001, c.currentTime + 0.01); } catch { /* 忽略 */ }
  }
  const voice = c.createGain();
  voice.connect(master);
  const ms = renderEvent(c, voice, style, name, c.currentTime + 0.005);
  active.push({ gain: voice, until: nowMs + Math.max(ms, SOUND_MS[name] || 0) + 20 });
  stats.played++;
}

// force：试听按钮用，忽略开关和节流
export function play(name, { force = false } = {}) {
  if ((!prefs.sound && !force) || !EVENTS[name]) return Promise.resolve(false);
  note(name);
  try {
    const nowMs = performance.now();
    if (!force && nowMs - (lastAt[name] || -1e9) < 25) return Promise.resolve(false); // 同一种声音连点太快时不叠加
    lastAt[name] = nowMs;
    const c = getCtx();
    if (!c) { stats.dropped++; return Promise.resolve(false); }
    if (c.state === "running") {
      sound(c, name);
      return Promise.resolve(true);
    }
    // 还没 running：先 resume，300ms 内成功才播（不排队补响历史事件）
    const asked = performance.now();
    return c.resume().then(() => {
      if (c.state === "running" && performance.now() - asked < (force ? 2000 : 300)) { stats.resumed++; sound(c, name); return true; }
      stats.dropped++; return false;
    }).catch((e) => { stats.dropped++; stats.lastError = "resume 失败：" + (e?.message || e); return false; });
  } catch (e) { stats.lastError = "播放失败：" + (e?.message || e); return Promise.resolve(false); }
}

// “我的”页选音效：用指定风格试听一个声音（必须在点击里调用）。返回 { ok, state }
export function playStyle(style, event = "select") {
  unlock();
  const c = getCtx();
  if (!c || !KEY_SOUNDS.some((k) => k.id === style) || !EVENTS[event]) return { ok: false, state: c ? c.state : "不可用" };
  note(`${style}:${event}`);
  try {
    sound(c, event, style); // 即使还没 running 也排进去：iOS 上同一个点击里的 resume 通常随后生效
    return { ok: c.state === "running", state: c.state };
  } catch (e) { stats.lastError = "试听失败：" + (e?.message || e); return { ok: false, state: c.state }; }
}
export const currentStyle = () => prefs.soundStyle;

// 给其他模块用：在用户操作里取得共享的音频环境和总音量节点
export function audioContext() { unlock(); return getCtx(); }
export function masterNode() { return master; }

// 试听按钮：必须在点击里调用；播放答对音
export function preview() {
  unlock();
  return play("correct", { force: true });
}

// 只在“检查”和结算页“继续”时调用。
// 没有 navigator.vibrate 的浏览器（包括 iPhone 的 Safari）这里什么也不做；
// 实测 iPhone 点击时有轻微振动，具体来源见“我的”页的诊断信息和 docs/10。
export function haptic() {
  if (!prefs.haptics || !hapticsSupported()) return;
  note("haptic");
  try { navigator.vibrate(12); } catch { /* 忽略 */ }
}

// 诊断信息：给“我的”页显示，方便真机排查
export function diagnostics() {
  return {
    audioState: ctx ? ctx.state : "未创建",
    sampleRate: ctx ? ctx.sampleRate : 0,
    hasAudioContext: !!(window.AudioContext || window.webkitAudioContext),
    audioSession: (() => { try { return navigator.audioSession ? navigator.audioSession.type : "无"; } catch { return "无"; } })(),
    vibrate: hapticsSupported(),
    soundPref: prefs.sound,
    soundStyle: prefs.soundStyle,
    hapticsPref: prefs.haptics,
    ...stats,
    history: stats.history.join(" "),
  };
}

if (typeof document !== "undefined") {
  // iOS 只承认 touchend / click / keydown 为能解锁音频的操作，所以全部监听
  for (const type of ["touchend", "click", "keydown"]) document.addEventListener(type, unlock, { capture: true, passive: true });
  // 切到后台就停止声音，回来不重播历史事件
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}
