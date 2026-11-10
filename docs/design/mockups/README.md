# 设计 v3 效果稿

静态 HTML/CSS，`tokens.css` 是设计 token（与 `../design-system.md` 一致），`base.css` 是共用组件。

- 页面：`map.html`（≥ 900px 宽自动切到 iPad 两栏）、`question.html`、`feedback.html`（`#light` 答对 / `#light-wrong` 答错）、`code.html`（键盘打开）、`complete.html`。地址加 `#dark` 看深色。
- 出图：`node render.mjs png`（需要 Playwright + Chromium；Playwright 不在默认路径时用 `PW=/path/to/playwright/index.mjs node render.mjs png`），输出 iPhone 390×844 @2x 和 iPad 横屏 1180×820 @2x。
- 状态栏、数据（3 天、120 XP、4/5 体力）都是示意。
