// 随机练习（SPEC §0.3）：只从已通关关卡的原题里抽题。纯函数，不读写本机记录，方便单独测试。
// 刷题全过程不改变主线学习数据（XP、红心、连续天数、解锁、完成次数）——这里的函数一律不接触 state 以外的写操作，
// 而且只读 state.done。

export const ROUND_SIZES = [5, 10, 20];
export const DEFAULT_ROUND = 10;

// 每道题的稳定唯一 ID：关卡 ID + 题号（课程 JSON 里的顺序），例如 "U1L2#3"
export const exerciseId = (lessonId, index) => `${lessonId}#${index}`;

// units: [{ id, title, lessons: [{ id, title, exercises }] }]（只传已上线单元）
// 返回已通关的单元和关卡（没有已通关关卡的单元不出现）
export function clearedScope(units, done) {
  return units
    .map((u) => ({ id: u.id, title: u.title, lessons: u.lessons.filter((l) => done && done[l.id] === true).map((l) => ({ id: l.id, title: l.title, count: l.exercises.length })) }))
    .filter((u) => u.lessons.length > 0);
}

// 题池：selected 是选中的关卡 ID 集合（Set 或数组）。没有通关的关卡即使被选中也不会进题池。
export function buildPool(units, done, selected) {
  const sel = new Set(selected);
  const pool = [];
  const seen = new Set();
  for (const u of units) for (const l of u.lessons) {
    if (!(done && done[l.id] === true) || !sel.has(l.id)) continue;
    l.exercises.forEach((ex, i) => {
      const id = exerciseId(l.id, i);
      if (seen.has(id)) return;
      seen.add(id);
      pool.push({ id, lessonId: l.id, unitId: u.id, index: i, ex });
    });
  }
  return pool;
}

export function shuffle(arr, rand = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// 抽题：按 ID 去重，不重复；题池不够时用全部可用题目
export function drawRound(pool, size, rand = Math.random) {
  const uniq = [...new Map(pool.map((p) => [p.id, p])).values()];
  const actual = Math.min(size, uniq.length);
  return { items: shuffle(uniq, rand).slice(0, actual), requested: size, actual, short: actual < size };
}

// 打乱一道题的展示：选项（正确标记和解释跟着选项对象一起移动）、词块、排序题的初始排列。判分数据不变。
export function shuffleExercise(ex, rand = Math.random) {
  const copy = JSON.parse(JSON.stringify(ex));
  if (copy.type === "predict") copy.options = shuffle(copy.options, rand);
  else if (copy.type === "fill") copy.tokens = shuffle(copy.tokens, rand);
  else if (copy.type === "order") copy.shuffled = shuffle(copy.shuffled, rand);
  return copy;
}
