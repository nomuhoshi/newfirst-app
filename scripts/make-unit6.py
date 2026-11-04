# 生成 content/unit6.json（第 6 单元「类型与报错」：第 1 部分 U6L1–U6L2，每关 4 题）。
# 内容在这里改，再运行：python3 scripts/make-unit6.py && python3 scripts/verify-content.py
# 只用已学语法（U1–U5：print、变量、运算、字符串、len、比较、if/else、and/or/not、for/while、列表），加上本关新教的内容：
#   U6L1 type() 和 int / float / str / bool 四种类型；U6L2 int() 和 str() 转换。
# 本部分不用：input、f-string、字符串乘法（"ab" * 2）、float()、round()、列表推导式。predict 题的程序必须能正常运行（报错只出现在错误选项或填空的错误词块里）。
import json, pathlib

def pred(prompt, code, opts, tip=None):
    d = {"type": "predict", "prompt": prompt, "code": code,
         "options": [{"text": t, "correct": c, "why": w} for t, c, w in opts]}
    if tip: d["tip"] = tip
    return d

def fill(prompt, code, tokens, answer, expected, why, hint):
    return {"type": "fill", "prompt": prompt, "code": code, "tokens": tokens, "answer": answer, "expected": expected, "why": why, "hint": hint}

def order(prompt, lines, shuffled, answers, expected, hint):
    return {"type": "order", "prompt": prompt, "lines": lines, "shuffled": shuffled, "answers": answers, "expected": expected, "hint": hint}


import itertools, io, contextlib
def _out(code):
    buf = io.StringIO()
    try:
        with contextlib.redirect_stdout(buf): exec(code, {})
    except Exception as e: return "<" + type(e).__name__ + ">"
    return buf.getvalue().rstrip("\n")
def _case(lines, case):
    return [f"{l.split(' = ')[0]} = {case[l.split(' = ')[0]]!r}" if " = " in l and not l.startswith(" ") and l.split(" = ")[0] in case else l for l in lines]
def valid_orders(lines, expected, cases=()):
    """能得到 expected、并且在 cases 的每组数据下都和标准顺序输出相同的排列才算对（规范答案在最前面）。"""
    canon = list(range(len(lines))); res = []
    for p in itertools.permutations(canon):
        if _out("\n".join(lines[k] for k in p)) != expected: continue
        if all(_out("\n".join(_case(lines, c)[k] for k in p)) == _out("\n".join(_case(lines, c)[k] for k in canon)) for c in cases): res.append(list(p))
    res.sort(key=lambda a: a != canon); return res

def TST(name, data, expected, hidden=False):
    d = {"name": name, "data": data, "expected": expected}
    if hidden: d["hidden"] = True
    return d


SHOW = "点单屏运行这段程序，屏幕上会显示什么？"
T, F = True, False

# U6L2 排序题的标准顺序
O62 = ["text = \"12\"", "num = int(text)", "total = num + 8", "print(total)"]

