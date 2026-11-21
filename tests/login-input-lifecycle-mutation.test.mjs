// G-LOGIN-07：先跑未变异对照，再验证单点改坏由指定断言检出；崩溃 / 超时不算检出。
import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
const W = mkdtempSync(join(tmpdir(), "g07-lifecycle-"));
const TEST = "tests/login-input-lifecycle.test.mjs";
const MUTS = [
  ["格式校验取消", '!/^\\d{6}$/.test(c)', "false", "G07_FORMAT"],
  ["粘贴空白不再归一化", 'input.value.replace(/\\s+/g, "")', "input.value.trim()", "G07_VALID_PASTE"],
  ["发送时不锁输入", "busy = true; input.disabled = true;", "busy = true; input.disabled = false;", "G07_EMAIL_BUSY"],
  ["验证码处理时不锁输入", "input.disabled = busy;\n          if (changeEmail)", "input.disabled = false;\n          if (changeEmail)", "G07_CODE_BUSY"],
  ["处理中换邮箱可点", "changeEmail.disabled = busy;", "changeEmail.disabled = false;", "G07_CODE_BUSY"],
  ["处理中验证码页退出可点", "leaveCode.disabled = busy;", "leaveCode.disabled = false;", "G07_CODE_BUSY"],
  ["取消后令牌仍发码", "if (!isCurrent(op)) return cancelled(); // 取令牌时已取消", "// 取令牌时已取消", "G07_TOKEN_CANCEL"],
  ["旧发送结果仍翻页", "if (!isCurrent(op)) return; // 取消 / 重开后", "// 取消 / 重开后", "G07_CLOSED_SEND_DOM"],
  ["旧验证结果仍改旧弹窗", "if (!isCurrent(op)) return;\n          if (r.discarded)", "if (r.discarded)", "G07_CLOSED_VERIFY_DOM"],
  ["关闭未清倒计时", "clearInterval(cooldownTimer); clearTimeout(focusTimer);", "clearTimeout(focusTimer);", "G07_TIMER_RELEASE"],
  ["关闭未清延迟聚焦", "clearInterval(cooldownTimer); clearTimeout(focusTimer);", "clearInterval(cooldownTimer);", "G07_TIMER_RELEASE"],
  ["关闭未解绑键盘监听", 'vv?.removeEventListener("resize", onVv);', "", "G07_VV_RELEASE"],
  ["关闭未解绑可见性监听", 'document.removeEventListener("visibilitychange", onVis);', "", "G07_VIS_RELEASE"],
  ["清理不幂等", "if (finished) return;", "", "G07_DESTROY_ONCE"],
  ["关闭钩子未接清理", "cleanup(); if (cancelledChoice)", "if (cancelledChoice)", "G07_CLOSE_HOOK"],
  ["关闭未作废已验证会话", "loginDialog = null; sync.clearVerified?.();", "loginDialog = null;", "G07_CLOSE_HOOK"],
  ["重复打开创建多个弹窗", "if (loginDialog) return loginDialog.close;", "", "G07_SINGLE_DIALOG"],
  ["旧输入事件清新会话", "if (!isCurrent()) return; if (retryMode && !busy)", "if (retryMode && !busy)", "G07_OLD_CLEANUP"],
];
try {
  mkdirSync(join(W, "tests")); cpSync(join(ROOT, TEST), join(W, TEST));
  writeFileSync(join(W, "package.json"), '{"type":"module"}');
  const reset = () => { rmSync(join(W, "src"), { recursive: true, force: true }); cpSync(join(ROOT, "src"), join(W, "src"), { recursive: true }); };
  const run = () => spawnSync(process.execPath, [TEST], { cwd: W, encoding: "utf8", timeout: 30000 });
  reset(); const base = run();
  assert.equal(base.status, 0, `G07_CONTROL_FAILED\n${base.stdout}\n${base.stderr}`);
  assert.equal(base.signal, null); console.log("PASS G07 unmutated control");
  for (const [name, from, to, marker] of MUTS) {
    reset(); const path = join(W, "src/account-ui.js"); const source = readFileSync(path, "utf8");
    assert.equal(source.split(from).length - 1, 1, "G07_MUTATION_ANCHOR " + name);
    writeFileSync(path, source.replace(from, to));
    const syntax = spawnSync(process.execPath, ["--check", path], { encoding: "utf8" });
    assert.equal(syntax.status, 0, "G07_MUTANT_SYNTAX " + name);
    const r = run(), output = r.stdout + r.stderr;
    assert.equal(r.signal, null, "G07_MUTANT_TIMEOUT " + name);
    assert.equal(r.status, 1, `G07_MUTANT_SURVIVED ${name}\n${output}`);
    assert.ok(output.includes("ERR_ASSERTION") && output.includes(marker), `G07_NOT_TARGET_ASSERTION ${name}\n${output}`);
    assert.ok(!/ReferenceError:|TypeError:|SyntaxError:/.test(output), `G07_MUTANT_RUNTIME_ERROR ${name}\n${output}`);
    console.log("PASS G07 mutant: " + name);
  }
  console.log(`G-LOGIN-07 mutation: control + ${MUTS.length} mutants passed`);
} finally { rmSync(W, { recursive: true, force: true }); }
