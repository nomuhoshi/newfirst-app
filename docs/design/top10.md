# 影响最大的 10 项改动（设计 v3）

更新：2026-11-10（东京 UTC+9）。现有问题编号对应碎片编程的正式站审查（#n = 页面问题，Gn = 全局问题；截图名为审查包 `shots/` 内文件名，审查用 WebKit，iPhone 390×844、iPad 820×1180 / 1180×820）。规格细节见 `design-system.md`。优先级：P0 = 首批（GPT 指定的地图和代码页 + 全局底座），P1 = 第二批，P2 = 打磨。

| # | 改动 | 现有问题 | 改后效果 | 优先级 | 验收标准（可测） |
|---|---|---|---|---|---|
| 1 | 全局限宽 + iPad 两栏 | G1、#7、#19、#24、#37、#41、#49：iPad 上卡片、按钮、底部面板拉满 1100px（`01-home_ipad-landscape`、`04-question_ipad-landscape`、`09-complete_ipad-portrait`） | [map_ipad-landscape-light](mockups/png/map_ipad-landscape-light.png)：左 400 主卡 + 右 ≤ 560 地图，左侧导航栏 | P0 | 1180×820 与 820×1180 下：任何按钮宽 ≤ 480；内容列 ≤ 600（编辑器 ≤ 720）；≥ 900 宽时出现两栏和侧栏、底部 Tab 消失；无横向滚动 |
| 2 | 深色模式重做三层表面 | G2、#10、#20、#29：深色下主按钮和单元卡变浅蓝亮块、选项与背景分不开（`01-home_iphone-dark`、`06-wrong_iphone-dark`、`08-right_iphone-dark`） | [map_iphone-dark](mockups/png/map_iphone-dark.png)、[feedback-wrong_iphone-dark](mockups/png/feedback-wrong_iphone-dark.png) | P0 | 深色下主按钮背景 = `#BC5823`、文字白色（对比 ≥ 4.5:1）；页面中不存在亮度 L > 0.5 的大于 120×40 的色块；`--bg/--surface/--surface-2` 三层色值与规范一致 |
| 3 | 地图：「继续学什么」主卡 + 电路主干一行一关 | #1、#3、#4、#5、#6、#8：首屏最显眼的是禁用灰块；单元卡与节点风格割裂；锁定节点一模一样（`01-home_iphone-light`、`01-home-full_iphone-light`） | [map_iphone-light](mockups/png/map_iphone-light.png) | P0 | 390×844 首屏（不滚动）可见：主卡标题、“继续学习”按钮、当前关所在行；随机练习/登录各为 ≤ 44 高的一行；三种节点状态在灰度截图下仍可区分（形状/图标不同）；主干线无截断，未点亮段与点亮段颜色不同 |
| 4 | 代码编辑页键盘态布局 | #31–#37、GPT：空位 30×20 太小、工具按钮无文字、运行按钮压代码、反馈条挡输出（`07-editor_iphone-light`、`07b-editor-filled_iphone-light`） | [code_iphone-light](mockups/png/code_iphone-light.png)、[code_iphone-dark](mockups/png/code_iphone-dark.png) | P0 | iPhone 390×844 键盘打开时：任务条、编辑器（≥ 4 行可见）、运行结果、工具栏全部在 `visualViewport` 内；运行/检查按钮与编辑器矩形不相交；所有键帽和按钮 ≥ 44 高；`:` 后回车新行自动多 4 空格 |
| 5 | 答对/答错统一反馈组件 | #25–#30：答对是一行细条、答错是大面板，深色下颜色“脏”（`06-wrong_iphone-light`、`08-right_iphone-light`） | [feedback_iphone-light](mockups/png/feedback_iphone-light.png)、[feedback-wrong_iphone-light](mockups/png/feedback-wrong_iphone-light.png) | P0 | 对/错使用同一 DOM 结构（同 class，仅修饰类不同）；两态面板在同一题下高度差 ≤ 24px；按钮颜色 = 反馈色；运行结果在面板内可见，题目区底部留白 ≥ 面板高度 |
| 6 | 题目选项竖排整宽、代码不折行 | #13、#15、#16：三选项挤成一行，`print("欢迎光临！")` 折两行（`04-question_iphone-light`） | [question_iphone-light](mockups/png/question_iphone-light.png) | P0 | 390 宽下每个选项宽 = 内容区宽、高 ≥ 64；代码选项 `scrollWidth ≤ clientWidth` 且只有一行；iPad 上最多 2 列 |
| 7 | 字号 5 级 × 字重 3 种 + 关闭代码连字 | G3、#15、#25、#39：首页 7 种字号字重组合、题目页 7 种（审查实测） | 全部效果稿 | P1 | 用审查包 `tools/m.mjs` 复测：每页字号 ∈ {13,15,17,22,28}、字重 ∈ {400,600,800}；不存在 < 13px 的文字；代码区 `font-variant-ligatures: none` |
| 8 | 统一卡片和按钮 | G4、#18、#44：3D 阴影按钮、扁平代码块、左边框提示条、虚线空位、细描边卡同时存在（`04-question_iphone-light`、`10-settings_iphone-light`） | [question_iphone-light](mockups/png/question_iphone-light.png)、[complete_iphone-light](mockups/png/complete_iphone-light.png) | P1 | CSS 中圆角值只有 8 / 16 / 999（主卡 20、面板 24 两个例外）；卡片阴影只有 `0 2px 0`，按钮只有 `0 4px 0`；完成页与“我的”页统计卡是同一组件 |
| 9 | 通关页庆祝 | #38–#42：大片空白、统计数字 17px、橙红提示像报错（`09-complete_iphone-light`） | [complete_iphone-light](mockups/png/complete_iphone-light.png)、[complete_iphone-dark](mockups/png/complete_iphone-dark.png) | P1 | 标题 28/800、统计数字 28/800、卡高 ≥ 72；首屏下半部无 > 120px 的空白带；连续天数提示用中性色；全对与非全对文案不同；`prefers-reduced-motion` 下无通电动画 |
| 10 | 顶栏带单位 + 真空管体力；清理“我的”页 | #2、#9、#43、#46、#47：0/0/5 无标签像调试信息；“测试 A/B/C”暴露给用户（`01-home_iphone-light`、`10-settings-full_iphone-light`） | [map_iphone-light](mockups/png/map_iphone-light.png) 顶栏 | P2 | 顶栏每个数字旁有单位文字；体力显示 5 支真空管 + “n/5”数字（与 #29 svg 同轮廓），无循环闪烁；正式构建下“我的”页不出现“测试”字样；音效列表折叠为一行 |

**不在本次范围**：XP、红心/体力、连续天数、解锁、会员规则的任何数值或逻辑；提示内容改写（#21 的文案层面）；吉祥物设定。
