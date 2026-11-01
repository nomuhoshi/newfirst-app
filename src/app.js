// 碎片编程：教程式学习。
// 一课 = 几页正文（短讲解 → 代码例子 → 运行结果，例子可以“试一试”）+ 学完一组后的综合练习（可跳过）。
import "./style.css";
import "./app.css";
import course from "../content/course.json";
import l01 from "../content/l01.json";
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

const LESSONS = { L01: l01 };

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
  onActivate(b, fn);
  return b;
}

// ---------- 状态与保存 ----------
const loaded = loadState();
let state = loaded.state;
let notice = loaded.notice;
if (notice) saveState(state); // 迁移或修复后的记录立即存一次，下次打开不再重复提示
function persist() {
  if (!saveState(state)) showToast("无法保存进度（可能是无痕模式或存储已满），关掉页面后进度会丢失。");
}
const lesson = () => LESSONS[state.lesson] || l01;
const pages = () => lesson().pages;
const isExercise = (p) => p && p.kind === "exercise";

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

function openOverlay(title, bodyNodes, { onClose, full } = {}) {
  const close = () => { overlay.remove(); onClose?.(); };
  const overlay = h("div", { class: "overlay" + (full ? " full" : ""), role: "dialog", "aria-modal": "true", "aria-label": title },
    h("div", { class: "sheet" },
      h("div", { class: "sheet-head" }, h("h2", { text: title }), button(full ? "返回教程" : "关闭", close, "btn small", { "data-close": "" })),
      h("div", { class: "sheet-body" }, bodyNodes),
    ),
  );
  // 点背景关闭；但刚打开的 0.8 秒内忽略，避免打开它的那次触摸“幽灵点击”到背景上又把它关掉
  const openedAt = Date.now();
  overlay.addEventListener("click", (e) => { if (!full && e.target === overlay && Date.now() - openedAt > 800) close(); });
  document.body.append(overlay);
  if (!full) overlay.querySelector("[data-close]").focus();
  return { overlay, close };
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

function openHelp() {
  const glossary = [
    ["Run", "/rʌn/", "运行代码，看结果"], ["Check", "/tʃek/", "检查练习答案"], ["Hint", "/hɪnt/", "提示，一次给一级"],
    ["Next", "/nekst/", "下一页"], ["Back", "/bæk/", "上一页"], ["Stop", "/stɑːp/", "停止正在运行的代码"],
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
    h("p", { text: "iPhone：用 Safari 打开本页 → 点分享按钮 → 「添加到主屏幕」。从主屏幕打开是全屏的，键盘也不会被浏览器工具栏挡住。" }),
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

// ---------- 代码区（编辑器 + 自制键盘），例子“试一试”和练习共用 ----------
// draftKey：草稿保存在 state.drafts 里的名字
function buildCodeArea({ draftKey, initialCode }) {
  const draft = state.drafts[draftKey];
  const editorEl = h("div", { id: "editor", "aria-label": "代码编辑区" });
  const kbEl = h("div", { id: "keyboard", role: "group", "aria-label": "编程键盘" });
  const sysBar = h("div", { id: "system-bar", hidden: true }, "正在使用系统键盘（没弹出就再点一下代码区） ");

  let saveTimer = null;
  let view = null;
  const saveDraft = () => {
    clearTimeout(saveTimer);
    if (!view) return;
    const code = view.state.doc.toString();
    const sel = view.state.selection.main;
    if (code === initialCode && !state.drafts[draftKey]) return; // 没改过就不存
    state.drafts[draftKey] = { code, anchor: sel.anchor, head: sel.head };
    persist();
  };
  view = createEditor(editorEl, draft ? draft.code : initialCode, [
    EditorView.updateListener.of((u) => {
      if (u.docChanged || u.selectionSet) { clearTimeout(saveTimer); saveTimer = setTimeout(saveDraft, 300); }
    }),
  ]);
  const len = view.state.doc.length;
  const a = draft ? Math.min(draft.anchor, len) : len;
  const hd = draft ? Math.min(draft.head, len) : a;
  view.dispatch({ selection: EditorSelection.range(a, hd) });

  let useSystem = false;
  const toggleSystem = () => {
    useSystem = !useSystem;
    setSystemKeyboard(view, useSystem);
    kbEl.hidden = useSystem;
    sysBar.hidden = !useSystem;
  };
  sysBar.append(button("返回内置键盘", toggleSystem, "btn small", { id: "back-to-kb" }));
  createKeyboard(kbEl, view, { onToggleSystem: toggleSystem });

  window.__app.view = view;
  window.__app.saveDraft = saveDraft;
  const destroy = () => {
    saveDraft(); view.destroy();
    if (window.__app.view === view) { window.__app.view = null; window.__app.saveDraft = null; }
  };
  const reset = () => {
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: initialCode }, selection: { anchor: initialCode.length } });
    delete state.drafts[draftKey];
    persist();
  };
  return { view, editorEl, kbEl, sysBar, saveDraft, destroy, reset };
}

