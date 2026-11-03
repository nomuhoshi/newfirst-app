// 碎片编程：关卡式学习（原创视觉“墨蓝实验手账”）。
// 首页是关卡地图；每关 = 故事开场 + 4 道点选题（选输出 / 点词块填空或修程序 / 排顺序）。
// 答错扣红心、错题放到最后再做；答对加 XP；每天完成一关续上连续天数。
// 点“检查”的时间线（ms）：0 提交并锁定 → 120 揭示结果 + 声音 → 240 红心/XP 更新 → 280（减少动态效果时 120）可以继续。
import "./style.css";
import "./app.css";
import "./game.css";
import course from "../content/course.json";
import unit1 from "../content/unit1.json";
import unit2 from "../content/unit2.json";
import words from "../content/words.json";
import { Runner, LIMITS } from "./runner.js";
import { describeError } from "./errors.js";
import * as feel from "./feel.js";
import { KEY_SOUNDS, DEFAULT_STYLE } from "./keysounds.js";
import {
  loadState, saveState, clearState, regenHearts, loseHeart, bumpStreak, currentStreak, HEARTS_MAX,
} from "./storage.js";
import { ROUND_SIZES, DEFAULT_ROUND, clearedScope, buildPool, drawRound, shuffleExercise } from "./practice.js";

const UNITS = { U1: unit1, U2: unit2 };
const XP_CORRECT = 10;
const XP_REVIEW = 5;
const XP_FINISH = 10;
const REVEAL_MS = 120;     // 点“检查”到出现结果
const STATS_MS = 240;      // 红心 / 统计更新
const CONTINUE_MS = 280;   // “继续”可用

// iPhone 的 Safari 底部有浮动工具栏，会盖住页面最下面一排；从主屏幕打开时没有这个问题
const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const standalone = navigator.standalone === true || matchMedia("(display-mode: standalone)").matches;
if (isIOS && !standalone) document.documentElement.classList.add("ios-browser");

// ---------- 小工具：创建元素（只用 textContent，绝不把内容当 HTML） ----------
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}
function button(label, fn, cls = "btn", attrs = {}) {
  const b = h("button", { type: "button", class: cls, ...attrs }, label);
  // 用真正的 click（不是 pointerdown）：iOS 只承认 click / touchend 是能解锁声音的用户操作
  b.addEventListener("click", (e) => { if (!b.disabled) fn(e); });
  return b;
}
const svgNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.forEach((k) => { if (k != null && k !== false) el.append(k); });
  return el;
}

// ---------- 自绘线条图标（24×24，描边 2，颜色跟随文字） ----------
const ICONS = {
  flame: "M12 3c.8 3.2 5 5.2 5 9.8a5 5 0 0 1-10 0c0-2 .9-3.3 2.2-4.4.4 1.6 1.2 2.3 2 2.6-.4-2.6-.2-5 .8-8z",
  bolt: "M13 2.5 5.5 13H11l-1 8.5L18.5 10H13z",
  heart: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z",
  home: "M4 11l8-7 8 7v9H4zM10 20v-6h4v6",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 21c0-4 3.5-6 7.5-6s7.5 2 7.5 6",
  check: "M5 12.5l4.5 4.5L19 7",
  lock: "M7 11h10a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM8.5 11V8a3.5 3.5 0 0 1 7 0v3",
  star: "M12 3l2.7 5.9 6.3.7-4.7 4.3 1.3 6.2L12 16.8l-5.6 3.3 1.3-6.2L3 9.6l6.3-.7z",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3M12 14v4M8 21h8",
  shield: "M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z",
  close: "M6 6l12 12M18 6L6 18",
  cross: "M7 7l10 10M17 7L7 17",
  play: "M8 5.5v13l11-6.5z",
  review: "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5",
};
function icon(name, { size = 22, fill = false, cls = "" } = {}) {
  return svg("svg", { viewBox: "0 0 24 24", width: size, height: size, class: "ico " + cls, "aria-hidden": "true",
    fill: fill ? "currentColor" : "none", stroke: "currentColor", "stroke-width": "2", "stroke-linecap": "round", "stroke-linejoin": "round" },
  svg("path", { d: ICONS[name] }));
}

// ---------- 流动电路背景：稀疏的线 + 少量缓慢移动的光点（8–12 秒一次） ----------
// 纯装饰：不拦截点击和滚动；减少动态效果时光点隐藏、线条静止；切到后台时暂停动画。
// 电路按“当前窗口的实际大小”生成（手机竖屏、iPad 小窗口、横屏都能看到），窗口变化时重新生成。
// 第一屏 7 条路径从左、右、上三个方向进入，其中 4 条带分支；全部在两侧和上下边缘，中间留空给文字和节点。
const BEND = 16; // 45° 拐角的大小
function circuitLayout(variant, W, H) {
  const r = Math.round;
  const lines = [];
  const add = (d, pulse, pads) => lines.push({ d, pulse, pads });
  if (variant === "edge") {
    const m = (x, y0, y1, y2) => `M${x} ${r(y0)}V${r(y1)}L${x + (x < W / 2 ? 6 : -6)} ${r(y1 + 6)}V${r(y2)}`;
    const a = m(6, 0, H * 0.26, H * 0.6); add(a, a, [[12, r(H * 0.6)]]);
    const b = m(W - 6, H * 0.12, H * 0.45, H * 0.83); add(b, b, [[W - 12, r(H * 0.83)]]);
    const c = `M6 ${r(H * 0.72)}V${r(H)}`; add(c, c, [[6, r(H)]]);
    const d = `M${W - 6} ${r(H * 0.9)}V${r(H)}`; add(d, d, [[W - 6, r(H)]]);
    return { lines, pulses: [[0, 11, 0], [1, 9, -5]] };
  }
  // 从左边进入：横走到 x1，45° 拐弯后竖走到 y2，可在 yb 处接一条横向分支（长 bl）
  const side = (right, y0, x1, y2, yb, bl) => {
    const sx = (x) => r(right ? W - x : x); const dir = y2 >= y0 ? 1 : -1;
    const xs = x1 + BEND;
    const main = `M${right ? r(W) : 0} ${r(y0)}H${sx(x1)}L${sx(xs)} ${r(y0 + BEND * dir)}V${r(y2)}`;
    const pads = [[sx(xs), r(y2)]];
    let d = main;
    if (yb != null) { d += `M${sx(xs)} ${r(yb)}H${sx(xs + bl)}`; pads.push([sx(xs + bl), r(yb)], [sx(xs), r(yb)]); }
    add(d, main, pads);
  };
  const top = (x0, y1, x2) => { const d = `M${r(x0)} 0V${r(y1)}L${r(x0 + BEND)} ${r(y1 + BEND)}H${r(x2)}`; add(d, d, [[r(x2), r(y1 + BEND)]]); };
  side(false, H * 0.12, W * 0.10, H * 0.31, H * 0.215, W * 0.10);
  top(W * 0.30, H * 0.12, W * 0.43);
  side(true, H * 0.17, W * 0.09, H * 0.39, H * 0.29, W * 0.08);
  side(false, H * 0.52, W * 0.08, H * 0.68, H * 0.60, W * 0.08);
  side(true, H * 0.64, W * 0.09, H * 0.84, H * 0.75, W * 0.08);
  side(false, H * 0.90, W * 0.16, H * 0.82, null, 0);
  top(W * 0.74, H * 0.10, W * 0.88);
  return { lines, pulses: [[0, 10, 0], [2, 12, -4], [3, 9, -2], [4, 11, -7]] };
}
function fillCircuit(el, variant) {
  const W = Math.max(240, Math.round(window.innerWidth)); const H = Math.max(240, Math.round(window.innerHeight));
  el.setAttribute("viewBox", `0 0 ${W} ${H}`);
  const c = circuitLayout(variant, W, H);
  el.replaceChildren(
    ...c.lines.map((l) => svg("path", { d: l.d, class: "trace" })),
    ...c.lines.flatMap((l) => l.pads.map(([x, y]) => svg("circle", { cx: String(x), cy: String(y), r: "3.5", class: "pad" }))),
    ...c.pulses.map(([i, dur, delay]) => svg("path", { d: c.lines[i].pulse, class: "pulse", pathLength: "100", style: `animation-duration:${dur}s;animation-delay:${delay}s` })),
  );
}
const liveCircuits = new Set();
function circuit(variant = "full") {
  const el = svg("svg", { class: "circuit-bg " + variant, preserveAspectRatio: "none", "aria-hidden": "true", focusable: "false" });
  fillCircuit(el, variant);
  liveCircuits.add([el, variant]);
  return el;
}
let circuitTimer;
window.addEventListener("resize", () => {
  clearTimeout(circuitTimer);
  circuitTimer = setTimeout(() => { for (const entry of [...liveCircuits]) { if (entry[0].isConnected) fillCircuit(entry[0], entry[1]); else liveCircuits.delete(entry); } }, 120);
});
document.addEventListener("visibilitychange", () => document.documentElement.classList.toggle("bg-paused", document.hidden));

