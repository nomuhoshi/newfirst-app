# 26 登录 / 同步加固（第二轮返工）：旧 true、弹窗并发、保留云端、安全合并

更新：2026-11-05  
分支：`dsh/login-sync-hardening-2`  
基线：`6d2e566`（在其后追加提交，没有开新分支）  
范围：只改登录 / 游客导入 / 云同步的安全逻辑与测试；不接真实 Supabase、不部署、不 merge、不改正式分支、不开 PR、不开 DB-3。

## 1. 产品官指出的 4 个 P0 与修复

| # | 修复前（6d2e566） | 修复后 |
|---|---|---|
| 1 | 旧 `imported[gid] = true` 没有指纹，却用云端总 XP / 总次数 / 日期判断“游客内容已被覆盖” | `guestHasLearning()` 判断游客有没有学习记录。旧 `true` + 有学习记录 → `unknown`，必须提示；游客完全为空才允许跳过 |
| 2 | 登录验证码后把 `remoteDoc` 挂在 `waiting` 上下文里，用户点选择时继续用那份旧文档 | 两个选择分支都在真正写入前重新 `getProgress()`；CAS 冲突后也重新读、重新算、再写 |
| 3 | 选“保留云端”只把旧云端存成本机副本，不写游客指纹，游客每次登录都重复弹 | 重读最新云端，只写 `imported[gid] = 当前游客指纹`；其余字段逐字保留；CAS 冲突重读再写；游客记录不动 |
| 4 | 选游客走 `replaceWithGuest`，代数 +1、整份覆盖，其他设备的数据被清掉 | 改成 `mergeGuestProgress` 安全合并：以最新云端为底，XP / 次数按设备取较大值，关卡 / 日期取并集，红心 / 设置 / 其他设备 / 弹窗期间新增进度全部保留 |

## 2. 统一状态定义

`src/account-data.js` 现在只有一套游客导入状态，`guestImportStatus()`、`replaceWithGuest()`、`src/sync.js` 共用：

| 状态 | 条件 | 行为 |
|---|---|---|
| `new` | `imported[gid]` 不存在 | 需要决定是否导入 |
| `same` | 游客完全没有学习记录；或指纹格式且指纹一致 | 允许跳过，不弹 |
| `changed` | 指纹格式且游客指纹变了 | 必须提示 |
| `unknown` | 旧 `true` 没有指纹，但游客有学习记录 | 必须提示，禁止推断“没变” |

“有学习记录”只看 XP、完成次数、完成关卡、最后学习日 / 连续天数；红心计时、设置、开场介绍不算。

## 3. 两个选择的真实流程

### 3.1 保留云端

1. 重新 `getProgress()` 读最新云端（不用挂起时的 `remoteDoc`）。
2. 复制最新云端文档，只改 `imported[gid] = 当前游客指纹`。
3. 用最新 `rev` 做 CAS：`saveProgress(expected_rev)`；返回 `rev:null` 就重读、重写（最多 5 次）。
4. 成功：本机账号副本对齐这份云端文档，`dirty=false`。
5. 游客记录原样保留；同一游客再来不弹；游客内容再变（指纹变化）再弹。

### 3.2 安全合并

1. 重新读最新云端。
2. 以最新云端为底：`xp[本机设备] = max(云端本机格, 游客 XP)`、`runs[本机设备] = max(...)`；关卡键取并集（保留云端日期），日期列表取并集。
3. `gen` / `lineage`、其他设备 XP / 次数 / 关卡、红心、设置全部保持云端最新值。
4. 写本机副本后再上传；CAS 冲突重读、重新合并、再写（最多 5 次）。
5. 上传成功后再读回云端，只有读回文档与刚上传文档完全等价、且游客原文没变，才删游客。
6. 上传失败、CAS 冲突用尽、读回失败、读回不一致：游客原文一律保留；本机副本保留合并后的结果，不回退到旧云端。

## 4. 修改文件

- `src/account-data.js`
  - 新增 `guestHasLearning()`、`markGuestImported()`、`mergeGuestProgress()`。
  - `guestImportStatus()` 增加 `unknown`；删除按总量 / 次数 / 日期推断的 `guestCoveredByCloud()`。
  - `replaceWithGuest()` 只做 `keep-cloud`（只写指纹）或安全合并，不再 gen+1 整份覆盖；没有选择时返回 `guest-changed` + `["keep-cloud","merge"]`。
- `src/sync.js`
  - 新增 `readLatestCloud()`、`writeKeepCloud()`、`writeMergeGuest()`。
  - 弹窗挂起后不信任 `ctx.remoteDoc`；CAS、重读、读回校验、删除游客都在这里完成。
  - 失败时保留挂起上下文，用户可以在同一个弹窗重试。
- `src/account-ui.js`
  - “用账号里的进度” → “保留云端进度（推荐）”。
  - “用这台设备的进度覆盖账号” / “确定覆盖” → “安全合并游客进度”，删除整份覆盖确认页。
- `tests/login-sync-hardening.test.mjs`
  - 新增 I.1–I.16 硬测试；原 H 段保留并改为安全合并断言；Case 10 改为硬断言。
- `tests/sync-mutation.test.mjs`
  - 旧 true 故障注入更新；新增“保留云端不重读”“安全合并不重读”“改回 gen+1”“不写指纹”“读回不校验”5 个 mutation。
