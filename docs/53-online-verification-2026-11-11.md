# 53 正式站线上复核记录：U1–U5 游客版（桌面 Chrome）

| 项 | 内容 |
|---|---|
| 复核人 | 传话员 |
| 时间 | 2026-11-11 17:04–17:06 东京（UTC+9） |
| 网址 | https://nomuhoshi.github.io/newfirst-app/ |
| 环境 | 桌面 Chrome 156.0.0.0，1920×1072，隔离浏览器；**不是 iPhone** |
| 对应发布 | main `cfb368aa2497e3795a6d1d98b55697b29818dc38`；Pages deployment 7704666512 |
| 截图 | 8 张，见下表；原件在传话员环境 `/workspace/relay/verify/`，存入仓库 `docs/evidence/2026-11-11-desktop-chrome/` 后此处链接生效 |

| # | 检查 | 结果 | 实际看到的原文 / 数字 | 截图 |
|---|---|---|---|---|
| 1 | 版本 | **人工通过** | 「应用版本：2026-11-11 07:39 UTC」；「缓存版本：2026-11-11T07:39:51.323Z」；「网络：在线」；「运行方式：浏览器」 | [04_version.png](evidence/2026-11-11-desktop-chrome/04_version.png) |
| 2 | 地图 34 关 | **人工通过** | 第 1 单元「奶茶店点单屏」6 关、第 2 单元「文字与长度」5 关、第 3 单元「比较与判断」8 关、第 4 单元「循环」8 关、第 5 单元「列表与序列」7 关，合计 34（按页面列表项计数）；第 6 单元「第 6 单元 · 即将推出」「字典与集合」「dict、set」 | [02_map.png](evidence/2026-11-11-desktop-chrome/02_map.png)、[08_unit6.png](evidence/2026-11-11-desktop-chrome/08_unit6.png) |
| 3 | 登录入口关闭 | **人工通过** | 三页引导「你好，我是小码！」「我会陪你一关一关学 Python。」「卡住了就点我，我会给你提示。」，只有「继续」/「开始学习」；地图只有学习 / 我的和课程 / 练习入口；我的页账号区「云端暂未开通：学习进度只保存在这台设备上。」，没有登录 / 注册按钮或链接（另有说明文字「没登录时，记录只保存在这台设备上」，不是入口） | [01_intro.png](evidence/2026-11-11-desktop-chrome/01_intro.png)、[03_my_initial.png](evidence/2026-11-11-desktop-chrome/03_my_initial.png) |
| 4 | 通关并刷新后存档保留 | **人工通过** | U1L1「让屏幕说话」4 题全对：「完美！」「本关 XP +50」「正确率 100%」「连续天数 1」；我的页 XP 50、红心 5/5、已完成 1/34、连续 1；刷新后完全不变 | [05_level_completed.png](evidence/2026-11-11-desktop-chrome/05_level_completed.png)、[06_before_refresh.png](evidence/2026-11-11-desktop-chrome/06_before_refresh.png)、[07_after_refresh.png](evidence/2026-11-11-desktop-chrome/07_after_refresh.png) |

**未验**：iPhone Safari、主屏幕 PWA（无设备）。桌面结果不代替 iPhone 验收。

**发现的不一致（待修）**：第 6 单元预告仍是旧的「字典与集合 · dict、set」，和下一批 U6「类型与报错」、U7「字典」不一致。已在 PR #58（`content/u6-u7-release` `c6995ad`）修正：U6、U7 正式开放，第 8 单元预告改为「函数 · def、参数、return」。
