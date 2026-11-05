# 读报错选择题（pick）：程序和报错都用真实 Python 核对。
#   checks：[{program, type, line, msg}] 每段程序必须真的报这个错（类型、行号、信息都一致）。
#   trace：以 Traceback 开头 → 必须和真实报错逐字一致（来自 traceProgram，没写就是 code）；
#          否则（几段程序的摘要）→ 每段程序的“类型: 信息”必须出现在里面。
#   key：type / line / stdout / fix，决定“正确选项”怎么用真实运行核对：
#     type   正确选项的 value = 各段程序真实错误类型（逗号连接），错误选项的 value 不等于它
#     line   选项文字 = 程序里的某一行；正确选项 = 真实出错那一行
#     stdout 正确选项的 value = 出错前真实已经显示的内容
#     fix    每个选项有 fixed（改完的整段程序），真实运行：只有不报错且输出 == expected 的才算对
from .common import run, real_error, Check
def check(items):
    c = Check("读报错 pick")
    for w, l, ex in items:
        if ex["type"] != "pick":
            if ex.get("trace"):  # 其他题型也可以带一段真实报错（比如填空题：先看小码写错时的报错，再动手改）
                rt = real_error(ex.get("traceProgram", ""))
                c.ok(rt is not None and rt["trace"] == ex["trace"], w, f"展示的报错和 traceProgram 的真实报错不一致：{ex['trace']!r}")
            continue
        opts = ex["options"]
        cor = [o for o in opts if o["correct"]]
        c.ok(len(cor) == 1, w, f"正确选项有 {len(cor)} 个")
        if ex.get("key") == "fix" and not ex.get("checks"):  # 没有报错的“怎么改”题（比如把调试 print 放哪）：只用 fixed 真实运行核对
            for o in opts:
                out, err = run(o["fixed"]); good = err is None and out == ex["expected"]
                c.ok(good == o["correct"], w, f"选项 {o['text']!r}：真实运行{'报错 ' + str(err) if err else '输出 ' + repr(out)}，期望 {ex['expected']!r}，correct={o['correct']}")
            continue
        real = []
        for k in ex.get("checks", []):
            r = real_error(k["program"])
            c.ok(r is not None, w, f"程序没有报错：{k['program']!r}")
            if r is None: real.append(None); continue
            real.append(r)
            c.ok((r["type"], r["line"], r["msg"]) == (k["type"], k["line"], k["msg"]), w, f"报错和登记的不一致：真实 {r['type']} 第 {r['line']} 行 {r['msg']!r}，登记 {k['type']} 第 {k['line']} 行 {k['msg']!r}")
        c.ok(len(real) >= 1 and all(real), w, "没有可核对的报错")
        if not (real and all(real)): continue
        tr = ex.get("trace")
        if tr:
            if tr.startswith("Traceback"):
                tp = ex.get("traceProgram") or ex.get("code")
                rt = real_error(tp) if tp else None
                c.ok(rt is not None and rt["trace"] == tr, w, f"展示的报错和真实报错不一致：{tr!r}")
            else:
                for k, r in zip(ex["checks"], real):
                    c.ok(f"{r['type']}: {r['msg']}" in tr, w, f"摘要里缺少真实报错：{r['type']}: {r['msg']}")
                    for ln in k["program"].split("\n"): c.ok(ln.strip() in tr, w, f"摘要里缺少程序行：{ln!r}")
        if ex.get("code") and ex["checks"] and ex.get("key") in ("type", "line", "stdout"):
            c.ok(ex["code"] == ex["checks"][0]["program"], w, "展示的程序和被核对的程序不一样")
        key = ex.get("key")
        if key == "type":
            want = ",".join(r["type"] for r in real)
            for o in opts: c.ok((o["value"] == want) == o["correct"], w, f"选项 {o['text']!r} value={o['value']!r}，真实 {want!r}，correct={o['correct']}")
        elif key == "line":
            src = ex["checks"][0]["program"].split("\n")
            for o in opts:
                c.ok(o["text"] in [s.strip() for s in src], w, f"选项 {o['text']!r} 不是程序里的一行")
                c.ok((o["text"] == real[0]["code_line"]) == o["correct"], w, f"选项 {o['text']!r} 对错标记和真实出错行 {real[0]['code_line']!r} 不符")
        elif key == "stdout":
            for o in opts: c.ok((o["value"] == real[0]["stdout"]) == o["correct"], w, f"选项 {o['text']!r} value={o['value']!r}，真实出错前输出 {real[0]['stdout']!r}")
        elif key == "fix":
            for o in opts:
                out, err = run(o["fixed"])   # run() 能处理编译期错误（SyntaxError / IndentationError）；这里不需要 real_error 的详细报错
                good = err is None and out == ex["expected"]
                c.ok(good == o["correct"], w, f"选项 {o['text']!r}：真实运行{'报错 ' + str(err) if err else '输出 ' + repr(out)}，期望 {ex['expected']!r}，correct={o['correct']}")
        else:
            c.ok(False, w, f"未知 key {key!r}")
    return c
