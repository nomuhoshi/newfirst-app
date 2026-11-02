# newfirst-app（碎片编程）

网址：https://nomuhoshi.github.io/newfirst-app/ （技术验证页：/lab.html）

我的第一个公开发布的应用：**用手机学 Python 的网页应用（PWA）**，免费发布，不上 App Store。

> 状态：多邻国式关卡模式，第 1 单元「奶茶店点单屏」6 关已上线，手感（反馈节奏、合成音效、安卓短振）和原创视觉“墨蓝实验手账”已加入，声音和振动推迟到上线前处理（已有测试页保留）；电路背景已加密到 7 条路径；自动测试 229 项通过（2026-11-02）。

## 目标
- 面向公众，免费，只用手机就能学 Python
- 利用碎片时间，尽量不用键盘（点选为主）
- 首发：10 节微型课程 + 内置编程键盘 + 浏览器内真 Python 运行；词源改为可选的词义卡。**范围以 `spec/SPEC.md` 为准。**

## 目录（建议阅读顺序）
| 文件 | 内容 |
|---|---|
| `FOR_GPT.md` | **给 GPT 的任务说明，先读这个** |
| `docs/01-context.md` | 我是谁、做这个的原因、约束条件 |
| `docs/02-senior-engineer-workflow.md` | 一位资深工程师用 AI 做软件的流程（我要学的方法） |
| `docs/03-distribution-options.md` | 发布方式对比：PWA / Google Play / App Store，以及为什么选 PWA |
| `docs/04-product-idea.md` | 产品想法：碎片编程 · 词源加练 |
| `spec/SPEC.md` | **产品规格 v0.1（权威）** |
| `docs/05-tech-plan.md` | 技术方案与第一步计划（待确认） |
| `docs/06-step1-checklist.md` | 第 1 步验收记录和 iPhone 手动测试清单 |
| `docs/07-step2-checklist.md` | 第 2 步（多邻国式关卡）验收记录和试玩清单 |
| `content/` | 课程内容（JSON），加课只需要加内容 |
| `src/` | 应用代码 |
| `tests/` | 自动测试 |
| `spikes/` | 技术验证用的临时代码 |
| `skills/ai-assisted-dev-workflow/SKILL.md` | 可发给任何 AI 的开发流程 skill |

## 本地运行
```
npm install
npx playwright install chromium   # 只需一次，测试用
npm run dev      # 开发模式
npm run build    # 打包到 dist/
npm test         # 自动测试（需先 build）
```

## 工作流程（简版）
1. 和 GPT 聊产品，整理成 `spec/SPEC.md`
2. 我确认规格
3. 交给 Claude 拆小步、写代码、解释代码
4. 换另一个模型交叉检查
5. 让 AI 出测试，我亲手验收
6. 迭代到没有 bug，发布成 PWA

详细见 `skills/ai-assisted-dev-workflow/SKILL.md`。
