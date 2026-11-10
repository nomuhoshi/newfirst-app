# Lighthouse 上线前测量（chore/prelaunch）

- 工具：Lighthouse 12.8.2，默认 mobile 预设（模拟 Moto G Power 级手机 + 慢速 4G，`throttlingMethod: simulate`），headless Chrome；PWA 一项用 Lighthouse 11（12 已移除 PWA 类别）。
- 对象：本机 `vite preview` 托管的正式构建（`npm run build`），首页 `/`。每个版本跑 3 次，取中位数。
- 修改前：`8d897f8`（PR #44 分支 `dsh/login-sync-hardening-3` 的提交，未改动）。修改后：`2bad0cf`（之后的提交只改文档）。
- 原始报告：`before-8d897f8/`、`after-2bad0cf/`（JSON，可拖进 https://googlechrome.github.io/lighthouse/viewer/ 查看）。
- 汇总脚本：`node scripts/lighthouse-summary.cjs docs/lighthouse/after-2bad0cf`

| 指标 | 修改前 8d897f8 | 修改后 2bad0cf |
|---|---|---|
| Performance | 96 | **99** |
| Accessibility | 100 | 100 |
| Best Practices | 100 | 100 |
| SEO | 91 | **100** |
| PWA（Lighthouse 11） | 100 | 100 |
| FCP | 2.1 s | **1.5 s** |
| LCP | 2.3 s | **1.6 s** |
| TBT（3 次） | 70 / 90 / 80 ms | 30 / 100 / 40 ms |
| CLS | 0 | 0 |
| 首屏 JS（gzip） | 约 201 KB（main 74.6 + 含 CodeMirror 的共享块 127） | 约 71 KB（main 68.9 + 2.2） |
| 未使用的 JS（Lighthouse 估计） | 126 KiB | 28 KiB |
| 总下载量 | 12,358 KiB | 12,231 KiB |

总下载量仍有约 12 MB，几乎全部是 Pyodide（`pyodide.asm.wasm` 9.6 MB + `python_stdlib.zip` 2.5 MB），页面打开后立刻在后台加载（现有设计：先画界面，再加载 Python）。这次没改，见 PR 说明里的建议。
