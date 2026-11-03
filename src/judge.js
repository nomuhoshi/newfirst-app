// 判题核心（接口版）：只支持 U3「输出模式」——运行学生代码，比较标准输出。
// 不碰 XP / 红心 / 难度 / 解锁：这里只返回判题结果，由调用方决定怎么结算。
//
// ── 接口（字段名统一，只用下面这些）─────────────────────────────
// judge({ code, tests, checkMode, compare, limits }, executor, { signal }?) -> Promise<Result>
//   code       学生代码（字符串）
//   tests      [{ name, hidden?, data?, expected }]
//              data     = 注入的变量（对象，每组都是全新的全局变量空间）。只用 data，不用 vars。
//              expected = 期望的标准输出（字符串）。
//   checkMode  只支持 "output"
//   compare    "strict"（默认）| "lenient"（只有题目明确声明时才用）
//   limits     { caseMs = 5000, totalMs = 10000, readyCapMs = 30000 }
//
// Result = {
//   status:  "pass" | "fail" | "unavailable" | "internal-error",
//   attempt: boolean,   // 只有 pass / fail 才算作答；unavailable / internal-error 不算作答
//   settle:  boolean,   // 只有完整跑完（每组都有结果）的 pass / fail 才可以结算；其他一律不结算
//   retry:   boolean,   // 不算作答时为 true：保留代码，提示重试
//   cases:   [{ name, hidden, ok, kind, ms, message, expected?, stdout?, error? }],
//   totalMs,            // 只算学生代码执行时间，不含首次加载和超时重启后的重新加载
// }
//
// executor.exec({ code, data, timeoutMs, signal }) -> Promise<{ stdout, error, timedOut, limitHit, ms }>
//   结果字段只用 stdout（不用 output）。ms = 这次真正执行的时间（不含加载）。
//   抛出 { unavailable: true } 表示 Python 环境不可用；抛出 { cancelled: true } 表示被取消。
//
// ── 扩展字段（向后兼容，docs/code-task-interface.md）─────────────
//   files/entry   多文件：files = [{ path, content }]，entry 默认 "main.py"；只给 code 等于 files=[{path:"main.py"}]
//   tests[].stdin         input() 依次读到的行（字符串或字符串数组）；读完再 input() → EOFError；没给 → 明确的错误
//   tests[].files         这一组开始前写进虚拟文件系统的文件 { path: content }（学生的同名文件优先）
//   tests[].expectedFiles 运行后这些文件必须存在且内容一致（同样按 compare 规则比较）{ path: content }
//   checkMode "call"      调用学生写的函数，比较返回值（不比 repr、不比 print 的输出）：
//                         tests[] = { name, hidden?, data?, call: { fn, args?, kwargs? }, expectedReturn, tol? }
//                         比较规则：JSON 形状；元组≡列表；布尔和数字不混；数字按值比较（1 与 1.0 相同），小数用相对误差 tol（默认 1e-9）。
//   executor.exec 额外收到 { files, entry, stdin, readFiles }；返回值可带 files = { path: 内容 | null }。
//
// 比较规则（strict）：统一换行符（\r\n、\r → \n）；两边各允许末尾**一个**换行；
//   行尾空格、多出来的空行仍然要一致。lenient：额外忽略每行行尾空白和末尾所有空行。

export const JUDGE_LIMITS = { caseMs: 5000, totalMs: 10000, readyCapMs: 30000 };

export const KIND = {
  PASS: "pass",
  WRONG: "wrong-output",
  WRONG_FILE: "wrong-file",
  WRONG_RETURN: "wrong-return",
  ERROR: "error",
  CASE_TIMEOUT: "case-timeout",
  TOTAL_TIMEOUT: "total-timeout",
  OUTPUT_LIMIT: "output-limit",
  UNAVAILABLE: "unavailable",
  INTERNAL: "internal",
  CANCELLED: "cancelled",
};