// ---------- 页面切换 ----------
let cleanup = null; // 离开当前页面时要做的事（例如保存草稿）
function leave() { if (cleanup) { cleanup(); cleanup = null; } }
function go(i) {
  leave();
  state.page = Math.max(0, Math.min(pages().length, i)); // pages().length = 完成页
  persist();
  renderPage();
}
const next = () => go(state.page + 1);
const prev = () => go(state.page - 1);

function pageLabel(i) {
  const ps = pages();
  if (i >= ps.length) return "完成";
  return `${i + 1}/${ps.length}`;
}

function lessonStatus(id) {
  if (state.lessonDone[id]) return "已学完";
  if (state.lesson === id && state.started) return `学到 ${pageLabel(state.page)}`;
  return "未开始";
}

function renderHome() {
  leave();
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

  const L = lesson();
  const started = state.started && !state.lessonDone[L.id];
  appEl.replaceChildren(
    topbar(""),
    h("main", { class: "view home" },
      notice ? h("p", { class: "notice", role: "status", text: notice }) : null,
      h("h1", { text: "碎片编程" }),
      h("p", { class: "lead", text: "每天几分钟，用手机从零学 Python。" }),
      h("section", { class: "lesson-card" },
        h("div", { class: "lesson-id", text: `第一课 · ${L.id}` }),
        h("h2", { text: L.title }),
        h("p", { text: L.goal }),
        h("p", { class: "meta", text: `约 ${L.minutes} 分钟 · ${L.pages.filter((p) => !isExercise(p)).length} 段讲解 · ${L.pages.filter(isExercise).length} 道练习 · ${lessonStatus(L.id)}` }),
        button(state.lessonDone[L.id] ? "再学一遍" : started ? "继续学习" : "开始学习", () => {
          if (state.lessonDone[L.id] && state.page >= pages().length) state.page = 0;
          state.started = true;
          go(state.page);
        }, "btn primary big"),
      ),
      h("h3", { class: "roadmap-title", text: "课程路线" }),
      h("ol", { class: "roadmap" }, course.lessons.map((c) => h("li", { class: c.available ? "on" : "off" },
        h("span", { class: "rm-id", text: c.id }), h("span", { class: "rm-title", text: c.title }),
        h("span", { class: "rm-state", text: c.available ? lessonStatus(c.id) : "即将推出" }),
      ))),
      clearBtn,
    ),
  );
  notice = null;
}

function renderPage() {
  const ps = pages();
  if (state.page >= ps.length) return renderSummary();
  const p = ps[state.page];
  if (isExercise(p)) renderExercise(p);
  else renderReading(p);
}

function navRow({ nextLabel = "Next", nextCls = "btn primary" } = {}) {
  const nextBtn = button(nextLabel, () => next(), nextCls, { "data-next": "" });
  const row = h("nav", { class: "nav-row" },
    state.page > 0 ? button("Back", prev, "btn") : h("span"),
    nextBtn,
  );
  return { row, nextBtn };
}

// 正文页：段落、提示框、代码例子（代码 + 运行结果 + 试一试）
function renderReading(p) {
  const blocks = p.blocks.map((b) => {
    if (b.t === "p") return h("p", { text: b.text });
    if (b.t === "tip") return h("p", { class: "tip-box", text: b.text });
    if (b.t === "code") {
      const edited = !!state.drafts[b.id];
      return h("div", { class: "example", "data-example": b.id },
        h("div", { class: "ex-block" }, h("div", { class: "ex-label", text: "代码" }), h("pre", { class: "code", text: b.code })),
        h("div", { class: "ex-block" }, h("div", { class: "ex-label", text: "运行结果" }), h("pre", { class: "result", text: b.output })),
        h("div", { class: "ex-actions" },
          button(edited ? "试一试（有改动）" : "试一试", () => openPlayground(b), "btn small try", { "aria-label": `修改并运行这个例子` }),
        ),
      );
    }
    return null;
  });
  const { row } = navRow();
  appEl.replaceChildren(
    topbar(`${lesson().id} · ${pageLabel(state.page)}`, { back: renderHome }),
    h("main", { class: "view reading" },
      h("h2", { text: p.title }),
      blocks,
      p.words?.length ? h("div", { class: "chips" }, p.words.map(wordChip)) : null,
      row,
    ),
  );
}

