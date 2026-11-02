// 按键音效：十个原创的“矮轴机械键盘”风格（A–J），全部用 Web Audio 合成，不下载、不复制任何品牌录音。
// 默认风格是 J（极简 Tap），其余九个留给用户在“我的”页自己选。
// 每个风格的“按下”声音约 40–100 毫秒，带 trim 增益让十个风格响度接近；
// 游戏里的六种声音（点选、放入、撤销、答对、答错、过关）都是同一风格的变化：按键声换音高、叠几下。
// 这个文件不依赖 feel.js（feel.js 引用它来播放），tests 用 OfflineAudioContext 实测时长和响度。
export const DEFAULT_STYLE = "J";

export const KEY_SOUNDS = [
  { id: "A", name: "清脆矮轴", desc: "短促、干净、轻微触底声" },
  { id: "B", name: "奶油矮轴", desc: "更柔和，低频稍多" },
  { id: "C", name: "轻段落轴", desc: "按下时有轻微的段落感" },
  { id: "D", name: "铝板矮轴", desc: "清脆，带极短的金属感" },
  { id: "E", name: "塑料外壳", desc: "轻巧、偏明亮" },
  { id: "F", name: "静音矮轴", desc: "声音很短、很克制" },
  { id: "G", name: "深沉矮轴", desc: "触底声稍厚" },
  { id: "H", name: "弹性垫片", desc: "柔软，带一点回弹感" },
  { id: "I", name: "陶瓷清响", desc: "清亮但不刺耳" },
  { id: "J", name: "极简 Tap", desc: "非常短，适合连续点击" },
];

// ---- 构件 ----
let PITCH = 1; // 渲染某一下按键时的音高倍数（同系列变化用）
let noiseBuf = null;
function noise(ctx) {
  if (noiseBuf && noiseBuf.sampleRate === ctx.sampleRate) return noiseBuf;
  const len = Math.floor(ctx.sampleRate * 0.12);
  const b = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345; // 固定种子：每次听到的“嗒”都一样，也方便测试
  for (let i = 0; i < len; i++) { seed = (seed * 1664525 + 1013904223) >>> 0; d[i] = (seed / 4294967296) * 2 - 1; }
  noiseBuf = b;
  return b;
}
// 带通噪声短脉冲：键帽“嗒”的一下
function click(ctx, out, t, { freq, q = 1, dur = 0.012, gain = 0.5, type = "bandpass" }) {
  const src = ctx.createBufferSource(); src.buffer = noise(ctx);
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq * PITCH; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.01);
  return t + dur;
}
// 音调下滑：外壳共鸣的“笃”
function thock(ctx, out, t, { from, to, dur = 0.05, gain = 0.3, type = "sine" }) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from * PITCH, t); o.frequency.exponentialRampToValueAtTime(to * PITCH, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.01);
  return t + dur;
}
// 高频短“叮”：金属 / 陶瓷
function ping(ctx, out, t, { freq, dur = 0.05, gain = 0.1 }) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq * PITCH;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.01);
  return t + dur;
}

