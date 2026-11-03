// 判题 / 练习用的 Python 运行助手（在 Pyodide 工作线程里加载；也可以在 Node 里用真实 CPython 测试）。
// 一次“任务运行”（_run_task）的隔离规则，每一组测试都从零开始：
//   - 全新的全局变量空间（__main__），注入 data
//   - 全新的虚拟工作目录：只含 files 里列出的文件；运行结束后整个目录删除
//   - 学生写的模块（工作目录里的 .py）从 sys.modules 清掉，sys.path 和当前目录还原
//   - 随机数种子重设（默认 0）
//   - input() 只读 stdin 给的行，读完再读 → EOFError（不会挂起）；没有给 stdin → 明确的错误
// 注意：这段 Python 源码里不能出现反引号或 ${ ，因为它放在 JS 模板字符串里。
export const PY_TASK_HELPER = String.raw`
import os, sys, shutil, random, traceback, importlib

_TASK_BASE = "/tmp/_suipian_task"
_TASK_MAX = 400

def _t_short(s):
    s = str(s)
    return s if len(s) <= _TASK_MAX else s[:_TASK_MAX] + "…（已截断）"

def _t_flush():
    for f in (sys.stdout, sys.stderr):
        try:
            f.flush()
        except BaseException:
            pass

def _t_safe(rel):
    if not isinstance(rel, str) or not rel:
        raise ValueError("文件名无效")
    p = os.path.normpath(rel)
    if os.path.isabs(p) or p == ".." or p.startswith(".." + os.sep):
        raise ValueError("文件路径不能超出工作目录：" + rel)
    return p

def _t_lines(stdin):
    if stdin is None:
        return None
    if isinstance(stdin, str):
        parts = stdin.replace("\r\n", "\n").replace("\r", "\n").split("\n")
        if parts and parts[-1] == "":
            parts.pop()
        return parts
    return [str(x) for x in stdin]

def _t_make_input(lines):
    q = None if lines is None else list(lines)
    def _input(prompt=""):
        if q is None:
            raise RuntimeError("这道题没有输入数据，不能使用 input()")
        sys.stdout.write(str(prompt))
        if not q:
            raise EOFError("EOF when reading a line")
        return q.pop(0)
    return _input

def _run_task(opts, data=None):
    uid = str(opts.get("id", 0))
    root = os.path.join(_TASK_BASE, uid)
    old_cwd = os.getcwd()
    old_path = list(sys.path)
    old_mods = set(sys.modules)
    err = None
    out_files = {}
    try:
        shutil.rmtree(root, ignore_errors=True)
        os.makedirs(root)
        for rel, content in (opts.get("files") or {}).items():
            p = os.path.join(root, _t_safe(rel))
            os.makedirs(os.path.dirname(p), exist_ok=True)
            with open(p, "w", encoding="utf-8", newline="") as f:
                f.write(str(content))
        entry = _t_safe(opts.get("entry") or "main.py")
        ep = os.path.join(root, entry)
        if not os.path.isfile(ep):
            return {"error": {"kind": "InternalError", "line": None, "msg": "找不到入口文件 " + entry}, "files": {}}
        with open(ep, encoding="utf-8", newline="") as f:
            src = f.read()
        os.chdir(root)
        sys.path.insert(0, root)
        importlib.invalidate_caches()
        random.seed(opts.get("seed", 0))
        ns = {"__name__": "__main__", "__file__": ep, "input": _t_make_input(_t_lines(opts.get("stdin")))}
        if data is not None:
            ns.update(data)
        try:
            exec(compile(src, ep, "exec"), ns)
        except SyntaxError as e:
            fn = getattr(e, "filename", None) or ep
            err = {"kind": type(e).__name__, "line": e.lineno, "msg": _t_short(e.msg),
                   "file": os.path.relpath(fn, root) if fn.startswith(root) else entry}
        except BaseException as e:
            frames = [f for f in traceback.extract_tb(e.__traceback__) if f.filename.startswith(root)]
            line = frames[-1].lineno if frames else None
            fl = os.path.relpath(frames[-1].filename, root) if frames else None
            err = {"kind": type(e).__name__, "line": line, "msg": _t_short(e), "file": fl}
        _t_flush()
        for rel in (opts.get("read") or []):
            p = os.path.join(root, _t_safe(rel))
            try:
                with open(p, encoding="utf-8", errors="replace", newline="") as f:
                    out_files[rel] = f.read()
            except OSError:
                out_files[rel] = None
        return {"error": err, "files": out_files}
    except BaseException as e:
        return {"error": {"kind": "InternalError", "line": None, "msg": _t_short(e)}, "files": {}}
    finally:
        _t_flush()
        try:
            os.chdir(old_cwd)
        except OSError:
            os.chdir("/")
        sys.path[:] = old_path
        for name in set(sys.modules) - old_mods:
            f = getattr(sys.modules.get(name), "__file__", None)
            if isinstance(f, str) and f.startswith(root):
                sys.modules.pop(name, None)
        importlib.invalidate_caches()
        shutil.rmtree(root, ignore_errors=True)
`;
