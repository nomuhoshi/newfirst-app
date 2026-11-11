# 50 产品官继承文件（可直接整份贴进新的 ChatGPT 对话）

更新：2026-11-11 东京 15:4x，程序员 Claude（Opus）写。原 ChatGPT 产品官的分支打不开，本文让新的产品官不靠旧对话、直接接手。
仓库：`nomuhoshi/newfirst-app`（GitHub）。本文在分支 `docs/course-roadmap-and-cleanup`，路径 `docs/50-product-officer-handoff.md`。

---

## 0. 给新产品官的第一段话

你是「碎片编程」的产品官（PO）。你的工作：拆任务、排优先级、审查交付、记录决定。你不写代码，不碰数据库；你给程序员 Claude 下指令，程序员把结果和证据回给你。**只有老大能批准**：合并 main、正式部署、正式数据库写入、删除、花钱、改锁定规则。

读完本文后，你的第一条消息建议是：确认已接手，复述当前最高优先级（§6），并向老大要第 1 项授权（§6 的 P1）。

---

## 1. 团队和沟通方式

| 角色 | 是谁 | 职责 |
|---|---|---|
| 老大 | 项目主人 | 唯一能批准合并、部署、正式写入、删除、花钱的人；他说“合并”两个字才算批准合并 |
| 产品官 | 你（新的 ChatGPT 对话） | 拆任务、排优先级、审查、记决定 |
| 传话员 | 在老大、产品官和各聊天之间转发消息的人；有 Supabase 连接器，可以按授权执行 SQL | 转达指令和结果；老大授权后代为执行数据库操作 |
| 程序员 | Claude 聊天（默认 Sonnet，需要判断时切 Opus） | 开发、课程题目、测试、预览、运维脚本 |
| 设计师 | Claude 聊天（Opus） | 视觉、学习流程、吉祥物「碎碎」 |
| 市场调研 | Claude 聊天（Sonnet） | 查同类产品做法，给真实来源 |

**消息格式（老大要求，所有人都要遵守）**
- 每条消息开头标东京时间，例如 `东京时间 2026-11-11 15:42`。
- 程序员的回复以「程序员（Sonnet）：」或「程序员（Opus）：」开头，结尾带【给 GPT 的状态】：Task/PR、Commit、Done、Evidence、Blockers、Decisions needed、东京时间。
- 验收结果用表：验收项｜状态｜对应 SHA 或环境｜证据链接｜负责人。

**模型切换**：需要 Opus 判断的工作（课程设计、审题、数据库安全、架构）先做；做完程序员会说“可以切回 Sonnet”，由老大切换。

---

## 2. 产品和环境

- 产品：碎片编程，免费的手机 PWA，学 Python。Vite + Pyodide（浏览器里跑真实 Python）。
- 正式站：`https://nomuhoshi.github.io/newfirst-app/`（`main` 推送后由 GitHub Pages 部署）。
- 预览站：`https://nomuhoshi.github.io/newfirst-app-preview/<id>/`（仓库 `nomuhoshi/newfirst-app-preview`，只连测试云）。
- Supabase 正式项目：`suipian-app`，ref **`aqlcunkmggzzvyavlkjg`**，新加坡（ap-southeast-1），PostgreSQL 17.11，套餐 **Free**。
- Supabase 测试项目：`suipian-test`，ref **`tqdwhtrextqlmctkryyg`**，新加坡，Free。预览站只连它。
- 前端只放公开参数（项目网址和 `sb_publishable_…`）。**绝不**在聊天、仓库、日志里出现：数据库密码、service_role / secret 密钥、Resend API key、SMTP 密码。
- 发信：Resend，域名 `suipiancode.com`（注意：`suipian.com` 是此前误报，已关闭），发信子域名 **`mail.suipiancode.com` 已 Verified**（东京区域，打开 / 点击追踪关闭）。发件地址老大已定：**`noreply@mail.suipiancode.com`**。
- 登录方式：邮箱 6 位验证码（`/auth/v1/otp` + `/auth/v1/verify`），不用链接、不用密码。

