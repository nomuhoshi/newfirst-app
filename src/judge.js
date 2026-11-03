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
// 比较规则（strict）：统一换行符（\r\n、\r → \n）；两边各允许末尾**一个**换行；
//   行尾空格、多出来的空行仍然要一致。lenient：额外忽略每行行尾空白和末尾所有空行。

export const JUDGE_LIMITS = { caseMs: 5000, totalMs: 10000, readyCapMs: 30000 };

export const KIND = {
  PASS: "pass",
  WRONG: "wrong-output",
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

export async function judge({ code, tests, checkMode = "output", compare = "strict", limits = {} }, executor, { signal } = {}) {
  const L = { ...JUDGE_LIMITS, ...limits };
  let used = 0; // 学生代码执行时间合计
  const notAttempt = (status, kind, base, cases) => ({
    status, attempt: false, settle: false, retry: true, totalMs: Math.round(used),
    cases: [...cases, { ...base, ok: false, kind, ms: 0, message: messageFor(kind, L) }],
  });
  const none = { name: "", hidden: false };
  if (checkMode !== "output" || (compare !== "strict" && compare !== "lenient") || !Array.isArray(tests) || tests.length === 0)
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
    try {
      r = await executor.exec({ code, data: t.data ?? null, timeoutMs, signal, readyCapMs: L.readyCapMs });
    } catch (e) {
      // 中途环境失败：前面已通过的组也不算数（不完整的结果不结算）
      if (e && e.cancelled) return notAttempt("unavailable", KIND.CANCELLED, base, []);
      if (e && e.unavailable) return notAttempt("unavailable", KIND.UNAVAILABLE, base, []);
      return notAttempt("internal-error", KIND.INTERNAL, base, []);
    }
    const ms = typeof r.ms === "number" ? r.ms : now() - c0;
    used += r.timedOut ? Math.max(ms, timeoutMs) : ms;
    let kind;
    if (r.timedOut) { kind = byTotal ? KIND.TOTAL_TIMEOUT : KIND.CASE_TIMEOUT; if (byTotal) budgetHit = true; }
    else if (r.limitHit) kind = KIND.OUTPUT_LIMIT;
    else if (r.error && r.error.kind === "InternalError") return notAttempt("internal-error", KIND.INTERNAL, base, []);
    else if (r.error) kind = KIND.ERROR;
    else kind = normalizeOutput(r.stdout, compare) === normalizeOutput(t.expected, compare) ? KIND.PASS : KIND.WRONG;
    const c = { ...base, ok: kind === KIND.PASS, kind, ms: Math.round(ms), message: messageFor(kind, L) };
    if (kind === KIND.ERROR) c.error = r.error;
    if (!c.hidden && kind !== KIND.PASS) { c.expected = t.expected; c.stdout = r.stdout ?? ""; }
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
  return {
    async exec({ code, data, timeoutMs, signal, readyCapMs = JUDGE_LIMITS.readyCapMs }) {
      if (signal?.aborted) throw { cancelled: true };
      await ensureReady(readyCapMs);
      if (signal?.aborted) throw { cancelled: true };
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
          if (s === "done") finish(() => resolve({ stdout, error: info?.error ?? null, timedOut: false, limitHit: false, ms: ms() }));
          else if (s === "stopped" || s === "timeout") finish(() => resolve({ stdout, error: null, timedOut: true, limitHit: false, ms: ms() }));
          else if (s === "outputLimit" || s === "outputLimitStopped") finish(() => resolve({ stdout, error: null, timedOut: false, limitHit: true, ms: ms() }));
          else if (s === "loadError") finish(() => reject({ unavailable: true }));
          else prevStatus?.(s, info); // loading / ready / slowLoad 等交还给界面
        };
        signal?.addEventListener?.("abort", onAbort);
        try {
          t0 = now();
          if (!runner.run(code, data)) return finish(() => reject({ unavailable: true, reason: "not-ready" }));
          timer = setTimeout(() => { if (!finished) runner.stop(); }, timeoutMs);
        } catch (e) {
          finish(() => reject(e instanceof Error ? e : new Error(String(e))));
        }
      });
    },
  };
}
