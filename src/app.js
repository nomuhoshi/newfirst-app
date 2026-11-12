// 碎片编程：关卡式学习（原创视觉“墨蓝实验手账”）。
// 首页是关卡地图；每关 = 故事开场 + 4 道点选题（选输出 / 点词块填空或修程序 / 排顺序）。
// 答错扣红心、错题放到最后再做；答对加 XP；每天完成一关续上连续天数。
// 点“检查”的时间线（ms）：0 提交并锁定 → 120 揭示结果 + 声音 → 240 红心/XP 更新 → 280（减少动态效果时 120）可以继续。
import "./preview-storage.js"; // 必须第一个：测试入口里给 localStorage 加前缀，和正式版隔离
import "./style.css";
import "./app.css";
import "./game.css";
import course from "../content/course.json";
import unit1 from "../content/unit1.json";
import unit2 from "../content/unit2.json";
import unit3 from "../content/unit3.json";
import unit4 from "../content/unit4.json";
import unit5 from "../content/unit5.json";
import words from "../content/words.json";
import { Runner, LIMITS } from "./runner.js";
import { makeRunnerExecutor } from "./judge.js";
// 代码题模块（写代码 / 改代码题，含 CodeMirror 编辑器，约 120 KB gzip）按需加载：首屏只用点选题，不需要它。
// 构建时它仍进入离线预缓存清单（vite-sw-plugin 会把动态导入也算进去），断网也能打开。
// CODE_TYPES 必须和 code-task.js 里的同名常量一致（tests/e2e/pwa-split.test.mjs 会检查）。
const CODE_TYPES = ["modify", "write"];
const isCodeTask = (ex) => CODE_TYPES.includes(ex?.type);
let codeTaskMod = null, codeTaskLoading = null;
function loadCodeTask() {
  const once = () => import("./code-task.js").then((m) => { if (!m?.createCodeArea) throw new Error("代码题模块没有加载成功"); return m; });
  // 失败时自动再试一次；还不行才交给调用方提示
  if (!codeTaskLoading) codeTaskLoading = once().catch(once).then((m) => (codeTaskMod = m)).catch((e) => { codeTaskLoading = null; throw e; });
  return codeTaskLoading;
}
import { describeError } from "./errors.js";
import * as feel from "./feel.js";
import { KEY_SOUNDS, DEFAULT_STYLE } from "./keysounds.js";
import {
  loadState, saveState, readSnapshot, mergeStored, syncFromStorage, addXp, addRun, getLastSavedAt, clearState, regenHearts, loseHeart, bumpStreak, currentStreak, HEARTS_MAX, listUnreadable,
getLastSaveStatus, stateEpoch, } from "./storage.js";
import { CLOUD, hostOf, PROD_HOST } from "./cloud-config.js";
import { createApi } from "./cloud-api.js";
import { createSync } from "./sync.js";
import { createAccountUi } from "./account-ui.js";
import { createPreviewInfo } from "./preview-info.js";
import { cloudTarget } from "./cloud-config.js";
import { docToState } from "./account-data.js";
import { buildExport, exportFileName, parseImport, mergeImport, summarize, encodeCode, decodeCode } from "./progress-file.js";
import { ensurePersist, firstSeenAt, storageReport, markExported, snoozeExport, exportReminderDue, recordLoad, ensureBackupBase, getLastReminderStatus } from "./storage-health.js";
import { ROUND_SIZES, DEFAULT_ROUND, clearedScope, buildPool, drawRound, shuffleExercise } from "./practice.js";

