# Brilliant 调研报告（为「碎片编程」）

> 调研日期：2026-11-03（JST）　调研人：Grok Bot　仓库基线：`nomuhoshi/newfirst-app` main
> 证据目录：`docs/research/brilliant/`（截图 + `logs/` 下的 Playwright 脚本、逐屏文本日志、帮助中心原文摘录）

## 0. 方法、版本与实际路径

| 项 | 内容 |
|---|---|
| Web 版 | brilliant.org，2026-11-03 21:50–22:20 JST 实际体验 |
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

**结论：匿名状态下 Web 版看不到任何一道真实课程题。** 第 2–5 节中所有关于课内题型、提示、反馈的描述均为 **官方资料**，不是实际体验。

标注约定（四种）：**实际体验** = 本次 Playwright 亲眼所见；**官方资料** = 官方帮助中心 / App Store / Google Play 文字；**推断** = 由资料或第三方材料推理；**未验证** = 无法观察；**未验证** = 无法观察（尤其是一切声音）。

---

## 1. 首次体验

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 注册前先问 10 屏问卷（学科、动机、需求、声音、年龄、水平、每日目标、时段），一屏一题、大卡片单选、顶部分段进度条 | 让用户先“投入”再注册（承诺一致性），同时收集个性化数据（**假设**：其目的是提高注册转化；我们没有任何转化率数据） | 实际体验：`b3.log` 第 0–16 屏；从点击 CTA 到注册墙 ≈ 50 秒、11 次点击 | 进到注册墙前**零学习内容**；对“只想看看 Python 是什么”的零基础用户是纯摩擦；问卷多为营销分群 | 不照搬。我们现在 3 屏引导后直接进地图；“这比 Brilliant 更好”只是**假设**，没有对比数据，需试玩验证（见 H1）；最多加 1 题「你写过代码吗？」用于换文案 | 低 |
| 注册墙放在“看你的学习计划”之前，文案是 *free profile* | 把注册包装成领取结果（**假设**：可提高注册转化；无数据，未验证） | 实际体验：`wk-iphone-flow2-16.png` | 用户付出 1 分钟后被拦，挫败感强；不注册就无法试第一题 | **明确不采用**：碎片编程保持“无账号可学完第一单元”，账号同步（见 docs/15）只做可选 | — |
| 问卷中出现付费前不提价格；付费说明见帮助中心（试用需填支付信息、到期自动续费） | 把付费决策推迟到投入之后 | 官方资料：help/pricing-and-plans/does-brilliant-offer-any-free-trials | 本次未到达付费页，付费墙具体位置 **未验证** | 不做试用转订阅 | — |
| 每日目标 10–60 min 选项 | 设定预期、为提醒和连胜铺垫 | 实际体验：`wk-iphone-flow2-12.png` | 10 分钟起步对碎片场景仍偏长 | 若做目标，用「每天 1 关（约 3 分钟）」这种以关卡计数的目标 | 低 |

## 2. 教学

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 课程粒度：Topic → Unit(Level) → Concept(Lesson)；Thinking in Python 70 节 943 题 ≈ 每节 13 题；每个 Level 末尾固定一节 *Level Review* | 小步快走 + 单元末尾检测“是否真会” | 实际体验：课程大纲页 `wk-iphone-course.png`、`b4.log` | 每节 13 题对 iPhone 碎片时间偏长 | 我们每关 3–5 题合适；**在每单元末尾加一关“单元复盘”**，混合本单元题型并含一道代码改写 | 中 |
| “Learning by doing”：多数题是交互（拖动、输入表达式、直接操纵），极少纯选择；有 *Start over* 重置 | 用操作代替阅读，降低长文字解释负担 | 官方资料：help/features/how-do-i-use-interactives-on-brilliant | 交互组件开发成本极高；碎片编程无法每题定制可视化 | 只挑一种低成本“可操纵”：在 predict 题里允许**改一个值→重跑→看输出变化**（Pyodide 已在） | 中 |
| 提示：AI 导师 Koji 能“看到屏幕”、在画布上画、引导而**不直接给答案** | 卡住时按学习者具体错误给苏格拉底式引导 | 官方资料：help/features/how-does-koji-work、App Store 描述 | 依赖 LLM，成本高、可能出错；免费用户只有“有限预览” | 不做 AI；但采用其**原则**：提示分级“方向→指出位置→答案”，不要第 2 次点就给答案 | 低 |
| 错误反馈具体内容 | — | **未验证**（无法匿名进入题目） | — | 我们已有每个错误选项的 `why`，保持 | — |
| 复习：Level Review、可重做（隔天重做可再得 XP）、可从某点“reset progress to here” | 让复习有回报但不可刷（同日重复不给 XP） | 官方资料：help/features/what-is-xp、can-i-reset-course-progress | 未见间隔重复调度的官方说明 → 是否有 SRS **未验证** | 采用“同日重复复习不再给 XP / 不再回红心”的防刷规则（需另立规则变更，本 PR 不改） | 低 |
| 独立应用验证 | 每 Level 的 Review + 课程从“预测/拖拽”逐步到写代码（Thinking in Code → Python） | 官方资料 + 大纲结构推断 | 具体验证方式 **未验证** | 我们的“变式练习”应**不显示原题代码**、换变量名和情境，并且不提供“答案”按钮，只给分级提示 | 中 |

