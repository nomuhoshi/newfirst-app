# 54 正式版体验修复：D5 选项排法、D6 反馈区（验收记录）

更新：2026-11-11 东京 20:1x（程序员）。截图：d5 预览 4 张（提交 `6e0eaaa`）；正式站 D5 + d6 预览 8 张（提交 `952d9fa`）。

## 1. D5：代码 / 多行输出选项单列（PR #60）

| 验收项 | 状态 | 对应 SHA 或环境 | 证据 | 负责人 |
|---|---|---|---|---|
| 390 宽自动化（390×450、390×844 × WebKit / Chromium） | **自动化通过** | `fcac0a5`，run 43002188359（main） | `tests/choice-layout.test.mjs` | 程序员 |
| 预览 d5 桌面人工复核 | **人工通过（桌面 Chrome）** | 预览 d5（`preview/d5` 6fb1416，应用代码 = `ddbeae4`），19:09–19:11 | 下表 4 项，截图见 §1.1 | 传话员 |
| 390 宽窄窗人工 | **未验**（桌面工具截图固定 1920×1072，没能缩到约 390px） | — | — | — |
| iPhone Safari / 主屏幕 PWA | **未验** | 无设备 | — | iPhone 测试者 |
| 正式部署 | **已部署** | main `fcac0a50337fe0188ad0fd946f26cf5ca69085b2`；Pages deployment 7707592520（2026-11-11 10:24 UTC = 19:24 东京）；回退点 `cfb368a` | 线上「我的」页应显示「应用版本：2026-11-11 10:16 UTC」、缓存版本 `2026-11-11T10:16:43.543Z` | 程序员 |
| 线上复核（版本、选项布局、答题反馈、进度保存） | **人工通过（桌面 Chrome）** | 正式站 `fcac0a5`，19:47–19:52 | §1.2 | 传话员 |

### 1.1 传话员 d5 复核原文要点（东京 19:10，桌面 Chrome）

| # | 结果 | 内容 | 截图 |
|---|---|---|---|
| 1 | PASS | U1L1 第一题三个选项上下单列、左对齐，各占一行，无折行 | [01_u1l1_options.png](evidence/2026-11-11-d5-preview/01_u1l1_options.png) |
| 2 | PASS | 选第二项（带引号的「欢迎光临！」）只它蓝色高亮；检查后第二项红、第一项绿，下方「不对哦」、解析、正确答案、「继续」 | [02_wrong_selected.png](evidence/2026-11-11-d5-preview/02_wrong_selected.png)、[03_wrong_checked.png](evidence/2026-11-11-d5-preview/03_wrong_checked.png) |
| 3 | PASS | U1L1 第三题多行输出：「营业时间⏎10⏎22」「10⏎22⏎营业时间」原样分行，「营业时间 10 22」单行；边框完整、间隙清楚 | [04_multiline_horizontal.png](evidence/2026-11-11-d5-preview/04_multiline_horizontal.png) |
| 4 | PASS（桌面范围） | 水平滚轮 deltaX=1500 页面不横移，无横向滚动条；390px 窄窗未验，不记为通过 | 同上 |

（已入库：提交 `6e0eaaa`。）

### 1.2 正式站 D5 复核（东京 19:47–19:52，桌面 Chrome）

| # | 结果 | 内容 | 截图 |
|---|---|---|---|
| 1 | PASS | 「我的」：应用版本 2026-11-11 10:16 UTC；缓存版本 2026-11-11T10:16:43.543Z；首次打开即是新版 | [01_prod_version.png](evidence/2026-11-11-d6-preview-and-prod/01_prod_version.png) |
| 2 | PASS | U1L1 复习：选项单列；选带引号的「"欢迎光临！"」→ 检查后它红、「欢迎光临！」绿，反馈“不对哦” | [02_prod_options.png](evidence/2026-11-11-d6-preview-and-prod/02_prod_options.png)、[03_prod_wrong_checked.png](evidence/2026-11-11-d6-preview-and-prod/03_prod_wrong_checked.png) |
| 3 | PASS | 刷新前后：连续 1 天、50 XP、已完成 1/34、红心 5/5；U1L1 已完成、U1L2 当前；进行中的复习题不保留，已保存进度不变 | [04_prod_after_refresh.png](evidence/2026-11-11-d6-preview-and-prod/04_prod_after_refresh.png) |

## 2. D6：反馈区过高时内部滚动、「继续」贴底（PR #62，产品官 19:11 批准独立修复发布）

