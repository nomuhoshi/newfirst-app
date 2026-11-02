// 按键音效选择实验室：十个原创的“矮轴机械键盘”方向音效（A–J），全部用 Web Audio 合成，不下载、不复制任何品牌录音。
// 每个 40–100 毫秒；每个都带一个 trim 增益，让十个声音的响度接近（tests 用 OfflineAudioContext 实测）。
// 暂时只在“我的”页试听和选择，不接进答题流程；选定后再做“点选、放入、撤销、答对、答错、过关”的同系列变化。
import * as feel from "./feel.js";

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
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.0008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(out);
  src.start(t); src.stop(t + dur + 0.01);
  return t + dur;
}
// 音调下滑：外壳共鸣的“笃”
function thock(ctx, out, t, { from, to, dur = 0.05, gain = 0.3, type = "sine" }) {
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(from, t); o.frequency.exponentialRampToValueAtTime(to, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.01);
  return t + dur;
}
// 高频短“叮”：金属 / 陶瓷
function ping(ctx, out, t, { freq, dur = 0.05, gain = 0.1 }) {
  const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = freq;
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

// 把一个音效画进任意 AudioContext（真实的或离线的）；返回时长（毫秒）
export function renderKey(ctx, dest, id, t0) {
  const g = ctx.createGain();
  g.gain.value = DEFS[id].trim;
  g.connect(dest);
  const end = DEFS[id].run(ctx, g, t0);
  return Math.round((end - t0) * 1000);
}

// 实测响度：离线渲染，返回 { ms 时长, peak 峰值, rms 前 120ms 的均方根 }
export async function measureKey(id) {
  const sr = 44100;
  const oc = new OfflineAudioContext(1, Math.floor(sr * 0.2), sr);
  const ms = renderKey(oc, oc.destination, id, 0);
  const buf = await oc.startRendering();
  const d = buf.getChannelData(0);
  let peak = 0, sum = 0; const n = Math.floor(sr * 0.12);
  for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; if (i < n) sum += d[i] * d[i]; }
  // 有效时长：能量衰减到峰值 -40dB 以下的最后一个采样
  let last = 0; for (let i = d.length - 1; i >= 0; i--) if (Math.abs(d[i]) > peak * 0.01) { last = i; break; }
  return { ms, audibleMs: Math.round((last / sr) * 1000), peak, rms: Math.sqrt(sum / n) };
}

// ---- 真实播放：限制同时发声数量，连点不会无限叠加 ----
const active = [];
export function playKey(id) {
  const c = feel.audioContext();
  const master = feel.masterNode();
  if (!c || !master || !DEFS[id]) return { ok: false, state: c ? c.state : "无" };
  try { if (c.state !== "running") c.resume().catch(() => {}); } catch { /* 忽略 */ }
  const now = c.currentTime;
  while (active.length && active[0].end < now) active.shift();
  while (active.length >= 3) { const old = active.shift(); try { old.gain.gain.setTargetAtTime(0, now, 0.004); } catch { /* 忽略 */ } }
  const voice = c.createGain();
  voice.connect(master);
  const ms = renderKey(c, voice, id, now + 0.005);
  active.push({ gain: voice, end: now + ms / 1000 + 0.05 });
  return { ok: true, state: c.state, ms };
}

// 给自动测试用：当前还在发声的数量
export const activeCount = () => { const now = feel.audioContext()?.currentTime ?? 0; return active.filter((a) => a.end >= now).length; };
