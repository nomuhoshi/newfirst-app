# 交接：程序员 Opus → 程序员 Sonnet（2026-11-04）

> 团队精简为三个聊天：程序员 Sonnet、设计师 Opus、市场调研 Sonnet。程序员 Opus 的聊天交接后关闭，**以后同步、权限、判分、课程顺序的问题都由程序员 Sonnet 主责**。设计师 Sonnet 的交接不在本文件范围内（由那个聊天自己交给设计师 Opus）。
> 红线不变：不合并 PR、不覆盖正式站（由 GPT/负责人决定）；不改 XP、红心、难度、解锁、连续天数规则；不做假 Python 输出；不写任何 secret/service_role 密钥。

## 1. 已完成

| # | 内容 | 分支 / PR | 提交号 | 证据 |
|---|---|---|---|---|
| A | 首发课程地图（9 单元，58 关，每单元写清学完能做什么和前置知识）+ U5 第二部分的范围和验收条件 + 12 道已有代码题的复核 | `opus/launch-curriculum-map` → PR **#34**（Draft，目标 main，只有文档和脚本） | 6000d7a（本文件随后提交） | 见 `docs/16-launch-curriculum-map.md` §4 |
| B | 代码题复核工具 `scripts/review-code-tasks.py` + 已登记的合理写法和错误写法 `scripts/review-alternatives.json`（29 种合理写法、14 种错误写法） | 同上 | 同上 | 在 U3–U5 的 12 道题上：0 条“错”。工具自检：造一道有 7 种毛病的假题，7 种全部报出 |
| C | #11 修复 1：多标签页时旧刷新令牌导致整个会话被作废（`src/sync.js` ensureToken 先换用存储里更新的凭证） | `opus/11-token-refresh-tabs` → PR **#37**（目标是 #11 的分支 `feat/account-data-layer`，**不是 main**） | 4b5863a | `tests/cloud-sync-tabs.test.mjs`：修复前 2/6，修复后 6/6；CI 手动运行 41802513800 **success** |
| D | #11 修复 2：别的设备“覆盖云端”后，本机未上传的学习进度被静默丢弃（docs/15 §5 要求提示）。新增 `dirty.content` 标记、`onNotice("replaced")` 回调和结果字段 `replacedLocal` | 同上 | 575a473 | `tests/cloud-sync-replaced.test.mjs`：修复前 2/6，修复后 6/6；本地 cloud-sync 40/40、step5-fixes 20/20。CI 手动运行 41802744233 **交接时还在跑，请查结果** |
| E | #11 完整审查意见 | 已发在 #11 的评论里：https://github.com/nomuhoshi/newfirst-app/pull/11#issuecomment-6626767887 | — | — |

**预览链接**：以上都是文档、脚本或同步层逻辑，没有发布新的预览入口。#11 原有的测试入口（pr11）不包含 C、D 两项修复，要等 #37 合进 `feat/account-data-layer` 后重新构建。

## 2. 未完成，按优先级排列（下一棒都是程序员 Sonnet）

1. **查 CI 41802744233 的结果**（`opus/11-token-refresh-tabs`，提交 575a473）。如果失败，看日志修好；不能削弱测试。
2. **#37**：请 #11 主责（或 GPT）决定是否合进 `feat/account-data-layer`。合进去之后：
   - app.js 给 `createSync({... onNotice })` 传回调，收到 `"replaced"` 时在地图页或“我的”页提示“这个账号的进度已在别的设备上被替换”。做题过程中不要打断。
   - 测试：用假服务器跑一遍“覆盖后另一台设备同步”的场景，断言提示出现，并且只出现一次。
3. **#11 测试没进 CI**：`tests/step5.test.mjs`（88 项）和 `tests/step5-fixes.test.mjs`（20 项）不在 `npm test` 里。step5 有 1 项已经过时：“app.js 没有引用账号模块”，现在已经接入了。
   - 把两个文件加进 `npm test`。
   - 这条断言改写成“未登录时游客流程和 v3 存储格式不变”，并在提交说明里写理由（规则：旧测试不能删，只能改写并说明理由）。
4. **U5 第二部分（U5L5 遍历列表、U5L6 in、U5L7 项目：购物清单）**：范围和验收条件全在 `docs/16` §3。
   - 分支 `content/u5-part2`，基于 `content/u5-part1`。
   - 交付前跑 `python3 scripts/verify-content.py`，结果必须 0 失败。
   - 再跑 `python3 scripts/review-code-tasks.py content/unit5.json`：退出码为 0，新题不能有“低”级别问题。
5. **按复核结果修已有的代码题**（在 `scripts/codetasks.py` 里改，见 `docs/16` §4）：
   - U3L8-W1、U4L8-W1 的示范代码就是答案，换成不同规则的示范；
   - U4L3-M1、U4L7-M1 各补 1 组隐藏测试；
   - U3L8 题面改成“会员不论金额都再减 5”；
   - U4L5 的“大单”改个叫法；
   - U4L4 加一条 `/` 得到小数的 mistakes 提示；
   - 把 `review-alternatives.json` 里的写法搬进各题的 `alternatives` / `wrongAnswers` 字段。
6. **界面小改进（可选）**：代码题结果页把行尾空格显示出来（比如用 `·` 标出）。判分保持 strict，不放宽。
7. **写进 docs/14 已知问题**（低风险）：
   - 整机备份恢复后，两台手机可能共用同一个设备编号，合并时会少算其中一台的 XP；
   - 一个标签页退出登录后，另一个标签页还以为已登录，之后学的内容可能存不进去（**未验证** app.js 这时会不会退回游客模式保存）。
8. **AGENTS.md 已过期**（写于 11-03）：补上三人团队名单、当前盘面，以及“`gh pr list` 在这个环境里不能用，改用 `gh api` REST”。

## 3. 需要 GPT / 负责人决定
- 首发 9 单元的顺序（`docs/16` §2）：“类型与报错”放在 U6；集合、元组、input、try/except 推到首发以后；U6 以后的单元编号和 12 单元草案不同（还没有进度数据，改编号不影响存储）。
- #37 合不合进 #11 的分支。

## 4. 给接手的人的提示
- 同步的合并规则是“每台设备一格 XP，合并时每格取较大值再相加”。**不要改成直接相加或后写覆盖**，否则会重复计分或丢分。
- `progress.doc` 的内容由用户自己的设备写入，用户可以随意修改。**以后做会员权益，不能从这里读**，要单独建一张只有服务端能写的权益表。花钱、开通支付交给负责人。
- 本环境的浅克隆默认只跟踪 main：要推送别的分支，先 `git config --add remote.origin.fetch '+refs/heads/<前缀>/*:refs/remotes/origin/<前缀>/*'`。
- CI 只对“推送到 main”和“目标是 main 的 PR”自动运行。其他分支用 `gh api -X POST repos/nomuhoshi/newfirst-app/actions/workflows/deploy.yml/dispatches -f ref=<分支>` 手动触发；部署步骤只在 main 上执行，手动触发不会覆盖正式站。