// ---------- 六边形电路关卡节点 ----------
function hexNode(st, review) {
  const kind = st === "done" ? "check" : st === "current" ? (review ? "review" : "play") : review ? "review" : "lock";
  const inner = icon(kind, { size: 32, fill: kind === "play", cls: "hex-ico" });
  inner.setAttribute("x", "20"); inner.setAttribute("y", "20");
  const badge = st === "locked" && review ? icon("lock", { size: 16, cls: "hex-badge" }) : null;
  if (badge) { badge.setAttribute("x", "47"); badge.setAttribute("y", "46"); }
  const el = svg("svg", { viewBox: "0 0 72 72", width: "72", height: "72", class: "hexnode", "aria-hidden": "true", "data-icon": kind },
    st === "current" ? svg("polygon", { points: "36,1 67,19 67,53 36,71 5,53 5,19", class: "hex-ring" }) : null,
    svg("polygon", { points: "36,5 63,20.5 63,51.5 36,67 9,51.5 9,20.5", class: "hex-body" }),
    svg("circle", { cx: "36", cy: "5", r: "2.8", class: "hex-pad" }), svg("circle", { cx: "36", cy: "67", r: "2.8", class: "hex-pad" }),
    inner, badge,
  );
  return el;
}

// ---------- 吉祥物“小码”：折角记录卡（暖白主体、墨蓝括号眼睛、铜橙折角、短脚） ----------
function mascot(size = 96, mood = "happy") {
  if (mood === "sad") mood = "companion";
  const eye = (d) => svg("path", { d, class: "m-ink" });
  const eyes = {
    happy: [eye("M36 44Q31 51 36 58"), eye("M64 44Q69 51 64 58")],
    think: [eye("M37 40Q32 47 37 54"), eye("M66 40Q71 47 66 54")],
    companion: [eye("M31 50Q36 56 41 50"), eye("M59 50Q64 56 69 50")],
    celebrate: [eye("M31 54Q36 46 41 54"), eye("M59 54Q64 46 69 54")],
  }[mood];
  const mouth = {
    happy: svg("path", { d: "M42 68Q50 75 58 68", class: "m-ink" }),
    think: svg("path", { d: "M45 69H57", class: "m-ink" }),
    companion: svg("path", { d: "M44 68Q50 72 56 68", class: "m-ink" }),
    celebrate: svg("path", { d: "M42 66Q50 80 58 66z", class: "m-ink m-solid" }),
  }[mood];
  return svg("svg", { viewBox: "0 0 100 100", width: size, height: size, class: "mascot", "aria-hidden": "true" },
    svg("rect", { x: "26", y: "86", width: "14", height: "9", rx: "3", class: "m-solid m-ink" }),
    svg("rect", { x: "60", y: "86", width: "14", height: "9", rx: "3", class: "m-solid m-ink" }),
    svg("path", { d: "M22 12H66L90 36V80Q90 90 80 90H22Q12 90 12 80V22Q12 12 22 12Z", class: "m-body" }),
    svg("path", { d: "M66 12L90 36H76Q66 36 66 26Z", class: "m-fold" }),
    ...eyes, mouth,
    mood === "celebrate" ? svg("path", { d: "M14 6v8M10 10h8", class: "m-spark" }) : null,
  );
}

// 简单的代码着色（只用于显示）
function codeLine(text) {
  const frag = [];
  const re = /("[^"]*"?)|(\b\d+(?:\.\d+)?\b)|(\bprint\b)|([=+\-*/()])/g;
  let last = 0; let m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.push(document.createTextNode(text.slice(last, m.index)));
    const cls = m[1] ? "tk-str" : m[2] ? "tk-num" : m[3] ? "tk-fn" : "tk-op";
    frag.push(h("span", { class: cls, text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.push(document.createTextNode(text.slice(last)));
  return frag;
}
function codeBlock(code, cls = "") {
  return h("div", { class: "codeblock " + cls }, code.split("\n").map((line, i) =>
    h("div", { class: "cl" }, h("span", { class: "ln", text: String(i + 1) }), h("span", { class: "lc" }, codeLine(line)))));
}

// ---------- 状态与保存 ----------
const loaded = loadState();
let state = loaded.state;
let notice = loaded.notice;
feel.setPrefs(state.prefs);
if (notice) saveState(state); // 迁移或修复后的记录立即存一次，下次不再重复提示
function persist() {
  if (!saveState(state)) showToast("无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。");
}
const allLessons = () => course.units.filter((u) => u.available).flatMap((u) => UNITS[u.id].lessons.map((l) => ({ ...l, unit: u.id })));
const firstUndone = () => allLessons().find((l) => !state.done[l.id]);
function lessonStatus(l) {
  if (state.done[l.id]) return "done";
  return firstUndone()?.id === l.id ? "current" : "locked";
}
let currentRun = null;
const swInfo = { status: "未启用", caches: [] }; // 给“我的”页诊断和测试看

// ---------- Python 运行（显示“运行结果”用） ----------
const appEl = document.getElementById("app");
const listeners = new Set();
let lastLoadError = null; // 最近一次 Python 加载失败的信息（用来在“运行结果”面板里说清楚原因，不一律说成网络问题）
const runner = new Runner({
  onStatus(s, info) { if (s === "loadError") lastLoadError = info || {}; for (const l of [...listeners]) l.status?.(s, info); },
  onOutput(t) { for (const l of [...listeners]) l.output?.(t); },
});
function runForOutput(code) {
  return new Promise((resolve) => {
    let waiter = null, timer = null;
    const finish = (v) => { clearTimeout(timer); if (waiter) listeners.delete(waiter); resolve(v); };
    const go = () => {
      let out = "";
      const l = {
        output: (t) => { out += t; },
        status: (s, info) => {
          if (!["done", "timeout", "stopped", "outputLimit", "outputLimitStopped"].includes(s)) return;
          listeners.delete(l);
          resolve(s === "done" ? { out, error: info.error } : { out, error: { kind: "Stopped", line: null, msg: "运行被停止" } });
        },
      };
      listeners.add(l);
      if (!runner.run(code)) { listeners.delete(l); resolve(null); }
    };
    if (runner.state === "ready") return go();
    // 先挂好监听，再重新启动：启动可能同步失败（比如不能创建 Worker），那时监听必须已经在了
    waiter = { status: (s) => {
      if (s === "ready") { listeners.delete(waiter); clearTimeout(timer); go(); }
      else if (s === "loadError") finish(null);
    } };
    listeners.add(waiter);
    // 兜底：无论什么原因一直等不到，到时间就结束“运行中…”，显示失败提示和“重试”
    timer = setTimeout(() => finish(null), LIMITS.loadMs + 2000);
    if (runner.state === "loadError") runner.boot();
  });
}

// Python 运行不了时，如实说明原因：离线 / 已确认浏览器缺少必需功能 / 不能创建 Python 线程 / 其他（原因未确认，附诊断信息）。
function pythonUnavailableText() {
  const tail = "选择、填空、排序的判分不受影响。";
  if (navigator.onLine === false) return "你现在离线。Python运行功能需要联网后加载，联网后点“重试”。" + tail;
  const missing = [];
  if (typeof WebAssembly === "undefined") missing.push("WebAssembly");
  if (typeof Worker === "undefined") missing.push("后台线程（Worker）");
  if (missing.length) return `这个浏览器不支持运行 Python 需要的功能（缺少：${missing.join("、")}）。可以升级系统或浏览器，或换成 Safari / Chrome 打开。` + tail;
  if (lastLoadError?.kind === "noWorker") return "这个环境不允许启动 Python 运行线程（可能是浏览器版本较旧，或应用内置浏览器的限制）。可以点右上角“···”选“在浏览器打开”，或换成 Safari / Chrome。" + tail;
  const osm = navigator.userAgent.match(/OS (\d+)[_.](\d+)/);
  const os = osm ? osm[1] + "_" + osm[2] : "";
  // Pyodide 官方文档（Supported browsers）写明 Safari 16.4 起；iPhone 的浏览器内核跟 iOS 版本走，所以低于 iOS 16.4 的 iPhone 确定跑不了 Python
  if (osm && /iPhone|iPod/.test(navigator.userAgent) && (+osm[1] < 16 || (+osm[1] === 16 && +osm[2] < 4))) return `这台设备的系统是 iOS ${osm[1]}.${osm[2]}，低于运行 Python 所需的 iOS 16.4（Pyodide 官方要求），所以看不到“运行结果”。升级系统后即可显示。` + tail;
  const diag = `诊断：${String(lastLoadError?.msg || "无错误信息").slice(0, 120)}；在线：${navigator.onLine ? "是" : "否"}${os ? "；iOS " + os.replace("_", ".") : ""}${/MicroMessenger|QQ\//i.test(navigator.userAgent) ? "；微信/QQ 内" : ""}`;
  return "Python 运行环境没有加载成功，原因未确认（可能是网络、浏览器版本，或应用内置浏览器的限制）。Python运行功能需要联网后加载，联网后点“重试”；仍然不行，请把下面的诊断信息发给开发者。" + tail + "\n" + diag;
}

// 在“运行结果”面板里显示真实运行结果。Python 加载不了（比如离线）时如实说明并给“重试”，不显示任何预设输出。
function showRun(panel, code) {
  const pre = panel.querySelector("pre");
  panel.querySelector(".py-retry")?.remove();
  pre.className = "out";
  pre.textContent = "运行中…";
  panel.open = true;
  runForOutput(code).then((r) => {
    if (!pre.isConnected) return;
    if (!r) {
      pre.textContent = pythonUnavailableText();
      pre.className = "out offline";
      panel.append(button("重试", () => showRun(panel, code), "btn small py-retry", { "data-retry-python": "" }));
      return;
    }
    pre.textContent = r.error ? (r.out ? r.out + "\n" : "") + describeError(r.error) : (r.out || "程序运行完成，没有输出");
    pre.className = "out" + (r.error ? " error" : "");
  });
}

// ---------- 通用浮层 / 提示 ----------
// 弹窗里真正能接收键盘焦点的元素：跳过禁用、tabindex=-1、hidden 属性、display:none / visibility:hidden、零尺寸
const FOCUSABLE = "button, a[href], input, select, textarea, [tabindex]";
function focusables(root) {
  return [...root.querySelectorAll(FOCUSABLE)].filter((el) => {
    if (el.disabled || el.getAttribute("tabindex") === "-1" || el.closest("[hidden]")) return false;
    if (el.tagName === "INPUT" && el.type === "hidden") return false;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0; // 祖先 display:none 时也是 0 尺寸
  });
}
function sheet(content, { onClose, cls = "" } = {}) {
  const opener = document.activeElement;
  const close = () => {
    if (!wrap.isConnected) return;
    const hadFocus = wrap.contains(document.activeElement);
    wrap.remove(); onClose?.();
    // 打开它的按钮还在就还给它；已被移除（例如重新渲染）时退回到页面主体，不抛错
    if (opener && opener !== document.body && opener.isConnected && opener.focus) opener.focus({ preventScroll: true });
    else if (hadFocus && document.activeElement && document.activeElement !== document.body) document.activeElement.blur?.();
  };
  const openedAt = Date.now();
  const wrap = h("div", { class: "overlay " + cls, role: "dialog", "aria-modal": "true", tabindex: "-1" }, h("div", { class: "sheet" }, content(close)));
  wrap.addEventListener("click", (e) => { if (e.target === wrap && Date.now() - openedAt > 800) close(); });
  // 键盘：Esc 关闭；Tab 在弹窗内循环；打开时焦点移入弹窗（iPad 外接键盘 / 读屏）
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); close(); return; }
    if (e.key !== "Tab") return;
    const f = focusables(wrap);
    if (!f.length) { e.preventDefault(); wrap.focus({ preventScroll: true }); return; } // 没有可聚焦的控件：焦点留在弹窗本身
    // 每次都由这里决定下一个焦点，浏览器自己的 Tab 顺序可能落到零尺寸等“看不见”的按钮上
    e.preventDefault();
    const i = f.indexOf(document.activeElement);
    const next = e.shiftKey ? (i <= 0 ? f[f.length - 1] : f[i - 1]) : (i < 0 || i === f.length - 1 ? f[0] : f[i + 1]);
    next.focus();
  });
  const title = wrap.querySelector("h2, h1");
  if (title) { if (!title.id) title.id = "sheet-title-" + openedAt; wrap.setAttribute("aria-labelledby", title.id); }
  document.body.append(wrap);
  const firstBtn = focusables(wrap)[0];
  (firstBtn || wrap).focus({ preventScroll: true });
  return close;
}
let toastTimer;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = h("div", { class: "toast", role: "alert" }); document.body.append(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 6000);
}
const fmtWait = (ms) => { const m = Math.ceil(ms / 60000); return m >= 60 ? `${Math.floor(m / 60)} 小时 ${m % 60} 分钟` : `${m} 分钟`; };

