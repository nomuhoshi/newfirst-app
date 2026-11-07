# retryAuthCleanup 的读取失败（基线 36dee61，分支 claude/auth-cleanup-read-failures）

## 问题（先在旧代码上复现）
`retryAuthCleanup()` / `hasLeftoverAuth()` 用的 `getCurrentAccount()` 和 `readAuth()` 都把「读取失败」折叠成 `null`：
1. **账号指针读取抛错 / 静默返回 undefined**：被当成「没有别的标签页在登录」，存储能删时就把另一个标签页正在用的凭证删了（R.1，旧代码 `ok:true` 且凭证被删）。
2. **页面重开后凭证读取失败**：`readAuth` 吞掉异常返回 null，`hasLeftoverAuth()` 为 false，`retryAuthCleanup()` 返回 `{ok:true, nothingToClean:true}`；界面把它显示成「已清理本机残留的登录凭证」（R.2、U.2）。
3. 存储里的凭证已被别的标签页换成另一份时（没有账号指针），仍会删（R.4b）。

## 修复
- `account-store.readCurrentAccount()`：三态读取 `{ok:true,id}` / `{ok:true,id:null}` / `{ok:false}`（抛错，或返回了既不是字符串也不是 null 的东西都算读取失败）。
- `sync.inspectAuth()`：凭证三态以外再区分 `absent`（确定没有）/ `read-failed` / `inert`（撤销标记或无法识别的内容）/ `other`（别的云端项目的凭证，绝不碰）/ `ours`。
- `hasLeftoverAuth()`：账号指针读不出来 → true（无法排除残留，让用户看到入口、点击时如实说明）；指针有账号 → false；凭证读不出来 → true。
- `retryAuthCleanup()`：
  1. 指针读不出来 → `{ok:false, kind:"read-failed"}`，不清理；指针有账号 → `logged-in`，不清理。
  2. 凭证读不出来 → `read-failed`，**不是** nothingToClean，保持残留标记。
  3. 存储里的已不是当时留下的那份（refresh token 不同）→ `changed`，不清理。
  4. 动手前再读一次指针（缩小和别的标签页登录之间的空档）。
  5. 清理成功要通过 `clearStoredAuthVerified()` 读回，并再用 `inspectAuth()` 读回一次确认已没有可用凭证；确认不了就是失败（`local`），保留标记。
  6. 只有读取正常且确实没有可清理的东西时才返回 `nothingToClean`，界面显示「没有发现需要清理的登录凭证」，不再显示「已清理」。
- 界面（`account-ui.js`）：`nothingToClean` 用单独文案；失败文案不再含「已清理」字样。

## 测试
- 同步层（`tests/login-sync-hardening.test.mjs` 新增 R 段，旧代码上 11 项红）：R.1 指针读取抛错/静默 undefined，R.2 凭证读取抛错/静默 undefined（页面重开）+ 恢复后清理成功，R.3 清理后读回失败不算成功，R.4 别的标签页有效登录不删，R.4b 凭证被换过不删，R.5 清理失败后重试，R.6 无残留，R.7 动手前指针刚出现。
- 页面层（`tests/account-cleanup-ui.test.mjs`，真实构建产物 + 假 Supabase，Chromium/WebKit；已加入 `tests/webkit/run.mjs` 的两个浏览器各跑一遍）：U.1 清不掉时入口出现、存储仍坏点击如实失败且入口保留、修好后再点成功并读回；U.2 重开后凭证读取失败时入口仍在、点击提示「无法读取」且不说已清理；U.3 别的标签页已登录时没有入口、直接调用被拒、对方凭证原样。旧代码上 U.2 红（入口根本不出现）。
- 变异测试：新增 8 项（指针读取失败当没有、凭证读取抛错当没有、静默 undefined 不算失败、`readCurrentAccount` 放过非字符串、不比对留下的凭证、动手前不再确认、读不出时不给入口×2），并重写 4 项因代码变化而过期的旧变异。

## 取舍与未验证
- 「清理后读回」有两层（`clearStoredAuthVerified` + 随后的 `inspectAuth`），只拆其中一层的变异抓不到，因为另一层仍兜底，故变异测试同时拆两层。
- 完全「撒谎的存储」（getItem 永远返回 null 但数据其实还在）从页面里无法发现，不在范围内。
- 真实 iPhone / 微信真机、真实 Supabase 未验证。WebKit 只在远端 CI 跑。
