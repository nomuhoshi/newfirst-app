# G-LOGIN-17 登录加固收口记录

- 基线：`19c966319b143783d51b6d5f34d3c7cd59d182dc`（PR #158 的 squash 合并提交）。
- 记录时间：2026-11-25 23:09 JST。这是固定版本快照；后续状态以对应 PR、提交和 Actions 页面为准。
- 结论：本轮登录代码加固可收口；当前没有已确认、尚未闭环的新 P1/P2。当前基线的真实邮件／后端联调和 iPhone 实机验收仍待补充。
- 文档范围：归档已合并修复、证据来源、平台限制与待验收事项。本记录不改变任何产品开关、账号开放决定或生产配置。

## 一、证据来源和本次执行范围

“本次”专指 G-LOGIN-17 文档整理，不能用来否定此前已经执行的测试或历史联调。

| 证据层级 | 本次核查与已知结果 | 边界 |
| --- | --- | --- |
| GitHub 仓库及 Actions 元数据 | GPT1 本次读取基线文档、`src/sync.js`、PR #145～#158 的最终 HEAD／合并信息，以及表中 14 次 PR CI 和 main CI 的任务结论；HEAD 逐项匹配 | 本次未逐行重读全部历史 CI 日志；任务级 success 不代表每种现实场景都已覆盖 |
| 历史本地测试 | 本聊天的 GPT1 历史终审记录：G15 为 21/21、变异对照＋13 项；G16 为 24/24、变异对照＋14 项 | 这些是此前目标版本的执行记录；G17 未重跑 Node、构建或浏览器产品测试 |
| CI 双浏览器 | 下表每次 PR CI 的 `build`、`mobile (chromium)`、`mobile (webkit)` 均 success，`deploy` 均 skipped | Chromium／WebKit 自动化不等于真实 iPhone Safari、主屏幕 PWA 或生产服务验收 |
| 线上静态产物 | 传话员 2026-11-25 22:59 JST 回执：Pages `8058943658`；`assets/main-C8Cu-5EI.js` 含 `19c9663`，旧 SHA 已不在；正式 `codeTasksEnabled=[]` | GPT1 本次未重新下载线上包，未连接生产账号或数据库；此项按传话员回执归档 |
| 真实服务与真机 | 本批修复在当前基线上的新增真实服务／iPhone 验证未执行 | 历史测试项目联调记录单独保留，不能据此放行当前基线的所有真实场景 |

Gemini 的原始文档起草仅依据传话员材料，未读取 raw 链接、未执行命令；本修订版补入了 GPT1 的远端只读核查。文档补丁校验另随交付结果记录，不能登记成产品测试通过。

## 二、任务与 PR 同头 CI 对照

以下“审查 HEAD”为已合并 PR 的最终 HEAD，均以完整 SHA 记录。本次已核对相应 `pull_request` 运行的 `head_sha` 与该 HEAD 一致，且三项必需任务成功。每一行的部署任务均为 skipped。

G-LOGIN-01、G-LOGIN-02 的编号映射：**2026-11-26 程序员 Sonnet 在仓库内核查，无法证实**。已查：全部 PR 标题与正文（含 #136–#145）、全部提交信息、GitHub 搜索、仓库文档，均没有出现 “G-LOGIN-01／02” 字样；该编号只在 GPT1 的任务单里出现过，仓库里没有留痕。因此下表这两行**不指定 PR**，只列编号在 G-LOGIN-03 之前、同属登录加固且已合并的 PR 作线索（线索不等于映射）：#136（请求超时覆盖响应正文）、#137（验证码对了但读云端失败保留会话）、#140（旧同步迟到结果隔离）、#141（同步遵守 429）、#142（重试读取遵守 429）、#143（重复退出合并）、#144（删除请求绑定会话）。其中 #143、#144 与 G-LOGIN-03 的基线说明（#145 正文：“基线 main 099c6c0（#144 已合并）”）直接相连，是最可能的对应，但仍需 GPT1 任务单或老大确认，不得据此宣称。