- `tests/step5.test.mjs`、`tests/step5-fixes.test.mjs`
  - 行为从“gen+1 覆盖”改为“安全合并”，不是放宽测试：断言其他设备数据必须保留、gen / lineage 不变。
- `docs/25-login-sync-hardening-2.md`：顶部标注返工；验收以本文件为准。

## 5. 必做硬测试对应关系

| 产品要求 | 测试 |
|---|---|
| 1 云端 500 XP 遮蔽游客新增 10 XP → 必须提示 | I.1 |
| 2 云端次数更高但游客新增复习 → 必须提示 | I.2 |
| 3 云端已有同关卡但游客新增 XP / 日期 → 必须提示 | I.3 |
| 4 弹窗期间另一设备增加 XP 和关卡 → 合并后保留 | I.8（另有 I.7 保留云端、I.14 / I.15 CAS 冲突） |
| 5 安全合并后其他设备数据完整保留 | I.9 |
| 6 选云端写入指纹后第二次不重复弹窗 | I.6 |
| 7 游客再次变化后重新弹窗 | I.6 |
| 8 上传失败保留游客 | I.10 |
| 9 读回失败保留游客 | I.11 |
| 10 读回不一致保留游客 | I.12 |
| 11 读回一致才删除游客 | I.13 |
| 12 去掉“重新读取最新云端”或改回 gen+1 → mutation 必须变红 | `tests/sync-mutation.test.mjs` 对应 3 个注入 |
| gemini Case 10 不再软红 | I.0 硬断言 |

## 6. 修复前 / 修复后结果

### 6.1 专项硬测试

用同一份 `tests/login-sync-hardening.test.mjs` 跑：

| 源码 | 结果 |
|---|---|
| 修复前 `6d2e566` | **21 项失败 / 140 项** |
| 修复后本分支 | **0 项失败 / 140 项** |

修复前失败的正是 P0 覆盖点：旧 true 的 4 种遮蔽、保留云端不写指纹 / 重复弹、弹窗并发丢数据、gen+1 清掉其他设备、CAS 冲突后新增丢失等。

### 6.2 Mutation

`node tests/sync-mutation.test.mjs`：**12 项全过**（1 项未改源码对照 + 11 个故障注入）。其中：

- 旧 true 一律 `same` → 变红。
- 保留云端不重读最新 `remoteDoc` → 变红。
- 安全合并不重读最新 `remoteDoc` → 变红。
- 安全合并改回 gen+1 整份覆盖 → 变红。
- 保留云端不写指纹 → 变红。
- 读回不校验也删游客 → 变红。

### 6.3 完整测试

`PLAYWRIGHT_BROWSERS_PATH=.pw-browsers npm test`：**1048 项全绿，0 项失败**。

分套件：64 + 239 + 30 + 43 + 66 + 66 + 58 + 96 + 15 + 17 + 22 + 67 + 40 + 14 + 30 + 29 + 140（登录/同步加固）+ 12（反向验证）= 1048。

说明：完整套件在本机跑第一次时遇到 step4 / step7 两个与本改动无关的 Playwright 等待超时（单独重跑都通过）；第三次完整重跑 0 项失败。

### 6.4 数据库测试

`npm run test:db`：**全部通过**。

- `isolation.sql`：18 / 18 PASS（预期 18）。
- `concurrency.sh`：PASS（同一 expected_rev 的并发保存只成功一个）。
- `review-1.sql`：37 / 37 PASS（预期 37）。
- `review-2.sh`：22 / 22 PASS，0 失败。
- 脚本最终输出：`全部通过`。

### 6.5 GitHub CI

代码提交 `5567fe0` 已触发 GitHub Actions（`workflow_dispatch`，ref = `dsh/login-sync-hardening-2`）：

<https://github.com/nomuhoshi/newfirst-app/actions/runs/42038692292>

- `build`：success（完整 `npm test`）。
- `mobile (chromium)`：success。
- `mobile (webkit)`：success。
- `deploy`：skipped（只在 `refs/heads/main` 部署；没有开 PR、没有 merge、没有部署）。

本次没有改 `.github/workflows/`，用的是已有的 `workflow_dispatch` 入口；同一提交上 build / Chromium / WebKit 三个 job 全绿。

## 7. 没验证的内容

- 没有连接真实 Supabase，没有真实邮箱 / 验证码 / 生产数据；RLS、邮件送达、令牌过期仍需独立测试项目人工验收。
- 没有 iPhone / iPad 真机验证；CI 的 Chromium / WebKit 是 Playwright 模拟。
- 没有覆盖真实网络抖动、服务端限流、Supabase 项目闲置暂停。
- 没有发布预览、没有部署、没有 merge。

## 8. 七项汇报

1. **分支**：`dsh/login-sync-hardening-2`，在基线 `6d2e566` 后追加提交；没有开新分支。
2. **提交**：代码与测试 `5567fe0`；本文件补 CI 链接的文档提交见远端分支 HEAD。
3. **修改文件**：见 §4。
4. **测试证据**：见 §6（专项 140/140、mutation 12/12、完整 `npm test`、数据库测试、CI 三绿 / deploy skipped）。
5. **真实缺陷**：§1 的 4 个 P0；修复前专项 21 项红，修复后 0 项红。
6. **未验证项**：见 §7。
7. **是否触碰正式环境**：没有。没有连接真实 Supabase、没有读 secret / service_role、没有部署、没有 merge、没有改正式分支、没有开 PR、没有在 GitHub 留言、没有开 DB-3。
