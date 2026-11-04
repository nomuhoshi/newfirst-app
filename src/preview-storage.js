// 测试入口（构建时设了 PREVIEW_ID）专用：把 localStorage 的键全部加上 "<id>:" 前缀，和正式站隔离。
// 原因：测试入口和正式站同在 github.io 域名下，localStorage 按域名共享，不隔离的话测试登录/转存会碰到正式版的游客进度。
// 正式构建里 __PREVIEW_ID__ 是空字符串，这个文件什么也不做。必须是 app.js 的第一个 import。
if (typeof __PREVIEW_ID__ !== "undefined" && __PREVIEW_ID__) {
  const real = window.localStorage, P = __PREVIEW_ID__ + ":";
  const mine = () => { const ks = []; for (let i = 0; i < real.length; i++) { const k = real.key(i); if (k && k.startsWith(P)) ks.push(k.slice(P.length)); } return ks; };
  const shim = {
    getItem: (k) => real.getItem(P + k), setItem: (k, v) => real.setItem(P + k, v), removeItem: (k) => real.removeItem(P + k),
    clear: () => mine().forEach((k) => real.removeItem(P + k)), key: (i) => mine()[i] ?? null, get length() { return mine().length; },
  };
  try { Object.defineProperty(window, "localStorage", { value: shim, configurable: true }); } catch { /* 极少数浏览器不允许覆盖：保持原样 */ }
}
