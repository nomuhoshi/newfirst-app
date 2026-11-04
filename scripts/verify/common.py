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