const sec = (ms) => `${Math.round(ms / 100) / 10} 秒`;
export function messageFor(kind, L = JUDGE_LIMITS) {
  return {
    [KIND.PASS]: "通过",
    [KIND.WRONG]: "输出和期望不一致",
    [KIND.WRONG_FILE]: "输出文件的内容和期望不一致，或者文件没有生成",
    [KIND.WRONG_RETURN]: "函数的返回值和期望不一致",
    [KIND.ERROR]: "程序运行出错",
    [KIND.CASE_TIMEOUT]: `这一组测试运行超过 ${sec(L.caseMs)}，可能有死循环`,
    [KIND.TOTAL_TIMEOUT]: `全部测试合计超过 ${sec(L.totalMs)}，后面的测试没有运行`,
    [KIND.OUTPUT_LIMIT]: "输出太多，已停止",
    [KIND.UNAVAILABLE]: "Python 环境暂时不可用，这次不算作答，代码已保留，请重试",
    [KIND.INTERNAL]: "判题出了内部问题，这次不算作答，代码已保留，请重试",
    [KIND.CANCELLED]: "已取消，这次不算作答",
  }[kind];
}

const unifyNl = (s) => String(s ?? "").replace(/\r\n?/g, "\n");
const dropOneNl = (s) => (s.endsWith("\n") ? s.slice(0, -1) : s);
export function normalizeOutput(s, compare = "strict") {
  const t = unifyNl(s);
  if (compare === "lenient") return t.split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").replace(/\n+$/, "");
  return dropOneNl(t);
}

const now = () => (globalThis.performance ? performance.now() : Date.now());

// 把 code / files+entry 统一成 { files: {path: content}, entry, code }；不合法返回 null
function normalizeSources({ code, files, entry }) {
  if (Array.isArray(files)) {
    const map = {};
    for (const f of files) {
      if (!f || typeof f.path !== "string" || typeof f.content !== "string" || !f.path) return null;
      map[f.path] = f.content;
    }
    const e = entry || "main.py";
    return e in map ? { files: map, entry: e, code: map[e] } : null;
  }
  if (typeof code !== "string") return null;
  return { files: { "main.py": code }, entry: "main.py", code };
}
const isObj = (o) => o && typeof o === "object" && !Array.isArray(o);
const isStrMap = (o) => isObj(o) && Object.values(o).every((v) => typeof v === "string");
function validTests(tests, checkMode) {
  return Array.isArray(tests) && tests.length > 0 && tests.every((t) => isObj(t)
    && (t.stdin === undefined || typeof t.stdin === "string" || (Array.isArray(t.stdin) && t.stdin.every((x) => typeof x === "string")))
    && (t.files === undefined || isStrMap(t.files))
    && (t.expectedFiles === undefined || isStrMap(t.expectedFiles))
    && (checkMode === "call" ? isObj(t.call) && typeof t.call.fn === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(t.call.fn) && "expectedReturn" in t
        : typeof t.expected === "string"));
}

// call 模式：在入口文件末尾附加的判题代码（不改动学生代码的行号）。结果写进 JUDGE_RESULT_FILE。
export const JUDGE_RESULT_FILE = "__judge_result__.json";
function callHarness(t) {
  const payload = JSON.stringify({ fn: t.call.fn, args: t.call.args ?? [], kwargs: t.call.kwargs ?? {}, expected: t.expectedReturn, tol: t.tol ?? 1e-9 });
  return `

# ---- 判题器附加的代码（不属于学生代码）----
def _jg_same(a, e, tol):
    if isinstance(e, bool) or isinstance(a, bool):
        return isinstance(e, bool) and isinstance(a, bool) and a == e
    if isinstance(e, (int, float)):
        if not isinstance(a, (int, float)):
            return False
        return abs(a - e) <= tol * max(1.0, abs(e))
    if isinstance(e, list):
        return isinstance(a, (list, tuple)) and len(a) == len(e) and all(_jg_same(x, y, tol) for x, y in zip(a, e))
    if isinstance(e, dict):
        return isinstance(a, dict) and {str(k): v for k, v in a.items()}.keys() == e.keys() and all(_jg_same(v, e[str(k)], tol) for k, v in a.items())
    return type(a) is type(e) and a == e
def _jg_run():
    import json as _j
    p = _j.loads(${JSON.stringify(payload)})
    res = {"ok": False, "missing": False, "actual": ""}
    f = globals().get(p["fn"])
    if not callable(f):
        res["missing"] = True
    else:
        a = f(*p["args"], **p["kwargs"])
        res["ok"] = bool(_jg_same(a, p["expected"], p["tol"]))
        try:
            res["actual"] = repr(a)[:200]
        except BaseException:
            res["actual"] = "<无法显示>"
    with open(${JSON.stringify(JUDGE_RESULT_FILE)}, "w", encoding="utf-8") as fh:
        fh.write(_j.dumps(res, ensure_ascii=False))
_jg_run()
`;
}

