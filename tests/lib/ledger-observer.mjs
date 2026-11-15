// Independent, read-only projection of the canonical v4 progress fields.
// Self-contained so Playwright can serialize it into a static observer page.
export function observeSuipianV4Storage(storage) {
  const epochKey = "suipian.v4.epoch", basePrefix = "suipian.v4.base.", tabPrefix = "suipian.v4.tab.";
  const object = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
  const num = (v) => Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0;
  const failure = (status) => ({ ok: false, status, xp: null, runs: null, done: null });
  try {
    if (storage === undefined) storage = globalThis.localStorage;
    // The production pointer is an opaque string, not JSON. Absent/empty means m0.
    const rawEpoch = storage.getItem(epochKey);
    if (rawEpoch !== null && typeof rawEpoch !== "string") return failure("CORRUPT_STORAGE");
    const currentEpoch = rawEpoch || "m0", baseKey = basePrefix + currentEpoch;
    const baseRaw = storage.getItem(baseKey);
    if (baseRaw === null) return failure("MISSING_BASE");
    let base;
    try { base = JSON.parse(baseRaw); } catch { return failure("CORRUPT_STORAGE"); }
    if (!object(base) || base.v !== 4 || base.epoch !== currentEpoch || !object(base.s)) return failure("CORRUPT_STORAGE");
    const baseDone = base.s.done ?? {};
    if (!object(baseDone)) return failure("CORRUPT_STORAGE");
    const done = new Set(Object.keys(baseDone).filter((lesson) => !!baseDone[lesson]));
    const entries = new Map(), duplicateIds = new Set(), firstXp = new Map();
    const activeLedgerKeys = [], ignoredOldEpochKeys = [], ignoredOldEpochBaseKeys = [];
    const tabKeys = [], length = storage.length;
    for (let i = 0; i < length; i++) {
      const key = storage.key(i);
      if (typeof key !== "string") return failure("STORAGE_CHANGED_DURING_READ");
      if (key.startsWith(tabPrefix)) tabKeys.push(key);
      if (key.startsWith(basePrefix) && key !== baseKey) ignoredOldEpochBaseKeys.push(key);
    }
    if (new Set(tabKeys).size !== tabKeys.length) return failure("STORAGE_CHANGED_DURING_READ");
    for (const key of tabKeys.sort()) {
      const raw = storage.getItem(key);
      if (raw === null) return failure("STORAGE_CHANGED_DURING_READ");
      let doc;
      try { doc = JSON.parse(raw); } catch { return failure("CORRUPT_STORAGE"); }
      // Match scanEntries' envelope checks before filtering old generations.
      if (!object(doc) || doc.v !== 4 || typeof doc.epoch !== "string" || !object(doc.entries)) return failure("CORRUPT_STORAGE");
      if (doc.epoch !== currentEpoch) { ignoredOldEpochKeys.push({ key, epoch: doc.epoch }); continue; }
      activeLedgerKeys.push(key);
      for (const [id, entry] of Object.entries(doc.entries)) {
        if (!object(entry)) return failure("CORRUPT_STORAGE");
        const entryDone = entry.done ?? {}, entryFirstXp = entry.firstXp ?? {};
        if (!object(entryDone) || !object(entryFirstXp)) return failure("CORRUPT_STORAGE");
        if (entries.has(id)) duplicateIds.add(id);
        const previous = entries.get(id) ?? { xp: 0, runs: 0 };
        entries.set(id, { xp: Math.max(previous.xp, num(entry.xp)), runs: Math.max(previous.runs, num(entry.runs)) });
        for (const [lesson, complete] of Object.entries(entryDone)) if (complete) done.add(lesson);
        for (const [lesson, points] of Object.entries(entryFirstXp)) firstXp.set(lesson, Math.max(firstXp.get(lesson) ?? 0, num(points)));
      }
    }
    const rawEpochAfter = storage.getItem(epochKey);
    if (rawEpochAfter !== null && typeof rawEpochAfter !== "string") return failure("CORRUPT_STORAGE");
    if ((rawEpochAfter || "m0") !== currentEpoch) return failure("EPOCH_CHANGED_DURING_READ");
    let xp = num(base.s.xp), runs = num(base.s.lessonsCompleted);
    for (const entry of entries.values()) { xp += entry.xp; runs += entry.runs; }
    for (const [lesson, points] of firstXp) if (!baseDone[lesson]) xp += points;
    return {
      ok: true, status: "OK", currentEpoch, baseKey, usedBase: true,
      xp, runs, done: [...done].sort(), activeLedgerKeys,
      ignoredOldEpochKeys, ignoredOldEpochBaseKeys: ignoredOldEpochBaseKeys.sort(),
      mergedEntryCount: entries.size, duplicateEntryIds: [...duplicateIds].sort(),
      firstXpByLesson: Object.fromEntries(firstXp),
    };
  } catch {
    return failure("READ_ERROR");
  }
}