- **复现（修复前，正式版产物）**：`tests/feedback-scroll.test.mjs` 对正式版构建跑 Chromium：U3L8 排序题（正确答案 8 行）在 390×450 下「继续」不在视口内；390×300（模拟键盘打开）下 U1L1、U3L8、U5L7 共 10 项「继续」不可见；合计 12 项失败。
- **修复**：反馈区不被题目区挤压，最高 min(72dvh, 100dvh − 130px)，超出时内部滚动；「继续」贴底并避开安全区（iOS 浏览器与原 80px 底部留白一致）。只改 CSS。
- **验收测试**（390×844、390×450、390×300 × WebKit / Chromium）：U3L8（选输出 8–9 行、排序 8 行）、U5L7（填空长程序）、U1L1（短反馈）；答案可滚动读全、「继续」在顶部和滚到底时都可见可点、最后一行不被遮住、在反馈区上滚动不带动题目区和整页、点「继续」进入下一题；390×844 下短反馈不出现内部滚动。
- **键盘**：正式版答题页没有输入框（填空是点词块），不会弹键盘；用 390×300 视口模拟“键盘打开后可视区变矮”。真机键盘未验。

| 验收项 | 状态 | 对应 SHA 或环境 | 证据 | 负责人 |
|---|---|---|---|---|
| 修复后自动化 | **自动化通过**：PR CI run 43003264198；main CI run 43007952241（build、WebKit、Chromium、deploy 全绿）；本地 Chromium 对预览 d6 产物 102/102 | `fix/feedbar-scroll` `f7c5f22` | `tests/feedback-scroll.test.mjs` | 程序员 |
| 预览 d6 人工复核 | **人工通过（桌面 Chrome 响应式，含 375×375 短屏；不是 iPhone）** | https://nomuhoshi.github.io/newfirst-app-preview/d6/（`preview/d6` 0a16177），19:47–19:52 | §2.1 | 传话员 |
| 合并部署 | **已部署**（产品官 19:52 放行） | main `f7c5f22f…`（见 §4）；Pages deployment 7708405781（11:05 UTC = 20:05 东京）；回退点 `fcac0a5` | §4 | 程序员 |
| 正式站 D6 复核 | **人工通过（桌面 Chrome 响应式 375×375；不是 iPhone）** | 正式站 `f7c5f22`，20:18–20:23 | §4.1；截图提交 `8e88bea` | 传话员 |
| 390×300 | **短视口模拟**（自动化），不记作真机键盘通过；当前点选答题页没有输入框，本批不追加键盘验收 | — | — | — |

## 3. 传话员复核单

**正式站（D5 已上线）**：https://nomuhoshi.github.io/newfirst-app/
1. 「我的」页底部：应用版本「2026-11-11 10:16 UTC」、缓存版本以 `2026-11-11T10:16:4` 开头（如仍是 07:39，刷新一两次让新版本生效）。
2. U1L1 第一题：选项单列；选错一个 → 检查 → 红 / 绿和解析正常。
3. 做完一关（或接着上次的进度）后刷新：XP、红心、已完成关卡不变。

**预览 d6**（尽量用 DevTools 设备模式缩到 iPhone SE 375×667 或更矮；做不到就记“窄屏未验”）：
1. U1L1 选错一题：反馈区正常，「继续」可点。
2. 进到 U3L8 需要先完成前面的关（可在预览里导入进度文件，或只验 U1–U2 的排序题）：排序题故意排错 → 反馈区能上下滚、最后一行能看到、「继续」一直在底部可点；在反馈区上滚动时背后题目不动。

### 2.1 d6 预览复核（东京 19:47–19:52，桌面 Chrome DevTools 响应式；不是 iPhone 真机）

| # | 结果 | 内容 | 截图 |
|---|---|---|---|
| 4 | PASS | DevTools Responsive：375×667，另缩到 375×500、375×375 | [05_d6_375x667.png](evidence/2026-11-11-d6-preview-and-prod/05_d6_375x667.png) |
| 5a | PASS | U1L1 排序题故意排错：375×667 全段可读；375×375 反馈区出现独立滚动条，滚到底能读到最后一行「红心 -1（剩 4 颗）。这道题稍后再做一次。」 | [06_d6_scroll_before.png](evidence/2026-11-11-d6-preview-and-prod/06_d6_scroll_before.png)、[07_d6_scroll_bottom.png](evidence/2026-11-11-d6-preview-and-prod/07_d6_scroll_bottom.png) |
| 5b | PASS | 「继续」始终在反馈底部可见，实际点击成功，回到稍后再做的排序题 | [07_d6_scroll_bottom.png](evidence/2026-11-11-d6-preview-and-prod/07_d6_scroll_bottom.png)、[08_d6_continue_clicked.webp](evidence/2026-11-11-d6-preview-and-prod/08_d6_continue_clicked.webp) |
| 5c | PASS | 用桌面真实指针在反馈区滚动（含滚到底后继续滚），背后题目标题位置前后都是 x=18, y=-42, 324×57。最初一次自动滚轮在设备模式下坐标不准、误滚了题目，不作为隔离测试 | — |

## 4. 发布记录