export async function judge({ code, files, entry, tests, checkMode = "output", compare = "strict", limits = {} }, executor, { signal } = {}) {
  const L = { ...JUDGE_LIMITS, ...limits };
  let used = 0; // 学生代码执行时间合计
  const notAttempt = (status, kind, base, cases) => ({
    status, attempt: false, settle: false, retry: true, totalMs: Math.round(used),
    cases: [...cases, { ...base, ok: false, kind, ms: 0, message: messageFor(kind, L) }],
  });
  const none = { name: "", hidden: false };
  const src = normalizeSources({ code, files, entry });
  if ((checkMode !== "output" && checkMode !== "call") || (compare !== "strict" && compare !== "lenient") || !src || !validTests(tests, checkMode))
    return notAttempt("internal-error", KIND.INTERNAL, none, []);

  const cases = [];
  let budgetHit = false;
  for (const t of tests) {
    const base = { name: t.name, hidden: !!t.hidden };
    if (signal?.aborted) return notAttempt("unavailable", KIND.CANCELLED, base, []);
    const remaining = L.totalMs - used;
    if (budgetHit || remaining <= 0) {
      budgetHit = true;
      cases.push({ ...base, ok: false, kind: KIND.TOTAL_TIMEOUT, ms: 0, message: messageFor(KIND.TOTAL_TIMEOUT, L) });
      continue;
    }
    const byTotal = remaining < L.caseMs;
    const timeoutMs = Math.max(1, Math.min(L.caseMs, remaining));
    let r;
    const c0 = now();
    const runFiles = { ...(t.files || {}), ...src.files };            // 学生的同名文件优先
    if (checkMode === "call") runFiles[src.entry] = src.files[src.entry] + callHarness(t);
    const readFiles = [...Object.keys(t.expectedFiles || {}), ...(checkMode === "call" ? [JUDGE_RESULT_FILE] : [])];
    try {
      r = await executor.exec({
        code: runFiles[src.entry], files: runFiles, entry: src.entry, data: t.data ?? null, stdin: t.stdin ?? null, readFiles,
        timeoutMs, signal, readyCapMs: L.readyCapMs,
      });
    } catch (e) {
      // 中途环境失败：前面已通过的组也不算数（不完整的结果不结算）
      if (e && e.cancelled) return notAttempt("unavailable", KIND.CANCELLED, base, []);
      if (e && e.unavailable) return notAttempt("unavailable", KIND.UNAVAILABLE, base, []);
      return notAttempt("internal-error", KIND.INTERNAL, base, []);
    }
    const ms = typeof r.ms === "number" ? r.ms : now() - c0;
    used += r.timedOut ? Math.max(ms, timeoutMs) : ms;
    let kind, actualReturn = "", badFiles = [];
    if (r.timedOut) { kind = byTotal ? KIND.TOTAL_TIMEOUT : KIND.CASE_TIMEOUT; if (byTotal) budgetHit = true; }
    else if (r.limitHit) kind = KIND.OUTPUT_LIMIT;
    else if (r.error && r.error.kind === "InternalError") return notAttempt("internal-error", KIND.INTERNAL, base, []);
    else if (r.error) kind = KIND.ERROR;
    else if (checkMode === "call") {
      let jr = null;
      try { jr = JSON.parse(r.files?.[JUDGE_RESULT_FILE] ?? "null"); } catch { jr = null; }
      if (!jr) kind = KIND.ERROR, r = { ...r, error: { kind: "NoResult", line: null, msg: "程序没有走到函数调用就结束了（是不是提前 exit 了？）" } };
      else if (jr.missing) kind = KIND.ERROR, r = { ...r, error: { kind: "NameError", line: null, msg: `没有找到函数 ${t.call.fn}，请检查函数名` } };
      else { kind = jr.ok ? KIND.PASS : KIND.WRONG_RETURN; actualReturn = jr.actual; }
    } else {
      const outOk = normalizeOutput(r.stdout, compare) === normalizeOutput(t.expected, compare);
      const bad = Object.entries(t.expectedFiles || {}).filter(([p, e]) => typeof r.files?.[p] !== "string" || normalizeOutput(r.files[p], compare) !== normalizeOutput(e, compare)).map(([p]) => p);
      kind = !outOk ? KIND.WRONG : bad.length ? KIND.WRONG_FILE : KIND.PASS;
      badFiles = bad;
    }
    const c = { ...base, ok: kind === KIND.PASS, kind, ms: Math.round(ms), message: messageFor(kind, L) };
    if (kind === KIND.ERROR) {
      c.error = r.error;
      // call 模式：出错行落在判题器附加的代码里（比如参数个数不对）时，不显示一个学生代码里不存在的行号
      if (checkMode === "call" && c.error && c.error.line > src.files[src.entry].split("\n").length) c.error = { ...c.error, line: null };
    }
    if (!c.hidden && kind !== KIND.PASS && kind !== KIND.ERROR) {
      if (checkMode === "call") { c.expected = JSON.stringify(t.expectedReturn); c.actualReturn = actualReturn; }
      else {
        c.expected = t.expected; c.stdout = r.stdout ?? "";
        if (kind === KIND.WRONG_FILE) c.files = badFiles.map((p) => ({ path: p, expected: t.expectedFiles[p], actual: typeof r.files?.[p] === "string" ? r.files[p] : null }));
      }
    }
    cases.push(c);
  }
  const pass = cases.every((c) => c.ok);
  return { status: pass ? "pass" : "fail", attempt: true, settle: cases.length === tests.length, retry: false, cases, totalMs: Math.round(used) };
}

