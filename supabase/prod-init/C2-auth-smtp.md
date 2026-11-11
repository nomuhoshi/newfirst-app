# C2：正式项目认证与发信配置（Supabase 后台操作）

目标项目：`suipian-app`（`aqlcunkmggzzvyavlkjg`）。Supabase 连接器**读不到也改不了** Auth 配置，以下都在 Supabase 后台（Dashboard → Authentication）操作。改之前先把“当前值”一列抄下来（截图也行），改完再抄一次“改后值”。**密码、API key 不抄、不截、不贴聊天。**

## 1. 逐项目标值

| # | 位置（Dashboard） | 项 | 目标值 | 依据 |
|---|---|---|---|---|
| 1 | Authentication → URL Configuration | Site URL | `https://nomuhoshi.github.io/newfirst-app/` | 正式站地址；应用用验证码登录，Site URL 只出现在模板变量里 |
| 2 | 同上 | Redirect URLs | 只保留 `https://nomuhoshi.github.io/newfirst-app/`（或留空）；**不要**通配 `*`、不要 localhost、不要预览站 | 应用不传 `redirect_to` |
| 3 | Authentication → Sign In / Providers | Allow new users to sign up | **开** | 应用发验证码时 `create_user: true`，新用户靠它注册 |
| 4 | 同上 → Email | Enable Email provider | 开 | |
| 5 | 同上 → Email | Confirm email | 开 | |
| 6 | 同上 → Email | Email OTP Length | `6` | 应用输入框是 6 位 |
| 7 | 同上 → Email | Email OTP Expiration | `600` 秒 | 10 分钟 |
| 8 | 同上 | Anonymous sign-ins、Phone | 关 | |
| 9 | Authentication → Emails → Templates | **Confirm signup**（新用户收这封） | 见 §2 模板 | 不含链接 |
| 10 | 同上 | **Magic Link**（老用户收这封） | 见 §2 模板 | 不含链接 |
| 11 | Authentication → Emails → SMTP Settings | Enable Custom SMTP | 开 | |
| 12 | 同上 | Sender email | `noreply@mail.suipiancode.com` | 老大 11:07 定 |
| 13 | 同上 | Sender name | `碎片编程` | |
| 14 | 同上 | Host / Port | `smtp.resend.com` / `465` | Resend 官方 SMTP（465 走 SSL；不通时改 587） |
| 15 | 同上 | Username | `resend` | |
| 16 | 同上 | Password | Resend 的 API key（**只在这个输入框里由老大或授权的人亲手粘贴**） | 只给“发信”权限的 key |
| 17 | Authentication → Rate Limits | Rate limit for sending emails | 配好自有 SMTP 后记下实际值（Supabase 对自有 SMTP 的默认值是每小时 30 封）；不低于 30 | 曾遇 `over_email_send_rate_limit`，以实际值为准 |
| 18 | 同上 | 其他限额（验证、刷新令牌） | 只记录，不改 | |
| 19 | Authentication → Sign In / Providers → Email | 密码登录相关 | 只记录当前状态 | 应用不用密码；泄露密码防护只有 Pro 能开，免费套餐下记为“已知、不适用” |

## 2. 两个邮件模板（Confirm signup 和 Magic Link 用同一套）

主题（Subject）：

```
碎片编程验证码：{{ .Token }}
```

正文（Body，HTML）：

```html
<p>你好！</p>
<p>你的碎片编程验证码是：</p>
<p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
<p>请在 10 分钟内回到碎片编程输入这 6 位数字。</p>
<p>如果不是你本人在登录，请忽略这封邮件，你的账号不会有任何变化。</p>
```

**不要**保留默认模板里的 `{{ .ConfirmationURL }}` 链接：iPhone 主屏幕 App 和 Safari 的存储是分开的，点链接会登录到 Safari 而不是 App。

## 3. 改完后的检查

1. 再抄一次 §1 全部“改后值”，贴回给程序员核对。
2. 用**专用测试邮箱**（不用老大现有账号）在正式站发一次验证码：记发送时间、收到时间、是否进垃圾箱、邮件头里发件域名（`mail.suipiancode.com`）和 DKIM / SPF 结果（Gmail：显示原始邮件）。
3. 用验证码登录成功后，进入 §4（实测顺序）。

## 4. 连接器的能力缺口

| 能做 | 不能做 |
|---|---|
| 执行 SQL、迁移，读安全顾问、项目元数据、区域、套餐 | 读写 Auth 的 URL 配置、Providers、OTP 设置、邮件模板、SMTP、Rate Limits |

所以 C2 只能在后台由人操作；程序员负责给目标值、模板和核对。
