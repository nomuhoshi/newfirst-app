# 正式 Supabase 上线变更包（初始化 schema、认证配置、SMTP、安全顾问）

更新：2026-11-11 东京。分支 `ops/prod-supabase-init`（基于 `release/v1-candidate`，**只加 SQL、测试和文档，不改应用代码**；应用基准仍是 `933e896`）。
正式项目锁定 **`aqlcunkmggzzvyavlkjg`**（区域：新加坡）；测试项目 **`tqdwhtrextqlmctkryyg`**。发信：Resend，`mail.suipiancode.com` 已 Verified（区域：东京）。

**授权边界**：当前授权只覆盖“恢复项目 + 只读核查”。本包里所有写操作（第 3、4、6 节）都要老大**一次性明确授权**后才执行；正式合并仍等“合并”。

## 1. 现状

| 项 | 状态 | 依据 |
|---|---|---|
| 正式项目健康 | 已恢复 | 产品官 10:52 |
| 正式库业务表 `progress` 和 3 个 RPC | **缺失 → 正式账号同步的上线阻塞项** | 产品官 10:52 |
| 正式库现有账号 | 保留，不动 | 初始化脚本不碰 `auth.users`（本地 A7、P6.4 验证） |
| 发信域名 | `mail.suipiancode.com` Verified，东京，追踪关闭 | 后台实查 10:47 |
| Supabase 实际用的 SMTP 和发件地址 | **待只读核查**（正式、测试两边） | 域名验证 ≠ 验证码链路 |
| 安全顾问 3 条告警 | **待取原文**（含 `rls_auto_enable()`、泄露密码防护） | 本包第 7、8 节 |

## 2. 只读核查（现在就能做，不需要额外授权）

### 2.1 数据库（SQL Editor 运行 `00-precheck.sql`，正式和测试各一次，结果原样贴回）
看：运行身份和 `postgres` 是否有 BYPASSRLS（**必须为 true**，见 §5 F2）、现有表和函数、`public` 默认权限、事件触发器、账号数量（只看数量）。

### 2.2 认证与邮件配置差异表（后台逐项抄值；密码、API key 不看不记）

| 项 | 期望（依据） | 正式实查 | 测试实查 | 动作 |
|---|---|---|---|---|
| Site URL | 正式 `https://nomuhoshi.github.io/newfirst-app/`；测试 `https://nomuhoshi.github.io/newfirst-app-preview/`（应用用 6 位验证码登录，不靠链接跳转，Site URL 只出现在模板变量里） | 待查 | 待查 | 不符则改 |
| Redirect URLs | 只放本项目自己的站点，不放通配 `*`；应用不传 `redirect_to` | 待查 | 待查 | 多余的删 |
| 允许新用户注册 | 正式 **开**（应用 `create_user: true`）；测试 **关**（docs/22） | 待查 | 待查 | |
| Email provider / Confirm email | 开 / 开 | 待查 | 待查 | |
| 邮箱 OTP | 长度 6、有效期 600 秒（docs/supabase-setup.md §3） | 待查 | 待查 | |
| 邮件模板 | Confirm signup、Magic Link 正文只含 `{{ .Token }}`，中文，不含链接（新用户收前者，老用户收后者） | 待查 | 待查 | 抄标题和正文 |
| 自定义 SMTP | 正式：启用，Host `smtp.resend.com`，端口 465 或 587，用户名 `resend`，发件地址在 `mail.suipiancode.com` 下，发件人名称“碎片编程” | 待查 | 待查（此前 QQ 被 Resend 测试模式拒收、日志 550，说明测试项目可能接的是 Resend 但发件域未验证） | 记录两边**实际**走的链路 |
| 发信 / 验证限额 | Rate Limits 页的每小时发信数、验证次数；记实际值 | 待查 | 待查 | 曾遇 `over_email_send_rate_limit`，待复查 |
| 匿名登录、手机登录 | 关 | 待查 | 待查 | |
| 密码登录 | 应用不使用密码（只有 `/auth/v1/otp` 和 `/auth/v1/verify`） | 待查 | 待查 | 见 §8 |
| 数据区域 | 数据库：新加坡（正式）；Resend：东京 | 登记 | 待查 | 写进隐私说明前再核 |
| 套餐 | 见 §9 | 待查 | 待查 | 决策项 |

