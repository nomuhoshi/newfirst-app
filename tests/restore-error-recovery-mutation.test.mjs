// 独立脚本；不在 node:test 父运行器里递归开子运行器。只改临时副本。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('..', import.meta.url));
const dir = mkdtempSync(join(tmpdir(), 'g05-restore-'));
const name = 'tests/restore-error-recovery.test.mjs';
const mutations = [
  ['指针不可读折叠为游客', 'sync.js', 'if (!p0.ok) return fail("read-failed", "session");', 'if (!p0.ok) return stale();'],
  ['AUTH读取失败折叠为空（入口和提交前的两层冗余一起拆）', 'sync.js', [
    'if (a0.state === "read-failed") return fail("read-failed", "auth");',
    'if (a1.state === "read-failed") return fail("read-failed", "auth");',
  ], ['if (false) return fail("read-failed", "auth");', 'if (false) return fail("read-failed", "auth");']],
  ['副本缺失误标永久损坏', 'sync.js', 'if (!L.copy) return fail("missing", "account");', 'if (!L.copy) return fail("corrupt", "account");'],
  ['非字符串副本误标损坏', 'account-store.js', 'if (typeof raw !== "string") return { ok: false, code: "read-failed",', 'if (typeof raw !== "string") return { ok: false, code: "corrupt",'],
  ['提交前跳过登录实例检查', 'sync.js', 'if (!sameRestoreIdentity(initialIdentity, restoreIdentity(a1))) return stale();', 'if (false) return stale();'],
  ['提交前跳过账号指针检查', 'sync.js', 'if (p1.id !== uid) return stale();', 'if (false) return stale();'],
  ['重试忽略失败时的账号和实例快照', 'sync.js', 'return restoreAttempt(baseState, restoreOwner);', 'return restoreAttempt(baseState);'],
  ['后发失败恢复被旧恢复覆盖', 'sync.js', 'op.seq === restoreSeq && ', ''],
  ['协调读取后不复查错误快照归属', 'sync.js', [
    'const p = readCurrentAccount(storage);\n      if (!current()) return staleResult();',
    'const a = inspectAuth();\n        if (!current()) return staleResult();',
  ], ['const p = readCurrentAccount(storage);', 'const a = inspectAuth();']],
  ['没有恢复错误或已有账号也允许重试', 'sync.js', 'if (userId || !restoreError()) return staleResult();', 'if (false) return staleResult();'],
  ['错误getter不再防御性复制', 'sync.js', '&& restoreIssue ? { ...restoreIssue } : null)', '&& restoreIssue ? restoreIssue : null)'],
  ['跨页退出不清过时提示', 'sync.js', 'if (changed) { clearRestoreIssue(); return { ok: true, active: false, restoreChanged: true }; }', 'if (changed) { return { ok: true, active: false, restoreChanged: true }; }'],
  ['界面没有先应用恢复state', 'account-ui.js', '          onSwitchedIn(r.restored);', '          // 变异：没有应用state'],
  ['界面处理旧恢复结果并显示旧错误', 'account-ui.js', '          if (r.stale) { rerender(); return; }', '          // 变异：没有丢弃旧恢复结果'],
];
function run() {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, name)], { env, encoding: 'utf8', timeout: 20000 });
  const out = r.stdout + r.stderr;
  assert.equal(r.error, undefined, out); assert.equal(r.signal, null, out);
  assert.doesNotMatch(out, /skipping running files|SyntaxError|ERR_MODULE_NOT_FOUND|name: '(?:ReferenceError|TypeError)'/);
  assert.match(out, /# cancelled 0/); assert.match(out, /# skipped 0/);
  const count = Number(out.match(/^# tests (\d+)$/m)?.[1]);
  assert.ok(count > 0, '必须实际执行专项测试：\n' + out);
  return { ...r, out, count };
}
function reset() {
  rmSync(join(dir, 'src'), { recursive: true, force: true });
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
}
try {
  reset(); cpSync(join(root, name), join(dir, name), { recursive: false });
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const control = run(); assert.equal(control.status, 0, control.out); assert.match(control.out, /# fail 0/);
  console.log('PASS 未变异对照：' + control.count + ' 项实际执行、全部通过');
  if (!process.argv.includes('--control-only')) {
    for (const [label, file, from, to] of mutations) {
      reset(); const p = join(dir, 'src', file); let s = readFileSync(p, 'utf8');
      const before = Array.isArray(from) ? from : [from], after = Array.isArray(to) ? to : [to];
      before.forEach((v, i) => { assert.equal(s.split(v).length - 1, 1, '锚点必须唯一：' + label); s = s.replace(v, after[i]); });
      writeFileSync(p, s);
      const r = run(); assert.equal(r.count, control.count, '变异不得减少实际测试数');
      assert.equal(r.status, 1, '变异未检出：' + label + '\n' + r.out);
      assert.match(r.out, /code: 'ERR_ASSERTION'/, '须由目标断言检出：' + label + '\n' + r.out);
      console.log('PASS 变异被断言检出：' + label);
    }
    console.log('G-LOGIN-05 mutation: control + ' + mutations.length + ' mutants passed');
  }
} finally { rmSync(dir, { recursive: true, force: true }); }
