# 28 登录 / 同步加固（DB-3 前置支线）：退出、删号、冲突与限流

更新：2026-11-05（通宵支线）  
分支：`dsh/login-sync-edge-hardening`  
基线：`dsh/login-sync-hardening-2` @ `9388a96`（1–4 的代码与 Gemini 复核分支保持原样）  
范围：只改登录 / 退出 / 删号 / 同步状态 / 429 限流与对应测试；不接真实 Supabase、不部署、不 merge、不改正式分支、不开 PR、不开 DB-3。

> **边界说明**：本分支是 DB-3 的**前置代码与测试准备**，不代表 DB-3 已放行；1–4 仍等 Gemini 独立复核，本文件不勾 1–4。Case 9（旧备份 gen 覆盖较新云端）依赖第 12 条的 `rev/updated_at` 比较，属于 DB-3 闸门内工作，本分支**没有实现、没有伪绿**，见 §6。

## 1. 结论

| 清单 | 本分支状态 | 说明 |
|---|---|---|
| 7 Case 5b 硬断言 | **完成** | 连续 5 次保存冲突后必须 `dirty.content=true`、`pending=true`，并且修好云端后能再次同步成功；不再用 `status === "error"` 兜底。 |
| 8 Case 7a / 7b / 8 硬断言 | **完成** | 7a 普通退出 signOut 失败保持登录；7b `forceLocalLogout()` 清本机凭证并提示云端会话可能仍有效；8 删号后本机清理失败不宣称成功、禁用旧令牌、保留清理待办。 |
| 8 Case 9 硬断言 | **阻塞（第 12 条 / DB-3）** | Case 9 要比较旧备份与本机 / 云端的 `rev` / `updated_at`；当前 schema 只有 gen/lineage，无法可靠判断“本机更旧”。本分支不越过闸门，保留为剩余阻塞。 |
| 9 普通退出失败 | **完成** | 同步失败或云端 signOut 失败时，保持当前账号、凭证、未上传副本；界面提供“强制本机退出”。 |
| 10 强制退出保护 | **完成** | 新增 `forceLocalLogout()`：清当前账号 / 本机凭证，保留未上传副本；同账号重登继续同步，云端只累计一次。 |
| 11 删号本机清理失败 | **完成** | 返回 `accountDeleted + pendingLocalCleanup`，禁用旧令牌、隔离副本、写清理待办；界面显示恢复提示和“重试清理”，下次启动自动重试。 |
| 13 五次保存冲突 | **完成** | 停止自动退避（`autoRetry=false`），保留 dirty 副本和 `pending=true`，给出明确文案；手动“立即同步”仍可再试。 |
| 14 验证码 / 同步 429 | **完成** | 发码、校验、进度同步三条冷却独立；显示剩余秒数；冷却期内不再发请求；不真实发送验证码。 |
| 16 场景 9 / 11 独立数据 | **完成** | `tests/cloud-sync-edges.test.mjs` 内场景 9（普通退出失败）与场景 11（删号本机清理失败）各自显式构造完整账号副本、当前账号、凭证、设备编号，不引用场景 8 的文字初始态。 |
| 18 远端 CI 证据 | **见 §5** | build / Chromium / WebKit 分别记录；无权限或未跑到的项只列缺口，不编造。 |

未做 / 未勾：1–4（等 Gemini 复核）、第 12 条（旧备份 rev/updated_at，DB-3 闸门）、第 6 条（DB-3 整包放行，产品官决定）。第 15 条没有把 Case 10 再改一次：当前 `I.0` 已经是硬断言，保持原样，等 DB-2 完成后由产品官确认最终口径。

## 2. Case 5b / 13：冲突停止后仍是“待同步”，不是“错误”

### 2.1 修复前

`syncOnce()` 连续 5 次 CAS 失败后：

- `setStatus("error", "同步冲突太多次，请稍后再试")`；
- 没有把 `pending` 置为 true；
- 没有 `autoRetry` 标记，UI 的 60 秒定时器仍可能继续尝试；
- 软测试只看 `dirty.content===true || pending===true || status==="error" || status==="pending"`，把“error”也算过。

### 2.2 修复后