建议发件地址：`noreply@mail.suipiancode.com`（需产品官 / 老大定）。

## 3. 初始化 SQL（需授权）

`01-init.sql` = **933e896 的 `supabase/schema.sql` 原文**（sha256 `57f98340…789b7f0f`，逐字节一致，未改）+ 外层 `begin/commit` + 执行后自检。自检任一项不满足就抛错，整段回滚。
schema 内容：`progress` 表（`doc` 必须是 JSON 对象、小于 64 KB，`rev` 版本号）、RLS 开启并 FORCE、只有“只读自己的进度”一条策略、表权限只给 authenticated SELECT、三个 SECURITY DEFINER 函数 `create_progress` / `save_progress`（带版本检查）/ `delete_my_account`，执行权限只给 authenticated。

### 3.1 本地验证结果（真实 PostgreSQL 16 + 模拟 Supabase 新项目默认状态）

`bash supabase/tests/prod-init-local.sh`：**20 项全部通过**。模拟内容：anon / authenticated / service_role、`auth.users`、`auth.uid()`、public 默认权限（新表新函数自动授给三个角色，和 Supabase 一致）、Supabase 文档原版 `rls_auto_enable` 事件触发器、一个已存在的正式账号。

| 组 | 结果 |
|---|---|
| A 正常路径 | 只读核查不改任何对象；空白库初始化成功；**重复执行**成功，前后 28 项权限 / 策略 / 函数 / 约束 / RLS 完全一致；验收 29 项通过：匿名读表和调用三个 RPC 都被拒、跨账号读不到也改不了、直接 INSERT / UPDATE / DELETE 被拒、**版本冲突**返回 null 且内容不变、非对象和超过 64 KB 的 doc 被拒、**删号只用专用测试账号**且其他人的行和已有正式账号不变 |
| B 失败回滚 | 库里有同名不兼容函数时中途报错，整段回滚，什么都不留下 |
| C 自检兜底 | 函数属主没有 BYPASSRLS 时，自检拒绝提交并回滚 |
| D 安全顾问草案 | 见 §7 |
| E 回滚脚本 | 有进度行时拒绝执行；空表时撤回干净，账号不受影响 |

原有的 `supabase/tests/run-all.sh`（isolation 18、并发、review-1 37、review-2 22）在 933e896 上也全部通过。

**本地测不到、必须在真实项目上看的**：`postgres` 是否有 BYPASSRLS（00-precheck 0.2）；SQL Editor 对 `begin/commit` 的处理；Auth 配置；PostgREST 实际暴露情况。

## 4. 执行步骤（授权后）

1. **先在测试项目演练**：测试项目已有 schema，运行 `01-init.sql` 等于“重复执行”，本地 R3 / A3 证明已有数据不变。用来确认 SQL Editor 的行为和真实权限。
2. 正式项目：`00-precheck.sql` → 确认 0.2 为 true、0.3 没有 `progress` 和三个函数 → `01-init.sql`（看到“初始化自检通过”）→ `02-postcheck.sql`，结果贴回对照。
3. 应用侧：用**专用测试账号**在正式站登录、做一关、换浏览器登录看到同一进度、删号；老大的现有账号不做删号测试。

## 5. 失败处理

| 编号 | 情况 | 处理 |
|---|---|---|
| F1 | `01-init.sql` 报错 | 整段已回滚，库里什么都没变；把报错原文贴回再定 |
| F2 | 00-precheck 0.2 显示属主没有 BYPASSRLS | 不执行。备选：去掉 `force row level security`（本地 R2.3 / R2.4 证明去掉后属主写入正常、authenticated 仍不能直接写表），需要另行确认 |
| F3 | 已提交、需要撤回、且还没有任何进度行 | `03-rollback.sql`（有进度行时自动拒绝） |
| F4 | 已提交、已有用户进度、发现问题 | 不回滚，写前进修复脚本，同样先本地演练、再测试项目、再授权 |

