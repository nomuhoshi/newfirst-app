# 证据索引

更新：2026-11-13 07:33 JST（Claude 归档）。**保留历史，不改写旧证据。** 这里只列“证据在哪、证明什么、没证明什么”。

## 一、已在 main 的证据（本仓库内）
| 路径 | 内容 | 证明范围 / 边界 |
|---|---|---|
| `docs/evidence/2026-11-13-step3-reload-timeout/` | I：step3:205 一次 30 秒 load 超时的 CI 诊断日志（run 43255678275 shard3 iter4）与说明 | 只有诊断日志；根因未确认 |
| `docs/evidence/2026-11-13-pr94-ci-classification.md` | #94 三次 CI 的分类（GPT1 07:28） | 只是分类结论，不含原始日志 |

## 二、外部证据（传话员本机路径，脱敏；不在仓库内，此处只引用文字结论）
| 引用名 | 内容 | 范围 |
|---|---|---|
| `accept_9453683_result.txt`、`evidence/accept_9453683/`（run.log、results.json） | 2026-11-13 07:27 JST #94 线上核对：`main-qbybJTrv.js` 含 `9453683`；正式 CSP 不含测试域；index / privacy 200；测试页及配置 404；Chromium H/F 复测通过 | 桌面 Chromium 隔离游客；iPhone / WebKit 未测 |
| `accept_0914bc6_result.txt`、`evidence/accept_0914bc6/` | H（Python 延迟加载）、F（诊断隐私）线上验收 | 同上 |
| `iphone_checklist_1200_v2.txt` | **GPT1 的 iPhone 真机清单 V2.1**（产品官 07:27 接受；12:00 后才交老大，按届时最新已核实版本记录结果） | **本仓库尚未收入清单正文**：只有文件名，正文需传话员 / GPT1 提供后另行归档，不能由 Claude 转述补写 |

## 三、只在 `docs/course-roadmap-and-cleanup` 分支上的证据目录（含截图，未整体带入 main）
`2026-11-11-d5-preview`、`2026-11-11-d6-preview-and-prod`、`2026-11-11-d6-prod`、`2026-11-11-desktop-chrome`、`2026-11-12-c2-auth`（before / after）、`2026-11-12-fable-diag`、`2026-11-12-iphone`、`2026-11-12-prod-a822`、`2026-11-12-s4-manual`、`2026-11-12-s4-manual-2`。

这些目录含图片，本批按白名单不整体复制；需要时从该分支单独 `git checkout origin/docs/course-roadmap-and-cleanup -- <目录>` 带入，并在此表登记。

## 四、本批（L 第二批）带入 main 的文件白名单
`AGENTS.md`、`docs/00-latest-handoff.md`、`docs/50-product-officer-handoff.md`、`docs/58-ledger-growth-measurement-and-design.md`（带快照头）、`docs/evidence/INDEX.md`、`docs/evidence/2026-11-13-pr94-ci-classification.md`、`docs/evidence/2026-11-13-step3-reload-timeout/`。docs/49、55、56、57 的 main 快照本批不动。