- 5 次冲突后从落盘副本重新判断 `localHasUnsent()`：有未上传内容就 `pending=true`；本机副本、dirty 标记一律保留。
- `autoRetryBlocked=true`，`status().autoRetry=false`；退避定时器回调也检查该标记，不再盲目自动重试。
- 状态文案明确写“连续 5 次保存冲突，已停止自动重试；这台设备上的进度还在，稍后点「立即同步」再试”。
- 用户手动 `syncNow()` 不受 `autoRetryBlocked` 限制；成功后清掉 dirty / pending / autoRetry。
- UI 的 online / visibility / 60 秒定时器在 `autoRetry===false` 时不自动同步；用户点“立即同步”仍会调用 `syncNow()`。

### 2.3 硬测试

`tests/cloud-sync-edges.test.mjs`：

- Case 5a：重试次数停在 5，返回 `kind:"conflict"`。
- Case 5b：本机 10 XP + `dirty.content===true` + `pending===true`。
- Case 5c：没有额外的自动退避定时器。
- Case 5d：`status.autoRetry===false` 且 `status.status==="pending"`。
- Case 5e：修好 `saveProgress` 后再次 `syncNow()` 成功，云端 10 XP，本机 dirty/pending 清零。

## 3. 退出 / 强制退出 / 删号

### 3.1 普通退出（第 9 条）

`logout()` 现在：

1. 用落盘的 `localHasUnsent()` 判断，不只看内存 `pending`；有未上传内容先同步。
2. 同步失败：返回 `{ok:false, pending:true, keptLogin:true}`，不动账号、凭证、副本。
3. 云端 `signOut` 抛错或返回失败：返回 `{ok:false, keptLogin:true, cloudSessionMaybeValid:true}`，仍然保持登录；界面弹“强制本机退出”确认。
4. 本地删除副本 / 当前账号 / 凭证任一步失败：不谎报成功；能回滚时把副本和当前账号恢复回去。

`cloud-api.signOut()` 不再无条件返回 `{ok:true}`；网络失败会如实返回，普通退出才能知道“云端没确认”。

### 3.2 强制本机退出（第 10 条）

新增 `forceLocalLogout()`：

- 清当前账号、本机凭证（`AUTH_KEY` 删不掉时写 `{revoked:true}`，让 `readAuth()` 立刻失效）；
- **保留**未上传账号副本和游客导入待办；
- 返回 `cloudSessionMaybeValid`，界面提示“云端会话可能仍然有效”；
- 同一账号重新登录时，`begin()` 读回本机副本，`syncNow()` 继续上传；测试验证云端 40 XP 只加一次。

### 3.3 删号成功但本机清理失败（第 11 条）

`deleteAccount()` 在云端删号成功后：

1. 先写清理待办 `suipian.acct.cleanup`（按项目命名空间隔离）。
2. 禁用旧令牌：`removeItem` 失败就覆盖成 `{revoked:true}`。
3. 清当前账号：`removeItem` 失败就写空字符串，让 `getCurrentAccount()` 返回 null。
4. 尝试删账号副本和游客导入待办。
5. 全部清干净才返回 `{ok:true}`；否则返回：
   - `{ok:false, kind:"local-cleanup", accountDeleted:true, pendingLocalCleanup:true, tokenRevokedLocally:true, copyIsolated:true, cleanup:{...}}`。
6. 界面：`onSwitchedOut()` 回到游客态，弹“账号已删除，本机还没清理完”，说明旧凭证已禁用，并提供“重试清理”。
7. `restore()` 启动时先执行 `retryLocalCleanup()`；清理没完成前不会把已删账号恢复成登录状态。

测试同时覆盖：恢复存储后 `retryLocalCleanup()` 成功、旧副本和待办都清掉；浏览器测试验证恢复提示和按钮。

## 4. 429 限流（第 14 条）

- `cloud-api.req()` 读取 `Retry-After`（秒数或 HTTP 日期），默认 60 秒，上限 3600 秒；429 返回 `retryAfter`。
- `sync.sendCode()`：本机 60 秒冷却；服务端 429 按 `retryAfter` 延长；冷却期内直接返回 `rate-limit`，**不发网络请求**。
- `sync.verify()`：只有服务端真的对校验接口回过 429 才冷却；正常“发完码马上输码”不会被发送冷却误伤。验证成功后清发送冷却，方便立即切换账号。
- `sync.syncNow()`：进度接口 429 → `status="rate-limit"`、`pending` 视本机未上传内容而定、`syncCooldownSeconds` 显示剩余；冷却期内再次同步不发请求，也不安排 3 秒网络退避。
- `account-ui`：发送 / 重新发送 / 登录按钮显示剩余秒数并禁用；429 文案使用服务端返回的 `retryAfter`，不是写死“一分钟”。
- 所有测试都用假 API / Playwright 拦截，**没有真实发送验证码**。