const UNITS = { U1: unit1, U2: unit2, U3: unit3, U4: unit4, U5: unit5 };
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
// .lc 是 inline-flex：裸文本节点若只含空格（缩进、两个符号之间的空格）会被当作空白丢掉。
// 所以普通文本也包进 span（继承 white-space: pre），缩进和空格才会保留。
const plain = (t) => h("span", { class: "tk-txt", text: t });
function codeLine(text) {
  const frag = [];
  const re = /("[^"]*"?)|(\b\d+(?:\.\d+)?\b)|(\bprint\b)|([=+\-*/()])/g;
  let last = 0; let m;
  while ((m = re.exec(text))) {
    if (m.index > last) frag.push(plain(text.slice(last, m.index)));
    const cls = m[1] ? "tk-str" : m[2] ? "tk-num" : m[3] ? "tk-fn" : "tk-op";
    frag.push(h("span", { class: cls, text: m[0] }));
    last = m.index + m[0].length;
  }
  if (last < text.length) frag.push(plain(text.slice(last)));
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
if (notice && !loaded.readFailed) saveState(state); // 读取失败时不存空记录（会盖掉真实进度）；迁移或修复后的记录立即存一次，下次不再重复提示
// ---------- 账号与云端 ----------
// 登录后，学习进度写进“这个账号在本机的副本”（再在后台同步到云端），不再写游客记录；退出登录后回到游客记录。
let safeStorage = null;
try { safeStorage = window.localStorage; } catch { /* 存储被禁用：只能游客模式 */ }
const cloudApi = createApi({ url: CLOUD.url, anonKey: CLOUD.anonKey });
let accountUi = null;
let currentView = "path"; // 地图 "path" / 我的 "me" / 其他（做题等）
// 别的设备用“覆盖云端”换掉了这个账号的进度，而这台设备还有没上传的学习内容：同步层发出 replaced 通知（docs/15 §5）。
// 只在地图页或“我的”页提示，做题中不打断；等回到这两个页面时再显示，显示过就清掉（同一次替换只提示一次）。
const REPLACED_TEXT = "这个账号的进度已在别的设备上被替换，这台设备上还没上传的学习内容没有保留。";
let pendingReplaced = false; // 提示还没显示
let replacedOn = null; // 提示正在哪个页面显示（"path" / "me"）：同一页面被同步刷新时保留，离开该页面（换页、进入做题）后清除
// 页面渲染时调用：返回该页面要不要显示替换提示
function replacedFor(view) {
  if (pendingReplaced) { pendingReplaced = false; replacedOn = view; }
  else if (replacedOn !== view) replacedOn = null;
  return replacedOn === view ? REPLACED_TEXT : null;
}
// 测试入口信息面板（正式构建里 isPreview 为 false，什么都不创建）。getStatus 等在 sync 创建之后才有值，所以用到时再取。
let previewInfo = null;
const sync = safeStorage ? createSync({
  storage: safeStorage, api: cloudApi, projectId: hostOf(CLOUD.url) || "cloud-off", legacyProject: PROD_HOST,
  onStatus: () => { accountUi?.refreshStatus(); previewInfo?.refresh(); },
  onNotice: (kind) => { if (kind !== "replaced") return; pendingReplaced = true; if (currentView === "path") renderPath(); else if (currentView === "me") renderMe(); },
  onState: (doc) => { state = docToState(doc, state); feel.setPrefs(state.prefs); if (currentView === "path") renderPath(); else if (currentView === "me") renderMe(); }, // 云端带来了别的设备的进度：只在地图 / 我的页刷新，做题中不打断
}) : null;
const restored = sync ? sync.restore(state) : null;
if (restored) { state = restored.state; notice = null; feel.setPrefs(state.prefs); }
const CLEARED_MSG_SHORT = "其他页面已清除学习记录，刚才的内容没有保存，本页已按新记录刷新。";
const CLEARED_MSG_IMPORT = "其他页面已清除学习记录，本次恢复未完成，请重新读取进度码并确认。你的备份文件或进度码没有被修改。";
function persist() {
  if (sync && sync.account()) {
    const r = sync.persistLocal(state);
    if (!r.ok) showToast("无法保存进度到这台设备（" + (r.message || "存储不可用") + "），关掉页面后进度可能丢失。");
    return !!r.ok;
  }
  if (!saveState(state)) {
    if (getLastSaveStatus() === "cleared") showToast(CLEARED_MSG_SHORT); // 清除胜出：不是存储故障，不报“无痕模式或存储已满”
    else showToast("无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。");
    return false;
  }
  ensureBackupBase(Object.keys(state.done).length, Date.now(), stateEpoch(state)); // 备份提醒的起点：首次成功保存有效进度，且这次保存属于现在这一代
  return true;
}
function clearProgress() { const prefs = state.prefs; const f = clearState(); if (f.clearFailed) { showToast("清除失败（存储不可用），学习记录没有清除。"); return false; } state = f; state.prefs = prefs; state.onboarded = true; persist(); return true; }
accountUi = createAccountUi({
  h, button, sheet, icon, showToast, sync, api: cloudApi, getState: () => state,
  rerender: () => (currentView === "me" ? renderMe() : renderPath()),
  // 登录成功：换成账号里的进度；退出 / 删除：回到这台设备的游客记录
  onSwitchedIn: (r) => { state = r.state; feel.setPrefs(state.prefs); notice = null; currentView === "me" ? renderMe() : renderPath(); },
  onSwitchedOut: () => { const l = loadState(); state = l.state; notice = l.notice;
    // 登录过的设备一定已经看过开场介绍：退出后回到游客记录不再重放“你好，我是小码”（按设备保存，不同步）
    if (!state.onboarded) { state.onboarded = true; persist(); } feel.setPrefs(state.prefs); currentView === "me" ? renderMe() : renderPath(); },
});
previewInfo = createPreviewInfo({
  h, isPreview: typeof __PREVIEW_ID__ !== "undefined" && !!__PREVIEW_ID__,
  sha: typeof __SOURCE_SHA__ !== "undefined" ? __SOURCE_SHA__ : "", previewId: typeof __PREVIEW_ID__ !== "undefined" ? __PREVIEW_ID__ : "",
  build: typeof __BUILD__ !== "undefined" ? __BUILD__ : "", target: cloudTarget(),
  getStatus: () => (sync ? sync.status() : {}), getAccount: () => (sync ? sync.account() : null),
  getRecovery: () => (sync && sync.account() ? sync.pendingRecoveryInfo().state : "none"), getOnline: () => navigator.onLine !== false,
});
if (sync && restored) sync.syncNow(); // 打开应用时后台同步一次（失败也不影响学习）
addEventListener("online", () => previewInfo?.refresh());
addEventListener("offline", () => previewInfo?.refresh());
if (sync) {
  addEventListener("online", () => { if (sync.account()) sync.syncNow(); });
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && sync.account()) sync.syncNow(); });
  setInterval(() => { if (document.visibilityState === "visible" && sync.account() && sync.status().pending) sync.syncNow(); }, 60000);
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
const codeExec = makeRunnerExecutor(runner); // 写代码 / 改代码题的判题与运行
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
    if (runner.state === "idle" || runner.state === "loadError") runner.boot(); // idle = 本次打开后第一次真正要执行：此时才开始加载 Python
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
function sheet(content, { onClose, cls = "", canClose } = {}) {
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
  wrap.addEventListener("click", (e) => { if (e.target === wrap && Date.now() - openedAt > 800 && (!canClose || canClose())) close(); }); // canClose：处理中（发送 / 登录 / 上传核对）不允许点遮罩关掉
  // 键盘：Esc 关闭；Tab 在弹窗内循环；打开时焦点移入弹窗（iPad 外接键盘 / 读屏）
  wrap.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { e.preventDefault(); if (!canClose || canClose()) close(); return; }
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
  toastTimer = setTimeout(() => t.remove(), 4000);
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
    i === 0 && standalone && !Object.keys(state.done).length ? h("p", { class: "onboard-migrate", "data-migrate-hint": "", text: "这里暂时没有学习记录。如果你之前在 Safari 学习，可以从 Safari 的「我的」导出进度文件，再到这里导入。" }) : null,
    i === steps.length - 1 && cloudApi.configured ? button("已有账号？登录", () => accountUi.openLogin({ reason: "登录后会取回你在云端保存的进度。" }), "btn3d ghost wide", { "data-onboard-login": "" }) : null,
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
  currentArea?.destroy?.(); currentArea = null; // 从代码题退出时保存草稿
  currentView = "path";
  { const r = replacedFor("path"); if (r) notice = r; }
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
          st === "current" ? h("div", { class: "bubble", "aria-hidden": "true", onclick: () => openLessonSheet(l), text: i === 0 && !state.done[l.id] && state.xp === 0 ? "从这里开始" : "开始" }) : null,
          node, h("div", { class: "node-label", text: l.title }));
      })),
    );
  });
  appEl.replaceChildren(
    circuit("full"),
    statsBar(),
    h("main", { class: "view pathview" }, notice ? h("p", { class: "notice", role: "status", text: notice }) : null, updateNotice(), a2hsPrompt(), exportReminder(), practiceEntry(), accountUi?.accountRow(), units),
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
  let health = []; // 本机存储体检（异步取到后补进诊断）
  const showDiag = (extra = "") => {
    const d = feel.diagnostics();
    diag.textContent = [
      `应用版本：${typeof __BUILD__ !== "undefined" ? __BUILD__.slice(0, 16).replace("T", " ") + " UTC" : "开发版"}${typeof __PREVIEW_ID__ !== "undefined" && __PREVIEW_ID__ ? `（测试入口 ${__PREVIEW_ID__}）` : ""}`,
      `缓存版本：${swInfo.caches.length ? swInfo.caches.join("、").replace(/suipian-/g, "").slice(0, 40) : "无"}`,
      `离线支持：${swInfo.status}`,
      `网络：${navigator.onLine === false ? "离线" : "在线"}`,
      `运行方式：${standalone ? "主屏幕 App" : "浏览器"}`,
      `入口网址：${location.origin}${location.pathname}`, // 不含查询参数和片段，避免暴露认证信息
      `学习记录：已完成 ${Object.keys(state.done).length} 关，XP ${state.xp}；最后一次成功保存：${getLastSavedAt() ? new Date(getLastSavedAt()).toLocaleString() : "本次打开后尚未保存"}`,
      ...health,
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
  storageReport().then((l) => { health = l; if (diag.isConnected) showDiag(); });
  // 一键复制诊断：用户不用截图，直接粘贴给开发者。clipboard 不可用时（旧浏览器 / 非安全环境）选中文字让用户长按复制
  const copyDiag = async () => {
    const text = diag.textContent || "";
    try { await navigator.clipboard.writeText(text); showToast("诊断信息已复制，可以粘贴发给开发者。"); return; } catch { /* 走下面的选中 */ }
    try { const r = document.createRange(); r.selectNodeContents(diag); const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); showToast("已选中诊断文字，请长按选择“拷贝”。"); } catch { showToast("复制失败，请截图诊断区域。"); }
  };
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
    h("div", { class: "selftest-btns" }, button("复制诊断", copyDiag, "btn3d wide", { "data-selftest": "copy" })),
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

// ---------- 备份学习记录：导出 / 导入进度文件 ----------
// 导出进度文件（“我的”里的按钮和地图页的 14 天提醒共用）。返回 true = 已生成并请求下载（不代表用户已保存）
// 备份用的状态：游客从本机存储重新读取完整快照；任何读取失败都返回 null（拒绝备份，不退回旧内存）。已登录时以当前内存记录为准（云端状态另有同步）
const BACKUP_REFUSED = "没能完整读取本机学习记录，所以没有生成备份（记录没有被改动）。请刷新页面后再试。";
function snapshotForBackup() {
  if (sync && sync.account()) { syncFromStorage(state); return state; }
  const r = readSnapshot(state);
  return r.ok ? r.snap : null;
}
function exportProgressFile({ diagnostic = false } = {}) {
  try {
    const snap = snapshotForBackup(); if (!snap) return false;
    // 普通备份只带进度字段；读不懂而被留下的旧记录原文只进明确的“诊断文件”，不混进普通备份
    const data = buildExport(snap, { build: typeof __BUILD__ !== "undefined" ? __BUILD__ : "", unreadable: diagnostic ? listUnreadable() : [] });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = h("a", { href: url, download: diagnostic ? exportFileName(new Date()).replace("progress", "diagnostic") : exportFileName(new Date()), hidden: "" });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
    return true; // 只表示“已生成并请求下载”，网页无法确认文件真的保存了：14 天计时要等用户点“我已保存好”才重置
  } catch { return false; }
}
// 完成第 2 关后，iPhone Safari（非主屏幕 App）里提示一次“添加到主屏幕”：主屏幕 App 实测记录保留。可展开步骤、可“不再提示”，主屏幕 App 里永不显示，不弹窗、不打断答题
const A2HS_SNOOZE = "suipian.meta.a2hsSnooze";
// 返回 "ok" | "snapshot"（没能完整读取本机记录，拒绝备份）| "clipboard"（读取没问题，只是浏览器不让自动复制）
async function copyProgressCode() {
  let code = "";
  try { const snap = snapshotForBackup(); if (!snap) return "snapshot"; code = encodeCode(snap, { build: typeof __BUILD__ !== "undefined" ? __BUILD__ : "" }); } catch { return "snapshot"; }
  try { await navigator.clipboard.writeText(code); return "ok"; } catch { return "clipboard"; }
}
function a2hsPrompt() {
  if (!isIOS || standalone || state.installTipClosed || Object.keys(state.done).length < 2) return null;
  let snoozed = 0; try { snoozed = Number(localStorage.getItem(A2HS_SNOOZE)) || 0; } catch { /* 读不到就当没稍后 */ }
  if (Date.now() < snoozed) return null;
  const msg = h("p", { class: "small", role: "status", "data-a2hs-msg": "" });
  const steps = h("ol", { class: "small", hidden: "", "data-a2hs-steps": "" },
    h("li", { text: "先点上面的「复制进度码」备份当前进度（添加到主屏幕不会自动搬进度）" }),
    h("li", { text: "点 Safari 的分享按钮（方框加向上箭头）→「添加到主屏幕」→「添加」" }),
    h("li", { text: "从主屏幕图标打开碎片编程，进入“我的 → 备份学习记录 → 粘贴进度码”，粘贴后确认导入，进度就带过去了" }));
  const box = h("div", { class: "notice a2hs-prompt", role: "note", "data-a2hs": "" },
    h("p", { text: "添加到主屏幕，打开更方便。请先复制进度码；从主屏幕图标打开后，在“我的 → 备份学习记录”粘贴恢复。安装后请核对进度，仍建议保留备份。" }),
    steps, msg,
    h("div", { class: "acct-row" },
      button("复制进度码", async () => { const r = await copyProgressCode(); msg.textContent = r === "ok" ? "进度码已复制，请先粘贴到备忘录或发给自己保存；再按步骤添加到主屏幕。" : r === "snapshot" ? BACKUP_REFUSED : "这个浏览器不让自动复制：请到“我的 → 备份学习记录 → 复制进度码”，在那里可以手动选中复制。"; }, "btn3d", { "data-a2hs-code": "" }),
      button("怎么添加", () => { steps.hidden = !steps.hidden; }, "btn3d", { "data-a2hs-how": "" }),
    ),
    h("div", { class: "acct-row" },
      button("稍后", () => { let saved = true; try { localStorage.setItem(A2HS_SNOOZE, String(Date.now() + 3 * 24 * 3600 * 1000)); } catch { saved = false; } box.remove(); if (!saved) showToast("这个浏览器记不住“稍后”，下次打开还会提示。"); }, "btn3d ghost", { "data-a2hs-later": "" }),
      button("不再提示", () => { state.installTipClosed = true; persist(); box.remove(); }, "btn3d ghost", { "data-a2hs-close": "" }),
    ));
  return box;
}
// 地图页顶部的导出提醒：非阻塞、可关闭，不在答题中出现
// ---- 新版本提示（只在地图 / “我的”页出现；答题中从不弹、不刷新、不接管）----
let updateReady = false, updateDismissed = false, updateRequestedByUser = false, swReg = null;
function inLesson() { return !!(currentRun || currentPractice); }
function updateNotice() {
  if (!updateReady || updateDismissed || inLesson()) return null;
  const msg = h("p", { class: "small", role: "status", "data-update-msg": "" });
  return h("div", { class: "notice update-notice", role: "status", "data-update": "" },
    h("p", { text: "有新版本可用。点“现在更新”会先检查进度是否保存成功，再刷新页面。" }),
    msg,
    button("现在更新", () => {
      const w = swReg?.waiting; if (!w) { updateReady = false; renderCurrentSafe(); return; }
      // 更新会刷新页面：先核验进度确实写进了本机；没保存成功就不更新、不刷新，也不说“已保存”
      if (!persist()) { msg.textContent = "现在没能把进度保存到本机，所以暂不更新（否则刷新会丢掉还没保存的进度）。请先导出进度文件或复制进度码，或稍后再试。"; msg.classList.add("bad"); return; }
      updateRequestedByUser = true; w.postMessage({ type: "skipWaiting" });
    }, "btn3d primary", { "data-update-now": "" }),
    button("稍后", () => { updateDismissed = true; renderCurrentSafe(); }, "btn", { "data-update-later": "" }));
}
function renderCurrentSafe() { // 只在地图 / “我的”页重画；其他页面（答题、结算、开场）不动
  if (currentView === "path" && appEl.querySelector(".pathview")) renderPath();
  else if (currentView === "me" && appEl.querySelector(".statsbar")) renderMe();
}
function exportReminder() {
  if (!exportReminderDue({ doneCount: Object.keys(state.done).length, signedIn: !!sync?.account() })) return null;
  const box = h("div", { class: "notice export-reminder", role: "note", "data-export-reminder": "" },
    h("p", { text: "隔了一阵没备份学习记录了。记录只存在这台设备的浏览器里，导出一份进度文件更保险。" }),
    h("div", { class: "acct-row" },
      button("导出进度", () => {
        if (!exportProgressFile()) { showToast("没能生成备份（没有完整读到本机记录），记录没有被改动，请刷新后再试。"); return; }
        // 下载只是“请求”，网页确认不了文件真的在你手里：让用户自己确认后才重新计时
        box.replaceChildren(
          h("p", { "data-export-confirm": "", text: "已请求下载。请到“文件”App → 下载里确认有 suipian-progress 开头的文件，确认后点下面的按钮；没找到就再点一次“导出进度”。" }),
          h("div", { class: "acct-row" },
            button("我已保存好", () => { if (!markExported()) { const m = box.querySelector("[data-export-confirm]"); if (m) m.textContent = getLastReminderStatus() === "epoch" ? "其他页面刚清除了学习记录，这次确认没有记到新的学习记录上（新记录会重新计时）。" : "提醒时间未更新：这个浏览器记不住确认（可能是无痕模式或存储已满）。文件如果已经保存好，可以先不管；下次打开可能还会提醒。"; return; } box.remove(); showToast("好的，14 天后再提醒你。"); }, "btn3d", { "data-export-saved": "" }),
            button("再导出一次", () => { exportProgressFile(); }, "btn3d ghost", { "data-export-again": "" }),
          ));
      }, "btn3d", { "data-export-now": "" }),
      button("稍后", () => { if (!snoozeExport()) showToast(getLastReminderStatus() === "epoch" ? "其他页面刚清除了学习记录，“稍后”没有记到新的学习记录上。" : "这个浏览器记不住“稍后”，下次打开还会提醒。"); box.remove(); }, "btn3d ghost", { "data-export-later": "" }),
    ));
  return box;
}
function backupCard() {
  const signedIn = !!sync?.account();
  const msg = h("p", { class: "backup-msg small muted", role: "status", "data-backup-msg": "" });
  const panel = h("div", { class: "backup-panel" });
  const say = (t, bad = false) => { msg.textContent = t; msg.classList.toggle("bad", bad); };
  // 已登录时不能导入（进度以云端为准，导入会让 XP 在多设备间重复累加）。隐藏按钮之外，读取文件和点“确认导入”时都再查一次登录状态
  const blockedByLogin = () => {
    if (!sync?.account()) return false;
    panel.replaceChildren();
    say("已登录账号，不能导入进度文件。要导入请先退出登录，导入后再登录并选“转存到账号”。", true);
    return true;
  };
  const doExport = () => {
    if (!exportProgressFile()) { say(BACKUP_REFUSED, true); return; }
    {
      say("已请求下载。请到浏览器的下载位置（iPhone：“文件”App → 下载）确认文件在，并自己保管好。");
      if (!signedIn) panel.replaceChildren(h("div", { class: "confirm" }, h("p", { text: "确认文件已经保存好了吗？确认后，14 天备份提醒会重新计时。" }), button("我已保存好", () => { if (!markExported()) { say(getLastReminderStatus() === "epoch" ? "其他页面刚清除了学习记录，这次确认没有记到新的学习记录上（新记录会重新计时）。" : "提醒时间未更新：这个浏览器记不住确认（可能是无痕模式或存储已满）。", true); return; } panel.replaceChildren(); say("好的，14 天后再提醒你。"); }, "btn3d", { "data-export-saved-me": "" })));
    }
  };
  const file = h("input", { type: "file", accept: "application/json,.json", hidden: "", "data-import-file": "" });
  // 读到一段进度文本（文件或进度码）后：校验 → 给确认 → 确认后才合并。文件和进度码走同一条路
  const knownIds = () => new Set(Object.values(UNITS).flatMap((u) => u.lessons.map((l) => l.id)));
  const offerImport = (text, source = "文件") => {
    const r = parseImport(text, { knownIds: knownIds() });
    if (!r.ok) { say(r.error, true); return; }
    const sm = summarize(r.state);
    say("");
    panel.replaceChildren(h("div", { class: "confirm", role: "alertdialog", "data-import-confirm": "" },
      h("p", { text: `${source}里有：${sm.lessons} 个已完成关卡，${sm.xp} XP，连续 ${sm.streak} 天${r.exportedAt ? `（${source === "进度码" ? "生成" : "导出"}于 ${r.exportedAt.slice(0, 10)}）` : ""}。导入会把这些合并进当前记录：关卡取并集，XP 取较大的，不会让你现有的进度变少。` }),
      button("确认导入", () => {
        if (blockedByLogin()) return;
        syncFromStorage(state); Object.assign(state, mergeImport(state, r.state)); const saved = persist(); renderMe(); // 就地合并：保留这页的账本绑定，保存时才能发现“别页刚清除过”
        if (saved) { showToast("进度已导入。"); return; }
        if (getLastSaveStatus() === "cleared") { // 清除胜出：不自动重试、不复活旧数据；备份原样保留
          const m3 = document.querySelector("[data-backup-msg]"); if (m3) { m3.textContent = CLEARED_MSG_IMPORT; m3.classList.add("bad"); }
          showToast(CLEARED_MSG_IMPORT); return;
        }
        // 没落盘：不报成功，原存档没有被改动；给重试
        const p2 = document.querySelector(".backup-panel"), m2 = document.querySelector("[data-backup-msg]");
        if (m2) { m2.textContent = "导入的进度现在只显示在这个页面里，还没有保存到本机——请先不要关闭页面（可能是无痕模式或存储已满）。原有的本机记录没有被改动。"; m2.classList.add("bad"); }
        if (p2) p2.replaceChildren(button("重试保存", () => { if (persist()) { p2.replaceChildren(); if (m2) { m2.textContent = "已保存到本机。"; m2.classList.remove("bad"); } showToast("进度已导入。"); } else if (getLastSaveStatus() === "cleared") { p2.replaceChildren(); if (m2) { m2.textContent = CLEARED_MSG_IMPORT; m2.classList.add("bad"); } } }, "btn3d", { "data-import-retry": "" }));
        showToast("导入的进度现在只显示在这个页面里，还没有保存到本机——请先不要关闭页面。");
      }, "btn3d primary"),
      button("取消", () => { panel.replaceChildren(); }, "btn"),
    ));
  };
  file.addEventListener("change", async () => {
    const f = file.files && file.files[0]; file.value = "";
    panel.replaceChildren(); if (!f) return;
    if (blockedByLogin()) return;
    let text = "";
    try { text = await f.text(); } catch { say("读取文件失败。", true); return; }
    offerImport(text);
  });
  // 进度码：一段文字，复制后到别的标签页 / 主屏幕 App 粘贴即可恢复，不用经过“文件”App
  const doCopyCode = async () => {
    let code = "";
    try { const snap = snapshotForBackup(); if (!snap) { say(BACKUP_REFUSED, true); return; } code = encodeCode(snap, { build: typeof __BUILD__ !== "undefined" ? __BUILD__ : "" }); } catch { say("生成进度码失败，请改用“导出进度文件”。", true); return; }
    try {
      await navigator.clipboard.writeText(code);
      say("进度码已复制。到另一个标签页或主屏幕 App 的“我的 → 备份学习记录 → 粘贴进度码”里粘贴即可。");
    } catch {
      const ta = h("textarea", { class: "code-box", readonly: "", rows: "4", "aria-label": "进度码", "data-code-out": "" }); ta.value = code;
      panel.replaceChildren(h("p", { class: "small", text: "这个浏览器不让自动复制：长按下面的文字，选“全选”再“拷贝”。" }), ta);
      ta.focus(); ta.select();
      say("");
    }
  };
  const showPaste = () => {
    if (blockedByLogin()) return;
    const ta = h("textarea", { class: "code-box", rows: "4", placeholder: "把复制的进度码粘贴在这里", "aria-label": "粘贴进度码", "data-code-in": "" });
    panel.replaceChildren(ta, button("读取进度码", () => {
      const d = decodeCode(ta.value);
      if (!d.ok) { say(d.error, true); return; }
      offerImport(d.text, "进度码");
    }, "btn3d", { "data-code-read": "" }));
  };
  return h("section", { class: "backup", "data-backup": "" },
    h("h3", { text: "备份学习记录" }),
    h("p", { class: "small muted", text: signedIn ? "导出本机学习记录，云端状态以上方为准。已登录时不能导入（要导入请先退出登录）。" : "记录只在这台设备上。导出一份文件自己留着，换手机或清了浏览器数据后可以导回来。" }),
    h("div", { class: "acct-row" },
      button("导出进度文件", doExport, "btn3d", { "data-export": "" }),
      signedIn ? null : button("导入进度文件", () => file.click(), "btn3d", { "data-import": "" }),
    ),
    listUnreadable().length ? h("p", { class: "small muted" }, "本机留着一份读不懂的旧记录。普通备份不含它；需要排查时才点：", button("导出诊断文件", () => { if (!exportProgressFile({ diagnostic: true })) say(BACKUP_REFUSED, true); else say("诊断文件已请求下载（含旧记录原文，只发给开发者）。"); }, "link small", { "data-export-diagnostic": "" })) : null,
    h("div", { class: "acct-row" },
      button("复制进度码", doCopyCode, "btn3d", { "data-code-copy": "" }),
      signedIn ? null : button("粘贴进度码", showPaste, "btn3d", { "data-code-paste": "" }),
    ),
    file, panel, msg);
}

function renderMe() {
  currentView = "me";
  currentRun = null;
  const replacedMsg = replacedFor("me");
  let confirmBox = null;
  const clearBtn = button("清除学习记录", () => {
    if (confirmBox) return;
    confirmBox = h("div", { class: "confirm", role: "alertdialog" },
      h("p", { text: "确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。" }),
      button("确定清除", () => { if (clearProgress()) { renderMe(); showToast("学习记录已清除。"); } }, "btn danger"),
      button("取消", () => { confirmBox.remove(); confirmBox = null; }, "btn"),
    );
    clearBtn.after(confirmBox);
  }, "link small");
  const wait = regenHearts(state);
  const doneCount = allLessons().filter((l) => state.done[l.id]).length;
  const statCard = (ic, value, label) => h("div", { class: "me-card" }, h("b", {}, ic ? icon(ic, { size: 20 }) : null, value), h("span", { text: label }));
  appEl.replaceChildren(
    statsBar(),
    h("main", { class: "view me" }, updateNotice(),
      replacedMsg ? h("p", { class: "notice", role: "status", "data-replaced-notice": "", text: replacedMsg }) : null,
      h("div", { class: "me-head" }, mascot(64), h("div", {}, h("h1", { text: "我的学习" }), h("p", { class: "muted", text: sync?.account() ? "记录已关联账号，会同步到云端" : "没登录时，记录只保存在这台设备上" }))),
      h("div", { class: "me-grid" },
        statCard("flame", String(currentStreak(state)), "连续天数"),
        statCard("bolt", String(state.xp), "经验值 XP"),
        statCard(null, `${doneCount}/${allLessons().length}`, "已完成关卡"),
        statCard("heart", `${state.hearts}/${HEARTS_MAX}`, wait ? `${fmtWait(wait)}后 +1` : "红心已满"),
      ),
      accountUi?.accountCard(),
      previewInfo?.card(),
      isIOS && !standalone ? h("section", { class: "notice", role: "note", "data-safari-tip": "" },
        h("b", { text: "你正在 Safari 里学习" }),
        h("p", { class: "small", text: "Safari 可能清理长期不打开的网站数据，无痕浏览里关掉标签就清空。把本页「添加到主屏幕」后记录更稳（主屏幕 App 的记录和 Safari 分开保存）。也建议隔一阵用下面的“导出进度文件”备份一次。" })) : null,
      backupCard(),
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
      sync?.account() ? null : clearBtn,
      h("p", { class: "me-foot" }, h("a", { href: "./privacy.html", target: "_blank", rel: "noopener", "data-privacy-link": "", text: "隐私说明" })),
    ),
    tabBar("me"),
  );
}

// ---------- 做题 ----------
function startLesson(l, { review = false } = {}) {
  currentView = "lesson"; replacedOn = null;
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
  if (l.exercises.some(isCodeTask)) loadCodeTask().catch(() => {}); // 开场页期间提前加载代码题模块
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
      // 顺序（设计 4.11）：概念 + 标题 → 示例代码 → 故事。标题在内容区最上面，矮屏 / 键盘弹出时也看得见。
      h("div", { class: "intro-panel intro-head" },
        h("div", { class: "intro-concept", text: (run.review ? "复习 · " : "") + l.concept }),
        h("h1", { class: "intro-title", text: l.title }),
      ),
      h("div", { class: "intro-screen" }, codeBlock(l.introCode, "phone")),
      h("div", { class: "intro-panel" },
        h("p", { class: "intro-story", text: l.story }),
      ),
    ),
    h("footer", { class: "lessonfoot" }, h("span", { class: "mascot-slot" }, mascot(56)), button("继续", () => renderExercise(run), "btn3d primary grow")),
  );
}

