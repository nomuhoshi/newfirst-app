// 碎片编程：多邻国式关卡学习。
// 首页是关卡地图；每关 = 故事开场 + 4 道点选题（选输出 / 点词块填空或修程序 / 排顺序）。
// 答错扣红心、错题放到最后再做；答对加 XP；每天完成一关续上连续天数。
import "./style.css";
import "./app.css";
import "./game.css";
import course from "../content/course.json";
import unit1 from "../content/unit1.json";
import words from "../content/words.json";
import { Runner } from "./runner.js";
import { describeError } from "./errors.js";
import { onActivate } from "./activate.js";
import {
  loadState, saveState, clearState, regenHearts, loseHeart, bumpStreak, currentStreak, HEARTS_MAX,
} from "./storage.js";

const UNITS = { U1: unit1 };
const XP_CORRECT = 10;
const XP_REVIEW = 5;
const XP_FINISH = 10;

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
  onActivate(b, (e) => { if (!b.disabled) fn(e); });
  return b;
}
const svgNS = "http://www.w3.org/2000/svg";
function svg(tag, attrs, ...kids) {
  const el = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  kids.forEach((k) => el.append(k));
  return el;
}

// 默认吉祥物“小码”：圆角方块 + 两只眼睛 + >_ 嘴巴（以后可以换成正式设计）
function mascot(size = 96, mood = "happy") {
  const s = svg("svg", { viewBox: "0 0 100 100", width: size, height: size, class: "mascot", "aria-hidden": "true" },
    svg("defs", {}, svg("linearGradient", { id: "mg", x1: "0", y1: "0", x2: "0", y2: "1" },
      svg("stop", { offset: "0", "stop-color": "#7c6cff" }), svg("stop", { offset: "1", "stop-color": "#4fb3ff" }))),
    svg("rect", { x: "8", y: "12", width: "84", height: "78", rx: "26", fill: "url(#mg)" }),
    svg("circle", { cx: "36", cy: "44", r: "9", fill: "#fff" }), svg("circle", { cx: "64", cy: "44", r: "9", fill: "#fff" }),
    svg("circle", { cx: mood === "sad" ? "36" : "38", cy: mood === "sad" ? "47" : "45", r: "4", fill: "#1b1b2f" }),
    svg("circle", { cx: mood === "sad" ? "64" : "66", cy: mood === "sad" ? "47" : "45", r: "4", fill: "#1b1b2f" }),
    svg("text", { x: "50", y: "75", "text-anchor": "middle", "font-size": "18", "font-family": "Menlo, monospace", "font-weight": "700", fill: "#fff" }, document.createTextNode(mood === "sad" ? "> ._" : ">_")),
  );
  return s;
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

// ---------- Python 运行（显示“运行结果”用） ----------
const appEl = document.getElementById("app");
const listeners = new Set();
const runner = new Runner({
  onStatus(s, info) { for (const l of [...listeners]) l.status?.(s, info); },
  onOutput(t) { for (const l of [...listeners]) l.output?.(t); },
});
function runForOutput(code) {
  return new Promise((resolve) => {
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
    if (runner.state === "loadError") runner.boot();
    const w = { status: (s) => {
      if (s === "ready") { listeners.delete(w); go(); }
      else if (s === "loadError") { listeners.delete(w); resolve(null); }
    } };
    listeners.add(w);
  });
}

// ---------- 通用浮层 / 提示 ----------
function sheet(content, { onClose, cls = "" } = {}) {
  const close = () => { wrap.remove(); onClose?.(); };
  const openedAt = Date.now();
  const wrap = h("div", { class: "overlay " + cls, role: "dialog", "aria-modal": "true" }, h("div", { class: "sheet" }, content(close)));
  wrap.addEventListener("click", (e) => { if (e.target === wrap && Date.now() - openedAt > 800) close(); });
  document.body.append(wrap);
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
    { text: "你好，我是小码！", sub: "" },
    { text: "我会陪你一关一关学 Python。", sub: "每关只要两三分钟，全部用点的，不用打字。" },
    { text: "卡住了就点我，我会给你提示。", sub: "做题时我在左下角。" },
  ];
  const s = steps[i];
  appEl.replaceChildren(h("main", { class: "onboard" },
    h("div", { class: "onboard-mid" }, mascot(120), h("h1", { text: s.text }), s.sub ? h("p", { text: s.sub }) : null),
    h("div", { class: "onboard-dots" }, steps.map((_, k) => h("span", { class: k === i ? "on" : "" }))),
    button(i < steps.length - 1 ? "继续" : "开始学习", () => {
      if (i < steps.length - 1) renderOnboarding(i + 1);
      else { state.onboarded = true; persist(); renderPath(); }
    }, "btn3d primary wide"),
  ));
}

