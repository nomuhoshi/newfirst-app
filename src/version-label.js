// 应用版本显示：“我的”页和“复制诊断”共用这一个函数，保证两处写的一样。
// 短提交号 = 完整提交号前 7 位（取不到真实提交号 → “未知”）；构建时间 = UTC 精确到分钟。
// 不依赖浏览器接口，可直接在 node 里测试。
export function shortSha(sha) {
  const m = /^([0-9a-f]{7})[0-9a-f]*(-dirty)?$/i.exec(String(sha || "").trim());
  return m ? m[1].toLowerCase() + (m[2] ? "（有未提交改动）" : "") : "未知";
}
export function buildTimeText(build) {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(build || ""));
  return m ? `${m[1]} ${m[2]} UTC` : "开发版";
}
export function versionLabel({ sha, build } = {}) {
  return `${buildTimeText(build)}（提交 ${shortSha(sha)}）`;
}
