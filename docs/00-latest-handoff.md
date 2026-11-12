# 最新交接入口（先读这个）

写于 2026-11-12 23:21 JST，2026-11-13 00:15 JST 更正一次（见下）。**这份是入口，不是流水账**：状态表在 docs/50，逐轮记录在 docs/57，会随工作更新。

## 一句话
正式站 = main（**快照 2026-11-13 00:12 JST：`cfaaab4`，#81 已合并**；之前是 `6f56fb0`，#79）；A（游客存档保障，Apple / Safari）**未关闭**。发布顺序 **#81 → #82 → #80**：#81 已合并，#82（提醒按代数隔离）待 GPT1 定向复核，#80（无变化不写账本）待补充后再审；#83（更新不打断答题）单独复审。写本文之后状态会变，以 `gh pr list`、`git log origin/main` 和下面的最新记录为准。

## 到哪里看最新
| 要知道什么 | 看哪里 |
|---|---|
| A–M 每项的优先级、负责人、设计/开发/自动化/人工/部署状态 | `docs/50-product-officer-handoff.md`（“A–M 修复计划”表，**以它为准**） |
| 审计原文与 A 的逐轮修复记录、更正记录 | `docs/57-fable-full-audit-2026-11-12.md` |
| 账本增长测量、方案 A–E 对照、单位说明 | `docs/58-ledger-growth-measurement-and-design.md` |
| iOS / Safari 诊断 | `docs/56-ios-diagnosis-2026-11-12.md` |
| 开放事项 / 交接快照 | `docs/49-open-items.md`、`docs/55-handoff-2100.md` |
| 当前开放的 PR 与 CI | `gh pr list`（不要靠文档） |

## 最新工作记录在哪里（明确链接）
- 工作分支（最新、更新最勤）：<https://github.com/nomuhoshi/newfirst-app/tree/docs/course-roadmap-and-cleanup/docs>
- A–M 状态表与交接追加：<https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/50-product-officer-handoff.md>
- 逐轮修复与更正记录：<https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/57-fable-full-audit-2026-11-12.md>
- 各 PR 的 CI 与评审：`gh pr view <编号>` 或 <https://github.com/nomuhoshi/newfirst-app/pulls>
- 部署证据：<https://github.com/nomuhoshi/newfirst-app/actions/workflows/deploy.yml>（main 的运行；Deploy 任务即 Pages 部署）

## 这些文件是“快照”
49 / 50 / 55 / 56 / 57 / 58 是从工作分支 `docs/course-roadmap-and-cleanup` 按文件白名单带进 main 的**当时快照**。工作分支上的版本更新得更勤；以后按文件批次同步进 main，**不整条分支合入**。证据截图（docs/evidence）、课程路线（41–48、51–54）还没带进来，需要分别核对后再进。

## 规则（摘要，全文见 AGENTS.md）
不删数据；不清真实存档、不在真实存档上注入故障；数据库操作交传话员；独立 PR → CI 全绿 → 独立复审 → 合并 → 验证部署；报告附实取的东京时间；额度到限保存交接并停止。
