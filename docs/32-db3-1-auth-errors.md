# DB-3.1 退出异常处理（401/403/404 的判断；云端撤销后本机凭证清不掉）

基线：4c565d1b（DB-3.1 退出顺序）。分支：claude/db3-1-auth-errors。

## 官方实现依据（2026-11-06 核对源码）
- supabase-js / auth-js `GoTrueClient._signOut`：`admin.signOut` 返回错误时，**只要状态码是 404、401、403 就忽略**，继续清本机会话；其他错误直接返回、不清本机。
  注释写的是“404：用户可能已不存在；401：无效或过期的 JWT 应当退出当前会话”。它是按状态码，不看错误码。
- GoTrue（supabase/auth）`internal/api/logout.go`：处理函数自己只会返回 204 / 400（scope 非法）/ 500。**401、403、404 都不是它返回的，来自鉴权中间件**（`internal/api/auth.go`）：
  - 缺少 Bearer → 401 `no_authorization`
  - JWT 解析/验签/过期失败 → 403 `bad_jwt`
  - 令牌里的 session_id 在库里不存在 → 403 `session_not_found`
  - 令牌里的 sub 用户不存在 → 403 `user_not_found`
  - scope 为 local 时只 `LogoutSession(session_id)`；没有 session 会退化成全局登出（所以我们必须一直带 scope 和有效令牌）。
- 结论：官方客户端的“一律忽略 401/403/404”对 UI 友好，但我们要决定的是“云端会话是不是真的没了”。通用 403（权限拒绝、代理拦截）、网关 404（路由不存在）、5xx 都不能说明这件事。

## 判断规则（`cloud-api.signOut` 的 `sessionState`）
| 响应 | sessionState | 处理 |
|---|---|---|
| 403/401/404 + `session_not_found` / `user_not_found` / `session_expired` | gone | 会话已不存在 → 按已退出 |
| 403 + `bad_jwt`；或老版本无 error_code 的 401 且消息明确说 JWT/token 无效或过期 | token-invalid | 只说明访问令牌坏了：先用 refresh token 核实。refresh 被拒 → 会话已死 → 已退出；refresh 活着 → 新令牌写回存储，再 signOut 一次；仍失败或断网无法核实 → 失败 |
| 其他（通用 403 如 `not_admin`、代理 403、路由 404、`no_authorization` 401、400、429、5xx、断网） | 无 | 失败：回滚本机、保持登录、云端不动 |
刷新会轮换 refresh token，所以重试前必须把新凭证写回存储并更新回滚快照，否则回滚会恢复一份已作废的旧令牌。

## 云端撤销成功、本机凭证清不掉
- 云端撤销的是 refresh token（这个会话）。访问令牌（JWT）到期前仍然有效，所以**不再声称“已失效、不能再用”**。
- 返回 `warning:"local-auth-leftover"`、`authLeftover:true`、`accessTokenValidUntil`（令牌到期时间），消息写明“刷新令牌已失效，访问令牌最晚到 HH:MM 前仍可能有效，请再次清理”。
- 新增 `hasLeftoverAuth()` / `retryAuthCleanup()`：不联网；只在没登录且存储里没有当前账号指针时才清（别的标签页已登录同一份存储则拒绝，不会清掉在用的凭证）；清完读回确认才算成功；存储仍坏则如实失败、保留标记。登录弹窗在有残留时显示“清理本机残留的登录凭证”按钮。
- 页面重开后（没有内存标记）也能发现并清理。

## 保留的既有保护
`forceLocalLogout` 零网络；普通退出 scope=local；本机清理失败回滚且不联网；清理失败保留未上传副本；云端失败完整回滚；XP / runs 不重复累计（没有碰同步合并）。

## 测试
- 先写复现：旧代码上通用 403 与路由 404 被当成退出成功（P.2 forbidden / route404 红）。
- 登录专项新增 P.1–P.7b；假云端的 refresh token 改成一次性（旧令牌用过即作废，与真实 Supabase 一致），signOut 的失败形状由真实 `cloud-api` 翻译生成。
- 变异测试新增 10 项，更新 4 项旧项。

## 未验证
- 真实 Supabase 对 logout 的实际错误码（需 suipian-test 真云验收）；老版本 GoTrue 的无 error_code 401 是按消息文字判断的，文字变了就会当失败（偏安全）。
- “清理本机残留的登录凭证”按钮没有做浏览器级测试。
- 响应丢失但云端其实已撤销（O.6）的取舍不变。
- 不涉及 GPT1 的损坏待办补丁，没有改动其逻辑。
