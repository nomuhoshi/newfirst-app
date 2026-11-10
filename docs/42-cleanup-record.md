# 42 清理记录（2026-11-11）

授权：老大 2026-11-11 同意清理旧分支和预览目录；产品官规则：删分支前确认没有独有提交、没有开放 PR 或工作流依赖；删预览前确认没有验收文档、工作流或仍在使用的链接引用；证据不全的保留待确认。

## 已执行

| 对象 | 内容 | 提交 | 依据 |
|---|---|---|---|
| 预览仓库目录 `exp-quick`、`exp-u3`、`ink-3d` | 已删（约 42 MB） | `nomuhoshi/newfirst-app-preview` 的 `3111ae9` | 开放 PR 正文和评论、工作流、预览 README、验收文档都没有引用；历史可从该仓库 git 记录找回 |

## 暂停：远端分支删除（环境阻塞）

本环境的代理禁止删除远端分支（GitHub 接口和 `git push --delete` 都被拒），所以**一条也没删**。下面是核对过、可以删的 27 条，由老大在 GitHub 网页上删，或换一个有删除权限的环境。

更正：之前回报写“31 条（23 祖先 + 8 等价）”不对。23 条祖先里有 2 条（`dsh/login-sync-hardening-2`、`opus/11-token-refresh-tabs`）是开放 PR 的 base 分支，已移出；实际可删 **27 条 = 19 条祖先 + 8 条等价**。

判定方法（对 `release/v1-candidate @ 598ca1a`，应用代码同 `933e896`）：
- **祖先**：`git merge-base --is-ancestor <分支SHA> 598ca1a` 为真，分支所有提交都在候选里。
- **等价**：`git cherry 598ca1a <分支SHA>` 没有 `+` 行，即每个提交的改动在候选里都有相同补丁。
- 另外确认：不是任何开放 PR 的头分支或 base 分支，工作流（`.github/workflows`）不引用。

| 依据 | 分支 | 完整 SHA |
|---|---|---|
| 祖先 | `claude/auth-cleanup-read-failures` | `aedba6b658c2b3dbcd528e3f15fdfce3b483d223` |
| 祖先 | `claude/db2-unblock` | `cd55243821f8ea25d5cafb5e90cd8f4515e23436` |
| 祖先 | `claude/db3-1-auth-errors` | `208ee2e77e8426e1f6ce631874a8798dc204c098` |
| 祖先 | `claude/db3-1-logout-order` | `4c565d1b5d3e1fd3e0e2d95d682b91c715fa5f5d` |
| 祖先 | `claude/db3-1-refresh-errors` | `68212e8e3bd9e9234ca5921a8752d7d69d07cafe` |
| 祖先 | `claude/db3-storage-guards` | `98abe0ad885335941de76e6a5f46c88466e8b4d9` |
| 祖先 | `claude/login-sync-hardening-4` | `a2c447eb594774a11d46c3e1e8a8f823c1d23b9a` |
| 祖先 | `docs/team` | `c272f0c41dae487b621ba1cd267a2e72f0053ef6` |
| 祖先 | `dsh/login-sync-hardening-1` | `b1aa1e0a3f2f0d99f09b9cc2ff00f0dbd59425fb` |
| 祖先 | `fix/auth-error-display` | `c9aa4db9a3cc55a40ad08b29248cb60a0d726850` |
| 祖先 | `fix/auth-mail-01` | `4e2848e16adaaf67234906ad86442592455ae5e8` |
| 祖先 | `fix/auth-mail-02` | `d716622093773e50bcd3079be9d70f20e63f5439` |
| 祖先 | `sonnet/11-integrated` | `33ed3b153c0fe8423f8e6d80f148a079e0399b0b` |
| 祖先 | `sonnet/data-keep-forever` | `8e876d7bf4b516cf0654a605c3bfd52df76f6fe6` |
| 祖先 | `sonnet/rc1-drafts-key` | `a70b66905b367d411c85112ed0a15a92c15daf5b` |
| 祖先 | `sonnet2/r1-logout-fault-injection` | `f9d8c823cbbe307101b87ffe215fad6ecfe8596a` |
| 祖先 | `sonnet3/gpt1-003-v4-integration` | `36dee61191ace05a93e476181b149a4430c721cc` |
| 祖先 | `sonnet3/integration-v4-authcleanup` | `10c1636fbb5a7765a46acdf852fe8eb174375f24` |
| 祖先 | `sonnet3/r1-fix-integration` | `da5421ce52242d4405519aee3ebe5146e67458fd` |
| 改动等价（git cherry 无 +） | `docs/account-plan-and-decisions` | `732fc77aca561ae85c76dc191e0834e1509f106f` |
| 改动等价（git cherry 无 +） | `docs/china-and-fallback` | `0e9b0c4a243f1b63b13eb23c240d11c2615b9647` |
| 改动等价（git cherry 无 +） | `docs/device-checklist` | `d249682f1153ad08d5c743e2316a807786888827` |
| 改动等价（git cherry 无 +） | `docs/fix-outdated-status` | `c5f2595bd2e9e52c8d39e2e6451c5fab9d6ad479` |
| 改动等价（git cherry 无 +） | `docs/plan-fixes-and-access-test` | `40f3bb6c8b1d6ba442fc7163399022be85805d97` |
| 改动等价（git cherry 无 +） | `fix/blank-screen-and-pr-ci` | `a0ec0bdfddd2c2e15563a1850442bf680e0f5a2c` |
| 改动等价（git cherry 无 +） | `sonnet/progress-export` | `92a2b52f890f98b0a616025113df00478c31df81` |
| 改动等价（git cherry 无 +） | `sonnet/rc1-drafts-scope` | `126b025c1f112841318805543bf3c639cd9b724f` |

