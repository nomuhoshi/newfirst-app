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
  const R1_TESTS = ["pending-import-corrupt-guard.test.mjs", "r1-exit-interaction.test.mjs", "r1-logout-integration.test.mjs", "pending-import-quarantine.test.mjs", "auth-cleanup-race.test.mjs"]; // node:test 风格，失败行以 "not ok" 开头
  for (const t of R1_TESTS) cpSync(join(ROOT, "tests", t), join(W, "tests", t));
  writeFileSync(join(W, "package.json"), JSON.stringify({ type: "module" }));

  const run = (file = TMP_TEST) => spawnSync(process.execPath, [file], { cwd: W, encoding: "utf8", timeout: 120000 });
  const baseline = run();
  check("未改源码的对照：专项测试全绿", baseline.status === 0, (baseline.stdout + baseline.stderr).split("\n").slice(-4).join(" | "));
  for (const t of R1_TESTS) { const b = run(join(W, "tests", t)); check("未改源码的对照：" + t + " 全绿", b.status === 0, (b.stdout + b.stderr).split("\n").slice(-4).join(" | ")); }

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
      from: "return rf.sessionState === \"dead\" ? { ok: true, alreadyInvalid: true } : fail(rf);",
      to: "return { ok: true, alreadyInvalid: true };",
    },
    {
      name: "DB-3.1：cloud-api 丢掉 error_code",
      file: "cloud-api.js",
      from: "...(errorCode ? { errorCode } : {})",
      to: "...{}",
    },
    {
      name: "DB-3.1：留下凭证后不记它的 refresh token（被别的标签页换过也照删）",
      file: "sync.js",
      from: "leftoverAuth = true; leftoverRt = leftRt;",
      to: "leftoverAuth = true; leftoverRt = null;",
    },
    {
      name: "DB-3.1：再次清理不读回确认就宣称成功",
      file: "sync.js",
      from: "    if (cleared.ok) {\n      const after = inspectAuth(); // 读回：必须确认已经没有可用凭证\n      if (after.state === \"absent\" || after.state === \"inert\") { leftoverAuth = false; leftoverRt = null; return { ok: true }; }\n    }",
      to: "    { leftoverAuth = false; leftoverRt = null; return { ok: true }; }",
    },
    {
      name: "DB-3.1：账号指针有账号（别的标签页在登录）也允许清理",
      file: "sync.js",
      from: "if (p.id) return { ok: false, kind: \"logged-in\", message: \"这台设备上已经有账号在登录",
      to: "if (false) return { ok: false, kind: \"logged-in\", message: \"这台设备上已经有账号在登录",
    },
    {
      name: "DB-3.1：别的标签页已登录时 hasLeftoverAuth 仍说有残留",
      file: "sync.js",
      from: "if (p.id) return false;  // 别的标签页",
      to: "if (false) return false;  // 别的标签页",
    },
    {
      name: "DB-3.1：refresh 的 auth 类失败（通用 403/404/400）一律当会话已死（208ee2e 的 P1）",
      file: "sync.js",
      from: "return rf.sessionState === \"dead\" ? { ok: true, alreadyInvalid: true } : fail(rf);",
      to: "return rf.kind === \"auth\" ? { ok: true, alreadyInvalid: true } : fail(rf);",
    },
    {
      name: "DB-3.1：退出前 ensureToken 失败只看 kind=auth 就继续退出",
      file: "sync.js",
      from: "if (!t.ok && t.sessionState !== \"dead\") return",
      to: "if (!t.ok && t.kind !== \"auth\") return",
    },
    {
      name: "DB-3.1：refresh 有明确错误码也不按错误码判断（任何错误码都算已死）",
      file: "cloud-api.js",
      from: "if (r.errorCode) return REFRESH_DEAD_CODES.has(r.errorCode);",
      to: "if (r.errorCode) return true;",
    },
    {
      name: "DB-3.1：老版本无错误码的 refresh 失败一律算已死",
      file: "cloud-api.js",
      from: "return r.oauthError === \"invalid_grant\" || /^Invalid Refresh Token/i.test(String(r.message || \"\"));",
      to: "return true;",
    },
    {
      name: "DB-3.1：refresh 判断不看状态码（404 路由不存在配上 dead 码也算）",
      file: "cloud-api.js",
      from: "if (r.status !== 400 && r.status !== 401 && r.status !== 403) return false;\n  if (r.errorCode)",
      to: "if (r.errorCode)",
    },
    {
      name: "DB-3.1：cloud-api 丢掉 refresh 失败的 oauthError",
      file: "cloud-api.js",
      from: "...(oauthError ? { oauthError } : {})",
      to: "...{}",
    },
    {
      name: "DB-3.1：bad_jwt 核实前不采用别的标签页刚轮换的令牌",
      file: "sync.js",
      from: "      adoptStoredSession(); // 别的标签页可能刚轮换过刷新令牌",
      to: "      // (不采用)",
    },
    {
      name: "DB-3.1：refresh 的 dead 标记没有透传",
      file: "cloud-api.js",
      from: "return classifyRefreshFailure(r) ? { ...base, sessionState: \"dead\" } : base;",
      to: "return base;",
    },
    {
      name: "R1×退出：损坏待办下普通退出不再被拦（继续联网退出）",
      file: "sync.js",
      test: "r1-logout-integration.test.mjs",
      from: "if (!dropping) return guard; // 普通退出不能把损坏待办当成已完成。",
      to: "// (不拦)",
    },
    {
      name: "R1×退出：强制退出清凭证只看有没有抛错、不读回（先删后报错会被误判为失败）",
      file: "sync.js",
      test: "r1-logout-integration.test.mjs",
      from: "try { storage.removeItem(AUTH_KEY); } catch {}\n      try { authCleared = storage.getItem(AUTH_KEY) === null; } catch {}",
      to: "try { storage.removeItem(AUTH_KEY); authCleared = storage.getItem(AUTH_KEY) === null; } catch {}",
    },
    {
      name: "R1×退出：强制退出凭证没清掉也宣称成功",
      file: "sync.js",
      test: "r1-logout-integration.test.mjs",
      from: "if (!authCleared) {",
      to: "if (false) {",
    },
    {
      name: "R1×退出：强制退出账号指针没清掉也宣称成功",
      file: "sync.js",
      test: "r1-logout-integration.test.mjs",
      from: "if (!sessionRemoved || !sessionGone) {",
      to: "if (false) {",
    },
    {
      name: "R1×退出：凭证清理失败后不回滚账号指针（半退出）",
      file: "sync.js",
      test: "r1-logout-integration.test.mjs",
      from: "        const rollback = setCurrentAccount(storage, uid);\n        let restored = false;\n        try { restored = storage.getItem(SESSION_KEY) === uid; } catch {}\n        return { ok: false, kind: \"local\", pending: true, rollbackFailed: !rollback || !restored,\n          message: restored ? \"本机凭证清理失败",
      to: "        const rollback = true;\n        let restored = true;\n        return { ok: false, kind: \"local\", pending: true, rollbackFailed: !rollback || !restored,\n          message: restored ? \"本机凭证清理失败",
    },
    {
      name: "清理残留：账号指针读不出来也当成“没有别的标签页”，照删凭证",
      file: "sync.js",
      from: "if (!p.ok) return { ok: false, kind: \"read-failed\", message: \"无法读取本机的登录状态",
      to: "if (false) return { ok: false, kind: \"read-failed\", message: \"无法读取本机的登录状态",
    },
    {
      name: "清理残留：凭证读取抛错被当成“没有凭证”",
      file: "sync.js",
      from: "try { raw = storage.getItem(AUTH_KEY); } catch { return { state: \"read-failed\" }; }",
      to: "try { raw = storage.getItem(AUTH_KEY); } catch { return { state: \"absent\" }; }",
    },
    {
      name: "清理残留：getItem 静默返回 undefined 不算读取失败",
      file: "sync.js",
      from: "    if (typeof raw !== \"string\") return { state: \"read-failed\" };\n",
      to: "",
    },
    {
      name: "清理残留：readCurrentAccount 把静默的非字符串读取当成“没有账号”",
      file: "account-store.js",
      from: "(r.value !== null && typeof r.value !== \"string\")",
      to: "false",
    },
    {
      name: "清理残留：不比对留下的那份凭证，别的标签页换过的也删",
      file: "sync.js",
      from: "if (leftoverRt && a.session.refreshToken !== leftoverRt)",
      to: "if (false)",
    },
    {
      name: "清理残留：动手前不再确认账号指针",
      file: "sync.js",
      from: "if (!p2.ok || p2.id) return",
      to: "if (false) return",
    },
    {
      name: "清理残留：账号指针读不出来时界面不给入口（hasLeftoverAuth 说 false）",
      file: "sync.js",
      from: "if (!p.ok) return true;  //",
      to: "if (!p.ok) return false;  //",
    },
    {
      name: "清理残留：凭证读不出来时 hasLeftoverAuth 说没有",
      file: "sync.js",
      from: "return a.state === \"ours\" || a.state === \"read-failed\";",
      to: "return a.state === \"ours\";",
    },
    {
      name: '恢复：备份失败也照样删原待办',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (!bk.ok) return fail(\"backup-failed\"",
      to: "if (false) return fail(\"backup-failed\"",
    },
    {
      name: '恢复：备份读回不校验（写进去的东西不对也算备份成功）',
      file: "account-store.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (!back.ok || typeof back.value !== \"string\" || !same(back.value)) return",
      to: "if (!back.ok) return",
    },
    {
      name: '恢复：同一个备份键里是别的内容也当成同一份（覆盖 / 误复用）',
      file: "account-store.js",
      test: "pending-import-quarantine.test.mjs",
      from: "return same(existing.value) ? { ok: true, key, digest, reused: true } : { ok: false, code: \"backup-conflict\" };",
      to: "return { ok: true, key, digest, reused: true };",
    },
    {
      name: '恢复：读取失败（非字符串）也当成待办原文去隔离',
      file: "account-store.js",
      test: "pending-import-quarantine.test.mjs",
      from: "const r = safeRead(storage, pendingImportKey(userId));\n  if (!r.ok || (r.value !== null && typeof r.value !== \"string\")) return { ok: false };\n  return { ok: true, raw: r.value };",
      to: "const r = safeRead(storage, pendingImportKey(userId));\n  if (!r.ok) return { ok: false };\n  return { ok: true, raw: r.value };",
    },
    {
      name: '恢复：删除原待办后不读回确认（删不掉也宣称恢复成功）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (r3.raw === raw) return fail(\"remove-failed\"",
      to: "if (false) return fail(\"remove-failed\"",
    },
    {
      name: '恢复：删除前不复核待办原文（别的标签页换了新待办也删）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (r2.raw !== raw) return fail(\"pending-changed\"",
      to: "if (false) return fail(\"pending-changed\"",
    },
    {
      name: '恢复：删除前不复核账号指针（别的标签页换了账号也删）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (!sameAccount()) return fail(\"account-changed\", \"登录的账号刚刚变了",
      to: "if (false) return fail(\"account-changed\", \"登录的账号刚刚变了",
    },
    {
      name: '恢复：用户确认的那份和现在不是同一份也继续（不比对摘要）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (expectedDigest && expectedDigest !== digest)",
      to: "if (false)",
    },
    {
      name: '恢复：隔离时顺手删了游客记录',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "    pending = true;\n    setStatus(\"pending\", \"已备份并移除损坏的游客导入待办。",
      to: "    try { storage.removeItem(\"suipian.progress\"); } catch {}\n    pending = true;\n    setStatus(\"pending\", \"已备份并移除损坏的游客导入待办。",
    },
    {
      name: '恢复：隔离过程联网',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "    const bk = backupCorruptPending(",
      to: "    await api.getProgress(session);\n    const bk = backupCorruptPending(",
    },
    {
      name: '恢复：完好的待办也允许隔离',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (parsed.ok) return fail(\"not-corrupt\"",
      to: "if (false) return fail(\"not-corrupt\"",
    },
    {
      name: '恢复：云端已导入过也再弹选择（重复导入风险）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "if (!guestHas || importStatus === \"same\") {",
      to: "if (!guestHas) {",
    },
    {
      name: '恢复：重新选择不先刷新令牌（挂起期间的旧令牌被写回存储）',
      file: "sync.js",
      test: "pending-import-quarantine.test.mjs",
      from: "      const tk = await ensureToken();",
      to: "      const tk = { ok: true }; void ensureToken;\n      void 0;",
    },
    {
      name: '清理残留：删除前不比对原文（盲删，别的标签页刚写的登录凭证也删）',
      file: "sync.js",
      test: "auth-cleanup-race.test.mjs",
      from: "    if (c.v !== expectRaw) return { ok: false, changed: true };\n    try { storage.removeItem(AUTH_KEY); } catch {}",
      to: "    try { storage.removeItem(AUTH_KEY); } catch {}",
    },
    {
      name: '清理残留：写撤销标记前不比对（用撤销标记覆盖别的标签页的新凭证）',
      file: "sync.js",
      test: "auth-cleanup-race.test.mjs",
      from: "    if (c.v !== expectRaw) return { ok: false, changed: true }; // 删除期间被换成了别的内容：那是别人的登录，绝不能再覆盖\n",
      to: "",
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
    const r = m.test ? run(join(W, "tests", m.test)) : run();
    const output = (r.stdout || "") + (r.stderr || "");
    const red = output.split("\n").filter((line) => line.startsWith("❌") || line.startsWith("not ok")).length;
    check(`故障注入「${m.name}」被测试抓到（不是永远通过）`, r.status !== 0 && red > 0, `退出码 ${r.status}，变红 ${red} 项`);
  }
} finally {
  rmSync(W, { recursive: true, force: true });
}
const failed = results.filter((r) => !r).length;
console.log(`\n反向验证：共 ${results.length} 项，失败 ${failed} 项`);
process.exit(failed ? 1 : 0);