// ---------- 开场介绍 ----------
function renderOnboarding(i = 0) {
  const steps = [
    { text: "你好，我是小码！", sub: "", mood: "happy" },
    { text: "我会陪你一关一关学 Python。", sub: "每关只要两三分钟，全部用点的，不用打字。", mood: "companion" },
    { text: "卡住了就点我，我会给你提示。", sub: "做题时我在左下角。", mood: "think" },
  ];
  const s = steps[i];
  appEl.replaceChildren(h("main", { class: "onboard" },
    h("div", { class: "onboard-mid" }, mascot(120, s.mood), h("h1", { text: s.text }), s.sub ? h("p", { text: s.sub }) : null),
    h("div", { class: "onboard-dots" }, steps.map((_, k) => h("span", { class: k === i ? "on" : "" }))),
    button(i < steps.length - 1 ? "继续" : "开始学习", () => {
      if (i < steps.length - 1) renderOnboarding(i + 1);
      else { state.onboarded = true; persist(); renderPath(); }
    }, "btn3d primary wide"),
  ));
}

// ---------- 顶部状态栏 ----------
function heartStat(extraCls = "") {
  return h("span", { class: "stat hearts " + extraCls, title: "红心", "aria-label": `红心 ${state.hearts}` },
    icon("heart", { size: 20, fill: state.hearts > 0 }), String(state.hearts));
}
function statsBar() {
  const wait = regenHearts(state);
  const hearts = heartStat();
  hearts.title = wait ? `下一颗红心：${fmtWait(wait)}后` : "红心已满";
  return h("header", { class: "statsbar" },
    h("span", { class: "stat streak", "aria-label": `连续 ${currentStreak(state)} 天` }, icon("flame", { size: 20 }), String(currentStreak(state))),
    h("span", { class: "stat xp", "aria-label": `经验值 ${state.xp}` }, icon("bolt", { size: 20 }), String(state.xp)),
    hearts,
  );
}
function tabBar(active) {
  return h("nav", { class: "tabbar" },
    button(h("span", {}, icon("home", { size: 24 }), h("small", { text: "学习" })), renderPath, "tab" + (active === "path" ? " on" : ""), { "aria-label": "学习" }),
    button(h("span", {}, icon("user", { size: 24 }), h("small", { text: "我的" })), renderMe, "tab" + (active === "me" ? " on" : ""), { "aria-label": "我的" }),
  );
}

// ---------- 关卡地图 ----------
function renderPath() {
  regenHearts(state);
  currentRun = null;
  const units = course.units.map((u) => {
    if (!u.available) {
      return h("section", { class: "unit locked" }, h("div", { class: "unit-banner" },
        h("div", { class: "unit-no", text: `第 ${course.units.indexOf(u) + 1} 单元 · 即将推出` }), h("h2", { text: u.title }), h("p", { text: u.subtitle })));
    }
    const lessons = UNITS[u.id].lessons;
    const unitDone = lessons.every((x) => state.done[x.id]);
    return h("section", { class: "unit" + (unitDone ? " complete" : "") },
      h("div", { class: "unit-banner" }, h("div", { class: "unit-no", text: `第 ${course.units.indexOf(u) + 1} 单元${unitDone ? " · 已完成" : ""}` }), h("h2", { text: u.title }), h("p", { text: u.subtitle })),
      h("ol", { class: "path" }, lessons.map((l, i) => {
        const st = lessonStatus(l);
        const offset = [0, 1, 2, 1, 0, -1][i % 6];
        const node = button(
          h("span", { class: "node-face", "aria-hidden": "true" }, hexNode(st, !!l.review)),
          () => openLessonSheet(l), `node ${st}${l.review ? " review" : ""}`,
          { "aria-label": `${l.title}（${st === "done" ? "已完成" : st === "current" ? "当前关卡" : "未解锁"}）`, "data-lesson": l.id },
        );
        return h("li", { class: "path-item", style: `--off:${offset}` },
          st === "current" ? h("div", { class: "bubble", text: i === 0 && !state.done[l.id] && state.xp === 0 ? "从这里开始" : "开始" }) : null,
          node, h("div", { class: "node-label", text: l.title }));
      })),
    );
  });
  appEl.replaceChildren(
    circuit("full"),
    statsBar(),
    h("main", { class: "view pathview" }, notice ? h("p", { class: "notice", role: "status", text: notice }) : null, practiceEntry(), units),
    tabBar("path"),
  );
  notice = null;
  scrollToCurrent();
}

// 当前关卡（含上方“开始”气泡和下方关名）滚到可见：可见区域要扣掉吸顶的“随机练习”入口，不能被它挡住
function scrollToCurrent() {
  const view = appEl.querySelector(".pathview"), node = view?.querySelector(".node.current");
  if (!node) return;
  const parts = [node, node.parentElement?.querySelector(".bubble"), node.parentElement?.querySelector(".node-label")].filter(Boolean);
  const vr = view.getBoundingClientRect();
  const entry = view.querySelector(".practice-entry-wrap");
  const top0 = entry ? Math.max(vr.top, entry.getBoundingClientRect().bottom) : vr.top; // 入口下沿以下才算可见
  const gTop = Math.min(...parts.map((e) => e.getBoundingClientRect().top)), gBot = Math.max(...parts.map((e) => e.getBoundingClientRect().bottom));
  const room = vr.bottom - top0, gh = gBot - gTop;
  const want = gh >= room ? top0 + 4 : top0 + (room - gh) / 2; // 放不下就贴着入口下沿
  view.scrollTop += gTop - want;
}

function openLessonSheet(l) {
  const st = lessonStatus(l);
  sheet((close) => [
    h("div", { class: "lsheet" },
      h("div", { class: "lsheet-concept", text: l.concept }),
      h("h2", { text: l.title }),
      h("p", { text: st === "locked" ? "先完成前面的关卡，这一关才会解锁。" : l.story }),
      st === "locked" ? button("知道了", close, "btn3d wide")
        : st === "done" ? [button("复习（不扣红心，完成后 +1 红心）", () => { close(); startLesson(l, { review: true }); }, "btn3d primary wide"), button("关闭", close, "btn3d ghost wide")]
        : [button(`开始 +${l.exercises.length * XP_CORRECT + XP_FINISH} XP`, () => { close(); startLesson(l); }, "btn3d primary wide"), button("关闭", close, "btn3d ghost wide")],
    ),
  ]);
}

