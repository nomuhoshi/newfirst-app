# R1（损坏游客导入待办守卫）× DB-3.1（退出异常修复）整合

分支：sonnet3/r1-fix-integration。基线：claude/db3-1-refresh-errors @ 68212e8e（含 98abe0a storage guards、4c565d1 退出顺序、208ee2e 退出异常、68212e8 刷新错误判断）。
R1 来自 GPT 在 a2c447e 上实跑并修正字段顺序误判后的完整 diff（26 项）；本分支用 `git cherry-pick 4c3893c`（我之前在 a2c447e 上原样应用 R1 的提交）接入，**没有文本冲突**（sync.js 自动合并）。不含 GPT1-003（本机写回重试上限），也不含 GPT 早期 37c8eca / b10004f。

## 冲突处理说明
文本上没有冲突，但语义上有两处交叠，逐条审过：
1. **R1 的 `logout` 守卫在最前面**（`importGuard()` 为真就直接返回/走手写的纯本机退出），在我的退出顺序（snapshot → cleanLocal → revokeCloudSession → 清凭证）之前。所以：损坏/读不出的待办下，普通退出不会走到 ensureToken / signOut / refresh，一个云端请求都不发；强制退出（force 或 forceLocal）一律纯本机，不尝试撤销云端会话，返回 `cloudSessionMaybeValid`。待办正常时 R1 的守卫不介入，我的退出顺序和 bad_jwt / 刷新错误判断原样生效（INT-4 证明）。
2. **R1 手写的本机清理与我的 `cleanLocal` 不完全等价**，不能凭“效果等价”放行，逐项对照：

| 情形 | 我的 cleanLocal(clearAuth,keepCopy) | R1 守卫内手写清理 | 结论 |
|---|---|---|---|
| 账号指针删除失败 / 静默无效 | 回滚，不联网 | 回滚（读回确认），回滚也失败则 `rollbackFailed:true` | 等价，且 R1 对“回滚也失败”更诚实 |
| 凭证 removeItem 抛错，setItem 可用 | 写 `{revoked:true}` 撤销标记并读回，算清理成功 | 不写标记，**回滚为登录态** | R1 更保守（宁可没退出也不用标记蒙混）；保留 R1 行为，INT-2 固定下来 |
| 凭证先删除再抛错 | 读回为空 → 成功 | **旧代码：抛错就当失败 → 凭证已没了却回滚成登录态（不一致）** | 真缺陷，已修（见下） |
| 副本 | keepCopy 时不动 | 不动 | 等价 |

## 发现并修复的缺陷
R1 守卫里 `try { storage.removeItem(AUTH_KEY); authCleared = storage.getItem(AUTH_KEY) === null; } catch {}`：removeItem 若“先删后报错”，`authCleared` 保持 false，随后把账号指针回滚成已登录——结果凭证没了、指针回来了、返回 `ok:false`，用户处于“登录态但没有凭证”的半退出。改为 removeItem 的异常单独吞掉，**以读回为准**判断是否清掉。数据（游客记录、损坏待办、账号副本）本来就没动，所以不是丢数据，但状态不一致。

## 新增验证
- `tests/r1-logout-integration.test.mjs`（12 项，真实 createApi + 真实 createSync，只替换 fetch）：
  - INT-1 corrupt / read-failed：普通退出零云端请求（云端即使配置成 bad_jwt / 刷新 403 也根本没被问到），三样数据逐字节不变，仍是登录态。
  - INT-2 强制退出故障矩阵：指针删除抛错、指针删除静默无效、凭证删除抛错（写入可用）、凭证删除静默无效、凭证先删后报错；每种都零网络；游客记录、损坏待办、账号副本逐字节保留；失败的回滚后与故障前逐字节一致，故障解除后重试成功。
  - INT-3 / 3b 强制退出成功（forceLocalLogout 与 logout({force:true})）：零网络，三样数据逐字节保留，待办仍是 corrupt，重开页面不复活登录。
  - INT-4 待办正常时 bad_jwt + 刷新 403 not_admin / 404 / 400 invalid_request：保持登录，凭证 / 游客记录 / 账号副本原样，各只发 1 次 logout 和 1 次 token。
- 变异测试：harness 扩展为同时跑 R1 测试（识别 node:test 的 `not ok`），新增 5 项 R1×退出变异（损坏下普通退出不再被拦、凭证不读回、凭证没清掉也宣称成功、指针没清掉也宣称成功、凭证清理失败后不回滚指针），并对 R1 的两个测试文件各加一条“未改源码的对照”。
- `npm run test:hardening` 追加 `node tests/r1-logout-integration.test.mjs`。

## 仍未验证
- 真实 Supabase、iPhone / 微信真机。
- UI 上 `import-corrupt` / `import-read-failed` 的确认弹窗只做了 R1 自带的单元覆盖，没有浏览器级测试。
- “恢复流程”（如何修复损坏待办）不在本任务范围，R1 只负责锁定与保全。
