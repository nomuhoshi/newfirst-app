// 实验预览（EXP=名字）专用：把 localStorage 的键全部加上 "exp-<名字>:" 前缀，避免读写正式版（同一 github.io 域名）的学习进度。
// 正式构建里 __EXP__ 为空字符串，这个文件什么也不做。必须是 app.js 的第一个 import。
if (typeof __EXP__ !== "undefined" && __EXP__) {
  const real = window.localStorage, P = `exp-${__EXP__}:`;
  const mine = () => { const ks = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } return ks; };
  const shim = {
    getItem: (k) => real.getItem(P + k),
    setItem: (k, v) => real.setItem(P + k, v),
    removeItem: (k) => real.removeItem(P + k),
    clear: () => mine().forEach((k) => real.removeItem(P + k)),
    key: (i) => mine()[i] ?? null,
    get length() { return mine().length; },
  };
  try { Object.defineProperty(window, "localStorage", { value: shim, configurable: true }); } catch { /* 不允许覆盖就保持原样 */ }
}