// 红心用完：不能开始新关卡，可以复习恢复
function openNoHearts(forLesson) {
  const wait = regenHearts(state);
  const doneList = allLessons().filter((x) => state.done[x.id]);
  const practice = doneList[doneList.length - 1] || forLesson;
  sheet((close) => [
    h("div", { class: "lsheet" },
      mascot(72, "companion"),
      h("h2", { text: "红心用完了" }),
      h("p", { text: `每 30 分钟恢复 1 颗，下一颗还要 ${fmtWait(wait)}。也可以做一关复习：复习不扣红心，完成后恢复 1 颗。` }),
      button(`复习「${practice.title}」`, () => { close(); startLesson(practice, { review: true }); }, "btn3d primary wide"),
      button("稍后再来", close, "btn3d ghost wide"),
    ),
  ]);
}

// ---------- 我的 ----------
function toggleRow(label, sub, key, { disabled = false } = {}) {
  const on = !!state.prefs[key] && !disabled;
  const sw = h("button", { type: "button", class: "switch" + (on ? " on" : ""), role: "switch", "aria-checked": String(on), "aria-label": label, "data-pref": key, disabled: disabled || null },
    h("span", { class: "knob" }));
  sw.addEventListener("click", () => {
    if (sw.disabled) return;
    state.prefs[key] = !state.prefs[key];
    feel.setPrefs(state.prefs);
    persist();
    sw.classList.toggle("on", state.prefs[key]);
    sw.setAttribute("aria-checked", String(state.prefs[key]));
    if (key === "sound" && state.prefs.sound) feel.play("select");
    if (key === "haptics" && state.prefs.haptics) feel.haptic();
  });
  return h("div", { class: "toggle-row" }, h("div", {}, h("b", { text: label }), h("small", { text: sub })), sw);
}

// 声音与振动自测：真机上点试听，并显示诊断信息，方便确认声音和振动到底有没有
function selfTest() {
  const diag = h("pre", { class: "diag", "aria-label": "诊断信息" });
  const showDiag = (extra = "") => {
    const d = feel.diagnostics();
    diag.textContent = [
      `应用版本：${typeof __BUILD__ !== "undefined" ? __BUILD__.slice(0, 16).replace("T", " ") + " UTC" : "开发版"}`,
      `缓存版本：${swInfo.caches.length ? swInfo.caches.join("、").replace(/suipian-/g, "").slice(0, 40) : "无"}`,
      `离线支持：${swInfo.status}`,
      `网络：${navigator.onLine === false ? "离线" : "在线"}`,
      `运行方式：${standalone ? "主屏幕 App" : "浏览器"}`,
      `音效开关：${d.soundPref ? "开" : "关"}`,
      `AudioContext：${d.audioState}${d.sampleRate ? `（${d.sampleRate} Hz）` : ""}`,
      `音频会话：${d.audioSession}`,
      `已播放 ${d.played} 次，被丢弃 ${d.dropped} 次，解锁尝试 ${d.unlocks} 次`,
      `状态变化：${d.history || "无"}`,
      `网页振动接口：${d.vibrate ? "有" : "没有"}`,
      `最近错误：${d.lastError || "无"}`,
      extra,
    ].filter(Boolean).join("\n");
  };
  showDiag();
  refreshSwInfo().then(() => { if (diag.isConnected) showDiag(); });
  return h("div", { class: "selftest" },
    h("div", { class: "selftest-btns" },
      button("试听音效", () => { feel.preview().then((ok) => showDiag(ok ? "试听：已播放答对音（听不到就看上面的状态）" : "试听：没有播放成功")); showDiag("试听：请求中…"); }, "btn3d wide", { "data-selftest": "sound" }),
      feel.hapticsSupported() ? button("试振动", () => {
        let r = "没有网页振动接口，这个按钮不会振动";
        if (feel.hapticsSupported()) { try { r = navigator.vibrate(12) ? "已请求 12ms 振动" : "振动请求被浏览器拒绝"; } catch { r = "振动请求出错"; } }
        showDiag("试振动：" + r);
      }, "btn3d wide", { "data-selftest": "haptic" }) : null,
    ),
    h("div", { class: "soundrow", role: "group", "aria-label": "正式音效试听" },
      ...[["select", "点选"], ["place", "放入"], ["undo", "撤销"], ["correct", "答对"], ["wrong", "答错"], ["finish", "过关"]].map(([k, label]) =>
        button(label, () => { feel.play(k, { force: true }).then((ok) => showDiag(`正式音效「${label}」：${ok ? "已播放" : "没有播放成功"}`)); }, "chip", { "data-sound": k }))),
    diag,
  );
}

// 音频兼容性测试（排查 iPhone 无声）：A / C 是 Web Audio，B 是本地 WAV 文件走 <audio>。
// 三个测试都在点击事件里同步发声：不经过延迟、Promise 链、onActivate 或自动播放；
// 结果显示只是“事后报告”，不参与发声。
function audioLab() {
  const lines = [];
  const out = h("pre", { class: "diag", "aria-label": "音频测试结果" });
  const session = () => { try { return navigator.audioSession ? navigator.audioSession.type : "（浏览器没有 audioSession）"; } catch { return "（读取失败）"; } };
  const ua = (navigator.userAgent.match(/(Version|CriOS|Chrome|OS) ?\/?[\d._]+/g) || []).slice(0, 2).join(" ");
  const render = () => { out.textContent = [`运行方式：${standalone ? "主屏幕 App" : "Safari / 浏览器"}`, `系统：${ua || "未知"}`, `音频会话：${session()}`, "—", ...lines].join("\n"); };
  const say = (msg) => { lines.push(msg); if (lines.length > 14) lines.shift(); render(); };
  const url = new URL("sfx/test-beep.wav", document.baseURI).href;
  const audio = new Audio();
  audio.preload = "auto";
  audio.addEventListener("canplaythrough", () => say(`[文件] 加载成功（${Number.isFinite(audio.duration) ? audio.duration.toFixed(2) : "?"} 秒）`));
  audio.addEventListener("error", () => say(`[文件] 加载失败（code ${audio.error?.code}：${audio.error?.message || "无信息"}）`));
  audio.src = url;
  try { audio.load(); } catch (err) { say(`[文件] load() 出错：${err.message}`); }
  fetch(url).then((r) => r.arrayBuffer().then((b) => say(`[文件] 网络读取 ${r.status}，${b.byteLength} 字节`))).catch((err) => say(`[文件] 网络读取失败：${err.message}`));
  render();

  // Web Audio：在点击里新建 AudioContext，立刻 resume() 并 start()，不等待任何 Promise
  const webAudio = (type, tag) => () => {
    try {
      let setNote = "";
      try { if (navigator.audioSession) { navigator.audioSession.type = type; setNote = `，audioSession 设为 ${type}`; } } catch (err) { setNote = `，audioSession 设置失败：${err.message}`; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { say(`[${tag}] 浏览器没有 AudioContext`); return; }
      const c = new AC();
      const s0 = c.state;
      c.resume(); // 同步发起，不等结果
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.6, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.3);
      o.connect(g); g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.35);
      say(`[${tag}] 点击内已发出声音指令；创建时 state=${s0}${setNote}`);
      setTimeout(() => say(`[${tag}] 0.4 秒后 state=${c.state}，currentTime=${c.currentTime.toFixed(3)}（大于 0 说明音频时钟在走）`), 400);
    } catch (err) { say(`[${tag}] 出错：${err.name}：${err.message}`); }
  };
  // 本地文件：在点击里直接 audio.play()，then/catch 只用来显示结果
  const fileTest = () => {
    try {
      say(`[B] 点击：readyState=${audio.readyState}，networkState=${audio.networkState}，error=${audio.error ? audio.error.code : "无"}`);
      audio.pause();
      audio.currentTime = 0;
      const p = audio.play();
      if (p && p.then) p.then(() => say("[B] audio.play() 成功")).catch((err) => say(`[B] audio.play() 失败：${err.name}：${err.message}`));
      else say("[B] audio.play() 已调用（浏览器没有返回 Promise）");
    } catch (err) { say(`[B] play() 抛出：${err.name}：${err.message}`); }
  };
  return h("div", { class: "selftest audiolab" },
    h("h3", { text: "音频兼容性测试" }),
    h("p", { class: "muted small", text: "排查 iPhone 无声：每个按钮都在点击里直接发声。请先关掉静音键，把音量调到一半，三个都点一遍，告诉我哪个能响，并截图下面的结果。" }),
    h("button", { type: "button", class: "btn3d wide", "data-audiotest": "webaudio", onclick: webAudio("ambient", "A") }, "测试 A：Web Audio 提示音"),
    h("button", { type: "button", class: "btn3d wide", "data-audiotest": "file", onclick: fileTest }, "测试 B：本地 WAV 文件（<audio>）"),
    h("button", { type: "button", class: "btn3d wide", "data-audiotest": "playback", onclick: webAudio("playback", "C") }, "测试 C：Web Audio + 播放模式"),
    out,
  );
}

