# 44 U1–U5 课程：谁设计、谁写、谁审、谁集成（按 Git 和文档核对）

更新：2026-11-11。依据：仓库提交记录、PR 描述与评论、`spec/SPEC.md`、`docs/` 里的验收记录。链接前缀 `https://github.com/nomuhoshi/newfirst-app/`（提交 `commit/<SHA>`，PR `pull/<编号>`）。

## 先说限制

1. Git 里能看到的提交人只有三种：`Claude`（带 `Co-Authored-By: Claude Sonnet 5.5` 和会话链接）、`Grok Bot`、以及项目主人的账号 `nomuhoshi`。**`nomuhoshi` 这个账号被多个 AI 会话共用来推送**，所以它只能证明“经由主人账号提交”，不能证明实际是谁写的。凡是只能到提交人为止的，实际作者一律标“待核实”。
2. **`main` 的历史从 `9f19f19`（2026-11-02，AGENTS.md）开始**，这个提交之前的内容已经在树里：U1、U2 的原始内容提交没有保留，所以 U1、U2 的“谁写”只能靠文档推断，不能靠提交。
3. 没有找到任何 PR 评审记录：U3–U5 的 PR（#20–#25）`reviews` 为 0。题目的“审校”实际是自动验证加产品官（GPT）的指令，见下。

## 分单元核对