## 3. 机制

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 连胜：当天完成 3 题或 1 个 concept 即 +1 | 门槛低，鼓励“每天来一下” | 官方资料：help/features/what-is-a-streak | 3 题门槛可能鼓励只做最少量 | 连胜门槛 = 完成 1 关（我们关卡本来就短） | 低 |
| Streak Charge：最多存 2 个，漏一天自动使用，不过期；长连胜还可能自动免费保护一次 | 降低“断签”带来的放弃（损失厌恶的反噬） | 官方资料：what-is-a-streak-charge | 规则复杂，需要解释 UI | **优先采用**简化版：每周 1 次自动“保签”，无需购买 | 低 |
| XP + 30 人周联赛，10 级，按周排名升降 | 给中高活跃用户社交竞争 | 官方资料：what-are-leagues-and-leaderboards | 刷 XP、焦虑；对零基础新手是压力而非动力；需要服务器 | **明确不采用** | 高 |
| 免费版“每天 2 把钥匙”= 2 个 concept；必须顺序学习 | 以内容量限流做付费点 | 官方资料：what-s-the-difference-between-free-and-premium | 限流卡住学习势头；但“顺序解锁”本身是教学设计 | 我们用红心而非每日关卡上限，保持；顺序解锁保留 | — |
| 未见“红心/体力”（错误不扣命） | 鼓励试错 | 推断（帮助中心 92 篇文章中无相关条目） | 无 | 我们的红心会惩罚试错；建议用户试玩验证（见假设 H2） | — |

## 4. 视觉设计（实际体验，Web）

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 白底、近黑大标题（几何无衬线、粗）、单一强调色绿色用于进度条与主角，问卷卡片为浅灰圆角大卡 + 插画图标 | 一屏一焦点，层级极清楚 | 实际体验：`wk-iphone-flow2-02.png`、`-12.png` | 风格偏“营销问卷”，学习页实际样式未见 | 我们已有电路板风格，不改；只借鉴“**一屏一问、主按钮固定底部**” | — |
| 底部全宽主按钮，未选择时灰色禁用，选中后变实色 | 防误触，明确“先选再继续” | 实际体验：`cr-iphone-flow-10.png`（Continue 灰色） | 禁用按钮无原因提示 | 我们“检查”按钮已同样处理，保持 | — |
| 顶部：返回箭头 + 分段进度条 + 喇叭（声音）开关 | 随时可退、知道还剩多少、可静音 | 实际体验：`cr-iphone-flow-10.png` | — | **采用**：关卡顶栏加声音快捷开关（目前在“我的”页） | 低 |
| 深色模式：课程大纲页跟随系统变深色（均值亮度 242→75），但首页和 /welcome 问卷仍为浅色 | — | 实际体验：`wk-iphone-course-dark.png` vs `wk-iphone-dark-03-cta.png` | 深色支持不一致，夜间从课程页进入问卷会闪白 | 我们 game.css 已有深色；检查所有 sheet 都跟随 | 低 |
| 横屏：问卷只是拉宽，主按钮横跨整屏，Cookie 横幅遮挡底部 | — | 实际体验：`wk-iphone-land-03-cta.png` | 横屏未专门适配 | 我们 iPad 横屏应限制内容最大宽度（约 560px）并居中 | 低 |
| 角色：Koji（绿色方块脸图标）出现在每屏左上 | 让问卷像对话 | 实际体验 | 不复制其形象 | 小码已承担此角色，保持原创 | — |

