// 预览构建（LAB=1）专用：把 localStorage 的键全部加上 "lab3:" 前缀。
// 原因：预览和正式站在同一个 github.io 域名下，浏览器的 localStorage 是按域名共享的，不隔离的话预览会读到、甚至改写正式版的学习进度。
// 正式构建里 __LAB__ 为 false，这个文件什么也不做。必须是 app.js 的第一个 import。
if (typeof __LAB__ !== "undefined" && __LAB__) {
  const real = window.localStorage, P = "lab3:";
  const mine = () => { const ks = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } return ks; };
  const shim = {
    getItem: (k) => real.getItem(P + k),
    setItem: (k, v) => real.setItem(P + k, v),
    removeItem: (k) => real.removeItem(P + k),
    clear: () => mine().forEach((k) => real.removeItem(P + k)),
    key: (i) => mine()[i] ?? null,
    get length() { return mine().length; },
  };
  try { Object.defineProperty(window, "localStorage", { value: shim, configurable: true }); } catch { /* 极少数浏览器不允许覆盖：保持原样 */ }
}
