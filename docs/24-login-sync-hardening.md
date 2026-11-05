# 24 登录 / 同步加固记录（2026-11-05）

分支：`dsh/login-sync-hardening-1`  
基线：`release/rc-1` @ `9d1b4cb`  
范围：只加固登录、云存档、离线保存、跨设备同步；不接真实 Supabase，不动正式站，不改题库 / 设计 / 跳关。

## 1. 这次找到并修掉的代码缺口

| # | 缺口 | 会造成什么 | 修复 |
|---|---|---|---|
| 1 | 测试入口（`PREVIEW_ID`）在 localhost 读取浏览器 `suipian.cloudConfig` 覆盖时，覆盖值没有经过正式项目地址检查 | 测试构建可以从本机设置连到正式 Supabase；和“测试入口绝不连正式项目”的承诺不一致 | `src/cloud-config.js`：覆盖值先 `trim`，测试构建下同样调用 `isProdUrl`；命中正式项目或解析不了就关闭云端 |
| 2 | 登录凭证只检查有没有 `userId`，不检查访问令牌 / 刷新令牌 / 过期时间是否齐全 | 残缺凭证会进入同步层：可能拿 `undefined` 访问令牌请求进度，或拿缺失刷新令牌去刷新 | `src/sync.js`：新增凭证形状校验；损坏凭证只显示“需要重新登录”，不发出任何网络请求 |
| 3 | 已登录账号 A 时，用 B 的邮箱登录，会先把 B 的验证码 / 发信请求发到 Supabase，之后才在本机拒绝 | 多一次无意义的跨账号登录请求，容易让用户以为正在切换账号 | `src/sync.js`：`sendCode` / `verify` 在联网前先检查当前账号；邮箱不同直接返回 `other-account` |
| 4 | 游客记录导入账号后，云端只记了旧内容指纹；游客后来又学了新内容时，再次登录会把“已导入”当成整条记录已处理，静默用旧云端进度 | 游客新增的 XP / 关卡可能丢，且用户看不到选择 | `src/sync.js`：只有“同一个游客编号 + 同一个内容指纹”才算已导入；指纹变了重新让用户选择保留云端或转存新游客记录 |

没有改游戏规则：XP 数值、红心、连续天数、解锁、错题回炉都没动；也没有改数据库 `schema.sql`。

## 2. 测试

### 2.1 专项 Node 测试

```bash
node tests/login-sync-hardening.test.mjs
```

本次专项 **89 项**；现有登录/同步相关套件也一起跑，数量如下：

| 套件 | 项数 |
|---|---:|
| `tests/login-sync-hardening.test.mjs`（本次新增） | 89 |
| `tests/sync-mutation.test.mjs`（本次新增，反向验证） | 6 |
| `tests/cloud-sync.test.mjs` | 40 |
| `tests/cloud-sync-tabs.test.mjs` | 6 |
| `tests/cloud-sync-replaced.test.mjs` | 6 |
| `tests/cloud-config.test.mjs` | 14 |
| `tests/cloud-sync-project.test.mjs` | 12 |
| `tests/cloud-sync-switch.test.mjs` | 27 |
| `tests/data-compat.test.mjs` | 30 |

本次 89 项覆盖：

- 不同 Supabase 项目、同一个用户 ID：正式 / 测试项目的本机副本、当前账号、凭证不串。
- 不同邮箱：A 强制退出后 B 登录，B 从 0 开始，不合并 A 的 40 XP 本机副本。
- 离线答题两关（40 XP）→ 重连 → 连续同步 3 次，云端只加一次 40 XP。
- 强制退出保留未上传副本（40 XP）→ 同账号重新登录 → 继续上传 → 再同步不重复。
- 损坏 JSON、缺访问令牌、缺刷新令牌、缺过期时间、缺用户编号、错误项目凭证：恢复后为“需要重新登录”，网络调用 0 次。
- 合法但快过期的凭证：先刷新一次；旧访问令牌不会被发给进度接口。
- 云端关闭：同步 0 请求；`createApi` 未配置时 `fetch` 0 次。
- 测试配置拒绝正式项目网址及 11 种伪装写法（大小写、末尾点、全角、百分号编码、反斜杠、子域名、`javascript:`、`data:`、协议相对、空白），并对 `localhost` / `127.0.0.1` 两种本机覆盖各跑一遍。
- 旧 v3 游客记录 → 账号文档：XP 190、完成 8 关、日期 10-30 到 11-02、红心 3、音效 C、振动关、账号归属全部不变。
- 游客记录导入后又有新进度：再次登录提示选择，选择转存后云端 80 XP，不是 70 也不是 150。

### 2.2 反向验证（故障注入）

```bash
node tests/sync-mutation.test.mjs
```

把源码复制到临时目录，每次只拆掉一处关键逻辑，再跑同一份专项测试：

1. 项目命名空间失效（两个项目共用本机键）→ 变红。
2. XP 合并从取较大值改成相加（重复同步会重复加分）→ 变红。
3. 凭证项目检查失效（错误项目令牌拿去联网）→ 变红。
4. 强制退出也删除未上传的本机副本 → 变红。
5. 测试入口 localhost 覆盖不检查正式项目 → 变红。

对照组（源码不改）全绿；共 6 项检查。

### 2.3 数据库权限测试

```bash
PG_BIN=/path/to/postgresql/bin bash supabase/tests/run-all.sh
```

脚本自己 `initdb` 一个只开 Unix 套接字、不监听网络的临时 PostgreSQL，跑完销毁；不继承调用者的 `PG*` 变量，不连接 Supabase。

本机 PostgreSQL 17.11 结果：**78 项全部通过**

- `isolation.sql`：18 项（原有）
- 并发保存：1 项（同一 `expected_rev` 只有一个会话成功）
- `review-1.sql`：37 项（跨账号 RLS、身份校验、文档校验）
- `review-2.sh`：22 项（登录角色、FORCE RLS 现状、旧版 schema 升级并重复执行两次）

> 说明：本机只解压了 PostgreSQL 17 的服务端包，`psql` 用系统客户端，所以跑的时候用 `PG_BIN` 指向解压出的 `bin`；脚本会自动找到旁边的 `share/postgresql/17`。正常装了 PostgreSQL 的机器直接 `bash supabase/tests/run-all.sh` 即可。

### 2.4 完整测试

```bash
npm run build
PLAYWRIGHT_BROWSERS_PATH=/path/to/playwright-browsers npm test
```

`npm test` 已把 `test:hardening` 接到末尾；`test:db` 单独跑数据库权限测试，不把 PostgreSQL 环境要求塞进普通 `npm test`。

## 3. 没有验证的内容

- 没有连接真实 Supabase，也没有用真实邮箱 / 真实用户数据；验证码、令牌签名、过期、退出登录后的服务端失效、真实 RLS 属主权限都只能在独立测试项目上人工验收。
- 数据库测试用的是本机临时 PostgreSQL 17.11，不是 Supabase 的 PostgREST / 真实 `auth.uid()` 环境；`FORCE RLS` 下真实 `postgres` 属主是否有 `BYPASSRLS`，仍要在独立测试库人工确认（本机只验证了模拟属主）。
- 没有跑 WebKit / 真机 / iPhone / iPad；`npm test` 里的浏览器部分是 Chromium 模拟。
- 没有测试服务端限流、邮件送达、真实网络抖动下的重试时序。

## 4. 未改的东西

- 没有 merge、部署、强推、删分支，也没有改 `main` / `release/*`。
- 没有在 GitHub 留言。
- 没有读 / 存任何数据库密码、secret、`service_role` 密钥。
- 没有改题库、设计、跳关或其他功能。
