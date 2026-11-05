# 35 数据库权限复核报告（跨账号读写 · 身份校验 · 升级保留旧记录）

**复核基线：候选版 `release/rc-1` @ 9d1b4cb**（2026-11-05 16:58 产品官指出：第一版报告 fff5c44 基于旧提交 58fdd77，已改到候选版重做）。
范围：**只用本机临时 PostgreSQL 16**（Unix 套接字，不监听网络），没有连接正式 Supabase，没有碰任何用户数据，没有改 schema 和 `src/` 源码。

## 0. 基线核对（58fdd77 → 9d1b4cb，逐文件）
| 文件 | 是否相同 | 说明 |
|---|---|---|
| `supabase/schema.sql`、`check-readonly.sql`、`tests/isolation.sql`、`tests/concurrency.sh`、`tests/stub.sql` | 相同 | 数据库侧的实测结论直接适用于候选版 |
| `src/cloud-api.js`、`account-data.js`、`account-store.js` | 相同 | 第一版的代码审查结论保留 |
| `src/cloud-config.js` | **不同** | 新增“测试入口不连正式项目”的屏蔽，已补审（第二部分） |
| `src/sync.js` | **不同** | 新增按项目分开存凭证和账号副本、换项目同邮箱接管、强制退出保留副本，已补审 |
| `src/account-ui.js` | 不同（1 行） | 只是强制退出确认框的文案，已读 |

**数字的来源**：下文的 78 项（SQL）和 37 项（Node 对抗测试）都是 **Sonnet 在本机实测**的结果；产品官目前完成的是源码复核，**没有独立重跑 PostgreSQL**。「18/18」只代表原有 `isolation.sql` 的 18 项，不等于权限已复核完。

## 一、本机 PostgreSQL 实测（已跑，可复现）

运行：`bash supabase/tests/run-all.sh`（自建专用临时实例，见 1.10）。共 78 项：原有 isolation 18 + 并发 1 + 新增 review-1 37 + review-2 22。全部通过。

### 1.1 身份测试的性质（单独声明）
本机用 `set local role authenticated` + 设置 `request.jwt.claim.sub` 模拟 PostgREST 传入的令牌字段，再调用 `auth.uid()`。**这只能验证“数据库权限规则”本身**：给定一个身份，表和函数放行或拒绝什么。它**没有验证**令牌签名、过期、退出登录、账号被删后的认证行为——这些在第三部分。

### 1.2 跨账号读写（review-1 A 组，16 项）
B 带着自己的身份：
- 读：按 A 的 user_id 查、查整张表 → 0 行。
- 写：用 A 的 rev 调 `save_progress` → null（改不到 A）；直接 UPDATE / DELETE / INSERT 冒充 A / upsert 冒充 A / TRUNCATE → 全部 42501 拒绝。
- 越权：不能读 `auth.users`、不能关闭行级安全、不能删 `auth.users`、不能在 public 建同名函数顶替、不能给自己 `grant` 写权限（grant 后仍无 INSERT/UPDATE/DELETE）。
- B 建同名临时表 `progress`：函数仍写进 `public.progress`（`search_path` 已固定）。
- 结束时 A 的行内容、rev 都没变。

### 1.3 身份校验（review-1 B 组，14 项）
- anon（即使带着 A 的 uid）：不能读表，不能调 `save_progress`、`delete_my_account`。
- authenticated 但身份无效：无 sub / 空 sub → 3 个函数都 28000 拒绝；sub 不是 uuid → 22P02 出错，读表也出错，不会被当成任何人。
- 账号不存在（从未注册或已删）：`create_progress` 被外键拒绝（23503），不会留下无主的行；`save_progress` 返回 null；读表 0 行。
- 账号自己删除后，同一个令牌再 `create_progress` → 23503，数据建不回来；B 的账号和行都没了，A 的还在。

### 1.4 文档校验（review-1 C 组，7 项 + 1 项记录）
`doc` 为数组 / 字符串 / JSON null / SQL null → 拒绝；超过 64KiB 的不可压缩文档 → 拒绝；失败的保存不改内容也不增加 rev；`expected_rev` 为 null / 0 / 负数 → null。
**记录项（不是通过/失败）**：1,000,000 个字符的可压缩文档也被拒绝（23514），说明 64KiB 限制按未压缩 JSON 文本计，不会被压缩绕过。

