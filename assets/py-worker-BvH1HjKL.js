const e={maxLines:100,maxBytes:8192,maxErrorChars:600},t=String.raw`
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
`;let n=null,r=null,i=null,a=null,o=null;function s(e){o={id:e,bytes:0,lines:0,limitHit:!1,pending:[],lastSend:Date.now(),decoder:new TextDecoder}}function c(e){if(!o||o.pending.length===0)return;let t=Date.now();if(!e&&t-o.lastSend<50)return;let n=0;for(let e of o.pending)n+=e.length;let r=new Uint8Array(n),i=0;for(let e of o.pending)r.set(e,i),i+=e.length;o.pending=[],o.lastSend=t,postMessage({type:`out`,id:o.id,text:o.decoder.decode(r,{stream:!0})})}function l(e,t){for(;t>0&&t<e.length&&(e[t]&192)==128;)t--;return t}function u(t){if(!o||o.limitHit)return t.length;let n=t.length;o.bytes+n>e.maxBytes&&(n=l(t,e.maxBytes-o.bytes));let r=o.lines;for(let i=0;i<n;i++)if(t[i]===10&&(r++,r>=e.maxLines)){n=i+1;break}let i=t.slice(0,n);if(o.bytes+=i.length,o.lines=r,i.length&&o.pending.push(i),n<t.length||o.lines>=e.maxLines||o.bytes>=e.maxBytes)throw o.limitHit=!0,c(!0),Error(`output limit`);return c(!1),t.length}const d=`
import sys, traceback

_FILE = "<你的代码>"
_MAX = ${e.maxErrorChars}

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
`,f=/Load failed|Failed to fetch|NetworkError|fetch|Importing a module script failed|Failed to load|wasm|pyodide/i;self.addEventListener(`unhandledrejection`,t=>{if(n)return;let r=String(t.reason&&t.reason.message||t.reason||``);f.test(r)&&(t.preventDefault?.(),console.error(`[py-worker] Pyodide 加载阶段的未处理拒绝：`,t.reason),postMessage({type:`loadError`,msg:r.slice(0,e.maxErrorChars)}))}),onmessage=async l=>{let f=l.data;if(f.type===`init`)try{let e=performance.now(),{loadPyodide:o}=await import(
/* @vite-ignore */
f.indexURL+`pyodide.mjs`);n=await o({indexURL:f.indexURL}),n.setStdout({write:u}),n.setStderr({write:u}),n.runPython(d),n.runPython(t),a=n.globals.get(`_run_task`),r=n.globals.get(`_run`),i=n.globals.get(`_flush`),postMessage({type:`ready`,ms:Math.round(performance.now()-e)})}catch(t){postMessage({type:`loadError`,msg:String(t&&t.message||t).slice(0,e.maxErrorChars)})}else if(f.type===`run`){s(f.id);let t=null,l=null,u=null,d=null,p=null;try{if(f.task){let e=JSON.parse(JSON.stringify({...f.task,id:f.id},(e,t)=>t===null?void 0:t));e.files={...e.files||{}};let r=e.entry||`main.py`;typeof f.code==`string`&&f.code!==``&&!(r in e.files)&&(e.files[r]=f.code),p=n.toPy(e),l=f.data?n.toPy(f.data):null,u=l?a(p,l):a(p);let i=u.toJs({dict_converter:Object.fromEntries});t=i.error||null,d=i.files?Object.fromEntries(Object.entries(i.files).map(([e,t])=>[e,t??null])):null}else l=f.data?n.toPy(f.data):null,u=l?r(f.code,l):r(f.code),u&&(t=u.toJs({dict_converter:Object.fromEntries}))}catch(n){t={kind:`InternalError`,line:null,msg:String(n&&n.message||n).slice(0,e.maxErrorChars)}}finally{u&&u.destroy(),l&&l.destroy(),p&&p.destroy();try{i()}catch{}}let m=o.limitHit;c(!0),postMessage({type:`done`,id:f.id,error:m?null:t,limitHit:m,files:m?null:d}),o=null}};