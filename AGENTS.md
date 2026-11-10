# 给接手这个项目的 AI（先读这个）

更新：2026-11-10（分支 `release/v1-candidate`）。项目：「碎片编程」，免费的手机 PWA，用点选题和写代码题学 Python。正式站：https://nomuhoshi.github.io/newfirst-app/ 仓库：nomuhoshi/newfirst-app（公开）。

## 先读（按顺序）
1. `docs/40-release-v1-candidate.md` — **第一版发布候选的整合记录、CSP、隐私说明、正式 Supabase 后台核查表、清理清单、需要老大操作的事**
2. `docs/14-known-issues.md` — 已知问题、平台限制、上线前 iPhone 验收清单和上线标准
3. `spec/SPEC.md` — 产品规格和**决策记录表**（最后几行是最新决定）
4. 账号 / 同步：`docs/15-account-sync-plan.md`（方案）、`docs/30-db3-integration-audit.md`（最终整合审查）、`docs/39-auth-mail-02-acceptance.md`（登录错误提示验收）
5. `docs/38-smtp-resend-setup.md` — 正式发信（SMTP / Resend）待老大决定

## 现在的状态（2026-11-10）
- **正式站（main）**：仍是 U1–U2 共 11 关，没有账号。main 之后的所有工作都还没上线。
- **第一版发布候选 `release/v1-candidate`**（从 `fix/touch-targets @ a8d26c1` 开出，产品官拍板）：U1–U5、写代码题判题（真 Pyodide）、邮箱验证码登录、云端同步（多设备 XP 去重、游客进度安全合并、退出 / 删号保护）、触控尺寸 ≥ 44、代码题模块按需加载、PWA 图标、代码块保留缩进、内容安全策略（CSP）、隐私说明页。整合记录见 docs/40。
- **不进第一版**：U6（PR #51，唯一内容线 `content/u6`）、U7（PR #48，`content/u7`）、U8（`content/u8-part1`，暂存）、设计系统 v3（#47）、新手流程（#35）、体力制（#29，只有规格）。
- **测试预览**（只连测试 Supabase `tqdwhtrextqlmctkryyg`，不碰正式数据）：预览仓库 nomuhoshi/newfirst-app-preview 的 `v1rc/`（发布候选）、`acc2/`（账号验收）。推 `preview/v1rc` 分支触发构建。
- **上线门槛**（docs/40 §6）：iPhone 真机、Resend 发信域名、正式 Supabase 后台核查、隐私说明待定项、中国大陆访问和 QQ / 163 收信——都要老大做或决定；最后老大说“合并”才合 main、才部署。

## 工作规则（2026-11-10 起）
- 产品官（GPT）负责审查、决策、优先级和验收标准；程序员负责执行，给 GitHub SHA、CI 和测试证据。
- 未经老大明确授权：不合并 main、不部署正式站、不改正式 Supabase、不删分支 / PR / 预览目录 / 文档 / 数据。不强推，不在 GitHub 留评论。
- 新改动只在自己的分支上做。不要把“代码开发完成”写成“可以上线”：交付时分清 代码开发完成 / 测试预览通过 / 正式上线条件满足。
- 不做：排行榜、社交、支付、广告、推送、复杂复习算法。
- 项目主人只用 iPhone 和 iPad，不要让他在电脑上跑命令。Claude 的云端环境通常连不上 npm 官方源、github.io 和 *.supabase.co：构建和浏览器测试以 GitHub CI 为准。

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
npm test                             # 需要先 build；按 package.json 的 test:chain 逐条运行（scripts/run-tests.mjs，每条有超时）
npm run test:mobile -- chromium      # 手机模拟（WebKit / Chromium）：账号、触控尺寸、CSP 等浏览器测试
npm run test:e2e -- chromium         # 端到端关键流程
npm run dev                          # 本地开发
```
- 第 2 单元内容由 `scripts/make-unit2.py` 生成 `content/unit2.json`（改题目就改脚本再运行）。第 1 单元直接改 `content/unit1.json`。
- 课程 JSON 被打包进 JS；离线缓存清单由 `scripts/vite-sw-plugin.mjs` + `scripts/sw-template.js` 在构建时生成 `dist/sw.js`。
- 状态存在 localStorage（版本 3，`src/storage.js`）；账号副本、凭证在 `src/account-store.js`；同步在 `src/sync.js`；`window.__app` 是给自动测试用的钩子。
- CSP 由 `scripts/vite-csp-plugin.mjs` 在构建时插进 index.html：加了内联脚本、外部请求或新的云项目，要同时改它和 `tests/csp.test.mjs`。

## 项目主人的偏好（也适用于你）
- 中文沟通，说话直接，不要套话和免责声明；指出问题和风险，给具体建议。
- 编程新手：靠 AI 写代码。讲解要从基础讲起、不跳步；讲代码时结尾附完整可运行的例子。
- 英文单词：给美式国际音标和意思（单词解释单词，短语解释短语）。
- 他把方案交给另一个 AI（GPT）做产品/设计/审查，再把回复贴回来；你负责实现和测试，每一步做完先汇报，不要自行开始下一阶段。
- 提交说明用中文；提交前确认 `npm test` 全绿。