| 时间（东京） | 事件 | SHA / 链接 |
|---|---|---|
| 19:15 | D5：#60 快进合并 main | `fcac0a50337fe0188ad0fd946f26cf5ca69085b2`；回退点 `cfb368a` |
| 19:24 | D5 部署 | run 43002188359；deployment 7707592520；应用版本 2026-11-11 10:16 UTC，缓存版本 2026-11-11T10:16:43.543Z |
| 19:58 | D6：#62 快进合并 main（最新提交即已验的 `f7c5f22`；与 main 差异只有 `src/game.css` +4 行、`tests/feedback-scroll.test.mjs`、`tests/webkit/run.mjs` 一行） | `f7c5f22`；回退点 `fcac0a5` |
| 20:05 | D6 部署 | run 43007952241（build、WebKit、Chromium、deploy 全绿）；deployment 7708405781；应用版本 **2026-11-11 10:58 UTC**，缓存版本 **2026-11-11T10:58:28.563Z** |

**正式站 D6 复核单（传话员）**：「我的」版本应为 10:58 UTC（首次打开若仍是 10:16，刷新一两次）；DevTools 响应式 375×375 下任一排序题故意排错 → 反馈区可滚到底、最后一行可见、「继续」可点、背后题目不动；刷新后已保存进度不变。截图另存 `docs/evidence/2026-11-11-d6-prod/`。

### 4.1 正式站 D6 复核（东京 20:18–20:23，桌面 Chrome DevTools 响应式 375×375；不是 iPhone 真机）

| # | 结果 | 内容 | 截图 |
|---|---|---|---|
| 1 | PASS | 首次打开提示「已更新到新版本，刷新页面后使用最新内容。」，刷新一次后：应用版本 2026-11-11 10:58 UTC；缓存版本 2026-11-11T10:58:28.563Z | [01_version.png](evidence/2026-11-11-d6-prod/01_version.png) |
| 2 | PASS | 随机练习排序题故意排错：短反馈在 375×375 完整容纳；最后一行「这道题会在本轮最后再练一次。」可见；「继续」点击后进入重练；背后标题位置前后不变（x=18, y=−68.6, 324×57） | [02_wrong_feedback.png](evidence/2026-11-11-d6-prod/02_wrong_feedback.png)、[03_feedback_bottom.png](evidence/2026-11-11-d6-prod/03_feedback_bottom.png)、[04_continue_clicked.webp](evidence/2026-11-11-d6-prod/04_continue_clicked.webp) |
| 2b | PASS | **溢出实测**：U1L1 复习的排序题故意排错，反馈含 3 行正确答案，375×375 下出现独立滚动条；滚动后最后一行 `print("请点单")` 从被挡变为完整可见；背后标题前后不变（x=18, y=−72, 324×57）；滚到底后「继续」仍固定可见，点击成功 | [06_review_scroll_before.png](evidence/2026-11-11-d6-prod/06_review_scroll_before.png)、[07_review_scroll_bottom.png](evidence/2026-11-11-d6-prod/07_review_scroll_bottom.png)、[08_review_continue_clicked.webp](evidence/2026-11-11-d6-prod/08_review_continue_clicked.webp) |
| 3 | PASS | 刷新前后「我的」：连续 1 天、XP 50、已完成 1/34、红心 5/5；随机练习不加 XP、不扣红心；未完成的复习不计奖励 | [05_progress_after_refresh.png](evidence/2026-11-11-d6-prod/05_progress_after_refresh.png) |

**结论（已撤回）**：~~D6 本轮修复闭环（产品官 20:23）~~。产品官 2026-11-12 00:44 撤回：桌面响应式通过不足以认定 iPhone 修复完成；iPhone Safari 实测失败，见 §5。以上桌面记录保留。

## 5. iPhone 实测（老大，2026-11-12 00:40 前后）—— D6 **失败**，修复未闭环

| 项 | 结果 | 证据 |
|---|---|---|
| Safari：U1L1 填空题「屏幕要显示：今日推荐：珍珠奶茶」**答对**后 | **失败**：「继续」按钮盖住「✓ 答对了！ +10 XP」标题；反馈区下方到底部工具栏之间有大块空白 | [01_safari_correct_feedback_overlap.png](evidence/2026-11-12-iphone/01_safari_correct_feedback_overlap.png)（原图，iPhone Safari，顶部地址栏 + 底部浮动工具栏，非无痕情况待记录） |
| Safari：关闭标签页后重开 | **失败**：进度丢失（独立失败项） | 老大口述（截图待补） |
| PWA（主屏幕）版本 | 通过 | 老大口述 |
| PWA 首次从图标打开 | 进度为空：**暂记为“跨入口进度未衔接”，原因待查**（Safari 与 PWA 可能是不同存储空间，不能据此判定原存档被删） | 老大口述 |

**要点**：失败截图是**答对**状态。之前的自动化和桌面复核只测了答错路径，验收必须覆盖答对 / 答错两条路径和填空 / 排序 / 选择三种题。
**诊断**：已交 Fable 专项诊断（真实 Safari 可视高度、地址栏伸缩、安全区、`ios-browser` 80px 留白与「继续」sticky 的相互作用；进度写入时机、保存异常、启动初始化、版本升级、存储键 / 来源）。先给根因和最小修复方案，不再凭桌面尺寸加 CSS；不盲目回退，确认是本次发布引入的回归才回退对应前端变更。
