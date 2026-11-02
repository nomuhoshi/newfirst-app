# 给接手这个项目的 AI（先读这个）

更新：2026-11-02。项目：「碎片编程」，免费的手机 PWA，用点选题学 Python。线上：https://nomuhoshi.github.io/newfirst-app/ 仓库：nomuhoshi/newfirst-app（公开）。

## 先读（按顺序）
1. `README.md` — 一句话状态
2. `docs/14-known-issues.md` — 已知问题、平台限制、**上线前 iPhone 验收清单和上线标准**
3. `spec/SPEC.md` — 产品规格和**决策记录表**（每一轮改动都有一行，最后几行是最新决定）
4. `docs/13-handoff-to-gpt-round4.md` — 上一轮进度汇报；`docs/07-step2-checklist.md` — 人工试玩清单（第 6–23 项）
5. 需要时再看 `docs/08`–`12`（手感、音频、振动的调查过程）

## 现在的状态
- 第 1 单元「奶茶店点单屏」6 关、第 2 单元「文字与长度」5 关已上线（共 11 关，每关 4 题，题型只有 predict / fill / order）。第 3–5 单元是“即将推出”。
- 已完成：关卡模式（XP、红心、连续天数、错题回炉）、原创视觉“墨蓝实验手账”、合成音效（按键音 A–J，默认 J）、离线（Service Worker）、振动功能检测、`docs/14` 已知问题。
- 自动测试 330 项全部通过（`npm test` = step1 64 + step2 236 + step3 30）。CI 在每次推送 main 时：安装 → 构建 → 测试 → 通过才部署到 GitHub Pages。

## 下一步（项目主人已决定）
1. **人工验收（项目主人自己做，稍后）**：iPhone 完整学一遍 Unit 2；找至少两名没学过编程的人各做一关；Safari 和主屏幕模式各做一次声音/离线/安全区验收（清单见 `docs/14`）。
2. **Unit 3（比较与 if/else）等人工验收之后再开始**，并且根据试玩反馈，可能先调整题型。**不要现在写 Unit 3。**
3. 不做：账号、后端、云同步、复杂复习算法、更多音效风格、“恢复到第几题”（列为后续功能）。

## 不能随便改的规则
- 课程难度、XP（答对 +10，通关 +10，复习 +5）、红心（每 30 分钟 +1，最多 5）、连续天数、解锁规则、错题回炉：除非项目主人明确同意并写进 `spec/SPEC.md` 决策记录。
- 旧测试不能删除或放宽；改行为就要改对应测试并说明理由。
- 不得用预设输出冒充 Python 真实执行；离线时必须如实提示。
- 新题目必须用真实 Python 验证（测试里会自动跑：选输出题与真实运行一致、填空题答案正确且错误词块有解释、排序题检查全部排列）。

## 怎么跑
```
npm install
npx playwright install chromium     # 测试用
npm run build                        # 会先把 Pyodide 复制进 public/pyodide（该目录不进 git）
npm test                             # 需要先 build；约 5–8 分钟
npm run dev                          # 本地开发
```
- 第 2 单元内容由 `scripts/make-unit2.py` 生成 `content/unit2.json`（改题目就改脚本再运行）。第 1 单元直接改 `content/unit1.json`。
- 课程 JSON 被打包进 JS；离线缓存清单由 `scripts/vite-sw-plugin.mjs` + `scripts/sw-template.js` 在构建时生成 `dist/sw.js`。
- 状态存在 localStorage（版本 3，`src/storage.js`）；`window.__app` 是给自动测试用的钩子。

## 项目主人的偏好（也适用于你）
- 中文沟通，说话直接，不要套话和免责声明；指出问题和风险，给具体建议。
- 编程新手：靠 AI 写代码。讲解要从基础讲起、不跳步；讲代码时结尾附完整可运行的例子。
- 英文单词：给美式国际音标和意思（单词解释单词，短语解释短语）。
- 他把方案交给另一个 AI（GPT）做产品/设计/审查，再把回复贴回来；你负责实现和测试，每一步做完先汇报，不要自行开始下一阶段。
- 提交说明用中文；提交前确认 `npm test` 全绿。
