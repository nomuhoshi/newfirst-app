# 损坏导入待办的恢复流程 + 真云验收测试入口：审计（基线 f9d8c823）

分支：sonnet3/recovery-and-cloud-entry（只含本文档和 scripts/probes/，没改 src/）。复现：`node scripts/probes/recovery-probe.mjs`、`node scripts/probes/recovery-sim.mjs`（真实 sync/account-data 代码 + 假存储 + 假云端，不联网）。

## 一、恢复流程：锁得住，但没有出口（P1）
R1 只负责「锁定与保全」。界面文案写「等待恢复处理」，**代码里没有任何恢复入口**（公开 API 无 recover/repair/reset/discard 类函数；`clearPendingImport` 只在导入成功和删号成功后被调用）。实测（recovery-probe）：

| # | 操作 | 结果 |
|---|---|---|
| S1 | 锁定后 syncNow | `import-corrupt`，零云端调用；永远如此 |
| S2 | 锁定后 deleteAccount | 被拦（`import-corrupt`），连删号都不行 |
| S3 | 强制本机退出 → 同账号重新登录 | 登录成功，但状态立刻回到 `import-recovery-required`，待办原文还在，syncNow 仍被拦 |
| S4 | 本机无账号副本 + 有游客学习记录 + 损坏待办，登录后选「合并」 | `finishChoice` 返回 `kind:"local"`，文案「游客导入待办损坏」，游客记录保留但永远导入不了 |

后果：这台设备/浏览器一旦出现损坏待办，**永远不能再同步**，只能手动清站点数据——而测试入口与正式站同在 github.io 域名，清站点数据会连正式站的本机游客记录一起清掉。

### 安全的恢复动作存在，现有幂等机制扛得住（recovery-sim）
把「隔离备份损坏原文 → 清掉待办」当作恢复动作（这里用 removeItem 模拟，尚无 API），再走正常登录：
- R-a 云端没有这次导入：重新弹出选择；选「合并」后云端 XP = 云端原有 50 + 游客 90 = 140，连续同步两次不变；游客在读回校验后才清。
- R-b 云端其实已导入过（上传成功但待办没来得及清）：不再弹选择，云端 XP 仍是 140（不是 230），游客记录保留。
→ 隔离后重新选择不会重复加 XP，也不会丢游客进度，前提是**原文先备份、游客记录不动**。

### 建议（未实现，等指令）
1. `sync.quarantinePendingImport()`：仅在 `importGuard()` 为真时可用；把损坏原文复制到 `suipian.acct.import.<uid>.quarantine.<时间>`（读回确认后）再删除原键；复制失败则不删；只在本机，不联网；成功后状态回 pending 并让下次登录/同步重新走导入选择。UI 在「游客导入待办需要恢复」弹窗里加「备份并重新导入」按钮，文案说明会保留备份。
2. 区分两种锁：`import-read-failed`（存储读取失败，多半是临时的）不应走隔离，只提示重试；`import-corrupt` 才允许隔离。
3. 风险观察项：R1 新校验要求 `guestFingerprint(guestState) === fingerprint`。若以后改了指纹算法，升级时仍存在的旧待办会被判损坏并永久锁定。建议加一条「固定游客样本 → 固定指纹」的黄金值测试，任何算法变动都会红。

## 二、真云验收测试入口：缺口（对照 docs/23）
已具备且有测试：测试入口 `PREVIEW_ID` 本地存储前缀隔离；`TEST_SUPABASE_URL/ANON_KEY` 仅构建时注入；网址是正式项目（大小写/端口/用户信息/多余路径都认）或解析不了 → 云端关闭（tests/cloud-config.test.mjs）。

缺口（grep 证实）：
1. **页面里没有构建提交号。** docs/23 B.1 写「页面里的构建提交号等于 SOURCE_SHA.txt」，但页面只显示构建时间（`__BUILD__`），源码里没有 SHA 注入；SOURCE_SHA.txt 只在 pr11-preview.yml 里写进产物。没有这一项就无法确认 iPhone/iPad 跑的是哪个提交（Gemini 的验收表也依赖它）。
2. **构建日志不打印云端模式。** docs/23 写「构建日志会打印云端模式」，但 vite.config.js 和 scripts/ 里没有任何这类输出。构建时给错/漏了变量只会静默变成「云端关闭」，要等真机打开才发现。
3. **页面不显示连的是哪个云项目。** 诊断区只有版本/缓存/离线/音频；没有「云端：<主机名第一段> / 关闭」，也没有最近同步时间、待办/脏标记、导入锁状态。iPhone 上没有开发者工具，验收人无法确认是否连到 suipian-test、是否真的同步过。
4. **没有只清测试入口数据的入口。** 反复验收需要回到初始状态，现在只能清整个域名的站点数据，会波及正式站（见上）。preview-storage 的 shim 已有按前缀的 `clear()`，缺一个界面入口（仅测试入口构建显示）。
5. **docs/23 验收 #7（另一个邮箱被拒）依赖「关闭公开注册」**，我在 suipian-test 里只核对到了 23（现有用户邮箱已确认），21/22 我这边没能核对。

建议顺序：先做 1+3（一个 `__SOURCE_SHA__` define + 诊断区几行），再 2（构建后断言：PREVIEW_ID 构建的云端主机名 = 期望的测试项目，否则构建失败），最后 4。以上都是前端展示/构建检查，不碰云端数据。
