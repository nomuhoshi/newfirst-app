# Brilliant 调研报告（为「碎片编程」）

> 调研日期：2026-11-03（JST）　调研人：Grok Bot　仓库基线：`nomuhoshi/newfirst-app` main
> 证据目录：`docs/research/brilliant/`（截图 + `logs/` 下的 Playwright 脚本、逐屏文本日志、帮助中心原文摘录）

## 0. 方法、版本与实际路径

| 项 | 内容 |
|---|---|
| Web 版 | brilliant.org，2026-11-03 21:50–22:20 JST 实测 |
| 浏览器 | Playwright WebKit（iPhone 13 设备描述：390×844，DPR 3，竖屏 / 横屏 / 深色 + 减少动态）与 Chromium（iPhone 13 视口、1280×800 桌面） |
| 原生 App | **未安装、未体验**（按要求）。仅用 App Store 资料：*Brilliant: Learn Math & Coding* v10.6.1，2026-10-27 发布（UTC，即 JST 10-27 21:50），需 iOS 17.0+，评分 4.73（33,295 条），免费下载含内购。来源：https://apps.apple.com/us/app/brilliant-learn-math-coding/id913335252 |
| 约束 | 未注册、未付款、未装 App；只在年龄框填了一个通用值「30」以便通过非账号问卷 |

**实际路径（Web，iPhone 视口，WebKit 与 Chromium 一致）**
1. `/` 首页 → 点 “Get started / I’m a learner” → `/welcome/`
2. 欢迎屏「Hi, I’m Koji!」→ Continue
3. 学什么：Math / Computer Science & Coding → 选 CS
4. 动机：Excelling in school / Professional growth / Staying sharp / Helping my child learn
5. 当前需要：Prepare for a test / Catch up / Get ahead / Learn something new
6. 说明屏「我会提问来摸清你的水平，然后制定学习计划」
7. 声音：Melodic / Deep，带 Voice on 开关（Koji 会朗读）
8. 年龄（输入框）
9. 编程水平：Beginner / Novice / Intermediate / Advanced（每项一行解释）
10. 「We have everything you need.」安抚屏
11. 每日目标：10 / 20 / 30 / 60 min
12. 学习时段：Morning / Afternoon / Nightly / Another time
13. **`/signup/`：「Create a free profile to discover your learning plan」——注册墙，在此停止**（截图 `wk-iphone-flow2-16.png`）

另尝试：`/courses/thinking-in-python/` 课程大纲页可匿名浏览（70 节 / 943 题，14 个 Level，每 Level 以 *Level Review* 收尾），但点 *Start* 同样跳回 `/welcome/` 流程（`wk-iphone-course-start.png`）。`/pricing/` 返回 404（价格页实际在 `/subscribe`，需登录，未访问）。

**结论：匿名状态下 Web 版看不到任何一道真实课程题。** 第 2–5 节中所有关于课内题型、提示、反馈的描述均为 **资料分析**，不是实测。

标注约定：**实测** = 本次 Playwright 亲眼所见；**资料分析** = 官方帮助中心 / App Store 文字；**未验证** = 无法观察（尤其是一切声音）。

---

## 1. 首次体验

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 注册前先问 10 屏问卷（学科、动机、需求、声音、年龄、水平、每日目标、时段），一屏一题、大卡片单选、顶部分段进度条 | 让用户先“投入”再注册（承诺一致性），同时收集个性化数据 | 实测：`b3.log` 第 0–16 屏；从点击 CTA 到注册墙 ≈ 50 秒、11 次点击 | 进到注册墙前**零学习内容**；对“只想看看 Python 是什么”的零基础用户是纯摩擦；问卷多为营销分群 | 不照搬。我们现在 3 屏引导后直接进地图，更好；最多加 1 题「你写过代码吗？」用于换文案 | 低 |
| 注册墙放在“看你的学习计划”之前，文案是 *free profile* | 把注册包装成领取结果，转化率高 | 实测：`wk-iphone-flow2-16.png` | 用户付出 1 分钟后被拦，挫败感强；不注册就无法试第一题 | **明确不采用**：碎片编程保持“无账号可学完第一单元”，账号同步（见 docs/15）只做可选 | — |
| 问卷中出现付费前不提价格；付费说明见帮助中心（试用需填支付信息、到期自动续费） | 把付费决策推迟到投入之后 | 资料分析：help/pricing-and-plans/does-brilliant-offer-any-free-trials | 本次未到达付费页，付费墙具体位置 **未验证** | 不做试用转订阅 | — |
| 每日目标 10–60 min 选项 | 设定预期、为提醒和连胜铺垫 | 实测：`wk-iphone-flow2-12.png` | 10 分钟起步对碎片场景仍偏长 | 若做目标，用「每天 1 关（约 3 分钟）」这种以关卡计数的目标 | 低 |

