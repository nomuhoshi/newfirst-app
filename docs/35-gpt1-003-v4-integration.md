# GPT1-003 v4（本机写回失败重试上限）整合到 f9d8c823

分支：sonnet3/gpt1-003-v4-integration。目标基线：f9d8c823（= R1 守卫 + DB-3.1 退出修复 + Sonnet2 的退出故障注入）。v4 补丁原基线 208ee2e，**没有使用包内 apply-offline.mjs**（它限定旧基线），而是 `git apply --reject` 后逐块手工合并。v4 包校验和（SHA256SUMS）全部核对通过。

## 逐块迁移
| v4 块 | 结果 |
|---|---|
| createSync 签名（`retryLocks`）、重试状态与 `withLocalRetryLock`、`cloudWriteConfirmed` 文案、`finishLocalLogout` 清计数、account-ui 的 `manual:true` | 自动落地 |
| 重试辅助函数 + `scheduleSync` | 手工：辅助块原样插入；`scheduleSync` 守卫 = R1 `importGuard()` **或** `ordinaryAutoBlocked()` |
| `syncNow({manual})` | 手工：顺序固定为 无账号 → **R1 `importGuard()`（手动也绕不过）** → v4 上限（只拦自动）。R1 的锁高于 v4 的上限 |
| `scheduleRetry` | 手工：R1 守卫 + `ordinaryAutoBlocked()` |
| `syncOnce({manual})`、自动重试守卫、`cloudWriteConfirmed` | 手工：R1 的 `initialGuard` / `afterTokenGuard` / 各云端调用前后守卫原样保留；v4 的 `autoRetryGuard` 放在导入待办处理之后、读云端之前 |
| account-ui `statusText` 的 pending 文案、package.json | 手工 |

保留：R1 全部保护（26 项）、Sonnet2 退出修复（`sessionState:"dead"` 才算已退出）、r1-exit-interaction（7）、r1-logout-integration（12）、sync-mutation 变异（63）、login-sync-hardening（435）。

## 发现并修复的交界缺陷
R1 守卫的强制本机退出有**独立的手写收尾**（不调用 `finishLocalLogout`），v4 把「清重试计数」只放在 `finishLocalLogout` 里。结果：损坏待办下退出成功后，`suipian.acct.writebackRetry.<uid>` 与内存计数残留（实测残留 1 / 2 / 3）。修复：守卫分支成功收尾改为调用 `finishLocalLogout()`（其余重置逻辑本来就相同）；所有失败分支在此之前就已回滚并 return，计数与账号副本不会被动。

## 新增测试
- `tests/gpt1-003-r1-exit-integration.test.mjs`（8 项，node:test）：G1/G2/G6 退出成功清计数（失败 1/2/3 次各一）；G3/G4/G5 凭证/指针清不掉 → 退出失败，计数+账号副本+登录态保留；G7 无损坏待办的对照；G8 计数键删除静默无效 → 退出仍成功、计数不被误当 0。变异：修复前 G1/G2/G6 红；把清计数提前到成功确认之前 → G3–G6 红。
- `tests/sync-two-tabs-browser.test.mjs` + `.html`（18 项，真实浏览器）：同一浏览器上下文两个真实页面，真实 `navigator.locks` + 真实 localStorage，云端/定时器为假。覆盖：互斥（A 持锁时 B 读云端 0 次，浏览器 `locks.query()` 看到 held/pending）、上限跨标签页共享（云端读取总数 = 3）、`online` 与 `visibilitychange` 绕不过、到上限后继续学习不再安排定时器、另一标签页手动成功清零后本标签页自动恢复、真实删除 `navigator.locks` 时自动同步安全停机而手动可用。变异：去掉锁 / 计数不共享 / 自动不受上限 各自被抓。已挂入 `npm test` 链和 `tests/webkit/run.mjs`（CI 的 WebKit 与 Chromium 两个 mobile 任务都会跑）。
- `test:hardening` 追加 v4 的 20 项专项和上面 8 项。

## 未验证
- 真实 Supabase、iPhone/iPad/微信真机；本地只有 Chromium，WebKit 由 CI 跑。
- 双标签页测试用的是测试页（真实 sync.js + 假云端），不是完整应用 UI；账号卡片「立即同步」按钮传 `manual:true` 只有静态检查。
- `npm run test:db`：本机无 PostgreSQL；本次不涉及 supabase/。
- v4 已知限制照旧：存储持续不可写且历史失败从未持久化时，无法推断历史次数（安全停机）。
