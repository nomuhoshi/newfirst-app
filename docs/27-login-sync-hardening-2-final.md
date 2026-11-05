# 27 登录 / 同步加固（第二轮收尾）：专用待办、读回校验与重试

更新：2026-11-05  
分支：`dsh/login-sync-hardening-2`  
基线：`5567fe0`（在其后追加提交，没有开新分支）  
范围：只改登录 / 游客导入 / 云同步的安全逻辑与测试；不接真实 Supabase、不部署、不 merge、不改正式分支、不开 PR、不开 DB-3。

## 1. 结论

产品官复核 `5567fe0` 后指出的二次收尾问题已修完：

1. 选“保留云端”时，写指纹失败会提前把本机标成完成，导致下次登录重复弹窗，且没有可靠的重试入口。
2. 选“保留云端”上传成功但读回失败 / 不一致时，仍被当成已同步。
3. 安全合并上传成功但读回失败 / 不一致时，会谎报已同步，游客记录也可能被提前处理。
4. 合并时云端残留的旧 `imported[gid] = true` 会盖掉本机待上传的新指纹。

本轮恢复“上传 + 读回一致 + 清待办”三段都成功才算完成；任何一段失败都保留游客原文和专用待办，重开 / 重连 / 手动同步先重试待办。

## 2. 修复方式

- `src/account-store.js`：新增按账号隔离的“游客导入待办”键 `suipian.acct.import.<userId>`，记录游客编号、选择（`cloud` / `merge`）、指纹、游客原文快照；读写都做结构校验。退出登录不删待办，删账号才清。
- `src/sync.js`：
  - 登录完成时若存在待办，`pending` 为真，不再把“本机副本看起来干净”当成已完成。
  - 每次 `syncNow()` 先执行待办，再走普通同步；网络失败可重试，权限 / 数据 / 冲突错误不盲目重试。
  - “保留云端”和“安全合并”都改成：先算文档 → 上传 → 重新 `getProgress()` 读回 → 文档等价（保留云端还要求新指纹在云端）→ 才写本机干净副本并清待办。
  - 失败时本机副本不保存未确认的新指纹；保留本机期间新学的进度，重试时按同一代 / 同一 lineage 合并，账号在别处被替换则要求重新选择。
  - 返回 `synced:false`、`pending:true`，界面显示待同步，不显示已同步。
- `src/account-data.js`：`mergeDocs()` 中字符串指纹不被云端旧 `true` 覆盖。
- `tests/login-sync-hardening.test.mjs`：新增 J.1–J.6（运行时 33 项），覆盖写失败、重开重试、读回失败 / 不一致、重复合并、旧 true 覆盖、待办期间新学进度；另把 I.10–I.12 的 3 项状态断言改硬，合计新增 36 项。
- `tests/sync-mutation.test.mjs`：删除 2 条已失效的“不重读”注入，换成 7 条新注入（其中“读回不校验”拆成保留云端 / 安全合并两条）。

## 3. 本轮专项测试数字

全部命令都带 `timeout 300`；没有运行本地完整 `npm test`，没有等本地 Playwright。

| 命令 | 结果 |
|---|---|
| `timeout 300 node tests/login-sync-hardening.test.mjs` | **176 项，0 失败** |
| `timeout 300 node tests/sync-mutation.test.mjs` | **16 项，0 失败**（1 项未改源码对照 + 15 个故障注入） |
| 相关纯 Node 单测 9 套 | **244 项，0 失败** |
| `timeout 300 npm run build` | **成功**（54 modules，dist 产物生成） |

相关单测明细：

| 测试 | 结果 |
|---|---|
| `cloud-sync.test.mjs` | 40 / 40 |
| `cloud-sync-tabs.test.mjs` | 6 / 6 |
| `cloud-sync-replaced.test.mjs` | 6 / 6 |
| `cloud-sync-project.test.mjs` | 12 / 12 |
| `cloud-sync-switch.test.mjs` | 27 / 27 |
| `code-drafts-scope.test.mjs` | 15 / 15 |
| `data-compat.test.mjs` | 30 / 30 |
| `step5.test.mjs` | 88 / 88 |
| `step5-fixes.test.mjs` | 20 / 20 |

专项 + 相关单测合计：**436 项，0 失败**。

## 4. 反向验证

`sync-mutation.test.mjs` 的 15 个注入都必须让测试变红，实际全部被抓到：

- 项目命名空间失效。
- XP 合并改成相加。
- 凭证项目检查失效。
- 强制退出删除未上传副本。
- 测试入口 localhost 覆盖不检查正式项目。
- 旧 true 一律当作已导入。
- 安全合并改回 gen+1 整份覆盖。
- 保留云端不写游客指纹。
- 保留云端失败时把带新指纹的文档存成本机干净副本。
- 专用待办重开 / 重连后不重试。
- 重试成功后不清专用待办。
- 旧 true 覆盖待上传的新指纹。
- 保留云端读回不校验。
- 安全合并上传失败也谎报已同步。
- 安全合并读回不校验。

## 5. 远端 CI

推送后由 GitHub Actions 跑完整 `npm test`、build、Chromium / WebKit。结果链接在代码提交后补到本节；本文件不把“本地专项绿”等同于“远端全量绿”。

## 6. 未验证项

- 没有连接真实 Supabase，没有真实邮箱 / 验证码 / 生产数据；RLS、邮件送达、令牌过期仍需独立测试项目人工验收。
- 没有 iPhone / iPad 真机验证；远端 Chromium / WebKit 也只是 Playwright 模拟。
- 没有本地运行完整 `npm test`，也没有本地运行 `account-ui`、`account-replaced`、`progress-file`、`preview-storage` 等 Playwright 测试；这些交给远端 CI。
- 没有覆盖真实网络抖动、服务端限流、Supabase 项目闲置暂停。
- 没有部署、没有 merge、没有开 PR、没有强推、没有碰正式 Supabase。

## 7. 七项汇报

1. **分支**：`dsh/login-sync-hardening-2`，在 `5567fe0` 后追加提交；没有开新分支。
2. **提交**：代码与测试提交见远端分支 HEAD；CI 结果补录提交另计。
3. **改动**：`src/sync.js`、`src/account-data.js`、`src/account-store.js`、`tests/login-sync-hardening.test.mjs`、`tests/sync-mutation.test.mjs`、`docs/26` 说明、本文件。
4. **专项测试数字**：专项 176/176、反向验证 16/16、相关单测 244/244，合计 436 项 0 失败；`npm run build` 成功。
5. **反向验证**：15 个故障注入全部被抓到，见 §4。
6. **CI run 链接**：见 §5。
7. **未验证项**：见 §6。
