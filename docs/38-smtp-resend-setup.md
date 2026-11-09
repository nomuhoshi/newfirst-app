# 测试项目接入自定义 SMTP（Resend）配置清单

状态：**只是准备，尚未执行任何配置**。任务单 AUTH-MAIL-01 任务三。
适用范围：`suipian-test`（ref `tqdwhtrextqlmctkryyg`）。**正式项目 `aqlcunkmggzzvyavlkjg` 不在本文范围**——正式配置必须等域名验证完成并由老大明确授权。

## 0. 为什么要做（以及哪些还是假设）

- 已核实（Supabase 官方文档）：默认发信服务"只发给项目团队成员地址"，且默认每小时 2 封，官方说明它不适合生产使用；启用自定义 SMTP 后，Supabase 默认限速为每小时 30 封，可在 Authentication 的 Rate Limits 页调整。
- 尚未核实：acc1 那次 `Error sending magic link email` 的真实状态码和错误码。需要 owner 在 `suipian-test` 的 Auth Logs 里取（见 §5）。如果日志显示是别的原因（例如邮件模板写法出错），换 SMTP 不会解决问题。**所以第 1 步先取日志，再决定是否执行后面的步骤。**
- 接入自定义 SMTP 的前提不变：需要一个你拥有、能改 DNS 的**域名**（Resend 要求已验证的域名）。没有域名时的备选见 §6。

## 1. 谁做什么（密钥只经过 owner 的手）

| 步骤 | 谁 | 说明 |
|---|---|---|
| 取 Auth 日志里失败请求的状态码 / error_code | owner | 只看不改 |
| 在 Resend 注册、添加并验证域名 | owner | 需要改 DNS |
| 在 Resend 创建 API key | owner | 这个 key **就是 SMTP 密码**，只粘贴进 Supabase 控制台，不发给任何人、不进聊天、不进仓库、不进 GitHub 变量 |
| 在 `suipian-test` 填 SMTP 设置并保存 | owner | 见 §3 |
| 跑自动验收脚本 | 任何人 / 程序员 Sonnet | 只用公开的项目网址和 `sb_publishable_…` 公开密钥 |
| 收邮件、输入验证码、检查 50 XP 合并 | owner 或有测试邮箱的人 | 脚本看不到收件箱 |

## 2. Resend 侧（owner）

1. 注册 Resend，添加你的域名，按页面提示在 DNS 里加记录并等待"已验证"。发件地址必须属于这个已验证的域名。
2. 创建一个只用于 `suipian-test` 的 API key（名字建议 `suipian-test-smtp`），**权限选"仅发送"**。复制一次，直接粘贴进 §3 的 Password 栏。
3. 免费版额度（Resend 官方文档）：每天 100 封、每月 3000 封，每天按 UTC 零点重置；免费账号最多 3 个已验证域名。验证码登录场景足够测试，但**不要在测试里循环发送**。

## 3. Supabase 侧（owner，`suipian-test` 项目）

路径（按 Resend 官方文档）：Authentication → Notifications → Email → SMTP Settings。界面名称若有变动，以控制台为准。

| 字段 | 填写 |
|---|---|
| Enable custom SMTP | 打开 |
| Sender email | 已验证域名下的地址，例如 `no-reply@<你的域名>` |
| Sender name | 例如 `碎片编程（测试）` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | Resend 的 API key（只粘贴在这里） |

保存后：

1. Authentication → Rate Limits：把邮件发送频率限制确认在合理值（官方默认 30/小时）。测试项目只有一个用户，保持默认即可。
2. Authentication → Email Templates：确认 **Magic Link** 和 **Confirm signup** 正文是只含 `{{ .Token }}` 的验证码模板（不含链接）。模板写错（例如拼错变量）也会让发信失败，这一项和换 SMTP 无关，要单独核对。
3. 公开注册保持**关闭**（Allow new users to sign up = 关）。

## 4. 自动验收（保存配置之后）

在任意能联网的电脑上（密钥只放在当前命令的环境变量里，不要写进文件）：

```bash
# 阶段 1：只读预检，不发邮件
SUIPIAN_TEST_URL=https://tqdwhtrextqlmctkryyg.supabase.co \
SUIPIAN_TEST_ANON_KEY=<sb_publishable_ 开头的公开密钥> \
node scripts/smtp-acceptance.mjs

# 阶段 2：只发 1 封验证码（必须是 suipian-test 里已开通的邮箱）
SUIPIAN_TEST_URL=... SUIPIAN_TEST_ANON_KEY=... \
node scripts/smtp-acceptance.mjs --send --email=<已开通的测试邮箱> --yes-send-one-mail
```

脚本的保护：

- 正式项目网址一律拒绝；`secret` / `service_role` 密钥一律拒绝；输出里只显示密钥前 16 个字符。
- 阶段 2 用 `create_user:false`，不会创建用户；同一台机器 1 小时内不会发第二封（排障才用 `--force`）。
- 脚本只读 `SUIPIAN_TEST_URL` 和 `SUIPIAN_TEST_ANON_KEY` 两个变量，不读、不印、不记录任何 SMTP 密码或 Resend API key。
- 自测：`node tests/smtp-acceptance.test.mjs`（本机假服务器，27 项，已接入 `npm test`）。

脚本通过后，**人工**确认三件事：

1. 邮箱（含垃圾邮件）收到验证码邮件，正文只有 6 位验证码、没有链接；
2. 在测试预览里输入验证码能登录；
3. 游客 50 XP 经"安全合并到账号"完整保留，云端读回一致。

如果阶段 2 失败，脚本会给出分类、HTTP 状态码和错误码（不显示服务器原文）。把这行贴回来即可。

## 5. 先取日志（决定要不要做 §2–§3）

在 `suipian-test` → Logs → Auth Logs（或 Logs Explorer），找失败那次 `/otp` 请求，记下：HTTP 状态码、`error_code`、`msg`、时间。对应关系：

| 日志里的码 | 含义 | 处理 |
|---|---|---|
| 400 `email_address_not_authorized` | 默认发信不发给非团队成员 | 做 §2–§3 |
| 429 `over_email_send_rate_limit` | 发送次数或频率到上限 | 等待，或做 §2–§3 |
| 500 `unexpected_failure` 且消息是 Error sending… | 发信或模板环节出错 | 先查 SMTP 是否已开启、模板写法；再决定 |
| 其他 | — | 贴回来再判断 |

## 6. 没有域名时的备选（需要老大选择，我不替你买任何东西）

- 把 qq 邮箱等需要测试的邮箱**加入 `suipian-test` 的团队成员**：默认发信服务只发给团队成员，这样可能无需 SMTP（但仍受每小时 2 封限制）。是否可行以 §5 的日志为准。
- 用邮件服务商的"单发件邮箱验证"方式（不要求自有域名）。具体服务商和免费额度未核实，需要先确认再选。

## 7. 回滚

在 SMTP Settings 里关闭 Enable custom SMTP 即回到默认发信。若曾泄露或误贴 API key：到 Resend 删除该 key 并重建，再重新粘贴到 Supabase。

## 8. 来源

- Resend：Send with Supabase SMTP（host / port / username / password 与前提）；账户额度与限制。
- Supabase：Auth → Send emails with custom SMTP（默认限制、30/小时、Rate Limits 页）。
- 以上均为 2026-11-09 检索所得，界面与额度以各自控制台当前显示为准。