// “试一试”：全屏打开代码区，可以改、可以运行；“返回教程”回到刚才读的位置
function openPlayground(b) {
  const outEl = h("pre", { id: "output", class: "out", "aria-live": "polite" });
  const statusEl = h("span", { id: "status", role: "status" });
  const area = buildCodeArea({ draftKey: b.id, initialCode: b.code });
  let busy = false;
  const run = async () => {
    if (busy) return;
    busy = true;
    await execCode(area.view.state.doc.toString(), outEl, statusEl);
    busy = false;
  };
  const scrollY = document.querySelector(".view")?.scrollTop || 0;
  const { overlay } = openOverlay("试一试：改一改，再点 Run", [
    h("div", { class: "code-view" },
      h("p", { class: "note pad", text: "随便改，改坏了点「恢复原样」。原来的运行结果：" + b.output.replace(/\n/g, " ⏎ ") }),
      area.editorEl,
      h("div", { id: "controls" },
        button("Run", run, "btn run", { id: "run" }),
        button("Stop", () => runner.stop(), "btn", { id: "stop" }),
        button("恢复原样", () => { area.reset(); outEl.textContent = ""; statusEl.textContent = ""; }, "btn small"),
        statusEl,
      ),
      outEl,
      area.sysBar,
      area.kbEl,
    ),
  ], {
    full: true,
    onClose: () => {
      area.destroy();
      renderPage();
      const v = document.querySelector(".view");
      if (v) v.scrollTop = scrollY;
    },
  });
  overlay.classList.add("playground");
  area.view.focus();
}

function hintBox(ex) {
  const list = h("ol", { class: "hints" });
  const render = () => {
    const n = state.hintLevel[ex.id] || 0;
    list.replaceChildren(...ex.hints.slice(0, n).map((t, i) => h("li", {},
      h("b", { text: i === ex.hints.length - 1 ? "参考答案：" : `提示 ${i + 1}：` }),
      h("span", { class: "pre-line", text: i === ex.hints.length - 1 ? t.replace(/^参考答案[：:]?\s*/, "") : t }))));
    btn.textContent = n >= ex.hints.length ? "提示已全部显示" : n === ex.hints.length - 1 ? "Hint · 看答案" : `Hint · ${n + 1}/${ex.hints.length}`;
    btn.disabled = n >= ex.hints.length;
  };
  const btn = button("Hint", () => {
    const n = (state.hintLevel[ex.id] || 0) + 1;
    if (n > ex.hints.length) return;
    state.hintLevel[ex.id] = n;
    if (n === ex.hints.length && !state.exDone[ex.id]) state.viewedSolution[ex.id] = true;
    persist();
    render();
  }, "btn small");
  render();
  return { btn, list };
}

