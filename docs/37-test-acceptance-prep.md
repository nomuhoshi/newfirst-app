# 登录 / 同步 / 保存 测试版验收准备（分支 sonnet3/test-acceptance-prep）

基线：`claude/auth-cleanup-read-failures` @ aedba6b（已含 GPT1-003 v4，经 `sonnet3/integration-v4-authcleanup` @ 10c1636 核对无语义交叠，见 `docs/36-integration-v4-authcleanup.md`）。
范围：只改前端、测试和一个手动触发的 CI 工作流；**没有**改 `supabase/`、没有合并、没有部署正式站、没有碰正式库。

## 阶段一：损坏导入待办的恢复 + `retryAuthCleanup` 竞争窗口

### 恢复入口
- `sync.pendingRecoveryInfo()`：只读，返回 `corrupt | read-failed | healthy | none`。**读取失败（抛错 / 静默返回非字符串）永远不会被当成损坏**，界面只给“重试读取”。
- `sync.quarantinePendingImport({ expectedDigest })`（只在本机，**零网络**）：
  1. 只处理“确认损坏”的待办；完好 / 没有 / 读取失败 / 没登录一律拒绝。
  2. 对**同一份原文**判断损坏（`parsePendingImport(raw)`，不读两次）；用户确认时看到的摘要与现在不符 → 停。
  3. 备份：`suipian.acct.quarantine.<账号>.<原文摘要>`（以 `suipian.acct.` 开头，所以在测试云项目里自动带 `proj:<主机名>:` 前缀，**按云项目 + 账号**隔离）。写入后读回逐字比对；同一份原文重复隔离复用同一个备份；键里已有别的内容 → 拒绝覆盖。
  4. 删除前再核对一次：账号指针仍是这个账号、待办原文仍是这一份。被别的标签页换掉 → 立刻停，什么都不删。
  5. 删除后读回确认；删不掉 → `remove-failed`，原文和备份都保留。
  6. 游客记录、账号副本、登录凭证、账号指针**逐字节不动**（测试逐键比对）。
  7. 任何失败返回 `ok:false, originalKept:true`，文案不含“已备份并移除 / 已恢复”。
- `sync.resumeGuestImportChoice(baseState)`：隔离之后接回原来的选择流程。读最新云端 → 按指纹判断：已导入过 / 游客没有学习记录 → 不弹选择，做一次手动同步；否则返回 `needChoice`，之后走同一条 `finishChoice`。覆盖：有账号副本 + 云端未导入 / 云端已导入过 / 游客有新进度，三种结果都与“从没损坏过”的对照组**云端文档逐字一致**（没重复加分、没丢数据）。
- 顺手修了一个真实隐患：重新选择弹窗挂起期间，令牌进入刷新窗口时旧会话对象会被拿去联网、并在收尾时写回存储。现在 `finishChoice` 先 `ensureToken()` 再取当前会话（Q20 抓得到，变异也抓得到）。
- 界面（`account-ui.js`）：账号卡片里 `corrupt` 显示“备份并重新导入”（先确认再执行），`read-failed` 显示“重试读取”。隔离成功后自动打开选择弹窗；任何失败只 toast 失败原因。
- **固定指纹黄金样本**（Q0）：固定游客样本 → 指纹 `e1962bd5`、固定待办原文解析为完好、固定原文摘要 `9-6abfc5355e48142a`。指纹算法一变，R1 的“指纹必须匹配”会把升级前留下的旧待办判成损坏并永久锁死，这条测试会红。

### `retryAuthCleanup()` 最后一次检查 → 删除的竞争窗口
- 旧实现（aedba6b）：先读账号指针（`p2`）→ 调 `clearStoredAuthVerified()` 盲删 `suipian.auth`；删不掉时还会写“撤销标记”覆盖。如果另一个标签页恰好在两步之间登录，会**删掉对方刚写的有效凭证，或用撤销标记覆盖它**。可复现（`tests/auth-cleanup-race.test.mjs` A2–A5 在 aedba6b 上 4 项红）。
- 新实现：`clearLeftoverAuthIf(expectRaw)`——只删“刚检查过的那一份原文”；删之前、写撤销标记之前都再读一次，已不是那一份 → 返回 `kind:"changed"`，不动对方的凭证；“残留”标记保留，对方登出后可以再清。
- 仍存在的极小空档：浏览器没有跨标签页的原子“比较后删除”，比对读取和随后的 `removeItem` 之间在理论上还有一个同步语句的间隔。靠前后双重读取和 `changed` 返回把它压到最小，没有办法完全消除（要做到需要 Web Locks 覆盖登录写入，改动面太大，没有做）。

