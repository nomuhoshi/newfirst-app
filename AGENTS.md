# 给接手这个项目的 AI（先读这个）

更新：2026-11-13 00:15 JST（`docs/00-latest-handoff.md` 是最新交接入口；本文件只讲稳定的东西）。项目：「碎片编程」，免费的手机 PWA，用点选题和写代码题学 Python。正式站：https://nomuhoshi.github.io/newfirst-app/ 仓库：nomuhoshi/newfirst-app（公开）。

## 先读（按顺序）
1. `docs/00-latest-handoff.md` — **最新交接入口：正式版 SHA、当前优先级、A–M 状态表在哪、开放 PR 怎么查、规则**
2. `docs/50-product-officer-handoff.md` — 四方分工、A–M 修复计划与每项的 设计/开发/自动化/人工/部署 状态表（**以它为准**）
3. `docs/57-fable-full-audit-2026-11-12.md`（审计与 A 的逐轮记录）、`docs/58-ledger-growth-measurement-and-design.md`（本机账本增长与方案 B）、`docs/56-ios-diagnosis-2026-11-12.md`（iOS 诊断）、`docs/49-open-items.md`、`docs/55-handoff-2100.md`
4. `docs/14-known-issues.md`（已知问题与平台限制）、`spec/SPEC.md`（产品规格和决策记录表，最后几行是最新决定）
5. 账号 / 同步（代码在仓库里，正式站云端未开通）：`docs/15-account-sync-plan.md`、`docs/30-db3-integration-audit.md`、`docs/40-release-v1-candidate.md`（含 CSP、隐私说明、正式 Supabase 后台核查表）

## 现在的状态（2026-11-12；会过时，以 docs/00-latest-handoff.md 和 docs/50 为准）
- **正式站（main）**：U1–U5，34 关、136 道点选题；**15 道写代码题仍为 pending（正式站未开放“运行自己的代码”，发布说明不得这样写）**。Python 运行环境（真 Pyodide）用于已有的演示与判题，不等于写代码题已开放；游客存档 v4（每个页面写自己的账本键，读时合并，`src/storage.js`）；进度文件 / 进度码备份与恢复、14 天备份提醒、iPhone Safari 的“添加到主屏幕”提示、“复制诊断”。账号登录和云同步的代码在仓库里，但正式站云端**未开通**（页面显示“云端暂未开通”）。
- **当前最高优先级 A：游客存档保障（Apple / Safari）——未关闭。** 关闭条件：最新版本独立复审无阻断；专项自动化与隔离人工测试通过；iPhone 真机备份→安装→恢复通过；Safari 原故障定位修复，或老大明确接受有证据的环境限制。
- 暂缓（有指令前不做）：D 账号防滥用的实施、E 合并模型统一、账号云同步开放、课程发布（#58 / #59 / #61）。B（账本增长）只做已批准的方案 B；**删除压缩继续禁止**。
- 存档相关 PR 的统一发布顺序：**#81 → #82 → #80**（#81 已于 2026-11-13 00:12 JST 合并为 `cfaaab4`，部署证据见 docs/50；#82、#80 仍按此顺序，各自复审通过后发布）。#83（更新不丢关内状态）单独复审，不在此链里。
- 开放 PR 与各项状态：看 docs/50 的 A–M 表和 `gh pr list`，不要靠本文件。

## 工作流与规则（2026-11-12 起）
- 分工：产品官（GPT）定优先级和验收标准；GPT1 独立复审；Gemini 做资料核查与文案（不作根因证据）；传话员组织真机 / 隔离人工测试和线上核对；Claude（程序员）实现并给 SHA、CI 与测试证据。
- 流程：独立分支 → PR → CI 全绿（build / mobile chromium / mobile webkit）→ 独立复审 → 合并 → 验证 main 的运行与 Pages 部署 → 更新交接文档。**小 PR 通过对应检查和独立审查后，按既有授权合并部署，不必每次再问老大**（产品官 2026-11-12 22:29）。
- 红线：**不删除任何历史数据；不清真实存档，不在真实存档上注入故障；数据库操作只交传话员执行；不强推，不整条分支合入；不删分支 / PR；额度到限就保存交接并停止，不用免费重置。** 不得把“代码开发完成”写成“可以上线”：分清 设计 / 开发 / 自动化 / 人工 / 部署。
- 不做：排行榜、社交、支付、广告、推送、复杂复习算法。
- 项目主人只用 iPhone 和 iPad，不要让他在电脑上跑命令。云端沙箱通常连不上 npm 源、github.io 和 supabase：**构建和浏览器测试以 GitHub CI 为准**，本地只跑得了不依赖 vite 的 node 单元测试。
- 报告要附：任务、PR、SHA、实际执行的测试、失败原因、部署证据、剩余限制、**实取的东京时间**（不要估）。
- 同一个文件上不要把“已修”说在测试证据前面；有错就在文档里留下更正记录，不改写旧结论。

## 怎么跑
```
npm install
npx playwright install chromium     # 测试用
npm run build                        # 会先把 Pyodide 复制进 public/pyodide（该目录不进 git）
npm test                             # 需要先 build；按 package.json 的 test:chain 逐条运行（scripts/run-tests.mjs，每条有超时）
npm run test:mobile -- chromium      # 手机模拟（WebKit / Chromium）：账号、触控尺寸、CSP 等浏览器测试（tests/webkit/run.mjs 的 extra 列表决定哪些进 WebKit）
npm run test:e2e -- chromium         # 端到端关键流程
npm run dev                          # 本地开发
```
- 第 2 单元内容由 `scripts/make-unit2.py` 生成 `content/unit2.json`（改题目就改脚本再运行）。其余单元直接改 `content/unitN.json`。
- 课程 JSON 被打包进 JS；离线缓存清单由 `scripts/vite-sw-plugin.mjs` + `scripts/sw-template.js` 在构建时生成 `dist/sw.js`。
- 存档：`src/storage.js`（v4：`suipian.v4.tab.<页面id>` 账本 + `suipian.v4.epoch` 代数 + 基线；清除 = 新一代；自动压缩关闭）；备份：`src/progress-file.js`；体检与提醒：`src/storage-health.js`；账号副本在 `src/account-store.js`，同步在 `src/sync.js`；`window.__app` 是给自动测试用的钩子。
- CSP 由 `scripts/vite-csp-plugin.mjs` 在构建时插进 index.html：加了内联脚本、外部请求或新的云项目，要同时改它和 `tests/csp.test.mjs`。

## 项目主人的偏好（也适用于你）
- 中文沟通，说话直接，不要套话和免责声明；指出问题和风险，给具体建议。
- 编程新手：靠 AI 写代码。讲解要从基础讲起、不跳步；讲代码时结尾附完整可运行的例子。
- 英文单词：给美式国际音标和意思（单词解释单词，短语解释短语）。
- 他把方案交给另一个 AI（GPT）做产品/设计/审查，再把回复贴回来；你负责实现和测试，每一步做完先汇报。
- 提交说明用中文；提交前确认测试全绿。

## 不能随便改的规则
- 课程难度、XP（答对 +10，通关 +10，复习 +5）、红心（每 30 分钟 +1，最多 5）、连续天数、解锁规则、错题回炉：除非项目主人明确同意并写进 `spec/SPEC.md` 决策记录。
- 旧测试不能删除或放宽；改行为就要改对应测试并说明理由。
- 不得用预设输出冒充 Python 真实执行；离线时必须如实提示。
- 新题目必须用真实 Python 验证（测试里会自动跑：选输出题与真实运行一致、填空题答案正确且错误词块有解释、排序题检查全部排列）。
