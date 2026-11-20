import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";

const src = fs.readFileSync(new URL("../src/sync.js", import.meta.url), "utf8");
const testCode = fs.readFileSync(new URL("./cross-tab-session-loss.test.mjs", import.meta.url), "utf8");
const SUBPROCESS_TIMEOUT_MS = 30_000;

function patchReconcileSessionDrop(source) {
  const fnAnchor = "function reconcileSession() {";
  const start = source.indexOf(fnAnchor);
  assert.notEqual(start, -1, "reconcileSession() not found in src/sync.js");
  const windowEnd = Math.min(source.length, start + 500);
  const head = source.slice(0, start);
  const slice = source.slice(start, windowEnd);
  const tail = source.slice(windowEnd);
  const target = "dropLostSession(own.reason);";
  const hit = slice.indexOf(target);
  assert.notEqual(hit, -1, "dropLostSession(own.reason); not found inside reconcileSession()");
  return head + slice.slice(0, hit) + "/* mutated: skip dropLostSession(own.reason) */" + slice.slice(hit + target.length) + tail;
}

const mutations = [
  {
    name: "disable-checkSessionOwnership",
    patch: (s) => s.replace("function checkSessionOwnership() {", "function checkSessionOwnership() { return { ok: true, active: true };"),
  },
  {
    name: "disable-post-refresh-ownership-check",
    patch: (s) => s.replace("const postOwn = checkSessionOwnership();", "const postOwn = { ok: true, active: true };"),
  },
  {
    name: "disable-loginInstanceId-check",
    patch: (s) => s.replace("if (storedInst !== loginInstanceId) return { ok: false, kind: \"lost\", reason: \"relogged-in\", currentId: p.id };", "if (false && storedInst !== loginInstanceId) return { ok: false, kind: \"lost\", reason: \"relogged-in\", currentId: p.id };"),
  },
  {
    name: "disable-expectedLogin-check",
    patch: (s) => s.replace("if (cur.sid !== ctx.expectedLogin.sid || cur.instanceId !== ctx.expectedLogin.instanceId)", "if (false)"),
  },
  {
    name: "disable-reconcileSession-lost-drop",
    patch: patchReconcileSessionDrop,
  },
];

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "glogin03-mut-"));

function runVariant(label, syncSource) {
  const modFile = path.join(tmpDir, `${label}.sync.mjs`);
  const runFile = path.join(tmpDir, `${label}.test.mjs`);
  const adjustedSync = syncSource.replace(/from "\.\/([^"]+)"/g, (_, f) => `from "${path.resolve("src", f).replace(/\\/g, "/")}"`);
  fs.writeFileSync(modFile, adjustedSync);
  const adjustedTest = testCode
    .replace("../src/sync.js", `./${label}.sync.mjs`)
    .replace(/from "\.\.\/src\/([^"]+)"/g, (_, f) => `from "${path.resolve("src", f).replace(/\\/g, "/")}"`);
  fs.writeFileSync(runFile, adjustedTest);
  return spawnSync(process.execPath, [runFile], { encoding: "utf8", timeout: SUBPROCESS_TIMEOUT_MS });
}

try {
  // 1. 先运行未变异源码对照，必须成功
  const control = runVariant("control-unmutated", src);
  assert.equal(control.error, undefined, `unmutated control errored: ${control.error?.message}`);
  assert.equal(control.status, 0, `unmutated control failed (rc=${control.status}):\n${control.stderr || control.stdout}`);

  // 2. 逐个运行变异体，必须全部被测试击杀（且不能靠超时伪装通过）
  for (const m of mutations) {
    const mutated = m.patch(src);
    assert.notEqual(mutated, src, `mutation ${m.name} did not match source`);
    const res = runVariant(m.name, mutated);
    assert.equal(res.error?.code !== "ETIMEDOUT", true, `mutation ${m.name} timed out after ${SUBPROCESS_TIMEOUT_MS}ms`);
    assert.notEqual(res.status, 0, `mutation ${m.name} unexpectedly passed!`);
  }
} finally {
  fs.rmSync(tmpDir, { recursive: true, force: true });
}
console.log("cross-tab-session-loss mutation tests passed (control ok + 5 non-equivalent mutants killed)");
