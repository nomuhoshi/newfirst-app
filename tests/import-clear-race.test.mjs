// 导入与清除交错：另一页清除学习记录时，导入的保存不能报“成功”；清除胜出，不复活旧数据。
// 备份快照：扫描期间发生清除就拒绝；扫描期间别的页写入的边界。纯 node，假 localStorage，可控交错点。
const mem = {}; let beforeSet = null, beforeGet = null, nSet = 0, nGet = 0;
globalThis.localStorage = {
  getItem: (k) => { nGet++; if (beforeGet) { const f = beforeGet; beforeGet = f.once === false ? f : null; f(k); } return k in mem ? mem[k] : null; },
  setItem: (k, v) => { nSet++; if (beforeSet) { const f = beforeSet; beforeSet = null; f(k); } mem[k] = String(v); },
  removeItem: (k) => { delete mem[k]; }, key: (i) => Object.keys(mem)[i] ?? null, get length() { return Object.keys(mem).length; },
};
const st = await import("../src/storage.js");
const { loadState, saveState, getLastSaveStatus, readSnapshot, addXp, addRun, clearState, _asTab } = st;
const { mergeImport } = await import("../src/progress-file.js");
let fail = 0; const ok = (n, c, d = "") => { if (!c) fail++; console.log((c ? "✅ " : "❌ ") + n + (c ? "" : "  — " + d)); };
const reset = () => { for (const k of Object.keys(mem)) delete mem[k]; beforeSet = beforeGet = null; };
let n = 0; const page = () => _asTab(loadState().state, "p" + ++n);
const IMP = { done: { U1L1: true, U1L2: true, U1L3: true }, doneOn: {}, xp: 190, lessonsCompleted: 3, streak: 2, lastDay: "2026-11-10" };
const stored = () => { const s = loadState().state; return { xp: s.xp, done: Object.keys(s.done).length }; };
const status = () => (getLastSaveStatus ? getLastSaveStatus() : "（无状态接口）");
const ledgers = () => Object.keys(mem).filter((k) => k.includes(".tab."));
const clearFromOtherPage = () => { const C = clearState(); _asTab(C, "other" + ++n); };

// R1 导入合并后、保存前，另一页清除
{ reset(); const A = page(); const B0 = page(); addXp(B0, 10, "U1L1", true); saveState(B0);
  let s = mergeImport(A, IMP); Object.assign(A, s);
  clearFromOtherPage();
  const r = saveState(A);
  ok("R1 保存前被清除：saveState 不返回成功", r === false, "返回 " + r);
  ok("R1 状态为“发生清除冲突”（cleared）", status() === "cleared", status());
  ok("R1 内存采用新一代（空），导入内容没有复活", A.xp === 0 && Object.keys(A.done).length === 0, JSON.stringify([A.xp, Object.keys(A.done)]));
  ok("R1 存储里也没有导入内容", stored().xp === 0 && stored().done === 0, JSON.stringify(stored())); }

// R2 保存过程中，在第 K 次写入之前另一页清除（枚举所有写入点）
{ let fired = 0, savedAfterClear = 0, clearedCount = 0;
  for (let K = 1; K <= 8; K++) {
    reset(); const A = page(); const B0 = page(); addXp(B0, 10, "U1L1", true); saveState(B0);
    Object.assign(A, mergeImport(A, IMP));
    let cnt = 0; const myNset = nSet; const origSet = localStorage.setItem;
    localStorage.setItem = (k, v) => { cnt++; if (cnt === K) { localStorage.setItem = origSet; clearFromOtherPage(); } return origSet(k, v); };
    const r = saveState(A); localStorage.setItem = origSet;
    if (cnt < K) continue; fired++;
    const s = status(), view = stored();
    const hasImport = view.done >= 3;
    if (r === true) {
      // 返回成功时，导入的内容必须真的在存储里；唯一例外：清除发生在“最后一次写入（兼容镜像）”之后，此时进度已经保存过再被清除
      const lastWrite = cnt === K;
      if (!(hasImport || lastWrite)) { fail++; console.log(`❌ R2 K=${K}：返回成功但存储里没有导入内容`, JSON.stringify(view)); } else savedAfterClear++;
    } else { clearedCount++; if (s !== "cleared" && s !== "failed") { fail++; console.log(`❌ R2 K=${K}：状态未区分`, s); } if (s === "cleared" && hasImport) { fail++; console.log(`❌ R2 K=${K}：清除胜出，却复活了旧数据`, JSON.stringify(view)); } }
  }
  ok("R2 写入点枚举：至少触发 2 个不同写入点", fired >= 2, "fired=" + fired);
  ok("R2 其中包含“清除胜出、返回非成功”的情形", clearedCount >= 1, "cleared=" + clearedCount); }

