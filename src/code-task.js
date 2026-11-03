// 写代码 / 改代码题的答题区（type: "modify" | "write"）。
// 这个文件只管界面和调用判题器；计分、红心、XP 全部由 app.js 里的 settleAnswer 按原有规则处理：
//   - “运行”：只是试一试，不判对错、不计分、不扣红心
//   - “检查”：judge() 返回 pass/fail 且 settle 才算作答；timeout / output-limit / unavailable / internal-error / cancelled / 弯引号提示 一律不算作答
// 界面文字都用 textContent，绝不把学生输出当 HTML。
import "./code-task.css";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { createEditor, setSystemKeyboard, setDoc } from "./editor.js";
import { createKeyboard } from "./keyboard.js";
import { judge, normalizeOutput, JUDGE_LIMITS } from "./judge.js";
import { describeError } from "./errors.js";
import { ownerId, loadDraft, saveDraft, clearDraft, createDraftSaver } from "./code-drafts.js";

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c);
  return el;
}

let activeSaver = null;
// 离开这道题之前调用：把还没来得及保存的草稿存下来
export function flushActiveDraft() { activeSaver?.flush(); }

export const CODE_TYPES = ["modify", "write"];
export const isCodeTask = (ex) => CODE_TYPES.includes(ex?.type);

const CURLY = /[“”‘’]/;

// 第一处不同的位置，用文字说明（不只靠颜色）
export function diffNote(expected, actual) {
  const e = normalizeOutput(expected).split("\n"), a = normalizeOutput(actual).split("\n");
  const n = Math.max(e.length, a.length);
  for (let i = 0; i < n; i++) {
    if (e[i] === a[i]) continue;
    if (e[i] === undefined) return `多输出了第 ${i + 1} 行`;
    if (a[i] === undefined) return `少输出了第 ${i + 1} 行及之后的内容`;
    if (e[i].trimEnd() === a[i].trimEnd()) return `第 ${i + 1} 行只有行尾空格不同`;
    return `第 ${i + 1} 行不同：期望“${e[i]}”，你的是“${a[i]}”`;
  }
  return "";
}

const fmtData = (d) => (d && Object.keys(d).length ? Object.entries(d).map(([k, v]) => `${k} = ${JSON.stringify(v)}`).join("，") : "");
const fmtCall = (c) => `${c.fn}(${[...(c.args ?? []).map((x) => JSON.stringify(x)), ...Object.entries(c.kwargs ?? {}).map(([k, v]) => `${k}=${JSON.stringify(v)}`)].join(", ")})`;