---

## 3. 长期规则（不要违反）

1. 没有老大明确说“合并”，任何人不合并 main；不做正式部署。
2. 正式 Supabase：只读核查已获授权；**任何写入**（建表、改配置、写 SMTP、改权限）都要老大授权。
3. 不删除分支、PR、预览目录、文档、数据，除非老大授权（27 条旧分支清理已由老大完成）。
4. 不 force push；不在 GitHub 上发评论；#42、#43 保持 Draft；不碰预览库的 `rc1/`。
5. **第一版应用代码锁定在 `933e896`**（候选分支 `release/v1-candidate`，之后只有文档提交，最新 `48460e7`）。第一版范围：U1–U5 共 34 关、136 道点选题；15 道写代码题保持 `pending`，发布说明不能写“可以运行自己的代码”。
6. 隐私：登录前不放勾选框，发送验证码按钮旁放隐私说明链接；未满 14 岁只开游客；隐私联系邮箱开通并确认能收信后再填；数据区域和日志保留期核实后再写。
7. 锁定规则（XP、红心、连续天数、解锁、错题回炉、课程难度）改动需老大同意，并写进 `spec/SPEC.md` 决策记录。

---

## 4. Fable（传话员）的指挥记录：今天的指令原文要点

> 说明：老大 15:41 要求“把 fable 的指挥写入”。程序员理解为：今天由传话员（Fable）转达和下达的指挥。如果老大指的是别的内容，请把原文贴给程序员补上。

| 东京时间 | 来源 | 指令 |
|---|---|---|
| 13:15 | 老大 | ChatGPT 产品官分支打不开，**暂时由程序员直接和传话员对接**。先做题目项目。同意先在测试项目 suipian-test 上演练 schema 初始化。正式项目任何写入、合并 main、删除仍需老大明确授权。老大去工作，接下来两小时持续推进，每条消息标东京时间 |
| 13:25 / 13:28 / 13:29 | 传话员 | 按老大指示继续推进，不用等确认；需审定、待验收、需授权的先记下，继续做不需要授权的部分 |
| 13:30 | 传话员 | “这需要老大授权，先记下”（指正式写入） |
| 13:34 | 传话员 | 已用 Supabase 连接器跑完 suipian-test 演练，正式项目未动；据此继续推进不需授权的部分（修正 postcheck / init 和 `rls_auto_enable` 的差异、更新运行手册） |
| 13:41 | 传话员 | 交来正式项目只读核查结果（老大已授权只读）；**正式写入 C1–C5 仍未授权**；继续做不需要授权的工作，包括题目项目 |
| 13:43 后 | 传话员 | “这需要老大授权，先记下”（C1、C3） |
| 15:41 | 老大 | 让程序员更新继承文件，并写入 Fable 的指挥；传话员补充：要能直接贴进新的 ChatGPT 对话，推到仓库，回报路径和提交号 |

**由此确定的工作方式（在新产品官就位前一直有效）**：
- 程序员可以不等确认，持续做不需要授权的工作（写题、文档、脚本、本地测试、预览分支）。
- 凡需授权的，登记到 `docs/49-open-items.md`，不执行。
- 数据库操作由传话员经连接器执行，程序员只提供 SQL、期望结果和核对方法。

---

## 5. 当前状态（2026-11-11 15:4x）

### 5.1 第一版（U1–U5）

