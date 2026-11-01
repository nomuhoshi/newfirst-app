// 自制编程键盘。按键用 pointerdown + preventDefault，避免点按键时编辑器失去焦点。
import { typeChar, commands } from "./editor.js";

const LETTERS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["{shift}", "z", "x", "c", "v", "b", "n", "m", "{backspace}"],
  ["{123}", "(", ")", "{space}", ":", ".", '"', "{enter}"],
];
const SYMBOLS = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["+", "-", "*", "/", "=", "<", ">", "!", "%", "_"],
  ["(", ")", "[", "]", "{", "}", ",", "'", "#", "{backspace}"],
  ["{abc}", ":", ".", "{space}", '"', "{enter}"],
];
// 操作栏：始终显示在键盘最上面
const ACTIONS = ["{tab}", "{untab}", "{undo}", "{left}", "{right}", "{system}"];

const LABELS = {
  "{shift}": "⇧", "{backspace}": "⌫", "{123}": "123", "{abc}": "ABC", "{space}": "space",
  "{enter}": "Enter", "{tab}": "Tab", "{untab}": "⇧Tab", "{undo}": "Undo",
  "{left}": "←", "{right}": "→", "{system}": "⌨︎",
};
const ARIA = {
  "{shift}": "Shift 大写", "{backspace}": "Backspace 退格", "{space}": "空格", "{enter}": "Enter 换行",
  "{tab}": "Tab 缩进", "{untab}": "Shift Tab 退缩进", "{undo}": "Undo 撤销", "{left}": "光标左移",
  "{right}": "光标右移", "{system}": "切换到系统键盘", "{123}": "数字和符号", "{abc}": "字母",
};

export function createKeyboard(root, view, { onToggleSystem }) {
  let layer = "abc";
  let shift = false;

  function press(key) {
    switch (key) {
      case "{shift}": shift = !shift; render(); return;
      case "{123}": layer = "sym"; render(); return;
      case "{abc}": layer = "abc"; render(); return;
      case "{space}": typeChar(view, " "); break;
      case "{enter}": commands.enter(view); break;
      case "{backspace}": commands.backspace(view); break;
      case "{tab}": commands.tab(view); break;
      case "{untab}": commands.untab(view); break;
      case "{undo}": commands.undo(view); break;
      case "{left}": commands.left(view); break;
      case "{right}": commands.right(view); break;
      case "{system}": onToggleSystem(); return;
      default:
        typeChar(view, shift ? key.toUpperCase() : key);
        if (shift) { shift = false; render(); }
    }
    view.dispatch({ scrollIntoView: true });
  }

  function makeRow(keys, cls) {
    const row = document.createElement("div");
    row.className = "kb-row " + (cls || "");
    for (const k of keys) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "kb-key";
      b.dataset.key = k;
      if (k.startsWith("{")) b.classList.add("kb-fn", "kb-" + k.slice(1, -1));
      if (k === "{shift}" && shift) b.classList.add("kb-on");
      b.textContent = LABELS[k] || (shift && k.length === 1 ? k.toUpperCase() : k);
      if (ARIA[k]) b.setAttribute("aria-label", ARIA[k]);
      b.addEventListener("pointerdown", (e) => { e.preventDefault(); press(k); });
      row.appendChild(b);
    }
    return row;
  }

  function render() {
    root.replaceChildren(makeRow(ACTIONS, "kb-actions"), ...(layer === "abc" ? LETTERS : SYMBOLS).map((r) => makeRow(r)));
  }

  render();
  return { press, render };
}
