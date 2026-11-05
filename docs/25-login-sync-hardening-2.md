> **返工说明（2026-11-05）**：产品官复核发现本文件对应的 `6d2e566` 仍有 4 个 P0：旧 `true` 用总量/次数/日期推断“未变化”、弹窗挂起期使用旧 `remoteDoc`、选“保留云端”不写指纹、选游客仍用 gen+1 整份覆盖。已在同一分支追加返工提交，验收见 `docs/26-login-sync-hardening-2-rework.md`。

# 25 登录 / 同步加固（第二轮）：旧游客导入 + 真实构建隔离

更新：2026-11-05  
分支：`dsh/login-sync-hardening-2`  
基线：`dsh/login-sync-hardening-1` @ `b1aa1e0`  
范围：只处理旧游客导入的数据丢失风险，以及“真实构建产物”的登录 / 同步隔离验证；不接真实 Supabase、不部署、不 merge、不改正式分支。

## 1. 这次修的真实缺陷

### 1.1 旧 `imported[游客编号] = true` 会静默吞掉游客新进度

云端早期记录只记了“这个游客编号导入过”，没有记内容指纹。第一轮加固已经把**新格式（8 位指纹）**处理好：指纹变了会让用户重新选择。但旧格式 `true` 仍然被当成“整条游客记录已经处理完”：

```js
// 修复前（问题代码）
const alreadyImported = imported === true || (typeof imported === "string" && imported === guestFp);
```

于是出现这条真实路径：

1. 游客记录 70 XP 导入账号，云端 `imported[gid] = true`；
2. 之后同一台设备又以游客身份学了新关卡，游客记录变成 80 XP；
3. 再次登录时，代码看到 `true` 就直接用云端 70 XP，游客新增的 10 XP 和关卡被静默忽略，用户看不到任何选择。

### 1.2 修复方式

在 `src/account-data.js` 增加纯函数 `guestImportStatus(cloudDoc, guestId, guestState)`，返回三种状态：

| 云端 `imported[gid]` | 判断 | 结果 |
|---|---|---|
| 不存在 | 没导入过 | `new` |
| 8 位指纹 | 与当前游客内容指纹比较 | 相同 `same`，不同 `changed` |
| 旧 `true` | 检查云端是否已经包含游客当前的全部关卡、XP、完成次数、学习日期 | 全覆盖 `same`，任何一项超出 `changed` |

只要不是 `same`，`src/sync.js` 就进入“提示用户选择保留云端 / 用游客记录覆盖”，不再静默使用云端。`replaceWithGuest` 也改用同一个判断；用户明确选“转存”时，旧 `true` 且确实有新内容的游客记录会被真正覆盖（代数 +1），不会因为 `already-imported` 又退回云端。

保留一个安全边界：旧 `true` 且游客内容完全被云端覆盖时（例如只是红心计时、设置变化，或云端早已包含这些关卡），不会每次登录都重复弹窗；只有当前游客记录确实多出内容时才提示。

## 2. 四条路径的行为

| 用户选择 / 情况 | 云端 | 游客记录 | 本机账号副本 |
|---|---|---|---|
| 选云端 | 保持 70 XP，不累加 | 逐字保留，以后还能再选 | 云端这份 |
| 选游客 | 用游客 80 XP 覆盖，代数 +1 | **上传成功且读回一致后**才删除 | 80 XP |
| 上传失败 | 保持 70 XP | 逐字保留 | 80 XP，标记待上传；联网后补传 |
| 读回失败 | 上传已成功（80 XP） | 逐字保留（没有读回一致就不删） | 80 XP |

旧 `true` 格式和新指纹格式都跑同一组四条路径；另有“旧 `true` + 游客没变不重复提示”的对照。

## 3. 修改文件