## 5. 交互节奏

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 问卷：选卡片 → 底部按钮亮起 → 点 Continue → 过渡进入下一屏（时长约 0.3–0.5 s 为**推断**，未计时）；每屏切换无网络等待感 | 节奏快、无加载焦虑 | 实际体验：日志时间戳每屏 2–3 s（含脚本 2.2 s 等待） | 选择后**不自动前进**，多一步点击 | 保持“选→检查”两步：学习题需要确认，避免误触 | — |
| 连续快速点击 Continue：WebKit 下第一次脚本点击因 Cookie 横幅覆盖而超时 | 横幅拦截点击 | 实际体验：`b1.log` “locator.click Timeout” | 浮层抢占底部主按钮位置 | 我们的 toast/sheet 不要覆盖底部主按钮 | 低 |
| 课内“检查→结果→继续→完成”的具体状态 | — | **未验证**（注册墙） | — | — | — |
| 返回：每屏左上返回箭头，可回改答案 | 降低选错焦虑 | 实际体验 | — | 关卡内保留“退出”确认（我们已有） | — |

## 6. 声音与触感

| 项 | 结论 |
|---|---|
| 点击音、答对音、答错音、完成音 | **未验证**（无法听音频，且未进入课程） |
| Koji 语音 | 资料/界面文字显示有 “How do you want me to sound? Melodic / Deep，Voice on” 并提示“Turn up your volume”——说明有 TTS 语音；音色与内容 **未验证** |
| 顶部喇叭图标 | 实际体验可见（静音入口），点击效果未验证 |
| 触感（haptics） | **未验证**（Web 无法感知，原生 App 未安装） |

对碎片编程：我们的键盘点击音是自有资产，继续使用；不要参考或模仿 Brilliant 的任何声音。可借鉴的仅是“声音开关放在随手可点的位置”。

## 7. 长期使用

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| 跨设备自动同步进度（需账号） | 换设备不丢进度 | 官方资料：can-i-download-…-offline | 必须联网、必须账号 | 我们 localStorage 先行，账号同步按 docs/15 可选 | 高 |
| 首页显示连胜与 Streak Charge（电池图标）；iOS 小组件显示连胜状态并“全天提示练习” | 在 App 外提醒回来 | 官方资料：what-is-a-streak、does-brilliant-have-a-widget | 小组件对 Web App 不可用 | PWA 无小组件；用“回到地图时自动滚到当前关”替代 | 低 |
| 通知：每日练习提醒、联赛提醒、课程更新、优惠；Web 只管邮件，App 管推送 | 召回 | 官方资料：how-can-i-adjust-my-notification-preferences | 优惠推送是打扰 | 不做推送（iOS PWA 推送需授权，且对新手是噪音） | — |
| 复习入口：Level Review、Redo 图标、Review 按钮 | 主动复习 | 官方资料：can-i-reset-course-progress | — | 我们已完成关卡可“复习”，保持；在地图上标出“建议复习” | 中 |

## 8. 商业模式（官方资料）

- 免费：可访问全部内容，但**每天 2 把钥匙（2 个 concept/练习）**、必须顺序学习、concept 之间有广告、Koji 仅有限预览。
- Premium（年/月/家庭 6 人）：无限 concept、完整 Koji、无广告、可跳到任意课。价格只在 `/subscribe` 显示（需登录，未查看）。
- 试用：有时提供，**需先填支付信息**，到期自动转付费；建议提前 24 小时取消。
- 到期/取消：保留 Premium 到本计费周期结束，之后回到免费限制（来源：how-do-i-cancel-my-brilliant-premium-subscription）。具体降级后进度表现 **未验证**。
- URL：https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/ 、…/does-brilliant-offer-any-free-trials/ 、…/how-much-does-brilliant-premium-cost/ 、https://brilliant.org/help/using-brilliant/what-can-i-learn-on-brilliant-without-a-premium-subscription/

> 注：本节及全文关于“内容免费 / 无账号试学”的建议**不替代已批准的会员方案**，只作为在该方案内设计免费范围时的参考。

对我们：**适合**——“内容免费、为增值服务付费”（若未来有付费，应是额外题库/项目，而不是限制每日学习量）。**会伤害零基础学习者**——每日关卡上限（打断刚建立的势头）、关卡间广告、需绑卡的试用、注册前不给试学。

## 9. 无障碍与可靠性

| 项 | 观察 | 证据 |
|---|---|---|
| 触控目标 | 课程页 Level 行 358×64、主按钮 322×48、Sign up 102×48；但页顶一个图标链接仅 114×24（低于 44pt） | 实际体验：`b4.log` TARGETS |
| 文字缩放 | 未测（需原生动态字体） | 未验证 |
| 减少动态 | 用 `reducedMotion: reduce` 打开课程页无可见差异；动效本身少 | 实际体验（弱证据） |
| 弱网/离线 | 官方明确：需要联网，不支持下载或离线 | 官方资料：can-i-download-brilliant-lessons-or-use-them-offline |
| 错误恢复 | `/pricing/` 404 页有“Go home”和数学笑话，友好；题目内 *Start over* 重置 | 实际体验 `wk-iphone-02pricing.png`；官方资料 |
| 年龄输入 | 问卷含年龄（kidSAFE 合规用途） | 实际体验 |

