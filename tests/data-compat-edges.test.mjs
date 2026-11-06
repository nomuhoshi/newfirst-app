// 数据 Schema 边界与产品官决策（防覆盖、旧导入拦截）的验收测试。纯 Node。
// 运行：node tests/data-compat-edges.test.mjs
// Case 9 / Case 10 已是硬断言（2026-11-06，DB-3 整合）：任何一项失败 = 退出码非 0。没有「预期红」。
import { normalizeDoc, mergeDocs, replaceWithGuest, emptyDoc, sumXp, guestFingerprint } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};

console.log("=== 数据兼容与产品决策复核边界 ===\n");

// Case 4: 云端 schema 过高 → 拒绝合并
{
  const cloudHigh = { ...emptyDoc(), schema: 99, futureField: "alien" };
  const local = emptyDoc();
  const m = mergeDocs(local, cloudHigh);
  check(
    "Case 4: 云端版本过高 (Schema 99) 拒绝合并，保护本机格式",
    !!(m.error && m.error.code === "schema-newer"),
    JSON.stringify(m),
  );
  const n = normalizeDoc(cloudHigh);
  check(
    "Case 4b: normalizeDoc 单独也拒绝 schema-newer",
    n.ok === false && n.code === "schema-newer",
    JSON.stringify(n),
  );
}

// Case 9 【硬断言】
// 产品官方案 1：旧备份不得覆盖较新云端；仅抬高 gen 不能绕过；应安全合并（不丢 XP/关卡）或拒绝。
{
  const cloud = emptyDoc({ gen: 1, lineage: "A" });
  cloud.xp.devA = 500;
  cloud.done = { U1L1: "2026-11-01", U1L2: "2026-11-02" };
  cloud.runs.devA = 10;

  const backup = emptyDoc({ gen: 99, lineage: "B" });
  backup.xp.devA = 10;
  backup.done = { U1L1: "2026-11-01" };
  backup.runs.devA = 1;

  // 模拟“从旧备份恢复后与云端合并”：local=抬高 gen 的旧备份，remote=较新云端
  const m = mergeDocs(backup, cloud);
  const ok =
    m.outcome === "merged" && !!m.doc &&
    m.doc.xp.devA === 500 && m.doc.runs.devA === 10 &&
    !!m.doc.done.U1L2 && !!m.doc.done.U1L1 &&
    m.doc.gen === 1 && m.doc.lineage === "A"; // 身份留在云端，备份夺不了
  check(
    "Case 9 硬断言: 旧备份抬高 gen（不同 lineage）不得覆盖较新云端：500 XP / 10 次 / 两个关卡都在，gen 与 lineage 仍是云端的",
    ok,
    `outcome=${m?.outcome} xp=${m.doc ? JSON.stringify(m.doc.xp) : "err"} gen=${m.doc?.gen} lineage=${m.doc?.lineage}`,
  );
  const same = mergeDocs({ ...backup, lineage: "A" }, cloud);
  check(
    "Case 9b 硬断言: 虚高 gen 但 lineage 与云端相同，同样不得整份覆盖",
    same.outcome === "merged" && same.doc.xp.devA === 500 && same.doc.gen === 1 && same.doc.lineage === "A",
    `outcome=${same?.outcome} xp=${same.doc ? JSON.stringify(same.doc.xp) : "err"} gen=${same.doc?.gen}`,
  );
  const real = mergeDocs(cloud, emptyDoc({ gen: 2, lineage: "NEW" }));
  check(
    "Case 9c 硬断言: 云端代数更高（另一台设备真正换代）仍整份采用云端，旧一代不会复活",
    real.outcome === "remote-newer" && sumXp(real.doc) === 0 && real.doc.gen === 2,
    `outcome=${real?.outcome}`,
  );
}

// Case 10 【硬断言】
// 产品官：旧 imported[gid]=true + 游客又有新进度 → 必须挂起让用户选择（guest-changed），不得 already-imported 静默丢进度。
{
  const guestId = "GID_12345";
  const cloud = emptyDoc();
  cloud.imported[guestId] = true;

  const guestStateWithNewXP = {
    ...freshState(),
    onboarded: true,
    xp: 150,
    lessonsCompleted: 3,
    done: { U2L1: true, U2L2: true, U2L3: true },
    version: 3,
    streak: 1,
    lastDay: "2026-11-05",
  };

  const r = replaceWithGuest(guestStateWithNewXP, {
    deviceId: "dev1",
    guestId,
    cloudDoc: cloud,
  });
  check(
    "Case 10 硬断言: 旧 imported=true 遇游客新进度，必须挂起选择 (guest-changed)，两个选择是 keep-cloud / merge，云端文档原样不动",
    r.ok && r.outcome === "guest-changed" && r.choices?.join() === "keep-cloud,merge" && JSON.stringify(r.doc) === JSON.stringify(cloud),
    r.outcome === "already-imported"
      ? "代码把新进度静默丢弃 (already-imported)"
      : `outcome=${r.outcome}`,
  );
}

// 对照：指纹字符串导入且内容未变 → already-imported 仍合法
{
  const guestId = "GID_same";
  const guest = {
    ...freshState(),
    onboarded: true,
    xp: 40,
    lessonsCompleted: 2,
    done: { U1L1: true, U1L2: true },
    version: 3,
    streak: 1,
    lastDay: "2026-11-05",
  };
  const fp = guestFingerprint(guest);
  const cloud = emptyDoc();
  cloud.imported[guestId] = fp;
  const r = replaceWithGuest(guest, { deviceId: "dev1", guestId, cloudDoc: cloud });
  check(
    "对照: imported 记了相同指纹且内容未变 → already-imported（合法）",
    r.ok && r.outcome === "already-imported",
    JSON.stringify({ outcome: r.outcome, fp }),
  );
}

const failed = results.filter((r) => !r.ok);
console.log(`\n数据兼容边界：共 ${results.length} 项，硬失败 ${failed.length} 项，预期红 0 项`);
failed.forEach((r) => console.log(`  ❌ ${r.name}`));
process.exit(failed.length ? 1 : 0);
