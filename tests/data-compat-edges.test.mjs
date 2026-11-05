// 数据 Schema 边界与产品官决策（防覆盖、旧导入拦截）的验收测试。纯 Node。
// 运行：node tests/data-compat-edges.test.mjs
// Case 9 / Case 10 在 hardening-1 基线上为 expected-red（等 DB-3 / DB-2）；失败不拖垮退出码。
import { normalizeDoc, mergeDocs, replaceWithGuest, emptyDoc, sumXp, guestFingerprint } from "../src/account-data.js";
import { freshState } from "../src/storage.js";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, expectedRed: false });
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
};
const checkRed = (name, ok, detail = "") => {
  results.push({ name, ok: !!ok, expectedRed: true });
  const tag = ok ? "✅ (unexpected green — DB fix landed?)" : "🔴 expected-red";
  console.log(`${tag} ${name}${detail ? "  — " + detail : ""}`);
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

// Case 9 【靶点 / expected-red until DB-3】
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
  const preserved =
    m.doc &&
    sumXp(m.doc) >= 500 &&
    !!m.doc.done.U1L2 &&
    (m.outcome === "merged" || m.outcome === "remote-newer" || m.outcome === "conflict");
  const bypassed = m.outcome === "local-newer" && sumXp(m.doc) < 500;
  checkRed(
    "Case 9 [expected-red until DB-3]: 旧备份抬高 gen 不得覆盖较新云端进度（方案1）",
    preserved && !bypassed,
    bypassed
      ? `当前被 gen 绕过：outcome=${m.outcome} xp=${m.doc ? sumXp(m.doc) : "?"}`
      : `outcome=${m?.outcome} xp=${m.doc ? sumXp(m.doc) : "err"}`,
  );
}

// Case 10 【靶点 / expected-red until DB-2】
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
  checkRed(
    "Case 10 [expected-red until DB-2]: 旧 imported=true 遇游客新进度，必须挂起选择 (guest-changed)",
    r.outcome === "guest-changed" && Array.isArray(r.choices),
    r.outcome === "already-imported"
      ? "当前代码把新进度静默丢弃 (already-imported)"
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

const hardPass = results.filter((r) => !r.expectedRed && r.ok);
const hardFail = results.filter((r) => !r.expectedRed && !r.ok);
const redPass = results.filter((r) => r.expectedRed && r.ok);
const redFail = results.filter((r) => r.expectedRed && !r.ok);
console.log("\n—— 分类汇总（软红不计全绿）——");
console.log(`当前通过: ${hardPass.length}`);
hardPass.forEach((r) => console.log(`  ✅ ${r.name}`));
console.log(`预期红(靶点): ${redFail.length} 红 + ${redPass.length} 意外转绿`);
redFail.forEach((r) => console.log(`  🔴 ${r.name}`));
redPass.forEach((r) => console.log(`  ✅ unexpected-green ${r.name}`));
console.log(`硬失败: ${hardFail.length}`);
hardFail.forEach((r) => console.log(`  ❌ ${r.name}`));
console.log(`合计断言: ${results.length}（硬断言通过 ${hardPass.length}/${hardPass.length + hardFail.length}；软红不计入全绿）`);
console.log("尚未验证: 无（Case 9/10 已用 expected-red 覆盖靶点；DB-2/DB-3 落地后改为硬断言）");
process.exit(hardFail.length ? 1 : 0);