// 综合练习：可以做，也可以跳过
function renderExercise(ex) {
  const outEl = h("pre", { id: "output", class: "out", "aria-live": "polite" });
  const statusEl = h("span", { id: "status", role: "status" });
  const feedback = h("div", { class: "feedback", role: "status", "aria-live": "polite" });
  const area = buildCodeArea({ draftKey: ex.id, initialCode: ex.initialCode || "" });
  const done = () => !!state.exDone[ex.id];
  const { row, nextBtn } = navRow({ nextLabel: done() ? "Next" : "跳过", nextCls: done() ? "btn primary" : "btn" });
  const markNext = () => { nextBtn.textContent = "Next"; nextBtn.className = "btn primary"; };
  const { btn: hintBtn, list: hintList } = hintBox(ex);

  let busy = false;
  const runBtn = button("Run", async () => {
    if (busy) return;
    busy = true; feedback.replaceChildren(); feedback.className = "feedback";
    const code = area.view.state.doc.toString();
    const r = await execCode(code, outEl, statusEl);
    if (r.error) { const extra = explainForBeginner(r.error, code); if (extra) { feedback.className = "feedback bad"; feedback.textContent = extra; } }
    busy = false;
  }, "btn run", { id: "run" });
  const checkBtn = button("Check", async () => {
    if (busy) return;
    const code = area.view.state.doc.toString();
    feedback.replaceChildren(); feedback.className = "feedback"; // 先清掉上一次的结果，避免看错
    if (!code.trim()) { feedback.className = "feedback bad"; feedback.textContent = "代码还是空的，先写一点再检查。"; return; }
    busy = true;
    const r = await execCode(code, outEl, statusEl);
    busy = false;
    if (r.status === "loadError" || r.status === "busy") return;
    if (r.error) {
      feedback.className = "feedback bad";
      feedback.replaceChildren(h("b", { text: "✗ 程序出错了。" }), " ", explainForBeginner(r.error, code) || "看看上面的错误说明，改好后再检查。");
      return;
    }
    if (r.status !== "done") { feedback.className = "feedback bad"; feedback.textContent = "程序没有正常结束，改好后再检查。"; return; }
    const res = checkOutput(ex.check, r.out, code);
    if (res.pass) {
      state.exDone[ex.id] = true;
      delete state.exSkipped[ex.id];
      persist();
      statusEl.textContent = "练习通过";
      feedback.className = "feedback ok";
      feedback.replaceChildren(h("b", { text: "✓ 通过！" }), " 点 Next 继续。");
      markNext();
    } else {
      feedback.className = "feedback bad";
      feedback.replaceChildren(h("b", { text: "✗ 还不对。" }), " ", res.message);
    }
  }, "btn primary", { id: "check" });

  const taskBody = h("div", { class: "task-body" },
    h("p", { class: "prompt pre-line", text: ex.prompt }),
    ex.note ? h("p", { class: "note", text: ex.note }) : null,
    h("div", { class: "tools" }, hintBtn, (ex.words || []).map(wordChip)),
    hintList,
  );
  const collapseBtn = button("收起", () => {
    taskBody.hidden = !taskBody.hidden;
    collapseBtn.textContent = taskBody.hidden ? "展开题目" : "收起";
  }, "link small");

  appEl.replaceChildren(
    topbar(`${lesson().id} · ${pageLabel(state.page)}`, { back: renderHome }),
    h("main", { class: "code-view" },
      h("section", { id: "task" },
        h("div", { class: "ex-head" }, h("h2", { text: ex.title }), done() ? h("span", { class: "badge", text: "已完成 ✓" }) : null, collapseBtn),
        taskBody,
      ),
      area.editorEl,
      h("div", { id: "controls" }, runBtn, button("Stop", () => runner.stop(), "btn", { id: "stop" }), checkBtn, statusEl),
      outEl,
      feedback,
      row,
      area.sysBar,
      area.kbEl,
    ),
  );
  // 跳过：记下来，完成页会提醒可以回来做
  onActivate(nextBtn, () => { if (!state.exDone[ex.id]) { state.exSkipped[ex.id] = true; persist(); } });
  area.view.focus();
  cleanup = () => area.destroy();
}

function renderSummary() {
  const L = lesson();
  state.lessonDone[L.id] = true; persist();
  const exercises = L.pages.filter(isExercise);
  const nextLesson = course.lessons[course.lessons.findIndex((c) => c.id === L.id) + 1];
  appEl.replaceChildren(
    topbar("完成", { back: renderHome }),
    h("main", { class: "view" },
      h("h1", { text: `学完了：${L.title}` }),
      h("p", { text: "你学会了：用 print 输出内容、用变量存值、加减乘除，以及一次输出多个值。" }),
      h("h3", { text: "练习" }),
      h("ul", { class: "summary" }, exercises.map((e) => h("li", {},
        h("span", { text: state.exDone[e.id] ? "✓ " : "· " }),
        e.title,
        state.exDone[e.id] && state.viewedSolution[e.id] ? h("span", { class: "muted", text: "（看过答案）" }) : null,
        !state.exDone[e.id] ? h("span", { class: "muted", text: "（跳过了，随时可以回来做）" }) : null,
      ))),
      !state.installTipClosed ? h("div", { class: "tip" },
        h("p", { text: "想像 App 一样打开？iPhone：Safari 分享按钮 → 「添加到主屏幕」。" }),
        button("知道了", (e) => { state.installTipClosed = true; persist(); e.currentTarget?.parentElement?.remove(); }, "btn small"),
      ) : null,
      nextLesson ? h("p", { class: "meta", text: `下一课「${nextLesson.title}」${nextLesson.available ? "" : "即将推出"}。` }) : null,
      h("nav", { class: "nav-row" }, button("Back", prev, "btn"), button("回到首页", renderHome, "btn primary")),
    ),
  );
}

// 切到后台或关闭页面时，尽力立即保存
function flushSave() {
  if (window.__app.saveDraft) window.__app.saveDraft();
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

window.__app = { runner, getState: () => state, view: null, saveDraft: null };
runner.boot(); // 后台加载 Python，不挡住阅读
renderHome();
