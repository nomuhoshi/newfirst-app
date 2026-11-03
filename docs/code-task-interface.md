# 写代码 / 改代码题：共享接口与分工（草案，待碎片编程确认）

> 2026-11-03 Claude 起草。基于 PR #18（judge-core，bd8970e）和 `docs/u3-and-code-tasks-plan.md`（PR #15）。
> 目的：在动手前把字段名、结算入口和文件归属定下来，避免两边改同一处。**确认前我只改下面“Claude 负责”的新文件。**

## 1. 与 PR #15 方案文档不一致的地方（以 PR #18 代码为准，请同步文档）
| 项目 | #15 文档 | #18 代码（采用） |
|---|---|---|
| 注入变量字段 | `vars` | `data` |
| 判题模式 | `checkMode: "stdout"` | `checkMode: "output"` |
| 单组结果种类 | `timeout-case` / `timeout-total` / `actual` | `case-timeout` / `total-timeout` / `stdout` |
| 结果字段 | `status, cases, totalMs` | 另有 `attempt / settle / retry` |
题库 JSON 里写 `data`、`"output"`；`content/*.json` 与校验脚本都用这套名字。

## 2. 为“提前准备 input / 文件 / 多文件”扩展 judge 接口（向后兼容）
```
judge({ code | files, entry, tests, checkMode, compare, limits }, executor, { signal })
  code    仍然可用 = files: [{ path: "main.py", content: code }]，entry: "main.py"
  files   [{ path, content }]  学生的多个文件（模块导入用）；entry 默认 "main.py"
  tests[] { name, hidden?, data?,
            stdin?          string | string[]   // input() 依次读到的行；读完再 input() → EOFError（按错误处理，不挂起）
            files?          { path: content }   // 这一组开始前写进虚拟文件系统的文件（每组都从干净的文件系统开始）
            expected        期望标准输出
            expectedFiles?  { path: content }   // 运行后这些文件必须存在且内容一致（同样用 compare 规则）
          }
  checkMode  "output"（现有）| "call"（U7 起：{ call: { fn, args, kwargs }, expectedReturn } 按值比较，不比 repr）
executor.exec({ files, entry, data, stdin, vfs, readFiles, timeoutMs, signal })
  -> { stdout, error, timedOut, limitHit, ms, files? }   // files = readFiles 里列出的文件运行后的内容
```
- U3 只用 `output`；其余字段先在判题器和 worker 里做好并有单元测试，题库在需要时再用。
- 隔离：每组 = 新全局变量空间 + 新虚拟文件系统 + 清掉学生模块（`sys.modules`）+ 重设随机种子。
- `stdin` 缺省时，`input()` 报“这道题没有输入”的明确错误（现在是“暂不支持 input()”，要改）。

## 3. 题目 JSON（modify / write）
字段按 #15 §2，名字按本文 §1。`modify` 多 `code`。每题必须有 `id`、`version`。校验脚本（内容自动验证）由谁写见 §5。

## 4. 结算入口（只此一处，不碰 XP / 红心规则本身）
新增 `settleCheck(run, ex, result)`，输入判题 `Result`：
| result | 动作 |
|---|---|
| `settle && status==="pass"` | 答对：现有 `XP_CORRECT` / 复习 `XP_REVIEW` 逻辑，同一题只结算一次 |
| `settle && status==="fail"` | 答错：现有答错逻辑（非复习扣 1 心，题放到队尾） |
| `!attempt`（timeout / unavailable / cancelled / internal-error） | 什么都不做：不扣心、不加分、不弹反馈，保留代码，显示重试 |
### 时限与取消（2026-11-03 项目主人新规则，取代 PR #15 §5 里“死循环超时 = 答错扣 1 红心”）
- **题目不设时限**。判题的 5 秒（单组）/ 10 秒（整次）只是环境保护：超时 → `status:"timeout"`，**不算答错、不扣红心**，`attempt:false, settle:false, retry:true`，代码保留，提示写明“不算作答，不扣红心”。
- 遇到第一个超时就停止，不再跑后面的组（结果本来也不能结算）。
- 取消（AbortSignal）→ `status:"cancelled"`，`attempt:false, settle:false, retry:false`，不弹“环境不可用”提示。
- 待 GPT 定：输出太多（`output-limit`）目前仍按“答错”处理（学生程序死循环 print 也会走到这里）。如果也要算环境保护，改一行即可。
- `settleCheck` 对 `timeout / unavailable / cancelled / internal-error` 一律什么都不做。

“运行”按钮：只调 executor，不调 `settleCheck`。
`app.js` 里我只加**一个**钩子（`renderExercise` 里 `type==="modify"||"write"` 分支调用 `renderCodeTask`），其余在新文件。

## 5. 分工与文件归属（避免冲突）
| 谁 | 文件 |
|---|---|
| 碎片编程 | `src/judge.js`、`src/runner.js` 里的 `whenReady`（PR #18）；`content/unit3.json` 前四关、`content/course.json`；`scripts/` 里的内容验证脚本；#11 账号数据层 |
| Claude | 新文件 `src/code-task.js`（题目页：编辑器、运行/检查/提示、结果展示、草稿）、`src/code-drafts.js`、`src/code-task.css`；`src/py-worker.js`（stdin、虚拟文件系统、多文件、隔离）和 `runner.js` 里与之相关的消息字段；对应测试 `tests/code-task.test.mjs`、`tests/py-worker-io.test.mjs`；`app.js` 一个分支钩子 |
| 共同 | `judge.js` 的接口字段（§2）。我要改动先在本文档里写明，你确认再改 |
我的分支：`feat/code-task-run`（基于 `feat/judge-core`，PR 的 base 也是它，等 #18 合并后再 rebase 到 main）。不改写你的历史。

## 6. 请碎片编程确认
1. §1：以代码为准，PR #15 文档里的字段名由你改。
2. §2：扩展字段名（`files / entry / stdin / expectedFiles / vfs / readFiles`）是否同意；`judge()` 里的参数打包由你还是我改。
3. §4：结算入口形状和 `app.js` 只开一个钩子。
4. U3 前四关（predict/fill/order）的 `exercises` 格式不变，我不碰；L5–L8 的 write/modify 题内容我来审、谁来写？（建议：你写题，我用内容验证脚本和真实 Python 审）
5. #11：我不再动它。请告知发现的数据损坏具体是什么（哪个函数、什么输入），我做独立复核。
