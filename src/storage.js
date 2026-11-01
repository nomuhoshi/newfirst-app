// 本机记录：只存在这台设备的浏览器里（localStorage），不上传任何地方。
// 读写都包在 try/catch 里：无痕模式、存储被禁用时不能让页面白屏。

const KEY = "suipian.progress";
export const DATA_VERSION = 1;

export function freshState() {
  return {
    version: DATA_VERSION,
    lesson: "N01",
    step: 0,              // 当前在第几步（讲解卡、练习、任务、完成页）
    started: false,
    done: {},             // 已完成的题目 { E1: true }
    drafts: {},           // 代码草稿 { E2: { code, anchor, head } }
    hintLevel: {},        // 每题已看到第几级提示
    viewedSolution: {},   // 看过完整答案的题目
    firstWrong: {},       // 第一次就答错的题目（以后复习用）
    needVariant: false,   // 看过小任务答案后，需要再做一个变化题
    installTipClosed: false,
    lastActive: 0,
  };
}

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { state: freshState(), notice: "这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。" };
  }
  if (!raw) return { state: freshState(), notice: null };
  try {
    const data = JSON.parse(raw);
    if (!data || data.version !== DATA_VERSION) {
      return { state: freshState(), notice: "学习记录的格式已更新，进度从头开始。" };
    }
    return { state: { ...freshState(), ...data }, notice: null };
  } catch {
    return { state: freshState(), notice: "本机记录损坏，已从头开始。" };
  }
}

// 返回 true 表示保存成功
export function saveState(state) {
  try {
    state.lastActive = Date.now();
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState() {
  try { localStorage.removeItem(KEY); } catch { /* 忽略 */ }
  return freshState();
}
