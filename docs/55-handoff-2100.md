# 55 21:00 交接（2026-11-11）

更新：东京 20:3x（程序员）。

## 结论

**游客版和两项体验修复已上线；账号待后台配置，后续课程待真机验收。**（不是“全部上线”）

| 项 | 状态 |
|---|---|
| 正式站 https://nomuhoshi.github.io/newfirst-app/ | **已部署** main `f7c5f22`：U1–U5 游客版（34 关）+ D5 代码 / 多行输出选项单列 + D6 反馈区内部滚动、「继续」贴底。「我的」显示「应用版本：2026-11-11 10:58 UTC」。回退点 `fcac0a5` |
| 游客版 | 自动化通过；桌面 Chrome 人工通过（[docs/53](https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/53-online-verification-2026-11-11.md)） |
| D5、D6 | 自动化通过；正式站桌面 Chrome（含响应式 375×375）人工通过（[docs/54](https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/54-ux-fixes-d5-d6.md)，截图 `6e0eaaa`、`952d9fa`、`8e88bea`） |
| 账号（登录、注册、验证码、云同步） | **受阻**：开关关闭，等第 1 项 |
| U6–U9、样板关 | **候选**（自动化通过，未上线）：等第 2 项及各自验收 |
| iPhone Safari / 主屏幕 PWA | **未验**：等第 2 项 |

## 需要老大操作的两项

### 1. SMTP / Auth 配置（Supabase 后台）

- **入口**：https://supabase.com/dashboard → 项目 **suipian-app**（项目编号 `aqlcunkmggzzvyavlkjg`，正式项目；不是 suipian-test）。
- **准确配置清单**：[C2-auth-smtp.md §1](https://github.com/nomuhoshi/newfirst-app/blob/ops/prod-supabase-init/supabase/prod-init/C2-auth-smtp.md)（逐项“后台位置 / 项目 / 目标值”），邮件模板见 §2。要点：
  - Authentication → Emails → SMTP Settings：开启自定义 SMTP，发件人 `noreply@mail.suipiancode.com`（域名已在 Resend 验证），主机 / 端口 / 用户名按 §1。
  - **密码 / API key 只在后台填写**，不发到聊天、文档或仓库。
  - Authentication → Sign In / Providers：“允许新用户注册”**验收期间保持关**。
  - Authentication → Users：手动添加 2 个测试邮箱（建议 Gmail 一个、QQ 或 163 一个），不动现有账号。
- **完成后的验收（既定方案，§3、§5）**：把 §1 改后值抄回 → 程序员合并部署 #57（只多一个验收入口 `?accounts-pilot=1`，不是访问控制）→ 用 2 个测试邮箱验：**真实收信**（验证码送达）、**登录**、刷新保持、**双会话同步**、游客首登合并 → `?accounts-pilot=0` 恢复关闭且本机进度不删 → **全部通过后**才由产品官决定开放账号。

### 2. iPhone 真机验收

每步记：通过 / 不通过 + 截图 + 时间 + iOS 版本；Safari 和主屏幕 App 分开记。没有设备就保持“未验”。

**2A 正式站**（https://nomuhoshi.github.io/newfirst-app/ ，对应 main `f7c5f22`）

| # | 操作 | 通过标准 |
|---|---|---|
| 1 | Safari 打开 →「我的」看底部 | 应用版本 2026-11-11 10:58 UTC（提示“已更新到新版本”就刷新一次） |
| 2 | 做 U1L1，第 1 题故意选错 → 检查 | 三个选项上下单列、不折行；选错的红、正确的绿；解析读得全，「继续」能点 |
| 3 | 任一排序题故意排错（可横屏让屏幕更矮） | 反馈区能上下滑到最后一行，「继续」一直在底部能点，背后题目不跟着动 |
| 4 | 通关一关后关掉标签页再打开 | XP、红心、已完成关卡数不变 |
| 5 | 分享 → 添加到主屏幕，从主屏幕图标打开，重复 1、4 | 版本相同、进度在 |

**2B 课程候选 #58（U6、U7）**：预览 https://nomuhoshi.github.io/newfirst-app-preview/u67r/ （= #58 最新 `f759b35` + 预览工作流；只连测试 Supabase，进度和正式站分开）

| # | 操作 | 通过标准 |
|---|---|---|
| 6 | 在预览「我的」→ 导入进度，选 https://nomuhoshi.github.io/newfirst-app-preview/u67c-test/unlock-U1-U5-to-U6L1.json （U1–U5 已完成，先下载到手机），然后进 U6L3，第 1 题故意答错 | 长解析能读全（过长可在反馈区内滑动），「继续」可见能点 |
| 7 | U6L6 第 1 题故意答错 | 同上 |
| 8 | 通关 U6L6 | U7L1 变成当前关，U7L2 仍锁 |
| 9 | 通关 U7L1 后刷新 | U7L1 已完成、U7L2 当前，完成数不变 |

**范围**：2B 通过只放行 #58（U6、U7）。U8、U9、样板关（预览 https://nomuhoshi.github.io/newfirst-app-preview/u9c/ ，= #61 `4ee4a32`，含 #58、#59）各自另行验收，不因 U6 通过而自动通过。

## 候选分支与预览对照（20:3x 核对）

| PR | 最新 SHA | 预览 | 预览构建源码 |
|---|---|---|---|
| [#58](https://github.com/nomuhoshi/newfirst-app/pull/58) U6+U7 | `f759b35` | u67r | `preview/u67r` `c0e8105`（= `f759b35` + 预览工作流；本地 Chromium 对该产物 joint-u6-u7 46/46） |
| [#59](https://github.com/nomuhoshi/newfirst-app/pull/59) U8 + 样板关 | `0e89d6f` | 含在 u9c | — |
| [#61](https://github.com/nomuhoshi/newfirst-app/pull/61) U9 | `4ee4a32` | u9c | `preview/u9c` `b2f4cc5`（= `4ee4a32` + 预览工作流） |
| [#57](https://github.com/nomuhoshi/newfirst-app/pull/57) 账号验收入口 | `2b08b25` | — | C2 之后 |