| 任务与修复范围 | PR | 最终审查 HEAD（完整 SHA） | main 合并提交（完整 SHA） | PR 同头 CI | 合并时间（JST） |
| --- | --- | --- | --- | --- | --- |
| G-LOGIN-01 | 仓库内无证据，无法映射 | — | — | — | — |
| G-LOGIN-02 | 仓库内无证据，无法映射 | — | — | — | — |
| G-LOGIN-03：跨标签页登录失权与迟到结果隔离 | [#145](https://github.com/nomuhoshi/newfirst-app/pull/145) | `d98636ba5bec173663dcbb3a2dedc9288fb8e7ef` | [`d48a6e7e78f7db32ee16f65b93a0ea1f6f21e21e`](https://github.com/nomuhoshi/newfirst-app/commit/d48a6e7e78f7db32ee16f65b93a0ea1f6f21e21e) | [44810778473](https://github.com/nomuhoshi/newfirst-app/actions/runs/44810778473) | 2026-11-21 05:47:35 JST |
| G-LOGIN-04：恢复游客导入选择的迟到结果隔离 | [#146](https://github.com/nomuhoshi/newfirst-app/pull/146) | `3c5b53b6ed5b6d8aca9acec393cef679f0f9b5e4` | [`235d40e954fa002730a23426b70d0c7f67175fee`](https://github.com/nomuhoshi/newfirst-app/commit/235d40e954fa002730a23426b70d0c7f67175fee) | [44820889138](https://github.com/nomuhoshi/newfirst-app/actions/runs/44820889138) | 2026-11-21 07:16:58 JST |
| G-LOGIN-05：会话恢复失败分类与重试 | [#147](https://github.com/nomuhoshi/newfirst-app/pull/147) | `2e01fb9276d76fcb71afefd3cf0735a1832e2b44` | [`a14b432003708cdbf1f73d1c3f1cb916eac94540`](https://github.com/nomuhoshi/newfirst-app/commit/a14b432003708cdbf1f73d1c3f1cb916eac94540) | [44841851637](https://github.com/nomuhoshi/newfirst-app/actions/runs/44841851637) | 2026-11-21 09:47:30 JST |
| G-LOGIN-06：发送／重发验证码冷却分类 | [#148](https://github.com/nomuhoshi/newfirst-app/pull/148) | `d7e87e539158a58c46fa7155c1b9011ba084ae45` | [`96f8c773afac56af8126addbdc66f2c50f051033`](https://github.com/nomuhoshi/newfirst-app/commit/96f8c773afac56af8126addbdc66f2c50f051033) | [44851995473](https://github.com/nomuhoshi/newfirst-app/actions/runs/44851995473) | 2026-11-21 11:14:22 JST |
| G-LOGIN-07：验证码输入与关闭／取消生命周期 | [#149](https://github.com/nomuhoshi/newfirst-app/pull/149) | `ef5e0caad6043fbdeef4b270e4da6ffc13968a40` | [`d6d3d2ecf6cb371583c1da137444289c57fe8f54`](https://github.com/nomuhoshi/newfirst-app/commit/d6d3d2ecf6cb371583c1da137444289c57fe8f54) | [44860497496](https://github.com/nomuhoshi/newfirst-app/actions/runs/44860497496) | 2026-11-21 13:10:29 JST |
| G-LOGIN-08：通用 429 提示纠正 | [#150](https://github.com/nomuhoshi/newfirst-app/pull/150) | `6b832277e688d8a60b7164db0aa3e7762f7bf37d` | [`79481e8462c6ae61e28425cf01475679fc494e53`](https://github.com/nomuhoshi/newfirst-app/commit/79481e8462c6ae61e28425cf01475679fc494e53) | [44868537498](https://github.com/nomuhoshi/newfirst-app/actions/runs/44868537498) | 2026-11-21 14:41:23 JST |
| G-LOGIN-09：控制台白名单收紧（仅测试） | [#151](https://github.com/nomuhoshi/newfirst-app/pull/151) | `80def8b186dbffbe33a615468c96c89aad6a7dab` | [`f811f38f8fb2d4ffcf463601a0b686b3f97ecf26`](https://github.com/nomuhoshi/newfirst-app/commit/f811f38f8fb2d4ffcf463601a0b686b3f97ecf26) | [44875461006](https://github.com/nomuhoshi/newfirst-app/actions/runs/44875461006) | 2026-11-21 16:09:49 JST |
| G-LOGIN-10：同步冷却状态栏分类 | [#152](https://github.com/nomuhoshi/newfirst-app/pull/152) | `d1a7fae236ce215b01e4f8459c550d13fd86fae6` | [`bbe36b7f5e55c73db2987994c7e5f073b4958c1c`](https://github.com/nomuhoshi/newfirst-app/commit/bbe36b7f5e55c73db2987994c7e5f073b4958c1c) | [44886607960](https://github.com/nomuhoshi/newfirst-app/actions/runs/44886607960) | 2026-11-21 18:10:29 JST |
| G-LOGIN-11：恢复选择弹窗生命周期与按钮渲染 | [#153](https://github.com/nomuhoshi/newfirst-app/pull/153) | `475d0896f1d05f5d12c71f04b7e43ae0b1a09f34` | [`d79b7359cbdccc2b99f33061bf8b117cd19f0ae3`](https://github.com/nomuhoshi/newfirst-app/commit/d79b7359cbdccc2b99f33061bf8b117cd19f0ae3) | [45484913716](https://github.com/nomuhoshi/newfirst-app/actions/runs/45484913716) | 2026-11-25 06:20:34 JST |
| G-LOGIN-12：当前会话删除响应丢失时提示结果未知 | [#154](https://github.com/nomuhoshi/newfirst-app/pull/154) | `bede9574f9ac640ba045b62bb7aa85956c16884e` | [`0cf6645a644f04db1880a8d6560bc5760fd8a06c`](https://github.com/nomuhoshi/newfirst-app/commit/0cf6645a644f04db1880a8d6560bc5760fd8a06c) | [45504723962](https://github.com/nomuhoshi/newfirst-app/actions/runs/45504723962) | 2026-11-25 08:57:07 JST |
| G-LOGIN-13：游客导入使用刷新后的会话并隔离失权结果 | [#155](https://github.com/nomuhoshi/newfirst-app/pull/155) | `64ad943ed72e9446c4089513f6891a62c979ace6` | [`2360a218de41e113dc78e6f9b867c46b92016adb`](https://github.com/nomuhoshi/newfirst-app/commit/2360a218de41e113dc78e6f9b867c46b92016adb) | [45546484332](https://github.com/nomuhoshi/newfirst-app/actions/runs/45546484332) | 2026-11-25 13:52:45 JST |
| G-LOGIN-14：同页并发刷新去重 | [#156](https://github.com/nomuhoshi/newfirst-app/pull/156) | `07decdd0cd5998bf9f03bf3b7706cde72fb7cac6` | [`a16abd9fd1f3a13ab1ace59197f92b57e91b32fc`](https://github.com/nomuhoshi/newfirst-app/commit/a16abd9fd1f3a13ab1ace59197f92b57e91b32fc) | [45562269941](https://github.com/nomuhoshi/newfirst-app/actions/runs/45562269941) | 2026-11-25 16:20:41 JST |
| G-LOGIN-15：跨页刷新协调、有限排队与撤销 | [#157](https://github.com/nomuhoshi/newfirst-app/pull/157) | `a837f0997492ba70a1ea8568d724aa30644058ec` | [`e0507dd4b29e86e524d51e82b62b7390f66ae1dc`](https://github.com/nomuhoshi/newfirst-app/commit/e0507dd4b29e86e524d51e82b62b7390f66ae1dc) | [45594685646](https://github.com/nomuhoshi/newfirst-app/actions/runs/45594685646) | 2026-11-25 20:37:09 JST |
| G-LOGIN-16：刷新锁异常收尾登记清理 | [#158](https://github.com/nomuhoshi/newfirst-app/pull/158) | `72de75dac5ceff4958b2499037e5253559d4ea49` | [`19c966319b143783d51b6d5f34d3c7cd59d182dc`](https://github.com/nomuhoshi/newfirst-app/commit/19c966319b143783d51b6d5f34d3c7cd59d182dc) | [45615065418](https://github.com/nomuhoshi/newfirst-app/actions/runs/45615065418) | 2026-11-25 22:09:43 JST |

表中修复范围依据已合并 PR 与历史审查记录归档；“已合并＋CI 成功”不替代真实邮件、真实令牌轮换／限流及真机验收。

## 三、main CI、部署和线上回执

| 项目 | 记录 | 来源 |
| --- | --- | --- |
| 固定基线 | `19c966319b143783d51b6d5f34d3c7cd59d182dc` | GPT1 本次 GitHub 只读核对 |
| main CI | [45620765467](https://github.com/nomuhoshi/newfirst-app/actions/runs/45620765467)，`head_sha` 等于上述基线；build、mobile (chromium)、mobile (webkit)、deploy 全部 success | GPT1 本次读取运行及任务元数据 |
| Pages | `8058943658` | 传话员 2026-11-25 22:59 JST 回执，本次未独立读回部署详情 |
| 线上资源 | `assets/main-C8Cu-5EI.js` 含 `19c9663`；旧 `72de75d`、`e0507dd` 已不在；`codeTasksEnabled=[]` | 同上，本次未重新下载线上包 |

**两次 CI 的对象不同：** PR #158 的同头 CI 是 [45615065418](https://github.com/nomuhoshi/newfirst-app/actions/runs/45615065418)，绑定 `72de75dac5ceff4958b2499037e5253559d4ea49`，deploy skipped；main CI 是 [45620765467](https://github.com/nomuhoshi/newfirst-app/actions/runs/45620765467)，绑定 `19c966319b143783d51b6d5f34d3c7cd59d182dc`，deploy success。

## 四、历史真实服务证据与当前基线待验收项

[原产品官交接文档](./50-product-officer-handoff.md) 的 2026-11-16 历史快照已登记测试项目的 OTP／Turnstile E1～E5 联调通过，包括正常收码登录、重发、过期／旧验证码及组件失败分支；该快照也记录真实限流现象。G17 未重新核实这些历史联调，不将它们改写成“从未验证”，也不将它们外推为当前基线或正式项目的全链路验收。

当前基线仍需补充以下证据；未执行时继续标为待验证，不以自动化替代：

- 真实邮件链路：邮件 App 切换、验证码送达与垃圾箱、重发及过期流程。Gmail／QQ／163 的当前基线完整验收未在本次核验。
- 真实认证与云端链路：会话恢复、令牌轮换、并发刷新、跨页共享凭证、游客导入、同步冲突及删除响应不确定时的端到端表现。本单不连接生产服务执行这些操作。
- 真实网络：服务实际返回的 429／Retry-After、正文中断、离线后恢复与长时间后台后的会话表现。
- iPhone Safari：验证码自动填充、键盘与视口、多标签页、退出／重登／删除交互。
- 主屏幕 PWA：独立窗口与 Safari 的存储／会话实际关系、重开和后台恢复。
- 真实锁屏／冻结：锁屏、切邮件 App、系统冻结与恢复时的定时器、排队请求和界面状态。

## 五、继续保留的平台与实现边界

以下刷新协调行为已由基线源码及 G15／G16 审查核对；真实设备表现另验：

- **没有 Web Locks：** 退回同一 `createSync` 实例的在途刷新去重，不保证跨标签页只刷新一次。
- **有锁接口但锁请求在进入获锁回调前抛错／拒绝：** 返回可重试本机错误，不绕锁调用刷新；G16 清理该请求的排队登记。它与“没有 Web Locks”的降级路径不同。
- **排队期限：** 默认 20 秒；超时或本页代次变化撤销尚未获锁的请求。即使锁实现不认 signal，`closed` 也阻止迟到回调联网。等待页自身被系统冻结时，其定时器何时执行仍需真实浏览器生命周期证据。
- **普通退出：** `wait=false` 路径使用 `ifAvailable`，未获锁时沿既有退出路径处理；不能据此声称所有退出刷新也具备跨页去重保证。
- **冻结测试边界：** Node 门闩模拟和 CI 双页 Web Locks 专项不等于系统真实冻结／解冻测试。
- **冷却边界：** 同步／发码冷却的页内状态不构成刷新页面或跨标签页共享冷却的保证；真实服务的限流策略未由本批假接口测试证明。

## 六、仍开放的旧登录相关 PR

状态由 GPT1 本次读取 GitHub 元数据核对；2026-11-26 程序员 Sonnet 已逐项比对（见下表末列），结果以末列为准。关闭只写说明，不删分支、不删历史。同日另按同样标准关闭了 #21、#22、#23、#24、#25、#38（其提交均已在 main），不属登录范围，此处仅留记录。

| PR | 标题／摘要 | 状态 | 与当前 main 的覆盖关系 |
| --- | --- | --- | --- |
| [#41](https://github.com/nomuhoshi/newfirst-app/pull/41) | “进度已在别的设备被替换”提示与双页／跨设备测试 | OPEN，Draft，未合并 | **2026-11-26 已关闭**：其提交已全部在 main（`git cherry` 无独有提交），PR 上留有说明，分支保留 |
| [#44](https://github.com/nomuhoshi/newfirst-app/pull/44) | 退出失败留登录、冲突停止重试、429 冷却 | OPEN，非 Draft，未合并 | **2026-11-26 已关闭**：提交 `c002a89` 是 main 的祖先，补丁统计一致，PR 上留有说明，分支保留 |
| [#46](https://github.com/nomuhoshi/newfirst-app/pull/46) | 登录与同步体验设计规范 DESIGN-AUTH-02 | OPEN，非 Draft，未合并 | 仍开：只有设计文档，不在 main；是否并入留待后续决定 |
| [#57](https://github.com/nomuhoshi/newfirst-app/pull/57) | 账号验收入口，标题标注暂不合并 | OPEN，Draft，未合并 | 仍开：与“是否开通云端账号”绑定，该决定属于老大；不据旧 PR 标题推定当前入口开关值 |

## 七、交付范围与后续动作

- G17 仅新增本文件，并在 `docs/00-latest-handoff.md`、`docs/50-product-officer-handoff.md` 的标题后增加指向本记录的最新说明；原文历史快照保留。
- 不修改产品代码、测试、工作流或配置；不新增测试。sonnet 从精确基线开独立文档 PR，执行 `git diff --check`，检查相对链接及三文件范围，按既有 CI 与独立终审流程交付。
- 生产 Supabase、密钥、SMTP 不触碰；CAPTCHA 保持关闭；正式 `codeTasksEnabled=[]`。本单不得扩展为生产操作或账号入口开放。
- 编号映射、真实服务／真机验收和旧 PR 覆盖关系各自保留待办；有可复现的新 P1/P2 时另立独立修复单。
