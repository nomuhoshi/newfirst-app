# 40 第一版发布候选（release/v1-candidate）

更新：2026-11-10  
分支：`release/v1-candidate`，从 `fix/touch-targets @ a8d26c1` 开出，原分支保持不动。  
范围（产品官拍板）：U1–U5、代码题判题、邮箱登录、云端同步、已验收的触控修复。U6（#51）、U7（#48）、U8 不进第一版。  
约束：不合并 main、不部署正式站、不改正式 Supabase、不删除任何分支 / PR / 预览目录 / 文档。

## 1. 整合记录

| 来源 | 处理 | 提交 |
|---|---|---|
| `fix/touch-targets @ a8d26c1` | 基线 | — |
| #44 `1edd503` 登录同步加固（退出失败留登录、五次冲突停止、429 冷却） | **已在基线里，不再合**：DB-3 整合时以 `c002a89`（cherry-pick）和 `2eebb6a`（文档）带进来，见 docs/30。`1edd503` 新增的 30 条断言里 29 条在基线逐字存在；剩下 1 条“同一 lineage、本机代数更高 → 整份用本机”被 DB-3 有意换成更严的“本机代数更高一律不整份覆盖云端”（清单 12，SPEC 决策表 2026-11-06）。保留更严的规则。 | — |
| #49 `20c16cb` 端到端关键流程测试 | 原样挑入，无冲突 | `6223219` |
| #49 `0ba3c39` 代码题模块按需加载（首屏 JS 约 201→71 KB gzip） | 原样挑入，无冲突（不是 Pyodide 延迟加载；那个单独排期） | `3602c06` |
| #49 `2bad0cf` PWA：manifest、maskable 图标、robots.txt | 原样挑入，无冲突 | `8cc7ac9` |
| #49 `ceda6cd` Lighthouse 原始报告（约 5.8 万行 JSON） | **不带**：测的是旧基线 `8d897f8`，带进来是冗余。发布候选预览上重测 | — |
| #43 代码块保留缩进和空格（`c08d11e` + `43d1b39`） | 合成一个提交；`9c262d8` 只是删误提交的 `__pycache__`，这里本来没带进来。冲突：`window.__app` 基线已有 `startLesson`，用基线版本；空格回归测试进 `tests/webkit/run.mjs` 统一清单 | `c11cc0b` |
| #50 测试定位 dist 改用 `fileURLToPath`（`253c4fe`） | 挑入并扩大：基线比 #50 的底多 9 处旧写法（含 `npm test` 运行器 `scripts/run-tests.mjs`）一并改掉；路径回归测试同时检查 `scripts/`，接在 `test:chain` 第一条 | `1fa638c` |
| CSP | 新增，见 §2 | `a8d6c33^` |
| 隐私说明 | 新增，见 §3 | `a8d6c33` |
| 发布候选预览工作流 | 新增 `.github/workflows/v1rc-preview.yml`（推 `preview/v1rc` 触发，只连测试 Supabase，产物检查多了 CSP 和隐私页） | 本提交 |

## 2. 内容安全策略（CSP）

GitHub Pages 不能设响应头，所以由构建插件 `scripts/vite-csp-plugin.mjs` 给 `index.html` 插 `<meta http-equiv="Content-Security-Policy">`：

```
default-src 'self';
script-src 'self' 'sha256-<兜底内联脚本>' 'wasm-unsafe-eval';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:;
connect-src 'self' https://*.supabase.co;
worker-src 'self'; manifest-src 'self';
object-src 'none'; base-uri 'self'; form-action 'self'
```

- 脚本最严：没有 `'unsafe-inline'`、没有 `'unsafe-eval'`。内联的只有 index.html 那段“页面没加载出来”的兜底脚本，构建时按最终 HTML 现算哈希。
- `'wasm-unsafe-eval'`：Pyodide 编译 WebAssembly 需要。Pyodide 跑在模块 Worker 里，Chromium 不把页面 meta CSP 套到 Worker 上，但旧版 Safari 会，所以放行。
- `style-src 'unsafe-inline'` 是有意放宽：应用用 style 属性传动画时长、偏移、进度条宽度；CodeMirror 在旧版 Safari 会插 `<style>`。样式注入远不如脚本注入危险。
- `connect-src` 用 `*.supabase.co`，正式和测试项目都覆盖。比只写正式项目宽一点，但让同一份构建规则对正式 / 测试入口都成立。
- 测试：`tests/csp.test.mjs`（Chromium + WebKit）——在 CSP 下真 Pyodide 运行出结果、Supabase 请求放行、应用运行零拦截；注入的内联脚本、`eval`、发往别的网站的请求都被拦。其余所有浏览器测试也都在 CSP 下跑。

剩余风险：
- meta 里设不了 `frame-ancestors`，别的网站可以把本站嵌进 iframe（点击劫持）。本站危险操作（删账号、清记录）都有二次确认，风险低；要彻底解决需要能设响应头的托管（例如前面加 Cloudflare）。
- 登录凭证存在 localStorage，CSP 是防脚本注入的第二道墙，不是第一道；第一道仍是“只用 textContent，不拼 HTML”（`h()` 的约定）。

## 3. 隐私说明

`public/privacy.html`：静态页、不含脚本、自带 `default-src 'none'` 的 CSP、进离线缓存。入口：登录框底部、账号卡片、“我的”页底部（点按区域 44 高）。

