# 30 DB-3 整合与独立审查（分支 claude/login-sync-hardening-4）

基线 `claude/db2-unblock @ cd55243`，整合 DeepSeek 的 PR #44 业务提交 `1edd503`（cherry-pick 为 `c002a89`）和文档提交 `8d897f8`（`2eebb6a`）。DeepSeek / Grok 额度耗尽，hardening-4 不再等待。

## 整合结果
| 项 | 结果 |
|---|---|
| cd55243 的测试基础设施（进程内静态服务器、超时看门狗 `scripts/run-tests.mjs`、`tests/test-infra.test.mjs`） | 完整保留，`git diff cd55243` 没有触碰这几个文件 |
| PR #44 的 7/8/9/10/11/13/14/16/18 | 全部保留，`src/` 无冲突；只有两个测试文件在文件末尾“都追加”冲突，已保留双方 |
| 冲突解决 | `login-sync-hardening.test.mjs` 末尾：DB-2 审查 K 段 + PR #44 退出 / 删号 / 冲突 / 429 段（改名 L 段，避免与 K 重名）。`sync-mutation.test.mjs`：两边的故障注入都在 |
| 被删除的测试 | 无。与 cd55243 比，只有 PR #44 有意改写的 I.9 / I.11（改成独立场景数据，断言没有变弱）和一条旧的“本机代数更高整份用本机” |
| 重复逻辑 | 无。`isUnsent` 单一定义，`copyStillUnsent` 复用它 |
| 文档编号 | `docs/28-db2-unblock.md`（本线）与 `docs/28-login-sync-hardening-3.md`（DeepSeek）同号不同名，保留双方原名，不改历史 |

## 清单 12：旧备份保护（硬断言 + 反向）
`mergeDocs` 的规则（`src/account-data.js`）：
- 云端 gen 更高：整份采用云端（另一台设备真正换代，旧一代不会复活）。
- **本机 gen 更高：永远不能整份覆盖云端**，不论 lineage 是否相同。学习内容按设备取较大值、关卡和日期取并集，`gen / lineage` 留在云端。（PR #44 只拦了“不同 lineage”，同 lineage + 虚高 gen 仍能整份覆盖；本轮补上。当前客户端不会再产生 gen+1，所以本机 gen 更高只可能来自旧备份 / 手改。）
- 同 gen 不同 lineage：冲突，不写云端，本机副本原样保留，交用户选择。

旧 rev / 旧 updated_at：
- 客户端不读 `updated_at`（服务端 `save_progress` 里 `now()`），唯一写入凭证是**刚读到的 rev**（CAS）。副本里的旧 `base` 不会被拿去写云端（M.1 断言所有 `saveProgress` 的 expected_rev 都是刚读到的 9，不是副本的 1）。
- 副本保存时间在很久以前或被时钟拨到 2100 年（M.2）都不能取得优先权：云端逐项不变。
- 数据库层：`save_progress` 单条 UPDATE `where rev = expected_rev`，`test:db` 里并发测试证明同一 expected_rev 只成功一个。

测试：`tests/login-sync-hardening.test.mjs` M.1–M.6（含虚高 gen 999 的两种 lineage、云端 gen 更高对照、同代冲突、安全合并保留其他设备 runs / 日期 / 关卡）；`tests/data-compat-edges.test.mjs` Case 9 / 9b / 9c；`tests/step5.test.mjs` 同 lineage 虚高 gen。反向验证：虚高 gen 整份覆盖、抢走身份、用旧 base 写云端，各一条，均被抓到。

## 清单 15：Case 10 硬断言
- `Case 10` 在 `data-compat-edges`（函数级）和 `I.0`（含状态）里都是硬断言，另加 N.1–N.4 全流程：挂起期间 0 次写云、云端文档和 rev 逐字不变、没有账号副本 / 待办 / 当前账号、游客保留；选合并写失败 → rev 仍 7、游客保留、dirty.content、待办、pending；重开后重试 → rev 7→8、XP 80 / 次数 5 一份、游客删一次、待办清、base=8、状态 synced、再同步两次 rev 不变；选保留云端 → rev 7→8、除 imported 外文档逐字不变。
- **预期红 0**：Gemini 的 `cloud-sync-edges` / `data-compat-edges`（原先带 expected-red 机制，未进过本线）并入，`checkRed` 机制删除，Case 7a / 7b / 8 / 9 / 10 全部硬断言，退出码非 0 即红；并接进 `npm test`（`test:edges`）。

## 清单 6：失败路径
新增 N.5 矩阵：{保留云端, 安全合并} × {读云端失败, 冲突用尽, 本机存储写失败}。每格断言：不谎报完成、游客逐字保留且未删、专用待办在、云端要么逐字不变要么只多了新指纹；排除故障后恢复成功、指纹落地、待办清空、dirty 全清、合并只做一份且游客只删一次。

## 仍未验证
真实 Supabase（RLS、邮件、验证码模板）、iPhone / 微信真机、WebKit 真机行为；`test:db` 只在本机临时 PostgreSQL 上跑（CI 暂未接入）。
