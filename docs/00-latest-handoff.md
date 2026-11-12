# 最新交接入口（先读这个）

写于 2026-11-12 23:21 JST，2026-11-13 01:05 JST 更新（版本口径：正式线上 / main 分开写）。**这份是入口，不是流水账**：状态表在 docs/50，逐轮记录在 docs/57，会随工作更新。

## 一句话（快照 2026-11-13 01:05 JST）
- **正式线上**：`92f57d9`（#81＋#82；传话员 2026-11-13 01:04 JST 核对线上 `assets/main-BCSe73IL.js` 含该 SHA；此前是 `6f56fb0`）。
- **main**：已含 #80（合并 `d5ed2d0`）；这个提交的发布检查（run 43254697616）与部署**还没有结果，不等于线上**——线上以传话员的核对为准。
- **I（测试可靠性）**：main 曾在 `tests/step3.test.mjs:205` 出现一次 30 秒 load 超时，**根因未确认**；独立小 PR #88 做隔离与等待条件修复，诊断 PR #86 只认 12 次通过。
- **A（游客存档保障，Apple / Safari）**：**未关闭**（Safari 原始丢档诊断、iPhone 真机验收保留）。
- 存档相关 PR 发布顺序 #81 → #82 → #80 已执行完（各自合并后分别验证）；#83（更新不打断答题）单独复审集成。写本文之后状态会变，以 `gh pr list`、`git log origin/main`、`gh run list --branch main` 和下面的最新记录为准。

## 到哪里看最新
| 要知道什么 | 看哪里 |
|---|---|
| A–M 每项的优先级、负责人、设计/开发/自动化/人工/部署状态 | `docs/50-product-officer-handoff.md`（“A–M 修复计划”表，**以它为准**） |
| 审计原文与 A 的逐轮修复记录、更正记录 | `docs/57-fable-full-audit-2026-11-12.md` |
| 账本增长测量、方案 A–E 对照、单位说明 | `docs/58-ledger-growth-measurement-and-design.md` |
| iOS / Safari 诊断 | `docs/56-ios-diagnosis-2026-11-12.md` |
| 开放事项 / 交接快照 | `docs/49-open-items.md`、`docs/55-handoff-2100.md` |
| 设计评估登记（原型范围、老大两项决定、评估基线） | `docs/design/fable-review-2026-11-12.md`（取自 `docs/fable-design-review` @ `271e6f5`，按文件带入） |
| 当前开放的 PR 与 CI | `gh pr list`（不要靠文档） |

## 最新工作记录在哪里（明确链接）
- 工作分支（最新、更新最勤）：<https://github.com/nomuhoshi/newfirst-app/tree/docs/course-roadmap-and-cleanup/docs>
- A–M 状态表与交接追加：<https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/50-product-officer-handoff.md>
- 逐轮修复与更正记录：<https://github.com/nomuhoshi/newfirst-app/blob/docs/course-roadmap-and-cleanup/docs/57-fable-full-audit-2026-11-12.md>
- 各 PR 的 CI 与评审：`gh pr view <编号>` 或 <https://github.com/nomuhoshi/newfirst-app/pulls>
- 部署证据：<https://github.com/nomuhoshi/newfirst-app/actions/workflows/deploy.yml>（main 的运行；Deploy 任务即 Pages 部署）

## 这些文件是“快照”
49 / 50 / 55 / 56 / 57 / 58 是从工作分支 `docs/course-roadmap-and-cleanup`（@ `2cf00f6`）按文件白名单带进 main 的**当时快照**，每个文件第一行标了快照来源与时间。

## 规则（摘要，全文见 AGENTS.md）
不删数据；不清真实存档、不在真实存档上注入故障；数据库操作交传话员；独立 PR → CI 全绿 → 独立复审 → 合并 → 验证部署；报告附实取的东京时间；额度到限保存交接并停止。