### 与 aedba6b 的交叠核对
`sync.js`、`account-store.js`、`account-ui.js` 的修改点逐段核对：aedba6b 的 `inspectAuth / hasLeftoverAuth / retryAuthCleanup` 只被改了“清理这一步”（并让 `inspectAuth` 多返回原文）；12 条变异（重写 4 + 新增 8）原样保留，其中 1 条因代码形状变化改写了 `from`（“再次清理不读回确认就宣称成功”），仍被抓到。`tests/webkit/run.mjs` 里 `account-cleanup-ui` 与新增的 `pending-quarantine-ui`、`preview-info`、`sync-two-tabs-browser` 都在列表里。

## 阶段二：测试入口（只供 suipian-test 的独立预览）
- 构建期校验 `scripts/preview-cloud-check.mjs`（`vite.config.js` 构建开始时执行，错了**构建失败**，不再静默变成“云端关闭”）：
  - 宽松（默认，自动测试用）：指向正式项目 / 网址解析不了 / 只给网址不给密钥（或反过来）/ 拿了 secret 或 service_role 密钥 → 失败。
  - 严格（`REQUIRE_TEST_CLOUD=1`，测试预览 CI 用）：必须 `https://<20 位项目编号>.supabase.co`、公开密钥、旧版密钥里的项目编号与网址一致、与 `EXPECTED_TEST_PROJECT_REF` 一致、没给云配置也失败、必须有 40 位源码提交号。
  - 构建日志打印 `云端：测试云项目 <编号> | 源码提交：<SHA>`；日志和产物里都不含密钥。
- “我的”页的**测试入口信息**面板（`src/preview-info.js`，正式构建不创建）：测试入口名、完整源码 SHA、构建时间、云项目主机名和编号、账号、同步状态、最近确认同步时间（只在内存里，重开页面重算）、有无待上传、游客导入待办状态、网络。**只读展示，没有任何按钮**；没有加“清空站点数据”之类的入口。节点带 `data-sha` / `data-cloud-host` 方便自动核对。
- 存储与缓存隔离沿用原机制（`PREVIEW_ID` 前缀）；`preview-info.test.mjs` 里加了“本地存储真实键全部带 `acc:` 前缀”的断言。
- 工作流 `.github/workflows/preview-test-cloud.yml`：只能手动触发；严格模式构建；核对产物（SHA、缓存前缀、云主机名、无 secret）；写 `SOURCE_SHA.txt` / `PREVIEW_INFO.json`；推到分支 `preview-dist-<id>`。云配置只读仓库变量 `TEST_SUPABASE_URL` / `TEST_SUPABASE_ANON_KEY`（公开密钥）。

## 测试清单（新增 / 变化）
| 测试 | 项数 | 说明 |
|---|---|---|
| `pending-import-quarantine.test.mjs` | 21 | 隔离、失败路径、标签页替换、命名空间、三种云端状态 × 与对照组一致、令牌轮换、黄金样本 |
| `auth-cleanup-race.test.mjs` | 5 | 竞争窗口；aedba6b 上 4 项红 |
| `pending-quarantine-ui.test.mjs` | 21 | 真实构建 + 假 Supabase（Chromium + WebKit） |
| `preview-cloud-check.test.mjs` | 9 | 构建期校验与面板文案（纯函数） |
| `preview-info.test.mjs` | 27 | 真实构建：错配置构建必失败、日志、产物、面板内容、请求只去测试项目、存储前缀、正式构建无面板（Chromium + WebKit）；旧 `vite.config.js` 上 15 项红 |
| `sync-mutation.test.mjs` | 71 → 88 | +15 个恢复 / 竞争变异，改写 1 个过期变异 |

## 未验证 / 已知限制
- 真实 Supabase、iPhone / iPad / 微信内置浏览器真机。
- 隔离备份只存在本机 localStorage，没有“导出备份”界面；人工取回要靠开发者工具（`suipian.acct.quarantine.<账号>.<摘要>`）。
- “最近确认同步”只在内存里，重开页面后从头算（有意不新增存储键）。
- 竞争窗口的理论残余见上。