### 1.5 登录角色提权（review-2 R1，5 项）
模拟 PostgREST 的 `authenticator`（非超级用户、无 BYPASSRLS、noinherit）：登录后只能切到 anon / authenticated，不能 `set role postgres`、不能 `set role pg_read_all_data`；不切角色时自己读不了表；正常路径 `create_progress` 成功。

### 1.6 FORCE ROW LEVEL SECURITY 现状（review-2 R2，4 项）——只验证现状，**没有改 schema**
`progress` 表开了 RLS 并且 FORCE。三个函数是 `SECURITY DEFINER`，以**函数属主**身份写表，所以：
| 属主角色 | FORCE RLS | `create_progress` |
|---|---|---|
| 无 BYPASSRLS（模拟） | 开（当前 schema） | **失败**：violates row-level security |
| 有 BYPASSRLS | 开（当前 schema） | 成功 |
| 无 BYPASSRLS | 关 | 成功 |
去掉 FORCE 后 authenticated 仍不能直接写表——靠的是没有 UPDATE 权限，不是靠 FORCE。

结论：当前设计**依赖属主能绕过 RLS**。本机的属主是我建的模拟角色，**不能证明真实 Supabase 的 `postgres` 角色有 BYPASSRLS**（见第三部分）。是否去掉 FORCE、保留 FORCE 并确认属主，或其他做法，请产品官决定；本次不改配置。

### 1.7 旧版升级，旧记录保留（review-2 R3，12 项）
预置：用旧版 schema（客户端可直接写表 + INSERT/UPDATE 策略；并模拟 Supabase 默认授权）建 3 个账号的旧记录，字段取自 `src/account-data.js` 的真实格式（`schema`、`gen`、`lineage`、`xp`、`runs`、`done`、`days`、`hearts`、`prefs`、`imported`），其中 U1 再用旧版保存一次升到 rev 2。
**升级后重复执行**：`schema.sql` 连跑两次，**每一次跑完**都逐项对比升级前，12 项分别核对，全部一致：
账号归属（user_id ↔ auth.users）、rev、updated_at、schema、gen / lineage、XP（xp 各设备格子）、runs、关卡 done（含完成日期）、days、hearts、prefs、imported；两次后行数仍是 3。
权限收窄：旧的 INSERT / UPDATE 策略已删除，只剩 SELECT 策略；表权限收窄为 `authenticated:SELECT`（anon 无任何权限）；升级后直接 UPDATE 被拒绝。
升级后行为：U1 读到自己的旧记录，用旧 rev 保存 → rev 3；已有旧行的账号 `create_progress` 返回 null 且旧内容不被覆盖；没有旧行的老账号第一次创建 → rev 1；删号后账号和行都没了、别人的行还在。

### 1.8 测试有效性自检（把 schema 故意改坏，测试应当变红）
| 故意改坏 | 结果 |
|---|---|
| 给 authenticated 加 UPDATE | 3 组失败 |
| 给 anon 加 SELECT | 3 组失败 |
| 读策略改成 `using (true)` | 2 组失败 |
| 给 anon 执行 `save_progress` | 2 组失败 |
| 给 authenticated 加 public 建对象权限 | 1 组失败 |
| 升级时偷偷改 done 日期 / xp / 删 days / rev+1 / 改账号归属 / 改 gen | 迁移逐项核对均失败 |
均已被抓到，说明这些测试不是“永远通过”。

### 1.9 本机未覆盖
没有测并发下的 `delete_my_account`；没有测超大量行的性能；`pg_default_acl` 只模拟了 Supabase 的常见默认值，不是真实库的值。