## 2. 教学

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 课程粒度：Topic → Unit(Level) → Concept(Lesson)；Thinking in Python 70 节 943 题 ≈ 每节 13 题；每个 Level 末尾固定一节 *Level Review* | 小步快走 + 单元末尾检测“是否真会” | 实测：课程大纲页 `wk-iphone-course.png`、`b4.log` | 每节 13 题对 iPhone 碎片时间偏长 | 我们每关 3–5 题合适；**在每单元末尾加一关“单元复盘”**，混合本单元题型并含一道代码改写 | 中 |
| “Learning by doing”：多数题是交互（拖动、输入表达式、直接操纵），极少纯选择；有 *Start over* 重置 | 用操作代替阅读，降低长文字解释负担 | 资料分析：help/features/how-do-i-use-interactives-on-brilliant | 交互组件开发成本极高；碎片编程无法每题定制可视化 | 只挑一种低成本“可操纵”：在 predict 题里允许**改一个值→重跑→看输出变化**（Pyodide 已在） | 中 |
| 提示：AI 导师 Koji 能“看到屏幕”、在画布上画、引导而**不直接给答案** | 卡住时按学习者具体错误给苏格拉底式引导 | 资料分析：help/features/how-does-koji-work、App Store 描述 | 依赖 LLM，成本高、可能出错；免费用户只有“有限预览” | 不做 AI；但采用其**原则**：提示分级“方向→指出位置→答案”，不要第 2 次点就给答案 | 低 |
| 错误反馈具体内容 | — | **未验证**（无法匿名进入题目） | — | 我们已有每个错误选项的 `why`，保持 | — |
| 复习：Level Review、可重做（隔天重做可再得 XP）、可从某点“reset progress to here” | 让复习有回报但不可刷（同日重复不给 XP） | 资料分析：help/features/what-is-xp、can-i-reset-course-progress | 未见间隔重复调度的官方说明 → 是否有 SRS **未验证** | 采用“同日重复复习不再给 XP / 不再回红心”的防刷规则（需另立规则变更，本 PR 不改） | 低 |
| 独立应用验证 | 每 Level 的 Review + 课程从“预测/拖拽”逐步到写代码（Thinking in Code → Python） | 资料分析 + 大纲结构推断 | 具体验证方式 **未验证** | 我们的“变式练习”应**不显示原题代码**、换变量名和情境，并且不提供“答案”按钮，只给分级提示 | 中 |

## 3. 机制

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 连胜：当天完成 3 题或 1 个 concept 即 +1 | 门槛低，鼓励“每天来一下” | 资料分析：help/features/what-is-a-streak | 3 题门槛可能鼓励只做最少量 | 连胜门槛 = 完成 1 关（我们关卡本来就短） | 低 |
| Streak Charge：最多存 2 个，漏一天自动使用，不过期；长连胜还可能自动免费保护一次 | 降低“断签”带来的放弃（损失厌恶的反噬） | 资料分析：what-is-a-streak-charge | 规则复杂，需要解释 UI | **优先采用**简化版：每周 1 次自动“保签”，无需购买 | 低 |
| XP + 30 人周联赛，10 级，按周排名升降 | 给中高活跃用户社交竞争 | 资料分析：what-are-leagues-and-leaderboards | 刷 XP、焦虑；对零基础新手是压力而非动力；需要服务器 | **明确不采用** | 高 |
| 免费版“每天 2 把钥匙”= 2 个 concept；必须顺序学习 | 以内容量限流做付费点 | 资料分析：what-s-the-difference-between-free-and-premium | 限流卡住学习势头；但“顺序解锁”本身是教学设计 | 我们用红心而非每日关卡上限，保持；顺序解锁保留 | — |
| 未见“红心/体力”（错误不扣命） | 鼓励试错 | 资料分析（帮助中心无相关条目） | 无 | 我们的红心会惩罚试错；建议用户试玩验证（见假设 H2） | — |

