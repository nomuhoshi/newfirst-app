// G-LOGIN-13 反向验证：未变异对照必须通过；每个变异必须由行为断言检出（退出码 1 + ERR_ASSERTION + 目标标记）。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'g13-token-mutation-'));
const tests = 'tests/import-token-refresh.test.mjs';
const ORIG = ['    const src = { sess, active:', '    const src = { orig: sess, sess, active:']; // 变异用：记住入口那份旧会话对象
const variants = [
  { name: '重读云端仍用刷新前的旧会话', marker: 'G13_REUSE', edits: [ORIG, ['    const r = await api.getProgress(k.session);', '    const r = await api.getProgress(src.orig);']] },
  { name: '保存仍用刷新前的旧会话', marker: 'G13_REUSE', edits: [ORIG, ['await api.saveProgress(k.session, latest.row.rev, doc)', 'await api.saveProgress(src.orig, latest.row.rev, doc)'], ['await api.saveProgress(k.session, current.row.rev, doc)', 'await api.saveProgress(src.orig, current.row.rev, doc)']] },
  { name: '创建仍用刷新前的旧会话', marker: 'G13_CREATE', edits: [ORIG, ['await api.createProgress(k.session, doc)', 'await api.createProgress(src.orig, doc)', 2]] },
  { name: '读回仍用刷新前的旧会话', marker: 'G13_READBACK', edits: [ORIG, ['await api.getProgress(rk.session) : rk', 'await api.getProgress(src.orig) : rk', 2]] },
  { name: '恢复后重新选择：收尾把挂起时的旧令牌写回存储', marker: 'G13_FINAL', edits: [['    if (ctx.resume && isSessionShape(session) && session.userId === uid) ctx.session = session;\n', '']] },
  { name: '刷新失败后仍用旧会话继续发请求', marker: 'G13_FAIL', edits: [['    if (!t.ok) return t;\n    if (!isSessionShape(session) || session.userId !== src.uid)', '    if (!isSessionShape(session) || session.userId !== src.uid)']] },
  { name: '刷新返回后不核对代次（被取代也继续，借新会话）', marker: 'G13_STALE', edits: [
    ['    if (dead() || src.gen !== acctGen || t.stale) return staleImport(); // 刷新期间已退出 / 换账号 / 同号重登：不借新会话继续旧任务\n    if (!t.ok) return t;', '    if (!t.ok && !t.stale) return t;']] },
  { name: '读回返回后不复核登录实例（跨页换号 / 重登后仍写副本、清游客和待办）', marker: 'G13_CROSSTAB', edits: [['    const lostAfterRead = src.guard(); if (lostAfterRead) return lostAfterRead; // 读回返回后、写副本 / 清游客 / 清待办之前复核登录实例\n', '', 2]] },
  { name: '写入失败收尾前不复核登录实例（跨页取代后仍写本机副本）', marker: 'G13_CROSSTAB', edits: [['      const lostBefore = src.guard(); if (lostBefore) return lostBefore; // 请求返回后、写本机副本之前：共享登录实例已被其他页取代就停，不动存储\n', '', 2]] },
  { name: '首次登录验证会话过期后不局部刷新（冲突重读仍带过期令牌）', marker: 'G13_LOGIN_EXPIRY', edits: [['      if (!Number.isFinite(src.sess.expiresAt) || src.sess.expiresAt - now() > 60000) return { ok: true, session: src.sess };', '      return { ok: true, session: src.sess };']] },
  { name: '首次登录局部刷新的新凭证不交回登录选择（重试 / 最终提交用已作废的旧令牌）', marker: 'G13_LOGIN_EXPIRY', edits: [['      try { src.onSession?.(rf.session); } catch {}\n', '']] },
  { name: '首次登录局部刷新前后不复核登录实例（被其他页取代也继续）', marker: 'G13_LOGIN_EXPIRY', edits: [['      const e = check ? check() : null;\n      return e ? { ...e, retryable: false } : null;', '      return null;']] },
];
function reset() { rmSync(join(dir, 'src'), { recursive: true, force: true }); cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true }); }
const run = () => spawnSync(process.execPath, ['--test', '--test-reporter=tap', join(dir, tests)], { encoding: 'utf8', timeout: 60000 });
function cleanRun(r, label) {
  assert.equal(r.error, undefined, label + ' 执行异常 / 超时');
  assert.equal(r.signal, null, label + ' 被信号终止');
  assert.doesNotMatch(r.stdout + r.stderr, /SyntaxError|ERR_MODULE_NOT_FOUND|cancelledByParent|TypeError|ReferenceError/);
  assert.match(r.stdout, /# cancelled 0/);
}
try {
  cpSync(join(root, 'src'), join(dir, 'src'), { recursive: true });
  cpSync(join(root, tests), join(dir, tests));
  writeFileSync(join(dir, 'package.json'), '{"type":"module"}\n');
  const control = run(); cleanRun(control, '未变异对照');
  assert.equal(control.status, 0, control.stdout + control.stderr);
  console.log('PASS 未变异对照');
  for (const v of variants) {
    reset();
    const p = join(dir, 'src', 'sync.js'); let text = readFileSync(p, 'utf8');
    for (const [from, to, count = 1] of v.edits) {
      assert.equal(text.split(from).length - 1, count, '锚点数量不符：' + v.name + ' / ' + from.slice(0, 50));
      text = text.split(from).join(to);
    }
    writeFileSync(p, text);
    const syntax = spawnSync(process.execPath, ['--check', p], { encoding: 'utf8', timeout: 5000 });
    assert.equal(syntax.status, 0, '变异语法错误：' + v.name + '\n' + syntax.stderr);
    const r = run(); cleanRun(r, v.name);
    assert.equal(r.status, 1, '变异未被检出：' + v.name + '\n' + r.stdout.slice(-800));
    assert.match(r.stdout, /code: 'ERR_ASSERTION'/, '须由断言检出：' + v.name);
    assert.ok(r.stdout.includes(v.marker), '须命中 ' + v.marker + '：' + v.name);
    console.log('PASS 变异被断言检出：' + v.name + ' (' + v.marker + ', exit=1)');
  }
  console.log('G-LOGIN-13 mutation: control + ' + variants.length + ' mutants passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
