# 28 登录 / 同步加固（第三轮）：退出、冲突停止、429 冷却

更新：2026-11-06  
分支：`dsh/login-sync-hardening-3`（从 `dsh/login-sync-hardening-2` @ `9388a96` 开出）  
范围：只改登录 / 同步的失败处理和对应测试。不接真实 Supabase，不部署，不 merge，不删远端，不改正式站，不开 DB-3。

清单 1–4 的代码在 `eaea3c3`，本轮不打勾，等 Gemini 复核。Case 10 的最终硬断言等 DB-2 验收，本轮只保留上一轮已有的 I.0，没有再升格。

## 1. 本轮改了哪些清单项

| 项 | 做了什么 |
|---|---|
| 7 Case 5b | 连续 5 次被抢先后，本机副本保持 `dirty.content`，状态 `pending`。下一轮手动同步可以上传。不再只用“状态是 error”蒙混过关 |
| 8 Case 7a / 7b / 8 / 9 | 改成失败即红的硬断言，并补上对应行为 |
| 9 普通退出失败 | `signOut` 抛错或返回失败：保持登录，不删本机副本。同步看起来成功但本机副本仍是脏的：也不退出、不调用 `signOut` |
| 10 强制退出保护 | 新增 `forceLocalLogout()`。云端退出失败也会清本机凭证，并返回“云端会话可能仍有效”。未上传副本仍留着。本机清理失败则不宣称已退出 |
| 11 删号清理失败 | 云端删除已成功、本机 `removeItem` 失败：返回 `ok:false`、`pending-local-cleanup`，停用内存里的旧令牌，副本留在原键。界面不说“账号已删除” |
| 13 五次冲突 | 普通同步和游客导入待办在 5 次 CAS 后停止，不安排 3s/10s/30s/60s 退避。待办用尽时 `kind` 为 `conflict`（不可盲目重试）。之后仍可再同步 |
| 14 429 冷却 | 收到限流后 60 秒内 `sendCode` 和同步不再打开发信 / 读云端接口。测试只用假接口，没有发验证码 |
| 15 Case 10 | 仅准备。不把“DB-2 已验收”写进最终硬断言 |
| 16 场景 9 / 11 | I.9 用 111/22 XP 和 U9L9；I.11 用云端 41 / 游客 64 XP 和 U11L2。另两段同步各自新建假服务器：`scene9@example.com` 与 `scene11@example.com` |
| 18 CI | 见 §4。本轮没有改 workflow，没有部署 |

## 2. 行为说明（给之后看代码的人）

- 普通退出先尝试同步。同步失败，或本机副本仍标着未上传：停在登录态。
- 只有用户明确强制退出，才在 `signOut` 失败时清凭证。文案说明云端会话可能还在。
- 同一 lineage、本机代数更高：仍整份用本机。云端代数更高：仍整份用云端。只有“本机 gen 更高且 lineage 不同”改为安全合并，避免旧备份靠改大 gen 盖掉云端。XP 规则没变（按设备取较大值，不是相加）。

## 3. 本机测试

没有安装依赖，没有跑 Playwright，没有跑完整 `npm test`，没有跑 `npm run test:db`（本机没有 `psql` / `initdb`）。

| 命令 | 结果 |
|---|---|
| `node tests/login-sync-hardening.test.mjs` | **199 项，0 失败** |
| `node tests/sync-mutation.test.mjs` | **20 项，0 失败**（1 项对照 + 19 个故障注入） |
| `node tests/step5.test.mjs` | **89 项，0 失败** |
| `node tests/step5-fixes.test.mjs` | **20 项，0 失败** |
| `node tests/cloud-sync.test.mjs` | **40 项，0 失败** |
| `node tests/cloud-sync-tabs.test.mjs` | **6 项，0 失败** |
| `node tests/cloud-sync-replaced.test.mjs` | **6 项，0 失败** |
| `node tests/cloud-sync-project.test.mjs` | **12 项，0 失败** |
| `node tests/cloud-sync-switch.test.mjs` | **27 项，0 失败** |
| `node tests/data-compat.test.mjs` | **30 项，0 失败** |

新增故障注入都能让专项变红：普通退出在 signOut 失败时仍清登录、五次冲突后仍盲目重试、冲突用尽后当成可重试、删号清理失败仍宣称成功、强制退出删掉未上传副本。

## 4. CI 证据和缺口

能看到的：

- `gh workflow list` 能列出 “Test and deploy”。`deploy` 的条件仍是 `github.ref == refs/heads/main` 且不是 pull request。本分支不会因此发布。
- 上一分支 `dsh/login-sync-hardening-2` 最近一次完整成功：<https://github.com/nomuhoshi/newfirst-app/actions/runs/42061798504>（`eaea3c3` 那一轮，build / chromium / webkit 成功，deploy skipped）。那次不覆盖本轮提交。

本轮 PR #44 已跑完（`pull_request`，head `1edd503`）：

<https://github.com/nomuhoshi/newfirst-app/actions/runs/42100193984>

| Job | 结果 |
|---|---|
| `build`（含完整 `npm test`） | success |
| `mobile (chromium)` | success |
| `mobile (webkit)` | success |
| `deploy` | **skipped**（PR 不是 main，不部署） |

缺口（没有权限或没有环境，本轮不做）：

- `gh api user` 返回 403 `Resource not accessible by integration`，不能用这个令牌查账号身份。能开 PR、能看 Actions。
- 没有跑数据库套件。场景 9 的“直接写表被拒”在真库上仍以 `supabase/tests/isolation.sql` 为准。本轮 Node 只证明客户端保存走 `save_progress`，并且场景 9 和场景 11 各用各的假数据。没有连 `suipian-test`，更没有连正式库。
- 没有浏览器点过“我的”页。退出失败、强制退出、删号清理失败的文案在 `src/account-ui.js`，同步层测试覆盖了返回值，没有在页面上点出来。远端 mobile job 是 Playwright 模拟，不是这次改动的手工点击。
- 没有 iPhone / iPad。没有真实邮箱验证码。

## 5. 没做的事

- 没有打勾清单 1–4，没有打开 DB-3，没有把 Case 10 写成 DB-2 最终通过。
- 没有 merge，没有部署，没有改 `.github/workflows/`，没有删远端分支，没有读或写 secret / service_role，没有改正式站配置。
