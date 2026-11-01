# 发布方式对比（2026-11-01 调查）

## 结论
**选 PWA（网页应用）**：免费、不需要 Mac、手机上添加到主屏幕后像 App 一样使用，可以在浏览器里跑真正的 Python。

## 对比
| 方式 | 费用 | 平台 | 主要限制 |
|---|---|---|---|
| **PWA** | **0 日元**（可放 GitHub Pages 等免费托管） | iPhone / 安卓 | 没有应用商店曝光；iOS 要手动“添加到主屏幕” |
| Google Play | 一次性 25 美元 | 仅安卓 | 个人账号上线前需 14 天 + 12 名测试者的封闭测试（来源带商业性质，以官方为准） |
| App Store | 每年 99 美元（日本区约 12,800–12,980 日元） | 仅 iPhone | 费用；必须用 Xcode 26+ 在 Mac 上构建；不能是网页套壳（Guideline 4.2） |

## 要点
- 2026-04-28 起，上传 App Store 的 App 必须用 **Xcode 26 或更新版本**构建，而 Xcode 只能在 Mac 上运行。
- 2026-09-09 起，iOS App 的最低部署目标为 iOS 13。
- App Store 常见被拒原因：App 不完整/崩溃/占位内容（2.1）、网页套壳（4.2）、相似应用（4.3）、缺隐私政策或账号删除（5.1.1）、元数据与功能不符（2.3）。
- 所以**把 PWA 简单包一层壳去上 App Store 很可能被拒（4.2）**。

## PWA 在 iPhone 上的限制
- 只能手动安装：Safari 分享菜单 → 添加到主屏幕；没有自动安装提示。
- 据第三方文章：存储上限约 50MB、7 天不打开缓存会被清掉。**不是官方绝对规则**，WebKit 官方说明见 https://webkit.org/blog/14403/updates-to-storage-policy/ ，以真机测试为准。
- 推送通知：iOS 16.4+，需先添加到主屏幕，且需要后端；**欧盟地区 PWA 不能以独立应用方式运行**（日本不受影响）。
- 不支持后台同步，只能在 App 打开时同步。
- 第一版**不做推送提醒**。

## 在浏览器里跑 Python
- Pyodide 是基于 WebAssembly 的浏览器版 CPython，**不需要服务器**，支持 NumPy、pandas 等。
- 实测（2026-11-01，npm 包 314.0.7）：核心文件原始约 13.4 MB，gzip 后约 6.3 MB；手机加载时间**需要真机实测**。

## 推广
- 发链接或二维码；我可以在 B 站视频里放。

## 来源
- Apple SDK 最低要求：https://www.developer.apple.com/news/upcoming-requirements/
- Apple Developer Program 年费与个人注册：https://www.issoh.co.jp/tech/details/7317/
- 2026 审核通过指南：https://capgo.app/blog/how-to-pass-app-store-review-2026/
- PWA 在 iOS 上的限制：https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide
- Google Play 个人开发者账号：https://appswap.pages.dev/blog/google-play-personal-developer-account-requirements
- Pyodide：https://pyodide.org/en/stable/