| 项 | 状态 | 证据 |
|---|---|---|
| 应用候选 | 锁定 `933e896`，CI 全绿（run 42849506941） | 分支 `release/v1-candidate`，文档 `docs/40` |
| iPhone 浏览器（Edge，WebKit 内核）登录、做题 | 通过 | `docs/40` 真机表 |
| iPhone Safari 本体 | 待验 | — |
| 主屏幕 PWA 验证码登录 | 曾遇发信限额（`over_email_send_rate_limit`），**当前待复查** | 下一次合法测试记录实际结果 |
| QQ 邮箱 | 此前被 Resend 测试模式拒收（日志 550）；域名验证 + SMTP 后重测 | — |
| 163 邮箱 | 尚未实测 | — |
| 真实双会话同步 | 待验（需要两个隔离浏览器 + 能收信的邮箱） | 预览 `v1rc-test/README.md` 清单 A |
| 正式邮件链路 | 域名验证已完成；**Supabase 侧 SMTP 未配置**，配置完成后验收 | — |

### 5.2 正式 Supabase（上线阻塞项）

正式库**缺少业务表 `progress` 和三个 RPC**（`create_progress` / `save_progress` / `delete_my_account`），正式账号同步目前用不了。变更包已备好：分支 **`ops/prod-supabase-init` @ `9347b76`**，目录 `supabase/prod-init/`，说明见其中 `README.md`。

| 步 | 内容 | 状态 |
|---|---|---|
| 测试项目演练 | `00-precheck` → `01-init` → `02-postcheck` | **13:33 完成**：成功，已有数据不变 |
| 正式只读核查 | precheck、安全顾问原文、`rls_auto_enable` 定义 | **13:38 完成**：`postgres` 有 BYPASSRLS；库里无 progress；有 `rls_auto_enable` + `ensure_rls`；默认权限比测试项目紧（已本地模拟验证） |
| **C1** 正式运行 `01-init.sql` | 933e896 的 `schema.sql` 原文 + 事务 + 自检；sha256 `5f0197d8…`，和演练时逐字节一致 | **可以授权**，待老大 |
| **C3** 正式运行 `11-advisor-fix.sql` | 只收回 `rls_auto_enable()` 的 PUBLIC / anon / authenticated 执行权限，内含探针表检查 | **可以授权**，待老大 |
| C2 认证配置 + Resend SMTP | Site URL、Redirect URLs、注册开、OTP 6 位 600 秒、两个模板只含 `{{ .Token }}`、SMTP | 连接器读不到，**先要后台抄值**（README §2.2 差异表），再授权 |
| C4 套餐 | 继续 Free（老大 11:07 定）；已知限制：约 7 天低活跃可能暂停 | 已定 |
| C5 合并 / 部署 | — | 等“合并” |

安全顾问：正式项目现有 3 条 WARN——0028、0029 都指向 `rls_auto_enable()`（C3 消除）；泄露密码防护未开（只有 Pro 能开；应用不用密码，待后台确认密码登录已关后记为“已知、不适用”）。C1 之后会出现三个 RPC 的 0029，属设计（只按 `auth.uid()` 操作本人数据），保留。
本地验证：`bash supabase/tests/prod-init-local.sh` 26 项全过（真实 PostgreSQL + 模拟 Supabase 默认状态，含正式项目的默认权限）。

### 5.3 课程（第一版之后，都不进第一版）

| 项 | 版本 | 状态 | 卡在 |
|---|---|---|---|
| U6 类型与报错（含新题型 pick：读报错选择题） | #52 Draft，`f4fcb2b` | CI 绿；Chromium / WebKit 窄屏自动化通过 | **iPhone 真机**（U6L3、U6L6 长解析能否读全、「继续」能否点） |
| U7 字典 | #53 Draft，`9adca7d` | CI 绿；窄屏自动化通过 | 同上 |
| U6 + U7 联合 | #54 Draft，`f8de288`；预览 `u67c`（源码 `cc90e07`），进度文件在预览库 `u67c-test/` | CI 绿（run 42899938067，含 WebKit 390×450 / 390×844 联合通关测试） | 同上 |
| U8 函数 | `content/u8-revise` **`9d75e07`**（复审后定稿） | 6 关 24 题；校验失败 0 | 接入等 U6 pick 真机 |
| U8L8 按名字传值（补充） | `content/u8-kwargs-draft` `79bad26` | 4 题草稿，放在 heldLessons | 产品官审：放进哪一关 |
| U9 小项目：点单小票 | `content/u9-draft` `4aad01e`，说明 `docs/47` | 6 关 24 题草稿；校验失败 0 | 产品官审题（`docs/47` §5 四点） |
| 样板关（读代码与调试 D1L1） | `content/sample-debug` `2698166` | 4 题定稿；入口条件：U3 全部 8 关完成 | 接入等 U6 pick 真机；验收要覆盖锁定 / 解锁 / 刷新保持 |
| 「读代码与调试」线题纲 | `docs/48` | 7 关题纲草案 | 产品官审；样板关真机验收后才写题 |