| 单元 | 课程设计 | 题目编写 | 审校 | 代码集成 |
|---|---|---|---|---|
| **U1** 奶茶店点单屏（6 关） | 项目主人确认“多邻国式关卡、参考 Brilliant”（`spec/SPEC.md` §0）；场景和关卡划分在决策记录里写“Claude 安排；项目主人授权常规细节”（SPEC 决策记录 2026-11-01） | 无提交可查。内容文件 `content/unit1.json` 首次出现在 `9f19f19`；结合 SPEC 和 `docs/07-step2-checklist.md`（“自动测试（Claude）”），推断是 Claude 会话写的，**待核实** | 自动：每题用真实 Python 核对（`docs/07`）。U1L5-Q4 后来被修：[`5f5900b`](https://github.com/nomuhoshi/newfirst-app/commit/5f5900b)（提交人 Grok Bot，[PR #16](https://github.com/nomuhoshi/newfirst-app/pull/16)，“按产品负责人决定”） | Claude（`9f19f19` 为 Claude 会话提交；第 1 步技术验证经 GPT 交叉审查，`docs/06`，审查版本 `8c7b830`） |
| **U2** 文字与长度（5 关） | SPEC 决策记录 2026-11-02：新增 U2，只用 predict / fill / order，不引入索引、切片、`str()` 等（范围由文档限定） | 同 U1：首次出现在 `9f19f19`，推断 Claude，**待核实** | 同 U1：自动验证；`docs/07` 的人工试玩表是主人的真机记录 | 同 U1 |
| **U3** 比较与判断（8 关） | `docs/curriculum.md`（12 单元 86 关大纲）及 U3 计划 `docs/u3-and-code-tasks-plan.md`，在 [PR #15](https://github.com/nomuhoshi/newfirst-app/pull/15)（文档提交 `b3eb86f`、`daffc0a`，提交人 Grok Bot）；“产品负责人决定”写在 PR #15、#16 的描述里 | L1–L4：[`bcbf9e6`](https://github.com/nomuhoshi/newfirst-app/commit/bcbf9e6)（[PR #20](https://github.com/nomuhoshi/newfirst-app/pull/20)）；L5–L8：[`1bd361e`](https://github.com/nomuhoshi/newfirst-app/commit/1bd361e)（[PR #21](https://github.com/nomuhoshi/newfirst-app/pull/21)）。提交人 `nomuhoshi` 账号，**实际作者待核实** | 自动：`verify:content` 真实运行（PR #21 记 5540 次运行、5745 项、失败 0）；人工：PR #21 评论（2026-11-04）写“已按 GPT 的指令处理”，即产品官提了清理要求；无正式 PR 评审 | 2026-11-04 Claude 会话：补 `<` 读法并换掉 U3L2#3（[`09e2e85`](https://github.com/nomuhoshi/newfirst-app/commit/09e2e85)），解决分支冲突、清理 `__pycache__` |
| **U4** 重复（8 关） | 同上：`docs/curriculum.md` | L1–L4：[`708473a`](https://github.com/nomuhoshi/newfirst-app/commit/708473a)（[PR #22](https://github.com/nomuhoshi/newfirst-app/pull/22)）；L5–L8：[`df1006d`](https://github.com/nomuhoshi/newfirst-app/commit/df1006d)（[PR #23](https://github.com/nomuhoshi/newfirst-app/pull/23)）。提交人 `nomuhoshi` 账号，**待核实** | 自动：PR #23 记 46256 次运行、失败 0 | 同 U3：Claude 会话在 2026-11-04 逐个同步堆叠的分支 |
| **U5** 列表与序列（7 关） | 同上 | L1–L4：[`bf1b785`](https://github.com/nomuhoshi/newfirst-app/commit/bf1b785)（[PR #25](https://github.com/nomuhoshi/newfirst-app/pull/25)，提交人 `nomuhoshi` 账号，**待核实**）；**L5–L7：[`d67a0c0`](https://github.com/nomuhoshi/newfirst-app/commit/d67a0c0)，提交人 Claude（Sonnet 5.5，会话 `01PV3FXrc7w2JxifLMkKjETC`，就是本会话）** | 自动验证同上；`step8-u5` 测试覆盖 7 关 | Claude 会话；整体经 rc-1（[PR #42](https://github.com/nomuhoshi/newfirst-app/pull/42)）进入第一版候选 `release/v1-candidate` |

15 道写代码 / 改代码题（U3:4、U4:6、U5:5）：待开放字段的题面在上面这些提交里；代码题 schema 和判题器在 [PR #19](https://github.com/nomuhoshi/newfirst-app/pull/19)、[#24](https://github.com/nomuhoshi/newfirst-app/pull/24)，同样是 `nomuhoshi` 账号提交，PR #20–#25 的描述里把运行器说成“待 Claude 的代码题运行器”（第三人称），这暗示 U3–U5 前半的编写者不是后来负责运行器的那个 Claude 会话；仍然只是推断，**待核实**。

## 待核实清单（要主人或当时的会话记录才能确认）

1. U1、U2 当初是哪个会话、哪一天写的（历史被截断）。
2. U3L1–U4L8、U5L1–L4 实际作者（`nomuhoshi` 账号提交）。
3. `docs/curriculum.md` 的实际撰写人（提交人是 Grok Bot，但 PR #15 描述写的是“产品负责人决定”）。
4. 题目内容有没有人逐题读过：仓库里没有逐题评审记录，只有自动验证和主人的真机试玩。

## 值得沿用的做法（给样板关参考）

这些来自已有的课程内容和 PR 描述，不是新设计：

1. **每关结构固定**：一个生活场景开场（奶茶店）+ 一句 `concept` + 3–5 道题 + 每题一句 `tip`/`hint`；单元最后一关是复习或小项目，把前面的串起来。
2. **干扰项对准具体误区**，并且每个错误选项带一句 `why`。例如 U3L4：“没缩进的行也属于 if”、“中文冒号”、“缩进两行都属于 if”；U3L1：“结果是数字”、“`=>` 写法”。PR #20 的描述把每关要打的误区列成清单，这个做法最值得保留。
3. **错误词块要“真的会出别的结果”**：U1L5-Q4 的 `60` 被换成 `price - cups`，因为 `60` 恰好等于正确答案之一的算出值，学习者蒙对也不知道为什么。现在每个词块、每个选项都用真实 Python 跑一遍，正确的输出必须等于期望，错误的必须不等于（`verify:content`）。
4. **排序题只接受真正等价的顺序**（U3L8 用 `equivCases`），不是只认一个答案。
5. **一步一个新概念，不同时引入两个**：U2 明确列出不引入的东西（索引、切片、`str()`、格式化字符串、换行转义、`input()`）；U4 的 while / break 放第二部分。
6. **“能看懂”和“能自己写”分开**：点选版先上线，改一改 / 写一写记在 `pending` 字段，等运行器。
7. **验证成本写在 PR 里**：运行次数、失败数、Chromium / WebKit 通过数，评审的人一眼看到证据。
