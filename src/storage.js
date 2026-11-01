// 本机记录：只存在这台设备的浏览器里（localStorage），不上传任何地方。
// 读写都包在 try/catch 里：无痕模式、存储被禁用时不能让页面白屏。

const KEY = "suipian.progress";
export const DATA_VERSION = 2;

export function freshState() {
  return {
    version: DATA_VERSION,
    lesson: "L01",
    page: 0,              // 当前在第几页（正文或练习），最后一页之后是完成页
    started: false,
    lessonDone: {},       // 学完的课 { L01: true }
    exDone: {},           // 做对的练习 { X1: true }
    exSkipped: {},        // 跳过的练习
    viewedSolution: {},   // 看过参考答案的练习
    hintLevel: {},        // 每道练习已看到第几级提示
    drafts: {},           // 代码草稿：例子（P2a…）和练习（X1…）各自一份 { code, anchor, head }
    installTipClosed: false,
    lastActive: 0,
  };
}

// 第 1 版（N01 讲解卡 + 选择题 + 自我介绍任务）的记录：题目都已撤下，不能沿用完成状态
function migrateV1(old) {
  const s = freshState();
  s.installTipClosed = !!old.installTipClosed;
  return { state: s, notice: "课程已更新为新版教程，旧版练习的记录不再使用，请从第一课开始。" };
}

export function loadState() {
  let raw;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    return { state: freshState(), notice: "这个浏览器不允许保存进度（可能是无痕模式），关掉页面后进度会丢失。" };
  }
  if (!raw) return { state: freshState(), notice: null };
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return { state: freshState(), notice: "本机记录损坏，已从头开始。" };
  }
  if (data && data.version === 1) return migrateV1(data);
  if (!data || data.version !== DATA_VERSION) {
    return { state: freshState(), notice: "学习记录的格式无法识别，已从头开始。" };
  }
  return { state: { ...freshState(), ...data }, notice: null };
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
