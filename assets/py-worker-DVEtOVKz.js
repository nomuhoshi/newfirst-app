const e={maxLines:100,maxBytes:8192,maxErrorChars:600};let t=null,n=null,r=null,i=null;function a(e){i={id:e,bytes:0,lines:0,limitHit:!1,pending:[],lastSend:Date.now(),decoder:new TextDecoder}}function o(e){if(!i||i.pending.length===0)return;let t=Date.now();if(!e&&t-i.lastSend<50)return;let n=0;for(let e of i.pending)n+=e.length;let r=new Uint8Array(n),a=0;for(let e of i.pending)r.set(e,a),a+=e.length;i.pending=[],i.lastSend=t,postMessage({type:`out`,id:i.id,text:i.decoder.decode(r,{stream:!0})})}function s(e,t){for(;t>0&&t<e.length&&(e[t]&192)==128;)t--;return t}function c(t){if(!i||i.limitHit)return t.length;let n=t.length;i.bytes+n>e.maxBytes&&(n=s(t,e.maxBytes-i.bytes));let r=i.lines;for(let i=0;i<n;i++)if(t[i]===10&&(r++,r>=e.maxLines)){n=i+1;break}let a=t.slice(0,n);if(i.bytes+=a.length,i.lines=r,a.length&&i.pending.push(a),n<t.length||i.lines>=e.maxLines||i.bytes>=e.maxBytes)throw i.limitHit=!0,o(!0),Error(`output limit`);return o(!1),t.length}const l=`
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
`;onmessage=async s=>{let u=s.data;if(u.type===`init`)try{let e=performance.now(),{loadPyodide:i}=await import(
/* @vite-ignore */
u.indexURL+`pyodide.mjs`);t=await i({indexURL:u.indexURL}),t.setStdout({write:c}),t.setStderr({write:c}),t.runPython(l),n=t.globals.get(`_run`),r=t.globals.get(`_flush`),postMessage({type:`ready`,ms:Math.round(performance.now()-e)})}catch(t){postMessage({type:`loadError`,msg:String(t&&t.message||t).slice(0,e.maxErrorChars)})}else if(u.type===`run`){a(u.id);let s=null,c=null,l=null;try{c=u.data?t.toPy(u.data):null,l=c?n(u.code,c):n(u.code),l&&(s=l.toJs({dict_converter:Object.fromEntries}))}catch(t){s={kind:`InternalError`,line:null,msg:String(t&&t.message||t).slice(0,e.maxErrorChars)}}finally{l&&l.destroy(),c&&c.destroy();try{r()}catch{}}let d=i.limitHit;o(!0),postMessage({type:`done`,id:u.id,error:d?null:s,limitHit:d}),i=null}};