### 1.10 测试脚本加固（按 16:58 的要求）
| 之前的问题 | 现在 |
|---|---|
| 连接到调用者环境里已有的 PostgreSQL，并 `drop database` 固定名字的库 | `run-all.sh` 自己在 `mktemp` 目录里 `initdb` 一个专用实例，只开 Unix 套接字（`listen_addresses` 为空），跑完销毁；不继承任何 `PG*` 环境变量；启动后确认“没有监听网络”且“数据目录就是自己的”，否则拒绝继续；以 root 运行时降权为 postgres 用户 |
| 初始化错误被 `>/dev/null 2>&1` 吞掉 | 所有初始化命令（建库、`stub.sql`、`schema.sql`、旧版 schema、建角色、预置数据）失败立即退出并打印输出；`review-2.sh` 内已无输出被丢弃的初始化命令 |
| 结果靠在日志里 `grep` | 每个测试命令的**退出码**才是判定依据：任何一组非零退出都算失败。`PASS` 行数只作为“有没有检查被悄悄跳过”的二次校验（isolation 18、review-1 37、review-2 内部 EXPECTED=22，不符即失败） |
| `concurrency.sh` 写固定路径 `/tmp/conc1`，后台会话失败时可能读到上次的旧结果 | 改用 `mktemp` 临时目录；后台会话的退出码用 `wait` 检查；接受任一先后顺序但必须“恰好一个成功” |
| `review-2.sh` 可以被指向任意主机 | 要求 `PGHOST` 是已存在的绝对路径（Unix 套接字目录），主机名 / IP 直接拒绝 |
**加固后的自检**（把输入故意弄坏，脚本应当失败）：schema.sql 语法错误 → 退出码 2、初始化失败；stub.sql 出错 → 退出码 2；放宽权限 → 退出码 1；删掉一个检查 → 项数不符、退出码 1；并发脚本里 psql 报错 → 退出码 1；review-2 的 EXPECTED 不符 → 退出码 1；环境里设置指向外部主机的 `PGHOST/PGUSER/PGPASSWORD` → 被忽略，仍只连自己的实例；不改动的对照 → 全部通过、退出码 0；每次运行后临时目录已清理。
**CI**：新增 `.github/workflows/db-tests.yml`（push 到 `review/**`、`feat/account-data-layer`、`release/**` 或 PR 涉及 `supabase/**` 时触发，也可手动触发），在 GitHub 的 ubuntu 机器上跑同一个 `run-all.sh`，不需要任何密钥。
**CI 结果**：提交 dadbe16 触发的 `db-tests`（run 41991983808）成功——runner 上是 PostgreSQL 18（本机是 16），isolation 18 / review-1 37 / review-2 22 / 并发 1，全部通过。同一套测试在 16 和 18 两个大版本上都通过。

---

## 二、代码审查（读源码，没有运行真实服务）

- **身份只来自令牌**：`cloud-api.js` 的 RPC 只传 `new_doc` / `expected_rev`，从不传 user_id；库里一律用 `auth.uid()`。客户端的 `userId` 只用来给本机存储分键，不影响云端归属。
- **读取防御**：`getProgress` 带 `limit=2`，读到多于 1 行就当错误，不会采用别人的行（行级权限之外再加一道）。
- **云端配置（候选版已变）**：见 2.1。
- **密钥扫描**（源码 + U8 预览构建产物）：只出现项目网址和被遮盖的 `sb_publishable_…` 公开密钥；没有 `service_role` / secret / 数据库密码；`service_role` 一词只出现在“不要放这里”的警告注释里。完整密钥未在任何输出中打印。**注意**：本机没有 npm/vite，扫描的是预览构建产物，不是正式站实际部署包；正式站部署包需另验。
- **游客权限**：游客模式下浏览器网络请求中 supabase.co 为 0 次（带拦截器对照组，对照组能抓到请求，说明方法有效）。游客不持有任何令牌。
- **XSS / 令牌窃取面**：访问令牌与刷新令牌存在 `localStorage`（Supabase 常规做法）。源码里没有 `insertAdjacentHTML` / `outerHTML` / `eval` / `new Function`，`innerHTML` 仅有一处清空（`lab.js`）；学生 Python 跑在 Web Worker 里，Worker 里没有 `localStorage`，读不到令牌。
- **刷新令牌**：多标签页处理已在 #37 做过（先采用存储里更新的令牌，避免一次性刷新令牌被重复使用而让会话作废）。
- **已知边界，不是缺陷**：`signOut` 失败时被忽略，本机照常退出，服务端令牌在到期前仍可用；`sendCode` 用 `create_user: true`，任何邮箱都能触发注册邮件，依赖 Supabase 的限流。

