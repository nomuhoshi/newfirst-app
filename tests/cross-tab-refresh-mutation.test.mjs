// G-LOGIN-15 反向验证：未变异对照必须通过；每个变异必须由行为断言检出（退出码 1 + ERR_ASSERTION + 目标标记）。
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const dir = mkdtempSync(join(tmpdir(), 'g15-refresh-mutation-'));
const tests = 'tests/cross-tab-refresh.test.mjs';
const LOCKED = 'if (!(retryLockProvider && typeof retryLockProvider.request === "function")) return doRefresh();';
const variants = [
  { name: '不用刷新锁：两页各自刷新（原缺陷）', marker: 'G15_ONE', edits: [[LOCKED, 'return doRefresh();']] },
  { name: '获锁后不采纳共享存储里的新凭证（等待页拿已被消耗的旧令牌再刷新）', marker: 'G15_ONE', edits: [['      adoptStoredSession(); // 别页刚刷新并发布了同一登录实例的新凭证：直接采用，不再刷新\n', '']] },
  { name: '获锁后不复核身份（登录已被取代也照样刷新）', marker: 'G15_IDENTITY', edits: [['      const own = checkSessionOwnership();\n      if (!own.ok) return own.kind === "lost" ? staleResult() : { ok: false, kind: "local", message: "无法确认本机登录状态" }; // 失权由调用方返回后统一处理\n', '']] },
  { name: '持锁时不登记放锁（代次前进后新操作仍排在旧刷新后面）', marker: 'G15_ABANDON', edits: [['          abandonWaiters.add(abandon); // 代次前进时立刻放锁，新会话的刷新不排在旧刷新后面\n', '']] },
  { name: '退出也排队等刷新锁（别页刷新卡住时退出被拖住）', marker: 'G15_LOGOUT', edits: [['wait ? { mode: "exclusive", ...(ctl ? { signal: ctl.signal } : {}) } : { mode: "exclusive", ifAvailable: true }', '{ mode: "exclusive" }']] },
  { name: '排队没有期限（持锁页冻结时等待页无限等）', marker: 'G15_TIMEOUT', edits: [['}, refreshLockWaitMs);', '}, refreshLockWaitMs); clearTimeout(timer); // 变异：期限从不触发']] },
  { name: '到期后不绕锁以外的办法：到期改为自己刷新（绕锁）', marker: 'G15_TIMEOUT', edits: [['stopWait(retryable("等待其他页面完成登录刷新超时，请稍后重试"))', 'stopWait(doRefresh())']] },
  { name: '锁实现不认 signal 时，过期的排队回调拿到锁后照常联网（迟到请求）', marker: 'G15_LATE', edits: [['          if (closed) return staleResult(); // 已到期 / 已撤销：拿到锁立刻还，绝不联网\n', '']] },
  { name: '排队期间退出 / 换号不作废排队', marker: 'G15_ABANDON_WAIT', edits: [['        abandonWaiters.add(abandonQueue); // 排队期间退出 / 换账号：立刻撤销排队，不等到期\n', '']] },
  { name: '锁请求失败时清掉本机登录凭证（存储快照不再原样）', marker: 'G15_LOCKFAIL', edits: [['        return retryable("暂时无法协调多个页面的登录刷新，请稍后重试");', '        try { storage.removeItem(AUTH_KEY); } catch {}\n        return retryable("暂时无法协调多个页面的登录刷新，请稍后重试");']] },
  { name: '旧刷新结果不核对代次 / 实例 / 会话就写进当前会话并落盘', marker: 'G15_ISOLATE', edits: [['mine() && session === base && checkSessionOwnership().ok\n        && r && r.ok', 'r && r.ok']] },
  { name: '锁请求异常收尾不释放排队登记（之后的退出 / 换号会再取消已结束的请求，登记累积）', marker: 'G16_LEAK', edits: [['clearTimeout(timer); f.dropQueue?.(); }', 'clearTimeout(timer); }']] },
  { name: '拿不到锁时自行刷新（可能与别页重复使用刷新凭证）', marker: 'G15_LOCKFAIL', edits: [['        return retryable("暂时无法协调多个页面的登录刷新，请稍后重试");', '        return doRefresh();']] },
  { name: '刷新锁名不含登录实例且不放锁：同号重登后的新操作被旧锁拖住', marker: 'G15_ISOLATE', edits: [['${userId}:${inst ?? "-"}`', '${userId}`'], ['          abandonWaiters.add(abandon); // 代次前进时立刻放锁，新会话的刷新不排在旧刷新后面\n', '']] },
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
  console.log('G-LOGIN-15 mutation: control + ' + variants.length + ' mutants passed');
} finally { rmSync(dir, { recursive: true, force: true }); }
