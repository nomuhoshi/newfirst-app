# 公共部分：在全新变量空间里真实运行一段 Python，单次有时间上限（只防卡死）。
import io, signal, contextlib
RUN_S = 2.0
stats = {"runs": 0}
class Timeout(Exception): pass
def _alarm(*_): raise Timeout()
signal.signal(signal.SIGALRM, _alarm)

def run(code):
    """返回 (输出, 错误类型或 None)。输出去掉末尾一个换行。超时返回错误 "Timeout"。"""
    stats["runs"] += 1
    buf = io.StringIO(); err = None
    signal.setitimer(signal.ITIMER_REAL, RUN_S)
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "<题目>", "exec"), {"__name__": "__main__"})
    except Timeout: err = "Timeout"
    except BaseException as e: err = type(e).__name__
    finally: signal.setitimer(signal.ITIMER_REAL, 0)
    out = buf.getvalue()
    return (out[:-1] if out.endswith("\n") else out), err

# 已知问题：在别的 PR 里修，单独列出，不算失败。修好合并后删掉。
KNOWN = {}

class Check:
    """每个检查模块一个：自己的 检查/跳过/失败/已知 计数。"""
    def __init__(self, name): self.name, self.checked, self.skipped, self.fails, self.known, self.notes = name, 0, [], [], [], []
    def ok(self, cond, where, msg):
        self.checked += 1
        if not cond:
            key = where.split("(")[0]
            if key in KNOWN: self.known.append(f"{where}：{msg}（已知：{KNOWN[key]}）")
            else: self.fails.append(f"{where}：{msg}")
    def skip(self, where, why): self.skipped.append(f"{where}：{why}")

# ---- 读报错题用：真实运行一段会出错的程序，返回出错信息（生成器和验证器共用，保证两边口径一致）----
import traceback as _tb
def real_error(code):
    """程序正常结束返回 None；出错返回 {type, line, msg, stdout, code_line, trace}。
    trace 是课程里展示的报错：和真实 Python 一样的格式（文件名 main.py），只省略代码行下面画 ^ 和 ~ 的小箭头行。"""
    stats["runs"] += 1
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf):
            exec(compile(code, "main.py", "exec"), {"__name__": "__main__"})
    except BaseException as e:
        frames = [f for f in _tb.extract_tb(e.__traceback__) if f.filename == "main.py"]
        src = code.split("\n")
        if not frames and isinstance(e, SyntaxError) and e.filename == "main.py" and e.lineno:
            # 编译时就出错（一行都没运行）：真实 Python 的显示没有 Traceback 标题，只有位置、那一行和错误
            ln = e.lineno; cl = src[ln - 1].strip()
            return {"type": type(e).__name__, "line": ln, "msg": e.msg, "stdout": "", "code_line": cl,
                    "trace": "\n".join([f'  File "main.py", line {ln}', "    " + cl, f"{type(e).__name__}: {e.msg}"])}
        lines = ["Traceback (most recent call last):"]
        for f in frames:
            lines.append(f'  File "main.py", line {f.lineno}, in {f.name}')
            lines.append("    " + src[f.lineno - 1].strip())
        lines.append(f"{type(e).__name__}: {e}")
        out = buf.getvalue()
        return {"type": type(e).__name__, "line": frames[-1].lineno, "msg": str(e), "stdout": out[:-1] if out.endswith("\n") else out,
                "code_line": src[frames[-1].lineno - 1].strip(), "trace": "\n".join(lines)}
    return None