// 振动测试（等待 iPhone 真机确认）：四种互相独立的控件。结果只记录“点了”，不会宣布“振动成功”。
// iPhone 的 Safari 没有 navigator.vibrate；已知唯一可能的触感是系统自带的 <input type="checkbox" switch>
// 在用户亲手点它时给的反馈，所以这里放了几种真实控件，让你逐个确认手上有没有感觉。
function hapticLab() {
  const log = h("pre", { class: "diag", "aria-label": "振动测试结果" }, "每个都点几下，凭手感告诉我哪几个有轻微触感。");
  const counts = {};
  const mark = (name) => () => {
    counts[name] = (counts[name] || 0) + 1;
    let api = "";
    if (feel.hapticsSupported()) { try { api = navigator.vibrate(12) ? "；已请求 navigator.vibrate(12)" : "；vibrate 被拒绝"; } catch { api = "；vibrate 出错"; } } else api = "；没有 navigator.vibrate";
    log.textContent = Object.entries(counts).map(([k, n]) => `${k}：点了 ${n} 次`).join("\n") + api + "\n（是否真的有触感：等待 iPhone 真机确认）";
  };
  const sw = h("input", { type: "checkbox", switch: true, "data-haptic": "switch", "aria-label": "原生开关" });
  sw.addEventListener("change", mark("2 原生开关"));
  const hidden = h("input", { type: "checkbox", switch: true, class: "hap-hidden", "data-haptic": "check-label", "aria-label": "检查按钮样式" });
  hidden.addEventListener("change", mark("4 检查按钮样式"));
  return h("div", { class: "selftest hapticlab" },
    h("h3", { text: "振动测试" }),
    h("p", { class: "muted small", text: "四种控件各点几下，告诉我哪几个手上有轻微触感（iPhone 的 Safari 没有振动接口，这是在找系统自带的反馈）。" }),
    h("button", { type: "button", class: "btn3d wide", "data-haptic": "button", onclick: mark("1 普通按钮") }, "1 普通按钮"),
    h("label", { class: "hap-row" }, h("span", { text: "2 原生开关（直接点右边的开关）" }), sw),
    h("button", { type: "button", class: "choice hap-choice", "data-haptic": "choice", onclick: mark("3 选项样式") }, "3 选项样式的按钮"),
    h("label", { class: "btn3d primary hap-check", "data-haptic": "check-box" }, "4 检查按钮样式（外观是按钮，里面是隐藏的开关）", hidden),
    log,
  );
}

// 按键音效设置：A–J 十个“矮轴机械键盘”风格。J（极简 Tap）是默认，点其他字母试听并换成它。
// 选中的风格用在答题里的全部声音：点选、放入、撤销、答对、答错、过关。
function keyLab() {
  const status = h("p", { class: "muted small keylab-status", role: "status" });
  const cur = () => KEY_SOUNDS.some((k) => k.id === state.prefs.soundStyle) ? state.prefs.soundStyle : DEFAULT_STYLE;
  const showSel = () => { const k = KEY_SOUNDS.find((x) => x.id === cur()); status.textContent = `当前按键音效：${k.id} ${k.name}${k.id === DEFAULT_STYLE ? "（默认）" : ""}`; };
  const btns = KEY_SOUNDS.map((k) => {
    const on0 = cur() === k.id;
    const b = h("button", { type: "button", class: "keybtn" + (on0 ? " sel" : ""), "data-keysound": k.id, "aria-pressed": String(on0) },
      h("b", { text: k.id }), h("span", { text: k.name + (k.id === DEFAULT_STYLE ? "（默认）" : "") }), h("small", { text: k.desc }));
    b.addEventListener("click", () => {
      state.prefs.soundStyle = k.id; feel.setPrefs(state.prefs); persist();
      const r = feel.playStyle(k.id, "select"); // 声音关闭时也让你听一下，方便挑选
      btns.forEach((x) => { const on = x === b; x.classList.toggle("sel", on); x.setAttribute("aria-pressed", String(on)); });
      showSel();
      if (!r.ok) status.textContent += "（这次没有发出声音：" + (r.state || "音频环境不可用") + "）";
      else if (!state.prefs.sound) status.textContent += "（上面的“音效”开关是关的，答题时不会响）";
    });
    return b;
  });
  showSel();
  return h("div", { class: "keylab" },
    h("h3", { text: "按键音效" }),
    h("p", { class: "muted small", text: "十个原创的矮轴键盘风格，默认 J。点一下试听并选用，答题时的点选、放入、撤销、答对、答错、过关都用同一个风格。" }),
    h("div", { class: "keygrid" }, btns),
    status,
  );
}

function renderMe() {
  currentRun = null;
  let confirmBox = null;
  const clearBtn = button("清除学习记录", () => {
    if (confirmBox) return;
    confirmBox = h("div", { class: "confirm", role: "alertdialog" },
      h("p", { text: "确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。" }),
      button("确定清除", () => { const prefs = state.prefs; state = clearState(); state.prefs = prefs; state.onboarded = true; persist(); renderMe(); showToast("学习记录已清除。"); }, "btn danger"),
      button("取消", () => { confirmBox.remove(); confirmBox = null; }, "btn"),
    );
    clearBtn.after(confirmBox);
  }, "link small");
  const wait = regenHearts(state);
  const doneCount = allLessons().filter((l) => state.done[l.id]).length;
  const statCard = (ic, value, label) => h("div", { class: "me-card" }, h("b", {}, ic ? icon(ic, { size: 20 }) : null, value), h("span", { text: label }));
  appEl.replaceChildren(
    statsBar(),
    h("main", { class: "view me" },
      h("div", { class: "me-head" }, mascot(64), h("div", {}, h("h1", { text: "我的学习" }), h("p", { class: "muted", text: "记录只保存在这台设备上" }))),
      h("div", { class: "me-grid" },
        statCard("flame", String(currentStreak(state)), "连续天数"),
        statCard("bolt", String(state.xp), "经验值 XP"),
        statCard(null, `${doneCount}/${allLessons().length}`, "已完成关卡"),
        statCard("heart", `${state.hearts}/${HEARTS_MAX}`, wait ? `${fmtWait(wait)}后 +1` : "红心已满"),
      ),
      h("h3", { text: "声音与振动" }),
      toggleRow("音效", "点选、答对、答错、过关的短提示音；跟随手机静音键", "sound"),
      feel.hapticsSupported()
        ? toggleRow("振动", "点“检查”和结算页“继续”时请求一次短振；有没有振动取决于你的手机和浏览器，下面可以自测", "haptics")
        : h("div", { class: "toggle-row no-haptics", "data-no-haptics": "" }, h("div", {}, h("b", { text: "振动" }), h("small", { text: "此设备暂不支持网页触感反馈。" }))),
      keyLab(),
      selfTest(),
      audioLab(),
      feel.hapticsSupported() || /[?&]haptic-lab\b/.test(location.search) ? hapticLab() : null, // 没有振动接口的设备不显示无效的振动测试（开发者可加 ?haptic-lab 打开）
      h("h3", { text: "规则" }),
      h("ul", { class: "rules" },
        h("li", { text: `答对一题 +${XP_CORRECT} XP，完成一关再 +${XP_FINISH} XP；复习每题 +${XP_REVIEW} XP。` }),
        h("li", { text: "答错扣 1 颗红心，这道题会放到本关最后再做一次。" }),
        h("li", { text: "红心每 30 分钟恢复 1 颗；复习关不扣红心，完成后恢复 1 颗。" }),
        h("li", { text: "每天完成至少一关，连续天数 +1；断一天就从头算。" }),
      ),
      h("h3", { text: "添加到主屏幕" }),
      h("p", { text: "iPhone：用 Safari 打开 → 分享按钮 → 「添加到主屏幕」。从主屏幕打开是全屏的，记录也和 Safari 分开保存。" }),
      clearBtn,
    ),
    tabBar("me"),
  );
}

// ---------- 做题 ----------
function startLesson(l, { review = false } = {}) {
  regenHearts(state);
  if (!review && state.hearts <= 0) return openNoHearts(l);
  const run = {
    lesson: l, review,
    queue: l.exercises.map((_, i) => i),
    total: l.exercises.length,
    correct: 0,
    xp: 0,
    wrongOnce: new Set(),
    mistakes: 0,
  };
  currentRun = run;
  renderIntro(run);
}

