# DB-3.1：退出顺序与 Supabase 会话撤销

基线：98abe0ad885335941de76e6a5f46c88466e8b4d9（未修改）。分支：claude/db3-1-logout-order。

## 问题
旧顺序是「先 `signOut`（云端撤销 refresh token）→ 再清本机」。撤销不可逆：若本机清理随后失败，
代码能恢复本机指针/副本，却恢复不了云端会话。另外 `POST /auth/v1/logout` 没带 scope，
Supabase 默认 `global`，会把用户其他设备的会话一起踢掉。

## 新顺序（原则：先做可回滚的本机步骤，最后才做不可逆的云端撤销）
普通退出：
1. 先把未上传的进度同步出去（失败则留在登录态）。
2. 取得有效 token（非认证类失败则留在登录态）。
3. 本机清理：删副本/指针（带快照）。失败 → 回滚，**不碰云端**，返回 `ok:false, kind:"local", cloudUntouched:true`。
4. `signOut(scope=local)`。失败 → 回滚本机（副本、指针、凭证原样恢复），仍是登录态，返回 `ok:false, stayed:true`。401/403/404 视为会话本来就失效 = 成功。
5. 云端已撤销后才清本机凭证并读回校验；清不掉只告警（`warning:"local-auth-leftover"`，凭证已无效且写入撤销标记），退出仍算成功。

`forceLocalLogout`：纯本机，零网络；云端会话可能仍有效，返回 `cloudSessionMaybeValid:true`；有未上传副本则保留。
`force`（强制退出）：先本机清理（失败即回滚且不联网），再尽力 `signOut(scope=local)`；云端失败不阻塞，标 `cloudSessionMaybeValid`。

## scope
`cloud-api.signOut(session, scope="local")`，默认 `local`，只有显式传 `global`/`others` 才放行，其余值一律降为 `local`。
正常退出只结束当前设备的会话，不影响其他设备。

## 测试
- fakeCloud 真正模拟 refresh token 撤销（按会话 sid；被撤销的 sid 刷新时报 Invalid Refresh Token；`global` 撤销该用户全部、`local` 只撤当前、`others` 撤其他）。
- 新增 O.1–O.10：其他设备会话存活、本机删除失败、凭证写入失败、云端已退出但本机失败、signOut 失败、响应丢失、401、forceLocal 零网络、scope 参数。
- 变异测试新增 7 项并更新 3 项旧项；Case 7a 断言改为空值安全，副本被误删时会变红而不是抛异常。

## 未验证
- 真实 Supabase 上 `scope=local` 的实际表现（需 suipian-test 真云验收）。
- 响应丢失但云端其实已撤销（O.6）：客户端保持登录并保留进度，之后 token 过期会诚实地提示重新登录，不丢数据。
- iPhone / 微信真机、UI 提示文案的实际显示。
- `test:db` 只在本地临时 PostgreSQL 跑，不在 CI。
