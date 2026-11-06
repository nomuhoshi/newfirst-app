# DB-2 业务逻辑独立审查（Sonnet，分支 claude/db2-unblock）

审查范围：`src/sync.js`、`src/account-data.js`、`src/account-store.js` 的“游客导入”路径。方法：逐条读代码 → 写对抗测试（`tests/login-sync-hardening.test.mjs` K 段，共 +45 项）→ 故障注入（`tests/sync-mutation.test.mjs` 新增 5 项，共 21）。

| # | 核对项 | 结论 | 依据 |
|---|---|---|---|
| 1 | 保留云端写失败后的状态、专用重试、游客保留 | Go | K.1（network/server/auth 三类失败；强制退出后同账号重登自动重试；待办期间游客又学习；换邮箱不执行别人的待办） |
| 2 | 安全合并上传失败 / 读回失败 / 不一致的 pending 与 dirty | Go（含 1 处修复） | K.2、K.2b（创建路径 lineage 不变）、J.4/J.5；失败时 dirty.content=true，红心 / 设置 dirty 不丢，重试期间改红心也保留 |
| 3 | 旧 imported=true 不覆盖待上传新指纹 | Go | K.3（mergeDocs 两个参数顺序）、K.3b（重试遇别的设备写入 + CAS 冲突，最终是字符串指纹） |
| 4 | 重试成功后 XP / 次数 / 日期不重复，游客最多删一次 | Go | K.4A/B/C（待办清除失败、游客删除失败、清除后游客又学习）、K.6（clearGuestAfterVerified 最后一道防线直接单测） |

## 发现并修复
`finish()`：安全合并已写云并读回一致，但“游客记录删除失败 / 待办清除失败”时，`pending=true` 且待办还在，状态却显示 **已同步**。
改为：`result.pending` 为真时 `setStatus("pending", …)`。（`syncOnce` 路径本来就是 pending，不用改。）重试触发点（上线、回到前台、60 秒轮询 `status().pending`）都用同一个 `pending` 变量，不受影响。

## 已知、不改的边界
- 两个不同的字符串指纹冲突时，合并取云端的；本机副本在验证成功之前从不保存新指纹，所以这个情况只在“另一标签页刚导入过同一游客”时出现，取云端是对的。
- 损坏的专用待办：不静默当成“没有”，同步明确失败、原文保留（K.5）。需要用户界面提供“放弃这条待办”的入口才能恢复，属于 DB-3 的 UI 范围。
- 仍未验证：真实 Supabase（RLS、邮件）、真机 iPhone / 微信。
