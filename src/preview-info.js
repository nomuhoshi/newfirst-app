// 测试入口（构建时设了 PREVIEW_ID）的信息面板：让没有开发者工具的真机验收人员能看到
//   ① 跑的是哪个提交（源码 SHA，和线上 SOURCE_SHA.txt 对照）② 连的是哪个云项目 ③ 最近一次同步的状态。
// 正式构建里 isPreview 为 false，面板根本不创建。只读展示：没有任何会改数据 / 清数据的按钮。
export function formatClock(ms, tz) {
  if (!Number.isFinite(ms)) return "";
  try { return new Date(ms).toLocaleTimeString("zh-CN", { hour12: false, timeZone: tz }); } catch { return ""; }
}
// 把原始状态整理成面板上的几行（纯函数，方便单元测试）。
export function previewRows({ sha, previewId, target, status, account, recovery, build, online = true, tz }) {
  const st = status || {};
  const sync = !account ? "没有登录（游客，只存在这台设备）"
    : st.status === "synced" ? "已同步 ✓"
    : st.status === "syncing" ? "同步中…"
    : st.status === "offline" ? "离线：进度在这台设备，联网后自动同步"
    : st.status === "need-login" ? "登录已过期，需要重新登录"
    : st.status === "pending" ? "有进度等待上传"
    : st.status === "error" ? "同步失败：" + (st.message || "未知")
    : st.status === "import-recovery-required" ? "游客导入待办损坏：同步已锁定"
    : st.status === "import-read-failed" ? "读不出游客导入待办：同步已锁定"
    : "准备中…";
  const cloud = target?.mode === "off" ? "关闭（这个构建没有连云端）"
    : target?.mode === "test" ? `${target.host}${target.ref ? "（项目 " + target.ref + "）" : ""}`
    : target?.mode === "prod" ? "⚠ 正式项目（测试入口不该是这个）" : "未知";
  return [
    ["测试入口", previewId || "（无）"],
    ["源码提交", sha || "unknown"],
    ["构建时间", build ? String(build).slice(0, 19).replace("T", " ") + " UTC" : "开发版"],
    ["云项目", cloud],
    ["账号", account ? `${account.email || "已登录"}（${String(account.userId || "").slice(0, 8)}…）` : "未登录"],
    ["同步状态", sync],
    ["最近确认同步", !account ? "—" : Number.isFinite(st.lastSyncedAt) ? formatClock(st.lastSyncedAt, tz) : "本次打开后还没有"], // 没登录就没有“同步”可言，不显示上一个账号的时间
    ["有待上传", account ? (st.pending ? "是" : "否") : "—"],
    ["游客导入待办", { none: "无", healthy: "有（完好，会自动继续）", corrupt: "损坏（同步已锁定，见上方账号卡片）", "read-failed": "读不出来（同步已锁定，可重试）" }[recovery] || "—"],
    ["网络", online ? "在线" : "离线"],
  ];
}
export function createPreviewInfo({ h, isPreview, sha, previewId, target, build, getStatus, getAccount, getRecovery, getOnline = () => true }) {
  if (!isPreview) return { card: () => null, refresh() {} };
  const live = new Set();
  const paint = (pre) => { pre.textContent = previewRows({ sha, previewId, target, build, status: getStatus(), account: getAccount(), recovery: getRecovery(), online: getOnline() }).map(([k, v]) => `${k}：${v}`).join("\n"); };
  return {
    card() {
      const pre = h("pre", { class: "diag preview-info", "aria-label": "测试入口信息", "data-preview-info": "" });
      pre.dataset.sha = sha || "";
      pre.dataset.cloudHost = target?.host || "";
      paint(pre); live.add(pre);
      return h("div", { class: "selftest" }, h("h3", { text: "测试入口信息" }), pre);
    },
    refresh() { for (const pre of [...live]) { if (!pre.isConnected) { live.delete(pre); continue; } paint(pre); } },
  };
}
