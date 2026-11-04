# 测试入口的独立 Supabase 项目（只允许老大一个人登录）

**为什么**：测试入口（`rc1/`、以后的新预览）和正式站原来连的是同一个 Supabase 项目。测试链接一旦被转发，别人就能在测试入口里注册、把数据写进“朋友们的正式数据库”。现在的规则：
- **测试入口（构建时设了 `PREVIEW_ID`）永远不连正式项目**。它只认构建时给的 `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY`；没给 = 云端关闭，只能在本机学习；给的网址就是正式项目 = 同样关闭（`src/cloud-config.js`，`tests/cloud-config.test.mjs` 有测试）。
- **正式构建**不读这两个变量，仍然只用写死的正式项目。
- 测试项目里**只有老大的账号**，并且**关闭公开注册**。

## 老大要做的（免费版，不需要升级 Pro，大约 10 分钟）
1. 登录 Supabase，新建第二个项目（免费版允许 2 个），名字叫 `suipian-test`，区域和正式项目一样。
2. 左侧 **SQL Editor** → New query → 把仓库里 `supabase/schema.sql` 的全部内容粘进去 → Run。（和正式项目建同样的表和权限。）
3. **Authentication → Providers → Email**：保持开启和 "Confirm email"；然后**关掉 “Allow new users to sign up”（不允许新用户注册）**。
4. **Authentication → Email Templates**：和正式项目一样，把 **Magic Link** 和 **Confirm signup** 的正文改成只含验证码 `{{ .Token }}`（见 `docs/supabase-setup.md` 第 3 步）。
5. **Authentication → Users → Add user → Create new user**：填你自己的邮箱（勾选自动确认）。**别的邮箱一个都不要加。**
6. **Project Settings → API**：复制两个值——Project URL（形如 `https://xxxx.supabase.co`）和 publishable（anon）key。**这两个本来就是公开的，可以发给我或贴在 GitHub 变量里；`service_role` / secret 密钥、数据库密码绝对不要发给任何人。**
7. 把这两个值给到构建：二选一
   - GitHub 仓库 → Settings → Secrets and variables → Actions → **Variables** → 新增 `TEST_SUPABASE_URL` 和 `TEST_SUPABASE_ANON_KEY`；
   - 或者把两个值发给程序员 Sonnet，由他写进测试预览的构建配置。
8. 在 Actions 里重新运行 “RC1 preview”，再把 `rc1/` 更新到预览仓库（程序员 Sonnet 做）。

## 验证（做完后）
- 测试入口“我的”页能用老大的邮箱收到 6 位验证码并登录；
- 随便换一个别的邮箱：应当失败（“不允许注册”类提示）；
- 在测试入口里做一关、等“已同步 ✓”，到**正式项目**的 `progress` 表里确认**没有**这条记录，在**测试项目**里有。

## 其他旧预览
- `pr11/` 和 `pr11-design/` 是 2026-11-04 之前用旧规则构建的，还连着正式项目。已处理方式见 `docs/21` 之后的交接记录：`pr11/` 被 `rc1/` 取代、从预览仓库移除；`pr11-design/` 用新规则重建（云端关闭）后再放回。

## 登录凭证按项目隔离（2026-11-05 加）
- 浏览器里保存的登录凭证会记下它来自哪个 Supabase 项目（网址解析后的主机名，小写）。
- 以前连过正式库的入口（如 rc1/）改接测试库后，第一次打开时旧凭证自动作废，“我的”页显示需要重新登录；**本机学习记录（游客记录、账号本机副本）一条不动**。
- 没记项目的旧凭证一律当作来自正式库：正式站继续有效（朋友们不会被退出登录），测试库入口则作废。
- 判断“是不是正式项目”看解析后的主机名（不分大小写；端口、用户信息、路径、前后空格都绕不过；网址解析不了就当作不安全，云端关闭）。
- 换项目后同一个邮箱可以在新项目正常登录，**只加载新项目自己的进度**。旧项目的账号副本和游客记录原样留在本机：不上传到新项目、不自动删除（数据隔离规则）。回到旧项目再登录，旧副本接着用。
- 换成别的邮箱登录，仍要先退出当前账号。
- 强制退出（有进度没上传）时本机副本保留，同一个账号重新登录时接着上传。
