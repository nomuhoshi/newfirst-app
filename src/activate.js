// 让按钮既能被手指点（pointerdown，不抢编辑器焦点），
// 也能被外接键盘 Enter/空格、读屏软件激活（click），而且一次操作只执行一次。
//
// 注意“幽灵点击”：手指按下后界面变了（比如键盘弹出），浏览器随后补发的 click
// 可能落在另一个刚出现的按钮上。所以刚有过任何 pointerdown 时，忽略 click。
let lastPointerDown = 0;
addEventListener("pointerdown", () => { lastPointerDown = Date.now(); }, true);

export function onActivate(el, fn) {
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault(); // 不让按钮抢走编辑器的焦点
    fn(e);
  });
  el.addEventListener("click", (e) => {
    if (Date.now() - lastPointerDown < 800) return; // 这次点击已经由 pointerdown 处理过（或是幽灵点击）
    fn(e);
  });
}