**待老大确认后再上线：**
1. 联系渠道：暂写 GitHub Issues。若要用邮箱，告诉我地址。
2. 未成年人年龄线：暂写 14 周岁（中国个人信息保护法把不满 14 周岁的个人信息列为敏感个人信息）。
3. 邮件服务商：Resend 未定前写“邮件发送服务”。定了以后写名字。
4. Supabase 数据所在地区：页面没写地区。老大在 Supabase 后台 Project Settings → General 能看到 Region，需要的话补上。

## 4. 正式 Supabase：需要老大在后台操作的只读核查

这个环境连不上 `*.supabase.co`（代理拦截），也不应该拿任何非公开密钥，所以下面这些只能由老大在后台看。全部是**只看不改**。

| 项 | 在哪看 | 期望 |
|---|---|---|
| 表结构 / 行级安全 / 策略 / 权限 / 函数 | SQL Editor 粘贴 `supabase/check-readonly.sql` 运行 | 每段注释里写了期望值；和 `supabase/schema.sql` 一致 |
| Site URL | Authentication → URL Configuration | `https://nomuhoshi.github.io/newfirst-app/` |
| Redirect URLs | 同上 | 只包含正式站地址；不要有 `localhost`、预览仓库地址或通配 `*` |
| 邮箱登录方式 | Authentication → Providers → Email | Email 开启；用验证码（OTP）；Confirm email 按现行设置 |
| 验证码邮件模板 | Authentication → Email Templates → Magic Link | 模板里有 `{{ .Token }}`（应用要的是 6 位码，不是链接） |
| 发信限额 / SMTP | Authentication → Rate Limits、SMTP Settings | 自带发信限额很低；上线前要配自有 SMTP（等 Resend 域名决定，见 docs/38） |
| 是否允许注册 | Authentication → Settings | 允许新用户注册（第一版对外公开） |

## 5. 清理清单（只列清单，不删除；等老大单独授权）

远端现在 **135 条分支**（GitHub API 实数；之前盘点说 183 是本机残留的跟踪引用，不准确）、**30 个开着的 PR**。

### PR

| 分类 | PR | 理由 |
|---|---|---|
| **可关闭**（内容已在发布候选里） | #11 #16 #19 #20 #21 #22 #23 #24 #25 #38 #40 #41 | 分支是发布候选的祖先，代码全在 |
| **可关闭**（被发布候选取代） | #42 rc-1 | rc-1 是 `release/v1-candidate` 的祖先；第一版改走新分支。按现行约束保持 Draft，关不关由老大定 |
| **可关闭**（已整合） | #43、#50 | 已挑进发布候选（`c11cc0b`、`1fa638c`） |
| **可关闭**（已整合） | #44 | 内容早已以 `c002a89` 进基线 |
| **待确认** | #49 | 3 个代码提交已整合；剩 Lighthouse 原始报告和“Pyodide 延迟加载另排期”的讨论。程序员5 的线，等他确认 |
| **保留**（独立开发线） | #51 U6、#48 U7、#47 设计 v3、#35 新手流程、#29 体力制规格 | 产品官指定的后续线 |
| **待确认**（只有文档、base 是 main、从没合并） | #15 #26 #27 #30 #34 #39 #45 #46 | 调研 / 规格 / 团队文档。要么合进 main 的 docs，要么关掉；属于产品决定 |

### 分支（135 条）

| 分类 | 数量 | 说明 |
|---|---|---|
| 开着的 PR 的分支 | 30 | 跟 PR 一起处理 |
| 已完全包含在发布候选里（祖先） | 21 | 发布合并进 main 之后**可删除**（删了也能从 main 找回） |
| `preview-dist-*`（CI 产物分支） | 12 | 预览仓库已有拷贝；对应预览不用了就**可删除** |
| `preview/*`（触发预览构建） | 7 | 同上 |
| 其他、未合并 | 62 | **待确认**：多为已被后续分支取代的实验 / 临时分支（`ci-screenshots-*`、`tmp/*`、`wip/*`、`exp/*`、`content/u6-part*`、`content/u7-part1`、`test/u*-flow` 等）。`content/u8-part1`（U8）按产品官决定**保留** |
| `main`、`release/v1-candidate`、`fix/touch-targets` | 3 | **保留** |

### 预览仓库 newfirst-app-preview（177 MB，15 个目录）

| 分类 | 目录 |
|---|---|
| 保留 | `acc2`（当前验收）、`v1rc`（发布候选，待建）、`rc1`（约束：不碰） |
| 待确认（旧实验） | `exp-quick`、`exp-u3`、`fallback`、`ink-3d`、`pr11-design`、`access-check`、`acc1` |
| 待确认（内容预览） | `u6`、`u7`、`u8`：U6 / U7 改用 #51 / #48 后可能已过时 |
| 共用资源 | 根目录 `assets`、`pyodide`、`sfx` |

### 文档

- `docs/24`–`docs/37` 共 14 份是登录加固的过程记录：**待确认**，建议移到 `docs/archive/`，不删。
- `docs/28` 编号重复（两份不同名），`docs/20` 缺号：只记录，不改历史编号。
- `AGENTS.md` 停在 2026-11-03（写的是“11 关、330 项测试”）：发布前更新。

## 6. 需要老大操作 / 决定的事

1. iPhone Safari + 主屏幕 PWA 真机验收。
2. Resend 发信域名和正式 SMTP。
3. 第 4 节正式 Supabase 后台核查（只看）。
4. 第 3 节隐私说明 4 项确认。
5. 中国大陆访问、QQ / 163 邮箱收信验证。
6. 第 5 节清理清单的授权。
7. 最后说“合并”。