## 4. 视觉设计（实测，Web）

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 白底、近黑大标题（几何无衬线、粗）、单一强调色绿色用于进度条与主角，问卷卡片为浅灰圆角大卡 + 插画图标 | 一屏一焦点，层级极清楚 | 实测：`wk-iphone-flow2-02.png`、`-12.png` | 风格偏“营销问卷”，学习页实际样式未见 | 我们已有电路板风格，不改；只借鉴“**一屏一问、主按钮固定底部**” | — |
| 底部全宽主按钮，未选择时灰色禁用，选中后变实色 | 防误触，明确“先选再继续” | 实测：`cr-iphone-flow-10.png`（Continue 灰色） | 禁用按钮无原因提示 | 我们“检查”按钮已同样处理，保持 | — |
| 顶部：返回箭头 + 分段进度条 + 喇叭（声音）开关 | 随时可退、知道还剩多少、可静音 | 实测：`cr-iphone-flow-10.png` | — | **采用**：关卡顶栏加声音快捷开关（目前在“我的”页） | 低 |
| 深色模式：课程大纲页跟随系统变深色（均值亮度 242→75），但首页和 /welcome 问卷仍为浅色 | — | 实测：`wk-iphone-course-dark.png` vs `wk-iphone-dark-03-cta.png` | 深色支持不一致，夜间从课程页进入问卷会闪白 | 我们 game.css 已有深色；检查所有 sheet 都跟随 | 低 |
| 横屏：问卷只是拉宽，主按钮横跨整屏，Cookie 横幅遮挡底部 | — | 实测：`wk-iphone-land-03-cta.png` | 横屏未专门适配 | 我们 iPad 横屏应限制内容最大宽度（约 560px）并居中 | 低 |
| 角色：Koji（绿色方块脸图标）出现在每屏左上 | 让问卷像对话 | 实测 | 不复制其形象 | 小码已承担此角色，保持原创 | — |

## 5. 交互节奏

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 问卷：选卡片 → 底部按钮亮起 → 点 Continue → 约 0.3–0.5 s 过渡进入下一屏；每屏切换无网络等待感 | 节奏快、无加载焦虑 | 实测：日志时间戳每屏 2–3 s（含脚本 2.2 s 等待） | 选择后**不自动前进**，多一步点击 | 保持“选→检查”两步：学习题需要确认，避免误触 | — |
| 连续快速点击 Continue：WebKit 下第一次脚本点击因 Cookie 横幅覆盖而超时 | 横幅拦截点击 | 实测：`b1.log` “locator.click Timeout” | 浮层抢占底部主按钮位置 | 我们的 toast/sheet 不要覆盖底部主按钮 | 低 |
| 课内“检查→结果→继续→完成”的具体状态 | — | **未验证**（注册墙） | — | — | — |
| 返回：每屏左上返回箭头，可回改答案 | 降低选错焦虑 | 实测 | — | 关卡内保留“退出”确认（我们已有） | — |

## 6. 声音与触感

| 项 | 结论 |
|---|---|
| 点击音、答对音、答错音、完成音 | **未验证**（无法听音频，且未进入课程） |
| Koji 语音 | 资料/界面文字显示有 “How do you want me to sound? Melodic / Deep，Voice on” 并提示“Turn up your volume”——说明有 TTS 语音；音色与内容 **未验证** |
| 顶部喇叭图标 | 实测可见（静音入口），点击效果未验证 |
| 触感（haptics） | **未验证**（Web 无法感知，原生 App 未安装） |

对碎片编程：我们的键盘点击音是自有资产，继续使用；不要参考或模仿 Brilliant 的任何声音。可借鉴的仅是“声音开关放在随手可点的位置”。

## 7. 长期使用