### 2.1 候选版补审：`cloud-config.js`
读了 9d1b4cb 相对 58fdd77 的 diff。新增的规则：构建时设了 `PREVIEW_ID`（测试入口）就**不用**写死的正式配置，只用构建时给的 `TEST_SUPABASE_URL / ANON_KEY`；没给或网址指向正式项目就关闭云端。判断是否正式项目按**解析后的主机名**（小写；解析不了按“可能是正式”处理；主机名里含正式项目编号一律拒绝）。正式构建不读测试配置。`deploy.yml` 的两处 `npm run build` 都没有设 `PREVIEW_ID`，所以正式站走写死的配置。
**对抗测试**（`tests/cloud-adversarial.test.mjs`，纯 Node）：把正式网址写成末尾多一个点、全角字符、百分号编码的点、大写协议加反斜杠、项目编号当子域前缀 / 嵌在别的主机名里、`javascript:`、`data:`、协议相对网址、纯空白——全部被拒绝、云端关闭；合法的独立测试项目照常放行；正式构建忽略测试配置；非 localhost 的线上域名（含 `localhost.evil.example`）不接受浏览器里的覆盖。
**发现（低风险，未改源码）**：`pick()` 里「localhost 用浏览器设置覆盖」在「测试入口屏蔽正式项目」**之前**生效，覆盖值不经过 `isProdUrl`。也就是说：在本机 localhost 打开一个测试入口构建，再手动往 `localStorage["suipian.cloudConfig"]` 写正式网址，就能连上正式项目。利用条件是**本机操作者**自己动手，线上域名上无效；但它与“测试入口绝不连正式项目”的承诺不一致。**处理（17:14 产品官决定）**：测试构建无论从哪里读取配置，都要检查正式项目地址，命中就关闭云端。已在独立分支 `fix/cloud-config-localhost-override`（e9b7acb，基于 9d1b4cb）修复，并把此处的“记录项”改成强制断言（8 种写法 × localhost / 127.0.0.1），保留合法配置的对照；还原修复后 17 项变红。本分支的 `tests/cloud-adversarial.test.mjs` 仍是修复前的版本（保留“记录项”），以修复分支为准。

### 2.2 候选版补审：`sync.js` 与 `account-ui.js`
- **凭证按项目分开**：测试项目的 `AUTH` / 当前账号 / 账号副本键带 `proj:<主机名>:` 前缀，正式项目沿用原键。对抗测试确认：测试库登录后，令牌只出现在带前缀的键里，正式版的键（账号副本、当前账号、凭证）一个字没变，测试库请求里没有带过正式版令牌。
- **凭证记的项目对不上**：读到时不使用、也不删除（可能是另一个入口还在用），状态变为需要重新登录；同步时**不向任何接口出示**这份令牌（调用次数为 0）。留下的过渡标记只含账号编号、邮箱、项目，**没有令牌**。
- **换项目后同邮箱接管**：只在「当前没有有效登录 + 过渡标记的账号编号与当前账号一致 + 新登录的邮箱（去空格、小写）与标记一致」时允许。测试：大小写 / 空格不同的同一邮箱可以登录；旧项目账号的 XP **没有**被上传到新账号，旧账号本机副本原样保留，登录后标记被清掉；换成别的邮箱 → `other-account`，且不读不写云端；登录仍有效时即使伪造了过渡标记，另一个账号编号也被拒绝。邮箱是新登录经验证码验证过的邮箱，不是用户输入的字符串。
- **强制退出保留副本**：有未上传内容且连不上时，普通退出被拦下（登录状态不变）；强制退出后存储里**没有任何令牌**，当前账号清空（重启是游客状态，不自动恢复），未上传的本机副本保留（同一账号再登录接着传），别的账号读不到它。已同步的账号正常退出则副本、当前账号、令牌全部清除。
  *影响面*：强制退出后，未上传的学习记录仍留在这台设备的 localStorage 里（和游客记录性质相同）。共用设备上这是一个隐私取舍，不是越权；`account-ui.js` 的确认框文案已如实说明“会先留在这台设备上”。
