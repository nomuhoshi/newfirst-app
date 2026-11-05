# 登录同步系统边界测试及产品决策落地报告（返工版）

写于 2026-11-05（程序员 Gemini 原稿；harness 按真实 API 适配；产品官未验收后返工）。
分支 `gemini/login-sync-edge-tests-1`（基线 `dsh/login-sync-hardening-1@b1aa1e0`）。
**本分支未修改任何业务 `src/` 代码。**

## 1. 文件

| 文件 | 覆盖 |
| --- | --- |
| `tests/cloud-sync-edges.test.mjs` | Case 1、2、3a/3b、5a/5b/5c、6a/6b、7a/7b、8 |
| `tests/data-compat-edges.test.mjs` | Case 4/4b、9、10、指纹对照 |
| `docs/25-edge-cases-tests-report.md` | 本报告 |

```bash
npm run test:edges
# 或
node tests/cloud-sync-edges.test.mjs && node tests/data-compat-edges.test.mjs
```

## 2. 分类口径（软红 ≠ 全绿）

结果必须分成三类，**禁止把 expected-red 统计进「全绿」**：

1. **当前通过**：硬断言绿，现有 `src/` 行为符合产品口径。
2. **预期红（靶点）**：硬断言对目标行为失败；标 `expected-red until DB-2/DB-3`，退出码仍 0，但报告不得写全绿。
3. **尚未验证**：本套件未覆盖或缺少可调用 API 的探测项（见下）。

DB-2 / DB-3 合并后，对应 Case 必须改成**硬断言**（失败即 CI 红）。

## 3. 产品官决策如何编码

| 决策 | 用例 | 现状分类 |
| --- | --- | --- |
| 同步中新增进度必须进云端（非假绿） | Case 2：捕获 `saveProgress` 最终文档，强制 60 XP + U1L2 | 当前通过（目标） |
| 写满后旧副本逐字不变 | Case 3b | 当前通过 |
| 冲突 5 次后本机仍在、待同步、无死循环 | Case 5a/b/c | 当前通过 |
| 普通退出 signOut 失败 → 保持登录 | Case 7a | **预期红 / DB-3**（当前会清凭证） |
| 强制本机退出 → 清凭证 + 提示云端会话可能仍有效 | Case 7b | **预期红 / DB-3**（API 未实现） |
| 删号后本机清理失败 → 待清理 / 禁旧令牌 / 隔离副本，不宣称成功 | Case 8 | **预期红 / DB-3**（禁止把危险行为判绿） |
| 旧备份抬高 gen 不得覆盖较新云端 | Case 9 | **预期红 / DB-3** |
| 旧 `imported=true` + 游客新进度 → `guest-changed` | Case 10 | **预期红 / DB-2** |

## 4. 返工相对 8e49b76 的修正

1. Case 2：记录每次 `saveProgress` 文档，断言最后一次与云端均为 60 XP 且含 U1L2。
2. Case 3：增加 3b，失败前后 `suipian.acct.u1` 原文逐字相等。
3. Case 5：拆 5a/5b/5c（中止、本机+待同步、无无限重试）。
4. Case 7：拆 7a 普通退出失败 / 7b 强制本机退出；均标 DB-3 靶点。
5. Case 8：改为目标行为断言；当前危险「ok + 内存重置」不得判绿。
6. 报告与控制台汇总改为「当前通过 / 预期红 / 尚未验证」。

## 5. 尚未验证

- UI 层是否展示「云端会话可能仍有效」「待本机清理」文案（纯 Node 编排层测不到）。
- 真机 / 真库上的删号清理失败与强制本机退出流程（等 `suipian-test` + DB-3）。
- Case 9 的 `rev/updated_at` 字段比较（当前 schema 只有 gen/lineage；DB-3 方案落地后再加硬断言）。