// 浏览器适配：把真实 Runner（src/runner.js）包成 executor。一次只跑一组。
// - 运行前等 Runner 就绪（runner.whenReady(cap)）；加载失败会先 boot() 重试一次加载；
//   一直不就绪（超过 readyCapMs）→ unavailable。等待时间不计入判题时限。
// - 超时用 runner.stop()：Runner 会终止并重启工作线程；下一组会等重启完成，不会被误报为 unavailable。
// - 任何结束路径（完成、超时、输出超限、加载失败、run() 同步抛错、取消）都清理计时器并还原回调。
export function makeRunnerExecutor(runner) {
  async function ensureReady(capMs) {
    if (runner.state === "idle" || runner.state === "loadError") runner.boot();
    const s = await runner.whenReady(capMs);
    if (s !== "ready") throw { unavailable: true, reason: s };
  }
  let chain = Promise.resolve(); // 一次只跑一个：同时调用会排队，不会互相覆盖回调
  async function execOne({ code, files, entry, data, stdin, readFiles, timeoutMs, signal, readyCapMs = JUDGE_LIMITS.readyCapMs }) {
    if (signal?.aborted) throw { cancelled: true };
    await ensureReady(readyCapMs);
    if (signal?.aborted) throw { cancelled: true };
    // 判题一律走任务运行：每组都是全新的变量空间、虚拟文件系统和模块缓存（没给 stdin 时 input() 会明确报错）
    const task = { files: files || { "main.py": code }, entry: entry || "main.py", stdin: stdin ?? null, read: readFiles || [] };
    return new Promise((resolve, reject) => {
      let stdout = "", finished = false, t0 = 0, timer = null;
      const prevStatus = runner.onStatus, prevOutput = runner.onOutput;
      const onAbort = () => { finish(() => reject({ cancelled: true })); runner.stop(); };
      function finish(cb) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        runner.onStatus = prevStatus; runner.onOutput = prevOutput;
        signal?.removeEventListener?.("abort", onAbort);
        cb();
      }
      const ms = () => (t0 ? now() - t0 : 0);
      runner.onOutput = (t) => { stdout += t; };
      runner.onStatus = (s, info) => {
        if (s === "running") return;
        if (s === "done") finish(() => resolve({ stdout, error: info?.error ?? null, timedOut: false, limitHit: false, ms: ms(), files: info?.files ?? null }));
        else if (s === "stopped" || s === "timeout") finish(() => resolve({ stdout, error: null, timedOut: true, limitHit: false, ms: ms() }));
        else if (s === "outputLimit" || s === "outputLimitStopped") finish(() => resolve({ stdout, error: null, timedOut: false, limitHit: true, ms: ms() }));
        else if (s === "loadError") finish(() => reject({ unavailable: true }));
        else prevStatus?.(s, info); // loading / ready / slowLoad 等交还给界面
      };
      signal?.addEventListener?.("abort", onAbort);
      try {
        t0 = now();
        if (!runner.run(code, data, task)) return finish(() => reject({ unavailable: true, reason: "not-ready" }));
        timer = setTimeout(() => { if (!finished) runner.stop(); }, timeoutMs);
      } catch (e) {
        finish(() => reject(e instanceof Error ? e : new Error(String(e))));
      }
    });
  }
  return {
    exec(args) {
      const p = chain.then(() => execOne(args));
      chain = p.catch(() => {});
      return p;
    },
  };
}
