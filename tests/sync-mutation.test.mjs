// 反向验证：把关键隔离逻辑故意拆掉，登录/同步专项测试必须变红。
// 做法：把 src/ 和专项测试复制到临时目录，只改一处源码，再跑同一个测试文件；不改工作区文件。
// 运行：node tests/sync-mutation.test.mjs
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const TEST = join("tests", "login-sync-hardening.test.mjs");
const results = [];
const check = (name, ok, detail = "") => { results.push(!!ok); console.log(`${ok ? "✅" : "❌"} ${name}${!ok && detail ? "  — " + detail : ""}`); };

const W = mkdtempSync(join(tmpdir(), "sp-sync-mutation-"));
const TMP_SRC = join(W, "src"), TMP_TEST = join(W, TEST);
function resetSource() {
  rmSync(TMP_SRC, { recursive: true, force: true });
  cpSync(join(ROOT, "src"), TMP_SRC, { recursive: true });
}
try {
  resetSource();
  cpSync(join(ROOT, "tests", "fixtures"), join(W, "tests", "fixtures"), { recursive: true });
  cpSync(join(ROOT, TEST), TMP_TEST);
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));

  const run = () => spawnSync(process.execPath, [TMP_TEST], { cwd: W, encoding: "utf8", timeout: 60000 });
  const baseline = run();
  check("未改源码的对照：专项测试全绿", baseline.status === 0, (baseline.stdout + baseline.stderr).split("\n").slice(-4).join(" | "));

  const mutations = [
    {
      name: "项目命名空间失效（两个 Supabase 项目共用本机键）",
      file: "sync.js",
      from: 'return projectId && projectId !== "cloud-off"',
      to: 'return false && projectId !== "cloud-off"',
    },
    {
      name: "XP 合并改成相加（重复同步会重复加分）",
      file: "account-data.js",
      from: "out[field][k] = Math.max(L[field][k] ?? 0, R[field][k] ?? 0);",
      to: "out[field][k] = (L[field][k] ?? 0) + (R[field][k] ?? 0);",
    },
    {
      name: "凭证项目检查失效（错误项目的令牌会被拿去联网）",
      file: "sync.js",
      from: "if (projectId && (r.project || legacyProject) !== projectId) {",
      to: "if (false) {",
    },
    {
      name: "强制退出也删除未上传的本机副本",
      file: "sync.js",
      from: "const localOk = keepCopy ? setCurrentAccount(storage, null) : logoutLocal(storage, uid);",
      to: "const localOk = logoutLocal(storage, uid);",
    },
    {
      name: "测试入口的 localhost 覆盖不检查正式项目",
      file: "cloud-config.js",
      from: 'if (IS_PREVIEW && isProdUrl(url)) return { url: "", anonKey: "" };',
      to: 'if (false) return { url: "", anonKey: "" };',
    },
    {
      name: "旧 true 格式一律当作已导入（游客有学习记录也被静默忽略）",
      file: "account-data.js",
      from: 'if (prev === true) return "unknown";',
      to: 'if (prev === true) return "same";',
    },
    {
      name: "安全合并改回 gen+1 整份覆盖（清掉其他设备数据）",
      file: "account-data.js",
      from: "const out = clone(c.doc);",
      to: "const out = emptyDoc({ gen: c.doc.gen + 1, lineage: c.doc.lineage });",
    },
    {
      name: "保留云端不写游客指纹（同一游客每次登录重复弹窗）",
      file: "account-data.js",
      from: "doc.imported = { ...imported, [guestId]: fp };",
      to: "doc.imported = imported;",
    },
    {
      name: "保留云端失败时把带新指纹的文档存成本机干净副本（提前标完成）",
      file: "sync.js",
      from: "const localDoc = p.ok ? p.doc : base;",
      to: "const localDoc = p.ok ? doc : base;",
    },
    {
      name: "专用待办重开 / 重连后不重试（只靠普通同步）",
      file: "sync.js",
      from: "if (pi.record) {",
      to: "if (false && pi.record) {",
    },
    {
      name: "重试成功后不清专用待办（永远停在待同步）",
      file: "sync.js",
      from: "if (!clearPendingImport(storage, uid)) {",
      to: "if (false && !clearPendingImport(storage, uid)) {",
    },
    {
      name: "旧 true 覆盖待上传的新指纹（下次登录重复弹窗）",
      file: "account-data.js",
      from: `  out.imported = { ...L.imported };
  for (const [k, v] of Object.entries(R.imported)) {
    const prev = out.imported[k];
    if (typeof prev === "string" && FP_RE.test(prev) && v === true) continue; // 旧 true 不覆盖有效指纹
    out.imported[k] = v;
  }`,
      to: "  out.imported = { ...L.imported, ...R.imported };",
    },
    {
      name: "保留云端读回不校验（没读回就标完成）",
      file: "sync.js",
      from: `    if (!verified) {
      const p = preserveLocalChanges(uid, doc, lastCloud);`,
      to: `    if (false) {
      const p = preserveLocalChanges(uid, doc, lastCloud);`,
    },
    {
      name: "安全合并上传失败也谎报已同步",
      file: "sync.js",
      from: `synced: false, verified: false, guestCleared: false, saved: true, pending: true, kind, error: error || "合并冲突太多次，请稍后再试"`,
      to: `synced: true, verified: true, guestCleared: false, saved: true, pending: false, kind, error: ""`,
    },
    {
      name: "安全合并读回不校验（读回不一致也删游客）",
      file: "sync.js",
      from: `    if (!verified) {
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);`,
      to: `    if (false) {
      const localDoc = withoutGuestImport(doc, guestId, lastCloud);`,
    },
    {
      name: "游客删除失败 / 待办未清时仍显示已同步",
      file: "sync.js",
      from: 'if (synced && result.verified !== false && !result.pending) setStatus("synced");',
      to: 'if (synced && result.verified !== false) setStatus("synced");',
    },
    {
      name: "删游客前不核对快照（会误删重试期间游客新学的内容）",
      file: "sync.js",
      from: "if (gnow.status === \"ok\" && gnow.raw === record.guestRaw) {",
      to: "if (gnow.status === \"ok\") {",
    },
    {
      name: "清游客时不核对快照原文（clearGuestAfterVerified 失去最后一道防线）",
      file: "account-store.js",
      from: "if (!cur.ok || cur.value !== guestSnapshotRaw) return false;",
      to: "if (!cur.ok) return false;",
    },
    {
      name: "安全合并重试把游客 XP 再加一次（按设备取较大值改成相加）",
      file: "account-data.js",
      from: "if (gxp > 0 || Object.hasOwn(out.xp, deviceId)) out.xp[deviceId] = Math.max(out.xp[deviceId] ?? 0, gxp);",
      to: "if (gxp > 0 || Object.hasOwn(out.xp, deviceId)) out.xp[deviceId] = (out.xp[deviceId] ?? 0) + gxp;",
    },
    {
      name: "安全合并失败时本机副本不标 dirty.content（重试前会被当成已同步）",
      file: "sync.js",
      from: "const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: true };\n      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy))",
      to: "const dirty = { hearts: !!first.copy?.dirty.hearts, prefs: !!first.copy?.dirty.prefs, content: false };\n      if (!saveLoginCopy(uid, localDoc, lastBase, dirty, !first.copy))",
    },
    {
      name: "普通退出在 signOut 失败时仍清掉登录",
      file: "sync.js",
      from: "    if (!rv.ok) {\n      const rb = rollbackLocal(uid, c.snap);",
      to: "    if (false) {\n      const rb = rollbackLocal(uid, c.snap);",
    },
    {
      name: "五次冲突后仍盲目重试",
      file: "sync.js",
      from: 'return { ok: false, kind: "server", retryable: false, message: "同步冲突太多次，请稍后再试" };',
      to: 'return { ok: false, kind: "server", retryable: true, message: "同步冲突太多次，请稍后再试" };',
    },
    {
      name: "冲突用尽后仍当成可重试的网络错误",
      file: "sync.js",
      from: 'if (!kind) kind = "conflict";',
      to: 'if (!kind) kind = "server";',
    },
    {
      name: "清单12：虚高 gen 的旧备份可以整份覆盖云端",
      file: "account-data.js",
      from: 'if (L.gen > R.gen) return { doc: mergeLearning(L, R, opts, R), outcome: "merged" };',
      to: 'if (L.gen > R.gen) return { doc: L, outcome: "local-newer" };',
    },
    {
      name: "清单12：旧备份合并后抢走云端的 gen / lineage 身份",
      file: "account-data.js",
      from: 'if (L.gen > R.gen) return { doc: mergeLearning(L, R, opts, R), outcome: "merged" };',
      to: 'if (L.gen > R.gen) return { doc: mergeLearning(L, R, opts, L), outcome: "merged" };',
    },
    {
      name: "清单12：同步用副本里的旧 base rev 去写云端（而不是刚读到的 rev）",
      file: "sync.js",
      from: "const s = await api.saveProgress(session, remote.row.rev, finalDoc);",
      to: "const s = await api.saveProgress(session, copy.base ?? remote.row.rev, finalDoc);",
    },
    {
      name: "清单15：旧 true + 游客有学习记录被当成 same（Case 10 静默丢进度）",
      file: "account-data.js",
      from: 'if (prev === true) return "unknown";',
      to: 'if (prev === true) return "same";',
    },
    {
      name: "DB-3：普通同步忽略本机写回失败（谎报 synced）",
      file: "sync.js",
      from: "if (!localSaved) {",
      to: "if (false && !localSaved) {",
    },
    {
      name: "DB-3：强制退出不核对凭证是否真的清掉",
      file: "sync.js",
      from: "const authOk = localOk && (!clearAuth || clearStoredAuthVerified());",
      to: "const authOk = localOk && (!clearAuth || (clearStoredAuthVerified(), true));",
    },
    {
      name: "DB-3.1：退出不带 scope（Supabase 默认 global，会把其他设备一起踢掉）",
      file: "sync.js",
      from: 'let so = await api.signOut(sess, "local");',
      to: 'let so = await api.signOut(sess);',
    },
    {
      name: "DB-3.1：cloud-api 的 logout 请求不带 scope 参数",
      file: "cloud-api.js",
      from: 'query: "scope=" + sc',
      to: 'query: undefined',
    },
    {
      name: "DB-3.1：普通退出先撤销云端会话、再清本机（本机失败时云端已不可逆）",
      file: "sync.js",
      from: `    const c = cleanLocal(uid, { clearAuth: false, keepCopy: false });
    if (!c.ok) return c.result;
    const rv = await revokeCloudSession(session, {`,
      to: `    const rv0 = await revokeCloudSession(session);
    const c = cleanLocal(uid, { clearAuth: false, keepCopy: false });
    if (!c.ok) return c.result;
    const rv = rv0; ({`,
    },
    {
      name: "DB-3.1：强制退出先撤销云端会话、再清本机",
      file: "sync.js",
      from: `      const c = cleanLocal(uid, { clearAuth: true, keepCopy });
      if (!c.ok) return c.result;
      if (forceLocal)`,
      to: `      if (!forceLocal) await revokeCloudSession(sess);
      const c = cleanLocal(uid, { clearAuth: true, keepCopy });
      if (!c.ok) return c.result;
      if (forceLocal)`,
    },
    {
      name: "DB-3.1：forceLocalLogout 也去联网撤销云端会话（不再是纯本机退出）",
      file: "sync.js",
      from: "if (forceLocal) { finishLocalLogout();",
      to: "if (false) { finishLocalLogout();",
    },
    {
      name: "DB-3.1：云端 signOut 失败后不回滚本机（副本和指针已删却还停在登录）",
      file: "sync.js",
      from: "      const rb = rollbackLocal(uid, c.snap);\n      const message = rb.all",
      to: "      const rb = { all: true, copyRestored: true, accountRestored: true };\n      const message = rb.all",
    },
    {
      name: "DB-3.1：session_not_found 也被当成失败，退出卡死",
      file: "sync.js",
      from: "if (so.sessionState === \"gone\") return { ok: true, alreadyInvalid: true };\n      if (so.sessionState !== \"token-invalid\") return fail(so);",
      to: "if (so.sessionState !== \"token-invalid\") return fail(so);",
    },
    {
      name: "DB-3.1：通用 403 / 路由 404 被当成“会话已失效”（假退出）",
      file: "cloud-api.js",
      from: "if (SESSION_GONE_CODES.has(code)) return \"gone\";",
      to: "if (SESSION_GONE_CODES.has(code) || r.status === 403 || r.status === 404) return \"gone\";",
    },
    {
      name: "DB-3.1：bad_jwt 不核实 refresh token 就当已退出",
      file: "sync.js",
      from: "if (so.sessionState !== \"token-invalid\") return fail(so);",
      to: "if (so.sessionState === \"token-invalid\") return { ok: true, alreadyInvalid: true };\n      return fail(so);",
    },
    {
      name: "DB-3.1：bad_jwt 刷新后没更新回滚快照（回滚会恢复已被轮换作废的旧凭证）",
      file: "sync.js",
      from: "      if (onSession) onSession();\n",
      to: "",
    },
    {
      name: "DB-3.1：bad_jwt 时断网无法核实也当成已退出",
      file: "sync.js",
      from: "return rf.kind === \"auth\" ? { ok: true, alreadyInvalid: true } : fail(rf);",
      to: "return { ok: true, alreadyInvalid: true };",
    },
    {
      name: "DB-3.1：cloud-api 丢掉 error_code",
      file: "cloud-api.js",
      from: "...(errorCode ? { errorCode } : {})",
      to: "",
    },
    {
      name: "DB-3.1：云端撤销后凭证清不掉，不留残留标记",
      file: "sync.js",
      from: "      leftoverAuth = true;\n      const until",
      to: "      leftoverAuth = false;\n      const until",
    },
    {
      name: "DB-3.1：再次清理不读回确认就宣称成功",
      file: "sync.js",
      from: "if (clearStoredAuthVerified()) { leftoverAuth = false; return { ok: true }; }",
      to: "clearStoredAuthVerified(); leftoverAuth = false; return { ok: true };",
    },
    {
      name: "DB-3.1：登录中也允许“清理残留凭证”（会清掉在用的凭证）",
      file: "sync.js",
      from: "if (userId || getCurrentAccount(storage)) return { ok: false, kind: \"logged-in\"",
      to: "if (false) return { ok: false, kind: \"logged-in\"",
    },
    {
      name: "DB-3.1：别的标签页已登录时仍把凭证当残留",
      file: "sync.js",
      from: "if (userId || getCurrentAccount(storage)) return false;",
      to: "if (userId) return false;",
    },
    {
      name: "删号后本机清理失败仍宣称成功",
      file: "sync.js",
      from: `        ok: false,
        kind: "local-cleanup",`,
      to: `        ok: true,
        kind: "local-cleanup",`,
    },
  ];

  for (const m of mutations) {
    resetSource();
    const path = join(TMP_SRC, m.file);
    const before = readFileSync(path, "utf8");
    if (!before.includes(m.from)) { check(`故障注入「${m.name}」能施加到源码上`, false, "找不到要替换的代码"); continue; }
    writeFileSync(path, before.replace(m.from, m.to));
    const r = run();
    const output = (r.stdout || "") + (r.stderr || "");
    const red = output.split("\n").filter((line) => line.startsWith("❌")).length;
    check(`故障注入「${m.name}」被测试抓到（不是永远通过）`, r.status !== 0 && red > 0, `退出码 ${r.status}，变红 ${red} 项`);
  }
} finally {
  rmSync(W, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n反向验证：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
