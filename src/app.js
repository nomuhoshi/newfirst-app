// 碎片编程：第 2 步 —— N01 一节完整的课。
// 流程：首页 → 3 张讲解卡 → 3 道练习 → 小任务（看过答案则加一道变化题）→ 完成页。
import "./style.css";
import "./app.css";
import lesson from "../content/n01.json";
import words from "../content/words.json";
import { EditorView } from "@codemirror/view";
import { EditorSelection } from "@codemirror/state";
import { createEditor, setSystemKeyboard } from "./editor.js";
import { createKeyboard } from "./keyboard.js";
import { Runner } from "./runner.js";
import { describeError } from "./errors.js";
import { checkOutput, explainForBeginner } from "./checker.js";
import { onActivate } from "./activate.js";
import { loadState, saveState, clearState } from "./storage.js";

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
  onActivate(b, fn);
  return b;
}

// ---------- 状态与保存 ----------
const loaded = loadState();
let state = loaded.state;
let notice = loaded.notice;
function persist() {
  if (!saveState(state)) showToast("无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。");
}

// ---------- 课程步骤 ----------
const STEPS = [
  ...lesson.cards.map((card, i) => ({ kind: "card", card, i })),
  ...lesson.exercises.map((ex, i) => ({ kind: ex.type, ex, i })),
  { kind: "code", ex: lesson.task, isTask: true },
  { kind: "code", ex: lesson.taskVariant, isVariant: true },
  { kind: "summary" },
];
const skip = (i) => STEPS[i]?.isVariant && !state.needVariant;
function stepLabel(s) {
  if (s.kind === "card") return `讲解 ${s.i + 1}/${lesson.cards.length}`;
  if (s.isTask) return "小任务";
  if (s.isVariant) return "小任务 · 变化";
  if (s.kind === "summary") return "完成";
  return `练习 ${s.i + 1}/${lesson.exercises.length}`;
}

// ---------- Python 运行 ----------
const appEl = document.getElementById("app");
let pyState = "loading";
const listeners = new Set();
const runner = new Runner({
  onStatus(s, info) {
    if (s === "loading") pyState = "loading";
    else if (s === "ready") pyState = "ready";
    else if (s === "loadError" || s === "slowLoad") pyState = s;
    updatePyBadge();
    for (const l of [...listeners]) l.status?.(s, info);
  },
  onOutput(t) { for (const l of [...listeners]) l.output?.(t); },
});

function waitReady() {
  if (runner.state === "ready") return Promise.resolve(true);
  if (runner.state === "loadError") runner.boot();
  return new Promise((resolve) => {
    const l = { status: (s) => {
      if (s === "ready") { listeners.delete(l); resolve(true); }
      else if (s === "loadError") { listeners.delete(l); resolve(false); }
    } };
    listeners.add(l);
  });
}

// 执行一段代码，把输出实时显示在 outEl 里；返回 { status, out, error }
async function execCode(code, outEl, statusEl) {
  outEl.className = "out";
  if (runner.state !== "ready") {
    statusEl.textContent = "Python 还在加载，请稍等…";
    const ok = await waitReady();
    if (!ok) { statusEl.textContent = "Python 加载失败，请检查网络后再试。"; return { status: "loadError" }; }
  }
  outEl.textContent = "";
  statusEl.textContent = "运行中…";
  return new Promise((resolve) => {
    let out = "";
    const l = {
      output: (t) => { out += t; outEl.textContent += t; },
      status: (s, info) => {
        if (!["done", "timeout", "stopped", "outputLimit", "outputLimitStopped"].includes(s)) return;
        listeners.delete(l);
        if (s === "done" && info.error) {
          outEl.textContent += (out ? "\n" : "") + describeError(info.error);
          outEl.className = "out error";
          statusEl.textContent = "运行出错";
        } else if (s === "done") {
          if (!out) { outEl.textContent = "程序运行完成，没有输出"; outEl.className = "out muted"; }
          statusEl.textContent = "运行成功";
        } else if (s === "timeout") {
          outEl.textContent += "\n⏱ 运行超过 5 秒，已自动停止。"; outEl.className = "out error"; statusEl.textContent = "已停止";
        } else if (s === "stopped") {
          outEl.textContent += "\n■ 已停止。"; statusEl.textContent = "已停止";
        } else {
          outEl.textContent += "\n⚠ 输出超过 100 行或 8 KB，已停止。"; outEl.className = "out error"; statusEl.textContent = "已停止";
        }
        resolve({ status: s, out, error: info && info.error });
      },
    };
    listeners.add(l);
    if (!runner.run(code)) { listeners.delete(l); statusEl.textContent = "正在运行上一段代码，请稍候"; resolve({ status: "busy" }); }
  });
}