// ---------- 顶部状态栏 ----------
function statsBar() {
  const wait = regenHearts(state);
  const hearts = h("span", { class: "stat hearts", title: wait ? `下一颗红心：${fmtWait(wait)}后` : "红心已满", "aria-label": `红心 ${state.hearts}` }, "❤️ ", String(state.hearts));
  return h("header", { class: "statsbar" },
    h("span", { class: "stat streak", "aria-label": `连续 ${currentStreak(state)} 天` }, "🔥 ", String(currentStreak(state))),
    h("span", { class: "stat xp", "aria-label": `经验值 ${state.xp}` }, "⚡ ", String(state.xp)),
    hearts,
  );
}
function tabBar(active) {
  return h("nav", { class: "tabbar" },
    button(h("span", {}, "🏠", h("small", { text: "学习" })), renderPath, "tab" + (active === "path" ? " on" : ""), { "aria-label": "学习" }),
    button(h("span", {}, "👤", h("small", { text: "我的" })), renderMe, "tab" + (active === "me" ? " on" : ""), { "aria-label": "我的" }),
  );
}

// ---------- 关卡地图 ----------
function renderPath() {
  regenHearts(state);
  const units = course.units.map((u) => {
    if (!u.available) {
      return h("section", { class: "unit locked" }, h("div", { class: "unit-banner" },
        h("div", { class: "unit-no", text: `第 ${course.units.indexOf(u) + 1} 单元 · 即将推出` }), h("h2", { text: u.title }), h("p", { text: u.subtitle })));
    }
    const lessons = UNITS[u.id].lessons;
    return h("section", { class: "unit" },
      h("div", { class: "unit-banner" }, h("div", { class: "unit-no", text: `第 ${course.units.indexOf(u) + 1} 单元` }), h("h2", { text: u.title }), h("p", { text: u.subtitle })),
      h("ol", { class: "path" }, lessons.map((l, i) => {
        const st = lessonStatus(l);
        const offset = [0, 1, 2, 1, 0, -1][i % 6];
        const node = button(
          h("span", { class: "node-face", "aria-hidden": "true" }, st === "done" ? "✓" : st === "locked" ? "🔒" : l.review ? "🏆" : "★"),
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
    statsBar(),
    h("main", { class: "view pathview" }, notice ? h("p", { class: "notice", role: "status", text: notice }) : null, units),
    tabBar("path"),
  );
  notice = null;
  // 当前关卡滚到可见
  appEl.querySelector(".node.current")?.scrollIntoView({ block: "center" });
}

function openLessonSheet(l) {
  const st = lessonStatus(l);
  sheet((close) => [
    h("div", { class: "lsheet" },
      h("div", { class: "lsheet-concept", text: l.concept }),
      h("h2", { text: l.title }),
      h("p", { text: st === "locked" ? "先完成前面的关卡，这一关才会解锁。" : l.story }),
      st === "locked" ? button("知道了", close, "btn3d wide")
        : st === "done" ? [button("复习（不扣红心，完成后 +1 ❤️）", () => { close(); startLesson(l, { review: true }); }, "btn3d primary wide"), button("关闭", close, "btn3d ghost wide")]
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
      mascot(72, "sad"),
      h("h2", { text: "红心用完了" }),
      h("p", { text: `每 30 分钟恢复 1 颗，下一颗还要 ${fmtWait(wait)}。也可以做一关复习：复习不扣红心，完成后恢复 1 颗。` }),
      button(`复习「${practice.title}」`, () => { close(); startLesson(practice, { review: true }); }, "btn3d primary wide"),
      button("稍后再来", close, "btn3d ghost wide"),
    ),
  ]);
}

// ---------- 我的 ----------
function renderMe() {
  let confirmBox = null;
  const clearBtn = button("清除学习记录", () => {
    if (confirmBox) return;
    confirmBox = h("div", { class: "confirm", role: "alertdialog" },
      h("p", { text: "确定要清除这台设备上的全部学习记录吗？XP、连续天数和关卡进度都会清空。" }),
      button("确定清除", () => { state = clearState(); state.onboarded = true; persist(); renderMe(); showToast("学习记录已清除。"); }, "btn danger"),
      button("取消", () => { confirmBox.remove(); confirmBox = null; }, "btn"),
    );
    clearBtn.after(confirmBox);
  }, "link small");
  const wait = regenHearts(state);
  const doneCount = allLessons().filter((l) => state.done[l.id]).length;
  appEl.replaceChildren(
    statsBar(),
    h("main", { class: "view me" },
      h("div", { class: "me-head" }, mascot(64), h("div", {}, h("h1", { text: "我的学习" }), h("p", { class: "muted", text: "记录只保存在这台设备上" }))),
      h("div", { class: "me-grid" },
        h("div", { class: "me-card" }, h("b", { text: `🔥 ${currentStreak(state)}` }), h("span", { text: "连续天数" })),
        h("div", { class: "me-card" }, h("b", { text: `⚡ ${state.xp}` }), h("span", { text: "经验值 XP" })),
        h("div", { class: "me-card" }, h("b", { text: `${doneCount}/${allLessons().length}` }), h("span", { text: "已完成关卡" })),
        h("div", { class: "me-card" }, h("b", { text: `❤️ ${state.hearts}/${HEARTS_MAX}` }), h("span", { text: wait ? `${fmtWait(wait)}后 +1` : "红心已满" })),
      ),
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
  renderIntro(run);
}

function lessonHeader(run) {
  const pct = Math.round((run.correct / run.total) * 100);
  return h("header", { class: "lessonbar" },
    button("✕", () => confirmExit(run), "icon-btn ghost", { "aria-label": "退出本关" }),
    h("div", { class: "progress", role: "progressbar", "aria-valuenow": String(pct), "aria-valuemin": "0", "aria-valuemax": "100" }, h("div", { class: "progress-fill", style: `width:${Math.max(4, pct)}%` })),
    run.review ? h("span", { class: "stat", title: "复习不扣红心" }, "🛡️") : h("span", { class: "stat hearts", "aria-label": `红心 ${state.hearts}` }, "❤️ ", String(state.hearts)),
  );
}

function confirmExit(run) {
  sheet((close) => [h("div", { class: "lsheet" },
    h("h2", { text: "要退出这一关吗？" }),
    h("p", { text: "退出后，本关的答题进度不会保存（XP 和红心变化会保留）。" }),
    button("继续学习", close, "btn3d primary wide"),
    button("退出", () => { close(); renderPath(); }, "btn3d danger-ghost wide"),
  )]);
}

function renderIntro(run) {
  const l = run.lesson;
  appEl.replaceChildren(
    lessonHeader(run),
    h("main", { class: "lesson" },
      h("div", { class: "intro-screen" }, codeBlock(l.introCode, "phone")),
      h("div", { class: "intro-concept", text: (run.review ? "复习 · " : "") + l.concept }),
      h("h1", { class: "intro-title", text: l.title }),
      h("p", { class: "intro-story", text: l.story }),
    ),
    h("footer", { class: "lessonfoot" }, h("span", { class: "mascot-slot" }, mascot(56)), button("继续", () => renderExercise(run), "btn3d primary grow")),
  );
}

function renderExercise(run) {
  if (run.queue.length === 0) return renderFinish(run);
  const idx = run.queue[0];
  const ex = run.lesson.exercises[idx];
  window.__app.currentEx = ex; // 给自动测试用
  let hintShown = false;

  const outPanel = h("details", { class: "outpanel" }, h("summary", { text: "运行结果" }), h("pre", { class: "out", text: "" }));
  const checkBtn = button("检查", () => check(), "btn3d primary grow", { "data-check": "" });
  checkBtn.disabled = true;

  // 各题型的答题区，返回 { node, answer(), ready(), describe() }
  const area = ex.type === "predict" ? predictArea(ex, () => (checkBtn.disabled = !area.ready()))
    : ex.type === "fill" ? fillArea(ex, () => (checkBtn.disabled = !area.ready()))
    : orderArea(ex, () => (checkBtn.disabled = !area.ready()));

  const helpBtn = button(mascot(56), () => {
    const text = hintShown || !ex.hint ? correctAnswerText(ex) : ex.hint;
    const title = hintShown || !ex.hint ? "答案是：" : "小码提示：";
    hintShown = true;
    sheet((close) => [h("div", { class: "lsheet hint" }, h("div", { class: "hint-row" }, mascot(48), h("b", { text: title })), h("pre", { class: "hint-text", text }), button("好的", close, "btn3d primary wide"))]);
  }, "mascot-btn", { "aria-label": "让小码给个提示" });

  appEl.replaceChildren(
    lessonHeader(run),
    h("main", { class: "lesson" },
      ex.tip ? h("p", { class: "tip-line", text: "💡 " + ex.tip }) : null,
      h("h2", { class: "q", text: ex.prompt }),
      area.node,
      outPanel,
    ),
    h("footer", { class: "lessonfoot" }, helpBtn, checkBtn),
  );

  function check() {
    checkBtn.disabled = true;
    area.lock();
    const ok = area.isCorrect();
    // 显示真实运行结果：选输出题跑原程序，其他题跑你拼出来的程序
    const code = ex.type === "predict" ? ex.code : area.code();
    const pre = outPanel.querySelector("pre");
    pre.textContent = "运行中…";
    outPanel.open = true;
    runForOutput(code).then((r) => {
      if (!r) { pre.textContent = "（Python 还没加载好，暂时看不到运行结果）"; return; }
      pre.textContent = r.error ? (r.out ? r.out + "\n" : "") + describeError(r.error) : (r.out || "程序运行完成，没有输出");
      pre.className = "out" + (r.error ? " error" : "");
    });

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
    const fb = h("div", { class: "feedbar " + (ok ? "ok" : "bad"), role: "status" },
      h("div", { class: "fb-head" }, h("b", { text: ok ? "答对了！" : "不对哦" }), ok ? h("span", { class: "fb-xp", text: `+${run.review ? XP_REVIEW : XP_CORRECT} XP` }) : null),
      reason ? h("p", { text: reason }) : null,
      !ok ? h("p", { class: "fb-answer" }, "正确答案：", h("code", { text: correctAnswerText(ex) })) : null,
      !ok && !run.review ? h("p", { class: "fb-heart", text: `❤️ -1（剩 ${state.hearts} 颗）。这道题稍后再做一次。` }) : null,
      button(outOfHearts ? "红心用完了" : "继续", () => {
        if (outOfHearts) { renderPath(); openNoHearts(run.lesson); return; }
        renderExercise(run);
      }, "btn3d " + (ok ? "primary" : "danger") + " wide", { "data-continue": "" }),
    );
    appEl.querySelector(".lessonfoot").replaceWith(fb);
    appEl.querySelector(".lessonbar").replaceWith(lessonHeader(run));
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
      opts.querySelectorAll(".choice").forEach((x, k) => x.classList.toggle("sel", k === i));
      onChange();
    }, "choice", { "aria-label": `选项：${o.text.replace(/\n/g, " 换行 ")}` });
    return b;
  }));
  return {
    node: h("div", {}, codeBlock(ex.code), opts),
    ready: () => picked !== null,
    lock: () => { locked = true; opts.querySelectorAll(".choice").forEach((x, k) => { if (ex.options[k].correct) x.classList.add("right"); else if (k === picked) x.classList.add("wrong"); }); },
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
  const codeEl = h("div", { class: "codeblock fill" });
  const bank = h("div", { class: "bank" });
  const render = () => {
    codeEl.replaceChildren(...ex.code.split("\n").map((line, li) => {
      const parts = line.split(/(\{\d+\})/);
      return h("div", { class: "cl" }, h("span", { class: "ln", text: String(li + 1) }), h("span", { class: "lc" }, parts.flatMap((p) => {
        const m = /^\{(\d+)\}$/.exec(p);
        if (!m) return codeLine(p);
        const k = Number(m[1]);
        return button(slots[k] ?? "", () => { if (!locked) { active = k; render(); } },
          "slot" + (slots[k] ? " filled" : "") + (k === active && !locked ? " active" : ""), { "aria-label": `空格 ${k + 1}：${slots[k] || "空"}`, "data-slot": String(k) });
      })));
    }));
    bank.replaceChildren(
      h("div", { class: "bank-ctrl" },
        button("⌫", () => { if (!locked) { slots[active] = null; render(); onChange(); } }, "kchip ctrl", { "aria-label": "清空当前空格" }),
        button("‹", () => { if (!locked) { active = Math.max(0, active - 1); render(); } }, "kchip ctrl", { "aria-label": "上一个空格" }),
        button("›", () => { if (!locked) { active = Math.min(n - 1, active + 1); render(); } }, "kchip ctrl", { "aria-label": "下一个空格" }),
      ),
      h("div", { class: "bank-tokens" }, ex.tokens.map((t) => button(t, () => {
        if (locked) return;
        slots[active] = t;
        const nextEmpty = slots.findIndex((s) => s === null);
        if (nextEmpty !== -1) active = nextEmpty;
        render(); onChange();
      }, "kchip tok", { "data-token": t }))),
    );
  };
  render();
  const reset = button("↺ 重新开始", () => { if (!locked) { slots = ex.initial ? [...ex.initial] : Array(n).fill(null); active = 0; render(); onChange(); } }, "link small reset");
  const code = () => { let c = ex.code; slots.forEach((t, i) => (c = c.replace(`{${i}}`, t ?? ""))); return c; };
  const wrongToken = () => slots.find((t, i) => t !== ex.answer[i]);
  return {
    node: h("div", {}, codeEl, bank, reset),
    ready: () => slots.every((s) => s !== null) && !(ex.initial && slots.every((s, i) => s === ex.initial[i])),
    lock: () => { locked = true; render(); },
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
      if (locked) return; chosen.splice(i, 1); render(); onChange();
    }, "line-chip in", { "data-line": String(k) })) : [h("p", { class: "muted order-empty", text: "点下面的代码行，按顺序放到这里" })]));
    bank.replaceChildren(...ex.shuffled.filter((k) => !chosen.includes(k)).map((k) => button(h("span", {}, codeLine(ex.lines[k])), () => {
      if (locked) return; chosen.push(k); render(); onChange();
    }, "line-chip", { "data-line": String(k) })));
  };
  render();
  const reset = button("↺ 重新开始", () => { if (!locked) { chosen = []; render(); onChange(); } }, "link small reset");
  const code = () => chosen.map((k) => ex.lines[k]).join("\n");
  const answerTexts = ex.answers.map((a) => a.map((k) => ex.lines[k]).join("\n"));
  return {
    node: h("div", {}, h("div", { class: "order-label", text: "你的程序" }), mine, h("div", { class: "order-label", text: "代码行" }), bank, reset),
    ready: () => chosen.length === ex.lines.length,
    lock: () => { locked = true; },
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
  const accuracy = Math.round((run.total / (run.total + run.mistakes)) * 100);
  appEl.replaceChildren(
    h("main", { class: "finish" },
      mascot(120),
      h("h1", { text: run.mistakes === 0 ? "完美！" : "完成！" }),
      h("p", { class: "muted", text: firstTime ? `「${l.title}」通关` : `复习「${l.title}」完成` }),
      h("div", { class: "finish-stats" },
        h("div", { class: "fs" }, h("small", { text: "本关 XP" }), h("b", { text: `+${run.xp}` })),
        h("div", { class: "fs" }, h("small", { text: "正确率" }), h("b", { text: `${accuracy}%` })),
        h("div", { class: "fs" }, h("small", { text: "连续天数" }), h("b", { text: `🔥 ${currentStreak(state)}` })),
      ),
      newDay ? h("p", { class: "streak-msg", text: currentStreak(state) > 1 ? `连续学习 ${currentStreak(state)} 天，保持住！` : "今天的学习完成了，明天再来续上连续天数！" }) : null,
      heartMsg ? h("p", { class: "heart-msg", text: heartMsg }) : null,
      button("继续", renderPath, "btn3d primary wide", { "data-continue": "" }),
    ),
  );
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

window.__app = { runner, getState: () => state, setState: (s) => { state = s; }, persist, renderPath, words };
runner.boot(); // 后台加载 Python，用来显示真实运行结果
if (state.onboarded) renderPath(); else renderOnboarding();
