# 正式 Supabase 上线变更包（初始化 schema、认证配置、SMTP、安全顾问）

更新：2026-11-11 东京。分支 `ops/prod-supabase-init`（基于 `release/v1-candidate`，**只加 SQL、测试和文档，不改应用代码**；应用基准仍是 `933e896`）。
正式项目锁定 **`aqlcunkmggzzvyavlkjg`**（区域：新加坡）；测试项目 **`tqdwhtrextqlmctkryyg`**。发信：Resend，`mail.suipiancode.com` 已 Verified（区域：东京）。

**授权边界**：当前授权只覆盖“恢复项目 + 只读核查”。本包里所有写操作（第 3、4、6 节）都要老大**一次性明确授权**后才执行；正式合并仍等“合并”。

## 0. 测试项目演练结果（2026-11-11 13:33 东京，传话员经 Supabase 连接器执行，老大 13:15 同意）

对象 suipian-test（`tqdwhtrextqlmctkryyg`，区域 ap-southeast-1，PostgreSQL 17.11），正式项目未动；SQL 文件与 `9666d7a` 一致，未改动。

| 步骤 | 结果 |
|---|---|
| `00-precheck.sql` | 运行身份 `postgres`，`postgres.rolbypassrls = true`（F2 通过）；已有 `progress` 表（1 行）和三个函数；**没有 `rls_auto_enable` 和 `ensure_rls`** |
| `01-init.sql`（`apply_migration`，记为迁移 `20261111043317 01_init`） | `success: true`；外层 `begin/commit` 被接受。连接器不显示 `RAISE NOTICE`，看不到“初始化自检通过”字样，以“成功 + 迁移已记录 + 复核通过”判定（自检不通过会抛错回滚，不会成功） |
| `02-postcheck.sql` 1–8 | 全部符合：列、RLS + FORCE、5 个约束、1 条只读策略、表权限（authenticated 只 SELECT，anon 无）、三个函数 SECURITY DEFINER 且属主可绕过 RLS、anon 不能执行 / authenticated 能执行 |
| 已有数据 | 进度 1 行、rev 6、更新时间、doc 大小与执行前完全一样；账号数 2 / 2 / 1 不变 |
| `02-postcheck.sql` 9 | 和文件里写的期望不符：期望有 `ensure_rls`，实际项目里本来就没有。**不是初始化造成的，是期望写错了**，已改（见下） |
| 安全顾问（执行后） | 两类 WARN：`0029 authenticated_security_definer_function_executable`（三个 RPC，属设计，保留）；`auth_leaked_password_protection`（见 §8）。没有 `rls_auto_enable` 相关告警 |

据此修改（本分支新提交，不需要授权）：
- `02-postcheck.sql` §9：改成“和 00-precheck 0.5 一样即可”，有没有 `rls_auto_enable` 都正常；§9 原写法里 `evtname || evtenabled` 在真实 PostgreSQL 上会报“operator is not unique”，本地补测时发现，已加类型转换。§8：新库期望 0、重复执行期望和执行前一样，并多给 rev、更新时间、大小用于对比。
- `00-precheck.sql`：加 0.7 `rls_auto_enable` 是否存在、0.8 迁移记录表是否存在。
- `11-advisor-fix.sql`：项目里没有 `rls_auto_enable` 时什么都不做、不报错（原写法会直接失败）。
- 本地演练加 F 组（没有 `rls_auto_enable` 的项目），共 22 项全部通过。

## 0b. 正式项目只读核查结果（2026-11-11 13:38 东京，传话员经连接器，老大授权只读）

对象 `suipian-app`（`aqlcunkmggzzvyavlkjg`，ap-southeast-1，PostgreSQL 17.11，组织套餐 **Free**）。只运行了 `00-precheck.sql`、`10-advisor-readonly.sql` 和安全顾问读取，没有任何写入。

| 检查 | 结果 | 对变更包的影响 |
|---|---|---|
| 0.2 `postgres.rolbypassrls` | **true** | FORCE RLS 下三个函数能写表，`01-init.sql` 按原稿执行 |
| 0.3 业务对象 | 没有 `progress`，没有三个 RPC；public 里只有 `rls_auto_enable()` | 新库路径：`02-postcheck.sql` §8 期望 0 行 |
| 0.4 默认权限 | 比测试项目紧：`postgres` 新函数默认只给自己执行；新表默认只给三个角色 `Dxtm`；新序列只给自己 | `01-init.sql` 不依赖默认授权（先全部收回，再只给 authenticated SELECT 和三个 RPC 的 EXECUTE）。本地加 G 组模拟正式项目的默认权限，初始化、验收 29 项、告警修正都通过。service_role 在正式项目上不会自动拿到表和函数的全部权限，应用不用 service_role，不影响 |
| 0.5 / 0.7 | **有** `rls_auto_enable()` 和 `ensure_rls`（启用） | 初始化建表时 `ensure_rls` 会顺带给 `progress` 开 RLS（脚本本来就开），不冲突；`11-advisor-fix.sql` 在正式项目上要执行 |
| 0.6 账号 | 1 个（已确认、登录过） | 初始化不碰 `auth.users` |
| 0.8 迁移记录表 | 不存在 | 用连接器 `apply_migration` 会新建并记录一条；SQL Editor 不会 |
| 安全顾问 | 3 条 WARN：0028（anon 能执行 `rls_auto_enable`）、0029（authenticated 能执行 `rls_auto_enable`）、泄露密码防护未开 | 0028、0029 由 `11-advisor-fix.sql` 消除；泄露密码见 §8 |
| `rls_auto_enable` 定义 | SECURITY DEFINER，`search_path=pg_catalog`，返回 `event_trigger`，`proacl` 为空（PUBLIC 可执行）；比文档版多了按 `%I.%I` 拼表名、出错只记日志不抛出 | 收回 PUBLIC / anon / authenticated 的 EXECUTE 后属主 `postgres` 仍保留；事件触发器照常工作（本地 D5、G4 用探针表验证；正式执行时 `11-advisor-fix.sql` 也会建探针表再删掉，确认一次） |