function lessonHeader(run) {
  const pct = Math.round((run.correct / run.total) * 100);
  return h("header", { class: "lessonbar" },
    button(icon("close", { size: 24 }), () => confirmExit(run), "icon-btn ghost", { "aria-label": "退出本关" }),
    h("div", { class: "progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "progress-fill", style: `width:${Math.max(4, pct)}%` })),
    run.review ? h("span", { class: "stat shield", title: "复习不扣红心" }, icon("shield", { size: 22 })) : heartStat(),
  );
}

function confirmExit(run) {
  sheet((close) => [h("div", { class: "lsheet" },
    h("h2", { text: "要退出这一关吗？" }),
    h("p", { text: "退出后，本关答题位置不会保存，下次从第 1 题重新开始。已得的 XP 和已扣的红心会保留。" }),
    button("继续学习", close, "btn3d primary wide"),
    button("退出", () => { close(); renderPath(); }, "btn3d danger-ghost wide"),
  )]);
}

function renderIntro(run) {
  const l = run.lesson;
  appEl.replaceChildren(
    circuit("full"),
    lessonHeader(run),
    h("main", { class: "lesson" },
      h("div", { class: "intro-screen" }, codeBlock(l.introCode, "phone")),
      h("div", { class: "intro-panel" },
        h("div", { class: "intro-concept", text: (run.review ? "复习 · " : "") + l.concept }),
        h("h1", { class: "intro-title", text: l.title }),
        h("p", { class: "intro-story", text: l.story }),
      ),
    ),
    h("footer", { class: "lessonfoot" }, h("span", { class: "mascot-slot" }, mascot(56)), button("继续", () => renderExercise(run), "btn3d primary grow")),
  );
}

function renderExercise(run) {
  if (run.queue.length === 0) return renderFinish(run);
  const idx = run.queue[0];
  const ex = run.lesson.exercises[idx];
  window.__app.currentEx = ex; // 给自动测试用
  window.__app.renders = (window.__app.renders || 0) + 1;
  let hintShown = false;
  let submitted = false; // 一道题只能提交一次

  const outPanel = h("details", { class: "outpanel" }, h("summary", { text: "运行结果" }), h("pre", { class: "out", text: "" }));
  const checkBtn = button("检查", () => check(), "btn3d primary grow", { "data-check": "" });
  checkBtn.disabled = true;
  const onChange = () => { if (!submitted) checkBtn.disabled = !area.ready(); };

  // 各题型的答题区，返回 { node, ready(), lock(), mark(), isCorrect(), why(), whyWrong(), code() }
  const area = ex.type === "predict" ? predictArea(ex, onChange)
    : ex.type === "fill" ? fillArea(ex, onChange)
    : orderArea(ex, onChange);

  const helpBtn = button(mascot(56, "think"), () => {
    const text = hintShown || !ex.hint ? correctAnswerText(ex) : ex.hint;
    const title = hintShown || !ex.hint ? "答案是：" : "小码提示：";
    hintShown = true;
    sheet((close) => [h("div", { class: "lsheet hint" }, h("div", { class: "hint-row" }, mascot(48, "think"), h("b", { text: title })), h("pre", { class: "hint-text", text }), button("好的", close, "btn3d primary wide"))]);
  }, "mascot-btn", { "aria-label": "让小码给个提示" });

  appEl.replaceChildren(
    circuit("edge"),
    lessonHeader(run),
    h("main", { class: "lesson" },
      ex.tip ? h("p", { class: "tip-line" }, h("b", { text: "提示 " }), ex.tip) : null,
      h("h2", { class: "q", text: ex.prompt }),
      area.node,
      outPanel,
    ),
    h("footer", { class: "lessonfoot" }, helpBtn, checkBtn),
  );

  function check() {
    if (submitted || checkBtn.disabled) return; // 重复点击不会二次计分
    submitted = true;
    // ---- 0 ms：提交并锁定，计分只发生这一次 ----
    checkBtn.disabled = true;
    checkBtn.textContent = "检查中";
    area.lock();
    feel.haptic(); // 必须在用户点击的这一刻请求
    const ok = area.isCorrect();
    const reduce = feel.reducedMotion();
    if (ok) {
      run.correct++;
      const gain = run.review ? XP_REVIEW : XP_CORRECT;
      run.xp += gain; state.xp += gain; persist();
    } else {
      run.mistakes++;
      if (!run.review) { loseHeart(state); persist(); }
      run.queue.push(idx); // 错题放到最后再做
    }
    run.queue.shift();
    const reason = ok ? area.why() : area.whyWrong();
    const outOfHearts = !ok && !run.review && state.hearts <= 0;

    // 显示真实运行结果：选输出题跑原程序，其他题跑你拼出来的程序
    const code = ex.type === "predict" ? ex.code : area.code();
    showRun(outPanel, code);

    let continued = false;
    const contBtn = button(outOfHearts ? "红心用完了" : "继续", () => {
      if (continued) return; // 快速连点“继续”只算一次
      continued = true;
      if (outOfHearts) { renderPath(); openNoHearts(run.lesson); return; }
      renderExercise(run);
    }, "btn3d " + (ok ? "primary" : "danger") + " wide", { "data-continue": "" });
    contBtn.disabled = true;
    const fb = h("div", { class: "feedbar " + (ok ? "ok" : "bad"), role: "status" },
      h("div", { class: "fb-head" }, icon(ok ? "check" : "cross", { size: 26, cls: "fb-ico" }), h("b", { text: ok ? "答对了！" : "不对哦" }), ok ? h("span", { class: "fb-xp", text: `+${run.review ? XP_REVIEW : XP_CORRECT} XP` }) : null),
      reason ? h("p", { text: reason }) : null,
      !ok ? h("p", { class: "fb-answer" }, "正确答案：", h("code", { text: correctAnswerText(ex) })) : null,
      !ok && !run.review ? h("p", { class: "fb-heart" }, icon("heart", { size: 16 }), `红心 -1（剩 ${state.hearts} 颗）。这道题稍后再做一次。`) : null,
      contBtn,
    );

    // ---- 120 ms：揭示结果 ----
    setTimeout(() => {
      if (!checkBtn.isConnected) return; // 这期间已经离开了这道题，旧回调什么也不做
      area.mark();
      feel.play(ok ? "correct" : "wrong");
      appEl.querySelector(".lessonfoot").replaceWith(fb);
      // ---- 240 ms：红心 / 统计更新 ----
      setTimeout(() => {
        if (!fb.isConnected) return;
        appEl.querySelector(".lessonbar").replaceWith(lessonHeader(run));
        if (!ok && !run.review) appEl.querySelector(".lessonbar .hearts")?.classList.add("lost");
      }, reduce ? 0 : STATS_MS - REVEAL_MS);
      // ---- 280 ms：可以继续（减少动态效果时揭示即可继续） ----
      setTimeout(() => { if (fb.isConnected) contBtn.disabled = false; }, reduce ? 0 : CONTINUE_MS - REVEAL_MS);
    }, REVEAL_MS);
  }
}

function correctAnswerText(ex) {
  if (ex.type === "predict") return ex.options.find((o) => o.correct).text;
  if (ex.type === "fill") { let c = ex.code; ex.answer.forEach((t, i) => (c = c.replace(`{${i}}`, t))); return c; }
  return ex.answers[0].map((k) => ex.lines[k]).join("\n");
}

// 选输出题
function predictArea(ex, onChange) {
  let picked = null; let locked = false;
  const opts = h("div", { class: "choices" }, ex.options.map((o, i) => {
    const b = button(h("pre", { text: o.text }), () => {
      if (locked) return;
      picked = i;
      feel.play("select");
      opts.querySelectorAll(".choice").forEach((x, k) => x.classList.toggle("sel", k === i));
      onChange();
    }, "choice", { "aria-label": `选项：${o.text.replace(/\n/g, " 换行 ")}` });
    return b;
  }));
  return {
    node: h("div", {}, codeBlock(ex.code), opts),
    ready: () => picked !== null,
    lock: () => { locked = true; }, // 先保持中性的“已选中”外观
    mark: () => { opts.querySelectorAll(".choice").forEach((x, k) => { if (ex.options[k].correct) x.classList.add("right"); else if (k === picked) x.classList.add("wrong"); }); },
    isCorrect: () => !!ex.options[picked].correct,
    why: () => ex.options[picked].why,
    whyWrong: () => ex.options[picked].why,
    code: () => ex.code,
  };
}

// 点词块填空 / 修程序
function fillArea(ex, onChange) {
  const n = (ex.code.match(/\{\d+\}/g) || []).length;
  let slots = ex.initial ? [...ex.initial] : Array(n).fill(null);
  let active = Math.max(0, slots.findIndex((s) => s === null || (ex.initial && s === ex.initial[0])));
  let locked = false;
  let marked = false;
  const codeEl = h("div", { class: "codeblock fill" });
  const bank = h("div", { class: "bank" });
  const render = () => {
    codeEl.replaceChildren(...ex.code.split("\n").map((line, li) => {
      const parts = line.split(/(\{\d+\})/);
      return h("div", { class: "cl" }, h("span", { class: "ln", text: String(li + 1) }), h("span", { class: "lc" }, parts.flatMap((p) => {
        const m = /^\{(\d+)\}$/.exec(p);
        if (!m) return codeLine(p);
        const k = Number(m[1]);
        const bad = marked && slots[k] !== ex.answer[k];
        return button(slots[k] ?? "", () => { if (!locked) { active = k; feel.play("select"); render(); } },
          "slot" + (slots[k] ? " filled" : "") + (k === active && !locked ? " active" : "") + (marked ? (bad ? " wrong" : " right") : ""), { "aria-label": `空格 ${k + 1}：${slots[k] || "空"}`, "data-slot": String(k) });
      })));
    }));
    bank.replaceChildren(
      h("div", { class: "bank-ctrl" },
        button("⌫", () => { if (!locked) { slots[active] = null; feel.play("undo"); render(); onChange(); } }, "kchip ctrl", { "aria-label": "清空当前空格" }),
        button("‹", () => { if (!locked) { active = Math.max(0, active - 1); feel.play("select"); render(); } }, "kchip ctrl", { "aria-label": "上一个空格" }),
        button("›", () => { if (!locked) { active = Math.min(n - 1, active + 1); feel.play("select"); render(); } }, "kchip ctrl", { "aria-label": "下一个空格" }),
      ),
      h("div", { class: "bank-tokens" }, ex.tokens.map((t) => button(t, () => {
        if (locked) return;
        slots[active] = t;
        feel.play("place");
        const nextEmpty = slots.findIndex((s) => s === null);
        if (nextEmpty !== -1) active = nextEmpty;
        render(); onChange();
      }, "kchip tok", { "data-token": t }))),
    );
  };
  render();
  const reset = button("↺ 重新开始", () => { if (!locked) { slots = ex.initial ? [...ex.initial] : Array(n).fill(null); active = 0; feel.play("undo"); render(); onChange(); } }, "link small reset");
  const code = () => { let c = ex.code; slots.forEach((t, i) => (c = c.replace(`{${i}}`, t ?? ""))); return c; };
  const wrongToken = () => slots.find((t, i) => t !== ex.answer[i]);
  return {
    node: h("div", {}, codeEl, bank, reset),
    ready: () => slots.every((s) => s !== null) && !(ex.initial && slots.every((s, i) => s === ex.initial[i])),
    lock: () => { locked = true; render(); },
    mark: () => { marked = true; render(); },
    isCorrect: () => slots.every((t, i) => t === ex.answer[i]),
    why: () => "",
    whyWrong: () => ex.why?.[wrongToken()] || "这样运行出来的结果和要求不一样，看看下面的运行结果。",
    code,
  };
}

// 排顺序
function orderArea(ex, onChange) {
  let chosen = [];
  let locked = false;
  const mine = h("div", { class: "order-mine", "aria-label": "你的程序" });
  const bank = h("div", { class: "order-bank" });
  const render = () => {
    mine.replaceChildren(...(chosen.length ? chosen.map((k, i) => button(h("span", {}, h("span", { class: "ln", text: String(i + 1) }), codeLine(ex.lines[k])), () => {
      if (locked) return; chosen.splice(i, 1); feel.play("undo"); render(); onChange();
    }, "line-chip in", { "data-line": String(k) })) : [h("p", { class: "muted order-empty", text: "点下面的代码行，按顺序放到这里" })]));
    bank.replaceChildren(...ex.shuffled.filter((k) => !chosen.includes(k)).map((k) => button(h("span", {}, codeLine(ex.lines[k])), () => {
      if (locked) return; chosen.push(k); feel.play("place"); render(); onChange();
    }, "line-chip", { "data-line": String(k) })));
  };
  render();
  const reset = button("↺ 重新开始", () => { if (!locked) { chosen = []; feel.play("undo"); render(); onChange(); } }, "link small reset");
  const code = () => chosen.map((k) => ex.lines[k]).join("\n");
  const answerTexts = ex.answers.map((a) => a.map((k) => ex.lines[k]).join("\n"));
  return {
    node: h("div", {}, h("div", { class: "order-label", text: "你的程序" }), mine, h("div", { class: "order-label", text: "代码行" }), bank, reset),
    ready: () => chosen.length === ex.lines.length,
    lock: () => { locked = true; },
    mark: () => { mine.classList.add(answerTexts.includes(code()) ? "right" : "wrong"); },
    isCorrect: () => answerTexts.includes(code()),
    why: () => "",
    whyWrong: () => "顺序不对。程序从上往下一行一行执行：变量要先存好值，才能拿来用；想先显示的，就放在前面。",
    code,
  };
}

function renderFinish(run) {
  const l = run.lesson;
  const firstTime = !state.done[l.id];
  state.done[l.id] = true;
  state.lessonsCompleted++;
  const bonus = run.review ? 0 : XP_FINISH;
  run.xp += bonus; state.xp += bonus;
  const newDay = bumpStreak(state);
  let heartMsg = null;
  if (run.review) {
    regenHearts(state);
    if (state.hearts < HEARTS_MAX) { state.hearts++; heartMsg = `复习奖励：恢复 1 颗红心（现在 ${state.hearts} 颗）`; }
  }
  persist();
  currentRun = null;
  feel.play("finish"); // 连续天数增加也复用这一个声音，不叠播
  const accuracy = Math.round((run.total / (run.total + run.mistakes)) * 100);
  appEl.replaceChildren(
    h("main", { class: "finish" },
      mascot(120, "celebrate"),
      h("h1", { text: run.mistakes === 0 ? "完美！" : "完成！" }),
      h("p", { class: "muted", text: firstTime ? `「${l.title}」通关` : `复习「${l.title}」完成` }),
      h("div", { class: "finish-stats" },
        h("div", { class: "fs" }, h("small", { text: "本关 XP" }), h("b", {}, icon("bolt", { size: 20 }), `+${run.xp}`)),
        h("div", { class: "fs" }, h("small", { text: "正确率" }), h("b", { text: `${accuracy}%` })),
        h("div", { class: "fs" }, h("small", { text: "连续天数" }), h("b", {}, icon("flame", { size: 20 }), String(currentStreak(state)))),
      ),
      newDay ? h("p", { class: "streak-msg", text: currentStreak(state) > 1 ? `连续学习 ${currentStreak(state)} 天，保持住！` : "今天的学习完成了，明天再来续上连续天数！" }) : null,
      heartMsg ? h("p", { class: "heart-msg", text: heartMsg }) : null,
      button("继续", () => { feel.haptic(); renderPath(); }, "btn3d primary wide", { "data-continue": "" }),
    ),
  );
}

// ---------- 随机练习（SPEC §0.3）：只用已通关关卡的原题；无奖励，不改变主线学习数据 ----------
// 本轮结果只在内存里（currentPractice），不写本机记录：不加 XP、不扣也不恢复红心、不计连续天数、不推进解锁。
let currentPractice = null;
const availableUnits = () => course.units.filter((u) => u.available).map((u) => ({ id: u.id, title: u.title, lessons: UNITS[u.id].lessons }));

function practiceEntry() {
  const any = clearedScope(availableUnits(), state.done).length > 0;
  const b = button(h("span", { class: "practice-entry-text" }, h("b", { text: "随机练习" }), h("small", { text: "无奖励，自由练习" })),
    () => renderPracticeSetup(), "btn3d practice-entry wide", { "data-practice-entry": "" });
  b.disabled = !any;
  return h("div", { class: "practice-entry-wrap" }, b, any ? null : h("p", { class: "muted small practice-empty", "data-practice-empty": "", text: "完成第一关后可开始刷题" }));
}

function renderPracticeSetup(prev) {
  currentRun = null; currentPractice = null;
  const scope = clearedScope(availableUnits(), state.done);
  if (!scope.length) {
    appEl.replaceChildren(circuit("full"), statsBar(), h("main", { class: "view practice-setup" },
      mascot(96, "companion"), h("h1", { text: "还不能刷题哦" }),
      h("p", { "data-practice-empty": "", text: "随机练习只用你已经通关的关卡出题。完成第一关后可开始刷题，先去闯一关吧！" }),
      button("回到地图", renderPath, "btn3d primary wide")), tabBar("path"));
    return;
  }
  const selected = new Set(prev?.selected || scope.flatMap((u) => u.lessons.map((l) => l.id)));
  let size = prev?.size || DEFAULT_ROUND;
  const info = h("p", { class: "practice-info", role: "status", "data-practice-info": "" });
  const startBtn = button("开始练习", () => {
    const pool = buildPool(availableUnits(), state.done, selected);
    if (!pool.length) return;
    startPractice(pool, size, { selected: [...selected], size });
  }, "btn3d primary wide", { "data-practice-start": "" });
  const units = h("div", { class: "practice-units" });
  const sizeRow = h("div", { class: "practice-sizes", role: "group", "aria-label": "每轮题数" });
  const refresh = () => {
    const n = buildPool(availableUnits(), state.done, selected).length;
    const actual = Math.min(size, n);
    startBtn.disabled = n === 0;
    info.textContent = n === 0 ? "请至少选一个关卡。" : actual < size ? `已选范围只有 ${n} 道题，不够 ${size} 道，本轮用全部 ${actual} 道。` : `本轮 ${actual} 道题（已选范围共 ${n} 道）。`;
    units.replaceChildren(...scope.map((u) => {
      const ids = u.lessons.map((l) => l.id);
      const all = ids.every((id) => selected.has(id)); const some = ids.some((id) => selected.has(id));
      const ub = button(h("span", {}, h("b", { text: u.title }), h("small", { text: `已通关 ${ids.length} 关` })), () => {
        if (all) ids.forEach((id) => selected.delete(id)); else ids.forEach((id) => selected.add(id));
        feel.play("select"); refresh();
      }, "pchip unit-chip" + (all ? " sel" : some ? " part" : ""), { "aria-pressed": String(all), "data-practice-unit": u.id });
      return h("div", { class: "practice-unit" }, ub, h("div", { class: "practice-lessons" }, u.lessons.map((l) => button(l.title, () => {
        if (selected.has(l.id)) selected.delete(l.id); else selected.add(l.id);
        feel.play("select"); refresh();
      }, "pchip" + (selected.has(l.id) ? " sel" : ""), { "aria-pressed": String(selected.has(l.id)), "data-practice-lesson": l.id }))));
    }));
    sizeRow.replaceChildren(...ROUND_SIZES.map((k) => button(`${k} 题`, () => { size = k; feel.play("select"); refresh(); },
      "pchip size" + (k === size ? " sel" : ""), { "aria-pressed": String(k === size), "data-practice-size": String(k) })));
  };
  const allBtn = button("全部已学", () => { scope.forEach((u) => u.lessons.forEach((l) => selected.add(l.id))); refresh(); }, "link small", { "data-practice-all": "" });
  const noneBtn = button("取消全部", () => { selected.clear(); refresh(); }, "link small", { "data-practice-none": "" });
  refresh();
  appEl.replaceChildren(circuit("full"), statsBar(), h("main", { class: "view practice-setup" },
    h("h1", { text: "随机练习" }),
    h("p", { class: "muted", text: "无奖励，自由练习：只从已通关的关卡出题，不加 XP、不扣红心、不计连续天数，也不影响解锁。" }),
    h("div", { class: "practice-head" }, h("h3", { text: "范围" }), h("span", { class: "practice-links" }, allBtn, noneBtn)),
    units,
    h("h3", { text: "每轮题数" }), sizeRow,
    info, startBtn,
    button("回到地图", renderPath, "btn3d ghost wide"),
  ), tabBar("path"));
}

function startPractice(pool, size, setup) {
  const round = drawRound(pool, size);
  currentPractice = {
    setup, requested: round.requested, total: round.actual,
    items: round.items.map((p) => ({ ...p, ex: shuffleExercise(p.ex) })),
    queue: round.items.map((_, i) => ({ i, retry: false })),
    results: round.items.map(() => ({ first: null, retry: null })), // first / retry：true 答对，false 答错，null 没做
    answered: 0,
  };
  renderPracticeExercise(currentPractice);
}

function practiceHeader(pr) {
  const pct = Math.round((pr.answered / Math.max(1, pr.total + pr.results.filter((r) => r.first === false).length)) * 100);
  return h("header", { class: "lessonbar" },
    button(icon("close", { size: 24 }), () => confirmPracticeExit(pr), "icon-btn ghost", { "aria-label": "退出练习" }),
    h("div", { class: "progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "progress-fill", style: `width:${Math.max(4, pct)}%` })),
    h("span", { class: "stat practice-tag", title: "随机练习无奖励" }, "练习"),
  );
}

function confirmPracticeExit(pr) {
  sheet((close) => [h("div", { class: "lsheet" },
    h("h2", { text: "要退出练习吗？" }),
    h("p", { text: "本轮练习位置不保存。随机练习不影响 XP、红心、连续天数和解锁。" }),
    button("继续练习", close, "btn3d primary wide"),
    button("退出", () => { close(); if (currentPractice === pr) currentPractice = null; renderPath(); }, "btn3d danger-ghost wide", { "data-practice-quit": "" }),
  )]);
}

function renderPracticeExercise(pr) {
  if (currentPractice !== pr) return;
  if (pr.queue.length === 0) return renderPracticeFinish(pr);
  const { i, retry } = pr.queue[0];
  const item = pr.items[i];
  const ex = item.ex;
  window.__app.currentEx = ex; // 给自动测试用（已打乱的版本）
  window.__app.currentPracticeItem = { id: item.id, retry };
  let submitted = false;
  const outPanel = h("details", { class: "outpanel" }, h("summary", { text: "运行结果" }), h("pre", { class: "out", text: "" }));
  const checkBtn = button("检查", () => check(), "btn3d primary grow", { "data-check": "" });
  checkBtn.disabled = true;
  const onChange = () => { if (!submitted) checkBtn.disabled = !area.ready(); };
  const area = ex.type === "predict" ? predictArea(ex, onChange) : ex.type === "fill" ? fillArea(ex, onChange) : orderArea(ex, onChange);
  appEl.replaceChildren(
    circuit("edge"),
    practiceHeader(pr),
    h("main", { class: "lesson" },
      h("p", { class: "tip-line practice-src" }, h("b", { text: retry ? "重练 " : "随机练习 " }), lessonTitle(item.lessonId)),
      ex.tip ? h("p", { class: "tip-line" }, h("b", { text: "提示 " }), ex.tip) : null,
      h("h2", { class: "q", text: ex.prompt }),
      area.node,
      outPanel,
    ),
    h("footer", { class: "lessonfoot" }, h("span", { class: "mascot-slot" }, mascot(56, "think")), checkBtn),
  );
  function check() {
    if (submitted || checkBtn.disabled) return; // 连点只算一次
    submitted = true;
    checkBtn.disabled = true;
    checkBtn.textContent = "检查中";
    area.lock();
    feel.haptic();
    const ok = area.isCorrect();
    const reduce = feel.reducedMotion();
    // 只记在内存里；不碰 state（XP、红心、连续天数、解锁全部不变）
    if (retry) pr.results[i].retry = ok; else pr.results[i].first = ok;
    pr.answered++;
    pr.queue.shift();
    if (!ok && !retry) pr.queue.push({ i, retry: true }); // 答错：本轮末尾重练一次
    const reason = ok ? area.why() : area.whyWrong();
    showRun(outPanel, ex.type === "predict" ? ex.code : area.code());
    let continued = false;
    const contBtn = button("继续", () => { if (continued) return; continued = true; renderPracticeExercise(pr); }, "btn3d " + (ok ? "primary" : "danger") + " wide", { "data-continue": "" });
    contBtn.disabled = true;
    const fb = h("div", { class: "feedbar " + (ok ? "ok" : "bad"), role: "status" },
      h("div", { class: "fb-head" }, icon(ok ? "check" : "cross", { size: 26, cls: "fb-ico" }), h("b", { text: ok ? "答对了！" : "不对哦" })),
      reason ? h("p", { text: reason }) : null,
      !ok && retry ? h("p", { class: "fb-answer" }, "解答：", h("code", { text: correctAnswerText(ex) })) : null,
      !ok && !retry ? h("p", { class: "fb-retry", text: "这道题会在本轮最后再练一次。" }) : null,
      contBtn,
    );
    setTimeout(() => {
      if (!checkBtn.isConnected) return;
      area.mark();
      feel.play(ok ? "correct" : "wrong");
      appEl.querySelector(".lessonfoot").replaceWith(fb);
      setTimeout(() => { if (fb.isConnected) contBtn.disabled = false; }, reduce ? 0 : CONTINUE_MS - REVEAL_MS);
    }, REVEAL_MS);
  }
}

function lessonTitle(id) { const l = allLessons().find((x) => x.id === id); return l ? l.title : id; }

function renderPracticeFinish(pr) {
  const firstOk = pr.results.filter((r) => r.first === true).length;
  const wrong = pr.items.map((it, k) => ({ it, r: pr.results[k] })).filter((x) => x.r.first === false);
  const retryOk = wrong.filter((x) => x.r.retry === true).length;
  feel.play("finish");
  const setup = pr.setup;
  currentPractice = null;
  appEl.replaceChildren(h("main", { class: "finish practice-finish" },
    mascot(110, wrong.length ? "companion" : "celebrate"),
    h("h1", { text: "练习完成" }),
    pr.total < pr.requested ? h("p", { class: "muted", text: `题目不够 ${pr.requested} 道，本轮用了全部 ${pr.total} 道。` }) : null,
    h("div", { class: "finish-stats" },
      h("div", { class: "fs" }, h("small", { text: "首次答对" }), h("b", { "data-practice-first": "", text: `${firstOk}/${pr.total}` })),
      h("div", { class: "fs" }, h("small", { text: "重练答对" }), h("b", { "data-practice-retry": "", text: `${retryOk}/${wrong.length}` })),
    ),
    wrong.length ? h("div", { class: "practice-wrong" }, h("h3", { text: "错题" }), h("ul", {}, wrong.map((x) =>
      h("li", {}, h("span", { text: `${lessonTitle(x.it.lessonId)}：${x.it.ex.prompt}` }), h("small", { text: x.r.retry ? "重练答对" : "重练仍错，已看解答" }))))) : null,
    h("p", { class: "muted small", text: "随机练习不加 XP、不扣红心、不计连续天数。" }),
    button("再来一轮", () => renderPracticeSetup(setup), "btn3d primary wide", { "data-practice-again": "" }),
    button("回到地图", () => { feel.haptic(); renderPath(); }, "btn3d ghost wide", { "data-continue": "" }),
  ));
}

// iPhone 弹出系统键盘时，按实际可视高度排版
const vv = window.visualViewport;
if (vv) {
  const fit = () => document.documentElement.style.setProperty("--app-h", vv.height + "px");
  vv.addEventListener("resize", fit);
  fit();
}
// 回到前台时刷新红心显示
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && appEl.querySelector(".statsbar")) { regenHearts(state); persist(); appEl.querySelector(".statsbar").replaceWith(statsBar()); } });

window.__app = { sheet, LIMITS, pythonUnavailableText, swInfo, refreshSwInfo, keysounds: () => import("./keysounds.js"), runner, getState: () => state, setState: (s) => { state = s; feel.setPrefs(s.prefs); }, persist, renderPath, words, feel, getRun: () => currentRun, getPractice: () => currentPractice };
// ---------- 离线支持（Service Worker）----------
// 联网打开一次后，应用外壳和课程内容会缓存在本机，断网也能进入地图和做点选题。Pyodide 不缓存，离线时 Python 运行结果显示提示。
let swReg = null;
async function refreshSwInfo() {
  if (!("serviceWorker" in navigator)) { swInfo.status = "此浏览器不支持"; return swInfo; }
  try {
    swInfo.caches = typeof caches !== "undefined" ? (await caches.keys()).filter((k) => k.startsWith("suipian-preview-")) : [];
    swInfo.status = navigator.serviceWorker.controller ? "已启用（断网后可打开地图和课程）" : (swReg ? "正在安装，刷新一次后生效" : "未启用");
  } catch { swInfo.status = "读取失败"; }
  return swInfo;
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) showToast("已更新到新版本，刷新页面后使用最新内容。");
    refreshSwInfo();
  });
  const register = () => navigator.serviceWorker.register("./sw.js").then((reg) => { swReg = reg; refreshSwInfo(); }).catch((e) => { swInfo.status = "注册失败：" + (e?.message || e); });
  if (document.readyState === "complete") register(); else window.addEventListener("load", register);
  // 回到前台、恢复网络时检查有没有新版本，避免长期停在旧课程
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") swReg?.update().catch(() => {}); });
}
window.addEventListener("online", () => {
  if (runner.state === "loadError") runner.boot(); // 恢复网络后自动重新加载 Python
  swReg?.update().catch(() => {});
});
// 先把界面画出来，再在后台加载 Python：Python 出任何问题都不能让页面一片空白
if (state.onboarded) renderPath(); else renderOnboarding();
try { runner.boot(); } catch { /* 失败时 runner 已经记录为 loadError，“运行结果”面板会如实提示 */ }
