# 第三轮：iPhone 仍无声，先查原因（只做 P0）

2026-11-02。iPhone 真机反馈：Safari 和主屏幕模式仍然完全没有声音，也没有任何振动；六边形节点和课程内容保留；电路背景第一屏只能看到两根线。

按 GPT 的验收顺序，本次**只部署音频兼容性测试**，不改正式音效、不做键盘声音实验室、不动电路和振动。

## “我的”页新增：音频兼容性测试
三个按钮，都在**点击事件里同步**发声（不经过 onActivate 的 pointerdown、延迟、Promise 链或自动播放；`then/catch` 只用来“事后显示结果”）：

| 按钮 | 做法 |
|---|---|
| A：Web Audio 提示音 | 点击里新建 AudioContext，立刻 `resume()`，同步 `start()` 一个 880Hz 的音；audioSession 设为 ambient（和正式版一致） |
| B：本地 WAV 文件 | `public/sfx/test-beep.wav`（13KB，原创合成）用 `<audio>` 在点击里直接 `play()` |
| C：Web Audio + 播放模式 | 同 A，但先把 `navigator.audioSession.type` 设为 `playback`（验证“被静音键静音”的假设） |

结果区显示：运行方式（Safari / 主屏幕）、系统版本、audioSession 类型、AudioContext 创建时的状态、0.4 秒后的状态和 `currentTime`（>0 说明音频时钟在走）、音频文件的网络读取结果和加载是否成功、`readyState`、`audio.play()` 成功或失败及具体错误。

## 怎么判断
- B 响、A 不响：正式版改用本地音频文件。
- A 响、C 响、B 不响：Web Audio 可用，问题在之前的解锁流程以外。
- A 不响、C 响：是 iPhone 静音键 / 音频会话问题，正式版把 audioSession 设为 playback。
- 全都不响：看结果区的错误信息；同时确认静音键（侧面拨片）和媒体音量。

自动测试只能验证“点击里同步发声指令”和“文件有效、能读取”，**不能证明 iPhone 上听到了**。

## 后续（等你测完再做）
P1 十个原创键盘音效选择实验室（A–J，建议优先 A、B、D、J）→ P2 电路背景加密（5–7 条路径 + 3–4 个光点）→ P3 重新调查振动（普通按钮、开关、选项、检查按钮四种独立测试，必须标记“等待真机确认”）。
