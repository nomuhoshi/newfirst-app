// 把课程里“待验收”的写代码 / 改代码题（lesson.pending[].task）合并进关卡的 exercises。纯函数，不读写存档，不碰网络。
// 只合并 enabledIds 里列出的题（构建时由 CODE_TASKS 决定；正式构建永远是空列表）：
//   - enabledIds 为空 → 原样返回传进来的 units（同一个对象，行为和以前完全一样）；
//   - 对每个被启用的题：用 task 替换 exercises[replaces - 1]（replaces 从 1 开始），并把这条 pending 移出；其它 pending 原样保留；
//   - 任何不对劲（找不到启用的题、replaces 越界、题不是 modify / write、题 id 重复）都直接抛错，不静默跳过。
export const MERGEABLE_TYPES = ["modify", "write"];

export function mergeCodeTasks(units, enabledIds) {
  const want = [...new Set(enabledIds || [])];
  if (!want.length) return units;
  const found = new Set();
  const out = {};
  for (const [uid, unit] of Object.entries(units)) {
    out[uid] = { ...unit, lessons: unit.lessons.map((l) => {
      const pend = l.pending || [];
      if (!pend.some((p) => want.includes(p.task?.id))) return l;
      let exercises = [...l.exercises];
      const rest = [];
      for (const p of pend) {
        const t = p.task;
        if (!t || !want.includes(t.id)) { rest.push(p); continue; }
        if (found.has(t.id)) throw new Error(`代码题 ${t.id} 重复`);
        if (!MERGEABLE_TYPES.includes(t.type) || p.type !== t.type) throw new Error(`代码题 ${t.id} 的类型不对：${t.type}`);
        if (!Number.isInteger(p.replaces) || p.replaces < 1 || p.replaces > exercises.length) throw new Error(`代码题 ${t.id} 的 replaces 越界：${p.replaces}`);
        exercises[p.replaces - 1] = { ...t };
        found.add(t.id);
      }
      const next = { ...l, exercises };
      if (rest.length) next.pending = rest; else delete next.pending;
      return next;
    }) };
  }
  const missing = want.filter((id) => !found.has(id));
  if (missing.length) throw new Error(`找不到要启用的代码题：${missing.join("、")}`);
  return out;
}
