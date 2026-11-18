# 传话员交接包（2026-11-18 14:00 JST）

新传话员复活后第一句话：先跟老大打招呼，再继续主线。

## 1. 身份与规矩
- 称用户「老大」，中文，东京时间（JST）。在电脑浏览器里给 AI 团队传话，工作文件在 `/workspace/relay/`（relay_log.txt 是流水账）。
- 老大授权：产品官放行的步骤（含合并 PR）直接执行，不必再等老大；风险操作由团队决定（产品官裁决＋传话员核对后执行，留证据）。
- 绝不显示密码/密钥/OTP/token；不碰 SMTP 密码、正式 Supabase、任何密钥；正式站 CAPTCHA 保持关闭；真实 Turnstile 挑战实验暂停。
- 不碰设计师线（ChatGPT「设计官」聊天、#125）。
- Claude 到额度上限：不要点 reset / Get more usage / Try again，不买额度，停下报告老大。
- ChatGPT 不开新聊天，满了就用「Branch in new chat」分支；模型不改。
- 不打断正在生成的模型；不空等 CI（后台 watch）。
- 每 30 分钟向老大汇报（routine id 30），只有真有新进展才发，不发“无变化”。注意：11:33 起该 routine 的运行环境没有 Shell，连续失败，传话员自己查状态再汇报。

## 2. 团队与聊天（按网址选标签页，顺序会变）
- 产品官6号（裁决者，ChatGPT，Pinned）：https://chatgpt.com/c/6af94fc5-3478-83ec-9a89-94af051ef38a
- code员工（写代码、开 PR，Claude Code，X-2号账号）：https://claude.ai/code/session_01PV3FXvcUP27v4Fo8C8Gju3 —— 接替的是 Claude 程序员 Sonnet（不是 GPT1）。
- 员工GPT1（独立审查 PR/CI，ChatGPT，Pinned）：旧聊天 https://chatgpt.com/c/6aed60c4-435c-83ee-a8a8-fe54d363feca 已到长度上限。老大 13:57 批准：从它开分支继续，并把 Pinned 换成新分支、取消旧聊天置顶 —— **尚未执行**。
- Gemini（老大 bb0421 Google 账号，聊天名「程序员gemini」）：https://gemini.google.com/app/77c1bf0fc057f157 —— 读不到 GitHub，材料要贴给它。
- 程序员 Sonnet 旧聊天 https://claude.ai/chat/9befe6f5-90a9-44fc-8e1c-286b5d420e9a 已不用。

## 3. 发送方法
- `xclip -selection clipboard -i FILE` → 粘贴 → 发送前核对首行 → 只发一次 → 看到生成后才在 relay_log 记 sent。
- 回复用复制按钮存为文件；存下的文本不能以【传话员开头（否则是旧剪贴板，重复制）。
- 文件命名：to_po6_N / po6_reply_N，to_code_N / code_reply_N，to_gpt1_N / gpt1_reply_N，to_gemini_N / gemini_reply_N。

## 4. 合并与上线核对（仓库 nomuhoshi/newfirst-app，squash）
1. 合并前核对：PR HEAD 未变、base = 最新 main、mergeStateStatus = CLEAN、同头 CI success。
2. `gh pr merge N --squash --match-head-commit <完整sha>`
3. `./check_merge_live.sh <合并sha>`（后台跑）：main CI、Pages 部署最终状态、线上 `assets/main-*.js` 含完整 SHA、正式启用列表 `codeTasksEnabled:()=>[...X]` 中 X=[]。脚本偶尔卡在最后 curl，可手动补跑。
4. 结果报产品官6号，必要时简报老大。

## 5. 当前状态（14:00 JST）
- main = 94a67e8（#133 合并）。今天已合并上线：#130（6c652e3）、#131（4b6d48d）、#132（de208ae）、#133（94a67e8），每次合并后核对均通过。16 道代码题全部接入试点测试构建；正式版启用列表 = []；线上不开放、不宣传代码题，等 iPhone P3 实测后产品官6号单独放行。
- #134（code员工，P3 iPhone 实机验收包，HEAD 74c06f8，base 94a67e8）：同头 CI run 44236476416 传话员交接时还在跑/刚完，需查结果。产品官6号要求：GPT1 独立审核（绑定完整 HEAD + 同头 CI + 全量 diff，to_gpt1_36.txt 已备好），产品官收到最终审核包后再裁决合并。合并后，传话员先核对测试入口 16 题全开、正式入口仍 []，再把入口网址和步骤交老大做 iPhone 实测（记录机型、iOS、Safari/主屏幕、实际结果）。
- Gemini：T3 真实生命周期取证方案（产品官6号 13:52 派）。初稿 gemini_reply_19.txt；13:58 补发 #126 材料 to_gemini_20.txt（发送/回复是否完成需核对 relay_log；回复应存 gemini_reply_20.txt）。定稿后转产品官6号。
- 老大待办：U6 iPhone 实机走查；#125 设计线的最终截图/手势反馈与答错表情决定（设计线，我们不碰）。

## 6. 下一步
1. 核对 Gemini to_gemini_20 是否已发、回复是否已存。
2. 从员工GPT1 旧聊天最后一条真实回复处「Branch in new chat」→ 新分支改名「员工GPT1」并 Pin，取消旧聊天 Pin → 在新分支发 to_gpt1_36.txt → 存 gpt1_reply_35.txt → 补发 #134 同头 CI 结果。
3. GPT1 审核 + Gemini 方案 → 打包给产品官6号 → 放行即按第 4 节合并核对。
4. 更新记忆中 GPT1 新网址。