课程校验：`python3 scripts/verify-content.py --extra content/unit8.json`（草稿单元必须加 `--extra`，否则不包含）。每道题的答案和每个干扰项都用真实 Python 运行核对。

### 5.4 其他

- 27 条旧分支已由老大删除，核对记录在 `docs/42`（0 残留，开放 PR 不受影响）。
- 开放 PR 里属于第一版之前历史的（#40–#51）不动；#42、#43 保持 Draft。

---

## 6. 优先级（建议新产品官按这个顺序推）

| 序 | 事项 | 需要谁 |
|---|---|---|
| **P1** | 请老大授权 **C1 + C3**（正式建表 + 告警修正），由传话员按 `supabase/prod-init/README.md` §11 执行，程序员核对结果 | 老大授权 → 传话员执行 |
| P2 | 后台抄 Auth / SMTP 配置（README §2.2），然后请老大授权 C2，填 Resend SMTP（老大亲手填密钥） | 有后台权限的人 → 老大 |
| P3 | Gmail、QQ、163 验证码送达与登录；Safari、主屏幕 PWA；真实双会话同步 | iPhone 测试者、老大 |
| P4 | U6 pick 的 iPhone 真机试玩（预览 `u67c`，重点 U6L3、U6L6、U6L6→U7L1） | iPhone 测试者 |
| P5 | 审 U9、U8L8、调试线题纲 | 产品官 |
| P6 | P4 通过后：U8、U9、样板关接入预览，390 宽检查 | 程序员 |
| — | 合并第一版到 main、正式部署 | 老大说“合并” |

---

## 7. 关键文档索引（都在仓库里）

| 文档 | 位置 |
|---|---|
| 待办总表（待验收 / 待核查 / 待授权 / 待审） | `docs/49-open-items.md`（分支 `docs/course-roadmap-and-cleanup`） |
| 正式 Supabase 变更包和执行清单 | `supabase/prod-init/README.md`（分支 `ops/prod-supabase-init`） |
| 第一版候选说明和真机结果 | `docs/40-release-v1-candidate.md`（分支 `release/v1-candidate`） |
| 手动验收单、发信配置 | `docs/43-v1-manual-acceptance-and-mail.md`（docs 分支） |
| 课程路线图 | `docs/41-course-roadmap.md`（docs 分支）；在线版“课程项目”规划文档 |
| U8 修订与复审 | `docs/35-u8-gap-fill-revision.md`（分支 `content/u8-revise`） |
| 样板关 | `docs/46-sample-lesson-draft.md`（docs 分支） |
| U9 | `docs/47-u9-small-project.md`（分支 `content/u9-draft`） |
| 调试线题纲 | `docs/48-debug-line-outline.md`（docs 分支） |
| 分支清理记录 | `docs/42-cleanup-record.md`（docs 分支） |
| 项目总交接入口 | `AGENTS.md`（main） |

---

## 8. 给程序员下指令的模板

```
东京时间 YYYY-MM-DD HH:MM
程序员，<任务一句话>。
范围：<做什么 / 不做什么>。
验收：<怎样算完成，要什么证据>。
授权边界：<哪些可以直接做，哪些仍需老大>。
回报：附提交号、CI 或校验结果、阻塞项。
```
