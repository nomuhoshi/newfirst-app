// 手感：Web Audio 合成音效 + 安卓短振。全部包在 try/catch 里：没有声音或振动能力时学习照常进行。
// 不下载任何音频文件。iPhone 的 Safari 没有网页振动接口，所以那里只有视觉和声音反馈。

const prefs = { sound: true, haptics: true };
export const log = []; // 给自动测试看：实际请求过哪些音效 / 振动
const note = (n) => { log.push(n); if (log.length > 200) log.shift(); };

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
function getCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);
    // 让声音跟随 iPhone 静音键，并和其他音乐混合播放（Safari 16.4+）
    try { if (navigator.audioSession) navigator.audioSession.type = "ambient"; } catch { /* 忽略 */ }
  } catch { ctx = null; }
  return ctx;
}

// 在第一次触摸时创建 / 恢复音频环境（浏览器要求必须由用户操作触发）
export function unlock() {
  const c = getCtx();
  if (c && c.state === "suspended") c.resume().catch(() => {});
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

// 每种音效：[听感, 总时长 ms, 播放函数]
const SOUNDS = {
  select: [35, (t) => tone(660, t, 0.035, { type: "triangle", gain: 0.07 })],                    // 轻“嗒”
  place:  [60, (t) => tone(330, t, 0.06, { type: "triangle", gain: 0.11, slideTo: 300 })],        // 稍清楚的“笃”
  undo:   [50, (t) => tone(420, t, 0.05, { type: "triangle", gain: 0.07, slideTo: 300 })],        // 轻“咔”
  correct: [180, (t) => { tone(523.25, t, 0.09, { gain: 0.13 }); tone(783.99, t + 0.09, 0.09, { gain: 0.13 }); }], // 柔和上行两音
  wrong:  [160, (t) => { tone(311.13, t, 0.08, { type: "triangle", gain: 0.09 }); tone(233.08, t + 0.08, 0.08, { type: "triangle", gain: 0.09 }); }], // 更轻的下降两音
  finish: [420, (t) => { [523.25, 659.25, 783.99].forEach((f, i) => tone(f, t + i * 0.14, 0.14, { gain: 0.12 })); }], // 温和三音
};

const lastAt = {};
let voices = 0;
export function play(name) {
  if (!prefs.sound || !SOUNDS[name]) return;
  note(name);
  try {
    const nowMs = performance.now();
    if (nowMs - (lastAt[name] || -1e9) < 25) return; // 同一种声音连点太快时不叠加
    lastAt[name] = nowMs;
    const c = getCtx();
    if (!c) return;
    if (c.state === "suspended") c.resume().catch(() => {});
    if (c.state !== "running" || voices >= 4) return; // 不排队补响
    const [dur, fn] = SOUNDS[name];
    voices++;
    setTimeout(() => { voices = Math.max(0, voices - 1); }, dur + 40);
    fn(c.currentTime + 0.005);
  } catch { /* 声音失败不影响学习 */ }
}

// 只在“检查”和结算页“继续”时调用；iPhone 上没有这个接口，什么也不会发生
export function haptic() {
  if (!prefs.haptics || !hapticsSupported()) return;
  note("haptic");
  try { navigator.vibrate(12); } catch { /* 忽略 */ }
}

// 切到后台就停止声音，回来不重播历史事件
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (!ctx) return;
    if (document.visibilityState === "hidden") ctx.suspend().catch(() => {});
    else ctx.resume().catch(() => {});
  });
  document.addEventListener("pointerdown", unlock, { capture: true, passive: true });
}
