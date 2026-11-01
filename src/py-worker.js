// 工作线程：在后台加载 Pyodide 并执行用户代码，避免卡住界面。
// 和主线程之间只用 postMessage 传结构化数据。

let pyodide = null;
let runPy = null; // Python 里定义的 _run 函数
let outBuf = "";
let lastFlush = 0;
let currentId = null;
const decoder = new TextDecoder(); // 流式解码，避免中文被切成两半

// 输出先攒起来，最多每 50 毫秒发一次，防止“输出洪水”把页面卡死
function flush(force) {
  const now = Date.now();
  if (outBuf && (force || now - lastFlush > 50 || outBuf.length > 2048)) {
    postMessage({ type: "out", id: currentId, text: outBuf });
    outBuf = "";
    lastFlush = now;
  }
}

// 这段 Python 负责：新建干净的变量空间、注入测试数据、执行、整理错误信息
const PY_HELPER = `
import traceback

_FILE = "<你的代码>"

def _no_input(*args, **kwargs):
    raise RuntimeError("本应用暂不支持 input()")

def _run(src, data=None):
    ns = {"__name__": "__main__", "input": _no_input}
    if data is not None:
        ns.update(data.to_py())
    try:
        code = compile(src, _FILE, "exec")
        exec(code, ns)
        return None
    except SyntaxError as e:
        return {"kind": type(e).__name__, "line": e.lineno, "msg": e.msg}
    except BaseException as e:
        frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename == _FILE]
        line = frames[-1].lineno if frames else None
        return {"kind": type(e).__name__, "line": line, "msg": str(e)}
`;

onmessage = async (e) => {
  const m = e.data;
  if (m.type === "init") {
    try {
      const t0 = performance.now();
      const { loadPyodide } = await import(/* @vite-ignore */ m.indexURL + "pyodide.mjs");
      pyodide = await loadPyodide({ indexURL: m.indexURL });
      pyodide.setStdout({ write: (bytes) => { outBuf += decoder.decode(bytes, { stream: true }); flush(false); return bytes.length; } });
      pyodide.setStderr({ write: (bytes) => { outBuf += decoder.decode(bytes, { stream: true }); flush(false); return bytes.length; } });
      pyodide.runPython(PY_HELPER);
      runPy = pyodide.globals.get("_run");
      postMessage({ type: "ready", ms: Math.round(performance.now() - t0) });
    } catch (err) {
      postMessage({ type: "loadError", msg: String(err && err.message || err) });
    }
    return;
  }
  if (m.type === "run") {
    currentId = m.id;
    outBuf = "";
    lastFlush = Date.now();
    let err = null;
    try {
      const data = m.data ? pyodide.toPy(m.data) : null;
      const res = data ? runPy(m.code, data) : runPy(m.code);
      if (data) data.destroy();
      if (res) { err = res.toJs({ dict_converter: Object.fromEntries }); res.destroy(); }
    } catch (x) {
      err = { kind: "InternalError", line: null, msg: String(x && x.message || x) };
    }
    flush(true);
    postMessage({ type: "done", id: m.id, error: err });
  }
};