- `src/account-data.js`：新增 `guestImportStatus` / 旧 `true` 覆盖判断；`replaceWithGuest` 使用统一判断。
- `src/sync.js`：登录时用 `guestImportStatus` 决定是否提示，不再把旧 `true` 一律视为已处理。
- `vite.config.js`：`PREVIEW_ID` 允许连字符，使 `PREVIEW_ID=login-sync` 的真实键前缀是可读的 `login-sync:`，缓存前缀是 `login-sync-suipian-`。
- `tests/login-sync-hardening.test.mjs`：新增旧 `true` / 新指纹 × 选云端 / 选游客 / 上传失败 / 读回失败，共 119 项。
- `tests/sync-mutation.test.mjs`：新增“旧 `true` 一律当作已导入”的故障注入，反向验证测试会变红。
- `tests/preview-build-isolation.test.mjs`：新增真实构建 + 浏览器隔离测试（Chromium / WebKit）。
- `tests/webkit/run.mjs`、`package.json`：把构建隔离测试接入移动端测试。
- `tests/step5.test.mjs`：旧断言“app.js 不能引用账号模块（本阶段不接入）”已经被后续接入推翻；改为验证“账号模块已接入，但游客记录仍是 v3、仍用 `suipian.progress`，storage.js 不引用账号模块”。不是放宽测试。
- `.gitignore`：忽略本地可部署产物 `dist-login-sync/` 和本地测试日志 / 浏览器目录。
- 验收文档就是本文件。

## 4. 测试证据

### 4.1 专项 Node 测试

```bash
node tests/login-sync-hardening.test.mjs
node tests/sync-mutation.test.mjs
```

- `login-sync-hardening.test.mjs`：**119 项全绿**。
- `sync-mutation.test.mjs`：**7 项全绿**。其中新增的故障注入：

```js
// 把旧 true 的内容覆盖判断拆掉
if (prev === true) return "same";
```

拆掉后专项测试变红，说明测试不是“永远通过”。

### 4.2 真实构建 + 浏览器隔离测试

```bash
PLAYWRIGHT_BROWSERS_PATH=... node tests/preview-build-isolation.test.mjs
```

测试内部会真的执行两次构建：

1. `PREVIEW_ID=login-sync`，不设测试云 → 云端关闭产物；
2. `PREVIEW_ID=login-sync` + `TEST_SUPABASE_URL=http://127.0.0.1:<随机端口>` + 假公开密钥 → 指向本机假服务器的产物。

验证内容：

- 云端关闭产物：打开的“我的”页显示“云端暂未开通”，没有登录按钮；浏览器发出的 Supabase 请求为 **0**。
- 正式版 `suipian.auth`、`suipian.session`、`suipian.acct.prodUser1`、`suipian.progress`、`suipian.device`、`suipian.guestId` 在测试入口运行前后**逐字相同**。
- 测试入口新增的键全部以 `login-sync:` 开头（账号相关键还带测试项目命名空间 `proj:<主机名>:`）。
- 假服务器产物：发码 / 验证码 / 读进度 / 建记录全部发往 `http://127.0.0.1:<端口>`；所有请求（包括静态资源）都不含正式 Supabase 域名，假服务器收到的 Host 也不含正式域名。
- 两份构建的 Service Worker 缓存前缀都是 `login-sync-suipian-`，不会清掉正式版缓存。

本机 Chromium 已跑：**14 项全绿**。WebKit 由 GitHub CI 的 `mobile (webkit)` 跑。

### 4.3 完整测试

```bash
PLAYWRIGHT_BROWSERS_PATH=... npm run build
PLAYWRIGHT_BROWSERS_PATH=... npm test
```

本机结果：`npm test` **1022 项全绿**（各套件“共 N 项”相加；含 119 项专项和 7 项反向验证）。Chromium 移动端套件也在本机跑过。

远端 CI（代码提交 `6d2e566`）：<https://github.com/nomuhoshi/newfirst-app/actions/runs/42027618179>

- `build`：success（完整 `npm test`）。
- `mobile (chromium)`：success。
- `mobile (webkit)`：success；WebKit 日志里 `[webkit] 真实构建隔离验证：共 14 项，失败 0 项`。
- `deploy`：skipped（只在 main 部署）。

