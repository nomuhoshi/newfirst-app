// 手感：Web Audio 合成音效 + 振动请求。全部包在 try/catch 里：没有声音或振动能力时学习照常进行。
// 不下载任何音频文件。
//
// iPhone 无声的原因（第二轮修复）：iOS Safari 只承认 touchend / click / keydown 是“能解锁音频的用户操作”，
// 不承认 pointerdown。第一版只在 pointerdown 里创建并恢复 AudioContext，所以它在 iPhone 上一直停在
// suspended，而播放函数在非 running 时直接放弃，结果就是完全没声音。现在改成：
//   1. 在 pointerdown / touchend / click / keydown 都尝试创建和恢复，并播一个静音缓冲完成解锁；
//   2. 播放时如果还没 running，就先 resume，成功后（300ms 内）再播；
//   3. 合成音量整体调高；
//   4. “我的”页有试听按钮和诊断信息，方便在真机上确认。

const prefs = { sound: true, haptics: true };
export const log = []; // 给自动测试和诊断看：实际请求过哪些音效 / 振动
const note = (n) => { log.push(n); if (log.length > 200) log.shift(); };
export const stats = { played: 0, dropped: 0, resumed: 0, lastError: "" };

export const reducedMotion = () => {
  try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};
export const hapticsSupported = () => typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function setPrefs(p) {
  prefs.sound = p?.sound !== false;
  prefs.haptics = p?.haptics !== false;
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
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
    // 让声音跟随 iPhone 静音键，并和其他音乐混合播放（Safari 16.4+）
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* 忽略 */ }
  } catch (e) { ctx = null; stats.lastError = "创建音频失败：" + (e?.message || e); }
  return ctx;
}

// 用户操作里调用：创建 / 恢复音频环境，并播一个极短的静音缓冲（iOS 的标准解锁做法）
export function unlock() {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state !== "running") c.resume().then(() => { stats.resumed++; }).catch((e) => { stats.lastError = "resume 失败：" + (e?.message || e); });
    if (!primed) {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
      primed = true;
    }
  } catch (e) { stats.lastError = "解锁失败：" + (e?.message || e); }
}

function tone(freq, t0, dur, { type = "sine", gain = 0.12, slideTo } = {}) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(master);
  o.start(t0);
  o.stop(t0 + dur + 0.03);
}

// 每种音效：[总时长 ms, 播放函数]（音量比第一版整体调高约 2.5 倍）
const SOUNDS = {
  select: [35, (t) => tone(660, t, 0.04, { type: "triangle", gain: 0.2 })],                       // 轻“嗒”
  place:  [60, (t) => tone(330, t, 0.07, { type: "triangle", gain: 0.3, slideTo: 300 })],           // 稍清楚的“笃”
  undo:   [50, (t) => tone(420, t, 0.06, { type: "triangle", gain: 0.2, slideTo: 300 })],           // 轻“咔”
  correct: [180, (t) => { tone(523.25, t, 0.1, { gain: 0.32 }); tone(783.99, t + 0.09, 0.1, { gain: 0.32 }); }], // 柔和上行两音
  wrong:  [160, (t) => { tone(311.13, t, 0.09, { type: "triangle", gain: 0.26 }); tone(233.08, t + 0.08, 0.09, { type: "triangle", gain: 0.26 }); }], // 更轻的下降两音
  finish: [420, (t) => { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.14, 0.15, { gain: 0.3 })); }], // 温和三音
};

const lastAt = {};
let voices = 0;
function sound(c, name) {
  const [dur, fn] = SOUNDS[name];
  voices++;
  setTimeout(() => { voices = Math.max(0, voices - 1); }, dur + 40);
  fn(c.currentTime + 0.005);
  stats.played++;
}

// force：试听按钮用，忽略开关和节流
export function play(name, { force = false } = {}) {
  if ((!prefs.sound && !force) || !SOUNDS[name]) return Promise.resolve(false);
  note(name);
  try {
    const nowMs = performance.now();
    if (!force && nowMs - (lastAt[name] || -1e9) < 25) return Promise.resolve(false); // 同一种声音连点太快时不叠加
    lastAt[name] = nowMs;
    const c = getCtx();
    if (!c) { stats.dropped++; return Promise.resolve(false); }
    if (c.state === "running") {
      if (!force && voices >= 4) { stats.dropped++; return Promise.resolve(false); }
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
    hapticsPref: prefs.haptics,
    ...stats,
  };
}

if (typeof document !== "undefined") {
  // iOS 只承认 touchend / click / keydown 为能解锁音频的操作，所以全部监听
  for (const type of ["pointerdown", "touchend", "click", "keydown"]) document.addEventListener(type, unlock, { capture: true, passive: true });
  // 切到后台就停止声音，回来不重播历史事件
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
}
