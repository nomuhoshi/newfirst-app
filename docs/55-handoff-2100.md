# 55 21:00 交接（2026-11-11）

更新：东京 20:1x（程序员）。状态只用：已部署 / 自动化通过 / 人工通过 / 未验 / 受阻。

## 1. 正式线上（https://nomuhoshi.github.io/newfirst-app/）

| 项 | 状态 | SHA / 版本 | 证据 |
|---|---|---|---|
| **当前线上版本** | 已部署 | main `f7c5f22`；「我的」应用版本 **2026-11-11 10:58 UTC**，缓存版本 2026-11-11T10:58:28.563Z；Pages deployment 7708405781（20:05）；回退点 `fcac0a5` | [docs/54 §4](https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/54-ux-fixes-d5-d6.md) |
| 内容范围 | 已部署 | U1–U5 游客版，34 关；账号开关**关闭**（无登录 / 注册入口，进度只存本机） | [docs/53](https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/53-online-verification-2026-11-11.md) |
| U1–U5 游客版（16:47 首发 `cfb368a`） | 已部署、自动化通过、桌面 Chrome 人工通过 | — | docs/53 + 8 张截图 |
| 体验修复 D5：代码 / 多行输出选项单列、不折行、选项内横滚 | 已部署（19:24）、390 宽自动化通过、预览和正式站桌面人工通过；390 窄窗人工未验 | `fcac0a5`，run 43002188359 | docs/54 §1，截图 `6e0eaaa`、`952d9fa` |
| 体验修复 D6：反馈区过高时内部滚动、「继续」贴底 | 已部署（20:05）、自动化通过（含 390×300 **短视口模拟**）、预览桌面响应式人工通过（含 375×375）；**正式站复核待传话员** | `f7c5f22`，run 43007952241 | docs/54 §2 |
| iPhone Safari / 主屏幕 PWA | **未验**（无设备） | — | §4 清单 |
| 账号（登录、注册、验证码、云同步） | **受阻**（C2 发信未配），开关保持关闭 | — | §3 |

## 2. 课程候选（都**没有上线**；只连测试 Supabase 的预览）

| PR | 内容 | 状态 | 预览 | 发布条件 |
|---|---|---|---|---|
| [#58](https://github.com/nomuhoshi/newfirst-app/pull/58) `f759b35` | U6 类型与报错、U7 字典（+ 第 8 单元预告） | 自动化通过（run 43008086835） | 旧 u67c（内容同源） | iPhone 真机（§4）通过 → 合并前核最新 main → 发布（产品官已放行，无需再授权） |
| [#59](https://github.com/nomuhoshi/newfirst-app/pull/59) `0e89d6f` | U8 函数 6 关 24 题 + 样板关 D1L1 支线（U3 全 8 关后解锁；计分沿用主线、不计主线完成数） | 自动化通过（run 43008090983） | 含在 u9c | 不合入正式版（独立联合分支） |
| [#61](https://github.com/nomuhoshi/newfirst-app/pull/61) `4ee4a32` | U9 小项目 6 关 24 题（已按 17:21 决定修订） | 自动化通过（run 43008095280） | https://nomuhoshi.github.io/newfirst-app-preview/u9c/ | 候选，不合入 |
| [#57](https://github.com/nomuhoshi/newfirst-app/pull/57) `2b08b25` | 账号受控验收入口 `?accounts-pilot=1`（**不是访问控制**） | 自动化通过；不合并 | — | C2 完成后 |
| 调试线 D1L2–D1L7 | 题纲已批（docs/48 §5） | 未写题 | — | 样板关真机通过后写 |
| U8L8（按名字传值） | 暂留 heldLessons | — | — | 以后定顺序 / ID / 旧进度兼容 |

## 3. SMTP（C2）配置入口 —— 需要老大登录 Supabase 后台

- 配置单：[supabase/prod-init/C2-auth-smtp.md](https://github.com/nomuhoshi/newfirst-app/blob/ops/prod-supabase-init/supabase/prod-init/C2-auth-smtp.md)（分支 `ops/prod-supabase-init` `a8a4fef`）：§1 逐项目标值、§2 邮件模板、§3 改完检查、§5 受控验收。
- 正式项目 `aqlcunkmggzzvyavlkjg`（suipian-app）。后台：Authentication → Emails → SMTP Settings（发件人 `noreply@mail.suipiancode.com`，域名已在 Resend 验证）；Authentication → Sign In / Providers 里“允许新用户注册”**验收期间保持关**。
- 密码 / API key 只在后台填写，不发到聊天或仓库。
- 配完后：§1 改后值抄回 → 程序员合并部署 #57 → 只用后台手动添加的 2 个测试邮箱验收（Gmail + QQ/163）：收码、登录、刷新保持、双会话同步、游客首登合并 → `?accounts-pilot=0` 恢复关闭且本机凭据和进度不删 → 产品官决定是否打开 `ACCOUNTS_LIVE`。

## 4. 最短真机验收清单（iPhone，约 10 分钟；Safari 和主屏幕 App 分开记）

| # | 步骤 | 期望 | 对应 |
|---|---|---|---|
| 1 | Safari 打开正式站 → 「我的」 | 应用版本 2026-11-11 10:58 UTC | 线上版本 |
| 2 | 做 U1L1：第 1 题故意选错 | 选项单列；红 / 绿标记；反馈能读全，「继续」可点 | D5、D6 |
| 3 | 任一排序题故意排错（横屏或放大字体让屏幕更挤） | 反馈区可上下滑到底，「继续」一直可点，背后题目不跟着动 | D6 |
| 4 | 做完一关，关掉标签页再打开 | XP、红心、已完成关卡不变 | 进度保存 |
| 5 | 分享 → 添加到主屏幕，从主屏幕打开，重复 1、4 | 版本相同，进度在 | PWA |
| 6 | （#58 放行用）打开预览 u67c 或 u9c：U6L3、U6L6 各答错一次 | 长解析读得全、「继续」可点；U6L6 通关后 U7L1 解锁，刷新后保留 | #58 |

每步记：通过 / 不通过 + 截图 + 时间 + iOS 版本。没有设备就保持“未验”。
