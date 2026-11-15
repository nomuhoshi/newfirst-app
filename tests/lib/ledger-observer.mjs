// 纯只读 suipian.v4 存储观察器（供纯 Node 校准与浏览器 page.evaluate 共用）
// 严格遵循：
// 1. epoch 缺省为 "m0"
// 2. 基线键为 suipian.v4.base.<epoch>
// 3. entries 为按 entryId 索引的对象，重复 ID 合并取最大，不跳过后续条目
// 4. firstXp 为按 lessonId 索引的对象，按关卡取最大
// 5. 读取失败、结构损坏、观察期间换代均返回 ok: false 与 xp: null，绝不当作零进度

export function observeSuipianV4Storage(storage = globalThis.localStorage) {
  const NS = "suipian.v4.";
  const EPOCH_KEY = "suipian.v4.epoch";
  const BASE_PREFIX = "suipian.v4.base.";
  const TAB_PREFIX = "suipian.v4.tab.";

  const isPlainObject = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

  const rawGet =
    typeof Storage !== "undefined" && Storage.prototype && typeof Storage.prototype.getItem === "function"
      ? Storage.prototype.getItem
      : storage.getItem;

  const safeGetItem = (key) => {
    try {
      return { ok: true, value: rawGet.call(storage, key) };
    } catch (err) {
      return { ok: false, error: String(err) };
    }
  };

  const parseEpoch = (raw) => {
    if (raw === null || raw === undefined) {
      return { valid: true, value: "m0", source: "default-m0" };
    }
    if (typeof raw !== "string" || raw.trim() === "") {
      return { valid: false, error: "empty epoch value" };
    }
    const trimmed = raw.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (isPlainObject(parsed)) {
          const cand = parsed.epoch ?? parsed.clearEpoch ?? null;
          if ((typeof cand === "string" && cand.trim() !== "") || (typeof cand === "number" && Number.isFinite(cand))) {
            return { valid: true, value: String(cand).trim(), source: "stored-object" };
          }
        }
      } catch {}
      return { valid: false, error: "corrupt epoch json" };
    }
    if (trimmed.startsWith('"')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (typeof parsed === "string" && parsed.trim() !== "") {
          return { valid: true, value: parsed.trim(), source: "stored-json-string" };
        }
      } catch {}
      return { valid: false, error: "corrupt quoted epoch" };
    }
    return { valid: true, value: trimmed, source: "stored-raw" };
  };

  // 1. 读取当前 epoch（缺省为 m0）
  const epReadBefore = safeGetItem(EPOCH_KEY);
  if (!epReadBefore.ok) {
    return { ok: false, status: "READ_ERROR", xp: null, runs: null, done: null, error: epReadBefore.error };
  }
  const parsedEpBefore = parseEpoch(epReadBefore.value);
  if (!parsedEpBefore.valid) {
    return {
      ok: false,
      status: "CORRUPT_STORAGE",
      corruptKeys: [EPOCH_KEY],
      xp: null,
      runs: null,
      done: null,
      error: parsedEpBefore.error,
    };
  }
  const currentEpoch = parsedEpBefore.value;

  // 2. 扫描 suipian.v4.* 命名空间
  const rawMap = {};
  try {
    const len = storage.length;
    for (let i = 0; i < len; i++) {
      const k = storage.key(i);
      if (k && k.startsWith(NS)) {
        const item = safeGetItem(k);
        if (!item.ok) {
          return { ok: false, status: "READ_ERROR", xp: null, runs: null, done: null, error: item.error };
        }
        rawMap[k] = item.value;
      }
    }
  } catch (err) {
    return { ok: false, status: "READ_ERROR", xp: null, runs: null, done: null, error: String(err) };
  }

  // 3. 读取并校验当前代基线 suipian.v4.base.<epoch>
  const baseKey = `${BASE_PREFIX}${currentEpoch}`;
  const ignoredOldEpochBaseKeys = Object.keys(rawMap)
    .filter((k) => k.startsWith(BASE_PREFIX) && k !== baseKey)
    .sort();

  let baseXp = 0;
  let baseRuns = 0;
  const baseDone = {};
  const baseFirstXp = {};
  let usedBase = false;

  if (Object.prototype.hasOwnProperty.call(rawMap, baseKey) && rawMap[baseKey] !== null) {
    let baseDoc;
    try {
      baseDoc = JSON.parse(rawMap[baseKey]);
    } catch (err) {
      return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: String(err) };
    }
    if (!isPlainObject(baseDoc)) {
      return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "base doc is not plain object" };
    }
    if (baseDoc.epoch !== undefined && baseDoc.epoch !== null && String(baseDoc.epoch) !== String(currentEpoch)) {
      return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "base doc epoch mismatch" };
    }

    let stateNode;
    if (Object.prototype.hasOwnProperty.call(baseDoc, "s")) {
      if (!isPlainObject(baseDoc.s)) {
        return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "base.s is not plain object" };
      }
      stateNode = baseDoc.s;
    } else {
      stateNode = baseDoc;
    }

    if (stateNode.xp !== undefined) {
      if (typeof stateNode.xp !== "number" || !Number.isFinite(stateNode.xp) || stateNode.xp < 0) {
        return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "invalid base xp" };
      }
      baseXp = stateNode.xp;
    }
    if (stateNode.lessonsCompleted !== undefined) {
      if (typeof stateNode.lessonsCompleted !== "number" || !Number.isFinite(stateNode.lessonsCompleted) || stateNode.lessonsCompleted < 0) {
        return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "invalid base lessonsCompleted" };
      }
      baseRuns = stateNode.lessonsCompleted;
    }
    if (stateNode.done !== undefined) {
      if (!isPlainObject(stateNode.done)) {
        return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "invalid base done" };
      }
      for (const [lessonId, flag] of Object.entries(stateNode.done)) {
        if (flag) baseDone[lessonId] = true;
      }
    }
    if (stateNode.firstXp !== undefined) {
      if (!isPlainObject(stateNode.firstXp)) {
        return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "invalid base firstXp" };
      }
      for (const [lessonId, pts] of Object.entries(stateNode.firstXp)) {
        if (typeof pts !== "number" || !Number.isFinite(pts) || pts < 0) {
          return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [baseKey], xp: null, runs: null, done: null, error: "invalid base firstXp entry" };
        }
        baseFirstXp[lessonId] = pts;
      }
    }
    usedBase = true;
  }

  // 4. 扫描全部 suipian.v4.tab.* 账本，校验 entries 与 firstXp 均为按 ID 索引的普通对象
  const tabKeys = Object.keys(rawMap).filter((k) => k.startsWith(TAB_PREFIX)).sort();
  const activeLedgers = [];
  const ignoredOldEpochKeys = [];
  const corruptKeys = [];

  for (const tk of tabKeys) {
    let doc;
    try {
      doc = JSON.parse(rawMap[tk]);
    } catch {
      corruptKeys.push(tk);
      continue;
    }
    if (!isPlainObject(doc)) {
      corruptKeys.push(tk);
      continue;
    }
    if (doc.epoch !== undefined && doc.epoch !== null && typeof doc.epoch !== "string" && typeof doc.epoch !== "number") {
      corruptKeys.push(tk);
      continue;
    }
    const docEpoch = doc.epoch === undefined || doc.epoch === null ? "m0" : String(doc.epoch);

    if (doc.entries !== undefined && doc.entries !== null && !isPlainObject(doc.entries)) {
      corruptKeys.push(tk);
      continue;
    }
    if (doc.firstXp !== undefined && doc.firstXp !== null) {
      if (!isPlainObject(doc.firstXp)) {
        corruptKeys.push(tk);
        continue;
      }
      const badFirstXp = Object.values(doc.firstXp).some((v) => typeof v !== "number" || !Number.isFinite(v) || v < 0);
      if (badFirstXp) {
        corruptKeys.push(tk);
        continue;
      }
    }

    if (docEpoch === String(currentEpoch)) {
      activeLedgers.push({ key: tk, doc });
    } else {
      ignoredOldEpochKeys.push({ key: tk, epoch: docEpoch });
    }
  }

  if (corruptKeys.length > 0) {
    return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys, xp: null, runs: null, done: null };
  }

  // 5. 合并同代 entries（重复 entryId 合并取最大，不跳过后续条目）与 firstXp（按关卡取最大）
  const mergedEntries = new Map();
  const duplicateEntryIds = new Set();
  const mergedFirstXp = { ...baseFirstXp };
  const doneMap = { ...baseDone };

  for (const { key, doc } of activeLedgers) {
    if (doc.firstXp) {
      for (const [lessonId, pts] of Object.entries(doc.firstXp)) {
        mergedFirstXp[lessonId] = Math.max(mergedFirstXp[lessonId] ?? 0, pts);
      }
    }
    if (doc.entries) {
      for (const [entryId, ent] of Object.entries(doc.entries)) {
        if (!isPlainObject(ent)) {
          return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [key], xp: null, runs: null, done: null };
        }
        const rawXp = ent.xp ?? ent.amount ?? ent.delta ?? 0;
        const rawRuns = ent.runs ?? ent.count ?? (ent.type === "run" || ent.run === true ? 1 : 0);
        if (typeof rawXp !== "number" || !Number.isFinite(rawXp) || typeof rawRuns !== "number" || !Number.isFinite(rawRuns)) {
          return { ok: false, status: "CORRUPT_STORAGE", currentEpoch, corruptKeys: [key], xp: null, runs: null, done: null };
        }
        const normalized = {
          xp: rawXp,
          runs: rawRuns,
          done: Boolean(ent.done === true || ent.type === "done" || ent.type === "lesson"),
          firstXp: ent.firstXp === true,
          lesson: ent.lesson ?? ent.lessonId ?? null,
          type: ent.type ?? null,
        };

        if (mergedEntries.has(entryId)) {
          duplicateEntryIds.add(entryId);
          const prev = mergedEntries.get(entryId);
          mergedEntries.set(entryId, {
            xp: Math.max(prev.xp, normalized.xp),
            runs: Math.max(prev.runs, normalized.runs),
            done: prev.done || normalized.done,
            firstXp: prev.firstXp || normalized.firstXp,
            lesson: normalized.lesson ?? prev.lesson,
            type: normalized.type ?? prev.type,
          });
        } else {
          mergedEntries.set(entryId, normalized);
        }
      }
    }
  }

  // 6. 读取结束前二次核验 epoch，防止扫描过程中发生换代撕裂
  const epReadAfter = safeGetItem(EPOCH_KEY);
  if (!epReadAfter.ok) {
    return { ok: false, status: "READ_ERROR", xp: null, runs: null, done: null, error: epReadAfter.error };
  }
  const parsedEpAfter = parseEpoch(epReadAfter.value);
  if (!parsedEpAfter.valid) {
    return { ok: false, status: "CORRUPT_STORAGE", corruptKeys: [EPOCH_KEY], xp: null, runs: null, done: null, error: parsedEpAfter.error };
  }
  if (String(parsedEpAfter.value) !== String(currentEpoch)) {
    return {
      ok: false,
      status: "EPOCH_CHANGED_DURING_READ",
      epochBefore: currentEpoch,
      epochAfter: parsedEpAfter.value,
      xp: null,
      runs: null,
      done: null,
    };
  }

  // 7. 汇总最终 XP、runs 与 done
  let xp = baseXp;
  let runs = baseRuns;

  for (const ent of mergedEntries.values()) {
    if (ent.firstXp && ent.lesson) {
      mergedFirstXp[ent.lesson] = Math.max(mergedFirstXp[ent.lesson] ?? 0, ent.xp);
    } else if (ent.xp !== 0) {
      xp += ent.xp;
    }
    if (ent.done && ent.lesson) {
      doneMap[ent.lesson] = true;
    }
    if (ent.runs > 0) {
      runs += ent.runs;
    }
  }

  for (const [lessonId, pts] of Object.entries(mergedFirstXp)) {
    const alreadyInBase = Object.prototype.hasOwnProperty.call(baseFirstXp, lessonId)
      ? baseFirstXp[lessonId]
      : (baseDone[lessonId] ? pts : 0);
    if (pts > alreadyInBase) {
      xp += pts - alreadyInBase;
    }
  }

  return {
    ok: true,
    status: "OK",
    currentEpoch,
    epochSource: parsedEpBefore.source,
    baseKey,
    usedBase,
    activeLedgerKeys: activeLedgers.map((x) => x.key),
    ignoredOldEpochKeys,
    ignoredOldEpochBaseKeys,
    mergedEntryCount: mergedEntries.size,
    duplicateEntryIds: [...duplicateEntryIds].sort(),
    firstXpByLesson: mergedFirstXp,
    xp,
    runs,
    done: Object.keys(doneMap).filter((k) => !!doneMap[k]).sort(),
  };
}