| 观察到的设计 | 解决的问题 | 证据 | 缺点／适用条件 | 对碎片编程的建议 | 实现成本 |
|---|---|---|---|---|---|
| 跨设备自动同步进度（需账号） | 换设备不丢进度 | 资料分析：can-i-download-…-offline | 必须联网、必须账号 | 我们 localStorage 先行，账号同步按 docs/15 可选 | 高 |
| 首页显示连胜与 Streak Charge（电池图标）；iOS 小组件显示连胜状态并“全天提示练习” | 在 App 外提醒回来 | 资料分析：what-is-a-streak、does-brilliant-have-a-widget | 小组件对 Web App 不可用 | PWA 无小组件；用“回到地图时自动滚到当前关”替代 | 低 |
| 通知：每日练习提醒、联赛提醒、课程更新、优惠；Web 只管邮件，App 管推送 | 召回 | 资料分析：how-can-i-adjust-my-notification-preferences | 优惠推送是打扰 | 不做推送（iOS PWA 推送需授权，且对新手是噪音） | — |
| 复习入口：Level Review、Redo 图标、Review 按钮 | 主动复习 | 资料分析：can-i-reset-course-progress | — | 我们已完成关卡可“复习”，保持；在地图上标出“建议复习” | 中 |

## 8. 商业模式（资料分析）

- 免费：可访问全部内容，但**每天 2 把钥匙（2 个 concept/练习）**、必须顺序学习、concept 之间有广告、Koji 仅有限预览。
- Premium（年/月/家庭 6 人）：无限 concept、完整 Koji、无广告、可跳到任意课。价格只在 `/subscribe` 显示（需登录，未查看）。
- 试用：有时提供，**需先填支付信息**，到期自动转付费；建议提前 24 小时取消。
- 到期/取消：保留 Premium 到本计费周期结束，之后回到免费限制（来源：how-do-i-cancel-my-brilliant-premium-subscription）。具体降级后进度表现 **未验证**。
- URL：https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/ 、…/does-brilliant-offer-any-free-trials/ 、…/how-much-does-brilliant-premium-cost/ 、https://brilliant.org/help/using-brilliant/what-can-i-learn-on-brilliant-without-a-premium-subscription/

对我们：**适合**——“内容免费、为增值服务付费”（若未来有付费，应是额外题库/项目，而不是限制每日学习量）。**会伤害零基础学习者**——每日关卡上限（打断刚建立的势头）、关卡间广告、需绑卡的试用、注册前不给试学。

## 9. 无障碍与可靠性

| 项 | 观察 | 证据 |
|---|---|---|
| 触控目标 | 课程页 Level 行 358×64、主按钮 322×48、Sign up 102×48；但页顶一个图标链接仅 114×24（低于 44pt） | 实测：`b4.log` TARGETS |
| 文字缩放 | 未测（需原生动态字体） | 未验证 |
| 减少动态 | 用 `reducedMotion: reduce` 打开课程页无可见差异；动效本身少 | 实测（弱证据） |
| 弱网/离线 | 官方明确：需要联网，不支持下载或离线 | 资料分析：can-i-download-brilliant-lessons-or-use-them-offline |
| 错误恢复 | `/pricing/` 404 页有“Go home”和数学笑话，友好；题目内 *Start over* 重置 | 实测 `wk-iphone-02pricing.png`；资料分析 |
| 年龄输入 | 问卷含年龄（kidSAFE 合规用途） | 实测 |

