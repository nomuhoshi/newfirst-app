# Supabase 配置清单（给项目主人，iPad 上就能做）

更新：2026-11-03。目的：让开发期间并行配置，不等登录界面写完。
**我只需要两样东西：项目网址（Project URL）和公开密钥（publishable / anon key）。**
**绝不要发给我：数据库密码、service_role / secret 密钥、你的 Supabase 账号密码。** 公开密钥本来就会出现在网页里，配合行级权限是安全的。

## 1. 建项目（5 分钟）
1. 打开 https://supabase.com ，用 GitHub 或邮箱注册（免费版）。
2. New project：名称随意（如 suipian）；区域选 **Tokyo (ap-northeast-1)** 或 Singapore；数据库密码用密码管理器生成并保存好（**不要发给任何人**）。
3. 等 1–2 分钟项目就绪。

## 2. 建表和权限（1 分钟）
1. 左边菜单 SQL Editor → New query。
2. 把仓库里的 `supabase/schema.sql` 全部粘贴进去，点 Run。看到 Success 即可。（可重复运行。）
3. 如果你还想先做访问实测：再粘贴 `supabase/access-test.sql` 运行，并在 Authentication → Sign In / Providers 里打开 Anonymous sign-ins。

## 3. 打开邮箱验证码登录
1. Authentication → Sign In / Providers → Email：打开 Enable Email provider。
2. 保持 "Confirm email" 开启。**我们用 6 位验证码登录，不用邮件里的链接**（原因：iPhone 主屏幕 App 和 Safari 的存储是分开的，点链接会登录到 Safari 而不是 App）。
3. Authentication → Email Templates → **Magic Link** 和 **Confirm signup** 两个模板的正文改成只含验证码（我会给你中文模板，内容是 `{{ .Token }}`，不含链接）。
4. Authentication → Settings：验证码有效期 600 秒（10 分钟）；验证码长度 6 位。

## 4. 发信（⚠️ 这一步需要你确认预算后再做）
- Supabase 自带发信**每小时只有 2 封，且只能发给项目团队成员**，只能用来自己试。
- 要让普通用户收到验证码，需要自定义 SMTP：推荐 Resend（免费版每天 100 封），**发件人必须是你自己验证过的域名**。
- 因此：**需要一个域名**（先检查你是否已经有；新买要先核实首年价和续费价）。**在你明确同意之前我不会让你买任何东西。**
- 在没有域名的阶段，开发和测试用"自己的团队成员邮箱"登录即可（Supabase 自带发信足够），学习功能不受影响（本机优先）。

## 5. 验证账号隔离（开发完成后做一次）
1. Authentication → Users 里手动添加两个测试用户 A、B（或用两个邮箱各登录一次）。
2. 用 A 登录并保存进度；用 B 登录后确认 B **看不到** A 的进度（我会提供测试页按钮，显示"读到几行"，应为 0 或 1）。
3. 在 SQL Editor 里不要用 service_role 去查来判断隔离（那会绕过权限，结果不代表用户看到的）。

## 6. 发给我
- 项目网址：形如 `https://xxxxxxxx.supabase.co`
- 公开密钥：Project Settings → API → **publishable / anon public** 那一行
把这两样发给 GPT 转交我即可；我会写入 `public/access-test-config.js` 和应用配置。

## 7. 防止项目被暂停
Supabase 免费版**连续一周没有访问会暂停**项目。建议：每周打开一次后台，或之后加一个定时访问任务（实施前我会先确认不违反条款）。
