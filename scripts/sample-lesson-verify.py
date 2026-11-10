# 样板关题面的真实 Python 核对：需求 = 满 100 元减 20 元，正好 100 也减。
import io, contextlib
def run(src, total):
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(src.replace("{T}", str(total)), {})
    return buf.getvalue().strip()
BASE = 'total = {T}\nif total > 100:\n    total = total - 20\nprint(total)'
need = lambda t: t - 20 if t >= 100 else t
fails = []
def ok(c, m):
    if not c: fails.append(m)
# Q1 追踪
ok(run(BASE, 120) == "100", "Q1 正确项 100")
ok(run(BASE.replace("total = total - 20", "pass"), 120) == "120", "Q1 干扰：没减 = 120")
ok(run('total = 120\nif total > 100:\n    total = total - 20\nprint(120 - total)', 0) == "20", "Q1 干扰：20（显示减掉的数）")
# Q2 哪个输入暴露错误
exposed = [t for t in (80, 99, 100, 120) if int(run(BASE, t)) != need(t)]
ok(exposed == [100], f"Q2 只有 100 暴露：{exposed}")
for t in (80, 99, 100, 120): print("Q2", t, "程序显示", run(BASE, t), "需求", need(t))
# Q3 哪个修法满足需求（对 80/99/100/120 + 90 都要对）
FIX = {
 "A >= 100": 'total = {T}\nif total >= 100:\n    total = total - 20\nprint(total)',
 "B == 100": 'total = {T}\nif total == 100:\n    total = total - 20\nprint(total)',
 "C > 80":   'total = {T}\nif total > 80:\n    total = total - 20\nprint(total)',
 "D >= 101": 'total = {T}\nif total >= 101:\n    total = total - 20\nprint(total)',
}
for k, src in FIX.items():
    bad = [t for t in (80, 90, 99, 100, 120) if int(run(src, t)) != need(t)]
    print("Q3", k, "不符合需求的输入：", bad)
    ok((k.startswith("A")) == (bad == []), f"Q3 {k}")
print("失败：", fails or "无")