// ---------- 顶栏、浮层、提示 ----------
let pyBadge;
function updatePyBadge() {
  if (!pyBadge) return;
  pyBadge.replaceChildren();
  if (pyState === "ready") pyBadge.append("Python 已就绪");
  else if (pyState === "loading") pyBadge.append("Python 加载中…");
  else pyBadge.append("Python 加载失败 ", button("重试", () => runner.boot(), "link"));
  pyBadge.dataset.state = pyState;
}

function topbar(title, { back } = {}) {
  pyBadge = h("span", { class: "py-badge", role: "status" });
  updatePyBadge();
  return h("header", { class: "topbar" },
    back ? button("‹ 首页", back, "link top-back", { "aria-label": "回到首页" }) : h("span", { class: "brand", text: "碎片编程" }),
    h("span", { class: "top-title", text: title }),
    pyBadge,
    button("?", openHelp, "icon-btn", { "aria-label": "帮助" }),
  );
}

function openOverlay(title, bodyNodes, onClose) {
  const close = () => { overlay.remove(); onClose?.(); };
  const overlay = h("div", { class: "overlay", role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sheet" },
      h("div", { class: "sheet-head" }, h("h2", { text: title }), button("关闭", close, "btn small", { "data-close": "" })),
      h("div", { class: "sheet-body" }, bodyNodes),
    ),
  );
  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  document.body.append(overlay);
  overlay.querySelector("[data-close]").focus();
  return close;
}

function wordChip(key) {
  return button(`${key} · Meaning`, () => openWord(key), "chip", { "aria-label": `查看 ${key} 的词义` });
}
function openWord(key) {
  const w = words[key];
  openOverlay(`词义：${w.word}`, [
    h("p", { class: "word-big" }, h("code", { text: w.word }), "  ", h("span", { class: "ipa", text: w.ipa })),
    h("dl", { class: "word-dl" },
      h("dt", { text: "完整英文" }), h("dd", { text: w.full }),
      h("dt", { text: "字面意思" }), h("dd", { text: w.meaning }),
      h("dt", { text: "在 Python 里" }), h("dd", { text: w.python }),
      h("dt", { text: "例子" }), h("dd", {}, h("code", { text: w.example })),
      w.note ? [h("dt", { text: "说明" }), h("dd", { text: w.note })] : null,
    ),
    h("p", { class: "source" }, "音标来源：", h("a", { href: w.source, target: "_blank", rel: "noopener", text: "Cambridge Dictionary（美式）" })),
  ]);
}

function cardNodes(card, { compact } = {}) {
  return h("article", { class: "card" + (compact ? " compact" : "") },
    h("h2", { text: card.title }),
    card.body.map((p) => h("p", { text: p })),
    h("div", { class: "example" },
      h("div", { class: "ex-block" }, h("div", { class: "ex-label", text: "代码" }), h("pre", { class: "code", text: card.example.code })),
      h("div", { class: "ex-block" }, h("div", { class: "ex-label", text: "运行结果" }), h("pre", { class: "result", text: card.example.output })),
    ),
    h("div", { class: "chips" }, card.words.map(wordChip)),
  );
}
function openLessonReview() {
  openOverlay("查看讲解", lesson.cards.map((c) => cardNodes(c, { compact: true })));
}