对我们：离线/弱网可能是差异点，但要分开说：**App 外壳（HTML/CSS/JS、content/*.json）离线可打开，并不证明离线能运行 Python**。完整缓存 Pyodide 需要单独评估：体积（运行时 + 标准库 + 包，首次下载与存储配额）、更新策略（版本升级时缓存失效与回滚）、失败恢复（缓存损坏、配额被系统清理、下载中断时的提示与重试）。在评估完成前，不能宣称“离线可学”。

### 9.1 浏览器文字缩放实际体验（2026-11-03 JST，WebKit 与 Chromium，iPhone 13 视口）

脚本 `logs/b5.mjs`（复制自 `/workspace/preview-build/b5.mjs`），数据 `brilliant/logs/b5-zoom.log`，截图 `brilliant/zoom-{wk,cr}-{home,course,welcome,help}-{root200,tsa200,zoom200}.png`。三种方式：(a) 根字号 200%（`html{font-size:200%}`，模拟用户默认字号变大）；(b) `text-size-adjust:200%`（模拟移动端文字缩放）；(c) CSS `zoom:2`（近似页面 200% 缩放）。

| 方式 | WebKit | Chromium | 结论 |
|---|---|---|---|
| (a) 根字号 200% | 根字号 16→32px，但首页 H1 30px、正文 14px、帮助页 H1 40px **不变**；只有课程页/欢迎页部分按钮与正文（rem 单位）变为 32px | 同 WebKit | 大部分文字用 px 固定，**不跟随用户字号**；只部分组件跟随 |
| (b) text-size-adjust 200% | 无任何变化（headless WebKit 不响应此属性，**结论不确定**） | 全部文字放大一倍（H1 30→60、帮助 H1 40→80），四页均**无横向溢出**（scrollWidth 保持 390） | Chromium 下排版能正确重排 |
| (c) CSS zoom 2 | 首页 scrollWidth 420、课程页 498 → **出现横向滚动**；欢迎页、帮助页无溢出 | 在 (b) 基础上叠加测量（等效更大），首页 720、课程 568、帮助 529 均溢出 | 页头（Logo + 登录按钮）与课程卡在高倍缩放时溢出，截图可见“Sign up”被截 |

局限：这是网页近似，**原生 iOS 动态字体（Dynamic Type）仍为 未验证**；Chromium 的 (c) 与 (b) 叠加，不是纯 200%。

对碎片编程：字号用 rem、关卡页在 `html{font-size:200%}` 下自测一次，确认“检查”按钮与代码块不横向溢出。

---

## 10. 第二阶段：无需账号的公开资料补充

**记录**：2026-11-03 23:18–23:22 JST；平台：Linux 上 Playwright WebKit（iPhone 13 视口，390×844）+ curl；未注册、未登录、未安装 App、未点击任何付款按钮。
**步骤**：① 抓取帮助中心首页的全部 92 个文章链接（`logs/helpurls.txt`），读取与提示、复习、钥匙、Koji、会员、到期相关的 11 篇（`logs/help2.txt`）；② 读 `/about/`、`/cs/tutor/`、`/resources/coding/interactive-python-for-teens/`、Google Play 详情页；③ 在 WebKit iPhone 视口打开上述页面并截图，读取计算样式（`logs/b6-public.log`，脚本 `logs/b6.mjs`）；④ 在课程页点 Level 1 → 点 “Updating Variables”，确认**不能匿名预览单节课**（URL 不变，截图 `pub-course-lesson-tap.png`）；⑤ 下载 `/cs/tutor/` 页面自动播放的两段官方演示视频，只抽帧作证据（`official-demo-*-frames.jpg`），**视频本身不入库**；⑥ 用 `reducedMotion` 开/关对比首页动画数。

标签：**实际体验** = 本次亲手在浏览器中看到；**官方资料** = brilliant.org、App Store、Google Play 上的官方文字或官方演示视频；**推断** = 从资料或第三方材料推理，未经官方证实；**未验证** = 未能观察。
（第 1–9 节旧标签对应：实测 → 实际体验，资料分析 → 官方资料。）

### 10.1 来源（访问日期均为 2026-11-03 JST）

| # | 来源 | 页面日期 | 类型 |
|---|---|---|---|
| S1 | https://brilliant.org/about/ （“Targeted practice and review”“Visual and interactive”段落） | 页面未注明日期 | 官方资料 |
| S2 | https://brilliant.org/help/schools-and-educators/differentiation-guide/ | 页面上有，未记录 | 官方资料 |
| S3 | https://brilliant.org/help/schools-and-educators/how-brilliant-fits-into-a-math-lesson/ | 页面上有，未记录 | 官方资料 |
| S4 | https://brilliant.org/help/pricing-and-plans/what-s-the-difference-between-free-and-premium/ | 2026-10-30 更新 | 官方资料 |
| S5 | https://brilliant.org/help/pricing-and-plans/what-is-brilliant-premium-and-how-do-i-subscribe/ | 页面上有，未记录 | 官方资料 |
| S6 | https://brilliant.org/help/account-management/how-do-i-cancel-my-brilliant-premium-subscription/ | 页面上有，未记录 | 官方资料 |
| S7 | https://brilliant.org/help/pricing-and-plans/does-brilliant-offer-any-free-trials/ | 2026-08-03 更新 | 官方资料 |
| S8 | https://brilliant.org/help/features/how-does-koji-work/ | 页面上有，未记录 | 官方资料 |
| S9 | https://brilliant.org/cs/tutor/ （含两段自动播放的演示视频） | 未注明 | 官方资料 |
| S10 | https://brilliant.org/resources/coding/interactive-python-for-teens/ | 未注明 | 官方资料 |
| S11 | https://brilliant.org/help/features/is-brilliant-good-for-learners-with-dyscalculia/ | 页面上有，未记录 | 官方资料 |
| S12 | Google Play：https://play.google.com/store/apps/details?id=org.brilliant.android | 2026-10-30 更新；含广告、含内购 | 官方资料 |
| S13 | https://www.paigeormiston.com/brilliant （前设计师作品集，讲题目流程改版） | 未注明 | 第三方 → 只作**推断** |
| S14 | https://mobbin.com/explore/flows/29d8be7e-47f8-483e-a5cf-1c0c7c9a288b （“Showing explanation”流程） | 未注明 | 第三方 → 只作**推断** |

### 10.2 核心表

| 观察到的设计 | 解决的问题 | 证据 | 缺点与适用条件 | 我们对应页面怎么改 | 实现成本 |
|---|---|---|---|---|---|
| **提示由 Koji 承担**：能看到学习者屏幕，在题目上叠加图形和提示，可朗读，可用聊天一步步引导；官方说法是“不直接给答案”，讲不懂可以让它换个讲法或拆细 | 卡住时给针对具体错误的帮助，又不让答案来得太容易 | 官方资料 S8、S11、S9 | 依赖 AI，成本高；免费版只有“有限预览”（S4）。是否有固定的“提示 1/2/3”级数：**未验证** | 不做 AI。在 `renderExercise()` 的小码提示里借用同一原则：先提示方向，再指出代码位置，最后才给答案（按 PR #19 / #24 的字段，不另建提示系统） | 低 |
| **什么时候给答案**：第三方材料称，作答后可在底部反馈条里“显示答案”并看讲解，然后可以再答一次同一题 | 让“看答案”成为学习步骤，而不是放弃 | 推断：S13、S14（第三方）；官方 S2 只说答错会显示“try again”和分步讲解 | 来源不是官方，现行版本是否这样：**未验证**（待 B 项实测） | 看过答案后要求做 `variation`（`requiresVariationAfterSolution`），不是同一题再点一次 | 中（#19 已有字段） |
| **看完答案后怎么确认真学会**：每节课结尾有 Skills Check；没全对就换一批新题再来；练习集里“脚手架撤掉”——没有视觉辅助和提示，测独立作答 | 把“跟着做对”和“自己会做”分开检验 | 官方资料 S1、S2 | 练习不给提示，对零基础可能太陡；新题是否是“同概念换数字”：**未验证** | 变式题与复习关里不显示提示和原题代码，只允许“查看相关讲解”；不改红心/XP | 中 |
| **单元复盘**：每个 Level 约 6 节课 + 一节 Level Review；Level Review 让学习者跨整节检查理解并“继续前回顾错误”；混合前面多课题目的复习集在按课程逐步上线（官方说每题都经人工审核） | 跨课程混合练习，逼学习者自己判断该用哪种方法 | 官方资料 S3、S2、S1；实际体验：课程大纲每个 Level 末尾都有 “Level Review”（`pub-course-level1.png`） | 复习集“逐步上线”，Python 课是否已有：**未验证** | 复用现有 `review: true` 复习关与项目关，在其中混合本单元题型、至少一道改写代码题；不新增关卡类型，不改解锁 | 中 |
| **独立写代码**：官方说 Thinking in Python 70 节都运行真实 Python；61 节要诊断或修 bug；301 个“补全核心逻辑”的程序；不需安装 | 从读代码 → 补逻辑 → 自己调试逐步过渡 | 官方资料 S10、S9 | 官方给的 Thinking in Python 题数不一致：S10 写 874 题，课程页写 943 题（实际体验 `pub-course.png`）。**第一节要求从空白写代码的课是哪节：未验证** | 我们的代码任务（PR #19）也从“补全”起步；在 `content` 中标注每关的“独立程度”（预测→填空→补全→改写），供后续排序参考 | 低 |
| **官方演示中的代码题交互**：代码中有空槽，点下方词块填入（不用键盘）；运行时显示 “Running”；输出区先变黄、再变绿；迷宫/网格可视化随代码逐行执行，左侧箭头标出当前行 | 手机上不打字也能写代码；把执行过程变成可见的 | 官方资料（宣传演示视频，非真实课程）：`official-demo-cs-mobile-frames.jpg`、`official-demo-interactive-frames.jpg`，来自 S9 | 演示视频经过剪辑，节奏和颜色含义（黄=错？）都是**推断**；不复制其画面和配色 | 我们的 fill 题已是点词块；可在 `showRun()` 输出面板加“当前行”指示，沿用电路板风格（如电流点亮当前行），不照搬箭头和配色 | 中 |
| **重新进入与续学**：帮助中心可按单节“Reset lesson”，网页版可“Reset progress to here”（从此处起清空）；进度跨设备同步 | 想重来时不必整门课清零 | 官方资料（第 7 节已引用 can-i-reset-course-progress） | 中途关掉页面后能否回到原题：**未验证**（待 C 项实测） | 我们 `renderPath()` 的“当前关”已能续学；关卡中途退出是否保留进度属于规则，不在本 PR 改 | — |
| **页面层级与字体**：标题用自家定制字体（计算样式为 “CoFo Brilliant” 无衬线 700；部分页面标题用 “CoFo Robert”），正文 16px，次要文字为黑色 40–60% 透明度；主按钮为绿色 `rgb(41,204,87)` 胶囊形（圆角 54px），白底 | 用一种强调色加大量留白，把注意力引到唯一的主操作 | 实际体验：`logs/b6-public.log`、`pub-about.png`、`pub-cs-tutor.png` | 只测到营销页和课程目录，**课内页面未验证**；字体和配色都是品牌资产，不能用 | 保持电路板风格。只借鉴结构：每屏一个主操作、次要文字降低对比度（但保持 WCAG 4.5:1），在 `game.css` 里检查 `.lessonfoot` 只有一个强调色按钮 | 低 |
| **动效与减少动态**：首页正常时有 35 个 Web Animation，开启“减少动态”后只剩 1 个；但自动播放的静音演示视频仍在播放 | 尊重系统“减少动态”设置 | 实际体验：`logs/b6-public.log` 最后两行 | 视频不受控制，对前庭敏感用户仍有刺激 | 我们 `game.css` 第 267 行已有 `prefers-reduced-motion`；检查答对/完成动画与电路板动态背景都在其中关闭 | 低 |
| **交互中等待**：演示视频里运行代码时有 “Running” 状态标签 | 告诉用户“正在算”，避免重复点击 | 官方资料（演示视频帧） | 真实课程里的等待时长：**未验证** | `check()` 已有“检查中”并禁用按钮；Pyodide 首次加载时在运行按钮上也显示状态 | 低 |
| **声音开关**：问卷页顶栏有喇叭图标；Koji 可朗读题目和讲解（S8、S11）；官方说会提供“声音、反馈和触感” | 让声音成为可选项 | 实际体验（看到图标）；官方资料 S1 | **具体声音、点击后的效果、触感全部未验证** | 之后另开小 PR：复用已保存的声音偏好，开关远离“检查”按钮，绝不误触提交 | 低 |
| **免费与付费边界**：免费每天 2 把钥匙，每把开 1 节课或 1 组练习，当地午夜重置；用完要等第二天；免费只能按顺序学；课程间有广告；Koji 只有有限预览，用完要升级。付费去掉以上限制，可跳到任意课 | 用每日学习量 + AI 导师来区分 | 官方资料 S4、S5；Google Play 标注“含广告”（S12） | 付费墙具体出现在哪一屏：**未验证**（待 E 项）；`/subscribe` 需登录，未访问 | 对我们：**本节不建议任何会员规则变化**，已批准的会员方案不变；只记录“限制每日学习量”对零基础的风险（见不采用第 3 条） | — |
| **会员到期**：取消后保留 Premium 到本计费周期结束；Web 有退款入口（符合条件时），App Store / Google Play 订阅在商店里取消；试用需填支付信息、不取消会自动转付费 | 规则透明，减少纠纷 | 官方资料 S6、S7 | 到期后具体界面（锁哪些、进度是否保留）：官方没有写，**未验证**，且按要求只用官方资料 | 我们的会员方案按已批准文档执行；可借鉴“到期提示写清楚保留什么” | — |

### 10.3 本阶段新发现小结

1. 官方把“学会了吗”交给三层：课内即时反馈 → 每节末尾 Skills Check（不全对就换新题）→ Level Review；练习中**撤掉提示和视觉辅助**（S1、S2）。
2. Koji 是“提示”的主体，官方一再说“不直接给答案”；而“显示答案/讲解”按钮的说法只来自第三方（S13、S14），需要实测确认。
3. Python 课以“运行真实代码、补全逻辑、修 bug”为主，演示视频显示手机上靠点词块填代码槽。
4. 课程目录可以匿名看，但**任何一节课都不能匿名预览**。
5. 减少动态能关掉页面动画，但关不掉自动播放的视频。

## 实际课程测试（待账号，Hands-on lesson test (pending account)）

条件：用户邮箱启用并批准注册后执行；iPhone 13 视口（WebKit，另用 Chromium 复核）；截图命名 `acct-NN-*.png`；每一步记录时间（JST）和 URL；不付款、`/subscribe` 只截图不点击。

**A. 进入第一节课**（零基础 Python，Thinking in Python → Level 1 → Variables）
- 每一屏都截图，记录题型（选择 / 拖动 / 填空 / 点词块 / 写代码 / 讲解）。
- 记录讲解 → 互动 → 答错 → 提示 → 重试 → 完成这一完整路径。

**B. 连续答错 3 次**
- 提示怎样逐级变化；“查看答案”什么时候出现；Koji 的回答原文；看完答案后是否必须再做一题；XP 有无差别。

**C. 中途离开与回来**
- 课中关掉页面，再打开看能否回到原题；试 Redo 和 Level Review；找到第一节要求自己从头写代码的课。

**D. 视觉与动效**
- 字号、颜色、留白、深色模式；录屏记录动效和等待时长。只写实际听到的声音；网页上的触感保持**未验证**。

**E. 用完 2 把钥匙后**
- 付费墙出现的位置；跳课时的锁；课程之间的广告；`/subscribe`（只截图，不点击）；第二天钥匙怎样恢复。会员到期体验只用官方资料。

## 优先采用的 5 项

（已按 GPT 决策更新，2026-11-03；第 10 节新证据已对应。以下都不直接改动红心、XP、解锁或会员规则。）

1. **单元复盘——原则批准**：不新增关卡类型，**复用现有的复习关（`review: true`）与项目关**，在其中混合本单元题型并含一道改写代码题。
2. **分级提示 + 变式——批准**：与 Claude 在 PR #19 定义的字段对齐（`requiresVariationAfterSolution`、`variation`）；看过答案后必须完成变式；**不另建第二套提示系统**。
3. **代码运行时显示“当前行”（第 10 节新增，待审）**：在 `showRun()` 输出区用电路板风格点亮正在执行的行，帮助理解循环与条件（依据：官方演示视频；不复制其箭头和配色）。
   - 注：原第 3 项“每周保签”按 GPT 决策**暂缓**，不在优先列表中。
4. **关卡内声音开关——之后单独小 PR**：复用已保存的声音偏好；按钮位置与实现必须保证**绝不会误触提交答案**。
5. **无账号试学与离线学习——保留**：离线 Python 执行须先完成上文 9 节所述的 Pyodide 缓存评估；本条不替代已批准的会员方案。

## 明确不建议采用的 3 项

1. **注册前长问卷 + 注册墙**（10 屏问卷后才要求注册，且看不到任何题）——对零基础用户纯摩擦。
2. **周联赛 / 排行榜**——鼓励刷 XP、给新手压力，且需服务器。
3. **每日学习量上限（钥匙）与需绑卡的试用**——在学习势头最好时打断，并制造付费焦虑。

## 需要用户试玩验证的假设

- H0：“注册前问卷/注册墙能提高 Brilliant 的注册转化”与“我们的引导更好”均为假设，无对比数据。
- H1：零基础用户更愿意“先做题后了解”，3 屏引导已足够；加一题“写过代码吗？”不会增加流失。
- H2（**仅作试玩假设，不是建议**）：答错扣红心是否让新手不敢试错。“只在看答案或连续答错时才扣”会改变奖励规则，本报告不建议改动，只在试玩中观察。
- H3：单元复盘关里的“改写代码”题对零基础用户难度可接受（完成率 ≥ 70%）。
- H4：分级提示（3 级）比现在 2 级（提示→答案）更少直接看答案，且不显著拖慢。
- H5：顶栏声音开关会被使用（看点击率），键盘点击音不被关闭的比例。
- H6：iPad 横屏把内容限制在约 560px 宽更易读。
- H7：看过答案后必须做一道变式（`requiresVariationAfterSolution`），零基础用户会接受而不会放弃本关。
- H8：在变式和复习关里不显示提示（对应 Brilliant“练习集撤掉脚手架”），零基础用户的完成率仍可接受。
- H9：在代码运行结果里显示“当前行”（电路板风格）能帮助零基础用户理解循环和条件。
- H10：Brilliant 现行版本作答后有“显示答案”入口（目前只有第三方来源），待实际课程测试 B 项确认。

## 当前 App 对应页面的具体改法

（基于 main 的 `src/app.js`、`src/game.css`、`content/unit1.json`、`content/unit2.json`。更正：main 目前题型为 predict / fill / order；代码任务 / 变式格式**已存在于未合并的 PR #19**（feat/code-task-run，代码任务页与判题链），使用该 schema 的内容在未合并的 PR #24（content/code-tasks，含 `requiresVariationAfterSolution` / `variation` 字段）。下文第 2 条应基于 #19 的字段实现，不新建格式。本 PR 只写文档，不改代码。）

1. **`renderPath()`（关卡地图）+ `content/course.json`/`unitN.json`**：在每个单元 `lessons` 末尾增加一个 `review: true` 的“单元复盘”关（地图已支持 `hexNode(st, review)` 的复盘图标），题目从本单元各关抽取并附加 1 道 fill/改写题。
2. **`renderExercise()` 中 `helpBtn` 处理函数（及 #19 的代码任务页）**：按 #19 的 `requiresVariationAfterSolution` / `variation` 字段接入；现在是 `hintShown ? correctAnswerText(ex) : ex.hint` 两级；改为三级：`ex.hint` → `ex.hint2`（指出位置，可在代码块高亮行）→ 答案；看过答案时在 `run` 上记一笔，`renderFinish()` 中显示“有 N 题看过答案，已加入复习”。
3. **`lessonHeader(run)`（之后单独小 PR）**：复用已保存的声音偏好，与“检查”按钮保持距离，确保不会误触提交；在红心/护盾旁增加声音开关按钮，复用“我的”页的音效设置与 `feel` 模块（`src/feel.js`）；点击区域 ≥ 44×44。
4. **（暂缓）`statsBar()` 与 streak 逻辑（`currentStreak(state)`，`src/storage.js`）**：增加每周 1 次自动保签的状态与说明，在 `renderMe()` 的统计卡显示“本周保签：可用/已用”。（属于奖励规则变更，需单独 PR 与用户确认。）
5. **`renderOnboarding()`**：保持 3 屏；可选在第 2 屏加“写过代码吗？”两个按钮，只影响文案，不影响解锁。
6. **`src/game.css`**：为 `.lesson`、`.onboard`、`.lsheet` 增加 `max-width: 560px; margin-inline: auto`（iPad 横屏）；检查所有 sheet 在 `prefers-color-scheme: dark` 下的颜色；`prefers-reduced-motion` 已有（第 267 行），确认反馈动画都被覆盖。
7. **`src/py-worker.js` / 构建配置**：增加 Service Worker 缓存 Pyodide 与 `content/*.json`，`showRun()` 在离线且未缓存时给出明确提示而非一直加载。

## 证据索引

- 首页：`wk-iphone-01-home.png`、`cr-desktop-01-home.png`；横屏 `wk-iphone-land-*.png`；深色 `wk-iphone-dark-*.png`
- 引导问卷：`wk-iphone-flow2-00…16.png`、`cr-iphone-flow2-00…16.png`；年龄屏 `cr-iphone-flow-10.png`
- 注册墙：`wk-iphone-flow2-16.png`
- 课程大纲：`wk-iphone-course.png`、`wk-iphone-course-dark.png`、`wk-iphone-course-start.png`
- 日志：`logs/b1.log`、`logs/b3.log`（逐屏文本与时间）、`logs/b4.log`（帮助链接、课程大纲、触控尺寸）、`logs/help.txt`（帮助中心原文）
