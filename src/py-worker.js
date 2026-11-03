// 工作线程：在后台加载 Pyodide 并执行用户代码，避免卡住界面。
// 和主线程之间只用 postMessage 传结构化数据。
//
// 输出保护在这里做第一层：
// - 按 UTF-8 字节和换行数累计，超过上限就截断，并让 Python 的 print 报错停止
// - 最多每 50 毫秒向主线程发一次输出（总量已被上限封顶，所以单条消息不会太大）

import { LIMITS } from "./py-worker-limits.js";
import { PY_TASK_HELPER } from "./py-task.js";

let pyodide = null;
let runPy = null;      // Python 里定义的 _run 函数
let flushPy = null;    // Python 里定义的 _flush 函数
let taskPy = null;     // Python 里定义的 _run_task 函数（判题 / 带 input、文件的运行）

// 每次运行的输出状态
let run = null;        // { id, bytes, lines, limitHit, pending: Uint8Array[] , lastSend }

function resetRun(id) {
  run = { id, bytes: 0, lines: 0, limitHit: false, pending: [], lastSend: Date.now(), decoder: new TextDecoder() };
}

function send(force) {
  if (!run || run.pending.length === 0) return;
  const now = Date.now();
  if (!force && now - run.lastSend < 50) return;
  let total = 0;
  for (const p of run.pending) total += p.length;
  const all = new Uint8Array(total);
  let o = 0;
  for (const p of run.pending) { all.set(p, o); o += p.length; }
  run.pending = [];
  run.lastSend = now;
  postMessage({ type: "out", id: run.id, text: run.decoder.decode(all, { stream: true }) });
}

// 退到 UTF-8 字符边界，避免把一个中文字切成两半
function utf8Boundary(bytes, cut) {
  while (cut > 0 && cut < bytes.length && (bytes[cut] & 0xc0) === 0x80) cut--;
  return cut;
}

// Python 每写一段输出都会调用这里（bytes 是 UTF-8 字节）
function write(bytes) {
  if (!run) return bytes.length;
  // 已经达到上限：之后的输出全部丢弃（只在第一次超限时报错让程序停下，
  // 这样 Python 缓冲区里剩下的内容会被清空，不会混进下一次运行）
  if (run.limitHit) return bytes.length;
  let cut = bytes.length;
  // 字节上限
  if (run.bytes + cut > LIMITS.maxBytes) cut = utf8Boundary(bytes, LIMITS.maxBytes - run.bytes);
  // 行数上限
  let lines = run.lines;
  for (let i = 0; i < cut; i++) {
    if (bytes[i] === 10) {
      lines++;
      if (lines >= LIMITS.maxLines) { cut = i + 1; break; }
    }
  }
  const part = bytes.slice(0, cut);
  run.bytes += part.length;
  run.lines = lines;
  if (part.length) run.pending.push(part);
  if (cut < bytes.length || run.lines >= LIMITS.maxLines || run.bytes >= LIMITS.maxBytes) {
    run.limitHit = true;
    send(true);
    throw new Error("output limit"); // 让 Python 这次 print 失败，程序停下来
  }
  send(false);
  return bytes.length;
}

// 这段 Python 负责：新建干净的变量空间、注入测试数据、执行、整理错误信息
const PY_HELPER = `
import sys, traceback

_FILE = "<你的代码>"
_MAX = ${LIMITS.maxErrorChars}

def _no_input(*args, **kwargs):
    raise RuntimeError("本应用暂不支持 input()")

def _short(s):
    s = str(s)
    return s if len(s) <= _MAX else s[:_MAX] + "…（已截断）"

def _flush():
    for f in (sys.stdout, sys.stderr):
        try:
            f.flush()
        except BaseException:
            pass

def _run(src, data=None):
    ns = {"__name__": "__main__", "input": _no_input}
    if data is not None:
        ns.update(data)          # data 已经是 Python 字典
    try:
        code = compile(src, _FILE, "exec")
        exec(code, ns)
        return None
    except SyntaxError as e:
        return {"kind": type(e).__name__, "line": e.lineno, "msg": _short(e.msg)}
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == _FILE]
        line = frames[-1].lineno if frames else None
        return {"kind": type(e).__name__, "line": line, "msg": _short(e)}
    finally:
        _flush()                 # 没有换行的输出（如 print("a", end="")）也要刷出来
`;

onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const t0 = performance.now();
      const { loadPyodide } = await import(/* @vite-ignore */ m.indexURL + "pyodide.mjs");
      pyodide = await loadPyodide({ indexURL: m.indexURL });
      pyodide.setStdout({ write });
      pyodide.setStderr({ write });
      pyodide.runPython(PY_HELPER);
      pyodide.runPython(PY_TASK_HELPER);
      taskPy = pyodide.globals.get("_run_task");
      runPy = pyodide.globals.get("_run");
      flushPy = pyodide.globals.get("_flush");
      postMessage({ type: "ready", ms: Math.round(performance.now() - t0) });
    } catch (err) {
      postMessage({ type: "loadError", msg: String((err && err.message) || err).slice(0, LIMITS.maxErrorChars) });
    }
    return;
  }
  if (m.type === "run") {
    resetRun(m.id);
    let err = null;
    let data = null;
    let res = null;
    let files = null;
    try {
      if (m.task) {
        // 任务运行：每次都是全新的变量空间和虚拟文件系统（见 py-task.js）
        const t = { ...m.task, id: m.id };
        // code 是“入口文件”的简写：files 里没有入口文件时，用 code 补上（code 为空串则不补）
        t.files = { ...(t.files || {}) };
        const entry = t.entry || "main.py";
        if (typeof m.code === "string" && m.code !== "" && !(entry in t.files)) t.files[entry] = m.code;
        if (m.data) t.data = m.data;
        data = pyodide.toPy(t);
        res = taskPy(data);
        const r = res.toJs({ dict_converter: Object.fromEntries });
        err = r.error || null;
        files = r.files || null;
      } else {
        data = m.data ? pyodide.toPy(m.data) : null;
        res = data ? runPy(m.code, data) : runPy(m.code);
        if (res) err = res.toJs({ dict_converter: Object.fromEntries });
      }
    } catch (x) {
      err = { kind: "InternalError", line: null, msg: String((x && x.message) || x).slice(0, LIMITS.maxErrorChars) };
    } finally {
      if (res) res.destroy();
      if (data) data.destroy();
      try { flushPy(); } catch { /* 已在上限时停止 */ }
    }
    const limitHit = run.limitHit;
    send(true);
    postMessage({ type: "done", id: m.id, error: limitHit ? null : err, limitHit, files: limitHit ? null : files });
    run = null;
  }
};