function openHelp() {
  const glossary = [
    ["Run", "/rʌn/", "运行代码，看结果"], ["Check", "/tʃek/", "检查答案是否符合题目"], ["Hint", "/hɪnt/", "提示，一次给一级"],
    ["Next", "/nekst/", "下一步"], ["Back", "/bæk/", "上一步"], ["Stop", "/stɑːp/", "停止正在运行的代码"],
    ["Meaning", "/ˈmiːnɪŋ/", "查看词义"], ["Tab", "/tæb/", "缩进 4 个空格"], ["⇧Tab", "Shift /ʃɪft/ + Tab", "取消缩进"],
    ["Undo", "/ʌnˈduː/", "撤销上一步编辑"], ["Enter", "/ˈentɚ/", "换行"], ["⌫", "Backspace /ˈbækspeɪs/", "删除前一个字符"],
    ["⌨︎", "", "切换到手机自带键盘（输入中文时用）"],
  ];
  openOverlay("帮助", [
    h("h3", { text: "按钮是什么意思" }),
    h("table", { class: "gloss" }, glossary.map(([b, ipa, zh]) => h("tr", {}, h("td", {}, h("b", { text: b })), h("td", { class: "ipa", text: ipa }), h("td", { text: zh })))),
    h("h3", { text: "学习记录" }),
    h("p", { text: "进度只保存在这台设备的浏览器里，不会上传。清除网站数据、使用无痕模式或换手机，记录都可能丢失。" }),
    h("h3", { text: "添加到主屏幕" }),
    h("p", { text: "iPhone：用 Safari 打开本页 → 点底部的分享按钮 → 「添加到主屏幕」。" }),
  ]);
}

let toastTimer;
function showToast(msg) {
  let t = document.querySelector(".toast");
  if (!t) { t = h("div", { class: "toast", role: "alert" }); document.body.append(t); }
  t.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 6000);
}

// ---------- 页面切换 ----------
let cleanup = null; // 离开当前页面时要做的事（例如保存草稿）
function go(i) {
  if (cleanup) { cleanup(); cleanup = null; }
  while (skip(i)) i += i > state.step ? 1 : -1;
  state.step = Math.max(0, Math.min(STEPS.length - 1, i));
  persist();
  renderStep();
}
const next = () => go(state.step + 1);
const prev = () => go(state.step - 1);

function renderHome() {
  if (cleanup) { cleanup(); cleanup = null; }
  const doneN01 = state.done.N01;
  const statusText = doneN01 ? "已完成" : state.started ? `学习中：${stepLabel(STEPS[state.step])}` : "未开始";
  let confirmBox = null;
  const clearBtn = button("清除学习记录", () => {
    if (confirmBox) return;
    confirmBox = h("div", { class: "confirm", role: "alertdialog" },
      h("p", { text: "确定要清除这台设备上的全部学习记录吗？代码草稿也会删除。" }),
      button("确定清除", () => { state = clearState(); renderHome(); showToast("学习记录已清除。"); }, "btn danger"),
      button("取消", () => { confirmBox.remove(); confirmBox = null; }, "btn"),
    );
    clearBtn.after(confirmBox);
  }, "link small");
  appEl.replaceChildren(
    topbar(""),
    h("main", { class: "view home" },
      notice ? h("p", { class: "notice", role: "status", text: notice }) : null,
      h("h1", { text: "碎片编程" }),
      h("p", { class: "lead", text: "每天几分钟，从看懂代码到写出小程序。" }),
      h("section", { class: "lesson-card" },
        h("div", { class: "lesson-id", text: lesson.id }),
        h("h2", { text: lesson.title }),
        h("p", { text: lesson.goal }),
        h("p", { class: "meta", text: `约 ${lesson.minutes} 分钟 · ${lesson.cards.length} 张讲解 · ${lesson.exercises.length} 道练习 · 1 个小任务 · 状态：${statusText}` }),
        button(doneN01 ? "再学一遍" : state.started ? "继续学习" : "开始学习", () => {
          if (doneN01 && state.step === STEPS.length - 1) state.step = 0;
          state.started = true;
          go(state.step);
        }, "btn primary big"),
      ),
      h("p", { class: "meta", text: "下一节「N02 变量与赋值」即将推出。" }),
      clearBtn,
    ),
  );
  notice = null;
}