// R3 无冲突时仍是成功，状态 saved
{ reset(); const A = page(); Object.assign(A, mergeImport(A, IMP)); const r = saveState(A);
  ok("R3 无冲突：保存成功，状态 saved，进度在存储里", r === true && status() === "saved" && stored().done === 3 && stored().xp === 190, JSON.stringify([r, status(), stored()])); }

// R4 读写失败与清除冲突分开：存储抛错 → failed
{ reset(); const A = page(); Object.assign(A, mergeImport(A, IMP));
  const o = localStorage.setItem; localStorage.setItem = () => { throw new Error("quota"); }; const r = saveState(A); localStorage.setItem = o;
  ok("R4 写入失败：返回 false，状态 failed（不是 cleared）", r === false && status() === "failed", status()); }

// R5 清除后旧页再保存（已无导入内容）：不复活旧键
{ reset(); const A = page(); Object.assign(A, mergeImport(A, IMP)); saveState(A);
  clearFromOtherPage(); const before = ledgers().length;
  saveState(A);
  ok("R5 清除后旧页再保存：没有复活旧数据", stored().xp === 0 && stored().done === 0, JSON.stringify(stored())); }

// S1 备份快照：扫描期间发生清除 → 拒绝
{ reset(); const A = page(); addXp(A, 50, "U1L1", true); A.done.U1L1 = true; saveState(A); const B = page(); addXp(B, 20, "U1L2", true); B.done.U1L2 = true; saveState(B);
  let c = 0; const og = localStorage.getItem; localStorage.getItem = (k) => { c++; const v = og(k); if (c === 4) { localStorage.getItem = og; clearFromOtherPage(); } return v; };
  const r = readSnapshot(A); localStorage.getItem = og;
  ok("S1 扫描期间发生清除：拒绝生成备份", r.ok === false, JSON.stringify(r).slice(0, 120)); }

// S2 扫描中别的页新增 / 更新账本：不拒绝，快照是“读取边界内”的一致下界——不超过最终存储，也不少于扫描开始前已有的
{ reset(); const A = page(); addXp(A, 50, "U1L1", true); A.done.U1L1 = true; saveState(A);
  const before = stored();
  const B = page(); addXp(B, 20, "U1L2", true); B.done.U1L2 = true;
  let c = 0; const og = localStorage.getItem; localStorage.getItem = (k) => { c++; if (c === 4) { localStorage.getItem = og; saveState(B); } return og(k); };
  const r = readSnapshot(A); localStorage.getItem = og; const after = stored();
  ok("S2 扫描中别页写入：快照成功", r.ok === true);
  ok("S2 快照不少于扫描前、不多于扫描后（有限边界，不是严格原子快照）", r.snap.xp >= before.xp && r.snap.xp <= after.xp, JSON.stringify([before, r.snap.xp, after])); }

// S3 无并发：快照完整
{ reset(); const A = page(); addXp(A, 50, "U1L1", true); A.done.U1L1 = true; saveState(A); const r = readSnapshot(A);
  ok("S3 无并发：快照完整", r.ok && r.snap.xp === 50 && r.snap.done.U1L1 === true); }

console.log(fail ? `\n${fail} 项失败` : "\n全部通过"); process.exit(fail ? 1 : 0);