## 1. 现状

| 项 | 状态 | 依据 |
|---|---|---|
| 正式项目健康 | 已恢复 | 产品官 10:52 |
| 正式库业务表 `progress` 和 3 个 RPC | **缺失 → 正式账号同步的上线阻塞项** | 产品官 10:52 |
| 正式库现有账号 | 保留，不动 | 初始化脚本不碰 `auth.users`（本地 A7、P6.4 验证） |
| 发信域名 | `mail.suipiancode.com` Verified，东京，追踪关闭 | 后台实查 10:47 |
| Supabase 实际用的 SMTP 和发件地址 | **待只读核查**（正式、测试两边） | 域名验证 ≠ 验证码链路 |
| 安全顾问告警 | 测试项目已取得：0029（三个 RPC，保留）+ 泄露密码防护。**正式项目的三条原文仍待取**（产品官提到含 `rls_auto_enable()`） | 本包第 7、8 节 |

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
| 数据区域 | 数据库：新加坡（正式）；Resend：东京 | ap-southeast-1（已核） | ap-southeast-1（已核） | Resend 区域写进隐私说明前再核 |
| 套餐 | 见 §9 | Free（已核） | Free（已核） | 老大 11:07 定：继续免费 |

发件地址：**`noreply@mail.suipiancode.com`**（老大 11:07 已定）。数据库区域两边都是 ap-southeast-1（新加坡）；套餐 Free（老大 11:07 同意继续用免费套餐）。其余各项连接器读不到，需要后台抄值。

## 3. 初始化 SQL（需授权）

`01-init.sql` = **933e896 的 `supabase/schema.sql` 原文**（sha256 `57f98340…789b7f0f`，逐字节一致，未改）+ 外层 `begin/commit` + 执行后自检。自检任一项不满足就抛错，整段回滚。
schema 内容：`progress` 表（`doc` 必须是 JSON 对象、小于 64 KB，`rev` 版本号）、RLS 开启并 FORCE、只有“只读自己的进度”一条策略、表权限只给 authenticated SELECT、三个 SECURITY DEFINER 函数 `create_progress` / `save_progress`（带版本检查）/ `delete_my_account`，执行权限只给 authenticated。

### 3.1 本地验证结果（真实 PostgreSQL 16 + 模拟 Supabase 新项目默认状态）

`bash supabase/tests/prod-init-local.sh`：**22 项全部通过**（含 F 组：项目里没有 `rls_auto_enable`）。模拟内容：anon / authenticated / service_role、`auth.users`、`auth.uid()`、public 默认权限（新表新函数自动授给三个角色，和 Supabase 一致）、Supabase 文档原版 `rls_auto_enable` 事件触发器、一个已存在的正式账号。

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

1. ~~先在测试项目演练~~：**已完成**（§0）。
   - 正式执行可以用同样的连接器 `apply_migration`（会记录迁移，看不到 NOTICE），也可以在 SQL Editor 粘贴（能看到“初始化自检通过”，不记录迁移）。两种都以 `02-postcheck.sql` 全部符合为准。
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

测试项目只有两类告警（没有 `rls_auto_enable` 这个函数）。**正式项目三条告警原文已取得（§0b）**：0028、0029 都指向 `rls_auto_enable()`，第三条是泄露密码防护。原要求是先拿到原文（Advisors → Security，告警名称、对象、说明原样贴回），并在正式项目跑 `10-advisor-readonly.sql`：看 `rls_auto_enable()` 的定义、属主、SECURITY DEFINER、`search_path`、授权、依赖它的事件触发器，以及 public 里所有 SECURITY DEFINER 函数的执行权限。

已验证的事实（本地 PostgreSQL 16，`prod-init-local.sh` D 组）：
- `rls_auto_enable()` 返回 `event_trigger`，任何角色直接调用都会报错；事件触发器触发时不检查调用者的 EXECUTE 权限。
- 收回 `public` / `anon` / `authenticated` 的 EXECUTE 后：非超级用户新建 public 表，RLS 照常自动开启；三个 RPC 的 authenticated 执行权限不受影响；初始化验收 29 项仍全过。