function renderStep() {
  const s = STEPS[state.step];
  window.scrollTo(0, 0);
  if (s.kind === "card") renderCard(s);
  else if (s.kind === "choice") renderChoice(s);
  else if (s.kind === "code") renderCode(s);
  else renderSummary();
}

function navRow({ canNext = true, nextLabel = "Next" } = {}) {
  const nextBtn = button(nextLabel, () => { if (!nextBtn.disabled) next(); }, "btn primary");
  nextBtn.disabled = !canNext;
  const row = h("nav", { class: "nav-row" },
    state.step > 0 ? button("Back", prev, "btn") : h("span"),
    nextBtn,
  );
  return { row, nextBtn };
}

function renderCard(s) {
  const { row } = navRow();
  appEl.replaceChildren(
    topbar(stepLabel(s), { back: renderHome }),
    h("main", { class: "view" }, cardNodes(s.card), row),
  );
}

function hintBox(ex, { onSolution } = {}) {
  const list = h("ol", { class: "hints" });
  const render = () => {
    const n = state.hintLevel[ex.id] || 0;
    list.replaceChildren(...ex.hints.slice(0, n).map((t, i) => h("li", {}, h("b", { text: i === 2 ? "参考答案：" : `提示 ${i + 1}：` }), h("span", { class: "pre-line", text: i === 2 ? t.replace(/^参考答案[：:]?\s*/, "") : t }))));
    btn.textContent = n >= ex.hints.length ? "提示已全部显示" : n === ex.hints.length - 1 ? "Hint · 看答案" : `Hint · ${n + 1}/${ex.hints.length}`;
    btn.disabled = n >= ex.hints.length;
  };
  const btn = button("Hint", () => {
    const n = (state.hintLevel[ex.id] || 0) + 1;
    if (n > ex.hints.length) return;
    state.hintLevel[ex.id] = n;
    if (n === ex.hints.length && !state.done[ex.id]) { state.viewedSolution[ex.id] = true; onSolution?.(); }
    persist();
    render();
  }, "btn small");
  render();
  return { btn, list };
}

function markWrong(id) {
  if (!state.done[id] && !state.firstWrong[id]) { state.firstWrong[id] = true; persist(); }
}

function renderChoice(s) {
  const ex = s.ex;
  const { row, nextBtn } = navRow({ canNext: !!state.done[ex.id] });
  const feedback = h("div", { class: "feedback", role: "status", "aria-live": "polite" });
  const { btn: hintBtn, list: hintList } = hintBox(ex);
  const opts = h("div", { class: "options" }, ex.options.map((o) => {
    const b = button(h("pre", { text: o.text }), () => {
      opts.querySelectorAll(".option").forEach((x) => x.classList.remove("picked-wrong"));
      if (o.correct) {
        b.classList.add("picked-right");
        feedback.className = "feedback ok";
        feedback.replaceChildren(h("b", { text: "✓ 正确。" }), " ", o.reason);
        state.done[ex.id] = true; persist();
        nextBtn.disabled = false;
      } else {
        b.classList.add("picked-wrong");
        feedback.className = "feedback bad";
        feedback.replaceChildren(h("b", { text: "✗ 不对。" }), " ", o.reason, " 再选一次。");
        markWrong(ex.id);
      }
    }, "option", { "aria-label": `选项：${o.text.replace(/\n/g, " 换行 ")}` });
    return b;
  }));
  appEl.replaceChildren(
    topbar(stepLabel(s), { back: renderHome }),
    h("main", { class: "view" },
      h("div", { class: "ex-head" }, h("h2", { text: ex.title }), state.done[ex.id] ? h("span", { class: "badge", text: "已完成 ✓" }) : null),
      h("p", { class: "prompt", text: ex.prompt }),
      h("pre", { class: "code", text: ex.code }),
      opts,
      feedback,
      h("div", { class: "tools" }, button("查看讲解", openLessonReview, "btn small"), hintBtn, wordChip("print")),
      hintList,
      row,
    ),
  );
}