删除前可用 `git ls-remote --heads origin <分支名>` 再核对 SHA 没变；误删可用 `git push origin <SHA>:refs/heads/<分支名>` 恢复（GitHub 保留对象一段时间）。

## 保留（本轮不动）

**9 条含 1 个独有产物提交的分支，先保留：** 5 条 `ci-screenshots-*`、4 条旧 `preview-dist-*`。

| 分支 | 完整 SHA |
|---|---|
| `ci-screenshots-chromium` | `2f334f6d04ba2d118315410e6f25b59489409a0f` |
| `ci-screenshots-exp-quick` | `da85aab49d76d707207e7f1e2df55274014e6e32` |
| `ci-screenshots-exp-u3` | `45fde6b540167e407adee46f84736442d4c3a937` |
| `ci-screenshots-lab3` | `ddf7d86d9436796b37246b146a856820a928a4c2` |
| `ci-screenshots-webkit` | `203022ed019b1ea863ee4e66944f9b202c8b15ca` |
| `preview-dist-design-v2` | `513ed3710e4484673f3f803732d2a38535730fd2` |
| `preview-dist-exp-u3` | `bc2257043980866fc0638419b08101a688add13d` |
| `preview-dist-exp3` | `2d3e497e439b72b70ae5afa4ebbb2fa22edfdb61` |
| `preview-dist-lab3` | `26255dbcd6d51cff1b5e40a2d0ef6307160b5634` |

**约 60 条仍有独有改动的开发线：** 本轮全部保留，结束后逐条排查（含 U6 / U7 / U8 的内容和测试分支、design、feat 分支等）。
**核心与活跃：** `main`、`release/v1-candidate`、`fix/touch-targets`、`preview/v1rc`、`preview/acc2`、所有开放 PR 的头分支和 base 分支（30 个开放 PR）、`preview-dist-v1rc / acc2 / rc1 / pr11 / u6 / u7 / u8 / acc1`。
**预览仓库目录：** 保留 `acc1`、`access-check`、`fallback`、`pr11-design`（有验收证据或 README 记录）以及 `rc1`、`u6`、`u7`、`u8`、`acc2`、`v1rc`。
