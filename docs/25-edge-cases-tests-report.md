# 登录同步系统边界测试及产品决策落地报告

写于 2026-11-05（程序员 Gemini 原稿；harness 按真实 API 适配后落在本分支）。
基于分支 `gemini/login-sync-edge-tests-1`（基线 `dsh/login-sync-hardening-1@b1aa1e0`）。
**本分支未修改任何业务 `src/` 代码。**

## 1. 任务完成概况

| 文件 | 覆盖 |
| --- | --- |
| `tests/cloud-sync-edges.test.mjs` | Case 1（双标签并发 refresh+save）、2、3、5、6a/6b、7、8 |
| `tests/data-compat-edges.test.mjs` | Case 4、9（靶点）、10（靶点）、指纹对照 |
| `docs/25-edge-cases-tests-report.md` | 本报告 |

运行方式（与仓库其它纯 Node 测试一致）：

```bash
node tests/cloud-sync-edges.test.mjs
node tests/data-compat-edges.test.mjs
# 或
npm run test:edges
```

`npm test` 已挂上 `test:edges`（expected-red 软失败，不拖垮退出码）。

## 2. 产品官决策如何编码进测试

1. **旧 `imported[gid]=true` + 游客又有新进度** → 必须 `outcome: "guest-changed"` 并给出 choices（不得 `already-imported` 静默丢进度）。见 Case 10；hardening-1 基线 **expected-red**，等 DB-2。
2. **旧备份不得覆盖较新云端**（方案 1：可安全合并、禁止 XP/关卡倒退；仅抬高 `gen` 不能绕过）。见 Case 9；基线 **expected-red**，等 DB-3。
3. Case 1 按 `cloud-sync-tabs.test.mjs` / 并发写入模式新增：共享 storage 的两标签，一边 refresh/读云卡住时另一边 persistLocal + sync，最终 XP 合并不丢。

## 3. P0 缺陷靶点（红灯暴露，修 `src/` 后应变绿）

1. **[Case 10 / DB-2]** `replaceWithGuest`：`prev === true` 时按已导入处理，无法发现游客新进度。要求改为提示选择。
2. **[Case 9 / DB-3]** `mergeDocs` 仅比 `gen`：手动/恢复把 gen 抬高的旧备份会 `local-newer` 整份替换较新云端。要求禁止倒退（合并取大或拒绝）。

## 4. 适配说明（相对 Gemini 原稿）

- 用 `saveAccount` / `setCurrentAccount` / `DEVICE_KEY` 种本机状态，不再手写残缺 `suipian.acct.*` JSON。
- Case 2 / 5 先写入与云端不等价的 dirty 内容，确保真正走到 `saveProgress`。
- Case 3 只让账号副本键写爆，避免 `getDeviceId` 误伤。
- Case 9 / 10 以 `checkRed` 标记：失败记 expected-red，退出码仍 0；意外转绿会打印提示。