function renderCode(s) {
  const ex = s.ex;
  const id = ex.id;
  // 初始代码：优先用草稿；变化题从上一题的代码开始
  const draft = state.drafts[id];
  const startCode = draft ? draft.code
    : ex.initialFrom ? (state.drafts[ex.initialFrom]?.code ?? "")
    : (ex.initialCode ?? "");

  const editorEl = h("div", { id: "editor", "aria-label": "代码编辑区" });
  const outEl = h("pre", { id: "output", class: "out", "aria-live": "polite" });
  const statusEl = h("span", { id: "status", role: "status" });
  const feedback = h("div", { class: "feedback", role: "status", "aria-live": "polite" });
  const kbEl = h("div", { id: "keyboard", role: "group", "aria-label": "编程键盘" });
  const sysBar = h("div", { id: "system-bar", hidden: true }, "正在使用系统键盘（没弹出就再点一下代码区） ");

  let saveTimer = null;
  const saveDraft = () => {
    clearTimeout(saveTimer);
    if (!view) return;
    const sel = view.state.selection.main;
    state.drafts[id] = { code: view.state.doc.toString(), anchor: sel.anchor, head: sel.head };
    persist();
  };
  const view = createEditor(editorEl, startCode, [
    EditorView.updateListener.of((u) => {
      if (u.docChanged || u.selectionSet) { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 300); }
    }),
  ]);
  const len = view.state.doc.length;
  const a = draft ? Math.min(draft.anchor, len) : (ex.initialCursor ?? len);
  const hd = draft ? Math.min(draft.head, len) : a;
  view.dispatch({ selection: EditorSelection.range(Math.min(a, len), Math.min(hd, len)) });

  let useSystem = false;
  const toggleSystem = () => {
    useSystem = !useSystem;
    setSystemKeyboard(view, useSystem);
    kbEl.hidden = useSystem;
    sysBar.hidden = !useSystem;
  };
  sysBar.append(button("返回内置键盘", toggleSystem, "btn small", { id: "back-to-kb" }));
  createKeyboard(kbEl, view, { onToggleSystem: toggleSystem });

  const { row, nextBtn } = navRow({ canNext: !!state.done[id] });
  const { btn: hintBtn, list: hintList } = hintBox(ex);

  let busy = false;
  const runBtn = button("Run", async () => {
    if (busy) return;
    busy = true; feedback.replaceChildren(); feedback.className = "feedback";
    const r = await execCode(view.state.doc.toString(), outEl, statusEl);
    if (r.error) { const extra = explainForBeginner(r.error, view.state.doc.toString()); if (extra) { feedback.className = "feedback bad"; feedback.textContent = extra; } }
    busy = false;
  }, "btn run", { id: "run" });
  const stopBtn = button("Stop", () => runner.stop(), "btn", { id: "stop" });
  const checkBtn = button("Check", async () => {
    if (busy) return;
    const code = view.state.doc.toString();
    feedback.replaceChildren(); feedback.className = "feedback"; // 先清掉上一次的结果，避免看错
    if (!code.trim()) { feedback.className = "feedback bad"; feedback.textContent = "代码还是空的，先写一点再检查。"; return; }
    busy = true;
    const r = await execCode(code, outEl, statusEl);
    busy = false;
    if (r.status === "loadError" || r.status === "busy") return;
    if (r.error) {
      markWrong(id);
      feedback.className = "feedback bad";
      feedback.replaceChildren(h("b", { text: "✗ 程序出错了。" }), " ", explainForBeginner(r.error, code) || "看看上面的错误说明，改好后再检查。");
      return;
    }
    if (r.status !== "done") { feedback.className = "feedback bad"; feedback.textContent = "程序没有正常结束，改好后再检查。"; return; }
    const res = checkOutput(ex.check, r.out);
    if (res.pass) {
      state.done[id] = true;
      if (s.isTask && state.viewedSolution[id]) state.needVariant = true;
      persist();
      statusEl.textContent = "题目通过";
      feedback.className = "feedback ok";
      const msg = s.isTask && state.needVariant && !state.done[lesson.taskVariant.id]
        ? "你看过参考答案，再做一个小变化就算完成本节。点 Next 继续。"
        : "输出完全符合要求。点 Next 继续。";
      feedback.replaceChildren(h("b", { text: "✓ 通过！" }), " ", msg);
      nextBtn.disabled = false;
    } else {
      markWrong(id);
      feedback.className = "feedback bad";
      feedback.replaceChildren(h("b", { text: "✗ 还不对。" }), " ", res.message);
    }
  }, "btn primary", { id: "check" });

  const taskBody = h("div", { class: "task-body" },
    h("p", { class: "prompt pre-line", text: ex.prompt }),
    ex.note ? h("p", { class: "note", text: ex.note }) : null,
    h("div", { class: "tools" }, button("查看讲解", openLessonReview, "btn small"), hintBtn, wordChip("print")),
    hintList,
  );
  const collapseBtn = button("收起", () => {
    taskBody.hidden = !taskBody.hidden;
    collapseBtn.textContent = taskBody.hidden ? "展开题目" : "收起";
  }, "link small");

  appEl.replaceChildren(
    topbar(stepLabel(s), { back: renderHome }),
    h("main", { class: "code-view" },
      h("section", { id: "task" },
        h("div", { class: "ex-head" }, h("h2", { text: ex.title }), state.done[id] ? h("span", { class: "badge", text: "已完成 ✓" }) : null, collapseBtn),
        taskBody,
      ),
      editorEl,
      h("div", { id: "controls" }, runBtn, stopBtn, checkBtn, statusEl),
      outEl,
      feedback,
      row,
      sysBar,
      kbEl,
    ),
  );
  view.focus();

  cleanup = () => { saveDraft(); view.destroy(); window.__app.view = null; };
  window.__app.view = view;
}