## 6. 认证地址、模板和 SMTP（初始化复核通过后，需授权）

按 §2.2 的差异表逐项改正式项目。SMTP：Host `smtp.resend.com`，用户名 `resend`，密码是 Resend API key（由老大在后台直接填，不经过聊天、不进仓库、不写日志），发件地址在 `mail.suipiancode.com` 下。改完再看一次差异表。

## 7. 安全顾问告警（单独处理）

**需要先拿到全部三条告警原文**（Advisors → Security，告警名称、对象、说明原样贴回），并在正式项目跑 `10-advisor-readonly.sql`：看 `rls_auto_enable()` 的定义、属主、SECURITY DEFINER、`search_path`、授权、依赖它的事件触发器，以及 public 里所有 SECURITY DEFINER 函数的执行权限。

已验证的事实（本地 PostgreSQL 16，`prod-init-local.sh` D 组）：
- `rls_auto_enable()` 返回 `event_trigger`，任何角色直接调用都会报错；事件触发器触发时不检查调用者的 EXECUTE 权限。
- 收回 `public` / `anon` / `authenticated` 的 EXECUTE 后：非超级用户新建 public 表，RLS 照常自动开启；三个 RPC 的 authenticated 执行权限不受影响；初始化验收 29 项仍全过。

修正草案 `11-advisor-fix.sql`：只对 `rls_auto_enable()` 收回这三个角色的 EXECUTE，自带检查（收紧没生效、或误伤了三个 RPC，都会回滚）。**等告警原文和只读结果对上后定稿。** 如果告警也点到三个 RPC（authenticated 能执行 SECURITY DEFINER 函数）：这是应用的设计，它们只按 `auth.uid()` 操作本人数据，不接受 user_id 参数，保留并在告警里记录理由，不收紧。

## 8. 泄露密码防护告警

Supabase 文档：泄露密码防护**只在 Pro 及以上套餐提供**。应用不使用密码登录（只有邮箱验证码）。先核对：后台是否开着密码登录、当前套餐。免费套餐下这条告警无法靠开关消除，记为“已知、不适用（应用无密码流程）”；若升级 Pro，再打开。

## 9. 上线可用性：免费套餐会自动暂停

Supabase 文档：免费项目在 **7 天内活动很少**时会被暂停，暂停后 1 年内可在后台手动恢复。正式账号同步不能接受“用户少的那一周后自动停机”，所以上线前要定套餐：

| 选项 | 影响 |
|---|---|
| 留在免费套餐 | 低活跃时会被暂停，期间用户登录和同步失败（应用本机学习不受影响）；泄露密码防护不可用 |
| 升级 Pro | 不会因不活跃暂停；可开泄露密码防护；按月付费（价格以 supabase.com/pricing 为准，升级前核实） |

需要老大决定。

## 10. 收到核查结果后的实测顺序

1. Gmail、QQ、163 分别发验证码：记发件地址、DKIM / SPF 结果、耗时、是否进垃圾箱，再用验证码登录。
2. iPhone Safari 本体、主屏幕 PWA 登录。
3. 两个隔离会话的真实同步（清单 A）。

## 11. 请老大一次授权的写入清单

1. 测试项目运行 `01-init.sql`（演练，重复执行）。
2. 正式项目运行 `01-init.sql`。
3. 正式项目按差异表改认证地址、模板、注册开关、OTP 设置。
4. 正式项目填 Resend SMTP（老大亲自填密钥）。
5. 正式项目运行定稿后的 `11-advisor-fix.sql`。
6. 套餐选择（§9）。

来源：[Supabase Event Triggers](https://supabase.com/docs/guides/database/postgres/event-triggers)（`rls_auto_enable` 原文）、[Password security](https://supabase.com/docs/guides/auth/password-security)（泄露密码防护仅 Pro 及以上）、[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)（7 天低活跃暂停、1 年内可恢复）。
