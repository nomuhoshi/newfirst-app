# C2 正式项目 suipian-app 认证与发信配置（2026-11-12 00:30 JST，传话员在后台操作）

| 项 | 改前 | 改后 |
|---|---|---|
| Site URL | http://localhost:3000 | https://nomuhoshi.github.io/newfirst-app/ |
| Redirect URLs | 空 | 空 |
| Allow new users to sign up | 开 | **关**（验收期间） |
| Sender email | no-reply@mail.suipiancode.com | noreply@mail.suipiancode.com |
| Confirm signup / Magic Link 模板 | 默认 / 旧版 | C2 §2 模板（无链接） |

未改：Email provider 开、Confirm email 开、OTP 6 位、600 秒、匿名关、手机关；SMTP 已开 smtp.resend.com:465、用户名 resend、发件名 碎片编程、密码沿用已有值（未查看）；发信限额 30 封/小时；泄露密码防护关（仅 Pro 可开，记为已知不适用）。

未做：添加测试用户、#57 合并、真实收信验收。