function renderSummary() {
  state.done.N01 = true; persist();
  const items = [...lesson.exercises, lesson.task, ...(state.needVariant ? [lesson.taskVariant] : [])];
  appEl.replaceChildren(
    topbar("完成", { back: renderHome }),
    h("main", { class: "view" },
      h("h1", { text: "N01 完成！" }),
      h("p", { text: "你学会了：让程序输出内容、print 的写法（括号和引号）、程序从上往下执行。" }),
      h("ul", { class: "summary" }, items.map((e) => h("li", {},
        h("span", { text: state.done[e.id] ? "✓ " : "· " }),
        e.title,
        state.viewedSolution[e.id] ? h("span", { class: "muted", text: "（看过答案）" }) : null,
        state.firstWrong[e.id] ? h("span", { class: "muted", text: "（第一次答错，以后会复习）" }) : null,
      ))),
      !state.installTipClosed ? h("div", { class: "tip" },
        h("p", { text: "想像 App 一样打开？iPhone：Safari 底部分享按钮 → 「添加到主屏幕」。" }),
        button("知道了", (e) => { state.installTipClosed = true; persist(); e.currentTarget?.parentElement?.remove(); }, "btn small"),
      ) : null,
      h("p", { class: "meta", text: "下一节「N02 变量与赋值」即将推出。" }),
      h("nav", { class: "nav-row" }, button("Back", prev, "btn"), button("回到首页", renderHome, "btn primary")),
    ),
  );
}

// 切到后台或关闭页面时，尽力立即保存
function flushSave() {
  const v = window.__app.view;
  const s = STEPS[state.step];
  if (v && s && s.kind === "code") {
    const sel = v.state.selection.main;
    state.drafts[s.ex.id] = { code: v.state.doc.toString(), anchor: sel.anchor, head: sel.head };
  }
  persist();
}
addEventListener("pagehide", flushSave);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushSave(); });

// iPhone 弹出系统键盘时，按实际可视高度排版
const vv = window.visualViewport;
if (vv) {
  const fit = () => document.documentElement.style.setProperty("--app-h", vv.height + "px");
  vv.addEventListener("resize", fit);
  fit();
}

runner.boot(); // 后台加载 Python，不挡住阅读
window.__app = { runner, getState: () => state, lesson };
renderHome();
