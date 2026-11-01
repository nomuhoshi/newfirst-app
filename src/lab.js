// 第一步：技术验证页面的入口。
import "./style.css";
import { createEditor, setSystemKeyboard } from "./editor.js";
import { createKeyboard } from "./keyboard.js";
import { Runner } from "./runner.js";
import { describeError } from "./errors.js";
import { onActivate } from "./activate.js";

const $ = (id) => document.getElementById(id);
const statusEl = $("status");
const outEl = $("output");
const runBtn = $("run");
const stopBtn = $("stop");
const kbEl = $("keyboard");
const sysBar = $("system-bar");

const view = createEditor($("editor"), "");
let useSystem = false;

createKeyboard(kbEl, view, { onToggleSystem: toggleSystem });

function toggleSystem() {
  useSystem = !useSystem;
  setSystemKeyboard(view, useSystem);
  kbEl.hidden = useSystem;
  sysBar.hidden = !useSystem;
}
onActivate($("back-to-kb"), toggleSystem);

// 输出区：只用 textContent，绝不把用户输出当 HTML
function setOutput(text, cls = "") {
  outEl.textContent = text;
  outEl.className = cls;
}
function appendOutput(text) {
  outEl.textContent += text;
  outEl.scrollTop = outEl.scrollHeight;
}

let loadStart = performance.now();
const runner = new Runner({
  onStatus(s, info = {}) {
    switch (s) {
      case "loading":
        loadStart = performance.now();
        statusEl.textContent = "Python 加载中…";
        break;
      case "slowLoad":
        statusEl.innerHTML = "";
        statusEl.append("加载超过 30 秒。 ");
        const retry = document.createElement("button");
        retry.textContent = "重试"; retry.className = "link";
        retry.onclick = () => runner.boot();
        statusEl.append(retry);
        break;
      case "ready": {
        const sec = ((performance.now() - loadStart) / 1000).toFixed(1);
        statusEl.textContent = `Python 已就绪（加载用时 ${sec} 秒）`;
        break;
      }
      case "loadError":
        statusEl.textContent = "Python 加载失败：" + (info.msg || "") + "（检查网络后点 Run 重试）";
        break;
      case "running":
        statusEl.textContent = "运行中…";
        setOutput("");
        break;
      case "done":
        if (info.error) {
          appendOutput((info.hadOutput ? "\n" : "") + describeError(info.error));
          outEl.className = "error";
          statusEl.textContent = "运行出错（代码已保留，修改后可再次运行）";
        } else {
          if (!info.hadOutput) setOutput("程序运行完成，没有输出", "muted");
          statusEl.textContent = "运行成功";
        }
        break;
      case "timeout":
        appendOutput("\n⏱ 运行超过 5 秒，已自动停止。是不是写了死循环？");
        outEl.className = "error";
        break;
      case "stopped":
        appendOutput("\n■ 已停止。");
        break;
      case "outputLimit":
      case "outputLimitStopped":
        appendOutput("\n⚠ 输出超过 100 行或 8 KB，已停止。");
        outEl.className = "error";
        statusEl.textContent = "已达到输出上限";
        break;
    }
    const running = runner.state === "running";
    runBtn.disabled = running || runner.state === "loading";
    stopBtn.disabled = !running;
  },
  onOutput: appendOutput,
});

onActivate(runBtn, () => {
  if (runner.state === "loadError") { runner.boot(); return; }
  runner.run(view.state.doc.toString());
});
onActivate(stopBtn, () => runner.stop());

// iPhone 弹出系统键盘时，可视区域会变小：按实际可视高度排版，并让当前行保持可见
const vv = window.visualViewport;
if (vv) {
  const fit = () => {
    document.documentElement.style.setProperty("--app-h", vv.height + "px");
    view.dispatch({ scrollIntoView: true });
  };
  vv.addEventListener("resize", fit);
  fit();
}

runner.boot(); // 页面打开后就在后台加载 Python，不挡住编辑
view.focus();

// 给自动测试用
window.__app = { view, runner };