## 5. 测试与 CI 证据

### 5.1 专项

| 命令 | 结果 |
|---|---|
| `node tests/cloud-sync-edges.test.mjs` | 22 / 22 硬断言通过 |
| `node tests/login-sync-hardening.test.mjs` | 176 / 176 通过 |
| `node tests/sync-mutation.test.mjs` | 16 / 16 通过（含更新后的“强制退出也删除未上传副本”注入） |
| `node tests/cloud-sync.test.mjs` | 40 / 40 |
| `node tests/cloud-sync-tabs.test.mjs` | 6 / 6 |
| `node tests/cloud-sync-replaced.test.mjs` | 6 / 6 |
| `node tests/cloud-sync-project.test.mjs` | 12 / 12 |
| `node tests/cloud-sync-switch.test.mjs` | 27 / 27 |
| `node tests/data-compat.test.mjs` | 30 / 30 |
| `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers MOBILE_BROWSER=chromium node tests/account-ui.test.mjs` | 23 / 23（含 429 冷却、删号清理失败恢复） |
| `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers MOBILE_BROWSER=chromium node tests/account-replaced.test.mjs` | 23 / 23 |
| `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers MOBILE_BROWSER=chromium node tests/preview-build-isolation.test.mjs` | 14 / 14（真实构建隔离） |

### 5.2 构建与完整套件

- `npm run build`：成功（54 modules，dist 产物生成）。
- `PLAYWRIGHT_BROWSERS_PATH=.pw-browsers npm test`：**1185 项，0 失败**，退出码 0。含 `test:edges` 22 项、`test:hardening` 176 + 16 项。
- 本次完整套件在本机 Chromium 环境跑；WebKit 由远端 CI 的 `mobile (webkit)` 跑。

### 5.3 远端 CI（第 18 条）

待推送后补：workflow run 链接，以及 build / mobile (chromium) / mobile (webkit) / deploy 四个 job 的分别结果。没有权限或没跑到的项会明确写“未取得”，不编造。

## 6. 剩余阻塞 / 未验证

1. **Case 9 / 第 12 条未做**：旧备份抬高 gen 覆盖较新云端，需要 `rev` / `updated_at` 字段比较；当前 schema 只有 gen/lineage，SQL 也只在 `select=doc,rev`。这是 DB-3 闸门内工作，本分支不越过。
2. **DB-3 未开**：第 6 条要产品官在 DB-2 通过后放行；本分支只是前置代码与测试。
3. **1–4 未勾**：等 Gemini 独立复核；本分支没有修改 `dsh/login-sync-hardening-2` 的已交卷提交。
4. 没有连接真实 Supabase，没有真实邮箱 / 验证码 / RLS / 删号；429 的 `Retry-After` 是模拟响应。
5. 没有 iPhone / iPad 真机；本地只跑了 Chromium。WebKit 由远端 CI 的 `mobile (webkit)` 跑。
6. 没有 merge、部署、开 PR、强推、删远端分支，也没有改正式候选版 / 正式站 / 正式 Supabase。

## 7. 七项汇报

1. **分支**：`dsh/login-sync-edge-hardening`，基线 `dsh/login-sync-hardening-2@9388a96`。
2. **提交**：见本文件所在提交 / 远端分支 HEAD；代码与测试同一提交，CI 结果另补一个文档提交。
3. **改动文件**：`src/sync.js`、`src/account-store.js`、`src/account-ui.js`、`src/cloud-api.js`、`src/app.js`、`tests/cloud-sync-edges.test.mjs`（新增）、`tests/account-ui.test.mjs`、`tests/sync-mutation.test.mjs`、`package.json`、本文件。
4. **测试证据**：见 §5。
5. **真实缺陷**：普通退出 signOut 失败仍清本地、连续冲突只报 error 且 pending 可能为 false、删号后本机清理失败仍返回成功、429 没有冷却/连发保护。
6. **未验证项**：见 §6。
7. **是否触碰正式环境**：没有。没有连接真实 Supabase、没有读 secret / service_role、没有部署、没有 merge、没有改正式分支、没有开 PR、没有在 GitHub 留言、没有开 DB-3。