- **补审的测试**：`tests/cloud-adversarial.test.mjs` 共 37 项，通过；用 7 种故意改坏的版本验证会变红（isProdUrl 只比完整主机名 / readAuth 不查项目 / 退出不删令牌 / 去掉“没有有效登录”条件 / 不核对邮箱 / 强制退出也删副本 / 命名空间失效）。已并入 `npm test`。候选版自带的 Node 测试（cloud-config 14、cloud-sync 40、-project 12、-switch 27、-tabs 6、-replaced 6）本机全部通过。
- **没覆盖**：`tests/account-replaced.test.mjs` 等需要 playwright 的浏览器测试本机无法运行（没有 npm 依赖），由 CI 的 build/test 任务覆盖，我没有独立验证。

---

## 三、仍待真实 Supabase 验证（本机无法证明）

1. **令牌层**：签名校验、过期、退出登录后令牌是否立即失效、账号被删后旧令牌的认证行为（本机只模拟了 `auth.uid()` 的结果）。
2. **属主能否绕过 RLS**：真实库里三个函数的属主、该角色是否 `rolbypassrls`，以及 FORCE RLS 下 `create_progress` 是否真的成功。→ 运行 `supabase/check-readonly.sql` 第 8 段。**这是目前最重要的一项**：若属主没有 BYPASSRLS，线上所有写入都会失败。
3. **public 里的建对象权限**：`anon` / `authenticated` 在真实库是否有 CREATE（第 9 段；本机默认没有）。
4. **默认授权**：`pg_default_acl` 的真实值（第 10 段），影响以后新建表是否默认对外开放。
5. **匿名登录**是否关闭（第 11 段；开启后匿名用户角色也是 authenticated，也能调用三个函数）。
6. **线上实际 schema 版本**：是否已是当前版本（第 1–7 段）；旧版升级我只在本机用旧版 schema 验证过。
7. **`delete_my_account` 在真实 `auth.users` 上的权限**，以及删除后级联。
8. **API 暴露范围**：PostgREST 是否只暴露 public，以及它传递身份字段的方式是否与本机模拟一致。
9. **`/auth/v1/logout` 的默认范围**（是否同时退出其他设备）、验证码限流与邮件频率。
10. **`Authorization: Bearer <publishable key>`** 在新式公开密钥下，未登录请求的实际放行行为。
11. **正式站部署包**的密钥扫描与游客零请求检查；并确认部署包里 `__PREVIEW_ID__` 为空（即走写死的正式配置、不含 `TEST_SUPABASE_*`）。
12. 候选版的**浏览器测试**（需要 playwright / Chromium / WebKit）：本机未运行。

建议使用独立的 `suipian-test` 测试项目验证，不用正式项目（该测试项目尚未创建）。

---

## 四、决定项与状态
1. **FORCE RLS**：产品官 16:58 决定**暂时保留**；等测试库确认实际属主权限和 RPC 写入结果后再决定是否调整。本次未改。
2. **数据库 CI**：产品官同意接入，条件是先加固脚本——已按要求加固并接入（见 1.10）。
3. **真实测试库检查**：由有权限的人在 `suipian-test` 执行（项目尚未创建）。本机模拟身份**不能算**真实令牌认证通过。
4. **localhost 覆盖**：产品官 17:14 决定必须检查正式项目地址；37 项对抗测试保留在 `npm test`。已在 `fix/cloud-config-localhost-override` 修复（见 2.1）。

## 附：本次新增文件
`supabase/tests/review-1.sql`、`review-2.sh`、`schema-old-v1.sql`、`run-all.sh`（重写）、`concurrency.sh`（加固）；`supabase/check-readonly.sql` 追加第 8–11 段（只读）；`tests/cloud-adversarial.test.mjs`；`.github/workflows/db-tests.yml`；`package.json` 的 `test` 链末尾加入对抗测试。分支 `review/db-permissions-rc1`（基于 9d1b4cb）；旧的 `review/db-permissions`（fff5c44，基于 58fdd77）保留不动。