对我们：Pyodide 首次加载大，**离线/弱网是我们可以反超 Brilliant 的点**——已加载过一次后用 Service Worker 缓存 Pyodide 与 content/*.json。

---

## 优先采用的 5 项

1. **单元末尾“单元复盘”关**：混合本单元题型，至少一道需改写代码，作为“会独立应用”的检查点（对应 Brilliant 的 Level Review）。
2. **提示分级，不在第二次点击就给答案**：方向 → 指出关键行/位置 → 最后才给答案并标记“本题看过答案”，变式题再考一次。
3. **简化版“保签”**：每周自动 1 次漏签保护，无需购买，避免一次断签导致放弃。
4. **关卡顶栏加声音开关 + 分段进度**：与返回并列，随手静音（地铁/课堂场景）。
5. **无账号试学 + 离线缓存**：保持首屏 3 步内进入第一题；Pyodide 与课程内容缓存后可离线继续——这是 Brilliant 明确做不到的。

## 明确不建议采用的 3 项

1. **注册前长问卷 + 注册墙**（10 屏问卷后才要求注册，且看不到任何题）——对零基础用户纯摩擦。
2. **周联赛 / 排行榜**——鼓励刷 XP、给新手压力，且需服务器。
3. **每日学习量上限（钥匙）与需绑卡的试用**——在学习势头最好时打断，并制造付费焦虑。

## 需要用户试玩验证的假设

- H1：零基础用户更愿意“先做题后了解”，3 屏引导已足够；加一题“写过代码吗？”不会增加流失。
- H2：答错扣红心让新手不敢试错；改为“只有看答案/连续答错才扣”是否提升完成率（**本 PR 不改规则**，仅待验证）。
- H3：单元复盘关里的“改写代码”题对零基础用户难度可接受（完成率 ≥ 70%）。
- H4：分级提示（3 级）比现在 2 级（提示→答案）更少直接看答案，且不显著拖慢。
- H5：顶栏声音开关会被使用（看点击率），键盘点击音不被关闭的比例。
- H6：iPad 横屏把内容限制在约 560px 宽更易读。

## 当前 App 对应页面的具体改法

（基于 main 的 `src/app.js`、`src/game.css`、`content/unit1.json`、`content/unit2.json`。注：main 目前题型为 predict / fill / order，尚无独立的“代码任务/变式”数据结构，下文第 2、5 条对应新增内容格式。本 PR 只写文档，不改代码。）

1. **`renderPath()`（关卡地图）+ `content/course.json`/`unitN.json`**：在每个单元 `lessons` 末尾增加一个 `review: true` 的“单元复盘”关（地图已支持 `hexNode(st, review)` 的复盘图标），题目从本单元各关抽取并附加 1 道 fill/改写题。
2. **`renderExercise()` 中 `helpBtn` 处理函数**：现在是 `hintShown ? correctAnswerText(ex) : ex.hint` 两级；改为三级：`ex.hint` → `ex.hint2`（指出位置，可在代码块高亮行）→ 答案；看过答案时在 `run` 上记一笔，`renderFinish()` 中显示“有 N 题看过答案，已加入复习”。
3. **`lessonHeader(run)`**：在红心/护盾旁增加声音开关按钮，复用“我的”页的音效设置与 `feel` 模块（`src/feel.js`）；点击区域 ≥ 44×44。
4. **`statsBar()` 与 streak 逻辑（`currentStreak(state)`，`src/storage.js`）**：增加每周 1 次自动保签的状态与说明，在 `renderMe()` 的统计卡显示“本周保签：可用/已用”。（属于奖励规则变更，需单独 PR 与用户确认。）
5. **`renderOnboarding()`**：保持 3 屏；可选在第 2 屏加“写过代码吗？”两个按钮，只影响文案，不影响解锁。
6. **`src/game.css`**：为 `.lesson`、`.onboard`、`.lsheet` 增加 `max-width: 560px; margin-inline: auto`（iPad 横屏）；检查所有 sheet 在 `prefers-color-scheme: dark` 下的颜色；`prefers-reduced-motion` 已有（第 267 行），确认反馈动画都被覆盖。
7. **`src/py-worker.js` / 构建配置**：增加 Service Worker 缓存 Pyodide 与 `content/*.json`，`showRun()` 在离线且未缓存时给出明确提示而非一直加载。

## 证据索引

- 首页：`wk-iphone-01-home.png`、`cr-desktop-01-home.png`；横屏 `wk-iphone-land-*.png`；深色 `wk-iphone-dark-*.png`
- 引导问卷：`wk-iphone-flow2-00…16.png`、`cr-iphone-flow2-00…16.png`；年龄屏 `cr-iphone-flow-10.png`
- 注册墙：`wk-iphone-flow2-16.png`
- 课程大纲：`wk-iphone-course.png`、`wk-iphone-course-dark.png`、`wk-iphone-course-start.png`
- 日志：`logs/b1.log`、`logs/b3.log`（逐屏文本与时间）、`logs/b4.log`（帮助链接、课程大纲、触控尺寸）、`logs/help.txt`（帮助中心原文）