// 每个音效：返回结束时间（秒，相对起点）。trim 让响度接近。
const DEFS = {
  A: { trim: 0.98, run: (c, o, t) => Math.max(click(c, o, t, { freq: 3500, q: 1.2, dur: 0.014, gain: 0.5 }), thock(c, o, t, { from: 220, to: 140, dur: 0.045, gain: 0.35 }), click(c, o, t + 0.022, { freq: 2200, q: 0.9, dur: 0.018, gain: 0.25, type: "bandpass" })) },
  B: { trim: 0.6, run: (c, o, t) => Math.max(click(c, o, t, { freq: 1800, q: 0.8, dur: 0.018, gain: 0.35 }), thock(c, o, t, { from: 170, to: 100, dur: 0.075, gain: 0.5 })) },
  C: { trim: 1.19, run: (c, o, t) => Math.max(click(c, o, t, { freq: 4200, q: 1.2, dur: 0.008, gain: 0.35 }), click(c, o, t + 0.028, { freq: 3000, q: 1, dur: 0.012, gain: 0.4 }), thock(c, o, t + 0.028, { from: 200, to: 130, dur: 0.05, gain: 0.3 })) },
  D: { trim: 1.07, run: (c, o, t) => Math.max(click(c, o, t, { freq: 3800, q: 1.2, dur: 0.012, gain: 0.45 }), thock(c, o, t, { from: 190, to: 120, dur: 0.045, gain: 0.3 }), ping(c, o, t + 0.002, { freq: 2600, dur: 0.065, gain: 0.12 })) },
  E: { trim: 1.81, run: (c, o, t) => Math.max(click(c, o, t, { freq: 4800, q: 0.9, dur: 0.016, gain: 0.45 }), thock(c, o, t, { from: 300, to: 200, dur: 0.04, gain: 0.25, type: "triangle" })) },
  F: { trim: 1.93, run: (c, o, t) => Math.max(click(c, o, t, { freq: 1500, q: 0.8, dur: 0.01, gain: 0.22 }), thock(c, o, t, { from: 150, to: 110, dur: 0.04, gain: 0.22 })) },
  G: { trim: 0.48, run: (c, o, t) => Math.max(thock(c, o, t, { from: 140, to: 80, dur: 0.09, gain: 0.6 }), click(c, o, t, { freq: 1200, q: 0.8, dur: 0.014, gain: 0.4 })) },
  H: { trim: 0.8, run: (c, o, t) => Math.max(thock(c, o, t, { from: 190, to: 120, dur: 0.055, gain: 0.4 }), thock(c, o, t + 0.03, { from: 260, to: 200, dur: 0.035, gain: 0.15 }), click(c, o, t, { freq: 2400, q: 1, dur: 0.012, gain: 0.3 })) },
  I: { trim: 1.1, run: (c, o, t) => Math.max(ping(c, o, t, { freq: 3200, dur: 0.075, gain: 0.22 }), ping(c, o, t, { freq: 4800, dur: 0.05, gain: 0.08 }), click(c, o, t, { freq: 5200, q: 1.2, dur: 0.006, gain: 0.25 }), thock(c, o, t, { from: 260, to: 180, dur: 0.03, gain: 0.15 })) },
  J: { trim: 1.45, run: (c, o, t) => Math.max(click(c, o, t, { freq: 3000, q: 1, dur: 0.008, gain: 0.45 }), thock(c, o, t, { from: 240, to: 170, dur: 0.04, gain: 0.25 })) },
};
export const TRIMS = Object.fromEntries(Object.entries(DEFS).map(([k, v]) => [k, v.trim]));

// 把某风格的“一下按键”画进任意 AudioContext（真实的或离线的）；返回结束时间（秒，相对 t0）
function renderTap(ctx, dest, id, t0, pitch, gain) {
  const g = ctx.createGain();
  g.gain.value = DEFS[id].trim * gain;
  g.connect(dest);
  PITCH = pitch;
  try { return DEFS[id].run(ctx, g, t0) - t0; } finally { PITCH = 1; }
}
export function renderKey(ctx, dest, id, t0) { return Math.round(renderTap(ctx, dest, id, t0, 1, 1) * 1000); }

// 游戏里的六种声音：同一风格的变化。每一项是若干下按键：[相对时间 s, 音高倍数, 音量倍数]
export const EVENTS = {
  select:  [[0, 1.0, 1.0]],                                    // 点选：就是这个风格的“一下”
  place:   [[0, 0.82, 1.1]],                                   // 放入：低一点、厚一点
  undo:    [[0, 1.25, 0.9]],                                   // 撤销：高一点、轻一点
  correct: [[0, 1.0, 0.9], [0.075, 1.5, 1.0]],                 // 答对：两下，向上
  wrong:   [[0, 0.8, 0.9], [0.085, 0.6, 0.9]],                 // 答错：两下，向下、更低沉
  finish:  [[0, 1.0, 0.8], [0.09, 1.25, 0.9], [0.18, 1.5, 1.0]], // 过关：三下，一级一级向上
};
export function renderEvent(ctx, dest, id, event, t0) {
  let end = 0;
  for (const [off, pitch, gain] of EVENTS[event]) end = Math.max(end, off + renderTap(ctx, dest, id, t0 + off, pitch, gain));
  return Math.round(end * 1000);
}

// 实测：离线渲染，返回 { ms 名义时长, audibleMs 可听时长, peak 峰值, rms 整个声音的能量除以固定 100ms 窗口再开方 }
export async function measureKey(id, event = "select") {
  const sr = 44100;
  const oc = new OfflineAudioContext(1, Math.floor(sr * 0.6), sr);
  const ms = renderEvent(oc, oc.destination, id, event, 0);
  const buf = await oc.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0;
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
  let last = 0; for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > peak * 0.01) { last = i; break; }
  // 响度：整个声音的能量除以固定的 100ms 窗口（短声音不会因为“平均到静音上”而显得更轻）
  let sum = 0; for (let i = 0; i < d.length; i++) sum += d[i] * d[i];
  return { ms, audibleMs: Math.round((last / sr) * 1000), peak, rms: Math.sqrt(sum / (0.1 * sr)) };
}