CI 触发说明：本仓库当前的 GitHub OAuth 凭证没有 `workflow` scope，不能推送 `.github/workflows/` 的修改，所以这次没有改 CI 触发配置。推送 `dsh/login-sync-hardening-2` 后，用已有的 `workflow_dispatch` 入口在**这个分支的同一提交**上跑完整工作流：

```bash
gh workflow run "Test and deploy" --ref dsh/login-sync-hardening-2
```

`deploy` 的条件仍是“只在 `refs/heads/main`”，这次会明确显示 skipped；build、Chromium、WebKit 三个 job 照常跑。没有开 PR、没有 merge、没有部署。

## 5. 可部署产物与接库说明（未发布）

这次**没有发布预览、没有部署、没有 merge**。可部署产物用下面的命令在本地 / CI 生成，输出到 `dist-login-sync/`（已在 `.gitignore`，不把构建结果提交进仓库）：

### 5.1 云端关闭产物（本次浏览器隔离验收用）

```bash
PREVIEW_ID=login-sync npm run build -- --outDir dist-login-sync --emptyOutDir
```

### 5.2 接独立测试 Supabase 项目

先在测试项目完成 `docs/22-test-supabase-setup.md` 的步骤（建表、关公开注册、只加老大的账号），然后：

```bash
PREVIEW_ID=login-sync \
TEST_SUPABASE_URL='https://<测试项目编号>.supabase.co' \
TEST_SUPABASE_ANON_KEY='sb_publishable_...' \
npm run build -- --outDir dist-login-sync --emptyOutDir
```

规则：

- 只放 **Project URL + publishable / anon key**；`service_role` / secret 密钥、数据库密码**绝不**进网页、仓库或聊天。
- 没给这两个变量 = 云端关闭，只能在本机学习。
- 网址是正式项目、解析不了、不是 http(s)（例如 `ftp:`、`javascript:`）→ 同样关闭云端。判断看解析后的主机名，大小写、端口、用户信息、路径、末尾点、全角字符等都绕不过。
- 独立测试项目的本机数据用 `login-sync:` + `proj:<测试主机名>:` 前缀；正式版的键一个都不动。
- 产物是纯静态文件，人工复制到预览仓库的独立目录即可；**不要**用它覆盖 `main`、`release/*` 或正式站。
- 想换回云端关闭：按 5.1 重新构建。

## 6. 没有验证的内容

- 没有连接真实 Supabase，没有用真实邮箱 / 验证码 / 真实用户数据；真实 RLS、邮件送达、令牌过期仍要在独立测试项目人工验收。
- 没有在 iPhone / iPad 真机跑；浏览器验证是 Playwright 的 Chromium / WebKit 模拟，不等于真机。
- 没有测真实网络抖动、服务端限流、Supabase 项目闲置暂停。
- 没有发布预览，也没有验证预览仓库的复制 / CDN 缓存行为。
- 旧 `true` 的“内容是否已覆盖”只能看学习内容（关卡 / XP / 完成次数 / 日期），不看红心计时和设置；这是有意为之，因为这两项不算学习进度，且导入时本来就会以游客记录为准。

## 7. 七项汇报

1. **分支**：`dsh/login-sync-hardening-2`，基线 `dsh/login-sync-hardening-1@b1aa1e0`。
2. **提交**：代码与测试提交 `6d2e566`；本文件补 CI 链接的文档提交见远端分支 HEAD。
3. **修改文件**：见 §3。
4. **测试证据**：§4；CI：<https://github.com/nomuhoshi/newfirst-app/actions/runs/42027618179>（build / Chromium / WebKit 全绿，deploy skipped）。
5. **真实缺陷**：§1.1，旧 `imported=true` 静默忽略游客新增关卡 / XP。
6. **未验证项**：§6。
7. **是否触碰正式环境**：没有。没有连接真实 Supabase、没有读 secret / service_role、没有部署、没有 merge、没有改正式分支、没有开 PR、没有在 GitHub 留言。