// ctx: { exec, runner, onChange, ui: { sheet, button }, pythonUnavailable?, storage? }
export function createCodeArea(ex, ctx) {
  const storage = ctx.storage ?? globalThis.localStorage;
  const { exec, runner, ui } = ctx;
  const owner = ownerId(storage);
  // cur = 现在作答的题：原题，或看过参考解法后的变化题（ex.variation，旧名 ex.variant）
  const vsrc = ex.variation ?? ex.variant ?? null;
  const vspec = vsrc && Array.isArray(vsrc.tests) && vsrc.tests.length && vsrc.id ? {
    ...ex, isVariation: true, id: vsrc.id, version: vsrc.version ?? ex.version ?? 1, type: "write",
    prompt: vsrc.prompt ?? "", given: vsrc.given ?? ex.given, tests: vsrc.tests, hints: vsrc.hints ?? [],
    reference: vsrc.solution ?? vsrc.reference ?? "", mistakes: vsrc.mistakes ?? [], starter: vsrc.starter ?? vsrc.code ?? "",
    code: undefined, files: vsrc.files, entry: vsrc.entry, checkMode: vsrc.checkMode ?? ex.checkMode, compare: vsrc.compare ?? ex.compare, worked: undefined,
  } : null;
  const initialOf = (c) => (c.type === "modify" ? (c.code ?? "") : (c.starter ?? ""));
  const draft = loadDraft(storage, owner, ex);
  let viewed = draft?.viewed ?? false;
  let cur = ex, initial = initialOf(ex);
  let phase = vspec && draft?.phase === "variation" ? "variation" : "original";
  if (phase === "variation") { cur = vspec; initial = initialOf(vspec); }
  const curDraft = phase === "variation" ? loadDraft(storage, owner, vspec) : draft;
  let hintLevel = 0;
  let locked = false, busy = false, useSystem = false, kbHidden = false;
  let ctrl = null;
  let lastResult = null;
  let initialized = false; // 初始内容写进编辑器时不触发 onChange / 保存

  // ---- 题面：已准备好的变量 + 公开例子 ----
  let samples = [];
  const norm = (t) => String(t ?? "").replace(/\s+/g, "");
  function workedNode() {
    const w = ex.worked;
    if (!w || !w.code || cur.isVariation) return null;
    if (ex.reference && norm(w.code).includes(norm(ex.reference))) return null; // 示范只讲概念，绝不等于本题答案
    return h("details", { class: "ct-worked", "data-worked": "" },
      h("summary", { text: "先看一个例子（不是本题的答案）" }),
      h("pre", { class: "ct-worked-code", text: w.code }),
      w.output != null ? h("pre", { class: "ct-worked-out", text: "输出：\n" + w.output }) : null,
      w.explain ? h("p", { class: "ct-worked-explain", text: w.explain }) : null);
  }
  function buildPrompt() {
    samples = (cur.tests || []).filter((t) => !t.hidden);
    return [
    cur.isVariation ? h("div", { class: "ct-variation", role: "note", "data-variation": "" }, h("b", { text: "变化题" }), h("p", { text: "原题已经通过。再做一道有变化的题：不多加 XP，答错也不扣红心。" }), h("p", { class: "ct-vprompt", text: cur.prompt })) : null,
    workedNode(),
    cur.given?.length ? h("p", { class: "ct-given" }, "已经准备好的变量：", h("code", { text: cur.given.join("、") })) : null,
    samples.length ? h("div", { class: "ct-samples", role: "list", "aria-label": "例子" }, samples.map((t, i) => h("div", { class: "ct-sample", role: "listitem" },
      h("b", { text: `例 ${i + 1}${t.name ? " · " + t.name : ""}` }),
      fmtData(t.data) ? h("div", { text: "给定：" + fmtData(t.data) }) : null,
      t.call ? h("div", { text: "调用：" + fmtCall(t.call) }) : null,
      t.stdin != null ? h("div", { text: "输入：" + (Array.isArray(t.stdin) ? t.stdin.join(" ⏎ ") : String(t.stdin).replace(/\n$/, "").replace(/\n/g, " ⏎ ")) }) : null,
      t.call ? h("div", { text: "应该返回：" + JSON.stringify(t.expectedReturn) }) : h("pre", { class: "ct-exp", text: "应该输出：\n" + (t.expected ?? "") }),
    ))) : null,
    ];
  }
  const promptNode = h("div", { class: "ct-prompt" }, buildPrompt());

  // ---- 编辑器 ----
  const editorHost = h("div", { class: "ct-editor", "aria-label": "代码编辑区", role: "group" });
  const saveNote = h("span", { class: "ct-savenote", text: "代码暂存于此设备" });
  const onSaved = (ok) => { saveNote.textContent = ok ? "代码暂存于此设备" : "⚠ 这台设备存不下草稿（存储不可用）。当前页面里的代码还在，退出后会丢失"; saveNote.classList.toggle("bad", !ok); };
  const mkSaver = () => createDraftSaver(storage, owner, cur, () => (cur.isVariation ? { code: getCode(), viewed: false } : { code: getCode(), viewed, phase }), { onResult: onSaved });
  let saver = mkSaver();
  activeSaver = saver;
  const view = createEditor(editorHost, "", [
    EditorState.changeFilter.of(() => !locked),
    EditorView.updateListener.of((u) => { if (u.docChanged && initialized) { ctx.onChange?.(); saver.schedule(); } }),
  ]);
  view.contentDOM.setAttribute("aria-label", "Python 代码");
  const text0 = curDraft ? curDraft.code : initial;
  setDoc(view, text0, text0.length);
  initialized = true;
  const getCode = () => view.state.doc.toString();

  // ---- 键盘 ----
  const kb = h("div", { id: "keyboard", class: "ct-kb" });
  function applyKb() {
    kb.hidden = useSystem || kbHidden;
    toggleKbBtn.textContent = useSystem ? "回到内置键盘" : kbHidden ? "展开键盘" : "收起键盘";
  }
  function toggleSystem() { useSystem = !useSystem; kbHidden = false; setSystemKeyboard(view, useSystem); applyKb(); }
  createKeyboard(kb, view, { onToggleSystem: toggleSystem });

  // ---- 按钮、状态、结果 ----
  const mkBtn = (label, fn, cls = "ct-btn", attrs = {}) => { const b = h("button", { type: "button", class: cls, ...attrs }, label); b.addEventListener("click", () => { if (!b.disabled) fn(); }); return b; };
  const runBtn = mkBtn("运行", () => (busy ? ctrl?.abort() : runSample()), "ct-btn run", { "data-run": "" });
  const toggleKbBtn = mkBtn("收起键盘", () => { if (useSystem) toggleSystem(); else { kbHidden = !kbHidden; applyKb(); } }, "ct-btn ghost", { "data-toggle-kb": "" });
  const resetBtn = mkBtn("重新开始", () => confirmReset(), "ct-btn ghost", { "data-reset": "" });
  const statusLine = h("div", { class: "ct-status", role: "status" });
  const results = h("div", { class: "ct-results", "aria-live": "polite", "data-results": "" });
  const toolbar = h("div", { class: "ct-toolbar" }, runBtn, resetBtn, toggleKbBtn);
  const root = h("div", { class: "ct-root", "data-code-task": ex.id || "" }, promptNode, editorHost, toolbar, h("div", { class: "ct-meta" }, saveNote), statusLine, results);
  applyKb();

  function pyStatus() {
    const s = runner.state;
    statusLine.replaceChildren();
    if (s === "ready" || s === "running") { statusLine.textContent = "Python 已就绪"; return; }
    if (s === "loadError") {
      statusLine.append(h("span", { text: (ctx.pythonUnavailable?.() ?? "Python 还没有加载成功。") + " " }), mkBtn("重试加载", () => runner.boot(), "ct-btn small", { "data-retry-python": "" }));
      return;
    }
    statusLine.textContent = "Python 加载中…（可以先写代码）";
  }
  pyStatus();
  let seen = false;
  const tick = setInterval(() => { if (!root.isConnected) { if (seen) clearInterval(tick); return; } seen = true; if (!busy) pyStatus(); }, 600);

  function setBusy(b) { busy = b; runBtn.textContent = b ? "停止" : "运行"; ctx.onChange?.(); }

  function say(title, lines, cls = "") {
    results.className = "ct-results " + cls;
    results.replaceChildren(h("h3", { text: title }), ...lines.filter(Boolean).map((l) => (typeof l === "string" ? h("p", { text: l }) : l)));
  }

  // ---- 运行（试一试，不判对错）----
  async function runSample() {
    if (busy || locked) return;
    const code = getCode();
    const t = samples[0] ?? cur.tests[0];
    setBusy(true);
    ctrl = new AbortController();
    say("运行中…", ["只是试一试，不判对错，也不扣红心。"]);
    try {
      const files = codeFiles(code);
      const r = await exec.exec({ code, files, entry: cur.entry || "main.py", data: t?.data ?? null, stdin: t?.stdin ?? null, readFiles: [], timeoutMs: JUDGE_LIMITS.caseMs, signal: ctrl.signal });
      const lines = [];
      if (r.timedOut) lines.push(h("p", { class: "bad", text: `运行超过 ${JUDGE_LIMITS.caseMs / 1000} 秒，已停止（可能有死循环）。这不影响答题，也不扣红心。` }));
      else if (r.limitHit) lines.push(h("p", { class: "bad", text: "输出超过安全上限，已停止，请检查循环或打印次数。这不影响答题，也不扣红心。" }));
      if (r.error) lines.push(h("pre", { class: "ct-out bad", text: (r.stdout ? r.stdout + "\n" : "") + (r.error.file && r.error.file !== (cur.entry || "main.py") ? `[${r.error.file}] ` : "") + describeError(r.error) }));
      else if (!r.timedOut && !r.limitHit) lines.push(h("pre", { class: "ct-out", text: r.stdout || "程序运行完成，没有输出" }));
      say("运行结果（试一试，不判对错）", lines);
    } catch (e) {
      if (e && e.cancelled) say("已停止", ["这次运行已停止，不影响答题。"]);
      else if (e && e.unavailable) say("Python 还没准备好", ["这次运行没有执行，不影响答题，也不扣红心。请稍等或点“重试加载”。"], "warn");
      else say("运行没有成功", ["应用内部出了点问题，不影响答题，请再试一次。"], "warn");
    } finally { setBusy(false); ctrl = null; pyStatus(); }
  }

  function codeFiles(code) {
    if (!cur.files) return undefined;
    const entry = cur.entry || "main.py";
    return Object.fromEntries(cur.files.map((f) => [f.path, f.path === entry ? code : f.content]));
  }

  // ---- 检查（判对错）：返回 judge 的结果；界面展示也在这里 ----
  async function check() {
    if (busy) return { status: "internal-error", attempt: false, settle: false, retry: true, cases: [], totalMs: 0 };
    const code = getCode();
    saver.flush();
    setBusy(true);
    ctrl = new AbortController();
    say("检查中…", ["正在用几组数据运行你的代码。思考和修改不限时；运行只有安全保护时限。"]);
    let r;
    try {
      const args = { tests: cur.tests, checkMode: cur.checkMode || "output", compare: cur.compare || "strict" };
      if (cur.files) args.files = cur.files.map((f) => ({ path: f.path, content: f.path === (cur.entry || "main.py") ? code : f.content })), args.entry = cur.entry;
      else args.code = code;
      r = await judge(args, exec, { signal: ctrl.signal });
    } catch {
      r = { status: "internal-error", attempt: false, settle: false, retry: true, totalMs: 0, cases: [{ name: "", hidden: false, ok: false, kind: "internal", ms: 0, message: "判题出了内部问题，这次不算作答，代码已保留，请重试" }] };
    } finally { setBusy(false); ctrl = null; pyStatus(); }
    // iPhone 的自动替换可能把直引号变成弯引号：这种语法错误不该扣红心，提示后让学生改
    if (r.status === "fail" && CURLY.test(code) && r.cases.some((c) => c.kind === "error" && c.error?.kind === "SyntaxError")) {
      r = { ...r, status: "curly-quotes", attempt: false, settle: false, retry: true };
      lastResult = r;
      say("代码里有弯引号，这次不算作答", ["Python 只认直引号 \" 或 '，不认弯引号 “ ” ‘ ’。请改成直引号再检查（用内置键盘输入就是直引号）。", "不扣红心，代码已保留。"], "warn");
      return r;
    }
    lastResult = r;
    renderResult(r);
    // 看过参考解法：原题通过后不结算，进入变化题；变化题通过才结算原题奖励（一次）；变化题没通过不扣红心
    if (vspec && !cur.isVariation && viewed && r.status === "pass") {
      r = { ...r, attempt: false, settle: false, retry: true, assisted: true };
      lastResult = r;
      enterVariation();
      return r;
    }
    if (cur.isVariation) {
      if (r.status === "pass") r = { ...r, attempt: true, settle: true, variation: true };
      else if (r.status === "fail") {
        r = { ...r, attempt: false, settle: false, retry: true, variation: true };
        const p = results.querySelector("h3"); if (p) p.textContent += "（变化题：不扣红心，可以继续改）";
      }
      lastResult = r;
    }
    return r;
  }

  function enterVariation() {
    saver.flush();
    phase = "variation";
    saveDraft(storage, owner, ex, { code: getCode(), viewed, phase }); // 原题代码和“进入变化题”一起记下
    cur = vspec; initial = initialOf(vspec);
    saver = mkSaver(); activeSaver = saver;
    const d = loadDraft(storage, owner, vspec);
    const t = d ? d.code : initial;
    initialized = false; setDoc(view, t, t.length); initialized = true;
    promptNode.replaceChildren(...buildPrompt().filter((n) => n != null));
    hintLevel = 0; lastResult = null;
    say("原题通过了 ✓", ["因为看过参考解法，还要再做一道有变化的题才算完成。下面是变化题：不多加 XP，没做对也不扣红心。"], "ok");
    saver.schedule();
    ctx.onChange?.();
    root.scrollIntoView?.({ block: "start" });
  }

  function mistakeFor(c, t) {
    for (const m of cur.mistakes || []) {
      const mt = m.match || {};
      if (mt.test && mt.test !== c.name) continue;
      if (mt.errorKind && mt.errorKind !== c.error?.kind) continue;
      if (mt.got !== undefined && normalizeOutput(mt.got) !== normalizeOutput(c.stdout ?? c.actualReturn ?? "")) continue;
      return m.why;
    }
    return t?.note || "";
  }

  function renderResult(r) {
    const total = cur.tests.length, passed = r.cases.filter((c) => c.ok).length;
    let title, cls = "";
    if (r.status === "pass") { title = `全部通过 ✓（${passed}/${total} 组）`; cls = "ok"; }
    else if (r.status === "fail") { title = `还没通过：${passed}/${total} 组通过`; cls = "bad"; }
    else { title = ({ timeout: "运行时间太长，已停止", "output-limit": "输出太多，已停止", unavailable: "Python 还没准备好", cancelled: "已取消", "internal-error": "判题出了内部问题" })[r.status] || "这次没有判定"; cls = "warn"; }
    const lines = [];
    if (!r.attempt) lines.push(h("p", { class: "warn", text: (r.cases.at(-1)?.message || "") + (r.status === "cancelled" ? "" : "") }));
    r.cases.forEach((c, i) => {
      const t = cur.tests[i];
      const li = h("div", { class: "ct-case " + (c.ok ? "ok" : "bad"), role: "group", "aria-label": `${c.name || "第 " + (i + 1) + " 组"}：${c.ok ? "通过" : "未通过"}` },
        h("div", { class: "ct-case-head" }, h("b", { text: (c.ok ? "✓ 通过 " : "✗ 未通过 ") }), h("span", { text: (c.hidden ? "隐藏测试" : c.name || `第 ${i + 1} 组`) + (c.ms ? ` · ${c.ms} ms` : "") })));
      if (!c.ok && r.attempt) {
        if (c.kind === "error" && c.error) li.append(h("pre", { class: "ct-out bad", text: (c.error.file && c.error.file !== (cur.entry || "main.py") ? `[${c.error.file}] ` : "") + describeError(c.error) }));
        else if (c.kind === "wrong-return") { li.append(h("p", { text: c.hidden ? "函数的返回值和期望不一致。" : `期望返回 ${c.expected}，你的函数返回 ${c.actualReturn}` })); }
        else if (c.kind === "wrong-file") { li.append(h("p", { text: c.hidden ? c.message : "输出文件不对：" }), ...(c.files || []).map((f) => h("p", { text: `${f.path}：期望“${f.expected}”，你的是${f.actual === null ? "（没有生成这个文件）" : "“" + f.actual + "”"}` }))); }
        else if (!c.hidden && c.expected !== undefined) {
          li.append(h("p", { class: "ct-diff", text: diffNote(c.expected, c.stdout) || c.message }),
            h("div", { class: "ct-cmp" }, h("div", {}, h("b", { text: "期望输出" }), h("pre", { text: c.expected })), h("div", {}, h("b", { text: "你的输出" }), h("pre", { text: c.stdout || "（没有输出）" }))));
        } else li.append(h("p", { text: c.message }));
        const why = mistakeFor(c, t);
        if (why) li.append(h("p", { class: "ct-why", text: why }));
      }
      lines.push(li);
    });
    say(title, lines, cls);
  }

  // ---- 提示（两级提示 + 参考解法，看过解法会标记）----
  function openHint() {
    const hints = cur.hints || [];
    const show = (title, body, last) => ui.sheet((close) => [h("div", { class: "lsheet hint" }, h("b", { text: title }), h("pre", { class: "hint-text", text: body }), ui.button(last ? "好的" : "好的", close, "btn3d primary wide"))]);
    if (hintLevel < hints.length) { hintLevel++; show(`提示 ${hintLevel}/${hints.length}`, hints[hintLevel - 1]); return; }
    // 产品负责人决定：变化题流程做好之前不提供“看过解法后完成”。没有 variant 字段的题目，提示用完就是用完了。
    if (!vspec || cur.isVariation) { show("没有更多提示了", "再试一次吧：先看看上面的例子，一步一步对照你的输出和期望输出。", true); return; }
    if (viewed) { show("参考解法（你已经查看过）", ex.reference ?? "", true); return; }
    ui.sheet((close) => [h("div", { class: "lsheet" },
      h("h2", { text: "要看参考解法吗？" }),
      h("p", { text: "看过之后这道题会标记为“已查看解答”：你的代码通过后，还要再做一道有变化的题才算完成（不多扣红心，也不重复加 XP）。先再试一次，自己写出来最有收获。" }),
      ui.button("再试试", close, "btn3d primary wide"),
      ui.button("看参考解法（之后要再做一道变化题）", () => { close(); viewed = true; saver.flush(); saver.schedule(); saver.flush(); show("参考解法", ex.reference ?? "", true); }, "btn3d danger-ghost wide"),
    )]);
  }

  function confirmReset() {
    if (locked) return;
    ui.sheet((close) => [h("div", { class: "lsheet" },
      h("h2", { text: "要重新开始吗？" }),
      h("p", { text: "编辑器会恢复成题目给的初始代码，你现在写的代码会丢失。" }),
      ui.button("继续写", close, "btn3d primary wide"),
      ui.button("重新开始", () => { close(); clearDraft(storage, owner, cur); setDoc(view, initial, initial.length); lastResult = null; results.replaceChildren(); saver.cancel(); ctx.onChange?.(); }, "btn3d danger-ghost wide"),
    )]);
  }

  // 页面切到后台时立刻保存
  const onHide = () => { if (document.visibilityState === "hidden") saver.flush(); };
  document.addEventListener("visibilitychange", onHide);
  addEventListener("pagehide", () => saver.flush());

  return {
    kind: "code",
    node: root,
    after: kb,                       // 内置键盘，放在页面最底部
    view,
    ready: () => getCode().trim().length > 0 && !locked,
    lock() { locked = true; runBtn.disabled = true; resetBtn.disabled = true; kb.hidden = true; },
    mark() {},
    check,                           // async：返回 judge 结果
    settled(ok) { if (ok) { clearDraft(storage, owner, ex); if (vspec) clearDraft(storage, owner, vspec); saver.cancel(); } else saver.flush(); },
    isCorrect: () => lastResult?.status === "pass",
    phase: () => phase,
    isVariation: () => cur.isVariation === true,
    why: () => "全部测试都通过了。",
    whyWrong: () => {
      const i = lastResult?.cases?.findIndex((c) => !c.ok) ?? -1;
      if (i < 0) return "";
      const c = lastResult.cases[i];
      return mistakeFor(c, cur.tests[i]) || c.message || "";
    },
    code: getCode,
    setCode: (t) => setDoc(view, t, t.length),
    viewedSolution: () => viewed,
    openHint,
    destroy() { saver.flush(); clearInterval(tick); document.removeEventListener("visibilitychange", onHide); },
  };
}
