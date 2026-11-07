# 整合：GPT1-003 v4（36dee61）× 已验收的 auth-cleanup 修复（aedba6b）

分支 `sonnet3/integration-v4-authcleanup`。aedba6b 是 36dee61 的直接子提交（merge-base = 36dee61），所以**没有文本冲突**，分支起点就是 aedba6b。
这一步的目的是在其上确认“没有语义交叠”，并为后续的损坏待办恢复、测试预览入口提供一条已跑完整测试的基线。

## 逐文件交叠核对（aedba6b 相对 36dee61 的改动）
| 文件 | aedba6b 的改动 | 与 v4 / R1 / Sonnet2 的交叠 | 结论 |
|---|---|---|---|
| `src/account-store.js` | 新增 `readCurrentAccount()`（三态读取） | v4、R1 都没改此文件 | 无交叠 |
| `src/account-ui.js` | “清理本机残留凭证”按钮的成功文案按 `nothingToClean` 分开 | v4 改的是 `statusText` 和“立即同步”按钮（`manual:true`），不同函数 | 无交叠 |
| `src/sync.js` | 新增 `inspectAuth` / `leftoverRt`；重写 `hasLeftoverAuth` / `retryAuthCleanup`；普通退出的残留分支记 `leftoverRt` | v4：`finishLocalLogout()` 清重试计数。普通退出的残留分支仍在 `clearStoredAuthVerified()` 之后调用 `finishLocalLogout()`，所以计数照清。R1 守卫的强制本机退出自己验证删凭证，失败即回滚并返回，**从不设 `leftoverAuth`** | 语义上互不踩踏；用 G9/G10 固化 |
| `tests/webkit/run.mjs` | 列表中加入 `account-cleanup-ui.test.mjs` | v4 加的 `sync-two-tabs-browser.test.mjs` 仍在 | 两个都在列表里 |
| `tests/sync-mutation.test.mjs` | 重写 4 条因代码变化而过期的旧变异 + 新增 8 条 | v4 没改此文件 | 原样保留（本分支未改动） |

注意：`account-cleanup-ui.test.mjs` 只在 `tests/webkit/run.mjs`（CI 的 mobile-chromium / mobile-webkit 任务）里运行，**不在 `npm test` 链里**。

## 新增测试（`tests/gpt1-003-r1-exit-integration.test.mjs`，8 → 10 项）
- G9：普通退出时凭证清不掉（删除静默无效且撤销标记也写不进）：退出成功并提示残留，重试计数键为空；存储仍坏时 `retryAuthCleanup` 如实失败、入口保留；修好后清理成功，不让计数复活，游客记录原样，零网络请求。
- G10：R1 守卫强制退出成功后没有残留（`hasLeftoverAuth()` 为 false，`retryAuthCleanup` 返回 `nothingToClean`）；守卫退出失败时仍是登录态，`retryAuthCleanup` 返回 `logged-in` 且凭证、计数原样。
- 变异证明：去掉 `finishLocalLogout()` 里清计数那一行 → G1/G2/G6/G7/G9 变红；守卫退出误设 `leftoverAuth` → G10 变红。

## 未验证
- 真实 Supabase、iPhone / iPad / 微信内置浏览器真机。
- `npm run test:db`（本机没有 PostgreSQL；本分支没有改 `supabase/`）。
- 本机完整 `npm test` 的 16 条浏览器类用例因环境失败，与干净基线是同一批；以 CI 为准。