lessons = [
 {"id": "U6L1", "title": "它是什么类型", "concept": "type() 和四种类型",
  "story": "点单屏里的值有不同的“种类”：15 是整数（int），15.5 是小数（float），\"15\" 是文字（str），True 是布尔（bool）。同样长得像 15，加了引号就是文字。type() 能让 Python 说出一个值的种类，结果长这样：<class 'int'>，引号里的 int 就是种类名。",
  "introCode": "print(type(15))\nprint(type(\"15\"))",
  "exercises": [
    pred(SHOW, "cups = 3\nprint(type(cups))", [
        ("<class 'int'>", T, "3 没有引号，是整数，种类名是 int。"),
        ("<class 'str'>", F, "cups 里是数字 3，没有引号，不是文字。"),
        ("3", F, "type() 说的是值的种类，不是值本身。")],
        tip="type(值) 显示这个值的种类：<class '种类名'>。"),
    pred(SHOW, "a = 15\nb = \"15\"\nprint(type(a))\nprint(type(b))", [
        ("<class 'int'>\n<class 'str'>", T, "a 是数字 15（int）；b 加了引号，是文字（str）。"),
        ("<class 'int'>\n<class 'int'>", F, "b 的 15 带着引号，是文字，不是整数。"),
        ("<class 'str'>\n<class 'int'>", F, "顺序反了：a 没有引号，是整数；b 才有引号。")],
        tip="15 和 \"15\" 看着一样，种类不一样：有引号的是文字。"),
    fill("屏幕要显示：<class 'float'>。哪一个能做到？", "print(type({0}))",
        ["30 / 2", "30 - 2", "\"30\""], ["30 / 2"], "<class 'float'>",
        {"30 - 2": "30 - 2 是 28，整数，显示 <class 'int'>。", "\"30\"": "加了引号的 30 是文字，显示 <class 'str'>。"},
        "还记得 30 / 2 得到 15.0 吗？除法的结果是小数（float）。"),
    pred(SHOW, "ok = 5 > 3\nprint(type(ok))", [
        ("<class 'bool'>", T, "比较的结果是 True 或 False，种类是布尔 bool。"),
        ("True", F, "type() 说的是种类，不是比较的结果。"),
        ("<class 'int'>", F, "True / False 不是整数，是布尔 bool。")],
        tip="比较的结果（True / False）种类是 bool。"),
  ]},
 {"id": "U6L2", "title": "文字和数字互换", "concept": "int() 和 str()",
  "story": "文字 \"15\" 和数字 15 不一样。\"杯数：\" + 3 会报错 TypeError：\"杯数：\" 是文字，3 是整数，Python 不能直接用 + 把它们接起来。解决办法是先统一种类：int() 可以把 \"15\" 这类表示整数的文字转成整数，str(3) 把整数转成文字。转好之后，才能用 + 做加法，或者拼进文字里。",
  "introCode": "price = \"15\"\nprint(int(price) + 5)\nprint(\"杯数：\" + str(3))",
  "exercises": [
    pred(SHOW, "price = \"15\"\nprint(int(price) + 5)", [
        ("20", T, "int(price) 先把文字 \"15\" 变成数字 15，再加 5 得 20。"),
        ("155", F, "155 是把 \"15\" 和 \"5\" 拼在一起的结果；这里 int() 已经把它变成数字，是做加法。"),
        ("15 + 5", F, "print 显示的是计算结果，不是算式。")],
        tip="int() 可以把 \"15\" 这类表示整数的文字转成整数，之后就能做加法。"),
    fill("屏幕要显示：杯数：3", "cups = 3\nprint(\"杯数：\" + {0})",
        ["str(cups)", "cups", "int(cups)"], ["str(cups)"], "杯数：3",
        {"cups": "\"杯数：\" 是文字，cups 是整数 3，Python 不能直接用 + 把它们接起来，所以会报 TypeError。用 str(cups) 转成文字后就能拼接。", "int(cups)": "int(cups) 还是整数 3，\"杯数：\" 是文字，文字加整数照样会报 TypeError。要用 str(cups) 转成文字才能拼接。"},
        "拼进文字里的必须是文字：用 str() 把数字变成文字。"),
    order("排好顺序。屏幕显示：20", O62, [3, 1, 0, 2], valid_orders(O62, "20"),
        "20", "先有文字，再变成整数，再相加，最后显示。"),
    pred(SHOW, "a = \"12\"\nb = \"8\"\nprint(a + b)\nprint(int(a) + int(b))", [
        ("128\n20", T, "第一行：两段文字拼在一起是 128；第二行：先都变成数字，再相加得 20。"),
        ("20\n20", F, "第一行 a + b 是两段文字，会拼在一起得 128，不会相加。"),
        ("128\n128", F, "第二行先用 int() 把两个都变成数字，再相加得 20。")],
        tip="文字 + 文字 = 拼接；整数 + 整数 = 相加。想相加，先 int()。"),
  ]},
]

unit = {"id": "U6", "title": "类型与报错", "subtitle": "type、int()/str()、读报错", "lessons": lessons}
p = pathlib.Path(__file__).resolve().parent.parent / "content/unit6.json"
p.write_text(json.dumps(unit, ensure_ascii=False, indent=2) + "\n")
print("写入", p, "关卡", len(lessons), "题目", sum(len(l["exercises"]) for l in lessons))
