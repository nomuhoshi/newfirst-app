# #94（K-CSP 两份构建）三次 CI 的分类

归档：Claude；分类：员工GPT1（07:28，07:30 补齐第 1 次原始日志核验）；第 2 次措辞按产品官 07:29 与 GPT1 07:30 统一。本文件只记录分类结论，不含 CI 原始日志（原始日志在对应 Actions 运行页）。

| 轮次 | Run ID | 结果 | 分类与原因 |
|---|---|---|---|
| 第 1 次（`91c1611`） | `43312158816` | 失败（build、mobile chromium、mobile webkit 三个 job 同因） | **测试代码变量作用域错误**：`tests/csp.test.mjs:108` 引用的 `EXPECT` 声明在 B 段块内，C 段不可见，抛 `ReferenceError: EXPECT is not defined`。修复：`ac3ace5` 移到顶层。 |
| 第 2 次（`3febbe0`） | `43313801120` | 失败（Chromium / WebKit 均复现） | **预期拦截事件统计边界错误（故意拦截事件混入正常运行基线）**：正式模式下故意访问 `fake.supabase.test` 的 CSP 拦截发生在 `before` 计数之后，被计入应用自然运行违规，使“应用自身运行时没有任何 CSP 拦截”断言误报；日志显示两引擎的正式 CSP 都成功拦截了该请求。与第 1 次的变量作用域错误是两个独立问题；第 1 次三个 job（build / mobile chromium / mobile webkit）失败位置都是 `tests/csp.test.mjs:108:3`，该轮 CSP 专项未能完整执行，不能据此判断正式 CSP 的安全性。修复：`206cc1e` 把基线记录移到任何故意拦截之前。 |
| 第 3 次 | `43315416600` | 全绿 | build、mobile chromium、mobile webkit 全部成功；PR 上的 deploy job 按条件跳过（符合预期）。 |

结论：
- I 整项仍保留“step3 导航超时直接原因未确认”的边界；本案例的教训是：安全测试要区分“应用自然产生的 CSP 违规”与“测试主动制造且预期被拦截的事件”。
- 前两轮失败都是**测试代码问题**，没有证据表明正式 CSP 被突破；没有删除或放宽任何断言。
- 合并后 main 运行 `43317705367` 的检查和 Pages 部署全部成功，正式版本 `9453683`（传话员 07:27 JST 核对：`main-qbybJTrv.js` 含该 SHA；CSP `connect-src` 只含 `'self'` 与正式 Supabase 域；不含 `fake.supabase.test`；`access-test.html` / `lab.html` / `access-test-config.js` 为 404）。
- 边界：CSP 专项中的云请求是 Playwright 本地拦截，不是真实 Auth 验收；WebKit 运行的是 CI 中的 WebKit 引擎，不等于 iPhone 真机。
