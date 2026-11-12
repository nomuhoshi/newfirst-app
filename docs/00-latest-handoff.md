# 最新交接入口（先读这个）

写于 2026-11-12 23:21 JST，2026-11-13 07:33 JST 更新（版本口径：正式线上 / main 分开写）。**这份是入口，不是流水账**：状态表在 docs/50，逐轮记录在 docs/57，会随工作更新。

## 一句话（快照 2026-11-13 07:33 JST）
- **正式线上**：`9453683`（#94 K-CSP；07:27 JST 已核实的线上快照，传话员核对 `main-qbybJTrv.js` 含该 SHA；正式 CSP 不含测试域）。历史版本（**由新到旧回溯**）：`0914bc6`（#92 H、#93 F）← `6230c51`（#90 K）← `2e6a1b4`（#91 M）← `8677c11`（#83 G）← `f824232` ← `d5ed2d0` ← `92f57d9`。
- **A（游客存档保障，Apple / Safari）**：**未关闭**——Safari 原始丢档故障未定位，iPhone 真机验收缺；存储保护、备份恢复等修复已上线。正式站线上人工复测仅覆盖桌面 Chromium；CI 已覆盖 Chromium / WebKit 的相应专项（#94 正式 CSP 专项、#92 lazy-python 等）；WebKit SW 更新专项及 iPhone 真机尚未验证。
- **当前没有等待复审的 PR**。已关闭的待办：#83/#90/#91/#92/#93/#94 均已合并、部署并核对；旧文档里的“待复审 / 待部署”不再有效。
- **仍暂缓 / 只等老大**：D（后台写入须本人决定，测试后台 8 位 / 3600 秒、CAPTCHA 关闭、未改）、C 两项设置、B 后续压缩、E、J。**东京 12:00 前不联系老大，到点也不自动执行。**
- **I**：step3:205 根因未确认；#94 三次 CI（两次失败为测试代码问题）已归档。
- **完整状态表和授权摘要**：`docs/50-product-officer-handoff.md` 顶部（“当前授权与限制”“当前 A–M 状态”）；证据索引 `docs/evidence/INDEX.md`。写本文之后状态会变，以 `gh pr list`、`git log origin/main`、`gh run list --branch main` 为准。

## 到哪里看最新
| 要知道什么 | 看哪里 |
|---|---|
| A–M 每项的优先级、负责人、设计/开发/自动化/人工/部署状态 | `docs/50-product-officer-handoff.md`（顶部“当前 A–M 状态”，**以它为准**；其后的“A–M 修复计划”表是历史记录） |
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