let currentArea = null;
function renderExercise(run) {
  currentArea?.destroy?.(); currentArea = null; // 离开上一道代码题：先把草稿存好
  if (run.queue.length === 0) return renderFinish(run);
  const idx = run.queue[0];
  const ex = run.lesson.exercises[idx];
  if (isCodeTask(ex) && !codeTaskMod) return renderCodeTaskLoading(run, idx);
  window.__app.currentEx = ex; // 给自动测试用
  window.__app.renders = (window.__app.renders || 0) + 1;
  let hintShown = false;
  let submitted = false; // 一道题只能提交一次

  const isCode = isCodeTask(ex); // 写代码 / 改代码题：运行结果和判题结果都在答题区里，没有单独的“运行结果”面板
  const outPanel = isCode ? null : h("details", { class: "outpanel" }, h("summary", { text: "运行结果" }), h("pre", { class: "out", text: "" }));
  const checkBtn = button("检查", () => check(), "btn3d primary grow", { "data-check": "" });
  checkBtn.disabled = true;
  const onChange = () => { if (!submitted) checkBtn.disabled = !area.ready(); };

  // 各题型的答题区，返回 { node, ready(), lock(), mark(), isCorrect(), why(), whyWrong(), code() }
  const area = isCode ? codeTaskMod.createCodeArea(ex, { exec: codeExec, runner, onChange, ui: { sheet, button }, pythonUnavailable: () => (typeof pythonUnavailableText === "function" ? pythonUnavailableText() : undefined) })
    : ex.type === "predict" ? predictArea(ex, onChange)
    : ex.type === "fill" ? fillArea(ex, onChange)
    : orderArea(ex, onChange);
  currentArea = isCode ? area : null;
  window.__app.currentArea = area;

  const helpBtn = button(mascot(56, "think"), () => {
    if (area.openHint) return area.openHint(); // 代码题：两级提示，最后才是参考解法
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
    ...(area.after ? [area.after] : []), // 只有代码题有内置键盘；其他题型没有，不能把 undefined 当文字显示出来
  );

  function check() {
    if (submitted || checkBtn.disabled) return; // 重复点击不会二次计分
    if (isCode) return checkCode();
    settleAnswer(area.isCorrect(), false);
  }

  // 代码题：先真的运行判题，只有 pass / fail 且结果完整才结算；超时、输出超限、环境不可用、内部错误、取消都不算作答
  let checking = false;
  async function checkCode() {
    if (checking) return;
    checking = true;
    checkBtn.disabled = true;
    checkBtn.textContent = "检查中…";
    feel.haptic(); // 必须在用户点击的这一刻请求
    let r;
    try { r = await area.check(); } finally { checking = false; }
    if (!checkBtn.isConnected || submitted) return; // 这期间已经离开了这道题
    if (r.attempt && r.settle) settleAnswer(r.status === "pass", true);
    else { checkBtn.textContent = "检查"; checkBtn.disabled = !area.ready(); }
  }

  function settleAnswer(ok, asyncHaptic) {
    submitted = true;
    // ---- 0 ms：提交并锁定，计分只发生这一次 ----
    checkBtn.disabled = true;
    checkBtn.textContent = "检查中";
    area.lock();
    if (!asyncHaptic) feel.haptic(); // 必须在用户点击的这一刻请求（代码题已在点击时请求过）
    area.settled?.(ok);
    const reduce = feel.reducedMotion();
    if (ok) {
      run.correct++;
      const gain = run.review ? XP_REVIEW : XP_CORRECT;
      run.xp += gain; addXp(state, gain, run.lesson?.id, !run.review); persist();
    } else {
      run.mistakes++;
      if (!run.review) { loseHeart(state); persist(); }
      run.queue.push(idx); // 错题放到最后再做
    }
    run.queue.shift();
    const reason = ok ? area.why() : area.whyWrong();
    const outOfHearts = !ok && !run.review && state.hearts <= 0;

    // 显示真实运行结果：选输出题跑原程序，其他题跑你拼出来的程序
    if (!isCode) showRun(outPanel, ex.type === "predict" ? ex.code : area.code());

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
      !ok && !isCode ? h("p", { class: "fb-answer" }, "正确答案：", h("code", { text: correctAnswerText(ex) })) : null,
      !ok && !run.review ? h("p", { class: "fb-heart" }, icon("heart", { size: 16 }), `红心 -1（剩 ${state.hearts} 颗）。这道题稍后再做一次。`) : null,
      contBtn,
    );

    // ---- 120 ms：揭示结果 ----
    setTimeout(() => {
      if (!checkBtn.isConnected) return; // 这期间已经离开了这道题，旧回调什么也不做
      area.mark();
      feel.play(ok ? "correct" : "wrong");
      appEl.querySelector(".lessonfoot").replaceWith(fb);
      area.afterFeedback?.();
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

// 代码题模块还没加载完：先显示“正在加载”，加载好后再画这道题；加载失败（比如离线且没有缓存）就如实提示并给“重试”
function renderCodeTaskLoading(run, idx) {
  const msg = h("p", { class: "muted", role: "status", text: "正在加载代码题…" });
  appEl.replaceChildren(circuit("edge"), lessonHeader(run), h("main", { class: "lesson" }, msg));
  const still = () => currentRun === run && run.queue[0] === idx && msg.isConnected;
  loadCodeTask().then(() => { if (still()) renderExercise(run); }, () => {
    if (!still()) return;
    // “重试”先在本页再加载一次（Safari 可以）；Chrome 会记住同一页面里失败的模块导入，再失败就重新加载页面
    msg.textContent = "代码题没有加载成功（可能是网络问题）。联网后点“重试”。";
    const retry = button("重试", () => loadCodeTask().then(() => { if (currentRun === run && run.queue[0] === idx) renderExercise(run); }, () => {
      // 不自动刷新页面（刷新会丢掉这一关的进度）。Chrome 会记住同一页面里失败的模块导入，所以再失败时由用户自己决定要不要重新加载页面
      if (!still() || document.querySelector("[data-reload-page]")) return;
      msg.textContent = "还是没有加载成功。你可以稍后再点“重试”；或者重新加载页面：这一关会从第 1 题重新开始，已得的 XP 会保留。";
      retry.after(button("重新加载页面", () => location.reload(), "btn small", { "data-reload-page": "" }));
    }), "btn small", { "data-retry-code-task": "" });
    msg.after(retry);
  });
}

function correctAnswerText(ex) {
  if (ex.type === "predict") return ex.options.find((o) => o.correct).text;
  if (ex.type === "fill") { let c = ex.code; ex.answer.forEach((t, i) => (c = c.replace(`{${i}}`, t))); return c; }
  return ex.answers[0].map((k) => ex.lines[k]).join("\n");
}

// 选项排法（D5，产品官 2026-11-11 18:07）：含代码或多行输出的题，整组选项单列、保留原有换行和缩进、过长在选项内横滚；普通文字三列、自然折行。
// 只按题型和明确标记判断，不从括号、引号等字符猜：
//   选输出题（predict）：选项是屏幕上的原样输出 → 代码排法；
//   pick：key 为 line（选代码行）、stdout（选输出）、fix（选改法，含代码）→ 代码排法；key 为 type（选原因，文字）→ 文字排法；
//   题目可用 "optionLayout": "code" | "text" 明确指定，优先于上面的默认。
const CODE_PICK_KEYS = new Set(["line", "stdout", "fix"]);
function optionLayout(ex) {
  if (ex.optionLayout === "code" || ex.optionLayout === "text") return ex.optionLayout;
  if (ex.type === "predict") return "code";
  if (ex.type === "pick") return CODE_PICK_KEYS.has(ex.key) ? "code" : "text";
  return "text";
}
function choiceLabel(text, layout) {
  return layout === "code" ? h("span", { class: "opt-scroll" }, h("pre", { text })) : h("pre", { text });
}

// 选输出题
function predictArea(ex, onChange) {
  let picked = null; let locked = false;
  const layout = optionLayout(ex);
  const opts = h("div", { class: `choices ${layout}`, "data-layout": layout }, ex.options.map((o, i) => {
    const b = button(choiceLabel(o.text, layout), () => {
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
  addRun(state);
  const bonus = run.review ? 0 : XP_FINISH;
  run.xp += bonus; addXp(state, bonus, l.id, !run.review);
  const newDay = bumpStreak(state);
  if (firstTime && state.lastDay) state.doneOn = { ...(state.doneOn ?? {}), [l.id]: state.lastDay }; // 完成日期 = 刚记的学习日
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
  currentView = "practice"; replacedOn = null;
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
// 回到前台 / 从后退缓存恢复 / 别的标签页改了存储：先把存储里更新的进度读进来，再写，避免旧标签页把新进度盖掉
function refreshFromStorage() {
  if (sync && sync.account()) return;
  const changed = syncFromStorage(state);
  if (changed && currentView === "path" && appEl.querySelector(".statsbar")) renderPath();
  else if (changed && currentView === "me" && appEl.querySelector(".statsbar")) renderMe();
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && appEl.querySelector(".statsbar")) { refreshFromStorage(); regenHearts(state); persist(); appEl.querySelector(".statsbar")?.replaceWith(statsBar()); } });
window.addEventListener("pageshow", (e) => { if (e.persisted) refreshFromStorage(); });
window.addEventListener("storage", (e) => { if (e.key && e.key.includes("suipian.v4.")) refreshFromStorage(); }); // 测试入口里键带前缀，所以用 includes

window.__app = { clearProgress, addXp: (a, id, f) => addXp(state, a, id, f), addRun: () => addRun(state), syncFromStorage: () => syncFromStorage(state), allLessons, startLesson, sync, accountUi, sheet, LIMITS, pythonUnavailableText, swInfo, refreshSwInfo, keysounds: () => import("./keysounds.js"), runner, getState: () => state, setState: (s) => { state = s; feel.setPrefs(s.prefs); }, persist, renderPath, words, feel, getRun: () => currentRun, getPractice: () => currentPractice };
// ---------- 离线支持（Service Worker）----------
// 联网打开一次后，应用外壳和课程内容会缓存在本机，断网也能进入地图和做点选题。Pyodide 不缓存，离线时 Python 运行结果显示提示。
async function refreshSwInfo() {
  if (!("serviceWorker" in navigator)) { swInfo.status = "此浏览器不支持"; return swInfo; }
  try {
    swInfo.caches = typeof caches !== "undefined" ? (await caches.keys()).filter((k) => k.startsWith("suipian-")) : [];
    swInfo.status = navigator.serviceWorker.controller ? "已启用（断网后可打开地图和课程）" : (swReg ? "正在安装，刷新一次后生效" : "未启用");
  } catch { swInfo.status = "读取失败"; }
  return swInfo;
}
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  let hadController = !!navigator.serviceWorker.controller; // 第一次访问时先由第一次安装接管（不是更新）；之后同一页面再收到更新要能正常处理
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    refreshSwInfo();
    if (!hadController) { hadController = true; return; } // 第一次安装接管，不是更新
    // 只有用户在地图 / “我的”页点了“现在更新”，并且此刻不在答题中，才刷新页面；其他情况（别的标签页更新了、答题中）一律不刷新，只提示
    if (updateRequestedByUser && !inLesson()) {
      if (persist()) { location.reload(); return; } // 刷新前再核验一次保存；失败就不刷新
      showToast("新版本已就绪，但进度没能保存到本机，所以没有刷新页面。保存成功后再刷新即可使用最新内容。"); return;
    }
    showToast("已更新到新版本。当前这一关不受影响，退出这一关后刷新页面即可使用最新内容。");
  });
  const watchUpdate = (reg) => {
    const check = () => { if (reg.waiting && navigator.serviceWorker.controller) { updateReady = true; renderCurrentSafe(); } };
    const track = (w) => { if (!w) return; if (w.state === "installed") check(); else w.addEventListener("statechange", () => { if (w.state === "installed") check(); }); };
    check(); track(reg.installing); // 页面加载时新版可能已经在安装中
    reg.addEventListener("updatefound", () => track(reg.installing));
  };
  const register = () => navigator.serviceWorker.register("./sw.js").then((reg) => { swReg = reg; watchUpdate(reg); refreshSwInfo(); }).catch((e) => { swInfo.status = "注册失败：" + (e?.message || e); });
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
firstSeenAt(); recordLoad(); ensureBackupBase(Object.keys(state.done).length, Date.now(), stateEpoch(state)); ensurePersist(); // 记下这份存储的首次使用时间；申请持久存储（失败不影响使用）
// Python（约 13 MB）不再在打开应用时下载：第一次真正要执行时才加载——runForOutput（答题后的“运行结果”）、判题执行器（judge.js 的 ensureReady）、代码题答题区。
// 加载失败时 runner 记录为 loadError，“运行结果”面板如实提示并给“重试”；恢复网络后（上面的 online 监听）只会重试已经失败过的加载，不会替没用到 Python 的人提前下载。