修正草案 `11-advisor-fix.sql`：只对 `rls_auto_enable()` 收回这三个角色的 EXECUTE，自带检查（收紧没生效、或误伤了三个 RPC，都会回滚）；项目里没有这个函数时什么都不做。**已和正式项目的告警原文、只读结果对上，定稿**；收紧后会建一张探针表确认 `ensure_rls` 照常开 RLS，再删掉（都在同一事务里，失败整体回滚）。 测试项目已确认告警会点到三个 RPC（lint `0029_authenticated_security_definer_function_executable`）：这是应用的设计，它们只按 `auth.uid()` 操作本人数据，不接受 user_id 参数，保留并在告警里记录理由，不收紧。

## 8. 泄露密码防护告警

Supabase 文档：泄露密码防护**只在 Pro 及以上套餐提供**。应用不使用密码登录（只有邮箱验证码）。先核对：后台是否开着密码登录、当前套餐。免费套餐下这条告警无法靠开关消除，记为“已知、不适用（应用无密码流程）”；若升级 Pro，再打开。

## 9. 上线可用性：免费套餐会自动暂停

Supabase 文档：免费项目在 **7 天内活动很少**时会被暂停，暂停后 1 年内可在后台手动恢复。正式账号同步不能接受“用户少的那一周后自动停机”，所以上线前要定套餐：

| 选项 | 影响 |
|---|---|
| 留在免费套餐 | 低活跃时会被暂停，期间用户登录和同步失败（应用本机学习不受影响）；泄露密码防护不可用 |
| 升级 Pro | 不会因不活跃暂停；可开泄露密码防护；按月付费（价格以 supabase.com/pricing 为准，升级前核实） |

**已定（老大 11:07）：继续免费套餐。**

## 10. 收到核查结果后的实测顺序

1. Gmail、QQ、163 分别发验证码：记发件地址、DKIM / SPF 结果、耗时、是否进垃圾箱，再用验证码登录。
2. iPhone Safari 本体、主屏幕 PWA 登录。
3. 两个隔离会话的真实同步（清单 A）。

## 11. 请老大一次授权的写入清单（按顺序执行；每步有期望结果，不符就停）

数据库部分（C1、C3）只读核查已齐，可以授权；认证和 SMTP 部分（C2）还差后台抄值。可以先授权 C1 + C3，C2 等抄值后再授权。

| 步 | 内容 | 执行方式 | 期望结果（不符即停，按 §5 处理） |
|---|---|---|---|
| C1 | 正式项目运行 `01-init.sql`（文件与测试项目演练时逐字节一致） | 建议用和演练相同的连接器 `apply_migration`（会建迁移表并记一条）；或 SQL Editor 粘贴（能看到“初始化自检通过”） | 成功；随后 `02-postcheck.sql` 1–8 全部符合，§8 为 0 行，§9 与执行前一样（`ensure_rls` 仍在）；账号数仍是 1 |
| C3 | 正式项目运行 `11-advisor-fix.sql` | 同上 | 成功（内含探针表检查）；`10-advisor-readonly.sql` 显示 anon、authenticated 都不能执行 `rls_auto_enable`；三个 RPC 的 authenticated 执行权限不变 |
| — | 重新读安全顾问 | 只读 | 期望剩下：0029 × 3（三个 RPC，属设计，保留，理由见 §7）+ 泄露密码防护（见 §8）；0028 和指向 `rls_auto_enable` 的 0029 消失 |
| C2a | 后台按 §2.2 改：Site URL、Redirect URLs、注册开关（开）、Email provider / Confirm email、OTP 6 位 600 秒、两个模板只含 `{{ .Token }}` | 后台 | 改后再抄一遍差异表，全部符合 |
| C2b | 后台填 Resend SMTP：`smtp.resend.com`、465 或 587、用户名 `resend`、密码 = Resend API key（老大亲手填）、发件 `noreply@mail.suipiancode.com`、发件人“碎片编程” | 后台 | 用专用测试邮箱发一次验证码，收到且发件域是 `mail.suipiancode.com`、DKIM / SPF 通过 |
| C4 | 套餐 | — | 已定：继续 Free（老大 11:07）。已知限制：约 7 天低活跃可能暂停，1 年内可手动恢复 |
| C5 | 合并 main、正式部署 | — | 等“合并” |

C1 之后用**专用测试账号**做一次端到端：正式站登录 → 做一关 → 换浏览器登录看到同一进度 → 删号；老大现有的那个账号不做删号测试。

来源：[Supabase Event Triggers](https://supabase.com/docs/guides/database/postgres/event-triggers)（`rls_auto_enable` 原文）、[Password security](https://supabase.com/docs/guides/auth/password-security)（泄露密码防护仅 Pro 及以上）、[Project Pausing](https://supabase.com/docs/guides/platform/free-project-pausing)（7 天低活跃暂停、1 年内可恢复）。
