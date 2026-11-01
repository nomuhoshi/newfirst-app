// 代码编辑器（CodeMirror 6）的设置，以及给自制键盘用的编辑命令。
import { EditorState, Compartment, EditorSelection } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import {
  history, undo, indentMore, indentLess,
  deleteCharBackward, cursorCharLeft, cursorCharRight, defaultKeymap, historyKeymap,
} from "@codemirror/commands";
import { closeBrackets, closeBracketsKeymap, insertBracket, deleteBracketPair } from "@codemirror/autocomplete";
import { python } from "@codemirror/lang-python";
import { indentUnit } from "@codemirror/language";

const INDENT = "    "; // 4 个空格

// 去掉行尾的 # 注释（忽略字符串里的 #），用来判断“代码部分”是否以冒号结尾
export function codePart(text) {
  let quote = null;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\") { i++; continue; }
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") {
      quote = c;
    } else if (c === "#") {
      return text.slice(0, i);
    }
  }
  return text;
}

// inputmode="none" 让手机不弹出系统键盘；切换成 "text" 就用系统键盘
const inputModeConf = new Compartment();
const inputModeAttr = (useSystem) =>
  EditorView.contentAttributes.of({ inputmode: useSystem ? "text" : "none", autocapitalize: "off", autocorrect: "off", spellcheck: "false" });

export function createEditor(parent, doc = "") {
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc,
      extensions: [
        lineNumbers(),
        drawSelection(),
        // newGroupDelay: 0 → 每次按键单独算一步撤销（规格要求至少能撤销 20 次）
        history({ newGroupDelay: 0, minDepth: 100 }),
        closeBrackets(),
        python(),
        indentUnit.of(INDENT),
        EditorState.tabSize.of(4),
        // 外接键盘：Tab / Shift+Tab 缩进（按 Esc 后再按 Tab 可以离开编辑区）
        keymap.of([{ key: "Tab", run: (v) => { commands.tab(v); return true; }, shift: (v) => { commands.untab(v); return true; } }]),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
        inputModeConf.of(inputModeAttr(false)),
        EditorView.lineWrapping,
      ],
    }),
  });
  return view;
}

export function setSystemKeyboard(view, useSystem) {
  view.dispatch({ effects: inputModeConf.reconfigure(inputModeAttr(useSystem)) });
  // iOS 只在“用户刚点了按钮”的同一时刻允许弹出键盘，所以这里同步重新聚焦，不用延迟
  view.contentDOM.blur();
  view.focus();
}

const BRACKETS = new Set(["(", ")", "[", "]", "{", "}", "'", '"']);

// 自制键盘输入一个字符
export function typeChar(view, ch) {
  if (BRACKETS.has(ch)) {
    const tr = insertBracket(view.state, ch); // 自动配对 / 跳过右括号 / 包裹选区
    if (tr) { view.dispatch(tr); return; }
  }
  view.dispatch(view.state.replaceSelection(ch), { scrollIntoView: true, userEvent: "input.type" });
}

export const commands = {
  tab(view) {
    const sel = view.state.selection.main;
    if (sel.empty) {
      view.dispatch(view.state.replaceSelection(INDENT), { scrollIntoView: true, userEvent: "input.type" });
    } else {
      indentMore(view);
    }
  },
  untab: (view) => indentLess(view),
  // Enter：沿用当前行的缩进；如果光标前的内容以冒号结尾（if/else/for 等），再多缩进一级
  enter(view) {
    const { state } = view;
    const sel = state.selection.main;
    const line = state.doc.lineAt(sel.from);
    const before = state.sliceDoc(line.from, sel.from);
    let indent = /^ */.exec(line.text)[0];
    if (indent.length > before.length) indent = indent.slice(0, before.length);
    if (/:\s*$/.test(codePart(before))) indent += INDENT;
    view.dispatch(state.replaceSelection("\n" + indent), { scrollIntoView: true, userEvent: "input" });
    return true;
  },
  backspace: (view) => deleteBracketPair(view) || deleteCharBackward(view),
  undo: (view) => undo(view),
  left: (view) => cursorCharLeft(view),
  right: (view) => cursorCharRight(view),
};

// 测试用：直接设置内容和选区
export function setDoc(view, text, anchor = text.length, head = anchor) {
  view.dispatch({
    changes: { from: 0, to: view.state.doc.length, insert: text },
    selection: EditorSelection.range(anchor, head),
  });
}
