# 35 数据库权限复核报告（跨账号读写 · 身份校验 · 升级保留旧记录）

复核对象：`supabase/schema.sql`（分支 `feat/account-data-layer` / #11，基线 58fdd77）及 `src/cloud-api.js`、`src/cloud-config.js`、`src/sync.js`、`src/account-data.js`。
范围：**只用本机临时 PostgreSQL 16**（Unix 套接字，不监听网络），没有连接正式 Supabase，没有碰任何用户数据，没有改 schema。
说明：此前的「18/18」只代表原有 `isolation.sql` 的 18 项通过，不等于权限已复核完。本报告把结论分成三类，互不混用。

---

## 一、本机 PostgreSQL 实测（已跑，可复现）

运行：`PGHOST=<套接字目录> PGPORT=<端口> bash supabase/tests/run-all.sh`。共 78 项：原有 isolation 18 + 并发 1 + 新增 review-1 37 + review-2 22。全部通过。

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

---

## 二、代码审查（读源码，没有运行真实服务）

- **身份只来自令牌**：`cloud-api.js` 的 RPC 只传 `new_doc` / `expected_rev`，从不传 user_id；库里一律用 `auth.uid()`。客户端的 `userId` 只用来给本机存储分键，不影响云端归属。
- **读取防御**：`getProgress` 带 `limit=2`，读到多于 1 行就当错误，不会采用别人的行（行级权限之外再加一道）。
- **云端配置**：`cloud-config.js` 只在 `localhost` / `127.0.0.1` 允许用本机设置覆盖；线上域名永远用写死的配置。预览分支另有保护，不会连正式项目。
- **密钥扫描**（源码 + U8 预览构建产物）：只出现项目网址和被遮盖的 `sb_publishable_…` 公开密钥；没有 `service_role` / secret / 数据库密码；`service_role` 一词只出现在“不要放这里”的警告注释里。完整密钥未在任何输出中打印。**注意**：本机没有 npm/vite，扫描的是预览构建产物，不是正式站实际部署包；正式站部署包需另验。
- **游客权限**：游客模式下浏览器网络请求中 supabase.co 为 0 次（带拦截器对照组，对照组能抓到请求，说明方法有效）。游客不持有任何令牌。
- **XSS / 令牌窃取面**：访问令牌与刷新令牌存在 `localStorage`（Supabase 常规做法）。源码里没有 `insertAdjacentHTML` / `outerHTML` / `eval` / `new Function`，`innerHTML` 仅有一处清空（`lab.js`）；学生 Python 跑在 Web Worker 里，Worker 里没有 `localStorage`，读不到令牌。
- **刷新令牌**：多标签页处理已在 #37 做过（先采用存储里更新的令牌，避免一次性刷新令牌被重复使用而让会话作废）。
- **已知边界，不是缺陷**：`signOut` 失败时被忽略，本机照常退出，服务端令牌在到期前仍可用；`sendCode` 用 `create_user: true`，任何邮箱都能触发注册邮件，依赖 Supabase 的限流。

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
11. **正式站部署包**的密钥扫描与游客零请求检查。

建议使用独立的 `suipian-test` 测试项目验证，不用正式项目（该测试项目尚未创建）。

---

## 四、给产品官的决定项
1. FORCE RLS：保留并在真实库确认属主有 BYPASSRLS / 去掉 FORCE / 其他。本次未改。
2. 是否把 `run-all.sh` 接进 CI（需要 CI 里有 PostgreSQL；目前只是本机脚本）。
3. 第三部分是否由有权限的人在测试项目里执行 `check-readonly.sql` 并回传结果。

## 附：本次新增文件
`supabase/tests/review-1.sql`、`review-2.sh`、`schema-old-v1.sql`、`run-all.sh`；`supabase/check-readonly.sql` 追加第 8–11 段（只读）。
