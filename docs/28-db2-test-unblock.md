# 28 DB-2：解除 `npm test` 卡死 / 串扰

更新：2026-11-06　分支：`claude/db2-unblock`（基线 `dsh/login-sync-hardening-2` `9388a96`）
范围：只动测试基础设施（`tests/`、`scripts/run-tests.mjs`、`package.json` 的 test 脚本）和本文档；不改业务代码，不碰真实 Supabase / 正式数据，不合并、不部署。

## 1. 根因
`tests/step1.test.mjs`、`tests/step2.test.mjs` 用 `spawn("npx", ["vite","preview","--port","4318/4319","--strictPort"], {stdio:"ignore"})` 起服务器，再固定等 2.5 秒；结束时 `server.kill()`。
1. **杀不掉**：`server.kill()` 只杀 npx 外壳，里面真正的 `vite preview` 进程活下来，一直占着 4318 / 4319。本次实测：整套 `npm test` 跑完后 `ps` 里还剩 2 个 `vite preview`（旧写法），改完后是 0 个。
2. **下一次运行读到别人的旧页面**：残留进程服务的是“它当年那个工作区的 dist”。下一次（或另一个工作区 / 另一个人的）`npm test` 再起服务器时，`--strictPort` 报“端口被占”，但 `stdio:"ignore"` 把报错吞了、固定等待又不检查就绪，测试就连上那个旧进程。表现成：莫名其妙的失败、`waitForFunction` 反复等到 60 秒超时、整套 `npm test` 看起来“卡死”，单独重跑（先清了进程）又都通过——和 docs/26 里记的“step4 / step7 偶发等待超时，单独重跑都通过”吻合。本会话里这个问题已经真实出现过多次（旧工作区的 4319 残留让另一个分支的 step2 出现 5 个失败）。
3. **没有看门狗**：任何一个浏览器等待真的卡住，整条 `a && b && c` 链就无限挂着，没有任何输出告诉你是哪一条。

诚实说明：我在这台机器上没有复现出“整套 npm test 无限挂住”——干净环境里整套 544–564 秒全绿，每条命令单独也都通过。实测复现到的是上面 1（进程残留）和 2（旧服务器占端口 → 测试读到别人的页面，旧写法 4 秒内崩；若旧页面恰好是能加载的旧版本则是长时间等待）。DeepSeek 版没有跑本地完整 `npm test`（docs/27 §3），所以它那边的具体卡点我没有日志可对照。

## 2. 改动（只涉及测试基础设施）
- 新增 `tests/helpers/dist-server.mjs`：进程内静态服务器（托管 `dist/`），随机空闲端口、`listen` 完成才返回（就绪即返回，不再固定等 2.5 秒）、`close()` 保证释放端口、拦路径穿越。
- `tests/step1.test.mjs`、`tests/step2.test.mjs`：改用该服务器，`server.kill()` → `await server.close()`；不再起 `vite preview`。
- 新增 `scripts/run-tests.mjs`，`package.json`：`"test": "node scripts/run-tests.mjs"`，原来的链改名 `"test:chain"`（内容不变，只在 a11y-sheet 前加了 `test-infra`）。运行器：每条命令有上限（默认 900 秒，`TEST_STEP_TIMEOUT` 可调），超时杀整个进程组（含浏览器 / 孙进程）并点名“卡住：<命令>”；每条打印退出码和耗时；第一条失败即停（`KEEP_GOING=1` 跑完汇总）；每条结束清理本工作区残留的 `vite preview`。
- 新增 `tests/test-infra.test.mjs`（11 项，纯 Node，约 3 秒）：服务器端口不同 / 就绪 / 路径穿越 / `close()` 后端口释放；没有测试再用 `vite preview`；运行器的通过 / 失败即停 / `KEEP_GOING` / 超时杀进程组（含孙进程）。

## 3. 其它同类隐患（没有改，记在这里）
`step3/4/6/7/8-*`、`code-task` 等用 Node `http` 自己托管，端口固定（4320–4350 一带）且会 `close()`，不会残留；但两次 `npm test` 同时跑会端口冲突。当前约定仍是同一台机器同时只跑一份 `npm test`。要彻底解决可以逐个换成 `startDistServer()`，改动面大，本轮没做。
